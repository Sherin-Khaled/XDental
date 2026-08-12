import test from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_PRODUCT_TYPE_FILTERS,
  ADMIN_PRODUCT_STOCK_FILTERS,
  ADMIN_PRODUCT_SORT_FIELDS,
  buildAdminProductWhere,
  buildPaginationMeta,
} from "./adminCatalog.controller.js";

// --- Admin products pagination (launch-performance phase) ----------------
// getAdminProducts used to return every product with no limit (~12,942 rows,
// ~20MB). These tests cover the pure where-clause/pagination-metadata
// builders that replaced that unbounded findMany.

test("ADMIN_PRODUCT_TYPE_FILTERS, ADMIN_PRODUCT_STOCK_FILTERS, and ADMIN_PRODUCT_SORT_FIELDS expose exactly what the frontend sends", () => {
  assert.deepEqual([...ADMIN_PRODUCT_TYPE_FILTERS].sort(), ["all", "simple", "variant"]);
  assert.deepEqual([...ADMIN_PRODUCT_STOCK_FILTERS].sort(), ["all", "lowStock", "outOfStock"]);
  assert.deepEqual(Object.keys(ADMIN_PRODUCT_SORT_FIELDS).sort(), ["name", "price", "stock", "updatedAt"]);
  assert.equal(ADMIN_PRODUCT_SORT_FIELDS.stock, "stockQuantity", "the UI's 'stock' sort key maps to the actual stockQuantity column");
});

test("buildAdminProductWhere returns an empty filter when nothing is selected, matching every product", () => {
  assert.deepEqual(
    buildAdminProductWhere({ status: "", brandName: undefined, categoryName: undefined, sourceSystem: "", productType: "all", stockFilter: "all", search: "" }),
    {}
  );
});

test("buildAdminProductWhere narrows by status, brand, category, and source system independently", () => {
  const where = buildAdminProductWhere({
    status: "ACTIVE",
    brandName: "Voco",
    categoryName: "Endodontics",
    sourceSystem: "TOOTHPICK",
    productType: "all",
    stockFilter: "all",
    search: "",
  });
  assert.deepEqual(where, {
    status: "ACTIVE",
    brand: { equals: "Voco", mode: "insensitive" },
    category: { equals: "Endodontics", mode: "insensitive" },
    sourceSystem: "TOOTHPICK",
  });
});

test("buildAdminProductWhere's productType filter distinguishes simple products from variant parents", () => {
  const simpleOnly = buildAdminProductWhere({ productType: "simple", stockFilter: "all", search: "" });
  const variantOnly = buildAdminProductWhere({ productType: "variant", stockFilter: "all", search: "" });
  assert.deepEqual(simpleOnly, { variants: { none: {} } });
  assert.deepEqual(variantOnly, { variants: { some: {} } });
});

test("buildAdminProductWhere's stockFilter maps lowStock to the LOW_STOCK status and outOfStock to status-or-zero-quantity", () => {
  const lowStock = buildAdminProductWhere({ productType: "all", stockFilter: "lowStock", search: "" });
  const outOfStock = buildAdminProductWhere({ productType: "all", stockFilter: "outOfStock", search: "" });
  assert.deepEqual(lowStock, { status: "LOW_STOCK" });
  assert.deepEqual(outOfStock, { OR: [{ status: "OUT_OF_STOCK" }, { stockQuantity: 0 }] });
});

test("buildAdminProductWhere's search matches name/slug/sku/externalProductId/brand/category and nested variant identifiers", () => {
  const where = buildAdminProductWhere({ productType: "all", stockFilter: "all", search: "z350" });
  assert.ok(Array.isArray(where.OR));
  const fields = where.OR.map((clause) => Object.keys(clause)[0]);
  assert.deepEqual(fields, ["name", "slug", "sku", "externalProductId", "brand", "category", "variants"]);
  const variantClause = where.OR.find((clause) => clause.variants);
  assert.deepEqual(
    variantClause.variants.some.OR.map((clause) => Object.keys(clause)[0]),
    ["sku", "barcode", "externalVariantId"]
  );
});

test("buildPaginationMeta computes total pages and never reports zero pages for an empty result", () => {
  assert.deepEqual(buildPaginationMeta(0, 1, 50), { page: 1, limit: 50, total: 0, pages: 1 });
  assert.deepEqual(buildPaginationMeta(120, 1, 50), { page: 1, limit: 50, total: 120, pages: 3 });
  assert.deepEqual(buildPaginationMeta(101, 2, 50), { page: 2, limit: 50, total: 101, pages: 3 });
});
