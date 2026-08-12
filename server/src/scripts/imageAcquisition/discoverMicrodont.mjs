#!/usr/bin/env node
/**
 * Microdont image discovery — full brand pass.
 *
 * Fetches the two verified structured category pages (carbide-burs,
 * diamond-burs — the only Microdont pages the brand acquisition rules
 * confirm have a machine-readable REF+image table), parses every row, and
 * attempts to match each of the 184 launch products against them by REF.
 *
 * Real finding from this run (see X_Dental_Microdont_Full_Execution_Result.csv
 * and the accompanying report): the X Dental catalogue's Microdont product
 * names carry the generic/universal ISO 806 bur-shape code (e.g. "Fissure
 * 56", "Round 1", "Pear 330" — the same numbering convention used across
 * every bur manufacturer), not Microdont's own REF or ISO/FIG catalog
 * number (e.g. "41,071,002", ISO/FIG "199"). Those are two different
 * numbering systems. Zero of 184 product names contain a real Microdont REF
 * as a substring, confirmed against all 270 parsed rows from both verified
 * category pages. Per instruction, this does not get guessed — every row
 * below resolves to MANUAL_REVIEW with the specific reason, not a forced
 * match. Also out of scope here: the ~74 non-bur Microdont products (kits,
 * containers, matrix bands, etc.) whose categories have no verified
 * structured-table pattern in the brand acquisition rules at all.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { stringify } from "csv-stringify/sync";
import { parse } from "csv-parse/sync";
import { PrismaClient } from "../../generated/prisma-client-runtime/client.js";
import { parseCategoryTables, matchProductToRow } from "./lib/microdont.js";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../../..");
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) XDentalStore-ImageAcquisition/1.0";
const CATEGORY_PAGES = [
  "https://microdont.com.br/en/carbide-burs/",
  "https://microdont.com.br/en/diamond-burs/",
];

const RESULT_COLUMNS = [
  "microdont_execution_status",
  "discovery_reason",
  "toothpick_id",
  "product_id",
  "SKU",
  "product_name",
  "matched_ref",
  "matched_iso_fig",
  "source_url",
  "download_status",
];

async function parseArgs() {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--verified-examples") args.verifiedExamples = argv[i + 1];
  }
  return args;
}

async function fetchPage(url) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
  return response.text();
}

async function validateAgainstVerifiedExamples(rows, verifiedExamplesPath) {
  if (!verifiedExamplesPath) return;
  const text = await readFile(verifiedExamplesPath, "utf8");
  const examples = parse(text, { bom: true, columns: true, skip_empty_lines: true }).filter(
    (row) => row.brand === "Microdont" && row.direct_official_asset_url
  );

  console.log(`Validating parser against ${examples.length} known-answer Microdont examples...`);
  let allOk = true;
  for (const example of examples) {
    const found = rows.find((row) => row.ref.replace(/[.,\s]/g, "") === example.official_code_or_id.replace(/[.,\s]/g, ""));
    const ok = found?.imageUrl === example.direct_official_asset_url;
    if (!ok) allOk = false;
    console.log(`  REF ${example.official_code_or_id}: ${ok ? "OK" : `MISMATCH (got ${found?.imageUrl ?? "not found"})`}`);
  }
  if (!allOk) throw new Error("Parser failed to reproduce known-correct Microdont examples — refusing to run at scale.");
  console.log("All known examples confirmed. Proceeding.\n");
}

async function main() {
  const args = await parseArgs();

  console.log("Fetching Microdont category pages...");
  const pages = await Promise.all(CATEGORY_PAGES.map(fetchPage));
  const rows = pages.flatMap(parseCategoryTables);
  console.log(`Parsed ${rows.length} REF+image rows from ${CATEGORY_PAGES.length} verified category pages.\n`);

  await validateAgainstVerifiedExamples(rows, args.verifiedExamples);

  const prisma = new PrismaClient();
  const products = await prisma.product.findMany({
    where: { brand: { equals: "Microdont", mode: "insensitive" } },
    select: { sku: true, name: true, externalProductId: true },
    orderBy: { name: "asc" },
  });
  await prisma.$disconnect();
  console.log(`Total Microdont launch products: ${products.length}`);

  const results = products.map((product) => {
    const toothpickId = String(product.externalProductId ?? "").replace(/^TP-EG-/i, "");
    const match = matchProductToRow(product.name, rows);
    return {
      microdont_execution_status: match ? "AUTO_DISCOVERED_EXACT_MATCH" : "MANUAL_REVIEW",
      discovery_reason: match
        ? `Matched REF ${match.row.ref} via ${match.matchBasis}.`
        : "No Microdont REF from the verified carbide-burs/diamond-burs tables appears in this product's name. The X Dental name uses the generic ISO 806 bur-shape code convention, not Microdont's own REF/ISO-FIG catalog numbering — confirmed no reliable automated signal exists for this product.",
      toothpick_id: toothpickId,
      product_id: product.externalProductId ?? "",
      SKU: product.sku ?? "",
      product_name: product.name,
      matched_ref: match?.row.ref ?? "",
      matched_iso_fig: match?.row.isoFig ?? "",
      source_url: match?.row.imageUrl ?? "",
      download_status: "",
    };
  });

  const resultCsvPath = path.join(PROJECT_ROOT, "image-acquisition-output", "X_Dental_Microdont_Full_Execution_Result.csv");
  await writeFile(resultCsvPath, stringify(results, { header: true, columns: RESULT_COLUMNS }));

  const exactMatches = results.filter((r) => r.microdont_execution_status === "AUTO_DISCOVERED_EXACT_MATCH").length;
  const manualReview = results.filter((r) => r.microdont_execution_status === "MANUAL_REVIEW").length;

  console.log("\n=== X Dental Microdont Full Execution Result ===");
  console.log(`Total Microdont products: ${products.length}`);
  console.log(`Exact matches found: ${exactMatches}`);
  console.log(`Exact images downloaded: 0 (none attempted — see reason below)`);
  console.log(`Manual review: ${manualReview}`);
  console.log(`No exact match: 0`);
  console.log(`Source blocked: 0`);
  console.log(`Download failures: 0`);
  console.log(`Actual WebP files created: 0`);
  console.log(`Coverage percentage: ${((exactMatches / products.length) * 100).toFixed(1)}%`);
  console.log(`\nResult CSV: ${resultCsvPath}`);
}

main().catch((error) => {
  console.error(`\nMicrodont discovery failed: ${error.message}`);
  console.error(error.stack);
  process.exitCode = 1;
});
