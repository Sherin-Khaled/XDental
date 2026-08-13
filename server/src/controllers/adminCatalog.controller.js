import { prisma } from "../config/db.js";
import { resolveEffectiveProductPrices } from "../services/flashSalePricing.service.js";
import {
  deleteManagedProductImage,
  isManagedProductImage,
} from "../services/productImageStorage.service.js";
import { cleanText, isValidId } from "../utils/records.js";
import {
  hasProductVariants,
  normalizedVariantPrice,
  variantAvailabilitySummary,
} from "../services/variantCatalog.service.js";

const ADMIN_PRODUCT_VARIANT_SELECT = {
  id: true,
  status: true,
  isAvailable: true,
  stockQuantity: true,
  lowStockThreshold: true,
  priceOverride: true,
};

const CATEGORY_STATUSES = new Set(["ACTIVE", "DRAFT", "INACTIVE"]);
const PRODUCT_STATUSES = new Set(["ACTIVE", "LOW_STOCK", "OUT_OF_STOCK", "DRAFT", "INACTIVE"]);

function hasOwn(source, key) {
  return Object.prototype.hasOwnProperty.call(source ?? {}, key);
}

function slugify(value) {
  return cleanText(value, 180)
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

function validImageUrl(value) {
  if (!value) return true;
  if (isManagedProductImage(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parsePrice(value) {
  if (value === undefined || value === null || value === "") return { error: "Price is required." };
  const price = Number(value);
  if (!Number.isFinite(price) || price < 0 || price > 100000000) {
    return { error: "Price must be a non-negative number." };
  }
  return { value: Math.round(price * 100) / 100 };
}

function parseStock(value) {
  if (value === undefined || value === null || value === "") return { error: "Stock is required." };
  const stock = Number(value);
  if (!Number.isInteger(stock) || stock < 0 || stock > 100000000) {
    return { error: "Stock must be a non-negative whole number." };
  }
  return { value: stock };
}

function normalizeProductStatus(status, stock) {
  if (stock === 0) return "OUT_OF_STOCK";
  return status;
}

function productAvailability(status, stock) {
  return stock > 0 && status !== "OUT_OF_STOCK" && status !== "DRAFT" && status !== "INACTIVE";
}

function serializeCategory(category, productCount = 0, parent = null, childCount = 0) {
  return {
    id: category.id,
    name: category.name,
    nameAr: category.nameAr ?? null,
    slug: category.slug,
    description: category.description ?? null,
    status: category.status,
    parentId: category.parentId ?? null,
    parentName: parent?.name ?? null,
    parentSlug: parent?.slug ?? null,
    displayOrder: category.displayOrder ?? 0,
    childCount,
    productCount,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

/**
 * Validates a requested parentId for a category: the parent must exist and
 * must not create a cycle (a category cannot be nested under itself or one of
 * its own descendants). Returns { value } or { error }.
 */
async function resolveCategoryParent(parentIdInput, selfId = null) {
  const parentId = cleanText(parentIdInput, 60);
  if (!parentId) return { value: null };
  if (selfId && parentId === selfId) {
    return { error: "A category cannot be its own parent." };
  }
  const parent = await prisma.category.findUnique({
    where: { id: parentId },
    select: { id: true, parentId: true },
  });
  if (!parent) return { error: "Parent category not found." };

  if (selfId) {
    let ancestorId = parent.parentId;
    while (ancestorId) {
      if (ancestorId === selfId) {
        return { error: "A category cannot be nested under one of its own subcategories." };
      }
      const ancestor = await prisma.category.findUnique({
        where: { id: ancestorId },
        select: { parentId: true },
      });
      ancestorId = ancestor?.parentId ?? null;
    }
  }
  return { value: parent.id };
}

function recordByName(records) {
  return new Map(records.map((record) => [record.name.trim().toLowerCase(), record]));
}

/**
 * Read-only variant summary for the admin list/detail views. Reuses the same
 * Phase 7A helpers the public catalog and checkout already rely on, so this
 * never recomputes or overrides authoritative pricing/stock — it only
 * surfaces what those helpers already compute for display.
 */
function variantSummary(product) {
  const hasVariants = hasProductVariants(product);
  if (!hasVariants) return { hasVariants: false, variantCount: 0, priceMin: null, priceMax: null, totalStock: null };
  const availability = variantAvailabilitySummary(product);
  const parentPrice = product.price === null || product.price === undefined ? null : Number(product.price);
  const prices = availability.sellableVariants.map((variant) => normalizedVariantPrice(product, variant, parentPrice));
  return {
    hasVariants: true,
    variantCount: product.variants.length,
    priceMin: prices.length ? Math.min(...prices) : null,
    priceMax: prices.length ? Math.max(...prices) : null,
    totalStock: availability.stockQuantity,
  };
}

function serializeProduct(product, brandByName = new Map(), categoryByName = new Map(), pricingByProductId = new Map()) {
  const brand = product.brand ? brandByName.get(product.brand.trim().toLowerCase()) : null;
  const category = product.category ? categoryByName.get(product.category.trim().toLowerCase()) : null;
  const variants = variantSummary(product);
  const pricing = pricingByProductId.get(product.id);
  const basePrice = product.price === null ? null : Number(product.price);
  return {
    id: product.id,
    externalProductId: product.externalProductId ?? null,
    name: product.name,
    nameAr: product.nameAr ?? null,
    slug: product.slug,
    sku: product.sku ?? "",
    brand: product.brand
      ? { id: brand?.id ?? null, name: product.brand, slug: brand?.slug ?? null }
      : null,
    category: product.category
      ? { id: category?.id ?? null, name: product.category, slug: category?.slug ?? null }
      : null,
    price: basePrice,
    basePrice,
    salePrice: pricing?.salePrice ?? null,
    effectivePrice: pricing?.effectivePrice ?? basePrice,
    originalPrice: pricing?.originalPrice ?? null,
    stock: product.stockQuantity ?? 0,
    status: product.status,
    imageUrl: product.imageUrl ?? null,
    description: product.description ?? null,
    descriptionAr: product.descriptionAr ?? null,
    shortDescription: product.shortDescription ?? null,
    shortDescriptionAr: product.shortDescriptionAr ?? null,
    featured: product.featured,
    isWeeklyOffer: product.isWeeklyOffer,
    isBestSeller: product.isBestSeller,
    isNewArrival: product.isNewArrival,
    isHotDeal: product.isHotDeal,
    isFastDelivery: product.isFastDelivery,
    purchaseMode: product.purchaseMode,
    isAvailable: product.isAvailable,
    sourceSystem: product.sourceSystem ?? null,
    lastSyncedAt: product.lastSyncedAt ?? null,
    hasVariants: variants.hasVariants,
    variantCount: variants.variantCount,
    priceMin: variants.priceMin,
    priceMax: variants.priceMax,
    totalStock: variants.totalStock,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

async function categoryProductCounts() {
  const groups = await prisma.product.groupBy({
    by: ["category"],
    where: { category: { not: null } },
    _count: { _all: true },
  });
  return groups.reduce((counts, group) => {
    const key = group.category?.trim().toLowerCase();
    if (key) counts.set(key, (counts.get(key) ?? 0) + group._count._all);
    return counts;
  }, new Map());
}

async function findCategoryDuplicate(name, slug, excludeId) {
  return prisma.category.findFirst({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: [{ name: { equals: name, mode: "insensitive" } }, { slug }],
    },
    select: { id: true },
  });
}

async function findProductDuplicate(sku, slug, excludeId) {
  return prisma.product.findFirst({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: [{ sku: { equals: sku, mode: "insensitive" } }, { slug }],
    },
    select: { id: true, sku: true },
  });
}

async function resolveBrand(id, database = prisma) {
  if (!id) return null;
  return database.brand.findUnique({ where: { id }, select: { id: true, name: true, slug: true } });
}

async function resolveCategory(id, database = prisma) {
  if (!id) return null;
  return database.category.findUnique({ where: { id }, select: { id: true, name: true, slug: true } });
}

async function catalogLookups() {
  const [brands, categories] = await Promise.all([
    prisma.brand.findMany({ select: { id: true, name: true, slug: true } }),
    prisma.category.findMany({ select: { id: true, name: true, slug: true } }),
  ]);
  return { brandByName: recordByName(brands), categoryByName: recordByName(categories) };
}

export async function getAdminCategories(request, response) {
  const search = cleanText(request.query?.search, 100);
  const status = cleanText(request.query?.status, 50).toUpperCase();
  if (status && !CATEGORY_STATUSES.has(status)) {
    return response.status(400).json({ message: "Invalid category status." });
  }

  const [categories, allCategories, counts] = await Promise.all([
    prisma.category.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { slug: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
    prisma.category.findMany({ select: { id: true, name: true, slug: true, parentId: true } }),
    categoryProductCounts(),
  ]);

  const byId = new Map(allCategories.map((category) => [category.id, category]));
  const childCounts = new Map();
  for (const category of allCategories) {
    if (!category.parentId) continue;
    childCounts.set(category.parentId, (childCounts.get(category.parentId) ?? 0) + 1);
  }

  return response.json({
    categories: categories.map((category) =>
      serializeCategory(
        category,
        counts.get(category.name.toLowerCase()) ?? 0,
        category.parentId ? byId.get(category.parentId) ?? null : null,
        childCounts.get(category.id) ?? 0
      )
    ),
  });
}

export async function createAdminCategory(request, response) {
  const name = cleanText(request.body?.name, 150);
  const description = cleanText(request.body?.description, 2000);
  const status = cleanText(request.body?.status, 50).toUpperCase() || "ACTIVE";
  const slug = slugify(request.body?.slug) || slugify(name);

  if (!name) return response.status(400).json({ message: "Category name is required.", field: "name" });
  if (!slug) return response.status(400).json({ message: "Category name must contain letters or numbers.", field: "name" });
  if (!CATEGORY_STATUSES.has(status)) return response.status(400).json({ message: "Invalid category status.", field: "status" });
  if (await findCategoryDuplicate(name, slug)) {
    return response.status(409).json({ message: "A category with this name or slug already exists.", field: "name" });
  }
  const parent = await resolveCategoryParent(request.body?.parentId);
  if (parent.error) return response.status(400).json({ message: parent.error, field: "parentId" });

  try {
    const category = await prisma.category.create({
      data: { name, slug, description: description || null, status, parentId: parent.value },
    });
    const parentRecord = parent.value
      ? await prisma.category.findUnique({ where: { id: parent.value }, select: { name: true, slug: true } })
      : null;
    return response.status(201).json({ category: serializeCategory(category, 0, parentRecord) });
  } catch (error) {
    if (error?.code === "P2002") {
      return response.status(409).json({ message: "A category with this name or slug already exists.", field: "name" });
    }
    throw error;
  }
}

export async function updateAdminCategory(request, response) {
  if (!isValidId(request.params.id)) return response.status(404).json({ message: "Category not found." });
  const existing = await prisma.category.findUnique({ where: { id: request.params.id } });
  if (!existing) return response.status(404).json({ message: "Category not found." });

  const name = hasOwn(request.body, "name") ? cleanText(request.body.name, 150) : existing.name;
  const description = hasOwn(request.body, "description") ? cleanText(request.body.description, 2000) : existing.description;
  const status = hasOwn(request.body, "status") ? cleanText(request.body.status, 50).toUpperCase() : existing.status;
  const slug = hasOwn(request.body, "slug")
    ? slugify(request.body.slug) || slugify(name)
    : name === existing.name
      ? existing.slug
      : slugify(name);

  if (!name) return response.status(400).json({ message: "Category name is required.", field: "name" });
  if (!slug) return response.status(400).json({ message: "Category name must contain letters or numbers.", field: "name" });
  if (!CATEGORY_STATUSES.has(status)) return response.status(400).json({ message: "Invalid category status.", field: "status" });
  if (await findCategoryDuplicate(name, slug, existing.id)) {
    return response.status(409).json({ message: "A category with this name or slug already exists.", field: "name" });
  }
  const parent = hasOwn(request.body, "parentId")
    ? await resolveCategoryParent(request.body.parentId, existing.id)
    : { value: existing.parentId };
  if (parent.error) return response.status(400).json({ message: parent.error, field: "parentId" });

  try {
    const category = await prisma.$transaction(async (database) => {
      if (name !== existing.name) {
        await database.product.updateMany({
          where: { category: { equals: existing.name, mode: "insensitive" } },
          data: { category: name },
        });
      }
      return database.category.update({
        where: { id: existing.id },
        data: { name, slug, description: description || null, status, parentId: parent.value },
      });
    });
    const [productCount, parentRecord, childCount] = await Promise.all([
      prisma.product.count({ where: { category: { equals: category.name, mode: "insensitive" } } }),
      category.parentId
        ? prisma.category.findUnique({ where: { id: category.parentId }, select: { name: true, slug: true } })
        : null,
      prisma.category.count({ where: { parentId: category.id } }),
    ]);
    return response.json({ category: serializeCategory(category, productCount, parentRecord, childCount) });
  } catch (error) {
    if (error?.code === "P2002") {
      return response.status(409).json({ message: "A category with this name or slug already exists.", field: "name" });
    }
    throw error;
  }
}

export async function deleteAdminCategory(request, response) {
  if (!isValidId(request.params.id)) return response.status(404).json({ message: "Category not found." });
  const existing = await prisma.category.findUnique({ where: { id: request.params.id } });
  if (!existing) return response.status(404).json({ message: "Category not found." });
  const [productCount, childCount] = await Promise.all([
    prisma.product.count({ where: { category: { equals: existing.name, mode: "insensitive" } } }),
    prisma.category.count({ where: { parentId: existing.id } }),
  ]);
  if (productCount > 0) {
    return response.status(409).json({
      message: "Category cannot be deleted because it has linked products.",
      productCount,
    });
  }
  if (childCount > 0) {
    return response.status(409).json({
      message: "Category cannot be deleted because it has subcategories. Move or delete its subcategories first.",
      childCount,
    });
  }
  await prisma.category.delete({ where: { id: existing.id } });
  return response.json({ message: "Category deleted successfully.", category: serializeCategory(existing) });
}

export const ADMIN_PRODUCT_TYPE_FILTERS = new Set(["all", "simple", "variant"]);
export const ADMIN_PRODUCT_STOCK_FILTERS = new Set(["all", "lowStock", "outOfStock"]);
export const ADMIN_PRODUCT_SORT_FIELDS = {
  name: "name",
  updatedAt: "updatedAt",
  price: "price",
  stock: "stockQuantity",
};

/** Builds the admin products `where` clause from already-resolved filter values (brand/category are names, not ids). */
export function buildAdminProductWhere({ status, brandName, categoryName, sourceSystem, productType, stockFilter, search }) {
  return {
    ...(status ? { status } : {}),
    ...(brandName ? { brand: { equals: brandName, mode: "insensitive" } } : {}),
    ...(categoryName ? { category: { equals: categoryName, mode: "insensitive" } } : {}),
    ...(sourceSystem ? { sourceSystem } : {}),
    ...(productType === "simple" ? { variants: { none: {} } } : {}),
    ...(productType === "variant" ? { variants: { some: {} } } : {}),
    ...(stockFilter === "lowStock" ? { status: "LOW_STOCK" } : {}),
    ...(stockFilter === "outOfStock" ? { OR: [{ status: "OUT_OF_STOCK" }, { stockQuantity: 0 }] } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { slug: { contains: search, mode: "insensitive" } },
            { sku: { contains: search, mode: "insensitive" } },
            { externalProductId: { contains: search, mode: "insensitive" } },
            { brand: { contains: search, mode: "insensitive" } },
            { category: { contains: search, mode: "insensitive" } },
            { variants: { some: { OR: [
              { sku: { contains: search, mode: "insensitive" } },
              { barcode: { contains: search, mode: "insensitive" } },
              { externalVariantId: { contains: search, mode: "insensitive" } },
            ] } } },
          ],
        }
      : {}),
  };
}

/** Shared page/limit/total -> pagination-metadata shape used by both the public and admin product list endpoints. */
export function buildPaginationMeta(total, page, limit) {
  return { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getAdminProducts(request, response) {
  const search = cleanText(request.query?.search, 100);
  const status = cleanText(request.query?.status, 50).toUpperCase();
  const brandId = cleanText(request.query?.brandId, 191);
  const categoryId = cleanText(request.query?.categoryId, 191);
  const sourceSystem = cleanText(request.query?.sourceSystem, 120);
  const productType = cleanText(request.query?.productType, 20) || "all";
  const stockFilter = cleanText(request.query?.stockFilter, 20) || "all";
  const sortKey = cleanText(request.query?.sort, 30) || "name";
  const sortDirection = cleanText(request.query?.direction, 10).toLowerCase() === "desc" ? "desc" : "asc";
  if (status && !PRODUCT_STATUSES.has(status)) {
    return response.status(400).json({ message: "Invalid product status." });
  }
  if (!ADMIN_PRODUCT_TYPE_FILTERS.has(productType)) {
    return response.status(400).json({ message: "Invalid product type filter." });
  }
  if (!ADMIN_PRODUCT_STOCK_FILTERS.has(stockFilter)) {
    return response.status(400).json({ message: "Invalid stock filter." });
  }
  if (!ADMIN_PRODUCT_SORT_FIELDS[sortKey]) {
    return response.status(400).json({ message: "Invalid sort." });
  }
  const page = Math.max(Number.parseInt(request.query?.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(request.query?.limit, 10) || 50, 1), 100);

  const [brand, category] = await Promise.all([resolveBrand(brandId), resolveCategory(categoryId)]);
  if (brandId && !brand) return response.status(400).json({ message: "Brand not found." });
  if (categoryId && !category) return response.status(400).json({ message: "Category not found." });

  const where = buildAdminProductWhere({
    status,
    brandName: brand?.name,
    categoryName: category?.name,
    sourceSystem,
    productType,
    stockFilter,
    search,
  });

  const [products, total, lookups, sourceSystems] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { variants: { select: ADMIN_PRODUCT_VARIANT_SELECT } },
      orderBy: [{ [ADMIN_PRODUCT_SORT_FIELDS[sortKey]]: sortDirection }, { name: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
    catalogLookups(),
    prisma.product.findMany({
      where: { sourceSystem: { not: null } },
      distinct: ["sourceSystem"],
      select: { sourceSystem: true },
      orderBy: { sourceSystem: "asc" },
    }),
  ]);
  const pricingByProductId = await resolveEffectiveProductPrices(prisma, products);
  return response.json({
    products: products.map((product) => serializeProduct(product, lookups.brandByName, lookups.categoryByName, pricingByProductId)),
    pagination: buildPaginationMeta(total, page, limit),
    sourceSystems: sourceSystems.map((row) => row.sourceSystem).filter(Boolean),
  });
}

async function parseProductInput(body, existing = null) {
  const name = hasOwn(body, "name") ? cleanText(body.name, 200) : existing?.name ?? "";
  const nameAr = hasOwn(body, "nameAr") ? cleanText(body.nameAr, 200) : existing?.nameAr ?? "";
  const sku = hasOwn(body, "sku") ? cleanText(body.sku, 120) : existing?.sku ?? "";
  const imageUrl = hasOwn(body, "imageUrl") ? cleanText(body.imageUrl, 1000) : existing?.imageUrl ?? "";
  const description = hasOwn(body, "description") ? cleanText(body.description, 4000) : existing?.description ?? "";
  const descriptionAr = hasOwn(body, "descriptionAr") ? cleanText(body.descriptionAr, 4000) : existing?.descriptionAr ?? "";
  const shortDescription = hasOwn(body, "shortDescription") ? cleanText(body.shortDescription, 1000) : existing?.shortDescription ?? "";
  const shortDescriptionAr = hasOwn(body, "shortDescriptionAr") ? cleanText(body.shortDescriptionAr, 1000) : existing?.shortDescriptionAr ?? "";
  const requestedStatus = hasOwn(body, "status")
    ? cleanText(body.status, 50).toUpperCase()
    : existing?.status ?? "ACTIVE";
  const price = parsePrice(hasOwn(body, "price") ? body.price : existing?.price);
  const stock = parseStock(hasOwn(body, "stock") ? body.stock : existing?.stockQuantity);
  const featured = hasOwn(body, "featured") ? body.featured : existing?.featured ?? false;
  const booleanFields = ["isWeeklyOffer", "isBestSeller", "isNewArrival", "isHotDeal", "isFastDelivery"];
  const merchandising = Object.fromEntries(booleanFields.map((field) => [
    field,
    hasOwn(body, field) ? body[field] : existing?.[field] ?? false,
  ]));
  const purchaseMode = hasOwn(body, "purchaseMode")
    ? cleanText(body.purchaseMode, 20).toUpperCase()
    : existing?.purchaseMode ?? "STANDARD";
  const slug = hasOwn(body, "slug")
    ? slugify(body.slug) || slugify(name)
    : existing && name === existing.name
      ? existing.slug
      : slugify(name);

  if (!name) return { error: { message: "Product name is required.", field: "name" } };
  if (!slug) return { error: { message: "Product name must contain letters or numbers.", field: "name" } };
  if (!sku) return { error: { message: "SKU is required.", field: "sku" } };
  if (price.error) return { error: { message: price.error, field: "price" } };
  if (stock.error) return { error: { message: stock.error, field: "stock" } };
  if (!PRODUCT_STATUSES.has(requestedStatus)) return { error: { message: "Invalid product status.", field: "status" } };
  if (!validImageUrl(imageUrl)) return { error: { message: "Image URL must use http or https.", field: "imageUrl" } };
  if (typeof featured !== "boolean") return { error: { message: "Featured must be true or false.", field: "featured" } };
  for (const [field, value] of Object.entries(merchandising)) {
    if (typeof value !== "boolean") return { error: { message: `${field} must be true or false.`, field } };
  }
  if (!["STANDARD", "INQUIRY", "QUOTE"].includes(purchaseMode)) {
    return { error: { message: "Invalid purchase mode.", field: "purchaseMode" } };
  }

  const brandId = hasOwn(body, "brandId") ? cleanText(body.brandId, 191) : undefined;
  const categoryId = hasOwn(body, "categoryId") ? cleanText(body.categoryId, 191) : undefined;
  const [brand, category] = await Promise.all([
    brandId === undefined ? undefined : resolveBrand(brandId),
    categoryId === undefined ? undefined : resolveCategory(categoryId),
  ]);
  if (brandId && !brand) return { error: { message: "Brand not found.", field: "brandId" } };
  if (categoryId && !category) return { error: { message: "Category not found.", field: "categoryId" } };

  const status = normalizeProductStatus(requestedStatus, stock.value);
  return {
    value: {
      name,
      nameAr: nameAr || null,
      slug,
      sku,
      price: price.value,
      stockQuantity: stock.value,
      status,
      featured,
      ...merchandising,
      purchaseMode,
      imageUrl: imageUrl || null,
      description: description || null,
      descriptionAr: descriptionAr || null,
      shortDescription: shortDescription || null,
      shortDescriptionAr: shortDescriptionAr || null,
      brand: brandId === undefined ? existing?.brand ?? null : brand?.name ?? null,
      category: categoryId === undefined ? existing?.category ?? null : category?.name ?? null,
      isAvailable: productAvailability(status, stock.value),
    },
  };
}

export async function createAdminProduct(request, response) {
  const parsed = await parseProductInput(request.body ?? {});
  if (parsed.error) return response.status(400).json(parsed.error);
  const duplicate = await findProductDuplicate(parsed.value.sku, parsed.value.slug);
  if (duplicate) {
    return response.status(409).json({
      message: duplicate.sku?.toLowerCase() === parsed.value.sku.toLowerCase()
        ? "A product with this SKU already exists."
        : "A product with this name or slug already exists.",
      field: duplicate.sku?.toLowerCase() === parsed.value.sku.toLowerCase() ? "sku" : "name",
    });
  }

  try {
    const product = await prisma.product.create({ data: parsed.value });
    const lookups = await catalogLookups();
    return response.status(201).json({ product: serializeProduct(product, lookups.brandByName, lookups.categoryByName) });
  } catch (error) {
    if (error?.code === "P2002") {
      return response.status(409).json({ message: "A product with this SKU or slug already exists.", field: "sku" });
    }
    throw error;
  }
}

export async function updateAdminProduct(request, response) {
  if (!isValidId(request.params.id)) return response.status(404).json({ message: "Product not found." });
  const existing = await prisma.product.findUnique({ where: { id: request.params.id } });
  if (!existing) return response.status(404).json({ message: "Product not found." });
  const parsed = await parseProductInput(request.body ?? {}, existing);
  if (parsed.error) return response.status(400).json(parsed.error);
  const duplicate = await findProductDuplicate(parsed.value.sku, parsed.value.slug, existing.id);
  if (duplicate) {
    return response.status(409).json({
      message: duplicate.sku?.toLowerCase() === parsed.value.sku.toLowerCase()
        ? "A product with this SKU already exists."
        : "A product with this name or slug already exists.",
      field: duplicate.sku?.toLowerCase() === parsed.value.sku.toLowerCase() ? "sku" : "name",
    });
  }

  try {
    const product = await prisma.product.update({ where: { id: existing.id }, data: parsed.value });
    if (existing.imageUrl && existing.imageUrl !== product.imageUrl) {
      await deleteManagedProductImage(existing.imageUrl).catch(() => {});
    }
    const lookups = await catalogLookups();
    return response.json({ product: serializeProduct(product, lookups.brandByName, lookups.categoryByName) });
  } catch (error) {
    if (error?.code === "P2002") {
      return response.status(409).json({ message: "A product with this SKU or slug already exists.", field: "sku" });
    }
    throw error;
  }
}

async function productLinkCounts(product) {
  const skuFilter = product.sku ? { sku: { equals: product.sku, mode: "insensitive" } } : null;
  const where = { OR: [{ productId: product.id }, ...(skuFilter ? [skuFilter] : [])] };
  const [orders, quotes, requests] = await Promise.all([
    prisma.orderItem.count({ where }),
    prisma.quoteItem.count({ where }),
    prisma.productRequest.count({ where }),
  ]);
  return { orders, quotes, requests, total: orders + quotes + requests };
}

export async function deleteAdminProduct(request, response) {
  if (!isValidId(request.params.id)) return response.status(404).json({ message: "Product not found." });
  const existing = await prisma.product.findUnique({ where: { id: request.params.id } });
  if (!existing) return response.status(404).json({ message: "Product not found." });
  const linked = await productLinkCounts(existing);
  if (linked.total > 0) {
    return response.status(409).json({
      message: "Product cannot be deleted because it is linked to orders, quotes, or product requests.",
      linked,
    });
  }
  await prisma.product.delete({ where: { id: existing.id } });
  await deleteManagedProductImage(existing.imageUrl).catch(() => {});
  const lookups = await catalogLookups();
  return response.json({
    message: "Product deleted successfully.",
    product: serializeProduct(existing, lookups.brandByName, lookups.categoryByName),
  });
}
