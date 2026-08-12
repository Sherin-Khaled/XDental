#!/usr/bin/env node
/**
 * X_Dental_Category_Comparison.csv — compares the category-taxonomy
 * snapshot captured during the catalogue-import audit
 * (docs/catalogue-audit/existing-categories.json, 2026-08-10) against the
 * live DB right now, to verify the "catalogue is frozen" assumption
 * actually held for categories: no unexpected new/removed categories, no
 * unexpected status flips, and to surface product-count drift (expected,
 * since the 12,942-product import happened after some of that snapshot).
 *
 * Read-only: does not modify the database or the snapshot file.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { stringify } from "csv-stringify/sync";
import { PrismaClient } from "../../generated/prisma-client-runtime/client.js";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../../..");
const SNAPSHOT_PATH = path.join(PROJECT_ROOT, "docs", "catalogue-audit", "existing-categories.json");
const OUTPUT_PATH = path.join(PROJECT_ROOT, "image-acquisition-output", "X_Dental_Category_Comparison.csv");

const COLUMNS = [
  "category_id",
  "name",
  "slug",
  "snapshot_status",
  "snapshot_product_count",
  "current_status",
  "current_product_count",
  "product_count_delta",
  "change_type",
];

async function main() {
  const snapshotRaw = await readFile(SNAPSHOT_PATH, "utf8");
  const snapshot = JSON.parse(snapshotRaw);
  const snapshotById = new Map(snapshot.categories.map((c) => [c.id, c]));

  const prisma = new PrismaClient();
  const current = await prisma.category.findMany({
    select: { id: true, name: true, slug: true, status: true, _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  });
  await prisma.$disconnect();

  const currentById = new Map(current.map((c) => [c.id, c]));
  const rows = [];
  let unchanged = 0;
  let countChanged = 0;
  let statusChanged = 0;
  let removedFromDb = 0;
  let newInDb = 0;

  for (const snap of snapshot.categories) {
    const now = currentById.get(snap.id);
    if (!now) {
      removedFromDb++;
      rows.push({
        category_id: snap.id,
        name: snap.name,
        slug: snap.slug,
        snapshot_status: snap.status,
        snapshot_product_count: snap.productCount,
        current_status: "",
        current_product_count: "",
        product_count_delta: "",
        change_type: "REMOVED_FROM_DB",
      });
      continue;
    }

    const currentCount = now._count.products;
    const delta = currentCount - snap.productCount;
    const statusFlip = now.status !== snap.status;
    let changeType = "UNCHANGED";
    if (statusFlip) {
      changeType = "STATUS_CHANGED";
      statusChanged++;
    } else if (delta !== 0) {
      changeType = "PRODUCT_COUNT_CHANGED";
      countChanged++;
    } else {
      unchanged++;
    }

    rows.push({
      category_id: snap.id,
      name: snap.name,
      slug: snap.slug,
      snapshot_status: snap.status,
      snapshot_product_count: snap.productCount,
      current_status: now.status,
      current_product_count: currentCount,
      product_count_delta: delta,
      change_type: changeType,
    });
  }

  for (const now of current) {
    if (!snapshotById.has(now.id)) {
      newInDb++;
      rows.push({
        category_id: now.id,
        name: now.name,
        slug: now.slug,
        snapshot_status: "",
        snapshot_product_count: "",
        current_status: now.status,
        current_product_count: now._count.products,
        product_count_delta: "",
        change_type: "NEW_IN_DB",
      });
    }
  }

  await writeFile(OUTPUT_PATH, stringify(rows, { header: true, columns: COLUMNS }));

  console.log("=== X Dental Category Comparison ===");
  console.log(`Snapshot categories (${snapshot.generatedAt}): ${snapshot.categories.length}`);
  console.log(`Current DB categories: ${current.length}`);
  console.log(`Unchanged: ${unchanged}`);
  console.log(`Product count changed: ${countChanged}`);
  console.log(`Status changed: ${statusChanged}`);
  console.log(`Removed from DB since snapshot: ${removedFromDb}`);
  console.log(`New in DB since snapshot: ${newInDb}`);
  console.log(`\nOutput: ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error("Category comparison failed:", error.message);
  console.error(error.stack);
  process.exitCode = 1;
});
