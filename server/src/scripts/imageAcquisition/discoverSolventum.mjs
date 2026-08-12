#!/usr/bin/env node
/**
 * Solventum image discovery — full brand pass.
 *
 * Real finding from investigation (see the accompanying report): Solventum's
 * brand acquisition rules require a Catalog number / Product ID to resolve
 * an opaque family-page ID (e.g. "f/b00007531/", not derivable from
 * anything) via "official search" — but (1) the X Dental catalogue's
 * Solventum product names carry only descriptive attributes (shade, size,
 * tooth position codes like "UL4", "#14L A1"), never Solventum's own
 * catalog/Product-ID numbering, and (2) the official all-products page has
 * no search box, query-parameter search pattern, or structured listing —
 * confirmed live, not assumed. With no derivable page and no matchable
 * catalog number, there is no reliable automated signal here at all. Per
 * instruction, this does not get guessed at with a weaker heuristic —
 * every product below resolves to MANUAL_REVIEW with the specific reason.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { stringify } from "csv-stringify/sync";
import { PrismaClient } from "../../generated/prisma-client-runtime/client.js";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../../..");
const RESULT_COLUMNS = ["solventum_execution_status", "discovery_reason", "toothpick_id", "product_id", "SKU", "product_name"];

async function main() {
  const prisma = new PrismaClient();
  const products = await prisma.product.findMany({
    where: { brand: { equals: "Solventum", mode: "insensitive" } },
    select: { sku: true, name: true, externalProductId: true },
    orderBy: { name: "asc" },
  });
  await prisma.$disconnect();

  const reason =
    "No automated signal available: Solventum family-page IDs are opaque and require official search " +
    "(confirmed live: www.solventum.com/en-us/home/oral-care/all-products/ has no search box or query-parameter " +
    "search pattern), and this product's name carries only descriptive attributes (shade/size/tooth position), " +
    "never Solventum's own Catalog number or Product ID. Not guessed.";

  const results = products.map((product) => ({
    solventum_execution_status: "MANUAL_REVIEW",
    discovery_reason: reason,
    toothpick_id: String(product.externalProductId ?? "").replace(/^TP-EG-/i, ""),
    product_id: product.externalProductId ?? "",
    SKU: product.sku ?? "",
    product_name: product.name,
  }));

  const resultCsvPath = path.join(PROJECT_ROOT, "image-acquisition-output", "X_Dental_Solventum_Full_Execution_Result.csv");
  await writeFile(resultCsvPath, stringify(results, { header: true, columns: RESULT_COLUMNS }));

  console.log("=== X Dental Solventum Full Execution Result ===");
  console.log(`Total Solventum products: ${products.length}`);
  console.log(`Exact matches found: 0`);
  console.log(`Exact images downloaded: 0`);
  console.log(`Manual review: ${products.length}`);
  console.log(`No exact match: 0`);
  console.log(`Source blocked: 0`);
  console.log(`Download failures: 0`);
  console.log(`Actual WebP files created: 0`);
  console.log(`Coverage percentage: 0.0%`);
  console.log(`\nResult CSV: ${resultCsvPath}`);
}

main().catch((error) => {
  console.error(`Solventum discovery failed: ${error.message}`);
  process.exitCode = 1;
});
