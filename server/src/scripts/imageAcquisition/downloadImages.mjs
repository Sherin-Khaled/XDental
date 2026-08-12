#!/usr/bin/env node
/**
 * Local bulk product-image acquisition tool.
 *
 * Reads a CSV manifest of official, research-validated image URLs, downloads
 * each one, validates and converts it to WebP without resizing, and writes
 * the result to a local (git-ignored) staging folder — never into the
 * frontend, never into Git, never touching the product database.
 *
 * Usage:
 *   node src/scripts/imageAcquisition/downloadImages.mjs \
 *     --manifest /path/to/komet-batch01-ready.csv \
 *     --source komet \
 *     --batch batch01
 *
 * See README.md in this directory for the full manifest/result CSV schema.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { stringify } from "csv-stringify/sync";
import { parseManifestCsv } from "./lib/manifest.js";
import { resolveOutputFilename } from "./lib/filename.js";
import { convertToVerifiedWebp, isDefinitelyNotImageContentType } from "./lib/imagePipeline.js";
import { DOWNLOAD_STATUS, RESULT_COLUMNS, annotateSharedAssets, buildResultRow } from "./lib/resultRow.js";

// import.meta.dirname is server/src/scripts/imageAcquisition — four levels
// up (scripts, src, server) lands on the project root (x-dental-store).
const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../../..");
const DEFAULT_OUTPUT_ROOT = path.join(PROJECT_ROOT, "image-acquisition-output");
const DEFAULT_CONCURRENCY = 4;
const FETCH_TIMEOUT_MS = 20000;
const USER_AGENT = "XDentalStore-ImageAcquisition/1.0 (+local tooling, manual research manifest)";

function parseArgs(argv) {
  const args = { concurrency: DEFAULT_CONCURRENCY, outputRoot: DEFAULT_OUTPUT_ROOT };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!flag.startsWith("--")) continue;
    const key = flag.slice(2);
    const value = argv[i + 1];
    i += 1;
    if (key === "manifest") args.manifest = value;
    else if (key === "source") args.source = value;
    else if (key === "batch") args.batch = value;
    else if (key === "output-root") args.outputRoot = path.resolve(value);
    else if (key === "concurrency") args.concurrency = Math.max(1, Number.parseInt(value, 10) || DEFAULT_CONCURRENCY);
  }
  return args;
}

function requireArg(args, key, flagName) {
  if (!args[key]) {
    throw new Error(`Missing required --${flagName} argument.`);
  }
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT },
    });
  } finally {
    clearTimeout(timeout);
  }
}

/** Runs `tasks` (thunks) with at most `limit` in flight at once. */
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

const SKIPPABLE_STATUSES = new Set(["MANUAL_REVIEW", "NO_EXACT_IMAGE"]);

async function processRow(row, { readyDir, failedDir, downloadCache }) {
  const status = (row.processingStatus || "").trim().toUpperCase();
  if (status && SKIPPABLE_STATUSES.has(status)) {
    return buildResultRow(row, {
      downloadStatus: DOWNLOAD_STATUS.FAILED_DOWNLOAD,
      error: `Row is marked ${status} in the manifest, not ready for automatic download — skipped.`,
    });
  }

  let sourceUrl;
  try {
    sourceUrl = new URL(row.imageUrl);
    if (!["http:", "https:"].includes(sourceUrl.protocol)) throw new Error("not http(s)");
  } catch {
    return buildResultRow(row, {
      downloadStatus: DOWNLOAD_STATUS.FAILED_DOWNLOAD,
      error: `Manifest row has no valid absolute image URL: "${row.imageUrl}"`,
    });
  }

  let filenameInfo;
  try {
    filenameInfo = resolveOutputFilename(row);
  } catch (error) {
    return buildResultRow(row, {
      downloadStatus: DOWNLOAD_STATUS.FAILED_DOWNLOAD,
      error: error.message,
    });
  }

  // Reuse bytes already fetched this run for an identical source URL —
  // pure local optimization, every row still gets its own output file.
  let fetched = downloadCache.get(sourceUrl.href);
  if (!fetched) {
    fetched = await downloadOnce(sourceUrl.href);
    downloadCache.set(sourceUrl.href, fetched);
  }

  if (!fetched.ok) {
    await writeDebugArtifact(failedDir, filenameInfo.filename, fetched.buffer, fetched.contentType);
    return buildResultRow(row, {
      downloadStatus: fetched.status,
      httpStatus: fetched.httpStatus,
      contentType: fetched.contentType,
      error: fetched.error,
    });
  }

  const conversion = await convertToVerifiedWebp(fetched.buffer);
  if (!conversion.ok) {
    await writeDebugArtifact(failedDir, filenameInfo.filename, fetched.buffer, fetched.contentType);
    return buildResultRow(row, {
      downloadStatus: DOWNLOAD_STATUS.INVALID_IMAGE,
      httpStatus: fetched.httpStatus,
      contentType: fetched.contentType,
      error: conversion.reason,
    });
  }

  const sha256 = createHash("sha256").update(conversion.webpBuffer).digest("hex");
  const outputPath = path.join(readyDir, filenameInfo.filename);
  await writeFile(outputPath, conversion.webpBuffer);

  return buildResultRow(row, {
    downloadStatus: DOWNLOAD_STATUS.READY,
    httpStatus: fetched.httpStatus,
    contentType: fetched.contentType,
    originalDimensions: conversion.originalDimensions,
    outputDimensions: conversion.outputDimensions,
    outputFilename: filenameInfo.filename,
    outputPath,
    sha256,
  });
}

async function downloadOnce(url) {
  let response;
  try {
    response = await fetchWithTimeout(url);
  } catch (error) {
    return { ok: false, status: DOWNLOAD_STATUS.FAILED_DOWNLOAD, error: `Network error: ${error.message}` };
  }

  const httpStatus = response.status;
  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    // Drain the body so failure debugging can still inspect it if useful.
    const buffer = Buffer.from(await response.arrayBuffer().catch(() => new ArrayBuffer(0)));
    return {
      ok: false,
      status: DOWNLOAD_STATUS.FAILED_DOWNLOAD,
      httpStatus,
      contentType,
      buffer,
      error: `HTTP ${httpStatus}`,
    };
  }

  if (isDefinitelyNotImageContentType(contentType)) {
    const buffer = Buffer.from(await response.arrayBuffer().catch(() => new ArrayBuffer(0)));
    return {
      ok: false,
      status: DOWNLOAD_STATUS.INVALID_CONTENT,
      httpStatus,
      contentType,
      buffer,
      error: `Content-Type "${contentType || "(missing)"}" indicates a non-image body (HTML/JSON/XML), not an image.`,
    };
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return { ok: true, httpStatus, contentType, buffer };
}

async function writeDebugArtifact(failedDir, filename, buffer, contentType) {
  if (!buffer || buffer.length === 0) return;
  const extension = contentType?.includes("html") ? ".html" : ".bin";
  const debugPath = path.join(failedDir, `${filename.replace(/\.webp$/i, "")}${extension}`);
  await writeFile(debugPath, buffer).catch(() => {});
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  requireArg(args, "manifest", "manifest");
  requireArg(args, "source", "source");
  requireArg(args, "batch", "batch");

  const manifestPath = path.resolve(args.manifest);
  const csvText = await readFile(manifestPath, "utf8");
  const { rows, missingFields } = parseManifestCsv(csvText);

  if (missingFields.length > 0) {
    throw new Error(`Manifest is missing required column(s): ${missingFields.join(", ")}`);
  }
  if (rows.length === 0) {
    throw new Error("Manifest has no usable rows.");
  }

  const batchDir = path.join(args.outputRoot, args.source, args.batch);
  const readyDir = path.join(batchDir, "ready");
  const failedDir = path.join(batchDir, "failed");
  await mkdir(readyDir, { recursive: true });
  await mkdir(failedDir, { recursive: true });

  console.log(`Manifest: ${manifestPath}`);
  console.log(`Rows: ${rows.length}`);
  console.log(`Output: ${batchDir}`);
  console.log(`Concurrency: ${args.concurrency}\n`);

  const downloadCache = new Map();
  const tasks = rows.map((row) => () => processRow(row, { readyDir, failedDir, downloadCache }));
  const resultRows = annotateSharedAssets(await runWithConcurrency(tasks, args.concurrency));

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const resultCsvPath = path.join(batchDir, `result-${timestamp}.csv`);
  await writeFile(
    resultCsvPath,
    stringify(resultRows, { header: true, columns: RESULT_COLUMNS })
  );

  const counts = resultRows.reduce((tally, row) => {
    tally[row.download_status] = (tally[row.download_status] ?? 0) + 1;
    return tally;
  }, {});

  console.log("Done.");
  for (const status of Object.values(DOWNLOAD_STATUS)) {
    console.log(`  ${status}: ${counts[status] ?? 0}`);
  }
  console.log(`\nResult CSV: ${resultCsvPath}`);
}

main().catch((error) => {
  console.error(`\nimage acquisition failed: ${error.message}`);
  process.exitCode = 1;
});
