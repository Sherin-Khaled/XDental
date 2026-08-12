#!/usr/bin/env node
/**
 * Automated Komet image discovery + acquisition, full brand pass.
 *
 * For every launch Komet product not already covered by the manual-research
 * manifests (Ready-for-download / Manual-review batches), this:
 *   1. Extracts a high-confidence dotted REF from the product name.
 *   2. Derives the Komet Store family-page slug from that REF (an inferred
 *      URL, per the brand acquisition rules — allowed to guess the PAGE,
 *      never the IMAGE).
 *   3. Fetches that page for real and requires the page's own text to
 *      display the exact REF before trusting the guess.
 *   4. Parses the actual image URL(s) present in that page's HTML and picks
 *      the one demonstrably tied to this REF — never templates one.
 *   5. Downloads, validates, and WebP-converts a confirmed image through the
 *      same pipeline as the manual-research batch.
 *
 * Anything that doesn't clear every one of those gates is reported as
 * NO_EXACT_MATCH / NEEDS_MANUAL_REVIEW / SOURCE_BLOCKED — never guessed.
 *
 * Requires DATABASE_URL (reads product name/sku/externalProductId only;
 * never writes to the database).
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { PrismaClient } from "../../generated/prisma-client-runtime/client.js";
import { extractRef, deriveFamilySlug, pageConfirmsRef, extractImageCandidates, selectConfirmedImageUrl } from "./lib/komet.js";
import { resolveOutputFilename } from "./lib/filename.js";
import { convertToVerifiedWebp } from "./lib/imagePipeline.js";
import { DOWNLOAD_STATUS } from "./lib/resultRow.js";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../../..");
const DEFAULT_OUTPUT_ROOT = path.join(PROJECT_ROOT, "image-acquisition-output");
const PAGE_FETCH_CONCURRENCY = 3;
const FETCH_TIMEOUT_MS = 20000;
const USER_AGENT = "XDentalStore-ImageAcquisition/1.0 (+local tooling, manual research manifest)";

const EXECUTION_STATUS = {
  ORIGINAL_READY_BATCH: "ORIGINAL_READY_BATCH",
  MANUAL_REVIEW: "MANUAL_REVIEW",
  AUTO_DISCOVERED_EXACT_MATCH: "AUTO_DISCOVERED_EXACT_MATCH",
  NO_EXACT_MATCH: "NO_EXACT_MATCH",
  SOURCE_BLOCKED: "SOURCE_BLOCKED",
  NEEDS_MANUAL_REVIEW: "NEEDS_MANUAL_REVIEW",
};

const RESULT_COLUMNS = [
  "komet_execution_status",
  "discovery_reason",
  "toothpick_id",
  "product_id",
  "SKU",
  "product_name",
  "model_code",
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

function parseArgs(argv) {
  const args = { outputRoot: DEFAULT_OUTPUT_ROOT };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!flag.startsWith("--")) continue;
    const key = flag.slice(2);
    const value = argv[i + 1];
    i += 1;
    if (key === "ready-manifest") args.readyManifest = value;
    else if (key === "manual-review-manifest") args.manualReviewManifest = value;
    else if (key === "ready-result-csv") args.readyResultCsv = value;
    else if (key === "output-root") args.outputRoot = path.resolve(value);
    else if (key === "limit") args.limit = Math.max(1, Number.parseInt(value, 10) || undefined);
  }
  return args;
}

async function readCsvRows(filePath) {
  const text = await readFile(filePath, "utf8");
  return parse(text, { bom: true, columns: true, skip_empty_lines: true, relax_column_count: true });
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal, redirect: "follow", headers: { "User-Agent": USER_AGENT } });
  } finally {
    clearTimeout(timeout);
  }
}

// Node's fetch (undici) on this environment occasionally throws a transient
// "fetch failed" when several requests to the exact same host/URL race each
// other — observed concretely when several REFs shared one family page and
// were fetched concurrently. One short-delayed retry clears it reliably;
// this is not masking real 404s/4xx/5xx, which resolve as normal responses,
// not thrown errors.
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

/** Fetches each distinct family page exactly once per run, no matter how many REFs share it. */
function createPageCache() {
  const cache = new Map();
  return async function fetchPageCached(url) {
    if (cache.has(url)) return cache.get(url);
    const promise = fetchWithRetry(url).then(async (response) => ({
      status: response.status,
      ok: response.ok,
      text: response.ok ? await response.text() : "",
    }));
    cache.set(url, promise);
    return promise;
  };
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

function baseRow(product, ref) {
  const toothpickId = String(product.externalProductId ?? "").replace(/^TP-EG-/i, "");
  return {
    komet_execution_status: "",
    discovery_reason: "",
    toothpick_id: toothpickId,
    product_id: product.externalProductId ?? "",
    SKU: product.sku ?? "",
    product_name: product.name ?? "",
    model_code: ref ?? "",
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

/** Discovery only — resolves a confirmed (page, image URL) or a definitive non-match reason. No download yet. */
async function discoverOne(product, fetchPageCached) {
  const ref = extractRef(product.name);
  const row = baseRow(product, ref);

  if (!ref) {
    row.komet_execution_status = EXECUTION_STATUS.NEEDS_MANUAL_REVIEW;
    row.discovery_reason = "Product name does not match the high-confidence dotted-REF pattern; not attempted automatically.";
    return row;
  }

  const slug = deriveFamilySlug(ref);
  const pageUrl = `https://www.kometstore.de/de-de/p/${encodeURIComponent(slug)}`;
  row.resolved_page_url = pageUrl;

  let page;
  try {
    page = await fetchPageCached(pageUrl);
  } catch (error) {
    row.komet_execution_status = EXECUTION_STATUS.SOURCE_BLOCKED;
    row.discovery_reason = `Network error fetching ${pageUrl}: ${error.message}`;
    return row;
  }

  if (page.status === 404) {
    row.komet_execution_status = EXECUTION_STATUS.NO_EXACT_MATCH;
    row.discovery_reason = `No Komet Store family page at slug "${slug}" (derived from REF ${ref}).`;
    return row;
  }
  if (!page.ok) {
    row.komet_execution_status = EXECUTION_STATUS.SOURCE_BLOCKED;
    row.discovery_reason = `Unexpected HTTP ${page.status} fetching ${pageUrl}.`;
    return row;
  }

  const html = page.text;
  if (!pageConfirmsRef(html, ref)) {
    row.komet_execution_status = EXECUTION_STATUS.NO_EXACT_MATCH;
    row.discovery_reason = `Family page at slug "${slug}" loaded but does not display REF ${ref} — guess rejected.`;
    return row;
  }

  const candidates = extractImageCandidates(html);
  const imageUrl = selectConfirmedImageUrl(candidates, ref);
  if (!imageUrl) {
    row.komet_execution_status = EXECUTION_STATUS.NEEDS_MANUAL_REVIEW;
    row.discovery_reason =
      candidates.length === 0
        ? `REF ${ref} confirmed on the page, but no product image URL was found on it.`
        : `REF ${ref} confirmed on the page, but ${candidates.length} candidate images were found and none could be confidently tied to this REF.`;
    return row;
  }

  row.komet_execution_status = EXECUTION_STATUS.AUTO_DISCOVERED_EXACT_MATCH;
  row.discovery_reason = `REF ${ref} confirmed on ${pageUrl}; image URL parsed directly from that page.`;
  row.source_url = imageUrl;
  return row;
}

async function downloadAndValidate(row, { readyDir, failedDir, downloadCache }) {
  const filenameInfo = resolveOutputFilename({
    proposedFilename: "",
    productId: row.product_id,
    sourceProductId: row.toothpick_id,
  });

  let fetched = downloadCache.get(row.source_url);
  if (!fetched) {
    fetched = await downloadImageBytes(row.source_url);
    downloadCache.set(row.source_url, fetched);
  }

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
  const buffer = Buffer.from(await response.arrayBuffer());
  return { ok: true, httpStatus, contentType, buffer };
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
  const args = parseArgs(process.argv.slice(2));
  if (!args.readyManifest || !args.manualReviewManifest) {
    throw new Error("Requires --ready-manifest and --manual-review-manifest paths.");
  }

  const prisma = new PrismaClient();
  const komet = await prisma.product.findMany({
    where: { brand: { equals: "Komet", mode: "insensitive" } },
    select: { sku: true, name: true, externalProductId: true },
    orderBy: { name: "asc" },
  });
  await prisma.$disconnect();
  console.log(`Total Komet launch products (database): ${komet.length}`);

  const readyRows = await readCsvRows(args.readyManifest);
  const manualRows = await readCsvRows(args.manualReviewManifest);
  const covered = new Set([...readyRows, ...manualRows].map((r) => r.source_product_id));

  let remaining = komet.filter(
    (p) => !covered.has(String(p.externalProductId ?? "").replace(/^TP-EG-/i, ""))
  );
  console.log(`Already in manual research (ready + manual review): ${covered.size}`);
  console.log(`Remaining for automated discovery: ${remaining.length}`);
  if (args.limit) {
    remaining = remaining.slice(0, args.limit);
    console.log(`--limit set: attempting only ${remaining.length} of them this run.`);
  }
  console.log("");

  console.log("Discovery pass (fetching real Komet Store pages, no guessed image URLs)...");
  const fetchPageCached = createPageCache();
  const discoveryTasks = remaining.map((product) => () => discoverOne(product, fetchPageCached));
  const discovered = await runWithConcurrency(discoveryTasks, PAGE_FETCH_CONCURRENCY);

  const exactMatches = discovered.filter((row) => row.komet_execution_status === EXECUTION_STATUS.AUTO_DISCOVERED_EXACT_MATCH);
  console.log(`Discovery complete. Confirmed exact matches with a parsed image URL: ${exactMatches.length}\n`);

  console.log("Downloading + validating + converting confirmed matches...");
  const batchDir = path.join(args.outputRoot, "komet", "full-execution");
  const readyDir = path.join(batchDir, "ready");
  const failedDir = path.join(batchDir, "failed");
  await mkdir(readyDir, { recursive: true });
  await mkdir(failedDir, { recursive: true });

  const downloadCache = new Map();
  const downloadTasks = exactMatches.map((row) => () => downloadAndValidate(row, { readyDir, failedDir, downloadCache }));
  await runWithConcurrency(downloadTasks, PAGE_FETCH_CONCURRENCY);

  // Fold in the already-known 100: the 31 originally-ready rows (already
  // downloaded for real in the prior run) plus the 69 manual-review rows
  // (never auto-fetched, carried forward as-is).
  const readyResultRows = args.readyResultCsv ? await readCsvRows(args.readyResultCsv) : [];
  const readyResultByProductId = new Map(readyResultRows.map((r) => [r.product_id, r]));

  const originalReadyRows = readyRows.map((manifestRow) => {
    const downloaded = readyResultByProductId.get(manifestRow.product_id);
    return {
      komet_execution_status: EXECUTION_STATUS.ORIGINAL_READY_BATCH,
      discovery_reason: "Part of the original 31-record manually-researched ready batch.",
      toothpick_id: manifestRow.source_product_id,
      product_id: manifestRow.product_id,
      SKU: manifestRow.SKU,
      product_name: manifestRow.product_name,
      model_code: manifestRow.official_product_model_code,
      resolved_page_url: manifestRow.official_product_page_url,
      source_url: manifestRow.direct_original_image_asset_url,
      download_status: downloaded?.download_status ?? "",
      http_status: downloaded?.http_status ?? "",
      content_type: downloaded?.content_type ?? "",
      original_dimensions: downloaded?.original_dimensions ?? "",
      output_dimensions: downloaded?.output_dimensions ?? "",
      output_filename: downloaded?.output_filename ?? "",
      output_path: downloaded?.output_path ?? "",
      sha256: downloaded?.sha256 ?? "",
      shared_asset_hash: "",
      shared_asset_count: "",
      error: downloaded?.error ?? "",
    };
  });

  const manualReviewRows = manualRows.map((manifestRow) => ({
    komet_execution_status: EXECUTION_STATUS.MANUAL_REVIEW,
    discovery_reason: "Part of the original 69-record manually-researched manual-review batch; not auto-fetched.",
    toothpick_id: manifestRow.source_product_id,
    product_id: manifestRow.product_id,
    SKU: manifestRow.SKU,
    product_name: manifestRow.product_name,
    model_code: manifestRow.official_product_model_code,
    resolved_page_url: manifestRow.official_product_page_url ?? "",
    source_url: manifestRow.direct_original_image_asset_url ?? "",
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
    error: manifestRow.notes ?? "",
  }));

  const allRows = annotateShared([...originalReadyRows, ...manualReviewRows, ...discovered]);

  const resultCsvPath = path.join(PROJECT_ROOT, "image-acquisition-output", "X_Dental_Komet_Full_Execution_Result.csv");
  await writeFile(resultCsvPath, stringify(allRows, { header: true, columns: RESULT_COLUMNS }));

  const totals = {
    total: allRows.length,
    exactMatchesFound: allRows.filter(
      (r) => r.komet_execution_status === EXECUTION_STATUS.ORIGINAL_READY_BATCH || r.komet_execution_status === EXECUTION_STATUS.AUTO_DISCOVERED_EXACT_MATCH
    ).length,
    exactImagesDownloaded: allRows.filter((r) => r.download_status === DOWNLOAD_STATUS.READY).length,
    manualReview: allRows.filter(
      (r) => r.komet_execution_status === EXECUTION_STATUS.MANUAL_REVIEW || r.komet_execution_status === EXECUTION_STATUS.NEEDS_MANUAL_REVIEW
    ).length,
    noExactMatch: allRows.filter((r) => r.komet_execution_status === EXECUTION_STATUS.NO_EXACT_MATCH).length,
    sourceBlocked: allRows.filter((r) => r.komet_execution_status === EXECUTION_STATUS.SOURCE_BLOCKED).length,
    downloadFailures: allRows.filter(
      (r) =>
        r.komet_execution_status === EXECUTION_STATUS.AUTO_DISCOVERED_EXACT_MATCH &&
        r.download_status &&
        r.download_status !== DOWNLOAD_STATUS.READY
    ).length,
  };

  console.log("\n=== X Dental Komet Full Execution Result ===");
  console.log(`Total Komet launch products: ${totals.total}`);
  console.log(`Exact matches found: ${totals.exactMatchesFound}`);
  console.log(`Exact images downloaded: ${totals.exactImagesDownloaded}`);
  console.log(`Manual review: ${totals.manualReview}`);
  console.log(`No exact match: ${totals.noExactMatch}`);
  console.log(`Source blocked: ${totals.sourceBlocked}`);
  console.log(`Download failures: ${totals.downloadFailures}`);
  console.log(`Actual WebP files created: ${totals.exactImagesDownloaded}`);
  console.log(`Success percentage: ${((totals.exactImagesDownloaded / totals.total) * 100).toFixed(1)}%`);
  console.log(`\nResult CSV: ${resultCsvPath}`);
}

main().catch((error) => {
  console.error(`\nKomet discovery failed: ${error.message}`);
  console.error(error.stack);
  process.exitCode = 1;
});
