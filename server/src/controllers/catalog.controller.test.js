import test from "node:test";
import assert from "node:assert/strict";
import {
  isPubliclyAvailable,
  serializePublicProduct,
  buildPriceFilter,
  queryList,
  PRODUCT_SORT_ORDER_BY,
} from "./catalog.controller.js";

function simpleProduct(overrides = {}) {
  return {
    id: "product-1",
    sku: "SKU-1",
    slug: "simple-product",
    name: "Simple Product",
    brand: null,
    category: null,
    price: 100,
    stockQuantity: 10,
    status: "ACTIVE",
    imageUrl: "https://legacy.example/fallback.jpg",
    images: [],
    description: null,
    featured: false,
    isWeeklyOffer: false,
    isBestSeller: false,
    isNewArrival: false,
    isHotDeal: false,
    isFastDelivery: false,
    purchaseMode: "STANDARD",
    isAvailable: true,
    options: [],
    variants: [],
    ...overrides,
  };
}

function option(code, values) {
  return { code, nameEn: code, nameAr: null, sortOrder: 0, values };
}
function optionValue(code) {
  return { code, valueEn: code, valueAr: null, displayHex: null, sortOrder: 0 };
}
function variant(overrides = {}) {
  return {
    id: `variant-${overrides.sku ?? "x"}`,
    sku: null,
    nameEn: null,
    nameAr: null,
    priceOverride: null,
    stockQuantity: 5,
    lowStockThreshold: 5,
    status: "ACTIVE",
    isAvailable: true,
    selections: [],
    ...overrides,
  };
}

test("a simple product with no variants and no gallery serializes using legacy imageUrl and stockQuantity", () => {
  const product = simpleProduct();
  const serialized = serializePublicProduct(product);
  assert.equal(serialized.hasVariants, false);
  assert.equal(serialized.price, 100);
  assert.equal(serialized.basePrice, 100);
  assert.equal(serialized.effectivePrice, 100);
  assert.equal(serialized.maxPrice, null);
  assert.equal(serialized.stockQuantity, 10);
  assert.equal(serialized.stock, 10);
  assert.equal(serialized.imageUrl, "https://legacy.example/fallback.jpg");
  assert.deepEqual(serialized.variants, undefined);
  assert.equal(serialized.available, true);
  assert.equal(serialized.isAvailable, true);
});

test("the public serializer keeps merchandising flags and purchase mode independent", () => {
  const serialized = serializePublicProduct(simpleProduct({
    isWeeklyOffer: true,
    isBestSeller: false,
    isNewArrival: true,
    isHotDeal: false,
    isFastDelivery: true,
    purchaseMode: "INQUIRY",
  }));
  assert.equal(serialized.isWeeklyOffer, true);
  assert.equal(serialized.isBestSeller, false);
  assert.equal(serialized.isNewArrival, true);
  assert.equal(serialized.isHotDeal, false);
  assert.equal(serialized.isFastDelivery, true);
  assert.equal(serialized.purchaseMode, "INQUIRY");
});

test("the public API serializer returns base, sale, and effective prices", () => {
  const product = simpleProduct({ price: 100, salePrice: 75 });
  const pricing = new Map([[product.id, {
    basePrice: 100,
    salePrice: 75,
    effectivePrice: 75,
    price: 75,
    originalPrice: 100,
    flashSale: null,
  }]]);
  const serialized = serializePublicProduct(product, new Map(), new Map(), pricing);
  assert.equal(serialized.basePrice, 100);
  assert.equal(serialized.salePrice, 75);
  assert.equal(serialized.effectivePrice, 75);
  assert.equal(serialized.price, 75);
  assert.equal(serialized.originalPrice, 100);
});

test("isPubliclyAvailable is false when out of stock, inactive, or explicitly unavailable", () => {
  assert.equal(isPubliclyAvailable(simpleProduct({ stockQuantity: 0 })), false);
  assert.equal(isPubliclyAvailable(simpleProduct({ status: "DRAFT" })), false);
  assert.equal(isPubliclyAvailable(simpleProduct({ isAvailable: false })), false);
  assert.equal(isPubliclyAvailable(simpleProduct()), true);
});

// Launch-readiness correction: a DRAFT pilot product with real stock on hand
// (e.g. Inventory already staged 3 units) must still never be orderable —
// status alone gates public availability, stock quantity does not override it.
test("a DRAFT product with stock 3 remains unavailable to public ordering", () => {
  const product = simpleProduct({ status: "DRAFT", isAvailable: false, stockQuantity: 3 });
  assert.equal(isPubliclyAvailable(product), false);
  const serialized = serializePublicProduct(product);
  assert.equal(serialized.available, false);
  assert.equal(serialized.isAvailable, false);
});

// Launch-readiness correction: bilingual product fields (name/short/long
// description) are returned by the public serializer alongside the existing
// English ones, following the same name/nameAr pairing Brand and Category use.
test("the public product serializer returns Arabic name, short description, and long description alongside the English fields", () => {
  const product = simpleProduct({
    name: "Filtek Z350",
    nameAr: "فيلتك Z350",
    description: "Long English description.",
    descriptionAr: "وصف طويل بالعربية.",
    shortDescription: "Short English description.",
    shortDescriptionAr: "وصف قصير بالعربية.",
  });
  const serialized = serializePublicProduct(product);
  assert.equal(serialized.name, "Filtek Z350");
  assert.equal(serialized.nameAr, "فيلتك Z350");
  assert.equal(serialized.description, "Long English description.");
  assert.equal(serialized.descriptionAr, "وصف طويل بالعربية.");
  assert.equal(serialized.shortDescription, "Short English description.");
  assert.equal(serialized.shortDescriptionAr, "وصف قصير بالعربية.");
});

test("Arabic product fields are null, not undefined, when absent, so the shape is stable for every product", () => {
  const serialized = serializePublicProduct(simpleProduct());
  assert.equal(serialized.nameAr, null);
  assert.equal(serialized.descriptionAr, null);
  assert.equal(serialized.shortDescription, null);
  assert.equal(serialized.shortDescriptionAr, null);
});

test("a product with one option dimension exposes effective min/max price, total sellable stock, and a concise option summary", () => {
  const shadeOption = option("SHADE", [optionValue("A1"), optionValue("A2")]);
  const product = simpleProduct({
    price: 100,
    options: [shadeOption],
    variants: [
      variant({ id: "v-a1", sku: "SKU-1-A1", priceOverride: 90, stockQuantity: 4, selections: [{ option: shadeOption, optionValue: optionValue("A1") }] }),
      variant({ id: "v-a2", sku: "SKU-1-A2", priceOverride: 120, stockQuantity: 6, selections: [{ option: shadeOption, optionValue: optionValue("A2") }] }),
    ],
  });
  const serialized = serializePublicProduct(product);
  assert.equal(serialized.hasVariants, true);
  assert.equal(serialized.price, 90, "effective minimum price across sellable variants");
  assert.equal(serialized.maxPrice, 120, "effective maximum price when variants differ");
  assert.equal(serialized.stockQuantity, 10, "total sellable stock across variants");
  assert.deepEqual(serialized.optionSummary, ["SHADE"]);
  assert.equal(serialized.variants.length, 2);
});

test("a product with multiple option dimensions returns valid variant combinations with resolved option values", () => {
  const shade = option("SHADE", [optionValue("A1")]);
  const size = option("SIZE", [optionValue("L")]);
  const product = simpleProduct({
    options: [shade, size],
    variants: [
      variant({
        id: "v-1", sku: "SKU-1-A1-L", stockQuantity: 3,
        selections: [
          { option: shade, optionValue: optionValue("A1") },
          { option: size, optionValue: optionValue("L") },
        ],
      }),
    ],
  });
  const serialized = serializePublicProduct(product);
  assert.equal(serialized.variants[0].selectedOptions.length, 2);
  assert.deepEqual(serialized.variants[0].selectedOptions.map((s) => s.code), ["SHADE", "SIZE"]);
});

test("variant price falls back to the parent price only when no override is set", () => {
  const shade = option("SHADE", [optionValue("A1")]);
  const product = simpleProduct({
    price: 100,
    options: [shade],
    variants: [variant({ id: "v-1", priceOverride: null, stockQuantity: 2, selections: [{ option: shade, optionValue: optionValue("A1") }] })],
  });
  const serialized = serializePublicProduct(product);
  assert.equal(serialized.variants[0].price, 100);
});

test("variant price override takes precedence over the parent price", () => {
  const shade = option("SHADE", [optionValue("A1")]);
  const product = simpleProduct({
    price: 100,
    options: [shade],
    variants: [variant({ id: "v-1", priceOverride: 150, stockQuantity: 2, selections: [{ option: shade, optionValue: optionValue("A1") }] })],
  });
  const serialized = serializePublicProduct(product);
  assert.equal(serialized.variants[0].price, 150);
});

test("variant stock and availability appear in the catalog response and unsellable variants are excluded", () => {
  const shade = option("SHADE", [optionValue("A1"), optionValue("A2")]);
  const product = simpleProduct({
    options: [shade],
    variants: [
      variant({ id: "v-in", stockQuantity: 5, selections: [{ option: shade, optionValue: optionValue("A1") }] }),
      variant({ id: "v-out", stockQuantity: 0, isAvailable: false, selections: [{ option: shade, optionValue: optionValue("A2") }] }),
    ],
  });
  const serialized = serializePublicProduct(product);
  assert.equal(serialized.variants.length, 1, "only sellable variants are exposed");
  assert.equal(serialized.variants[0].stockQuantity, 5);
  assert.equal(serialized.variants[0].available, true);
});

test("a variant-specific image leads that variant's gallery; rights-unconfirmed images are hidden publicly", () => {
  const shade = option("SHADE", [optionValue("A1")]);
  const variantWithImage = variant({
    id: "v-1", stockQuantity: 2,
    selections: [{ option: shade, optionValue: optionValue("A1") }],
  });
  const product = simpleProduct({
    imageUrl: null,
    options: [shade],
    variants: [variantWithImage],
    images: [
      { url: "https://public.example/shared.jpg", variantId: null, isPrimary: true, sortOrder: 0, rightsConfirmed: true },
      { url: "https://public.example/variant-only.jpg", variantId: "v-1", isPrimary: false, sortOrder: 0, rightsConfirmed: true },
      { url: "https://review.example/unapproved.jpg", variantId: "v-1", isPrimary: false, sortOrder: 1, rightsConfirmed: false },
    ],
  });
  const serialized = serializePublicProduct(product);
  const galleryUrls = serialized.variants[0].images.map((image) => image.url);
  assert.ok(galleryUrls.includes("https://public.example/variant-only.jpg"));
  assert.equal(galleryUrls.includes("https://review.example/unapproved.jpg"), false, "rights-unconfirmed images must never reach the public catalog");
  assert.equal(serialized.images.includes("https://review.example/unapproved.jpg"), false);
});

test("a product with no ProductImage rows falls back to the legacy imageUrl", () => {
  const product = simpleProduct({ imageUrl: "https://legacy.example/only.jpg", images: [] });
  const serialized = serializePublicProduct(product);
  assert.equal(serialized.imageUrl, "https://legacy.example/only.jpg");
  assert.deepEqual(serialized.images, ["https://legacy.example/only.jpg"]);
});

// --- Public catalogue pagination/search (launch-performance phase) -------

test("buildPriceFilter merges priceMin and priceMax into a single price where-clause instead of one overwriting the other", () => {
  assert.deepEqual(buildPriceFilter(null, null), { not: null });
  assert.deepEqual(buildPriceFilter(50, null), { not: null, gte: 50 });
  assert.deepEqual(buildPriceFilter(null, 200), { not: null, lte: 200 });
  assert.deepEqual(buildPriceFilter(50, 200), { not: null, gte: 50, lte: 200 });
});

test("PRODUCT_SORT_ORDER_BY exposes exactly the four sort keys the frontend sends, each a valid Prisma orderBy array", () => {
  assert.deepEqual(Object.keys(PRODUCT_SORT_ORDER_BY).sort(), ["name", "price-high", "price-low", "recommended"]);
  for (const orderBy of Object.values(PRODUCT_SORT_ORDER_BY)) {
    assert.ok(Array.isArray(orderBy) && orderBy.length > 0);
  }
  assert.deepEqual(PRODUCT_SORT_ORDER_BY["price-low"], [{ price: "asc" }, { name: "asc" }]);
  assert.deepEqual(PRODUCT_SORT_ORDER_BY["price-high"], [{ price: "desc" }, { name: "asc" }]);
});

test("queryList bounds a batch-id lookup to maxItems so ids can never become an unbounded full-catalog fetch", () => {
  const manyIds = Array.from({ length: 250 }, (_, index) => `id-${index}`);
  const bounded = queryList(manyIds.join(","), 100);
  assert.equal(bounded.length, 100);
  assert.deepEqual(bounded, manyIds.slice(0, 100));
});

test("queryList de-duplicates, trims, and drops empty entries", () => {
  assert.deepEqual(queryList(" a , b,a ,, c "), ["a", "b", "c"]);
  assert.deepEqual(queryList(undefined), []);
  assert.deepEqual(queryList(""), []);
});
