#!/usr/bin/env node
/**
 * X_Dental_External_Image_Input_12942.csv — the handoff/input file for any
 * future external image-sourcing effort (a vendor, a client-supplied batch,
 * or a later automated pass). Covers all 12,942 TOOTHPICK_EG launch
 * products with enough identifying detail to source or match a real
 * manufacturer image, plus the current coverage status so nobody re-does
 * work on the 210 already covered.
 *
 * Read-only: does not modify the database.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { PrismaClient } from "../../generated/prisma-client-runtime/client.js";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../../..");
const OUTPUT_ROOT = path.join(PROJECT_ROOT, "image-acquisition-output");
const MANIFEST_PATH = path.join(OUTPUT_ROOT, "X_Dental_Launch_Ready_Images_Master.csv");
const OUTPUT_PATH = path.join(OUTPUT_ROOT, "X_Dental_External_Image_Input_12942.csv");

const COLUMNS = [
  "toothpick_id",
  "product_id",
  "SKU",
  "brand",
  "category",
  "product_name",
  "current_status",
  "existing_official_source_url",
];

async function main() {
  const manifestText = await readFile(MANIFEST_PATH, "utf8");
  const manifestRows = parse(manifestText, { bom: true, columns: true, skip_empty_lines: true });
  const manifestByProductId = new Map(manifestRows.map((row) => [row.product_id, row]));

  const prisma = new PrismaClient();
  const products = await prisma.product.findMany({
    where: { sourceSystem: "TOOTHPICK_EG" },
    select: { externalProductId: true, sku: true, brand: true, category: true, name: true },
    orderBy: [{ brand: "asc" }, { name: "asc" }],
  });
  await prisma.$disconnect();

  const rows = products.map((product) => {
    const manifestRow = product.externalProductId ? manifestByProductId.get(product.externalProductId) : undefined;
    return {
      toothpick_id: product.externalProductId ? product.externalProductId.replace(/^TP-EG-/i, "") : "",
      product_id: product.externalProductId ?? "",
      SKU: product.sku ?? "",
      brand: product.brand ?? "",
      category: product.category ?? "",
      product_name: product.name,
      current_status: manifestRow ? "REAL_IMAGE_READY_LOCAL" : "NO_REAL_IMAGE_USE_FALLBACK",
      existing_official_source_url: manifestRow?.official_source_url ?? "",
    };
  });

  await writeFile(OUTPUT_PATH, stringify(rows, { header: true, columns: COLUMNS }));

  const readyCount = rows.filter((r) => r.current_status === "REAL_IMAGE_READY_LOCAL").length;
  console.log("=== X Dental External Image Input (12,942) ===");
  console.log(`Total rows: ${rows.length} (expected 12942)`);
  console.log(`Already REAL_IMAGE_READY_LOCAL (exclude from new sourcing work): ${readyCount}`);
  console.log(`NO_REAL_IMAGE_USE_FALLBACK (candidates for sourcing): ${rows.length - readyCount}`);
  console.log(`\nOutput: ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error("External image input build failed:", error.message);
  console.error(error.stack);
  process.exitCode = 1;
});
