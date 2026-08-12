import "dotenv/config";
import { prisma } from "../src/config/db.js";
import { WEBSITE_BRANDS } from "./taxonomySeedData.js";

// Seeds the website-managed brand/category taxonomy. These records belong to
// the website admin dashboard; the owner/NewAcc system only supplies product
// price, stock, SKU, and availability, and its imports never create or modify
// taxonomy records by default.
//
// This seed is create-only: a record whose name (case-insensitive) or slug
// already exists is skipped, so admin-edited records are never overwritten.
// Safe to re-run at any time.
//
// TODO(taxonomy): Category has no parent/child support in the schema, so only
// flat top-level categories are seeded. Revisit if a parentId is added.

function normalizeName(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function slugify(value) {
  return normalizeName(value)
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

async function seedTaxonomy(model, label, entries) {
  let created = 0;
  let skipped = 0;
  const seenNames = new Set();
  const seenSlugs = new Set();

  for (const entry of entries) {
    const name = normalizeName(entry.name);
    const slug = slugify(entry.slug || name);
    if (!name || !slug) {
      console.warn(`${label}: skipped an entry without a usable name/slug: ${JSON.stringify(entry)}`);
      skipped += 1;
      continue;
    }
    const nameKey = name.toLowerCase();
    if (seenNames.has(nameKey) || seenSlugs.has(slug)) {
      skipped += 1;
      continue;
    }
    seenNames.add(nameKey);
    seenSlugs.add(slug);

    const existing = await prisma[model].findFirst({
      where: { OR: [{ name: { equals: name, mode: "insensitive" } }, { slug }] },
      select: { id: true },
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    await prisma[model].create({ data: { name, slug, status: "ACTIVE" } });
    created += 1;
  }

  console.log(`${label}: created ${created}, skipped ${skipped} (already existing or duplicate).`);
}

try {
  // Categories are now seeded as a tree by src/scripts/importCategoryTree.js
  // (owner Excel is the source of truth). Seeding the old flat list here would
  // recreate categories that the tree import renamed or deactivated.
  console.log("Categories: skipped — run `node --env-file=.env src/scripts/importCategoryTree.js` instead.");
  await seedTaxonomy("brand", "Brands", WEBSITE_BRANDS);
  console.log("Website-managed taxonomy seed finished. Admins manage these records from the dashboard.");
} finally {
  await prisma.$disconnect();
}
