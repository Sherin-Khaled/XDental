#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { readUploadStorageConfiguration } from "../../config/uploadStorage.js";
import { PrismaClient } from "../../generated/prisma-client-runtime/client.js";
import { validateProductImage } from "../../services/productImageStorage.service.js";
import {
  buildAuditPlan,
  deriveSkuFromFilename,
  mapWithConcurrency,
  objectKeyForSku,
  publicUrlForObject,
  validateExternalImageUrl,
  verifyCoverageSummary,
} from "./productImageImport.js";

const AUDIT_COLUMNS = [
  "SKU", "source_file", "object_key", "public_url", "previous_image_url",
  "new_image_url", "status", "error",
];
const WRITABLE_STATUSES = new Set(["PLANNED_UPLOAD_UPDATE", "PLANNED_EXTERNAL_UPDATE"]);

function parseArguments(argv) {
  const options = { confirmApply: false, concurrency: 4, verifyCoverage: false };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === "--confirm-apply") options.confirmApply = true;
    else if (argument === "--verify-coverage") options.verifyCoverage = true;
    else if (["--image-dir", "--csv", "--audit-dir", "--concurrency"].includes(argument)) {
      const value = argv[++index];
      if (!value) throw new Error(`${argument} requires a value.`);
      if (argument === "--image-dir") options.imageDir = path.resolve(value);
      if (argument === "--csv") options.csvPath = path.resolve(value);
      if (argument === "--audit-dir") options.auditDir = path.resolve(value);
      if (argument === "--concurrency") options.concurrency = Number(value);
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.auditDir) throw new Error("--audit-dir is required so generated audits stay outside source control.");
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 16) {
    throw new Error("--concurrency must be a whole number from 1 to 16.");
  }
  if (!options.verifyCoverage && Boolean(options.imageDir) === Boolean(options.csvPath)) {
    throw new Error("Choose exactly one input mode: --image-dir or --csv.");
  }
  if (options.verifyCoverage && (options.imageDir || options.csvPath || options.confirmApply)) {
    throw new Error("--verify-coverage is read-only and cannot be combined with import inputs or --confirm-apply.");
  }
  return options;
}

async function recursivelyListWebpFiles(directory) {
  const files = [];
  async function visit(current) {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(target);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".webp")) files.push(target);
    }
  }
  await visit(directory);
  return files;
}

async function imageCandidates(imageDir, configuration, concurrency) {
  const files = await recursivelyListWebpFiles(imageDir);
  return mapWithConcurrency(files, concurrency, async (filePath) => {
    const sku = deriveSkuFromFilename(filePath);
    const objectKey = sku ? objectKeyForSku(sku) : "";
    const publicUrl = objectKey ? publicUrlForObject(configuration.publicBaseUrl, objectKey) : "";
    const buffer = await readFile(filePath);
    const validation = validateProductImage(buffer, "image/webp");
    return {
      sku,
      sourceFile: filePath,
      objectKey,
      publicUrl,
      mode: "upload",
      buffer,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      ...(validation.error ? { status: "ERROR_INVALID_IMAGE", error: validation.error.message } : {}),
    };
  });
}

async function externalCandidates(csvPath) {
  const rows = parse(await readFile(csvPath, "utf8"), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  return rows.map((row, index) => {
    const sku = typeof row.SKU === "string" ? row.SKU.trim() : "";
    const publicUrl = validateExternalImageUrl(row.image_url);
    return {
      sku,
      sourceFile: `${csvPath}#row-${index + 2}`,
      objectKey: "",
      publicUrl: publicUrl ?? "",
      mode: "external",
      ...(!sku || !publicUrl ? {
        status: "ERROR_INVALID_CSV_ROW",
        error: "CSV rows require exact SKU and an absolute HTTPS image_url.",
      } : {}),
    };
  });
}

async function writeAudit(auditDir, rows, metadata = {}) {
  await mkdir(auditDir, { recursive: true });
  const csvPath = path.join(auditDir, "product-image-import-audit.csv");
  const jsonPath = path.join(auditDir, "product-image-import-audit.json");
  const cleanRows = rows.map((row) => Object.fromEntries(AUDIT_COLUMNS.map((column) => [column, row[column] ?? ""])));
  await Promise.all([
    writeFile(csvPath, stringify(cleanRows, { header: true, columns: AUDIT_COLUMNS })),
    writeFile(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), ...metadata, rows: cleanRows }, null, 2)),
  ]);
  return { csvPath, jsonPath };
}

function s3Client(configuration) {
  return new S3Client({
    endpoint: configuration.endpoint,
    region: configuration.region,
    forcePathStyle: configuration.forcePathStyle,
    credentials: {
      accessKeyId: configuration.accessKeyId,
      secretAccessKey: configuration.secretAccessKey,
    },
  });
}

async function verifyCoverage(database, auditDir) {
  const [total, withImages, missing] = await Promise.all([
    database.product.count(),
    database.product.count({ where: { AND: [{ imageUrl: { not: null } }, { imageUrl: { not: "" } }] } }),
    database.product.findMany({ where: { OR: [{ imageUrl: null }, { imageUrl: "" }] }, select: { sku: true, name: true }, orderBy: { sku: "asc" } }),
  ]);
  const summary = verifyCoverageSummary({ total, withImages, missingSkus: missing.map((row) => row.sku) });
  const rows = missing.map((row) => ({
    SKU: row.sku ?? "",
    source_file: "",
    object_key: "",
    public_url: "",
    previous_image_url: "",
    new_image_url: "",
    status: "EXPECTED_FALLBACK",
    error: "",
  }));
  const outputs = await writeAudit(auditDir, rows, { mode: "VERIFY_COVERAGE", summary });
  console.log(JSON.stringify({ ...summary, audit: outputs }, null, 2));
  if (!summary.ok) process.exitCode = 1;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const prisma = new PrismaClient();
  try {
    if (options.verifyCoverage) {
      await verifyCoverage(prisma, options.auditDir);
      return;
    }

    let configuration = null;
    let candidates;
    if (options.imageDir) {
      configuration = readUploadStorageConfiguration();
      if (configuration.driver !== "s3") throw new Error("Image-directory mode requires the existing S3 upload storage configuration.");
      candidates = await imageCandidates(options.imageDir, configuration, options.concurrency);
    } else {
      candidates = await externalCandidates(options.csvPath);
    }

    const uniqueSkus = [...new Set(candidates.map((candidate) => candidate.sku).filter(Boolean))];
    const products = await prisma.product.findMany({
      where: { sku: { in: uniqueSkus } },
      select: { id: true, sku: true, imageUrl: true },
    });
    let auditRows = buildAuditPlan(candidates, products);
    const validationErrors = auditRows.filter((row) => row.status.startsWith("ERROR"));
    if (options.confirmApply && validationErrors.length > 0) {
      const outputs = await writeAudit(options.auditDir, auditRows, { mode: "APPLY_REJECTED" });
      console.error(`Apply rejected: ${validationErrors.length} invalid/unknown/duplicate input row(s). Audit: ${outputs.jsonPath}`);
      process.exitCode = 1;
      return;
    }

    if (options.confirmApply) {
      const client = options.imageDir ? s3Client(configuration) : null;
      auditRows = await mapWithConcurrency(auditRows, options.concurrency, async (row, index) => {
        if (!WRITABLE_STATUSES.has(row.status)) return row;
        const candidate = candidates[index];
        try {
          if (candidate.mode === "upload") {
            await client.send(new PutObjectCommand({
              Bucket: configuration.bucket,
              Key: candidate.objectKey,
              Body: candidate.buffer,
              ContentLength: candidate.buffer.length,
              ContentType: "image/webp",
              CacheControl: "public, max-age=31536000, immutable",
              Metadata: { sha256: candidate.sha256, sku: candidate.sku },
            }));
            const head = await client.send(new HeadObjectCommand({ Bucket: configuration.bucket, Key: candidate.objectKey }));
            if (Number(head.ContentLength) !== candidate.buffer.length) throw new Error("Uploaded object size verification failed.");
          }
          const updated = await prisma.product.updateMany({
            where: { id: row.productId, sku: row.SKU, imageUrl: row.previous_image_url || null },
            data: { imageUrl: row.new_image_url },
          });
          if (updated.count !== 1) throw new Error("Product.imageUrl changed concurrently; no database update was applied.");
          return { ...row, status: candidate.mode === "upload" ? "UPLOADED_AND_UPDATED" : "UPDATED" };
        } catch (error) {
          return { ...row, status: "ERROR_APPLY_FAILED", error: error.message };
        }
      });
    }

    const outputs = await writeAudit(options.auditDir, auditRows, {
      mode: options.confirmApply ? "APPLY" : "DRY_RUN",
      inputMode: options.imageDir ? "IMAGE_DIRECTORY" : "EXTERNAL_CSV",
    });
    const counts = Object.fromEntries([...new Set(auditRows.map((row) => row.status))].map((status) => [status, auditRows.filter((row) => row.status === status).length]));
    console.log(JSON.stringify({ mode: options.confirmApply ? "APPLY" : "DRY_RUN", counts, audit: outputs }, null, 2));
    if (auditRows.some((row) => row.status.startsWith("ERROR"))) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`Product image import failed: ${error.message}`);
  process.exitCode = 1;
});
