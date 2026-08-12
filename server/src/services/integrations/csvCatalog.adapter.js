import { prisma } from "../../config/db.js";
import { cleanText } from "../../utils/records.js";
import { parseCsv, stringifyCsv } from "../../utils/csv.js";
import { PRODUCT_IMPORT_COLUMNS, validateProductRows } from "../../utils/productImportValidator.js";
import { recordSyncResult, startSync, SYNC_ENTITY_TYPES } from "./syncLog.service.js";

const SOURCE_DEFAULT = "CSV_IMPORT";

function slugify(value) {
  return cleanText(value, 180)
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

async function uniqueSlug(database, model, preferred, suffix, excludeId = null) {
  const base = slugify(preferred) || slugify(suffix) || "imported-record";
  const candidates = [base, `${base}-${slugify(suffix)}`.slice(0, 180)];
  for (let index = 2; index < 1000; index += 1) candidates.push(`${base}-${index}`.slice(0, 180));
  for (const candidate of candidates) {
    const existing = await database[model].findFirst({
      where: { slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  throw new Error(`Could not generate a unique ${model} slug.`);
}

// Brands and categories are website-managed taxonomy. Import text is only a
// mapping hint: link to an existing record by name or slug, never modify it,
// and only create a new one behind the explicit createMissingLookups option.
async function resolveLookup(database, model, label, name, createMissing, warnings) {
  if (!name) return null;
  const slugHint = slugify(name);
  const existing = await database[model].findFirst({
    where: {
      OR: [
        { name: { equals: name, mode: "insensitive" } },
        ...(slugHint ? [{ slug: slugHint }] : []),
      ],
    },
    select: { name: true },
  });
  if (existing) return existing.name;
  if (!createMissing) {
    warnings.push(`${label} "${name}" not found; product imported without ${label.toLowerCase()} mapping.`);
    return null;
  }
  const slug = await uniqueSlug(database, model, name, name);
  const created = await database[model].create({
    data: { name, slug, status: "ACTIVE" },
    select: { name: true },
  });
  return created.name;
}

async function findCategoryRecord(database, name) {
  if (!name) return null;
  const slugHint = slugify(name);
  return database.category.findFirst({
    where: {
      OR: [
        { name: { equals: name, mode: "insensitive" } },
        ...(slugHint ? [{ slug: slugHint }] : []),
      ],
    },
    select: { id: true, name: true, parentId: true },
  });
}

async function categoryBelongsTo(database, child, ancestorId) {
  let parentId = child.parentId;
  while (parentId) {
    if (parentId === ancestorId) return true;
    const parent = await database.category.findUnique({
      where: { id: parentId },
      select: { parentId: true },
    });
    parentId = parent?.parentId ?? null;
  }
  return false;
}

/**
 * Resolves the import row's category/subcategory pair to the canonical
 * category name stored on the product (the most specific one).
 * - subcategory only: mapped directly.
 * - category only: mapped to a main category or subcategory by name/slug.
 * - both: validates the subcategory belongs to the given main category.
 * Missing subcategories are created under the main category only when
 * createMissingLookups is enabled and the main category resolved.
 */
async function resolveCategoryPair(database, row, options, warnings) {
  const main = await findCategoryRecord(database, row.category);
  if (row.category && !main && !row.subcategory) {
    // Backwards-compatible single-category behavior (warn or create).
    return resolveLookup(database, "category", "Category", row.category, options.createMissingLookups, warnings);
  }

  if (!row.subcategory) return main?.name ?? null;

  const sub = await findCategoryRecord(database, row.subcategory);
  if (sub) {
    if (main && !(await categoryBelongsTo(database, sub, main.id))) {
      throw new Error(`Subcategory "${sub.name}" does not belong to category "${main.name}".`);
    }
    return sub.name;
  }

  if (options.createMissingLookups && main) {
    const slug = await uniqueSlug(database, "category", row.subcategory, row.subcategory);
    const created = await database.category.create({
      data: { name: row.subcategory, slug, status: "ACTIVE", parentId: main.id },
      select: { name: true },
    });
    return created.name;
  }

  warnings.push(
    `Subcategory "${row.subcategory}" not found; product imported ${main ? `under "${main.name}"` : "without category mapping"}.`
  );
  return main?.name ?? null;
}

async function importRow(row, options) {
  return prisma.$transaction(async (database) => {
    const warnings = [];
    if (
      options.markMissingInactive && row.sourceSystem &&
      row.sourceSystem.toLowerCase() !== options.sourceSystem.toLowerCase()
    ) {
      throw new Error(`Row sourceSystem must match ${options.sourceSystem} when marking missing products inactive.`);
    }
    const existingBySku = await database.product.findFirst({
      where: { sku: { equals: row.sku, mode: "insensitive" } },
    });
    const requestedSlug = slugify(row.slug);
    const existingBySlug = requestedSlug
      ? await database.product.findUnique({ where: { slug: requestedSlug } })
      : null;

    if (existingBySku && existingBySlug && existingBySku.id !== existingBySlug.id) {
      throw new Error(`SKU ${row.sku} and slug ${requestedSlug} match different products.`);
    }
    if (!existingBySku && existingBySlug?.sku && existingBySlug.sku.toLowerCase() !== row.sku.toLowerCase()) {
      throw new Error(`Slug ${requestedSlug} already belongs to a different SKU.`);
    }

    const existing = existingBySku ?? existingBySlug;
    const slug = requestedSlug
      ? await uniqueSlug(database, "product", requestedSlug, row.sku, existing?.id)
      : existing?.slug ?? await uniqueSlug(database, "product", row.name, row.sku, existing?.id);
    const brand = await resolveLookup(database, "brand", "Brand", row.brand, options.createMissingLookups, warnings);
    const category = await resolveCategoryPair(database, row, options, warnings);
    const sourceSystem = options.markMissingInactive
      ? options.sourceSystem
      : cleanText(row.sourceSystem, 120) || options.sourceSystem;
    const now = new Date();
    const data = {
      name: row.name,
      slug,
      sku: row.sku,
      brand: brand || existing?.brand || null,
      category: category || existing?.category || null,
      description: row.description || existing?.description || null,
      price: row.price,
      stockQuantity: row.stockQuantity,
      status: row.status,
      isAvailable: row.isAvailable,
      imageUrl: row.imageUrl || existing?.imageUrl || null,
      externalProductId: row.externalProductId || existing?.externalProductId || null,
      externalStatus: row.status,
      sourceSystem,
      syncStatus: "SUCCESS",
      lastSyncedAt: now,
    };

    const product = existing
      ? await database.product.update({ where: { id: existing.id }, data })
      : await database.product.create({ data });
    return { product, created: !existing, warnings };
  });
}

function rowError(error) {
  if (error?.code === "P2002") return "A unique SKU, slug, or external product ID conflicts with another product.";
  return error instanceof Error ? error.message : "The row could not be imported.";
}

function normalizeOptions(rawOptions) {
  const options = {
    sourceSystem: cleanText(rawOptions.sourceSystem, 120) || SOURCE_DEFAULT,
    createMissingLookups: rawOptions.createMissingLookups === true,
    markMissingInactive: rawOptions.markMissingInactive === true,
  };
  if (options.markMissingInactive && !cleanText(rawOptions.sourceSystem, 120)) {
    const error = new Error("sourceSystem is required when markMissingInactive is enabled.");
    error.statusCode = 400;
    throw error;
  }
  return options;
}

async function startProductImport(options) {
  return startSync({
    entityType: SYNC_ENTITY_TYPES.PRODUCT_IMPORT,
    direction: "OWNER_TO_WEBSITE",
    sourceSystem: options.sourceSystem,
  });
}

async function runProductImport(rows, options, syncLog) {
  const { validRows, errors: validationErrors } = validateProductRows(rows);
  const errors = [...validationErrors];
  const warnings = [];
  let created = 0;
  let updated = 0;
  let markedInactive = 0;
  const importedSkus = new Set();
  const seenSkus = new Set();

  for (let index = 0; index < validRows.length; index += 1) {
    const row = validRows[index];
    const skuKey = row.sku.toLowerCase();
    if (seenSkus.has(skuKey)) {
      errors.push({ rowNumber: row.rowNumber, messages: [`Duplicate SKU ${row.sku} in this import.`] });
      continue;
    }
    seenSkus.add(skuKey);
    try {
      const result = await importRow(row, options);
      importedSkus.add(result.product.sku);
      if (result.created) created += 1;
      else updated += 1;
      result.warnings.forEach((message) => warnings.push({ rowNumber: row.rowNumber, message }));
    } catch (error) {
      errors.push({ rowNumber: row.rowNumber, messages: [rowError(error)] });
    }
  }

  if (options.markMissingInactive) {
    if (errors.length > 0) {
      warnings.push({ rowNumber: null, message: "Missing products were not marked inactive because the import contained errors." });
    } else {
      const result = await prisma.product.updateMany({
        where: {
          sourceSystem: { equals: options.sourceSystem, mode: "insensitive" },
          ...(importedSkus.size ? { sku: { notIn: [...importedSkus] } } : {}),
        },
        data: { status: "INACTIVE", isAvailable: false, syncStatus: "SUCCESS", lastSyncedAt: new Date() },
      });
      markedInactive = result.count;
    }
  }

  const processed = created + updated;
  const outcome = errors.length === 0 ? "SUCCESS" : processed > 0 ? "PARTIAL" : "FAILED";
  const summary = {
    outcome,
    recordsReceived: rows.length,
    recordsCreated: created,
    recordsUpdated: updated,
    recordsFailed: errors.length,
    recordsMarkedInactive: markedInactive,
    warnings: warnings.length,
  };
  await recordSyncResult(syncLog.id, {
    status: errors.length === 0 ? "SUCCESS" : "FAILED",
    summary,
    errorSummary: errors.slice(0, 20),
  });
  return { ...summary, errors, warnings, syncLogId: syncLog.id };
}

async function failProductImport(syncLog, error, recordsReceived = 0) {
  await recordSyncResult(syncLog.id, {
    status: "FAILED",
    summary: {
      outcome: "FAILED",
      recordsReceived,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: recordsReceived,
      recordsMarkedInactive: 0,
      warnings: 0,
    },
    errorSummary: error instanceof Error ? error.message : "Product import failed.",
  }).catch(() => {});
}

export async function importProductsFromRows(rows, rawOptions = {}) {
  const options = normalizeOptions(rawOptions);
  const syncLog = await startProductImport(options);
  try {
    return await runProductImport(rows, options, syncLog);
  } catch (error) {
    await failProductImport(syncLog, error, Array.isArray(rows) ? rows.length : 0);
    throw error;
  }
}

export async function importProductsFromCsv(csv, rawOptions = {}) {
  if (typeof csv !== "string" || !csv.trim()) {
    const error = new Error("CSV content is required.");
    error.statusCode = 400;
    throw error;
  }
  const options = normalizeOptions(rawOptions);
  const syncLog = await startProductImport(options);
  let rows;
  try {
    rows = parseCsv(csv, { maxRows: 10000 });
  } catch (cause) {
    const error = new Error(cause instanceof Error ? cause.message : "CSV could not be parsed.");
    error.statusCode = 400;
    await failProductImport(syncLog, error);
    throw error;
  }
  if (rows.length === 0) {
    const error = new Error("CSV must contain at least one product row.");
    error.statusCode = 400;
    await failProductImport(syncLog, error);
    throw error;
  }
  try {
    return await runProductImport(rows, options, syncLog);
  } catch (error) {
    await failProductImport(syncLog, error, rows.length);
    throw error;
  }
}

export function getProductImportTemplateCsv() {
  // category/subcategory use real names from the website category tree
  // (owner Excel). subcategory is optional; when both are provided the
  // subcategory must belong to the given main category.
  const sample = {
    sku: "OWNER-1001",
    name: "Sample Dental Product",
    slug: "sample-dental-product",
    brand: "Sample Brand",
    category: "Restorative",
    subcategory: "Composite",
    price: 125.5,
    stockQuantity: 40,
    status: "ACTIVE",
    isAvailable: true,
    outOfStock: false,
    imageUrl: "https://example.com/product.jpg",
    description: "Replace this sample row before import.",
    externalProductId: "1001",
    sourceSystem: "CSV_IMPORT",
  };
  return stringifyCsv([sample], PRODUCT_IMPORT_COLUMNS.map((key) => ({ key, header: key })));
}
