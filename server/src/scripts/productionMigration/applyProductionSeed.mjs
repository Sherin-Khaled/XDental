#!/usr/bin/env node
/**
 * Applies a production-seed-bundle.json (produced by
 * exportProductionSeed.mjs) to whatever database DATABASE_URL currently
 * points at.
 *
 * SAFETY: this script performs REAL writes ONLY when run with
 * --confirm-apply. Without it, it validates the bundle and the target
 * database (schema present, tables empty) and prints exactly what WOULD
 * happen, then exits — no writes.
 *
 * This has not been run with --confirm-apply against anything. No
 * Supabase project exists yet for it to target.
 *
 * Insert order matters for FK integrity and is fixed here:
 *   1. Brand, Permission, DeliveryZone, HeroSlide (no dependencies on
 *      anything else in the bundle)
 *   2. Category (topologically pre-sorted parent-before-child by the
 *      export step; inserted in that exact order)
 *   3. Product (depends on Brand.id / Category.id already existing)
 * All of it runs inside a single Prisma transaction — the target
 * database ends up either fully populated or untouched, never partial.
 *
 * Usage:
 *   node applyProductionSeed.mjs                 -> validate + dry-run report only
 *   node applyProductionSeed.mjs --confirm-apply  -> perform the real writes
 */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { PrismaClient } from "../../generated/prisma-client-runtime/client.js";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../../..");
const BUNDLE_PATH = path.join(PROJECT_ROOT, "production-seed-export", "production-seed-bundle.json");

function checksum(rows) {
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

function verifyBundleIntegrity(bundle) {
  const problems = [];
  for (const [table, rows] of Object.entries(bundle.tables)) {
    const expected = bundle.checksums[table];
    const actual = checksum(rows);
    if (expected !== actual) {
      problems.push(`${table}: checksum mismatch (bundle may have been hand-edited after export)`);
    }
    if (bundle.counts[table] !== rows.length) {
      problems.push(`${table}: count mismatch (bundle says ${bundle.counts[table]}, array has ${rows.length})`);
    }
  }
  return problems;
}

async function main() {
  const confirmApply = process.argv.includes("--confirm-apply");

  const bundleText = await readFile(BUNDLE_PATH, "utf8").catch(() => {
    throw new Error(`No export bundle found at ${BUNDLE_PATH}. Run exportProductionSeed.mjs first.`);
  });
  const bundle = JSON.parse(bundleText);

  const integrityProblems = verifyBundleIntegrity(bundle);
  console.log("=== Production Seed Apply ===");
  console.log(`Bundle generated at: ${bundle.generatedAt}`);
  console.log(`Mode: ${confirmApply ? "APPLY (real writes)" : "VALIDATE + DRY RUN (no writes)"}`);
  console.log("");

  if (integrityProblems.length > 0) {
    console.log("Bundle integrity problems found — refusing to proceed:");
    integrityProblems.forEach((p) => console.log(`  - ${p}`));
    process.exitCode = 1;
    return;
  }
  console.log("Bundle integrity: all checksums and counts match.");

  const prisma = new PrismaClient();

  // Refuse to run against a database that already has data in any of the
  // target tables — this script seeds a fresh database, it does not merge
  // into or overwrite an existing one.
  const existingCounts = {
    brand: await prisma.brand.count(),
    category: await prisma.category.count(),
    product: await prisma.product.count(),
    deliveryZone: await prisma.deliveryZone.count(),
    heroSlide: await prisma.heroSlide.count(),
    permission: await prisma.permission.count(),
  };
  const nonEmpty = Object.entries(existingCounts).filter(([, count]) => count > 0);
  if (nonEmpty.length > 0) {
    console.log("\nTarget database already has rows in these tables — refusing to proceed:");
    nonEmpty.forEach(([table, count]) => console.log(`  - ${table}: ${count} existing rows`));
    console.log(
      "\nThis script only seeds an empty, freshly-migrated database (after `prisma migrate deploy`). " +
        "If you intend to re-seed, clear these tables deliberately first — this script will not do that for you."
    );
    await prisma.$disconnect();
    process.exitCode = 1;
    return;
  }
  console.log("Target database tables are empty — safe to seed.");

  console.log("\nPlanned inserts:");
  for (const [table, rows] of Object.entries(bundle.tables)) {
    console.log(`  - ${table}: ${rows.length}`);
  }

  if (!confirmApply) {
    console.log("\nDry run only — no writes performed. Re-run with --confirm-apply to apply for real.");
    await prisma.$disconnect();
    return;
  }

  console.log("\nApplying in a single transaction...");
  await prisma.$transaction(async (tx) => {
    if (bundle.tables.brand.length) await tx.brand.createMany({ data: bundle.tables.brand });
    if (bundle.tables.permission.length) await tx.permission.createMany({ data: bundle.tables.permission });
    if (bundle.tables.deliveryZone.length) await tx.deliveryZone.createMany({ data: bundle.tables.deliveryZone });
    if (bundle.tables.heroSlide.length) await tx.heroSlide.createMany({ data: bundle.tables.heroSlide });
    // Category rows are pre-sorted parent-before-child by the export step;
    // createMany does not guarantee row order execution, so insert
    // sequentially here to respect the self-referential FK.
    for (const category of bundle.tables.category) {
      await tx.category.create({ data: category });
    }
    if (bundle.tables.product.length) await tx.product.createMany({ data: bundle.tables.product });
  });

  console.log("Applied successfully.");
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Production seed apply failed:", error.message);
  console.error(error.stack);
  process.exitCode = 1;
});
