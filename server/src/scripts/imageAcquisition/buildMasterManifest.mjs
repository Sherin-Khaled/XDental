#!/usr/bin/env node
/**
 * Combines the successfully-downloaded rows from every per-brand execution
 * result CSV into one authoritative manifest of the real, validated local
 * WebP files — X_Dental_Launch_Ready_Images_Master.csv.
 *
 * For every candidate row this independently re-verifies (never trusts the
 * per-brand CSV's own claim):
 *   - the local file actually exists on disk
 *   - it actually decodes as a valid WebP (via sharp, not just a file-exists check)
 *   - its SHA-256 matches what the per-brand CSV recorded (catches silent
 *     corruption/tampering between runs)
 *   - the TOOTHPICK_ID embedded in its filename matches the row's own toothpick_id
 *   - no two rows claim the same product_id/SKU (one primary image per product)
 *   - no two rows point at the same local_file_path
 *
 * Any row that fails a check is excluded and reported, never silently kept.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../../..");
const OUTPUT_ROOT = path.join(PROJECT_ROOT, "image-acquisition-output");

const SOURCES = [
  {
    brand: "Komet",
    csvPath: path.join(OUTPUT_ROOT, "X_Dental_Komet_Full_Execution_Result.csv"),
    matchBasisField: "model_code",
  },
  {
    brand: "AR Instrumed",
    csvPath: path.join(OUTPUT_ROOT, "X_Dental_AR_Instrumed_Full_Execution_Result.csv"),
    matchBasisField: "matched_article_no",
  },
];

const MASTER_COLUMNS = [
  "toothpick_id",
  "product_id",
  "SKU",
  "brand",
  "product_name",
  "local_file_path",
  "output_filename",
  "sha256",
  "dimensions",
  "official_source_url",
  "match_basis",
];

const FILENAME_PATTERN = /^XD-TP-(\d+)__main\.webp$/i;

async function readCsvRows(filePath) {
  const text = await readFile(filePath, "utf8");
  return parse(text, { bom: true, columns: true, skip_empty_lines: true, relax_column_count: true });
}

async function verifyRow(row, brand, matchBasisField) {
  const problems = [];

  if (!existsSync(row.output_path)) {
    problems.push(`local file does not exist: ${row.output_path}`);
    return { ok: false, problems };
  }

  const buffer = await readFile(row.output_path);
  const actualSha256 = createHash("sha256").update(buffer).digest("hex");
  if (actualSha256 !== row.sha256) {
    problems.push(`SHA-256 mismatch: manifest says ${row.sha256}, file on disk hashes to ${actualSha256}`);
  }

  let metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch (error) {
    problems.push(`file does not decode as an image: ${error.message}`);
    return { ok: false, problems };
  }
  if (metadata.format !== "webp") {
    problems.push(`file is not WebP (decoded as ${metadata.format})`);
  }

  const filenameMatch = row.output_filename.match(FILENAME_PATTERN);
  if (!filenameMatch) {
    problems.push(`output_filename "${row.output_filename}" doesn't match the XD-TP-<id>__main.webp convention`);
  } else if (filenameMatch[1] !== String(row.toothpick_id)) {
    problems.push(`filename Toothpick ID (${filenameMatch[1]}) does not match row's toothpick_id (${row.toothpick_id}) — cross-product mismatch risk`);
  }

  if (problems.length > 0) return { ok: false, problems };

  return {
    ok: true,
    row: {
      toothpick_id: row.toothpick_id,
      product_id: row.product_id,
      SKU: row.SKU,
      brand,
      product_name: row.product_name,
      local_file_path: row.output_path,
      output_filename: row.output_filename,
      sha256: row.sha256,
      dimensions: row.output_dimensions,
      official_source_url: row.source_url,
      match_basis: row[matchBasisField] ?? "",
    },
  };
}

async function main() {
  const masterRows = [];
  const rejected = [];
  let candidateCount = 0;

  for (const source of SOURCES) {
    if (!existsSync(source.csvPath)) {
      console.log(`SKIP: ${source.brand} — no result CSV at ${source.csvPath}`);
      continue;
    }
    const rows = await readCsvRows(source.csvPath);
    const readyRows = rows.filter((row) => row.download_status === "IMAGE_READY_LOCAL");
    candidateCount += readyRows.length;
    console.log(`${source.brand}: ${readyRows.length} rows claim IMAGE_READY_LOCAL — verifying each...`);

    for (const row of readyRows) {
      const result = await verifyRow(row, source.brand, source.matchBasisField);
      if (result.ok) masterRows.push(result.row);
      else rejected.push({ brand: source.brand, product_id: row.product_id, problems: result.problems });
    }
  }

  // One primary image per product/SKU — check for accidental duplicates.
  const byProductId = new Map();
  const bySku = new Map();
  const byFilePath = new Map();
  const duplicates = [];
  for (const row of masterRows) {
    for (const [map, key, label] of [
      [byProductId, row.product_id, "product_id"],
      [bySku, row.SKU, "SKU"],
      [byFilePath, row.local_file_path, "local_file_path"],
    ]) {
      if (map.has(key)) duplicates.push(`duplicate ${label} "${key}": rows for ${map.get(key)} and ${row.product_name}`);
      else map.set(key, row.product_name);
    }
  }

  const finalRows = duplicates.length > 0 ? [] : masterRows;
  if (duplicates.length > 0) {
    console.log("\nDUPLICATES FOUND — refusing to write the manifest until resolved:");
    duplicates.forEach((d) => console.log("  -", d));
  }

  const manifestPath = path.join(OUTPUT_ROOT, "X_Dental_Launch_Ready_Images_Master.csv");
  await writeFile(manifestPath, stringify(finalRows, { header: true, columns: MASTER_COLUMNS }));

  console.log(`\n=== Master Manifest Build ===`);
  console.log(`Candidate rows (download_status = IMAGE_READY_LOCAL): ${candidateCount}`);
  console.log(`Passed verification: ${masterRows.length}`);
  console.log(`Rejected (failed verification): ${rejected.length}`);
  console.log(`Duplicate product_id/SKU/file conflicts: ${duplicates.length}`);
  console.log(`Final manifest rows: ${finalRows.length}`);
  if (rejected.length > 0) {
    console.log("\nRejected rows:");
    rejected.forEach((r) => console.log(`  - ${r.brand} ${r.product_id}: ${r.problems.join("; ")}`));
  }
  console.log(`\nManifest: ${manifestPath}`);
}

main().catch((error) => {
  console.error("Master manifest build failed:", error.message);
  console.error(error.stack);
  process.exitCode = 1;
});
