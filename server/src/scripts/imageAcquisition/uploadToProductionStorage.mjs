#!/usr/bin/env node
/**
 * Section 6 — production storage bulk uploader (prep only).
 *
 * Reads the 210-row master manifest and, for each verified local WebP,
 * uploads it to S3-compatible object storage at a deterministic key:
 *   products/TP-EG-<toothpick_id>/main.webp
 *
 * Reuses the project's existing S3 upload configuration
 * (server/src/config/uploadStorage.js, the same UPLOAD_S3_* env vars the
 * admin single-image upload flow already uses) rather than inventing a
 * separate Supabase-specific client — Supabase Storage exposes an
 * S3-compatible endpoint, so it plugs into this directly.
 *
 * Safety: this script performs a REAL upload+verify ONLY when both (a) a
 * valid "s3" UPLOAD_STORAGE_DRIVER configuration is present in the
 * environment (endpoint/region/bucket/credentials/public base URL) AND
 * (b) the caller explicitly opts in with --confirm-upload. Without both,
 * it always runs in DRY_RUN mode: no network calls, no credentials
 * required, and it still produces the full mapping CSV so the expected
 * upload plan can be reviewed before any credentials are supplied.
 *
 * Never touches the database — see updateProductImagesFromStorage.mjs
 * (Section 7) for the separate, also-preview-only DB update step.
 */
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { readUploadStorageConfiguration } from "../../config/uploadStorage.js";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../../..");
const OUTPUT_ROOT = path.join(PROJECT_ROOT, "image-acquisition-output");
const MANIFEST_PATH = path.join(OUTPUT_ROOT, "X_Dental_Launch_Ready_Images_Master.csv");
const MAPPING_OUTPUT_PATH = path.join(OUTPUT_ROOT, "X_Dental_Storage_Upload_Mapping.csv");

const MAPPING_COLUMNS = [
  "product_id",
  "SKU",
  "toothpick_id",
  "local_file_path",
  "sha256",
  "storage_key",
  "public_url",
  "upload_status",
  "note",
];

function storageKeyFor(toothpickId) {
  return `products/TP-EG-${toothpickId}/main.webp`;
}

async function resolveConfiguration() {
  try {
    const configuration = readUploadStorageConfiguration();
    if (configuration.driver !== "s3") {
      return { ok: false, reason: `UPLOAD_STORAGE_DRIVER is "${configuration.driver}", not "s3" — dry run only.` };
    }
    return { ok: true, configuration };
  } catch (error) {
    return { ok: false, reason: `S3 storage configuration incomplete/invalid: ${error.message}` };
  }
}

async function main() {
  const confirmUpload = process.argv.includes("--confirm-upload");

  const manifestText = await readFile(MANIFEST_PATH, "utf8");
  const manifestRows = parse(manifestText, { bom: true, columns: true, skip_empty_lines: true });

  const configResult = await resolveConfiguration();
  const liveUploadEnabled = configResult.ok && confirmUpload;

  console.log("=== X Dental Production Storage Uploader (Section 6) ===");
  console.log(`Manifest rows to process: ${manifestRows.length}`);
  console.log(`S3 configuration present: ${configResult.ok ? "yes" : "no"}${configResult.ok ? "" : ` (${configResult.reason})`}`);
  console.log(`--confirm-upload flag: ${confirmUpload ? "yes" : "no"}`);
  console.log(`Mode: ${liveUploadEnabled ? "LIVE UPLOAD" : "DRY RUN (no network calls, no credentials required)"}`);
  console.log("");

  let s3Client = null;
  let PutObjectCommand = null;
  let HeadObjectCommand = null;
  if (liveUploadEnabled) {
    ({ S3Client: s3Client, PutObjectCommand, HeadObjectCommand } = await import("@aws-sdk/client-s3").then((m) => ({
      S3Client: new m.S3Client({
        endpoint: configResult.configuration.endpoint,
        region: configResult.configuration.region,
        forcePathStyle: configResult.configuration.forcePathStyle,
        credentials: {
          accessKeyId: configResult.configuration.accessKeyId,
          secretAccessKey: configResult.configuration.secretAccessKey,
        },
      }),
      PutObjectCommand: m.PutObjectCommand,
      HeadObjectCommand: m.HeadObjectCommand,
    })));
  }

  const mappingRows = [];
  let dryRunCount = 0;
  let uploadedCount = 0;
  let failedCount = 0;

  for (const row of manifestRows) {
    const storageKey = storageKeyFor(row.toothpick_id);

    if (!liveUploadEnabled) {
      dryRunCount++;
      mappingRows.push({
        product_id: row.product_id,
        SKU: row.SKU,
        toothpick_id: row.toothpick_id,
        local_file_path: row.local_file_path,
        sha256: row.sha256,
        storage_key: storageKey,
        public_url: configResult.ok
          ? `${configResult.configuration.publicBaseUrl}/${storageKey}`
          : "(unknown — no public base URL configured)",
        upload_status: "DRY_RUN",
        note: "Not uploaded. Re-run with valid UPLOAD_S3_* credentials and --confirm-upload to perform the real upload.",
      });
      continue;
    }

    try {
      const buffer = await readFile(row.local_file_path);
      const actualSha256 = createHash("sha256").update(buffer).digest("hex");
      if (actualSha256 !== row.sha256) {
        throw new Error(`local file no longer matches manifest SHA-256 (expected ${row.sha256}, got ${actualSha256})`);
      }

      await s3Client.send(
        new PutObjectCommand({
          Bucket: configResult.configuration.bucket,
          Key: storageKey,
          Body: buffer,
          ContentLength: buffer.length,
          ContentType: "image/webp",
          CacheControl: "public, max-age=31536000, immutable",
        })
      );

      const head = await s3Client.send(
        new HeadObjectCommand({ Bucket: configResult.configuration.bucket, Key: storageKey })
      );
      if (Number(head.ContentLength) !== buffer.length) {
        throw new Error(`uploaded object size mismatch (local ${buffer.length} bytes, remote ${head.ContentLength} bytes)`);
      }

      uploadedCount++;
      mappingRows.push({
        product_id: row.product_id,
        SKU: row.SKU,
        toothpick_id: row.toothpick_id,
        local_file_path: row.local_file_path,
        sha256: row.sha256,
        storage_key: storageKey,
        public_url: `${configResult.configuration.publicBaseUrl}/${storageKey}`,
        upload_status: "VERIFIED",
        note: "",
      });
    } catch (error) {
      failedCount++;
      mappingRows.push({
        product_id: row.product_id,
        SKU: row.SKU,
        toothpick_id: row.toothpick_id,
        local_file_path: row.local_file_path,
        sha256: row.sha256,
        storage_key: storageKey,
        public_url: "",
        upload_status: "FAILED",
        note: error.message,
      });
    }
  }

  await writeFile(MAPPING_OUTPUT_PATH, stringify(mappingRows, { header: true, columns: MAPPING_COLUMNS }));

  console.log(`Dry-run rows: ${dryRunCount}`);
  console.log(`Uploaded + verified: ${uploadedCount}`);
  console.log(`Failed: ${failedCount}`);
  console.log(`\nMapping CSV: ${MAPPING_OUTPUT_PATH}`);
  if (!liveUploadEnabled) {
    console.log(
      "\nNo objects were uploaded. This was a dry run. To actually upload, supply valid UPLOAD_S3_* " +
        "env vars (Supabase Storage's S3-compatible endpoint/region/bucket/access key/secret/public base URL) " +
        "and re-run with --confirm-upload."
    );
  }
}

main().catch((error) => {
  console.error("Production storage uploader failed:", error.message);
  console.error(error.stack);
  process.exitCode = 1;
});
