import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This phase removed the full-catalogue (~12,942 product) preload/fetch and
// replaced every consumer with small, bounded, server-paginated/searched
// requests. Source-level checks (matching this repo's existing pattern in
// catalogLaunchReadiness.test.ts) verify the wiring survives future edits,
// since the app's .tsx entry points can't be executed directly by the plain
// Node test runner.

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), "utf8");

const catalogService = read("../services/catalog.ts");
const catalogContext = read("../context/CatalogContext.tsx");
const productsPage = read("../pages/products.tsx");
const productDetailPage = read("../pages/product-detail.tsx");
const globalSearch = read("../components/dental/GlobalSearch.tsx");
const productAutocomplete = read("../components/dental/ProductAutocomplete.tsx");
const adminProductsPage = read("../pages/admin/products.tsx");
const adminCatalogService = read("../services/adminCatalog.ts");
const homePage = read("../pages/home.tsx");
const cartPage = read("../pages/cart.tsx");
const shippingDeliveryPage = read("../pages/shipping-delivery.tsx");

test("the full-catalogue fetch helper no longer exists anywhere in the frontend", () => {
  assert.doesNotMatch(catalogService, /fetchAllPublicProducts/);
  for (const source of [
    catalogContext,
    productsPage,
    productDetailPage,
    globalSearch,
    productAutocomplete,
    homePage,
    cartPage,
    shippingDeliveryPage,
  ]) {
    assert.doesNotMatch(source, /fetchAllPublicProducts/);
  }
});

test("CatalogContext only loads categories/brands metadata, never a product array", () => {
  assert.doesNotMatch(catalogContext, /fetchPublicProducts\(/);
  assert.doesNotMatch(catalogContext, /\bproducts:\s*Product\[\]/);
  assert.doesNotMatch(catalogContext, /findProduct/);
  assert.match(catalogContext, /fetchPublicCategories/);
  assert.match(catalogContext, /fetchPublicCategoryTree/);
  assert.match(catalogContext, /fetchPublicBrands/);
});

test("fetchPublicProducts defaults to a realistic page size, not a bulk/full-catalog size", () => {
  assert.match(catalogService, /limit\s*\?\?\s*24/);
});

test("fetchPublicProductsByIds bounds a batch lookup to the requested ids, never fetching more", () => {
  assert.match(catalogService, /export async function fetchPublicProductsByIds/);
  assert.match(catalogService, /Math\.min\(ids\.length,\s*100\)/);
});

test("/products fetches one server-paginated page and exposes a working load-more, not a client-side loop over every page", () => {
  assert.match(productsPage, /fetchPublicProducts\(/);
  assert.match(productsPage, /page:\s*1,\s*limit:\s*PRODUCTS_PAGE_SIZE/);
  assert.match(productsPage, /handleLoadMore/);
  assert.doesNotMatch(productsPage, /while\s*\(/);
  assert.doesNotMatch(productsPage, /for\s*\(.*page/i);
});

test("product-detail fetches a single product by id/slug and never depends on a full catalog array or findProduct", () => {
  assert.match(productDetailPage, /fetchPublicProduct\(id/);
  assert.doesNotMatch(productDetailPage, /findProduct/);
  assert.doesNotMatch(productDetailPage, /useCatalog\(\)/);
});

test("GlobalSearch debounces server product search, cancels stale requests, and requests a small bounded limit", () => {
  assert.match(globalSearch, /window\.setTimeout/);
  assert.match(globalSearch, /AbortController/);
  assert.match(globalSearch, /PRODUCT_SEARCH_FETCH_LIMIT\s*=\s*10/);
  assert.match(globalSearch, /PRODUCT_SEARCH_MIN_QUERY_LENGTH/);
});

test("ProductAutocomplete debounces server product search and requests a small bounded limit", () => {
  assert.match(productAutocomplete, /window\.setTimeout/);
  assert.match(productAutocomplete, /AbortController/);
  assert.match(productAutocomplete, /AUTOCOMPLETE_LIMIT\s*=\s*8/);
  assert.match(productAutocomplete, /AUTOCOMPLETE_MIN_QUERY_LENGTH/);
  assert.doesNotMatch(productAutocomplete, /useCatalog\(\)/);
});

test("the admin products page requests one server-paginated, server-sorted, server-filtered page instead of client-side filtering/sorting/paginating a full list", () => {
  assert.match(adminProductsPage, /getAdminProducts\(\{/);
  assert.match(adminProductsPage, /page,\s*\n\s*limit: PAGE_SIZE/);
  assert.doesNotMatch(adminProductsPage, /applyAdminProductFilters/);
  assert.doesNotMatch(adminProductsPage, /sortAdminProducts/);
  assert.doesNotMatch(adminProductsPage, /paginateItems/);
});

test("the admin products service sends server-side pagination and filter params and returns pagination metadata", () => {
  assert.match(adminCatalogService, /params\.set\("page"/);
  assert.match(adminCatalogService, /params\.set\("limit"/);
  assert.match(adminCatalogService, /pagination: \{ page: number; limit: number; total: number; pages: number \}/);
});
