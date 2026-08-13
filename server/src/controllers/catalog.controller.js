import { prisma } from "../config/db.js";
import { resolveEffectiveProductPrices } from "../services/flashSalePricing.service.js";
import { cleanText } from "../utils/records.js";
import {
  getVariantSelectedOptions,
  hasProductVariants,
  isVariantSellable,
  normalizedVariantPrice,
  variantAvailabilitySummary,
  visibleGallery,
} from "../services/variantCatalog.service.js";

const PUBLIC_PRODUCT_STATUSES = new Set(["ACTIVE", "LOW_STOCK", "OUT_OF_STOCK"]);

function slugify(value) {
  return cleanText(value, 180)
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

function recordByName(records) {
  return new Map(records.map((record) => [record.name.trim().toLowerCase(), record]));
}

export function isPubliclyAvailable(product) {
  return product.isAvailable && ["ACTIVE", "LOW_STOCK"].includes(product.status) &&
    (product.stockQuantity === null || product.stockQuantity > 0);
}

export function serializePublicProduct(
  product,
  brandByName = new Map(),
  categoryByName = new Map(),
  pricingByProductId = new Map()
) {
  const brand = product.brand ? brandByName.get(product.brand.trim().toLowerCase()) : null;
  const category = product.category ? categoryByName.get(product.category.trim().toLowerCase()) : null;
  const hasVariants = hasProductVariants(product);
  const variantSummary = variantAvailabilitySummary(product);
  const available = hasVariants ? variantSummary.available : isPubliclyAvailable(product);
  const pricing = pricingByProductId.get(product.id);
  const basePrice = pricing?.basePrice ?? Number(product.price);
  const parentPrice = pricing?.effectivePrice ?? pricing?.price ?? basePrice;
  const variantPrices = hasVariants
    ? variantSummary.sellableVariants.map((variant) => normalizedVariantPrice(product, variant, parentPrice))
    : [];
  const price = variantPrices.length ? Math.min(...variantPrices) : parentPrice;
  const maxPrice = variantPrices.length ? Math.max(...variantPrices) : null;
  const gallery = visibleGallery(product);
  const options = (product.options ?? []).map((option) => ({
    code: option.code,
    nameEn: option.nameEn,
    nameAr: option.nameAr ?? null,
    values: (option.values ?? []).map((value) => ({
      code: value.code,
      valueEn: value.valueEn,
      valueAr: value.valueAr ?? null,
      displayHex: value.displayHex ?? null,
    })),
  }));
  return {
    id: product.id,
    sku: product.sku ?? null,
    slug: product.slug,
    name: product.name,
    nameAr: product.nameAr ?? null,
    brand: product.brand ? { name: product.brand, slug: brand?.slug ?? slugify(product.brand) } : null,
    category: product.category ? { name: product.category, slug: category?.slug ?? slugify(product.category) } : null,
    price,
    basePrice,
    salePrice: pricing?.salePrice ?? null,
    effectivePrice: price,
    maxPrice: maxPrice !== null && maxPrice !== price ? maxPrice : null,
    originalPrice: pricing?.originalPrice ?? null,
    stockQuantity: hasVariants ? variantSummary.stockQuantity : product.stockQuantity,
    stock: hasVariants ? variantSummary.stockQuantity : product.stockQuantity,
    status: hasVariants ? variantSummary.status : product.status,
    imageUrl: gallery[0]?.url ?? product.imageUrl ?? null,
    images: gallery.map((image) => image.url),
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
    available,
    isAvailable: available,
    hasVariants,
    optionSummary: options.map((option) => option.nameEn),
    options,
    ...(hasVariants ? {
      variants: product.variants.filter(isVariantSellable).map((variant) => ({
        id: variant.id,
        sku: variant.sku ?? null,
        nameEn: variant.nameEn ?? null,
        nameAr: variant.nameAr ?? null,
        price: normalizedVariantPrice(product, variant, parentPrice),
        stockQuantity: variant.stockQuantity,
        available: isVariantSellable(variant),
        selectedOptions: getVariantSelectedOptions(variant),
        images: visibleGallery(product, variant.id),
      })),
    } : {}),
  };
}

const publicProductInclude = {
  options: { orderBy: { sortOrder: "asc" }, include: { values: { orderBy: { sortOrder: "asc" } } } },
  variants: {
    orderBy: { sortOrder: "asc" },
    include: {
      selections: { include: { option: true, optionValue: true } },
    },
  },
  images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
};

export async function publicLookups() {
  const [brands, categories] = await Promise.all([
    prisma.brand.findMany({
      where: { status: { in: ["ACTIVE", "NEEDS_LOGO"] } },
      select: { name: true, slug: true },
    }),
    prisma.category.findMany({
      where: { status: "ACTIVE" },
      select: { name: true, slug: true },
    }),
  ]);
  return { brandByName: recordByName(brands), categoryByName: recordByName(categories) };
}

async function resolveCatalogFilter(model, value) {
  const normalized = cleanText(value, 180);
  if (!normalized) return "";
  const record = await prisma[model].findFirst({
    where: {
      OR: [
        { slug: { equals: normalized, mode: "insensitive" } },
        { name: { equals: normalized, mode: "insensitive" } },
      ],
    },
    select: { name: true },
  });
  return record?.name ?? normalized.replace(/-/g, " ");
}

function childrenByParentId(categories) {
  const byParent = new Map();
  for (const category of categories) {
    if (!category.parentId) continue;
    const list = byParent.get(category.parentId) ?? [];
    list.push(category);
    byParent.set(category.parentId, list);
  }
  return byParent;
}

/**
 * Resolves a category/subcategory filter value (slug or name) to the list of
 * product `category` names it covers: the matched category plus all of its
 * descendants, so filtering by a main category includes every subcategory.
 * Unknown values fall back to the normalized text (covers derived categories).
 */
export function queryList(value, maxItems = 100) {
  const values = Array.isArray(value) ? value : [value];
  return [...new Set(
    values
      .flatMap((item) => String(item ?? "").split(","))
      .map((item) => cleanText(item, 180))
      .filter(Boolean)
  )].slice(0, maxItems);
}

async function resolveCategoryFilterNames(values, { includeDescendants, allowUnknown }) {
  const normalizedValues = queryList(values);
  if (normalizedValues.length === 0) return null;

  const categories = await prisma.category.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, slug: true, parentId: true },
  });
  const byParent = childrenByParentId(categories);
  const categoryByIdentifier = new Map();
  for (const category of categories) {
    categoryByIdentifier.set(category.slug.toLowerCase(), category);
    categoryByIdentifier.set(category.name.toLowerCase(), category);
  }

  const names = new Set();
  for (const normalized of normalizedValues) {
    const root = categoryByIdentifier.get(normalized.toLowerCase());
    if (!root) {
      if (allowUnknown) names.add(normalized.replace(/-/g, " "));
      continue;
    }

    if (!includeDescendants) {
      names.add(root.name);
      continue;
    }

    const stack = [root];
    while (stack.length > 0) {
      const current = stack.pop();
      names.add(current.name);
      for (const child of byParent.get(current.id) ?? []) stack.push(child);
    }
  }
  return [...names];
}

async function resolveBrandFilterNames(values) {
  const normalizedValues = queryList(values);
  if (normalizedValues.length === 0) return null;

  const brands = await prisma.brand.findMany({
    where: { status: { not: "INACTIVE" } },
    select: { name: true, slug: true },
  });
  const brandByIdentifier = new Map();
  for (const brand of brands) {
    brandByIdentifier.set(brand.slug.toLowerCase(), brand.name);
    brandByIdentifier.set(brand.name.toLowerCase(), brand.name);
  }

  return [...new Set(
    normalizedValues
      .map((value) => brandByIdentifier.get(value.toLowerCase()))
      .filter(Boolean)
  )];
}

function availabilityFilter(value) {
  const availability = cleanText(value, 50).toLowerCase().replace(/[\s_]+/g, "-");
  if (!availability) return null;
  if (["available", "in-stock", "true"].includes(availability)) {
    return {
      status: { in: ["ACTIVE", "LOW_STOCK"] },
      isAvailable: true,
      OR: [{ stockQuantity: null }, { stockQuantity: { gt: 0 } }],
    };
  }
  if (["unavailable", "out-of-stock", "false"].includes(availability)) {
    return {
      OR: [
        { status: "OUT_OF_STOCK" },
        { isAvailable: false },
        { stockQuantity: 0 },
      ],
    };
  }
  if (availability === "low-stock") return { status: "LOW_STOCK" };
  return undefined;
}

export const PRODUCT_SORT_ORDER_BY = {
  recommended: [{ featured: "desc" }, { updatedAt: "desc" }, { name: "asc" }],
  "price-low": [{ price: "asc" }, { name: "asc" }],
  "price-high": [{ price: "desc" }, { name: "asc" }],
  name: [{ name: "asc" }],
};

/** Builds the `price` where-clause from parsed priceMin/priceMax (null when absent). */
export function buildPriceFilter(priceMin, priceMax) {
  return { not: null, ...(priceMin !== null ? { gte: priceMin } : {}), ...(priceMax !== null ? { lte: priceMax } : {}) };
}

export async function getPublicProducts(request, response) {
  const search = cleanText(request.query?.search, 120);
  const status = cleanText(request.query?.status, 50).toUpperCase();
  if (status && !PUBLIC_PRODUCT_STATUSES.has(status)) {
    return response.status(400).json({ message: "Invalid public product status." });
  }
  const availability = availabilityFilter(request.query?.availability);
  if (availability === undefined) {
    return response.status(400).json({ message: "Invalid product availability filter." });
  }
  const featuredText = cleanText(request.query?.featured, 10).toLowerCase();
  if (featuredText && !["true", "false"].includes(featuredText)) {
    return response.status(400).json({ message: "Featured must be true or false." });
  }
  const merchandisingFilters = ["isWeeklyOffer", "isBestSeller", "isNewArrival", "isHotDeal", "isFastDelivery"];
  const merchandisingValues = {};
  for (const field of merchandisingFilters) {
    const value = cleanText(request.query?.[field], 10).toLowerCase();
    if (value && !["true", "false"].includes(value)) {
      return response.status(400).json({ message: `${field} must be true or false.` });
    }
    if (value) merchandisingValues[field] = value === "true";
  }
  const hasDiscountText = cleanText(request.query?.hasDiscount, 10).toLowerCase();
  if (hasDiscountText && !["true", "false"].includes(hasDiscountText)) {
    return response.status(400).json({ message: "hasDiscount must be true or false." });
  }
  const sortKey = cleanText(request.query?.sort, 30) || "recommended";
  if (!PRODUCT_SORT_ORDER_BY[sortKey]) {
    return response.status(400).json({ message: "Invalid sort." });
  }
  const priceMinText = cleanText(request.query?.priceMin, 20);
  const priceMaxText = cleanText(request.query?.priceMax, 20);
  const priceMin = priceMinText ? Number(priceMinText) : null;
  const priceMax = priceMaxText ? Number(priceMaxText) : null;
  if ((priceMinText && !Number.isFinite(priceMin)) || (priceMaxText && !Number.isFinite(priceMax))) {
    return response.status(400).json({ message: "priceMin/priceMax must be numbers." });
  }
  // Known-id batch lookup (cart/wishlist/supply-list hydration) — bounded to
  // avoid becoming an unbounded full-catalog fetch through the back door.
  const ids = queryList(request.query?.ids, 100);

  // New multi-select URLs send exact active taxonomy slugs in `categories`.
  // Parent checkboxes are expanded by the client, so OR matching remains exact
  // and a user can remove one descendant from an otherwise selected branch.
  // Legacy single category/subcategory links remain descendant-aware.
  const categoryFilters = queryList(request.query?.categories);
  const brandFilters = queryList(request.query?.brands);
  const legacyCategoryFilter =
    cleanText(request.query?.subcategory, 180) || cleanText(request.query?.category, 180);
  const [categoryNames, brandNames] = await Promise.all([
    categoryFilters.length > 0
      ? resolveCategoryFilterNames(categoryFilters, {
          includeDescendants: false,
          allowUnknown: false,
        })
      : resolveCategoryFilterNames(legacyCategoryFilter, {
          includeDescendants: true,
          allowUnknown: true,
        }),
    brandFilters.length > 0
      ? resolveBrandFilterNames(brandFilters)
      : resolveCatalogFilter("brand", request.query?.brand).then((brand) =>
          brand ? [brand] : null
        ),
  ]);
  const page = Math.max(Number.parseInt(request.query?.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(request.query?.limit, 10) || 24, 1), 100);
  const priceFilter = buildPriceFilter(priceMin, priceMax);
  const where = {
    status: status || { in: [...PUBLIC_PRODUCT_STATUSES] },
    price: priceFilter,
    ...(ids.length > 0 ? { id: { in: ids } } : {}),
    ...(categoryNames ? { category: { in: categoryNames, mode: "insensitive" } } : {}),
    ...(brandNames ? { brand: { in: brandNames, mode: "insensitive" } } : {}),
    ...(featuredText ? { featured: featuredText === "true" } : {}),
    ...merchandisingValues,
    ...(hasDiscountText ? { salePrice: hasDiscountText === "true" ? { not: null } : null } : {}),
    ...(availability ? { AND: [availability] } : {}),
    ...(search ? {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { brand: { contains: search, mode: "insensitive" } },
        { category: { contains: search, mode: "insensitive" } },
      ],
    } : {}),
  };

  const [products, total, lookups] = await Promise.all([
    prisma.product.findMany({
      where,
      include: publicProductInclude,
      orderBy: PRODUCT_SORT_ORDER_BY[sortKey],
      skip: ids.length > 0 ? 0 : (page - 1) * limit,
      take: ids.length > 0 ? ids.length : limit,
    }),
    prisma.product.count({ where }),
    publicLookups(),
  ]);
  const pricingByProductId = await resolveEffectiveProductPrices(prisma, products);
  return response.json({
    products: products.map((product) =>
      serializePublicProduct(
        product,
        lookups.brandByName,
        lookups.categoryByName,
        pricingByProductId
      )
    ),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

export async function getPublicProduct(request, response) {
  const identifier = cleanText(request.params.identifier, 200);
  if (!identifier) return response.status(404).json({ message: "Product not found." });
  const product = await prisma.product.findFirst({
    where: {
      status: { in: [...PUBLIC_PRODUCT_STATUSES] },
      price: { not: null },
      OR: [
        { id: identifier },
        { slug: { equals: identifier, mode: "insensitive" } },
        { sku: { equals: identifier, mode: "insensitive" } },
      ],
    },
    include: publicProductInclude,
  });
  if (!product) return response.status(404).json({ message: "Product not found." });
  const [lookups, pricingByProductId] = await Promise.all([
    publicLookups(),
    resolveEffectiveProductPrices(prisma, [product]),
  ]);
  return response.json({
    product: serializePublicProduct(
      product,
      lookups.brandByName,
      lookups.categoryByName,
      pricingByProductId
    ),
  });
}

const publicProductWhere = {
  status: { in: [...PUBLIC_PRODUCT_STATUSES] },
  price: { not: null },
};

async function loadCategoryData() {
  const [categories, groups] = await Promise.all([
    prisma.category.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    }),
    prisma.product.groupBy({
      by: ["category"],
      where: { ...publicProductWhere, category: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const directCounts = new Map(
    groups.filter((group) => group.category).map((group) => [group.category.toLowerCase(), group._count._all])
  );
  return { categories, groups, directCounts };
}

function serializePublicCategory(category, parentById, directCounts) {
  const parent = category.parentId ? parentById.get(category.parentId) ?? null : null;
  return {
    id: category.id,
    name: category.name,
    nameAr: category.nameAr ?? null,
    slug: category.slug,
    description: category.description ?? null,
    icon: category.icon ?? null,
    imageUrl: category.imageUrl ?? null,
    parentId: category.parentId ?? null,
    parentSlug: parent?.slug ?? null,
    displayOrder: category.displayOrder ?? 0,
    productCount: directCounts.get(category.name.toLowerCase()) ?? 0,
  };
}

/** Flat list (backwards compatible) with hierarchy fields included. */
export async function getPublicCategories(_request, response) {
  const { categories, groups, directCounts } = await loadCategoryData();
  const categoryByName = recordByName(categories);
  const parentById = new Map(categories.map((category) => [category.id, category]));
  const results = categories.map((category) =>
    serializePublicCategory(category, parentById, directCounts)
  );
  for (const group of groups) {
    if (!group.category || categoryByName.has(group.category.toLowerCase())) continue;
    results.push({
      id: `derived-${slugify(group.category)}`,
      name: group.category,
      nameAr: null,
      slug: slugify(group.category),
      description: null,
      icon: null,
      imageUrl: null,
      parentId: null,
      parentSlug: null,
      displayOrder: 999,
      productCount: group._count._all,
    });
  }
  return response.json({ categories: results });
}

/**
 * GET /api/categories/tree — active categories nested as
 * main -> subcategories -> deeper levels, ordered by displayOrder. Each
 * node's productCount includes all of its descendants.
 */
export async function getPublicCategoryTree(_request, response) {
  const { categories, directCounts } = await loadCategoryData();
  const byParent = childrenByParentId(categories);

  const buildNode = (category) => {
    const children = (byParent.get(category.id) ?? []).map(buildNode);
    const productCount =
      (directCounts.get(category.name.toLowerCase()) ?? 0) +
      children.reduce((sum, child) => sum + child.productCount, 0);
    return {
      id: category.id,
      name: category.name,
      nameAr: category.nameAr ?? null,
      slug: category.slug,
      description: category.description ?? null,
      icon: category.icon ?? null,
      imageUrl: category.imageUrl ?? null,
      displayOrder: category.displayOrder ?? 0,
      productCount,
      children,
    };
  };

  const tree = categories.filter((category) => !category.parentId).map(buildNode);
  return response.json({ categories: tree });
}

export async function getPublicBrands(_request, response) {
  const [brands, groups] = await Promise.all([
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.product.groupBy({
      by: ["brand"],
      where: { ...publicProductWhere, brand: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const brandByName = recordByName(brands);
  const results = brands
    .filter((brand) => brand.status !== "INACTIVE")
    .map((brand) => ({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      country: brand.country ?? null,
      logoUrl: brand.logoUrl ?? null,
      description: brand.description ?? null,
      featured: brand.featured,
      productCount: groups.find((group) => group.brand?.toLowerCase() === brand.name.toLowerCase())?._count._all ?? 0,
    }));
  for (const group of groups) {
    if (!group.brand || brandByName.has(group.brand.toLowerCase())) continue;
    results.push({
      id: `derived-${slugify(group.brand)}`,
      name: group.brand,
      slug: slugify(group.brand),
      country: null,
      logoUrl: null,
      description: null,
      featured: false,
      productCount: group._count._all,
    });
  }
  return response.json({ brands: results.sort((a, b) => a.name.localeCompare(b.name)) });
}
