#!/usr/bin/env node
/**
 * Production seed export — reads ONLY the approved dataset from the
 * current local database and writes a deterministic, reviewable JSON
 * bundle to /production-seed-export/ (gitignored, local-only).
 *
 * This script:
 *   - connects ONLY to the database at the local DATABASE_URL (never to
 *     Supabase or any remote endpoint — there is no network client in
 *     this file other than the local Prisma connection)
 *   - never writes to any database — read-only queries followed by local
 *     file writes only
 *   - never queries User, AuthSession, CartItem, Order, OrderItem, Quote,
 *     SupportThread, ProductRequest, Notification, LoyaltyAccount,
 *     WalletTransaction, EmailDelivery, UserPermission,
 *     CatalogImportBatch, or CatalogImportRow at all — not filtered out
 *     after the fact, simply never selected, so no password hash, session
 *     token, or customer PII can end up in the export by construction
 *   - is an explicit allowlist: every table exported is named directly
 *     below; nothing is copied by iterating "all tables"
 *
 * Approved dataset (per the 2026-08-12 production-data classification —
 * see docs/production-database-migration-plan.md):
 *   - Product:      sourceSystem = 'TOOTHPICK_EG' only (excludes the 8
 *                    known local/test product rows)
 *   - Brand:        only brands actually referenced by an exported product
 *   - Category:     only categories actually referenced by an exported
 *                    product, PLUS their full parent-chain ancestry (a
 *                    category can be a parent with no directly-assigned
 *                    products but still be structurally required)
 *   - DeliveryZone: the 9 explicitly approved slugs only (excludes the
 *                    "freedelivery" test zone)
 *   - HeroSlide:    the 3 currently PUBLISHED slides (excludes any DRAFT)
 *   - Permission:   all rows — role/permission definitions are system
 *                    configuration, not customer data
 *   - LoyaltyProgramSettings: ONE synthesized row, `enabled: false`,
 *                    every other field left at the schema's own documented
 *                    defaults (not invented, not read from the local DB —
 *                    see LOYALTY_SETTINGS_SAFE_DEFAULT below). Required
 *                    because `getLoyaltyProgramSettings()` in
 *                    loyalty.service.js upserts this singleton on first
 *                    read with `enabled: true` and real default point
 *                    values if the row is missing, and that read happens
 *                    from an unauthenticated public endpoint
 *                    (`getPublicLoyaltySettings`) — so a genuinely absent
 *                    row does not stay absent, it self-activates on the
 *                    very first page load that touches it. Pre-seeding it
 *                    disabled prevents that.
 *
 * Explicitly excluded (not queried, not exported): DeliveryOffer,
 * ScheduledPromotion, FlashSale, User and everything keyed off User,
 * CatalogImportBatch/CatalogImportRow. Real production promotions/coupons
 * are expected to be created fresh after go-live, not migrated from the
 * current test rows — see the migration plan doc.
 *
 * Usage: node exportProductionSeed.mjs
 * (Read-only. Does not execute anything against a production database.)
 */
import { writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { PrismaClient } from "../../generated/prisma-client-runtime/client.js";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../../..");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "production-seed-export");

const APPROVED_DELIVERY_ZONE_SLUGS = [
  "new-cairo",
  "nasr-city",
  "heliopolis",
  "maadi",
  "dokki",
  "mohandessin",
  "6th-of-october",
  "sheikh-zayed",
  "other",
];

// Matches loyalty.service.js's SETTINGS_ID exactly — the app looks up the
// singleton by this literal id, not by any query.
const LOYALTY_SETTINGS_ID = "default";

// Every numeric field is the schema's own @default(...) value from
// server/prisma/schema.prisma's LoyaltyProgramSettings model — not
// invented here, not read from the local DB (whose row is itself just
// these same defaults, auto-created by the app's own upsert during local
// testing). The only deliberate override is `enabled: false`.
const LOYALTY_SETTINGS_SAFE_DEFAULT = {
  id: LOYALTY_SETTINGS_ID,
  enabled: false,
  standardPointsPerEgp10: 1,
  vipPointsPerEgp10: 2,
  pointsPerRedemptionUnit: 100,
  redemptionValueEgp: "10",
  welcomePoints: 200,
  welcomeMinimumSubtotalEgp: "500",
  welcomeExpiryDays: 30,
  minimumRedemptionPoints: 100,
  maximumRedemptionPercent: "20",
  expiryMonths: 12,
};

function checksum(rows) {
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

async function main() {
  const prisma = new PrismaClient();

  // --- Product (allowlisted columns only; no relation payloads) ---
  const products = await prisma.product.findMany({
    where: { sourceSystem: "TOOTHPICK_EG" },
    select: {
      id: true,
      externalProductId: true,
      name: true,
      nameAr: true,
      slug: true,
      brand: true,
      brandId: true,
      sku: true,
      category: true,
      categoryId: true,
      description: true,
      descriptionAr: true,
      shortDescription: true,
      shortDescriptionAr: true,
      price: true,
      salePrice: true,
      stockQuantity: true,
      status: true,
      featured: true,
      isWeeklyOffer: true,
      isBestSeller: true,
      isNewArrival: true,
      isHotDeal: true,
      isFastDelivery: true,
      purchaseMode: true,
      isAvailable: true,
      imageUrl: true,
      sourceSystem: true,
      externalStatus: true,
      syncStatus: true,
      lastSyncedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { id: "asc" },
  });

  if (products.length !== 12942) {
    throw new Error(
      `Expected exactly 12942 TOOTHPICK_EG products, found ${products.length}. Stopping — data may have drifted since the approved classification. Investigate before exporting.`
    );
  }

  // --- Brand: only brands actually referenced by an exported product ---
  const referencedBrandIds = [...new Set(products.map((p) => p.brandId).filter(Boolean))];
  const brands = await prisma.brand.findMany({
    where: { id: { in: referencedBrandIds } },
    select: {
      id: true,
      externalBrandId: true,
      sourceSystem: true,
      name: true,
      slug: true,
      country: true,
      logoUrl: true,
      description: true,
      featured: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { id: "asc" },
  });

  // --- Category: referenced categories + full ancestor chain ---
  const directCategoryIds = new Set(products.map((p) => p.categoryId).filter(Boolean));
  const allCategoriesForAncestryWalk = await prisma.category.findMany({
    select: { id: true, parentId: true },
  });
  const categoryById = new Map(allCategoriesForAncestryWalk.map((c) => [c.id, c]));
  const fullCategoryIdSet = new Set(directCategoryIds);
  for (const id of directCategoryIds) {
    let current = categoryById.get(id);
    while (current?.parentId) {
      fullCategoryIdSet.add(current.parentId);
      current = categoryById.get(current.parentId);
    }
  }
  const categoriesRaw = await prisma.category.findMany({
    where: { id: { in: [...fullCategoryIdSet] } },
    select: {
      id: true,
      externalCategoryId: true,
      sourceSystem: true,
      name: true,
      nameAr: true,
      slug: true,
      description: true,
      icon: true,
      imageUrl: true,
      parentId: true,
      displayOrder: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  // Topologically sort parent-before-child so a straightforward sequential
  // insert against a fresh database never violates the self-referential FK.
  const categoriesById = new Map(categoriesRaw.map((c) => [c.id, c]));
  const orderedCategories = [];
  const visited = new Set();
  function visitCategory(id) {
    if (visited.has(id)) return;
    const cat = categoriesById.get(id);
    if (!cat) return;
    if (cat.parentId) visitCategory(cat.parentId);
    visited.add(id);
    orderedCategories.push(cat);
  }
  for (const id of categoriesById.keys()) visitCategory(id);

  // --- DeliveryZone: explicit allowlist by slug ---
  const deliveryZones = await prisma.deliveryZone.findMany({
    where: { slug: { in: APPROVED_DELIVERY_ZONE_SLUGS } },
    select: {
      id: true,
      slug: true,
      nameEn: true,
      nameAr: true,
      isActive: true,
      displayOrder: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { displayOrder: "asc" },
  });
  if (deliveryZones.length !== APPROVED_DELIVERY_ZONE_SLUGS.length) {
    const foundSlugs = new Set(deliveryZones.map((z) => z.slug));
    const missing = APPROVED_DELIVERY_ZONE_SLUGS.filter((s) => !foundSlugs.has(s));
    throw new Error(`Expected all 9 approved delivery zone slugs; missing: ${missing.join(", ")}`);
  }

  // --- HeroSlide: currently published only; updatedById always nulled
  //     (User is never migrated, so a dangling FK is not acceptable even
  //     if the current rows happen to already have it null) ---
  const heroSlidesRaw = await prisma.heroSlide.findMany({
    where: { status: "PUBLISHED" },
    select: {
      id: true,
      slotNumber: true,
      order: true,
      isActive: true,
      status: true,
      countdownTo: true,
      content: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { order: "asc" },
  });
  const heroSlides = heroSlidesRaw.map((slide) => ({ ...slide, updatedById: null }));
  if (heroSlides.length !== 3) {
    throw new Error(`Expected exactly 3 published HeroSlide rows, found ${heroSlides.length}. Investigate before exporting.`);
  }

  // --- Permission: all rows (system configuration, not user data) ---
  const permissions = await prisma.permission.findMany({
    select: { id: true, key: true, group: true, description: true, createdAt: true, updatedAt: true },
    orderBy: { key: "asc" },
  });

  // --- LoyaltyProgramSettings: one synthesized row, not read from the DB
  //     at all — see LOYALTY_SETTINGS_SAFE_DEFAULT above for why. ---
  const loyaltyProgramSettings = [LOYALTY_SETTINGS_SAFE_DEFAULT];

  await prisma.$disconnect();

  await mkdir(OUTPUT_DIR, { recursive: true });

  const bundle = {
    generatedAt: new Date().toISOString(),
    approvedClassificationDate: "2026-08-12",
    source: "local development PostgreSQL database (read-only export)",
    tables: {
      product: products,
      brand: brands,
      category: orderedCategories,
      deliveryZone: deliveryZones,
      heroSlide: heroSlides,
      permission: permissions,
      loyaltyProgramSettings,
    },
    counts: {
      product: products.length,
      brand: brands.length,
      category: orderedCategories.length,
      deliveryZone: deliveryZones.length,
      heroSlide: heroSlides.length,
      permission: permissions.length,
      loyaltyProgramSettings: loyaltyProgramSettings.length,
    },
    checksums: {
      product: checksum(products),
      brand: checksum(brands),
      category: checksum(orderedCategories),
      deliveryZone: checksum(deliveryZones),
      heroSlide: checksum(heroSlides),
      permission: checksum(permissions),
      loyaltyProgramSettings: checksum(loyaltyProgramSettings),
    },
  };

  await writeFile(path.join(OUTPUT_DIR, "production-seed-bundle.json"), JSON.stringify(bundle, null, 2));

  console.log("=== Production Seed Export (read-only, local DB only) ===");
  console.log(`Product:      ${products.length} (expected 12942)`);
  console.log(`Brand:        ${brands.length} (referenced by exported products)`);
  console.log(`Category:     ${orderedCategories.length} (${directCategoryIds.size} directly referenced + ${orderedCategories.length - directCategoryIds.size} ancestor-only)`);
  console.log(`DeliveryZone: ${deliveryZones.length} (expected 9)`);
  console.log(`HeroSlide:    ${heroSlides.length} (expected 3, updatedById forced null)`);
  console.log(`Permission:   ${permissions.length}`);
  console.log(`LoyaltyProgramSettings: ${loyaltyProgramSettings.length} (synthesized, enabled: false)`);
  console.log(`\nBundle written to: ${path.join(OUTPUT_DIR, "production-seed-bundle.json")}`);
  console.log("\nNo database was written to. No connection to Supabase or any remote host was made.");
}

main().catch((error) => {
  console.error("Production seed export failed:", error.message);
  console.error(error.stack);
  process.exitCode = 1;
});
