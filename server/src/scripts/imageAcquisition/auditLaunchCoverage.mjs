#!/usr/bin/env node
/**
 * Section 5 — 12,942-product launch image coverage audit.
 *
 * Classifies every launch product (sourceSystem = TOOTHPICK_EG) as either:
 *   - REAL_IMAGE_READY_LOCAL: has a verified local WebP in the master manifest
 *     (X_Dental_Launch_Ready_Images_Master.csv), matched strictly by
 *     externalProductId / Toothpick ID — never by product name.
 *   - NO_REAL_IMAGE_USE_FALLBACK: no verified local image; the frontend's
 *     onError/null fallback (toothtools.webp) is expected to cover it.
 *
 * Read-only: does not modify the database. Writes an audit CSV covering
 * every launch product, and reports any manifest rows that don't resolve to
 * a real DB product (would indicate a stale/orphaned manifest entry).
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { PrismaClient } from "../../generated/prisma-client-runtime/client.js";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../../..");
const OUTPUT_ROOT = path.join(PROJECT_ROOT, "image-acquisition-output");
const MANIFEST_PATH = path.join(OUTPUT_ROOT, "X_Dental_Launch_Ready_Images_Master.csv");
const AUDIT_OUTPUT_PATH = path.join(OUTPUT_ROOT, "X_Dental_Launch_Coverage_Audit.csv");

const AUDIT_COLUMNS = [
  "product_id",
  "SKU",
  "brand",
  "product_name",
  "classification",
  "local_file_path",
];

async function main() {
  const manifestText = await readFile(MANIFEST_PATH, "utf8");
  const manifestRows = parse(manifestText, { bom: true, columns: true, skip_empty_lines: true });
  const manifestByProductId = new Map(manifestRows.map((row) => [row.product_id, row]));

  const prisma = new PrismaClient();
  const products = await prisma.product.findMany({
    where: { sourceSystem: "TOOTHPICK_EG" },
    select: { externalProductId: true, sku: true, brand: true, name: true, imageUrl: true },
    orderBy: { externalProductId: "asc" },
  });
  await prisma.$disconnect();

  const auditRows = [];
  const matchedProductIds = new Set();
  let readyCount = 0;
  let fallbackCount = 0;

  for (const product of products) {
    const manifestRow = product.externalProductId ? manifestByProductId.get(product.externalProductId) : undefined;
    if (manifestRow) {
      matchedProductIds.add(product.externalProductId);
      readyCount++;
      auditRows.push({
        product_id: product.externalProductId,
        SKU: product.sku ?? "",
        brand: product.brand ?? "",
        product_name: product.name,
        classification: "REAL_IMAGE_READY_LOCAL",
        local_file_path: manifestRow.local_file_path,
      });
    } else {
      fallbackCount++;
      auditRows.push({
        product_id: product.externalProductId ?? "",
        SKU: product.sku ?? "",
        brand: product.brand ?? "",
        product_name: product.name,
        classification: "NO_REAL_IMAGE_USE_FALLBACK",
        local_file_path: "",
      });
    }
  }

  // Any manifest row whose product_id didn't match a real TOOTHPICK_EG
  // product in the DB is orphaned — flag it, don't silently ignore it.
  const orphanedManifestRows = manifestRows.filter((row) => !matchedProductIds.has(row.product_id));

  await writeFile(AUDIT_OUTPUT_PATH, stringify(auditRows, { header: true, columns: AUDIT_COLUMNS }));

  console.log("=== X Dental Launch Coverage Audit (Section 5) ===");
  console.log(`Total TOOTHPICK_EG launch products in DB: ${products.length}`);
  console.log(`REAL_IMAGE_READY_LOCAL: ${readyCount}`);
  console.log(`NO_REAL_IMAGE_USE_FALLBACK: ${fallbackCount}`);
  console.log(`Sum: ${readyCount + fallbackCount} (expected 12942)`);
  console.log(`Manifest rows: ${manifestRows.length}`);
  console.log(`Manifest rows matched to a real DB product: ${matchedProductIds.size}`);
  console.log(`Orphaned manifest rows (no matching DB product): ${orphanedManifestRows.length}`);
  if (orphanedManifestRows.length > 0) {
    console.log("\nOrphaned manifest rows:");
    orphanedManifestRows.forEach((row) => console.log(`  - ${row.product_id} (${row.product_name})`));
  }
  const productsWithExistingImageUrl = products.filter((p) => p.imageUrl).length;
  console.log(`\nProducts with Product.imageUrl already set (should be 0 pre-upload): ${productsWithExistingImageUrl}`);
  console.log(`\nAudit CSV: ${AUDIT_OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error("Launch coverage audit failed:", error.message);
  console.error(error.stack);
  process.exitCode = 1;
});
