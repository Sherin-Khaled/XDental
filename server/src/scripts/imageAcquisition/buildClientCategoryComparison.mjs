#!/usr/bin/env node
/**
 * Corrected X_Dental_Category_Comparison.csv — compares THREE real sources:
 *   A. CLIENT_SEED_TAXONOMY — the client's category workbook (an admittedly
 *      incomplete seed list, not the final authoritative taxonomy)
 *   B. the live X Dental Category table
 *   C. categories actually used by the 12,942 TOOTHPICK_EG launch products,
 *      with exact per-category product counts
 *
 * Read-only: does not modify the workbook, the database, or crawl images.
 */
import { readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { stringify } from "csv-stringify/sync";
import { PrismaClient } from "../../generated/prisma-client-runtime/client.js";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../../..");
const OUTPUT_PATH = path.join(PROJECT_ROOT, "image-acquisition-output", "X_Dental_Category_Comparison.csv");
const WORKBOOK_PATH = "D:/Front-End/Work/XDental.website/Image_acquisition/X_Dental_Client_Categories.xlsx.xlsx";

const COLUMNS = [
  "client_category_code",
  "client_category_name",
  "normalized_client_name",
  "xdental_category_name",
  "xdental_category_id",
  "xdental_slug",
  "present_in_client_workbook",
  "present_in_current_xdental",
  "used_by_launch_products",
  "launch_product_count",
  "parent_category_if_known",
  "suspected_duplicate",
  "suspected_typo_or_naming_variant",
  "recommended_action",
  "notes",
];

function normalize(name) {
  return String(name ?? "")
    .toLowerCase()
    // Canonicalize spacing around separators before collapsing whitespace,
    // so "Perio&Surgery" and "Perio & Surgery" normalize identically —
    // the client workbook and X Dental are inconsistent about this exact
    // spacing throughout, and it is not a meaningful naming difference.
    .replace(/\s*&\s*/g, " & ")
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s+/g, " ")
    .trim();
}

// A looser key for fuzzy-candidate detection only — never used to declare a
// confirmed match, only to surface a REVIEW_NAMING suggestion for a human.
function looseKey(name) {
  return normalize(name).replace(/&/g, " and ").replace(/[^a-z0-9\u0600-\u06FF]+/g, "");
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

async function readClientWorkbook() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(WORKBOOK_PATH);
  const sheet = workbook.worksheets[0];
  const rows = [];
  for (let i = 2; i <= sheet.rowCount; i++) {
    const values = sheet.getRow(i).values;
    const code = values[3] ?? values[1];
    const name = values[2];
    if (code === undefined || code === null || !name) continue;
    rows.push({ code: String(code), rawName: String(name) });
  }
  return rows;
}

function deriveParents(clientRows) {
  const codes = clientRows.map((r) => r.code).filter((c) => c !== "0");
  const byCode = new Map(clientRows.map((r) => [r.code, r]));
  const parentOf = new Map();
  for (const row of clientRows) {
    if (row.code === "0") continue;
    let bestParent = null;
    for (const candidate of codes) {
      if (candidate === row.code) continue;
      if (row.code.startsWith(candidate) && candidate.length < row.code.length) {
        if (!bestParent || candidate.length > bestParent.length) bestParent = candidate;
      }
    }
    parentOf.set(row.code, bestParent ? byCode.get(bestParent)?.rawName ?? null : null);
  }
  return parentOf;
}

async function main() {
  const clientRowsRaw = await readClientWorkbook();
  const parentOf = deriveParents(clientRowsRaw);

  const clientRows = clientRowsRaw.map((r) => ({
    code: r.code,
    name: r.rawName,
    normalized: normalize(r.rawName),
    loose: looseKey(r.rawName),
    parent: r.code === "0" ? null : parentOf.get(r.code) ?? null,
  }));

  // Duplicate detection within the client workbook (by normalized name).
  const normalizedGroups = new Map();
  for (const row of clientRows) {
    if (row.code === "0") continue; // workbook root/title row, not a real category
    if (!normalizedGroups.has(row.normalized)) normalizedGroups.set(row.normalized, []);
    normalizedGroups.get(row.normalized).push(row);
  }
  const duplicateCodes = new Set();
  for (const group of normalizedGroups.values()) {
    if (group.length > 1) group.forEach((r) => duplicateCodes.add(r.code));
  }

  const prisma = new PrismaClient();
  const xdentalCategories = await prisma.category.findMany({
    select: {
      id: true,
      name: true,
      nameAr: true,
      slug: true,
      status: true,
      parentId: true,
      parent: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });
  const launchCounts = await prisma.product.groupBy({
    by: ["categoryId"],
    where: { sourceSystem: "TOOTHPICK_EG" },
    _count: { _all: true },
  });
  await prisma.$disconnect();

  const launchCountByCategoryId = new Map(launchCounts.map((c) => [c.categoryId, c._count._all]));
  const totalLaunchProducts = launchCounts.reduce((sum, c) => sum + c._count._all, 0);

  const xdentalByNormalized = new Map();
  for (const cat of xdentalCategories) {
    const key = normalize(cat.name);
    if (!xdentalByNormalized.has(key)) xdentalByNormalized.set(key, []);
    xdentalByNormalized.get(key).push(cat);
  }

  const matchedXdentalIds = new Set();
  const rows = [];

  let unmatchedClientCount = 0;
  let addFromToothpickCount = 0;
  let reviewDuplicateCount = 0;
  let reviewNamingCount = 0;
  let unusedClientCategoryCount = 0;
  let clientInXdentalCount = 0;

  for (const row of clientRows) {
    if (row.code === "0") {
      rows.push({
        client_category_code: row.code,
        client_category_name: row.name,
        normalized_client_name: row.normalized,
        xdental_category_name: "",
        xdental_category_id: "",
        xdental_slug: "",
        present_in_client_workbook: "TRUE",
        present_in_current_xdental: "FALSE",
        used_by_launch_products: "FALSE",
        launch_product_count: 0,
        parent_category_if_known: "",
        suspected_duplicate: "FALSE",
        suspected_typo_or_naming_variant: "FALSE",
        recommended_action: "NO_ACTION",
        notes: "Workbook root/title row (Arabic: category list header), not an actual product category.",
      });
      continue;
    }

    const exactMatches = xdentalByNormalized.get(row.normalized) ?? [];
    const isDuplicate = duplicateCodes.has(row.code);
    let fuzzyCandidate = null;

    if (exactMatches.length === 0) {
      unmatchedClientCount++;
      let bestDistance = Infinity;
      for (const cat of xdentalCategories) {
        const candidateLoose = looseKey(cat.name);
        if (!candidateLoose || !row.loose) continue;
        const distance = levenshtein(row.loose, candidateLoose);
        const maxLen = Math.max(row.loose.length, candidateLoose.length);
        if (maxLen > 0 && distance / maxLen <= 0.25 && distance < bestDistance && distance > 0) {
          bestDistance = distance;
          fuzzyCandidate = cat;
        }
      }
    }

    if (exactMatches.length === 0 && !fuzzyCandidate) {
      let action = "NO_ACTION";
      if (isDuplicate) {
        action = "REVIEW_DUPLICATE";
        reviewDuplicateCount++;
      }
      rows.push({
        client_category_code: row.code,
        client_category_name: row.name,
        normalized_client_name: row.normalized,
        xdental_category_name: "",
        xdental_category_id: "",
        xdental_slug: "",
        present_in_client_workbook: "TRUE",
        present_in_current_xdental: "FALSE",
        used_by_launch_products: "FALSE",
        launch_product_count: 0,
        parent_category_if_known: row.parent ?? "",
        suspected_duplicate: isDuplicate ? "TRUE" : "FALSE",
        suspected_typo_or_naming_variant: "FALSE",
        recommended_action: action,
        notes: isDuplicate
          ? "Duplicate/near-duplicate name within the client workbook itself — needs owner review before use."
          : "Not found in X Dental (exact or close match) and not used by any launch product. No X Dental category exists for this yet.",
      });
      continue;
    }

    if (exactMatches.length === 0 && fuzzyCandidate) {
      reviewNamingCount++;
      const cat = fuzzyCandidate;
      const count = launchCountByCategoryId.get(cat.id) ?? 0;
      matchedXdentalIds.add(cat.id);
      rows.push({
        client_category_code: row.code,
        client_category_name: row.name,
        normalized_client_name: row.normalized,
        xdental_category_name: cat.name,
        xdental_category_id: cat.id,
        xdental_slug: cat.slug,
        present_in_client_workbook: "TRUE",
        present_in_current_xdental: "TRUE",
        used_by_launch_products: count > 0 ? "TRUE" : "FALSE",
        launch_product_count: count,
        parent_category_if_known: cat.parent?.name ?? row.parent ?? "",
        suspected_duplicate: isDuplicate ? "TRUE" : "FALSE",
        suspected_typo_or_naming_variant: "TRUE",
        recommended_action: isDuplicate ? "REVIEW_DUPLICATE" : "REVIEW_NAMING",
        notes: `Close but not exact match to X Dental category "${cat.name}" — possible spelling/naming variant, needs owner confirmation before treating as the same category.`,
      });
      if (isDuplicate) reviewDuplicateCount++;
      continue;
    }

    // One or more exact normalized matches.
    clientInXdentalCount++;
    for (const cat of exactMatches) {
      matchedXdentalIds.add(cat.id);
      const count = launchCountByCategoryId.get(cat.id) ?? 0;
      let action = "KEEP";
      if (isDuplicate) {
        action = "REVIEW_DUPLICATE";
      } else if (count === 0) {
        action = "UNUSED_CLIENT_CATEGORY";
        unusedClientCategoryCount++;
      }
      rows.push({
        client_category_code: row.code,
        client_category_name: row.name,
        normalized_client_name: row.normalized,
        xdental_category_name: cat.name,
        xdental_category_id: cat.id,
        xdental_slug: cat.slug,
        present_in_client_workbook: "TRUE",
        present_in_current_xdental: "TRUE",
        used_by_launch_products: count > 0 ? "TRUE" : "FALSE",
        launch_product_count: count,
        parent_category_if_known: cat.parent?.name ?? row.parent ?? "",
        suspected_duplicate: isDuplicate ? "TRUE" : "FALSE",
        suspected_typo_or_naming_variant: "FALSE",
        recommended_action: action,
        notes: isDuplicate
          ? "Duplicate/near-duplicate name within the client workbook itself — needs owner review before use."
          : "",
      });
    }
  }

  // X Dental categories not matched to any client-workbook row.
  for (const cat of xdentalCategories) {
    if (matchedXdentalIds.has(cat.id)) continue;
    const count = launchCountByCategoryId.get(cat.id) ?? 0;
    const usedByLaunch = count > 0;
    const action = usedByLaunch ? "ADD_FROM_TOOTHPICK" : "NO_ACTION";
    if (usedByLaunch) addFromToothpickCount++;
    rows.push({
      client_category_code: "",
      client_category_name: "",
      normalized_client_name: "",
      xdental_category_name: cat.name,
      xdental_category_id: cat.id,
      xdental_slug: cat.slug,
      present_in_client_workbook: "FALSE",
      present_in_current_xdental: "TRUE",
      used_by_launch_products: usedByLaunch ? "TRUE" : "FALSE",
      launch_product_count: count,
      parent_category_if_known: cat.parent?.name ?? "",
      suspected_duplicate: "FALSE",
      suspected_typo_or_naming_variant: "FALSE",
      recommended_action: action,
      notes: usedByLaunch
        ? "Legitimate category used by imported Toothpick launch products; not represented in the client's seed workbook. Not assumed wrong — needs owner review for addition/retention."
        : "Exists in X Dental but not in the client workbook and not used by any launch product.",
    });
  }

  rows.sort((a, b) => {
    if (a.recommended_action === b.recommended_action) {
      return (a.client_category_name || a.xdental_category_name).localeCompare(
        b.client_category_name || b.xdental_category_name
      );
    }
    const order = ["REVIEW_DUPLICATE", "REVIEW_NAMING", "ADD_FROM_TOOTHPICK", "UNUSED_CLIENT_CATEGORY", "KEEP", "NO_ACTION"];
    return order.indexOf(a.recommended_action) - order.indexOf(b.recommended_action);
  });

  await writeFile(OUTPUT_PATH, stringify(rows, { header: true, columns: COLUMNS }));

  // Derive every summary count from the final `rows` array itself (not the
  // scattered loop counters above) so the console summary can never drift
  // from what's actually in the CSV.
  const uniqueNormalizedClient = new Set(clientRows.filter((r) => r.code !== "0").map((r) => r.normalized)).size;
  const usedCategoryIds = new Set(launchCounts.map((c) => c.categoryId));
  const countRows = (predicate) => rows.filter(predicate).length;
  const clientRowCount = countRows((r) => r.present_in_client_workbook === "TRUE");
  const xdentalRowCount = new Set(rows.filter((r) => r.present_in_current_xdental === "TRUE").map((r) => r.xdental_category_id)).size;
  const presentInBoth = countRows((r) => r.present_in_client_workbook === "TRUE" && r.present_in_current_xdental === "TRUE");
  const addFromToothpick = countRows((r) => r.recommended_action === "ADD_FROM_TOOTHPICK");
  const unusedClientCategory = countRows((r) => r.recommended_action === "UNUSED_CLIENT_CATEGORY");
  const suspectedDuplicateRows = countRows((r) => r.suspected_duplicate === "TRUE");
  const suspectedNamingRows = countRows((r) => r.suspected_typo_or_naming_variant === "TRUE");
  const reviewDuplicateRows = countRows((r) => r.recommended_action === "REVIEW_DUPLICATE");
  const reviewNamingRows = countRows((r) => r.recommended_action === "REVIEW_NAMING");

  console.log("=== X Dental Category Comparison (3-source, corrected) ===");
  console.log(`Client workbook category rows: ${clientRows.length}`);
  console.log(`Unique normalized client categories: ${uniqueNormalizedClient}`);
  console.log(`Current X Dental categories: ${xdentalCategories.length} (represented in output: ${xdentalRowCount})`);
  console.log(`Categories used by 12,942 launch products: ${usedCategoryIds.size} (product total: ${totalLaunchProducts})`);
  console.log(`Client rows in output: ${clientRowCount}`);
  console.log(`Categories present in client workbook AND X Dental: ${presentInBoth}`);
  console.log(`ADD_FROM_TOOTHPICK (used by launch, absent from client workbook): ${addFromToothpick}`);
  console.log(`UNUSED_CLIENT_CATEGORY (client+X Dental has it, 0 launch products): ${unusedClientCategory}`);
  console.log(`Suspected duplicate rows (within client workbook): ${suspectedDuplicateRows} (distinct codes: ${duplicateCodes.size})`);
  console.log(`Suspected naming/typo variant rows: ${suspectedNamingRows}`);
  console.log(`REVIEW_DUPLICATE rows: ${reviewDuplicateRows}`);
  console.log(`REVIEW_NAMING rows: ${reviewNamingRows}`);
  console.log(`Total output rows: ${rows.length}`);
  console.log(`\nOutput: ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error("Client category comparison failed:", error.message);
  console.error(error.stack);
  process.exitCode = 1;
});
