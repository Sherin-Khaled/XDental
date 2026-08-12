#!/usr/bin/env node
/**
 * Section 7 — controlled DB image update (preview only by default; NOT
 * applied unless explicitly confirmed).
 *
 * Input is X_Dental_Storage_Upload_Mapping.csv (produced by
 * uploadToProductionStorage.mjs / Section 6). Only rows with
 * upload_status === "VERIFIED" — meaning the real object was actually
 * uploaded to production storage and its size was confirmed against the
 * bucket — are eligible to update Product.imageUrl. DRY_RUN/FAILED rows
 * are left completely alone; those products keep imageUrl = null and rely
 * on the frontend's fallback rendering.
 *
 * Matching is strictly by externalProductId (Toothpick ID) against the
 * database — never by product name. Only the imageUrl field is ever
 * written; no price/stock/brand/category/description/name changes.
 * Updates run inside a single Prisma transaction so this is all-or-nothing,
 * not a partial write on failure.
 *
 * Usage:
 *   node updateProductImagesFromStorage.mjs              -> preview only
 *   node updateProductImagesFromStorage.mjs --apply       -> apply the update
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { PrismaClient } from "../../generated/prisma-client-runtime/client.js";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../../..");
const OUTPUT_ROOT = path.join(PROJECT_ROOT, "image-acquisition-output");
const MAPPING_PATH = path.join(OUTPUT_ROOT, "X_Dental_Storage_Upload_Mapping.csv");
const PREVIEW_OUTPUT_PATH = path.join(OUTPUT_ROOT, "X_Dental_DB_Update_Preview.csv");

const PREVIEW_COLUMNS = ["product_id", "SKU", "current_imageUrl", "new_imageUrl", "action", "reason"];

async function main() {
  const apply = process.argv.includes("--apply");

  const mappingText = await readFile(MAPPING_PATH, "utf8");
  const mappingRows = parse(mappingText, { bom: true, columns: true, skip_empty_lines: true });
  const verifiedRows = mappingRows.filter((row) => row.upload_status === "VERIFIED");

  console.log("=== X Dental Controlled DB Image Update (Section 7) ===");
  console.log(`Mapping rows total: ${mappingRows.length}`);
  console.log(`VERIFIED (upload-confirmed) rows eligible for a DB update: ${verifiedRows.length}`);
  console.log(`Mode: ${apply ? "APPLY" : "PREVIEW ONLY (no writes)"}`);
  console.log("");

  if (verifiedRows.length === 0) {
    console.log(
      "Nothing to do: no mapping rows are VERIFIED yet (Section 6's uploader has not performed a real " +
        "upload — it ran in dry-run mode because no production storage credentials are configured). " +
        "This is expected until real credentials + --confirm-upload are used."
    );
    await writeFile(PREVIEW_OUTPUT_PATH, stringify([], { header: true, columns: PREVIEW_COLUMNS }));
    console.log(`\nEmpty preview CSV written: ${PREVIEW_OUTPUT_PATH}`);
    return;
  }

  // Duplicate externalProductId within the mapping itself would mean two
  // uploads claim to be the primary image for the same product — reject
  // both rather than picking one arbitrarily.
  const countByProductId = new Map();
  for (const row of verifiedRows) {
    countByProductId.set(row.product_id, (countByProductId.get(row.product_id) ?? 0) + 1);
  }

  const prisma = new PrismaClient();
  const previewRows = [];
  const applyPlan = [];

  for (const row of verifiedRows) {
    if (countByProductId.get(row.product_id) > 1) {
      previewRows.push({
        product_id: row.product_id,
        SKU: row.SKU,
        current_imageUrl: "",
        new_imageUrl: row.public_url,
        action: "SKIP_DUPLICATE",
        reason: `${countByProductId.get(row.product_id)} VERIFIED mapping rows claim this product_id`,
      });
      continue;
    }

    const product = await prisma.product.findUnique({
      where: { externalProductId: row.product_id },
      select: { id: true, externalProductId: true, imageUrl: true, sourceSystem: true },
    });

    if (!product) {
      previewRows.push({
        product_id: row.product_id,
        SKU: row.SKU,
        current_imageUrl: "",
        new_imageUrl: row.public_url,
        action: "SKIP_UNRESOLVED",
        reason: "No product in the database has this externalProductId",
      });
      continue;
    }

    previewRows.push({
      product_id: row.product_id,
      SKU: row.SKU,
      current_imageUrl: product.imageUrl ?? "",
      new_imageUrl: row.public_url,
      action: "UPDATE",
      reason: "",
    });
    applyPlan.push({ id: product.id, externalProductId: row.product_id, imageUrl: row.public_url });
  }

  const updateCount = previewRows.filter((r) => r.action === "UPDATE").length;
  const skipUnresolvedCount = previewRows.filter((r) => r.action === "SKIP_UNRESOLVED").length;
  const skipDuplicateCount = previewRows.filter((r) => r.action === "SKIP_DUPLICATE").length;

  console.log(`Planned updates: ${updateCount}`);
  console.log(`Skipped — unresolved externalProductId: ${skipUnresolvedCount}`);
  console.log(`Skipped — duplicate mapping rows: ${skipDuplicateCount}`);

  await writeFile(PREVIEW_OUTPUT_PATH, stringify(previewRows, { header: true, columns: PREVIEW_COLUMNS }));
  console.log(`\nPreview CSV: ${PREVIEW_OUTPUT_PATH}`);

  if (!apply) {
    await prisma.$disconnect();
    console.log("\nPreview only — no database rows were modified. Re-run with --apply to write these updates.");
    return;
  }

  console.log(`\nApplying ${applyPlan.length} imageUrl update(s) in a single transaction...`);
  await prisma.$transaction(
    applyPlan.map((entry) =>
      prisma.product.update({
        where: { id: entry.id },
        data: { imageUrl: entry.imageUrl },
      })
    )
  );
  await prisma.$disconnect();
  console.log(`Applied ${applyPlan.length} update(s) successfully.`);
}

main().catch((error) => {
  console.error("Controlled DB image update failed:", error.message);
  console.error(error.stack);
  process.exitCode = 1;
});
