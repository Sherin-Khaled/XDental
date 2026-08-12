import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getLocalizedProductDescription, getLocalizedProductName } from "./catalogTranslations.ts";

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), "utf8");
const passthroughTranslate = (_key: string, options?: { fallback?: string }) => options?.fallback ?? "";

const productCard = read("../components/dental/ProductCard.tsx");
const productDetail = read("../pages/product-detail.tsx");
const productEditor = read("../pages/admin/product-editor.tsx");
const adminCatalogService = read("../services/adminCatalog.ts");
const publicCatalogService = read("../services/catalog.ts");
const productType = read("../types/product.ts");
const searchIndex = read("./searchIndex.ts");
const cartPage = read("../pages/cart.tsx");
const checkoutPage = read("../pages/checkout.tsx");
const shippingDeliveryPage = read("../pages/shipping-delivery.tsx");
const productAutocomplete = read("../components/dental/ProductAutocomplete.tsx");
const flashSaleSection = read("./../components/dental/FlashSaleSection.tsx");

// 1: storefront selects the Arabic product name in Arabic mode.
test("getLocalizedProductName prefers the stored Arabic name in Arabic mode and falls back to English otherwise", () => {
  const product = { id: "p1", name: "Filtek Z350", nameAr: "فيلتك Z350" };
  assert.equal(getLocalizedProductName(product, "ar", passthroughTranslate), "فيلتك Z350");
  assert.equal(getLocalizedProductName(product, "en", passthroughTranslate), "Filtek Z350");
});

test("getLocalizedProductName falls back to the English name when nameAr is absent, in either language", () => {
  const product = { id: "p1", name: "Filtek Z350", nameAr: null };
  assert.equal(getLocalizedProductName(product, "ar", passthroughTranslate), "Filtek Z350");
  assert.equal(getLocalizedProductName(product, "en", passthroughTranslate), "Filtek Z350");
});

// 2: storefront selects the Arabic short/long description in Arabic mode.
test("getLocalizedProductDescription prefers the short description for the requested language, falling back to the long description", () => {
  const full = {
    id: "p1",
    description: "Long EN.",
    descriptionAr: "طويل بالعربية.",
    shortDescription: "Short EN.",
    shortDescriptionAr: "قصير بالعربية.",
  };
  assert.equal(getLocalizedProductDescription(full, "ar", passthroughTranslate), "قصير بالعربية.");
  assert.equal(getLocalizedProductDescription(full, "en", passthroughTranslate), "Short EN.");

  const longOnly = { id: "p1", description: "Long EN.", descriptionAr: "طويل بالعربية.", shortDescription: null, shortDescriptionAr: null };
  assert.equal(getLocalizedProductDescription(longOnly, "ar", passthroughTranslate), "طويل بالعربية.");
  assert.equal(getLocalizedProductDescription(longOnly, "en", passthroughTranslate), "Long EN.");
});

test("getLocalizedProductDescription falls back to the legacy per-product i18n dictionary, then the supplied fallback, when no Arabic text is stored", () => {
  const noArabic = { id: "p1", description: null, descriptionAr: null, shortDescription: null, shortDescriptionAr: null };
  assert.equal(getLocalizedProductDescription(noArabic, "ar", passthroughTranslate, "Default text."), "Default text.");
});

// 3: the storefront components actually wire the helpers in, not just define them.
test("ProductCard and product-detail resolve product name and description through the Arabic-aware helper", () => {
  assert.match(productCard, /getLocalizedProductName\(product, language, t\)/);
  assert.match(productDetail, /getLocalizedProductName\(product, language, t\)/);
  assert.match(productDetail, /getLocalizedProductDescription\(product, language, t/);
});

// 3b: every other surface that renders a product name (global search, cart,
// checkout summary/review, fast-delivery cards, product autocomplete) must go
// through the same Arabic-aware helper — a raw `products.items.${id}.name`
// lookup silently skips a product's real nameAr and always shows English.
test("global search, cart, checkout, shipping-delivery cards, and product autocomplete resolve product names through the Arabic-aware helper", () => {
  assert.match(searchIndex, /getLocalizedProductName\(product, language, t\)/);
  assert.match(cartPage, /getLocalizedProductName\(item\.product, language, t\)/);
  assert.doesNotMatch(cartPage, /products\.items\.\$\{item\.product\.id\}\.name/);
  assert.match(checkoutPage, /getLocalizedProductName\(item\.product, language, t\)/);
  assert.doesNotMatch(checkoutPage, /products\.items\.\$\{item\.product\.id\}\.name/);
  assert.match(shippingDeliveryPage, /getLocalizedProductName\(product, language, t\)/);
  assert.match(productAutocomplete, /getLocalizedProductName\(product, language, t\)/);
  assert.match(flashSaleSection, /getLocalizedProductName\(product, language, t\)/);
  assert.doesNotMatch(flashSaleSection, /\{product\.name\}/);
});

// 4: the admin product editor exposes the new bilingual fields, without removing the existing English ones.
test("the admin product editor collects Arabic name and short/long descriptions alongside the existing English fields", () => {
  assert.match(productEditor, /id="name"[\s\S]{0,40}label=\{t\("admin\.products\.productName"\)/);
  assert.match(productEditor, /id="nameAr"/);
  assert.match(productEditor, /id="shortDescription"/);
  assert.match(productEditor, /id="shortDescriptionAr"/);
  assert.match(productEditor, /id="description"[\s\S]{0,40}label=\{t\("admin\.products\.descriptionField"\)/);
  assert.match(productEditor, /id="descriptionAr"/);
});

// 5: the admin/public TypeScript contracts declare the new fields (source-level; full type-checking happens via `tsc`).
test("AdminProduct, AdminProductInput, and the public catalog product type declare the new bilingual fields", () => {
  assert.match(adminCatalogService, /nameAr: string \| null/);
  assert.match(adminCatalogService, /nameAr\?: string/);
  assert.match(adminCatalogService, /descriptionAr: string \| null/);
  assert.match(adminCatalogService, /shortDescription: string \| null/);
  assert.match(adminCatalogService, /shortDescriptionAr: string \| null/);
  assert.match(publicCatalogService, /nameAr: string \| null/);
  assert.match(publicCatalogService, /descriptionAr: string \| null/);
  assert.match(productType, /nameAr\?: string \| null/);
  assert.match(productType, /descriptionAr\?: string \| null/);
});
