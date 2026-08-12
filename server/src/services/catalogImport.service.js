import { cleanText } from "../utils/records.js";
import {
  CATALOG_IMPORT_APPLY_ORDER,
  CATALOG_IMPORT_ENTITY_TYPES,
} from "./catalogImport.contract.js";
import { combinationSignature } from "./variantCatalog.service.js";

const ACTIONS_WITH_FAILURES = new Set(["CONFLICT", "ERROR"]);
/** Shared ProductStatus-shaped values, valid on Products and Variants rows alike. */
const RECORD_STATUSES = new Set(["ACTIVE", "LOW_STOCK", "OUT_OF_STOCK", "DRAFT", "INACTIVE"]);
/** Statuses an inventory-driven stock change is allowed to auto-transition between; DRAFT/INACTIVE are a deliberate admin lifecycle choice and are never overwritten by a stock sync. */
const STOCK_MANAGED_STATUSES = new Set(["ACTIVE", "LOW_STOCK", "OUT_OF_STOCK"]);

function text(value, max = 500) { return cleanText(value, max); }

/** Required numeric field: returns null when blank or invalid (caller pushes a message). */
function requiredDecimal(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : null;
}
function requiredInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}
/** Optional numeric field: blank input is a valid "absent" value; only a present-but-invalid value is an error. */
function optionalDecimal(value) {
  if (value === undefined || value === null || value === "") return { value: null, error: false };
  const number = Number(value);
  return Number.isFinite(number) && number >= 0
    ? { value: Math.round(number * 100) / 100, error: false }
    : { value: null, error: true };
}
function optionalInteger(value, fallback = null) {
  if (value === undefined || value === null || value === "") return { value: fallback, error: false };
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? { value: number, error: false } : { value: fallback, error: true };
}
function boolValue(value) {
  return value === true || String(value).trim().toLowerCase() === "true";
}
function slugify(value) {
  return text(value, 180).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function dedupeById(records) {
  return [...new Map(records.filter(Boolean).map((record) => [record.id, record])).values()];
}
function isoOrNull(date) {
  return date ? new Date(date).toISOString() : null;
}
function externalKey(sourceSystem, externalId) {
  return externalId ? `${sourceSystem}::${externalId}` : null;
}
function classifyResult(action, messages, targetId = null, targetUpdatedAt = null) {
  return { action, messages, targetId, targetUpdatedAt };
}

/**
 * Shared shape for entities matched by one or more optional identifiers
 * (Brands, Categories, Products, Variants): look each identifier up, and if
 * more than one resolves to a *different* existing record, that is a
 * CONFLICT — identifiers are never silently merged onto a single record.
 */
async function classifyByIdentifiers(database, model, matchWheres, isUnchanged) {
  const found = await Promise.all(
    matchWheres.map((where) => (where ? database[model].findFirst({ where }) : null))
  );
  const matches = dedupeById(found);
  if (matches.length > 1) {
    return classifyResult("CONFLICT", ["More than one identifier matches a different existing record."]);
  }
  const target = matches[0] ?? null;
  if (!target) return classifyResult("CREATE", []);
  return classifyResult(isUnchanged(target) ? "SKIP" : "UPDATE", [], target.id, isoOrNull(target.updatedAt));
}

// ---------------------------------------------------------------------------
// Normalize: raw row -> canonical payload + validation messages
// ---------------------------------------------------------------------------

function normalizeProduct(row, sourceSystem) {
  const price = requiredDecimal(row.price);
  const salePriceProvided = row.salePrice !== undefined && row.salePrice !== null && row.salePrice !== "";
  const salePriceResult = optionalDecimal(row.salePrice);
  const nameArProvided = row.nameAr !== undefined && row.nameAr !== null && row.nameAr !== "";
  const imageUrlProvided = row.imageUrl !== undefined && row.imageUrl !== null && row.imageUrl !== "";
  const stockQuantity = requiredInteger(row.stockQuantity ?? row.stock);
  const status = text(row.status ?? row.recordStatus, 50).toUpperCase() || null;
  const payload = {
    externalProductId: text(row.externalProductId ?? row.externalId, 200) || null,
    sku: text(row.sku ?? row.SKU, 120),
    slug: slugify(row.slug),
    name: text(row.name ?? row.nameEn, 200),
    nameAr: text(row.nameAr, 200) || null,
    nameArProvided,
    price,
    salePrice: salePriceResult.value,
    salePriceProvided,
    stockQuantity,
    description: text(row.description ?? row.longDescription, 4000) || null,
    descriptionAr: text(row.descriptionAr ?? row.longDescriptionAr, 4000) || null,
    shortDescription: text(row.shortDescription ?? row.shortDescriptionEn, 1000) || null,
    shortDescriptionAr: text(row.shortDescriptionAr, 1000) || null,
    // Optional, like salePrice: a row that never mentions imageUrl must not
    // erase an image a different pipeline (or a prior import) already set.
    imageUrl: text(row.imageUrl, 1000) || null,
    imageUrlProvided,
    sourceSystem,
    brandExternalId: text(row.brandExternalId ?? row.brandId, 200) || null,
    brandName: text(row.brandName ?? row.brand, 150) || null,
    categoryExternalId: text(row.categoryExternalId ?? row.categoryId, 200) || null,
    categoryName: text(row.categoryName ?? row.category, 150) || null,
    categorySlug: slugify(row.categorySlug) || null,
    // Optional: when absent (every existing JSON import), status/isAvailable stay
    // fully stock-derived, exactly as before. When present, an explicit
    // DRAFT/INACTIVE status is a deliberate lifecycle choice and is preserved
    // instead of being overridden by stock-derived ACTIVE/OUT_OF_STOCK.
    status,
  };
  const messages = [];
  if (!payload.sku) messages.push("sku is required.");
  if (!payload.name) messages.push("name is required.");
  if (price === null) messages.push("price must be a non-negative number.");
  if (salePriceResult.error) messages.push("salePrice must be a non-negative number.");
  if (salePriceProvided && !salePriceResult.error && price !== null
    && (!(salePriceResult.value > 0) || salePriceResult.value >= price)) {
    messages.push("salePrice must be positive and lower than price.");
  }
  if (stockQuantity === null) messages.push("stockQuantity must be a non-negative whole number.");
  if (status && !RECORD_STATUSES.has(status)) messages.push("status is invalid.");
  return { payload, messages };
}

function normalizeBrand(row, sourceSystem) {
  const payload = {
    externalBrandId: text(row.externalBrandId ?? row.brandId ?? row.externalId, 200) || null,
    name: text(row.name ?? row.nameEn, 150),
    country: text(row.country, 100) || null,
    logoUrl: text(row.logoUrl, 1000) || null,
    description: text(row.description, 2000) || null,
    sourceSystem,
  };
  const messages = [];
  if (!payload.externalBrandId) messages.push("externalBrandId is required.");
  if (!payload.name) messages.push("name is required.");
  return { payload, messages };
}

function normalizeCategory(row, sourceSystem) {
  const payload = {
    externalCategoryId: text(row.externalCategoryId ?? row.categoryId ?? row.externalId, 200) || null,
    name: text(row.name ?? row.nameEn, 150),
    nameAr: text(row.nameAr, 150) || null,
    description: text(row.description, 2000) || null,
    // Optional: blank means top-level. Resolved against sourceSystem+externalCategoryId
    // of another Categories row (this batch or the database) — never a raw DB id.
    parentExternalCategoryId: text(row.parentExternalCategoryId ?? row.parentCategoryId, 200) || null,
    sourceSystem,
  };
  const messages = [];
  if (!payload.externalCategoryId) messages.push("externalCategoryId is required.");
  if (!payload.name) messages.push("name is required.");
  return { payload, messages };
}

function normalizeProductOption(row, sourceSystem) {
  const sortOrder = optionalInteger(row.sortOrder, 0);
  const payload = {
    productExternalId: text(row.productExternalId ?? row.externalProductId, 200) || null,
    code: text(row.code ?? row.optionCode, 80).toUpperCase(),
    nameEn: text(row.nameEn ?? row.name, 160),
    nameAr: text(row.nameAr, 160) || null,
    sortOrder: sortOrder.value ?? 0,
    sourceSystem,
  };
  const messages = [];
  if (!payload.productExternalId) messages.push("productExternalId is required.");
  if (!payload.code) messages.push("code is required.");
  if (!payload.nameEn) messages.push("nameEn is required.");
  if (sortOrder.error) messages.push("sortOrder must be a non-negative whole number.");
  return { payload, messages };
}

function normalizeOptionValue(row, sourceSystem) {
  const sortOrder = optionalInteger(row.sortOrder, 0);
  const payload = {
    productExternalId: text(row.productExternalId ?? row.externalProductId, 200) || null,
    optionCode: text(row.optionCode ?? row.option, 80).toUpperCase(),
    code: text(row.code ?? row.valueCode, 80).toUpperCase(),
    valueEn: text(row.valueEn ?? row.value ?? row.name, 160),
    valueAr: text(row.valueAr, 160) || null,
    displayHex: text(row.displayHex, 20) || null,
    sortOrder: sortOrder.value ?? 0,
    sourceSystem,
  };
  const messages = [];
  if (!payload.productExternalId) messages.push("productExternalId is required.");
  if (!payload.optionCode) messages.push("optionCode is required.");
  if (!payload.code) messages.push("code is required.");
  if (!payload.valueEn) messages.push("valueEn is required.");
  if (sortOrder.error) messages.push("sortOrder must be a non-negative whole number.");
  return { payload, messages };
}

function normalizeVariant(row, sourceSystem) {
  const stockQuantity = requiredInteger(row.stockQuantity ?? row.stock);
  const priceOverride = optionalDecimal(row.priceOverride ?? row.price);
  const status = text(row.status, 50).toUpperCase() || "ACTIVE";
  const payload = {
    externalVariantId: text(row.externalVariantId ?? row.variantId ?? row.externalId, 200) || null,
    sku: text(row.sku ?? row.variantSku, 120) || null,
    barcode: text(row.barcode ?? row.ean ?? row.upc, 120) || null,
    productExternalId: text(row.productExternalId ?? row.externalProductId, 200) || null,
    stockQuantity,
    priceOverride: priceOverride.value,
    nameEn: text(row.nameEn, 200) || null,
    nameAr: text(row.nameAr, 200) || null,
    status,
    sourceSystem,
  };
  const messages = [];
  if (!payload.productExternalId) messages.push("productExternalId is required.");
  if (stockQuantity === null) messages.push("stockQuantity must be a non-negative whole number.");
  if (priceOverride.error) messages.push("priceOverride must be a non-negative number.");
  if (!RECORD_STATUSES.has(status)) messages.push("status is invalid.");
  if (!payload.externalVariantId && !payload.sku && !payload.barcode) {
    messages.push("At least one of externalVariantId, sku, or barcode is required to identify the variant.");
  }
  return { payload, messages };
}

function normalizeVariantOptionValue(row, sourceSystem) {
  const payload = {
    externalVariantId: text(row.externalVariantId ?? row.variantId, 200) || null,
    optionCode: text(row.optionCode ?? row.option, 80).toUpperCase(),
    valueCode: text(row.valueCode ?? row.value, 80).toUpperCase(),
    sourceSystem,
  };
  const messages = [];
  if (!payload.externalVariantId) messages.push("externalVariantId is required.");
  if (!payload.optionCode) messages.push("optionCode is required.");
  if (!payload.valueCode) messages.push("valueCode is required.");
  return { payload, messages };
}

function validUrl(value) {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol); } catch { return false; }
}

function normalizeImage(row, sourceSystem) {
  const sortOrder = optionalInteger(row.sortOrder, 0);
  const rightsConfirmed = boolValue(row.rightsConfirmed ?? row.rights);
  const payload = {
    productExternalId: text(row.productExternalId ?? row.externalProductId, 200) || null,
    externalVariantId: text(row.externalVariantId ?? row.variantId, 200) || null,
    url: text(row.url ?? row.imageUrl, 1000),
    sourceUrl: text(row.sourceUrl ?? row.source, 1000) || null,
    rightsConfirmed,
    isPrimary: boolValue(row.isPrimary),
    sortOrder: sortOrder.value ?? 0,
    sourceSystem,
  };
  const messages = [];
  if (!payload.productExternalId) messages.push("productExternalId is required.");
  if (!payload.url || !validUrl(payload.url)) messages.push("url must be a valid http(s) URL.");
  if (!rightsConfirmed) messages.push("Image rights are unconfirmed; it will be stored as a non-public review record.");
  if (sortOrder.error) messages.push("sortOrder must be a non-negative whole number.");
  return { payload, messages };
}

function normalizeInventory(row, sourceSystem) {
  const stockQuantity = requiredInteger(row.stockQuantity ?? row.stock ?? row.available);
  const payload = {
    productExternalId: text(row.productExternalId ?? row.externalProductId, 200) || null,
    externalVariantId: text(row.externalVariantId ?? row.variantId, 200) || null,
    stockQuantity,
    sourceSystem,
  };
  const messages = [];
  if (!payload.productExternalId && !payload.externalVariantId) {
    messages.push("Either productExternalId or externalVariantId is required.");
  }
  if (payload.productExternalId && payload.externalVariantId) {
    messages.push("Only one of productExternalId or externalVariantId may be set on an Inventory row, not both.");
  }
  if (stockQuantity === null) messages.push("stockQuantity must be a non-negative whole number.");
  return { payload, messages };
}

const NORMALIZERS = {
  PRODUCTS: normalizeProduct,
  BRANDS: normalizeBrand,
  CATEGORIES: normalizeCategory,
  PRODUCT_OPTIONS: normalizeProductOption,
  OPTION_VALUES: normalizeOptionValue,
  VARIANTS: normalizeVariant,
  VARIANT_OPTION_VALUES: normalizeVariantOptionValue,
  IMAGES: normalizeImage,
  INVENTORY: normalizeInventory,
};

// ---------------------------------------------------------------------------
// Preview classification. `known` accumulates identifiers this same preview
// batch will create, so a dependent row (e.g. a Variant referencing a
// Product created earlier in the same payload) is not falsely flagged as
// missing — it mirrors exactly what apply() will see once it reaches that
// row inside the same ordered transaction.
// ---------------------------------------------------------------------------

function createKnownRegistry() {
  return {
    BRANDS: new Map(),
    CATEGORIES: new Map(),
    PRODUCTS: new Map(),
    PRODUCT_OPTIONS: new Map(),
    VARIANTS: new Map(),
  };
}

/**
 * Shared external-ID-first match for a Product's optional Brand/Category
 * reference. The external id is a stable, sourceSystem-independent catalogue
 * key — a batch's declared sourceSystem is only import lineage metadata, not
 * a scoping key — so a product imported under one sourceSystem still links to
 * a Brand/Category created under a different one (or none). Falls back to an
 * exact normalized name (Categories: name OR slug) match only when the row
 * supplied no external id at all. More than one match is always ambiguous:
 * never resolved by guessing, never auto-created.
 */
async function matchReference(database, model, externalIdField, { externalId, name, slug }) {
  if (externalId) {
    const matches = await database[model].findMany({ where: { [externalIdField]: externalId } });
    if (matches.length > 1) return { status: "AMBIGUOUS" };
    if (matches.length === 1) return { status: "FOUND", record: matches[0] };
    return { status: "NOT_FOUND" };
  }
  if (name || slug) {
    const wheres = [];
    if (name) wheres.push({ name: { equals: name, mode: "insensitive" } });
    if (slug) wheres.push({ slug });
    const found = await Promise.all(wheres.map((where) => database[model].findMany({ where })));
    const matches = dedupeById(found.flat());
    if (matches.length > 1) return { status: "AMBIGUOUS" };
    if (matches.length === 1) return { status: "FOUND", record: matches[0] };
    return { status: "NOT_FOUND" };
  }
  return { status: "ABSENT" };
}

/** Resolves a Product row's brand reference against this same preview batch, then the database. */
async function resolveProductBrand(database, known, payload) {
  const key = payload.brandExternalId ? externalKey(payload.sourceSystem, payload.brandExternalId) : null;
  if (key && known.BRANDS.has(key)) return { status: "FOUND", record: known.BRANDS.get(key) };
  return matchReference(database, "brand", "externalBrandId", { externalId: payload.brandExternalId, name: payload.brandName });
}

/** Resolves a Product row's category reference against this same preview batch, then the database. */
async function resolveProductCategory(database, known, payload) {
  const key = payload.categoryExternalId ? externalKey(payload.sourceSystem, payload.categoryExternalId) : null;
  if (key && known.CATEGORIES.has(key)) return { status: "FOUND", record: known.CATEGORIES.get(key) };
  return matchReference(database, "category", "externalCategoryId", { externalId: payload.categoryExternalId, name: payload.categoryName, slug: payload.categorySlug });
}

/** Resolves a category referenced by external id against DB state or this same preview batch. Used for CATEGORIES-row parent linkage, which (unlike a Product's own brand/category) is always scoped to this same import's sourceSystem+externalCategoryId. */
async function resolveKnownCategory(database, known, sourceSystem, categoryExternalId) {
  const key = externalKey(sourceSystem, categoryExternalId);
  if (key && known.CATEGORIES.has(key)) return known.CATEGORIES.get(key);
  const category = categoryExternalId
    ? await database.category.findFirst({ where: { sourceSystem, externalCategoryId: categoryExternalId } })
    : null;
  return category ? { id: category.id } : null;
}

async function classifyProduct(database, known, payload, messages) {
  if (messages.length) return classifyResult("ERROR", messages);
  const referenceErrors = [];
  if (payload.brandExternalId || payload.brandName) {
    const result = await resolveProductBrand(database, known, payload);
    const label = payload.brandExternalId ? `brandExternalId "${payload.brandExternalId}"` : `brand name "${payload.brandName}"`;
    if (result.status === "NOT_FOUND") referenceErrors.push(`${label} was not found in the database or earlier in this import.`);
    else if (result.status === "AMBIGUOUS") referenceErrors.push(`${label} matches more than one brand; resolve the conflict before importing.`);
  }
  if (payload.categoryExternalId || payload.categoryName || payload.categorySlug) {
    const result = await resolveProductCategory(database, known, payload);
    const label = payload.categoryExternalId ? `categoryExternalId "${payload.categoryExternalId}"` : `category "${payload.categoryName || payload.categorySlug}"`;
    if (result.status === "NOT_FOUND") referenceErrors.push(`${label} was not found in the database or earlier in this import.`);
    else if (result.status === "AMBIGUOUS") referenceErrors.push(`${label} matches more than one category; resolve the conflict before importing.`);
  }
  if (referenceErrors.length) return classifyResult("ERROR", referenceErrors);
  return classifyByIdentifiers(
    database,
    "product",
    [
      payload.externalProductId ? { sourceSystem: payload.sourceSystem, externalProductId: payload.externalProductId } : null,
      { sku: { equals: payload.sku, mode: "insensitive" } },
      payload.slug ? { slug: payload.slug } : null,
    ],
    (target) =>
      target.name === payload.name
      && (!payload.nameArProvided || (target.nameAr ?? null) === payload.nameAr)
      && Number(target.price) === payload.price
      && (!payload.salePriceProvided || Number(target.salePrice) === payload.salePrice)
      && target.stockQuantity === payload.stockQuantity
      && target.slug === (payload.slug || target.slug)
      && (target.description ?? null) === payload.description
      && (target.descriptionAr ?? null) === payload.descriptionAr
      && (target.shortDescription ?? null) === payload.shortDescription
      && (target.shortDescriptionAr ?? null) === payload.shortDescriptionAr
      && (!payload.imageUrlProvided || (target.imageUrl ?? null) === payload.imageUrl)
      && (payload.status === null || target.status === payload.status)
  );
}

async function classifyBrand(database, payload, messages) {
  if (messages.length) return classifyResult("ERROR", messages);
  return classifyByIdentifiers(
    database,
    "brand",
    [
      { sourceSystem: payload.sourceSystem, externalBrandId: payload.externalBrandId },
      { name: { equals: payload.name, mode: "insensitive" } },
    ],
    (target) =>
      target.name === payload.name
      && (target.country ?? null) === payload.country
      && (target.logoUrl ?? null) === payload.logoUrl
      && (target.description ?? null) === payload.description
  );
}

async function classifyCategory(database, known, payload, messages) {
  if (messages.length) return classifyResult("ERROR", messages);
  if (payload.parentExternalCategoryId) {
    if (payload.parentExternalCategoryId === payload.externalCategoryId) {
      return classifyResult("ERROR", ["A category cannot be its own parent."]);
    }
    const parent = await resolveKnownCategory(database, known, payload.sourceSystem, payload.parentExternalCategoryId);
    if (!parent) {
      return classifyResult("ERROR", [`parentExternalCategoryId "${payload.parentExternalCategoryId}" was not found in the database or earlier in this import.`]);
    }
  }
  return classifyByIdentifiers(
    database,
    "category",
    [
      { sourceSystem: payload.sourceSystem, externalCategoryId: payload.externalCategoryId },
      { name: { equals: payload.name, mode: "insensitive" } },
    ],
    (target) =>
      target.name === payload.name
      && (target.nameAr ?? null) === payload.nameAr
      && (target.description ?? null) === payload.description
  );
}

/** Resolves a product referenced by external id against DB state or this same preview batch. */
async function resolveKnownProduct(database, known, sourceSystem, productExternalId) {
  const key = externalKey(sourceSystem, productExternalId);
  if (key && known.PRODUCTS.has(key)) return known.PRODUCTS.get(key);
  const product = productExternalId
    ? await database.product.findFirst({ where: { sourceSystem, externalProductId: productExternalId } })
    : null;
  return product ? { id: product.id, updatedAt: product.updatedAt } : null;
}

async function classifyProductOption(database, known, payload, messages) {
  if (messages.length) return classifyResult("ERROR", messages);
  const product = await resolveKnownProduct(database, known, payload.sourceSystem, payload.productExternalId);
  if (!product) return classifyResult("ERROR", [`productExternalId "${payload.productExternalId}" was not found in the database or earlier in this import.`]);
  if (!product.id) return classifyResult("CREATE", []); // parent product is itself pending creation
  const existing = await database.productOption.findFirst({ where: { productId: product.id, code: payload.code } });
  if (!existing) return classifyResult("CREATE", []);
  const unchanged = existing.nameEn === payload.nameEn && (existing.nameAr ?? null) === payload.nameAr && existing.sortOrder === payload.sortOrder;
  return classifyResult(unchanged ? "SKIP" : "UPDATE", [], existing.id, isoOrNull(existing.updatedAt));
}

async function classifyOptionValue(database, known, payload, messages) {
  if (messages.length) return classifyResult("ERROR", messages);
  const product = await resolveKnownProduct(database, known, payload.sourceSystem, payload.productExternalId);
  if (!product) return classifyResult("ERROR", [`productExternalId "${payload.productExternalId}" was not found in the database or earlier in this import.`]);
  // Keyed by external identifiers, not product.id: the option row for this same
  // product may appear earlier in this same batch and not exist in the
  // database yet (preview never writes catalog rows), so an id-based lookup
  // would wrongly miss it.
  const optionKey = `${externalKey(payload.sourceSystem, payload.productExternalId)}::${payload.optionCode}`;
  const knownOption = known.PRODUCT_OPTIONS.get(optionKey);
  const option = knownOption
    ?? (product.id ? await database.productOption.findFirst({ where: { productId: product.id, code: payload.optionCode } }) : null);
  if (!option) return classifyResult("ERROR", [`optionCode "${payload.optionCode}" was not found for this product.`]);
  if (!option.id) return classifyResult("CREATE", []); // parent option is itself pending creation
  const existing = await database.productOptionValue.findFirst({ where: { optionId: option.id, code: payload.code } });
  if (!existing) return classifyResult("CREATE", []);
  const unchanged = existing.valueEn === payload.valueEn
    && (existing.valueAr ?? null) === payload.valueAr
    && (existing.displayHex ?? null) === payload.displayHex
    && existing.sortOrder === payload.sortOrder;
  return classifyResult(unchanged ? "SKIP" : "UPDATE", [], existing.id, isoOrNull(existing.updatedAt));
}

async function classifyVariant(database, known, payload, messages) {
  if (messages.length) return classifyResult("ERROR", messages);
  const product = await resolveKnownProduct(database, known, payload.sourceSystem, payload.productExternalId);
  if (!product) return classifyResult("ERROR", [`productExternalId "${payload.productExternalId}" was not found in the database or earlier in this import.`]);
  const result = await classifyByIdentifiers(
    database,
    "productVariant",
    [
      payload.externalVariantId ? { sourceSystem: payload.sourceSystem, externalVariantId: payload.externalVariantId } : null,
      payload.sku ? { sku: payload.sku } : null,
      payload.barcode ? { barcode: payload.barcode } : null,
    ],
    (target) =>
      (target.sku ?? null) === payload.sku
      && (target.barcode ?? null) === payload.barcode
      && target.stockQuantity === payload.stockQuantity
      && (target.priceOverride === null ? null : Number(target.priceOverride)) === payload.priceOverride
      && target.status === payload.status
  );
  if (result.action !== "CONFLICT" && result.action !== "ERROR" && result.targetId && product.id) {
    const owner = await database.productVariant.findUnique({ where: { id: result.targetId }, select: { productId: true } });
    if (owner && owner.productId !== product.id) {
      return classifyResult("CONFLICT", ["This variant identifier already belongs to a different product."]);
    }
  }
  return result;
}

/** Resolves a variant referenced by external id against DB state or this same preview batch. */
async function resolveKnownVariant(database, known, sourceSystem, externalVariantId) {
  const key = externalKey(sourceSystem, externalVariantId);
  if (key && known.VARIANTS.has(key)) return known.VARIANTS.get(key);
  const variant = externalVariantId
    ? await database.productVariant.findFirst({ where: { sourceSystem, externalVariantId } })
    : null;
  return variant ? { id: variant.id, productId: variant.productId, updatedAt: variant.updatedAt } : null;
}

async function classifyVariantOptionValue(database, known, payload, messages) {
  if (messages.length) return classifyResult("ERROR", messages);
  const variant = await resolveKnownVariant(database, known, payload.sourceSystem, payload.externalVariantId);
  if (!variant) return classifyResult("ERROR", [`externalVariantId "${payload.externalVariantId}" was not found in the database or earlier in this import.`]);
  if (!variant.id || !variant.productId) return classifyResult("CREATE", []); // parent variant is itself pending creation
  const option = await database.productOption.findFirst({ where: { productId: variant.productId, code: payload.optionCode } });
  if (!option) return classifyResult("ERROR", [`optionCode "${payload.optionCode}" was not found for this variant's product.`]);
  const value = await database.productOptionValue.findFirst({ where: { optionId: option.id, code: payload.valueCode } });
  if (!value) return classifyResult("ERROR", [`valueCode "${payload.valueCode}" was not found for option "${payload.optionCode}".`]);
  const existing = await database.productVariantOptionValue.findFirst({ where: { variantId: variant.id, optionId: option.id } });
  if (!existing) return classifyResult("CREATE", []);
  return classifyResult(existing.optionValueId === value.id ? "SKIP" : "UPDATE", []);
}

/** The rights-unconfirmed note is informational (row still imports, just non-public); every other message blocks the row. */
function isBlockingImageMessage(message) {
  return !message.startsWith("Image rights are unconfirmed");
}

async function classifyImage(database, known, payload, messages) {
  if (messages.some(isBlockingImageMessage)) return classifyResult("ERROR", messages);
  const product = await resolveKnownProduct(database, known, payload.sourceSystem, payload.productExternalId);
  if (!product) return classifyResult("ERROR", [...messages, `productExternalId "${payload.productExternalId}" was not found in the database or earlier in this import.`]);
  const variant = payload.externalVariantId
    ? await resolveKnownVariant(database, known, payload.sourceSystem, payload.externalVariantId)
    : null;
  if (payload.externalVariantId && !variant) {
    return classifyResult("ERROR", [...messages, `externalVariantId "${payload.externalVariantId}" was not found in the database or earlier in this import.`]);
  }
  if (!product.id || (variant && !variant.id)) return classifyResult("CREATE", messages); // parent is itself pending creation
  const existing = await database.productImage.findFirst({ where: { productId: product.id, variantId: variant?.id ?? null, url: payload.url } });
  return classifyResult(existing ? "SKIP" : "CREATE", messages, existing?.id ?? null);
}

async function classifyInventory(database, known, payload, messages) {
  if (messages.length) return classifyResult("ERROR", messages);
  if (payload.externalVariantId) {
    const variant = await resolveKnownVariant(database, known, payload.sourceSystem, payload.externalVariantId);
    if (!variant) return classifyResult("ERROR", [`externalVariantId "${payload.externalVariantId}" was not found in the database or earlier in this import.`]);
    if (!variant.id) return classifyResult("UPDATE", []); // parent variant is itself pending creation; stock applies right after
    const current = await database.productVariant.findUnique({ where: { id: variant.id }, select: { stockQuantity: true, updatedAt: true } });
    return classifyResult(current.stockQuantity === payload.stockQuantity ? "SKIP" : "UPDATE", [], variant.id, isoOrNull(current.updatedAt));
  }
  const product = await resolveKnownProduct(database, known, payload.sourceSystem, payload.productExternalId);
  if (!product) return classifyResult("ERROR", [`productExternalId "${payload.productExternalId}" was not found in the database or earlier in this import.`]);
  if (!product.id) return classifyResult("UPDATE", []);
  const current = await database.product.findUnique({ where: { id: product.id }, select: { stockQuantity: true, updatedAt: true } });
  return classifyResult(current.stockQuantity === payload.stockQuantity ? "SKIP" : "UPDATE", [], product.id, isoOrNull(current.updatedAt));
}

async function classifyRow(database, known, entityType, payload, messages) {
  switch (entityType) {
    case "PRODUCTS": return classifyProduct(database, known, payload, messages);
    case "BRANDS": return classifyBrand(database, payload, messages);
    case "CATEGORIES": return classifyCategory(database, known, payload, messages);
    case "PRODUCT_OPTIONS": return classifyProductOption(database, known, payload, messages);
    case "OPTION_VALUES": return classifyOptionValue(database, known, payload, messages);
    case "VARIANTS": return classifyVariant(database, known, payload, messages);
    case "VARIANT_OPTION_VALUES": return classifyVariantOptionValue(database, known, payload, messages);
    case "IMAGES": return classifyImage(database, known, payload, messages);
    case "INVENTORY": return classifyInventory(database, known, payload, messages);
    default: return classifyResult("ERROR", [`Unsupported entity type: ${entityType}.`]);
  }
}

/** Registers a classified row's identifiers so later rows in the same preview see it as resolvable. */
async function registerKnown(database, known, entityType, payload, result) {
  if (ACTIONS_WITH_FAILURES.has(result.action)) return;
  if (entityType === "BRANDS") {
    const key = externalKey(payload.sourceSystem, payload.externalBrandId);
    if (key) known.BRANDS.set(key, { id: result.targetId });
  } else if (entityType === "CATEGORIES") {
    const key = externalKey(payload.sourceSystem, payload.externalCategoryId);
    if (key) known.CATEGORIES.set(key, { id: result.targetId, parentExternalCategoryId: payload.parentExternalCategoryId ?? null });
  } else if (entityType === "PRODUCTS") {
    const key = externalKey(payload.sourceSystem, payload.externalProductId);
    if (key) known.PRODUCTS.set(key, { id: result.targetId });
  } else if (entityType === "PRODUCT_OPTIONS") {
    // Keyed by external product id, not the resolved product.id: the parent
    // product may be pre-existing (not part of this batch's PRODUCTS rows)
    // and this lookup must succeed either way.
    const key = `${externalKey(payload.sourceSystem, payload.productExternalId)}::${payload.code}`;
    known.PRODUCT_OPTIONS.set(key, { id: result.targetId });
  } else if (entityType === "VARIANTS") {
    const key = externalKey(payload.sourceSystem, payload.externalVariantId);
    if (key) {
      const product = await resolveKnownProduct(database, known, payload.sourceSystem, payload.productExternalId);
      known.VARIANTS.set(key, { id: result.targetId, productId: product?.id ?? null });
    }
  }
}

/**
 * Finds two variants of the same parent product that would resolve to an
 * identical complete option-value combination — whether the duplicate is
 * introduced entirely within this batch, between two VARIANT_OPTION_VALUES
 * rows, or between a batch row and an existing (batch-untouched) database
 * variant. A batch row only ever replaces the one option dimension it names
 * (mirroring applyVariantOptionValueRow), so a touched variant's full
 * combination is its existing database pairs with this batch's pairs merged
 * on top. Downgrades every VARIANT_OPTION_VALUES row for every variant
 * involved in a duplicate to CONFLICT, in place; makes no catalog mutation.
 */
async function detectDuplicateCombinations(database, known, rows) {
  const combinationRows = rows.filter(
    (row) => row.entityType === "VARIANT_OPTION_VALUES" && !ACTIONS_WITH_FAILURES.has(row.action)
  );
  if (combinationRows.length === 0) return;

  const byVariantKey = new Map();
  for (const row of combinationRows) {
    const payload = row.normalizedPayload;
    const key = externalKey(payload.sourceSystem, payload.externalVariantId);
    if (!byVariantKey.has(key)) {
      byVariantKey.set(key, { sourceSystem: payload.sourceSystem, externalVariantId: payload.externalVariantId, pairs: new Map(), rows: [] });
    }
    const entry = byVariantKey.get(key);
    entry.pairs.set(payload.optionCode, payload.valueCode);
    entry.rows.push(row);
  }

  const touchedByProduct = new Map();
  for (const [variantKey, entry] of byVariantKey) {
    const resolvedVariant = await resolveKnownVariant(database, known, entry.sourceSystem, entry.externalVariantId);
    const variantRow = rows.find(
      (row) => row.entityType === "VARIANTS"
        && externalKey(row.normalizedPayload.sourceSystem, row.normalizedPayload.externalVariantId) === variantKey
    );
    const productExternalId = variantRow?.normalizedPayload.productExternalId ?? null;
    let productId = resolvedVariant?.productId ?? null;
    if (!productId && productExternalId) {
      const product = await resolveKnownProduct(database, known, entry.sourceSystem, productExternalId);
      productId = product?.id ?? null;
    }
    const productKey = productId ? `id:${productId}` : productExternalId ? `ext:${externalKey(entry.sourceSystem, productExternalId)}` : null;
    if (!productKey) continue; // no resolvable product scope; the row already carries its own error from classification

    const mergedPairs = new Map();
    if (resolvedVariant?.id) {
      const dbVariant = await database.productVariant.findUnique({
        where: { id: resolvedVariant.id },
        include: { selections: { include: { option: true, optionValue: true } } },
      });
      for (const selection of dbVariant?.selections ?? []) {
        if (selection.option?.code && selection.optionValue?.code) mergedPairs.set(selection.option.code, selection.optionValue.code);
      }
    }
    for (const [optionCode, valueCode] of entry.pairs) mergedPairs.set(optionCode, valueCode);
    const signature = combinationSignature([...mergedPairs].map(([optionCode, valueCode]) => ({ optionCode, valueCode })));
    if (!signature) continue;

    if (!touchedByProduct.has(productKey)) touchedByProduct.set(productKey, []);
    touchedByProduct.get(productKey).push({ dbVariantId: resolvedVariant?.id ?? null, productId, signature, rows: entry.rows });
  }

  for (const touchedVariants of touchedByProduct.values()) {
    const productId = touchedVariants.find((entry) => entry.productId)?.productId ?? null;

    const existingSignatures = new Set();
    if (productId) {
      const touchedIds = touchedVariants.map((entry) => entry.dbVariantId).filter(Boolean);
      const others = await database.productVariant.findMany({
        where: { productId, ...(touchedIds.length ? { id: { notIn: touchedIds } } : {}) },
        include: { selections: { include: { option: true, optionValue: true } } },
      });
      for (const variant of others) {
        const pairs = (variant.selections ?? [])
          .filter((selection) => selection.option?.code && selection.optionValue?.code)
          .map((selection) => ({ optionCode: selection.option.code, valueCode: selection.optionValue.code }));
        if (pairs.length) existingSignatures.add(combinationSignature(pairs));
      }
    }

    const countInBatch = new Map();
    for (const touched of touchedVariants) countInBatch.set(touched.signature, (countInBatch.get(touched.signature) ?? 0) + 1);

    for (const touched of touchedVariants) {
      const isDuplicate = existingSignatures.has(touched.signature) || countInBatch.get(touched.signature) > 1;
      if (!isDuplicate) continue;
      const message = `Duplicate variant combination for this product: ${touched.signature}`;
      for (const row of touched.rows) {
        row.action = "CONFLICT";
        if (!row.validationMessages.includes(message)) row.validationMessages.push(message);
      }
    }
  }
}

/**
 * Batch-local circular-parent check: walks each Categories row's own parent
 * chain using only this batch's rows, and flags a row whose chain leads back
 * to itself. A cycle that only completes through pre-existing database
 * categories (not visible from this batch's rows alone) is instead caught by
 * apply's last line of defense (assertNoCategoryCycles), which walks the
 * real, just-committed parentId pointers — mirroring how duplicate variant
 * combinations get both a preview-time and an apply-time check.
 */
function detectCategoryCycles(rows) {
  const categoryRows = rows.filter((row) => row.entityType === "CATEGORIES" && !ACTIONS_WITH_FAILURES.has(row.action));
  if (categoryRows.length === 0) return;

  const parentByExternalId = new Map();
  for (const row of categoryRows) {
    const payload = row.normalizedPayload;
    if (payload.externalCategoryId) parentByExternalId.set(payload.externalCategoryId, payload.parentExternalCategoryId ?? null);
  }

  for (const row of categoryRows) {
    const payload = row.normalizedPayload;
    if (!payload.externalCategoryId || !payload.parentExternalCategoryId) continue;
    const guard = new Set([payload.externalCategoryId]);
    let current = payload.parentExternalCategoryId;
    while (current) {
      if (guard.has(current)) {
        row.action = "CONFLICT";
        const message = `Circular category hierarchy: "${payload.externalCategoryId}" cannot be nested (directly or indirectly) under "${payload.parentExternalCategoryId}".`;
        if (!row.validationMessages.includes(message)) row.validationMessages.push(message);
        break;
      }
      guard.add(current);
      if (!parentByExternalId.has(current)) break; // parent isn't part of this batch; apply-time check covers the rest
      current = parentByExternalId.get(current);
    }
  }
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

export async function previewCatalogImport(database, { sourceSystem, filename = null, entities, createdById = null }) {
  const source = text(sourceSystem, 120);
  if (!source) throw Object.assign(new Error("sourceSystem is required."), { statusCode: 400 });
  if (!entities || typeof entities !== "object" || Array.isArray(entities)) {
    throw Object.assign(new Error("entities must be an object keyed by supported entity type."), { statusCode: 400 });
  }
  for (const entityType of Object.keys(entities)) {
    if (!CATALOG_IMPORT_ENTITY_TYPES.includes(entityType)) {
      throw Object.assign(new Error(`Unsupported entity type: ${entityType}.`), { statusCode: 400 });
    }
    if (!Array.isArray(entities[entityType])) {
      throw Object.assign(new Error(`${entityType} must be an array.`), { statusCode: 400 });
    }
  }

  const known = createKnownRegistry();
  const rows = [];
  for (const entityType of CATALOG_IMPORT_APPLY_ORDER) {
    const entityRows = entities[entityType];
    if (!Array.isArray(entityRows)) continue;
    for (let index = 0; index < entityRows.length; index += 1) {
      const row = entityRows[index] && typeof entityRows[index] === "object" ? entityRows[index] : {};
      const { payload, messages } = NORMALIZERS[entityType](row, source);
      const result = await classifyRow(database, known, entityType, payload, messages);
      await registerKnown(database, known, entityType, payload, result);
      rows.push({
        entityType,
        rowNumber: index + 2,
        externalId: payload.externalProductId ?? payload.externalBrandId ?? payload.externalCategoryId ?? payload.externalVariantId ?? null,
        sku: payload.sku ?? null,
        action: result.action,
        validationMessages: result.messages,
        normalizedPayload: { ...payload, targetId: result.targetId, targetUpdatedAt: result.targetUpdatedAt },
      });
    }
  }

  await detectDuplicateCombinations(database, known, rows);
  detectCategoryCycles(rows);

  const summary = {
    totalRows: rows.length,
    validRows: rows.filter((row) => !ACTIONS_WITH_FAILURES.has(row.action)).length,
    warningRows: rows.filter((row) => row.validationMessages.length > 0 && !ACTIONS_WITH_FAILURES.has(row.action)).length,
    errorRows: rows.filter((row) => ACTIONS_WITH_FAILURES.has(row.action)).length,
  };
  const batch = await database.catalogImportBatch.create({
    data: { sourceSystem: source, filename: text(filename, 300) || null, dryRun: true, createdById, ...summary, rows: { create: rows } },
    include: { rows: { orderBy: [{ entityType: "asc" }, { rowNumber: "asc" }] } },
  });
  return { batch, summary };
}

// ---------------------------------------------------------------------------
// Apply — re-resolves every reference against the live transaction, so rows
// created earlier in this same call (e.g. a brand a product now points to)
// are visible to the rows that depend on them.
// ---------------------------------------------------------------------------

function applyRegistryKey(entityType, payload) {
  if (entityType === "BRANDS") return externalKey(payload.sourceSystem, payload.externalBrandId);
  if (entityType === "CATEGORIES") return externalKey(payload.sourceSystem, payload.externalCategoryId);
  if (entityType === "PRODUCTS") return externalKey(payload.sourceSystem, payload.externalProductId);
  if (entityType === "VARIANTS") return externalKey(payload.sourceSystem, payload.externalVariantId);
  return null;
}

async function resolveApplyProductId(transaction, applied, payload) {
  const key = externalKey(payload.sourceSystem, payload.productExternalId);
  if (key && applied.PRODUCTS.has(key)) return applied.PRODUCTS.get(key);
  const product = await transaction.product.findFirst({ where: { sourceSystem: payload.sourceSystem, externalProductId: payload.productExternalId } });
  if (product) return product.id;
  throw Object.assign(new Error(`productExternalId "${payload.productExternalId}" could not be resolved during apply.`), { statusCode: 409 });
}

async function resolveApplyVariant(transaction, applied, payload) {
  const key = externalKey(payload.sourceSystem, payload.externalVariantId);
  if (key && applied.VARIANTS.has(key)) return applied.VARIANTS.get(key);
  const variant = await transaction.productVariant.findFirst({ where: { sourceSystem: payload.sourceSystem, externalVariantId: payload.externalVariantId } });
  if (variant) return { id: variant.id, productId: variant.productId };
  throw Object.assign(new Error(`externalVariantId "${payload.externalVariantId}" could not be resolved during apply.`), { statusCode: 409 });
}

async function assertNotStale(transaction, model, row) {
  const payload = row.normalizedPayload;
  if (!payload.targetId) return;
  const current = await transaction[model].findUnique({ where: { id: payload.targetId }, select: { updatedAt: true } });
  if (!current || current.updatedAt.toISOString() !== payload.targetUpdatedAt) {
    throw Object.assign(new Error(`Preview row ${row.rowNumber} (${row.entityType}) is stale; create a new preview.`), { statusCode: 409 });
  }
}

async function applyBrandRow(transaction, applied, row) {
  const payload = row.normalizedPayload;
  let id = payload.targetId;
  if (row.action === "UPDATE") {
    await assertNotStale(transaction, "brand", row);
    const updated = await transaction.brand.update({
      where: { id },
      data: { name: payload.name, country: payload.country, logoUrl: payload.logoUrl, description: payload.description, externalBrandId: payload.externalBrandId, sourceSystem: payload.sourceSystem },
    });
    id = updated.id;
  } else if (row.action === "CREATE") {
    const slug = slugify(payload.name) || slugify(payload.externalBrandId);
    const created = await transaction.brand.create({
      data: { name: payload.name, slug, country: payload.country, logoUrl: payload.logoUrl, description: payload.description, externalBrandId: payload.externalBrandId, sourceSystem: payload.sourceSystem, status: "ACTIVE" },
    });
    id = created.id;
  }
  applied.BRANDS.set(applyRegistryKey("BRANDS", payload), id);
}

/**
 * Never sets parentId here: a batch may list a child category before its
 * parent, and CATEGORIES rows apply in file order, not hierarchy order. Every
 * category is created/updated first (parentId left as-is); linkCategoryParents
 * resolves and writes parentId in a second pass once every row in the batch
 * is guaranteed to exist.
 */
async function applyCategoryRow(transaction, applied, row) {
  const payload = row.normalizedPayload;
  let id = payload.targetId;
  if (row.action === "UPDATE") {
    await assertNotStale(transaction, "category", row);
    const updated = await transaction.category.update({
      where: { id },
      data: { name: payload.name, nameAr: payload.nameAr, description: payload.description, externalCategoryId: payload.externalCategoryId, sourceSystem: payload.sourceSystem },
    });
    id = updated.id;
  } else if (row.action === "CREATE") {
    const slug = slugify(payload.name) || slugify(payload.externalCategoryId);
    const created = await transaction.category.create({
      data: { name: payload.name, nameAr: payload.nameAr, slug, description: payload.description, externalCategoryId: payload.externalCategoryId, sourceSystem: payload.sourceSystem, status: "ACTIVE" },
    });
    id = created.id;
  }
  applied.CATEGORIES.set(applyRegistryKey("CATEGORIES", payload), id);
}

async function resolveApplyCategoryId(transaction, applied, sourceSystem, categoryExternalId) {
  const key = externalKey(sourceSystem, categoryExternalId);
  if (key && applied.CATEGORIES.has(key)) return applied.CATEGORIES.get(key);
  const category = await transaction.category.findFirst({ where: { sourceSystem, externalCategoryId: categoryExternalId } });
  if (category) return category.id;
  throw Object.assign(new Error(`parentExternalCategoryId "${categoryExternalId}" could not be resolved during apply.`), { statusCode: 409 });
}

/**
 * Second pass: every CATEGORIES row in the batch now exists, so parent links
 * resolve regardless of file order. SKIP rows are included — an existing
 * category's parent may still need to change even when its own fields did
 * not.
 *
 * A SKIP row's own identity is resolved from the preview-matched targetId,
 * not from a fresh sourceSystem+externalCategoryId lookup: classifyCategory
 * can match an existing category by name alone (never touching
 * applyCategoryRow, since SKIP rows are never applied), so that database row
 * is not guaranteed to carry this batch's externalCategoryId at all.
 */
async function linkCategoryParents(transaction, applied, categoryRows) {
  const selfIdByExternalId = new Map();
  for (const row of categoryRows) {
    const payload = row.normalizedPayload;
    if (!payload.externalCategoryId) continue;
    const key = applyRegistryKey("CATEGORIES", payload);
    const selfId = (key && applied.CATEGORIES.get(key)) ?? payload.targetId;
    if (selfId) selfIdByExternalId.set(payload.externalCategoryId, selfId);
  }

  const touchedIds = new Set();
  for (const row of categoryRows) {
    const payload = row.normalizedPayload;
    if (!payload.externalCategoryId) continue;
    const selfId = selfIdByExternalId.get(payload.externalCategoryId);
    if (!selfId) continue;
    touchedIds.add(selfId);
    if (row.action === "SKIP" && !payload.parentExternalCategoryId) continue;
    const parentId = payload.parentExternalCategoryId
      ? selfIdByExternalId.get(payload.parentExternalCategoryId)
        ?? await resolveApplyCategoryId(transaction, applied, payload.sourceSystem, payload.parentExternalCategoryId)
      : null;
    await transaction.category.update({ where: { id: selfId }, data: { parentId } });
  }
  return touchedIds;
}

/**
 * Apply's last line of defense for category hierarchy: walks each touched
 * category's real, just-committed parentId chain and throws if it ever loops
 * back on itself — independent of whatever the batch-local preview check
 * could see, and safe against a cycle that only completes through
 * pre-existing database categories outside this batch. Throwing here rolls
 * back the entire transaction; apply never partially commits a cycle.
 */
async function assertNoCategoryCycles(transaction, touchedCategoryIds) {
  for (const startId of touchedCategoryIds) {
    const seen = new Set();
    let currentId = startId;
    while (currentId) {
      if (seen.has(currentId)) {
        throw Object.assign(new Error("Circular category hierarchy detected during apply."), { statusCode: 409 });
      }
      seen.add(currentId);
      const current = await transaction.category.findUnique({ where: { id: currentId }, select: { parentId: true } });
      currentId = current?.parentId ?? null;
    }
  }
}

async function applyProductRow(transaction, applied, row) {
  const payload = row.normalizedPayload;
  const [brand, category] = await Promise.all([
    (payload.brandExternalId || payload.brandName)
      ? resolveOptionalLinked(transaction, applied, "BRANDS", "brand", "externalBrandId", payload.sourceSystem, { externalId: payload.brandExternalId, name: payload.brandName })
      : null,
    (payload.categoryExternalId || payload.categoryName || payload.categorySlug)
      ? resolveOptionalLinked(transaction, applied, "CATEGORIES", "category", "externalCategoryId", payload.sourceSystem, { externalId: payload.categoryExternalId, name: payload.categoryName, slug: payload.categorySlug })
      : null,
  ]);
  let id = payload.targetId;
  // Absent status (every existing JSON import): fully stock-derived, unchanged
  // from prior behavior. Explicit status (e.g. an Excel-sourced DRAFT pilot
  // product): that lifecycle choice wins over the stock-derived default.
  const status = payload.status ?? (payload.stockQuantity > 0 ? "ACTIVE" : "OUT_OF_STOCK");
  const isAvailable = payload.status ? ["ACTIVE", "LOW_STOCK"].includes(payload.status) : payload.stockQuantity > 0;
  const shared = {
    name: payload.name,
    ...(payload.nameArProvided ? { nameAr: payload.nameAr } : {}),
    price: payload.price,
    ...(payload.salePriceProvided ? { salePrice: payload.salePrice } : {}),
    stockQuantity: payload.stockQuantity,
    description: payload.description,
    descriptionAr: payload.descriptionAr,
    shortDescription: payload.shortDescription,
    shortDescriptionAr: payload.shortDescriptionAr,
    ...(payload.imageUrlProvided ? { imageUrl: payload.imageUrl } : {}),
    externalProductId: payload.externalProductId,
    sourceSystem: payload.sourceSystem,
    syncStatus: "SUCCESS",
    lastSyncedAt: new Date(),
    ...(brand ? { brandId: brand.id, brand: brand.name } : {}),
    ...(category ? { categoryId: category.id, category: category.name } : {}),
  };
  if (row.action === "UPDATE") {
    await assertNotStale(transaction, "product", row);
    const updated = await transaction.product.update({
      where: { id },
      data: { ...shared, slug: payload.slug || undefined, status, isAvailable },
    });
    id = updated.id;
  } else if (row.action === "CREATE") {
    const slug = payload.slug || `${slugify(payload.name)}-${payload.sku.toLowerCase()}`;
    const created = await transaction.product.create({
      data: { ...shared, slug, sku: payload.sku, status, isAvailable },
    });
    id = created.id;
  }
  applied.PRODUCTS.set(applyRegistryKey("PRODUCTS", payload), id);
}

async function resolveOptionalLinked(transaction, applied, appliedKey, model, externalIdField, sourceSystem, { externalId, name, slug }) {
  const key = externalId ? externalKey(sourceSystem, externalId) : null;
  const cachedId = key ? applied[appliedKey].get(key) : null;
  if (cachedId) {
    const record = await transaction[model].findUnique({ where: { id: cachedId } });
    if (record) return record;
  }
  const result = await matchReference(transaction, model, externalIdField, { externalId, name, slug });
  if (result.status === "FOUND") return result.record;
  const label = externalId ? `${externalIdField} "${externalId}"` : `${model} "${name || slug}"`;
  const reason = result.status === "AMBIGUOUS" ? "matches more than one record" : "could not be resolved during apply";
  throw Object.assign(new Error(`${label} ${reason}.`), { statusCode: 409 });
}

async function applyProductOptionRow(transaction, applied, row) {
  const payload = row.normalizedPayload;
  const productId = await resolveApplyProductId(transaction, applied, payload);
  let id = payload.targetId;
  if (row.action === "UPDATE") {
    const updated = await transaction.productOption.update({ where: { id }, data: { nameEn: payload.nameEn, nameAr: payload.nameAr, sortOrder: payload.sortOrder } });
    id = updated.id;
  } else if (row.action === "CREATE") {
    const existing = await transaction.productOption.findFirst({ where: { productId, code: payload.code } });
    if (existing) {
      const updated = await transaction.productOption.update({ where: { id: existing.id }, data: { nameEn: payload.nameEn, nameAr: payload.nameAr, sortOrder: payload.sortOrder } });
      id = updated.id;
    } else {
      const created = await transaction.productOption.create({ data: { productId, code: payload.code, nameEn: payload.nameEn, nameAr: payload.nameAr, sortOrder: payload.sortOrder } });
      id = created.id;
    }
  }
  applied.PRODUCT_OPTIONS.set(`${productId}::${payload.code}`, id);
}

async function applyOptionValueRow(transaction, applied, row) {
  const payload = row.normalizedPayload;
  const productId = await resolveApplyProductId(transaction, applied, payload);
  const optionId = applied.PRODUCT_OPTIONS.get(`${productId}::${payload.optionCode}`)
    ?? (await transaction.productOption.findFirst({ where: { productId, code: payload.optionCode } }))?.id;
  if (!optionId) throw Object.assign(new Error(`optionCode "${payload.optionCode}" could not be resolved during apply.`), { statusCode: 409 });
  const data = { valueEn: payload.valueEn, valueAr: payload.valueAr, displayHex: payload.displayHex, sortOrder: payload.sortOrder };
  if (row.action === "UPDATE" && payload.targetId) {
    await transaction.productOptionValue.update({ where: { id: payload.targetId }, data });
  } else {
    const existing = await transaction.productOptionValue.findFirst({ where: { optionId, code: payload.code } });
    if (existing) await transaction.productOptionValue.update({ where: { id: existing.id }, data });
    else await transaction.productOptionValue.create({ data: { optionId, code: payload.code, ...data } });
  }
}

async function applyVariantRow(transaction, applied, row) {
  const payload = row.normalizedPayload;
  const productId = await resolveApplyProductId(transaction, applied, payload);
  const data = {
    sku: payload.sku,
    barcode: payload.barcode,
    externalVariantId: payload.externalVariantId,
    sourceSystem: payload.sourceSystem,
    nameEn: payload.nameEn,
    nameAr: payload.nameAr,
    stockQuantity: payload.stockQuantity,
    priceOverride: payload.priceOverride,
    status: payload.stockQuantity === 0 ? "OUT_OF_STOCK" : payload.status,
    isAvailable: payload.stockQuantity > 0,
    lastSyncedAt: new Date(),
  };
  let id = payload.targetId;
  if (row.action === "UPDATE") {
    await assertNotStale(transaction, "productVariant", row);
    const updated = await transaction.productVariant.update({ where: { id }, data });
    id = updated.id;
  } else if (row.action === "CREATE") {
    const created = await transaction.productVariant.create({ data: { ...data, productId } });
    id = created.id;
  }
  const key = applyRegistryKey("VARIANTS", payload);
  if (key) applied.VARIANTS.set(key, { id, productId });
}

async function applyVariantOptionValueRow(transaction, applied, row) {
  const payload = row.normalizedPayload;
  const variant = await resolveApplyVariant(transaction, applied, payload);
  const option = await transaction.productOption.findFirst({ where: { productId: variant.productId, code: payload.optionCode } });
  if (!option) throw Object.assign(new Error(`optionCode "${payload.optionCode}" could not be resolved during apply.`), { statusCode: 409 });
  const value = await transaction.productOptionValue.findFirst({ where: { optionId: option.id, code: payload.valueCode } });
  if (!value) throw Object.assign(new Error(`valueCode "${payload.valueCode}" could not be resolved during apply.`), { statusCode: 409 });
  await transaction.productVariantOptionValue.deleteMany({ where: { variantId: variant.id, optionId: option.id } });
  await transaction.productVariantOptionValue.create({ data: { variantId: variant.id, optionId: option.id, optionValueId: value.id } });
}

async function applyImageRow(transaction, applied, row) {
  const payload = row.normalizedPayload;
  const productId = await resolveApplyProductId(transaction, applied, payload);
  const variant = payload.externalVariantId ? await resolveApplyVariant(transaction, applied, payload) : null;
  if (payload.isPrimary) {
    await transaction.productImage.updateMany({ where: { productId, variantId: variant?.id ?? null, isPrimary: true }, data: { isPrimary: false } });
  }
  await transaction.productImage.create({
    data: {
      productId,
      variantId: variant?.id ?? null,
      url: payload.url,
      sortOrder: payload.sortOrder,
      isPrimary: payload.isPrimary,
      sourceSystem: payload.sourceSystem,
      sourceUrl: payload.sourceUrl,
      rightsConfirmed: payload.rightsConfirmed,
      rightsNote: payload.rightsConfirmed ? null : "Imported without confirmed rights; hidden from public catalog until reviewed.",
    },
  });
}

/**
 * Inventory rows only ever update stockQuantity plus an auto ACTIVE/LOW_STOCK/
 * OUT_OF_STOCK transition. A product or variant an admin has explicitly set to
 * DRAFT or INACTIVE (e.g. a pilot product awaiting commercial review) keeps
 * that lifecycle status regardless of what stock is being staged for it —
 * mirroring the same DRAFT/INACTIVE-preserving guard orderStock.service.js
 * already applies when restoring stock on a canceled order.
 */
async function applyInventoryRow(transaction, applied, row) {
  const payload = row.normalizedPayload;
  if (payload.externalVariantId) {
    const variant = await resolveApplyVariant(transaction, applied, payload);
    const current = await transaction.productVariant.findUnique({ where: { id: variant.id }, select: { status: true, lowStockThreshold: true } });
    const stockManaged = STOCK_MANAGED_STATUSES.has(current?.status);
    const updated = await transaction.productVariant.update({
      where: { id: variant.id },
      data: {
        stockQuantity: payload.stockQuantity,
        status: stockManaged && payload.stockQuantity === 0 ? "OUT_OF_STOCK" : undefined,
        isAvailable: stockManaged ? payload.stockQuantity > 0 : undefined,
      },
    });
    if (stockManaged && payload.stockQuantity > 0 && updated.status === "OUT_OF_STOCK") {
      await transaction.productVariant.update({ where: { id: variant.id }, data: { status: payload.stockQuantity <= updated.lowStockThreshold ? "LOW_STOCK" : "ACTIVE" } });
    }
    return;
  }
  const productId = await resolveApplyProductId(transaction, applied, payload);
  const currentProduct = await transaction.product.findUnique({ where: { id: productId }, select: { status: true } });
  const stockManaged = STOCK_MANAGED_STATUSES.has(currentProduct?.status);
  await transaction.product.update({
    where: { id: productId },
    data: {
      stockQuantity: payload.stockQuantity,
      status: stockManaged ? (payload.stockQuantity === 0 ? "OUT_OF_STOCK" : payload.stockQuantity <= 5 ? "LOW_STOCK" : "ACTIVE") : undefined,
      isAvailable: stockManaged ? payload.stockQuantity > 0 : undefined,
    },
  });
}

/**
 * Apply's last line of defense: re-checks every product this batch touched
 * for two variants sharing a complete combination using the transaction's
 * own just-committed data, independent of whatever preview said. Runs even
 * if the preview was stale or a peer variant was created by someone else
 * between preview and apply. Throwing here rolls back the entire batch —
 * apply never partially commits a duplicate combination.
 */
async function assertNoDuplicateVariantCombinations(transaction, productIds) {
  for (const productId of new Set(productIds)) {
    if (!productId) continue;
    const variants = await transaction.productVariant.findMany({
      where: { productId },
      include: { selections: { include: { option: true, optionValue: true } } },
    });
    const seen = new Set();
    for (const variant of variants) {
      const pairs = (variant.selections ?? [])
        .filter((selection) => selection.option?.code && selection.optionValue?.code)
        .map((selection) => ({ optionCode: selection.option.code, valueCode: selection.optionValue.code }));
      if (pairs.length === 0) continue;
      const signature = combinationSignature(pairs);
      if (seen.has(signature)) {
        throw Object.assign(new Error(`Duplicate variant combination for this product: ${signature}`), { statusCode: 409 });
      }
      seen.add(signature);
    }
  }
}

const APPLIERS = {
  BRANDS: applyBrandRow,
  CATEGORIES: applyCategoryRow,
  PRODUCTS: applyProductRow,
  PRODUCT_OPTIONS: applyProductOptionRow,
  OPTION_VALUES: applyOptionValueRow,
  VARIANTS: applyVariantRow,
  VARIANT_OPTION_VALUES: applyVariantOptionValueRow,
  IMAGES: applyImageRow,
  INVENTORY: applyInventoryRow,
};

export async function applyCatalogImportBatch(database, { batchId, confirmed, actorId }) {
  if (!confirmed) throw Object.assign(new Error("Explicit import confirmation is required."), { statusCode: 400 });
  const batch = await database.catalogImportBatch.findUnique({ where: { id: batchId }, include: { rows: { orderBy: { rowNumber: "asc" } } } });
  if (!batch) throw Object.assign(new Error("Import preview was not found."), { statusCode: 404 });
  if (batch.status === "APPLIED") throw Object.assign(new Error("This import preview was already applied."), { statusCode: 409 });
  if (batch.errorRows > 0 || batch.rows.some((row) => ACTIONS_WITH_FAILURES.has(row.action))) {
    throw Object.assign(new Error("Resolve import errors and conflicts before applying."), { statusCode: 409 });
  }

  const rowsByType = new Map();
  for (const row of batch.rows) {
    if (!rowsByType.has(row.entityType)) rowsByType.set(row.entityType, []);
    rowsByType.get(row.entityType).push(row);
  }

  // Prisma's interactive-transaction default (5s) is sized for ordinary
  // request-scale batches; a launch-size batch (thousands of rows, each a
  // sequential create/update) legitimately needs minutes. Scale the timeout
  // with row count instead of raising the global default, so small batches
  // still fail fast on a genuinely stuck transaction.
  const transactionTimeoutMs = Math.min(Math.max(batch.rows.length * 100, 10_000), 20 * 60 * 1000);

  return database.$transaction(async (transaction) => {
    const applied = { BRANDS: new Map(), CATEGORIES: new Map(), PRODUCTS: new Map(), PRODUCT_OPTIONS: new Map(), VARIANTS: new Map() };
    for (const entityType of CATALOG_IMPORT_APPLY_ORDER) {
      const rows = rowsByType.get(entityType) ?? [];
      for (const row of rows) {
        // SKIP rows are left untouched. Every resolver below falls back to a
        // direct database lookup when an entity isn't in the `applied` cache,
        // and an unchanged (SKIP) row already exists in the database by
        // definition, so dependents resolve it correctly either way.
        if (row.action === "SKIP") continue;
        await APPLIERS[entityType](transaction, applied, row);
      }
    }

    const touchedProductIds = new Set([...applied.VARIANTS.values()].map((entry) => entry.productId));
    for (const row of rowsByType.get("VARIANT_OPTION_VALUES") ?? []) {
      if (row.action === "SKIP") continue;
      const variant = await resolveApplyVariant(transaction, applied, row.normalizedPayload);
      touchedProductIds.add(variant.productId);
    }
    await assertNoDuplicateVariantCombinations(transaction, touchedProductIds);

    const touchedCategoryIds = await linkCategoryParents(transaction, applied, rowsByType.get("CATEGORIES") ?? []);
    await assertNoCategoryCycles(transaction, touchedCategoryIds);

    return transaction.catalogImportBatch.update({
      where: { id: batch.id },
      data: { status: "APPLIED", dryRun: false, appliedAt: new Date(), createdById: actorId ?? batch.createdById },
      include: { rows: true },
    });
  }, { timeout: transactionTimeoutMs, maxWait: 10_000 });
}
