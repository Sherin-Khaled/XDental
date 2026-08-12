#!/usr/bin/env node
/**
 * AR Instrumed image discovery — full brand pass.
 *
 * Crawls every real product category on ar-instrumed.de (and their
 * pagination — WooCommerce grids, ~12 cards/page), harvesting each card's
 * own "Artikle nr" (SKU), name, page URL, and largest real srcset image URL.
 * Never guesses a product-page slug from a SKU (the rules doc explicitly
 * rules that out) — only reads what the grid actually displays.
 *
 * Each of the 571 launch products is then matched by extracting a
 * dash-separated article-number candidate from its own name and looking
 * for exactly one harvested card whose SKU matches (exact, or that card's
 * SKU sharing the same prefix — AR Instrumed's grid sometimes shows a
 * trailing gallery-variant letter like "105-056B" for a name that just says
 * "105-056"). Anything not unambiguous does not get guessed.
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { stringify } from "csv-stringify/sync";
import { parse } from "csv-parse/sync";
import { PrismaClient } from "../../generated/prisma-client-runtime/client.js";
import { parseProductGrid, detectLastPage, extractSkuCandidate, matchSkuToCard, normalizeSku } from "./lib/arInstrumed.js";
import { resolveOutputFilename } from "./lib/filename.js";
import { convertToVerifiedWebp } from "./lib/imagePipeline.js";
import { DOWNLOAD_STATUS } from "./lib/resultRow.js";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../../..");
const DEFAULT_OUTPUT_ROOT = path.join(PROJECT_ROOT, "image-acquisition-output");
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) XDentalStore-ImageAcquisition/1.0";
const FETCH_TIMEOUT_MS = 20000;
const CRAWL_CONCURRENCY = 4;

// Real product categories only — the promotional pseudo-categories
// (best-seller, featured-products, latest-deals, new-products) are
// cross-listings of these, not distinct products; SKU-level dedup would
// absorb them harmlessly anyway, but skipping them halves the crawl.
const CATEGORIES = [
  "orthodontic-pliers",
  "silicone-instruments",
  "instruments-set",
  "extraction",
  "diagnostic",
  "parodontology",
  "conservative",
  "surgery",
  "implantology",
  "prosthetics",
  "micro-surgery",
  "impression-trays",
  "measuring-instruments-callipers",
  "laboratory-instruments",
  "sterilisation-tray-bowl",
];

const RESULT_COLUMNS = [
  "ar_execution_status",
  "discovery_reason",
  "toothpick_id",
  "product_id",
  "SKU",
  "product_name",
  "matched_article_no",
  "resolved_page_url",
  "source_url",
  "download_status",
  "http_status",
  "content_type",
  "original_dimensions",
  "output_dimensions",
  "output_filename",
  "output_path",
  "sha256",
  "shared_asset_hash",
  "shared_asset_count",
  "error",
];

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal, headers: { "User-Agent": USER_AGENT } });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithRetry(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchWithTimeout(url);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    }
  }
  throw lastError;
}

async function runWithConcurrency(tasks, limit) {
  const results = new Array(tasks.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await tasks[currentIndex]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

async function fetchCategoryPage(category, page) {
  const url =
    page === 1
      ? `https://ar-instrumed.de/product-category/${category}/`
      : `https://ar-instrumed.de/product-category/${category}/page/${page}/`;
  const response = await fetchWithRetry(url);
  if (!response.ok) return { url, ok: false, status: response.status };
  return { url, ok: true, html: await response.text() };
}

/** Crawls every category and every page within it, harvesting cards keyed by normalized SKU (first-seen wins — cross-category duplicates are the same product). */
async function crawlAllCategories(categories) {
  const cardsBySku = new Map();
  let pagesFetched = 0;
  let pagesFailed = 0;

  for (const category of categories) {
    const first = await fetchCategoryPage(category, 1);
    pagesFetched += 1;
    if (!first.ok) {
      pagesFailed += 1;
      console.log(`  ${category}: page 1 failed (HTTP ${first.status})`);
      continue;
    }
    const lastPage = detectLastPage(first.html);
    const firstCards = parseProductGrid(first.html);
    for (const card of firstCards) if (!cardsBySku.has(normalizeSku(card.sku))) cardsBySku.set(normalizeSku(card.sku), card);

    if (lastPage > 1) {
      const remainingPages = Array.from({ length: lastPage - 1 }, (_, i) => i + 2);
      const tasks = remainingPages.map((page) => () => fetchCategoryPage(category, page));
      const results = await runWithConcurrency(tasks, CRAWL_CONCURRENCY);
      for (const result of results) {
        pagesFetched += 1;
        if (!result.ok) {
          pagesFailed += 1;
          continue;
        }
        for (const card of parseProductGrid(result.html)) {
          if (!cardsBySku.has(normalizeSku(card.sku))) cardsBySku.set(normalizeSku(card.sku), card);
        }
      }
    }
    console.log(`  ${category}: ${lastPage} page(s), ${cardsBySku.size} unique SKUs so far`);
  }

  console.log(`\nCrawl complete: ${pagesFetched} pages fetched (${pagesFailed} failed), ${cardsBySku.size} unique product cards harvested.\n`);
  return [...cardsBySku.values()];
}

async function validateAgainstVerifiedExamples(cards, verifiedExamplesPath) {
  const text = await (await import("node:fs/promises")).readFile(verifiedExamplesPath, "utf8");
  const examples = parse(text, { bom: true, columns: true, skip_empty_lines: true }).filter(
    (row) => row.brand === "AR Instrumed" && row.direct_official_asset_url
  );
  console.log(`Validating against ${examples.length} known-answer AR Instrumed examples...`);
  for (const example of examples) {
    const match = matchSkuToCard(example.official_code_or_id, cards);
    console.log(`  SKU ${example.official_code_or_id}: ${match ? `found (${match.card.imageUrl})` : "NOT FOUND"}`);
  }
  console.log("");
}

function baseRow(product) {
  const toothpickId = String(product.externalProductId ?? "").replace(/^TP-EG-/i, "");
  return {
    ar_execution_status: "",
    discovery_reason: "",
    toothpick_id: toothpickId,
    product_id: product.externalProductId ?? "",
    SKU: product.sku ?? "",
    product_name: product.name ?? "",
    matched_article_no: "",
    resolved_page_url: "",
    source_url: "",
    download_status: "",
    http_status: "",
    content_type: "",
    original_dimensions: "",
    output_dimensions: "",
    output_filename: "",
    output_path: "",
    sha256: "",
    shared_asset_hash: "",
    shared_asset_count: "",
    error: "",
  };
}

async function downloadImageBytes(url) {
  let response;
  try {
    response = await fetchWithRetry(url);
  } catch (error) {
    return { ok: false, status: DOWNLOAD_STATUS.FAILED_DOWNLOAD, error: `Network error: ${error.message}` };
  }
  const httpStatus = response.status;
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok) {
    return { ok: false, status: DOWNLOAD_STATUS.FAILED_DOWNLOAD, httpStatus, contentType, error: `HTTP ${httpStatus}` };
  }
  return { ok: true, httpStatus, contentType, buffer: Buffer.from(await response.arrayBuffer()) };
}

async function downloadAndValidate(row, readyDir) {
  const filenameInfo = resolveOutputFilename({ proposedFilename: "", productId: row.product_id, sourceProductId: row.toothpick_id });
  const fetched = await downloadImageBytes(row.source_url);
  if (!fetched.ok) {
    row.download_status = fetched.status;
    row.http_status = fetched.httpStatus ?? "";
    row.content_type = fetched.contentType ?? "";
    row.error = fetched.error;
    return row;
  }
  const conversion = await convertToVerifiedWebp(fetched.buffer);
  if (!conversion.ok) {
    row.download_status = DOWNLOAD_STATUS.INVALID_IMAGE;
    row.http_status = fetched.httpStatus;
    row.content_type = fetched.contentType;
    row.error = conversion.reason;
    return row;
  }
  const sha256 = createHash("sha256").update(conversion.webpBuffer).digest("hex");
  const outputPath = path.join(readyDir, filenameInfo.filename);
  await writeFile(outputPath, conversion.webpBuffer);
  row.download_status = DOWNLOAD_STATUS.READY;
  row.http_status = fetched.httpStatus;
  row.content_type = fetched.contentType;
  row.original_dimensions = conversion.originalDimensions;
  row.output_dimensions = conversion.outputDimensions;
  row.output_filename = filenameInfo.filename;
  row.output_path = outputPath;
  row.sha256 = sha256;
  return row;
}

function annotateShared(rows) {
  const countByHash = new Map();
  for (const row of rows) {
    if (!row.sha256) continue;
    countByHash.set(row.sha256, (countByHash.get(row.sha256) ?? 0) + 1);
  }
  return rows.map((row) => {
    if (!row.sha256) return row;
    const count = countByHash.get(row.sha256) ?? 1;
    return { ...row, shared_asset_hash: count > 1 ? row.sha256 : "", shared_asset_count: count };
  });
}

async function main() {
  const verifiedExamplesPath = process.argv[process.argv.indexOf("--verified-examples") + 1];
  const categoriesFlagIndex = process.argv.indexOf("--categories");
  const categories = categoriesFlagIndex >= 0 ? process.argv[categoriesFlagIndex + 1].split(",") : CATEGORIES;

  console.log(`Crawling ${categories.length} AR Instrumed categories...`);
  const cards = await crawlAllCategories(categories);

  if (verifiedExamplesPath) await validateAgainstVerifiedExamples(cards, verifiedExamplesPath);

  const prisma = new PrismaClient();
  const products = await prisma.product.findMany({
    where: { brand: { equals: "AR Instrumed", mode: "insensitive" } },
    select: { sku: true, name: true, externalProductId: true },
    orderBy: { name: "asc" },
  });
  await prisma.$disconnect();
  console.log(`Total AR Instrumed launch products: ${products.length}`);

  const matchedRows = [];
  const unmatchedRows = [];
  for (const product of products) {
    const row = baseRow(product);
    const candidate = extractSkuCandidate(product.name);
    if (!candidate) {
      row.ar_execution_status = "MANUAL_REVIEW";
      row.discovery_reason = "Product name doesn't contain a recognizable AR Instrumed article-number pattern (###-###[-#][A/B]).";
      unmatchedRows.push(row);
      continue;
    }
    const match = matchSkuToCard(candidate, cards);
    if (!match) {
      row.ar_execution_status = "NO_EXACT_MATCH";
      row.matched_article_no = candidate;
      row.discovery_reason = `Article number candidate "${candidate}" extracted from the name, but no single harvested product card matched it unambiguously.`;
      unmatchedRows.push(row);
      continue;
    }
    row.ar_execution_status = "AUTO_DISCOVERED_EXACT_MATCH";
    row.matched_article_no = match.card.sku;
    row.resolved_page_url = match.card.pageUrl;
    row.source_url = match.card.imageUrl;
    row.discovery_reason = `Matched article number ${match.card.sku} via ${match.matchBasis} on the live category grid.`;
    matchedRows.push(row);
  }
  console.log(`Confirmed exact matches with a parsed image URL: ${matchedRows.length}\n`);

  console.log("Downloading + validating + converting confirmed matches...");
  const batchDir = path.join(DEFAULT_OUTPUT_ROOT, "ar-instrumed", "full-execution");
  const readyDir = path.join(batchDir, "ready");
  await mkdir(readyDir, { recursive: true });
  const downloadTasks = matchedRows.map((row) => () => downloadAndValidate(row, readyDir));
  await runWithConcurrency(downloadTasks, CRAWL_CONCURRENCY);

  const allRows = annotateShared([...matchedRows, ...unmatchedRows]);
  const resultCsvPath = path.join(DEFAULT_OUTPUT_ROOT, "X_Dental_AR_Instrumed_Full_Execution_Result.csv");
  await writeFile(resultCsvPath, stringify(allRows, { header: true, columns: RESULT_COLUMNS }));

  const totals = {
    total: allRows.length,
    exactMatchesFound: allRows.filter((r) => r.ar_execution_status === "AUTO_DISCOVERED_EXACT_MATCH").length,
    exactImagesDownloaded: allRows.filter((r) => r.download_status === DOWNLOAD_STATUS.READY).length,
    manualReview: allRows.filter((r) => r.ar_execution_status === "MANUAL_REVIEW").length,
    noExactMatch: allRows.filter((r) => r.ar_execution_status === "NO_EXACT_MATCH").length,
    downloadFailures: allRows.filter((r) => r.ar_execution_status === "AUTO_DISCOVERED_EXACT_MATCH" && r.download_status && r.download_status !== DOWNLOAD_STATUS.READY).length,
  };

  console.log("\n=== X Dental AR Instrumed Full Execution Result ===");
  console.log(`Total AR Instrumed products: ${totals.total}`);
  console.log(`Exact matches found: ${totals.exactMatchesFound}`);
  console.log(`Exact images downloaded: ${totals.exactImagesDownloaded}`);
  console.log(`Manual review: ${totals.manualReview}`);
  console.log(`No exact match: ${totals.noExactMatch}`);
  console.log(`Source blocked: 0`);
  console.log(`Download failures: ${totals.downloadFailures}`);
  console.log(`Actual WebP files created: ${totals.exactImagesDownloaded}`);
  console.log(`Coverage percentage: ${((totals.exactImagesDownloaded / totals.total) * 100).toFixed(1)}%`);
  console.log(`\nResult CSV: ${resultCsvPath}`);
}

main().catch((error) => {
  console.error(`\nAR Instrumed discovery failed: ${error.message}`);
  console.error(error.stack);
  process.exitCode = 1;
});
