#!/usr/bin/env node
/**
 * X_Dental_Image_Brand_Summary.csv — per-brand rollup of image coverage
 * across all 12,942 TOOTHPICK_EG launch products: total products, how many
 * have a verified real local image, how many need the frontend fallback,
 * and the coverage percentage. Shows where the 12,732-product gap actually
 * concentrates, beyond the five brands already worked (Komet, AR Instrumed,
 * Microdont, Solventum, Coltene).
 *
 * Read-only: does not modify the database.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { PrismaClient } from "../../generated/prisma-client-runtime/client.js";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../../..");
const OUTPUT_ROOT = path.join(PROJECT_ROOT, "image-acquisition-output");
const MANIFEST_PATH = path.join(OUTPUT_ROOT, "X_Dental_Launch_Ready_Images_Master.csv");
const OUTPUT_PATH = path.join(OUTPUT_ROOT, "X_Dental_Image_Brand_Summary.csv");

const COLUMNS = [
  "brand",
  "total_launch_products",
  "real_image_ready_local",
  "no_real_image_use_fallback",
  "coverage_percent",
];

async function main() {
  const manifestText = await readFile(MANIFEST_PATH, "utf8");
  const manifestRows = parse(manifestText, { bom: true, columns: true, skip_empty_lines: true });
  const readyProductIds = new Set(manifestRows.map((row) => row.product_id));

  const prisma = new PrismaClient();
  const products = await prisma.product.findMany({
    where: { sourceSystem: "TOOTHPICK_EG" },
    select: { externalProductId: true, brand: true },
  });
  await prisma.$disconnect();

  const byBrand = new Map();
  for (const product of products) {
    const brand = product.brand?.trim() || "(no brand)";
    if (!byBrand.has(brand)) byBrand.set(brand, { total: 0, ready: 0 });
    const entry = byBrand.get(brand);
    entry.total++;
    if (product.externalProductId && readyProductIds.has(product.externalProductId)) entry.ready++;
  }

  const rows = [...byBrand.entries()]
    .map(([brand, { total, ready }]) => ({
      brand,
      total_launch_products: total,
      real_image_ready_local: ready,
      no_real_image_use_fallback: total - ready,
      coverage_percent: ((ready / total) * 100).toFixed(1),
    }))
    .sort((a, b) => b.total_launch_products - a.total_launch_products || a.brand.localeCompare(b.brand));

  await writeFile(OUTPUT_PATH, stringify(rows, { header: true, columns: COLUMNS }));

  const totalProducts = products.length;
  const totalReady = rows.reduce((sum, r) => sum + r.real_image_ready_local, 0);
  const brandsWithAnyCoverage = rows.filter((r) => r.real_image_ready_local > 0).length;

  console.log("=== X Dental Image Brand Summary ===");
  console.log(`Distinct brands among launch products: ${rows.length}`);
  console.log(`Total launch products: ${totalProducts} (expected 12942)`);
  console.log(`Total with a real image: ${totalReady} (expected 210)`);
  console.log(`Brands with at least one real image: ${brandsWithAnyCoverage}`);
  console.log(`\nOutput: ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error("Image brand summary build failed:", error.message);
  console.error(error.stack);
  process.exitCode = 1;
});
