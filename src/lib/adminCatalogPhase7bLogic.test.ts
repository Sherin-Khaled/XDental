import test from "node:test";
import assert from "node:assert/strict";
import {
  combinationDisplayLabel,
  combinationSignature,
  extractDuplicateCombinationText,
  findDuplicateSignatures,
  generateVariantCombinations,
} from "./adminVariantCombinations.ts";
import {
  applyAdminProductFilters,
  collectSourceSystems,
  effectivePrice,
  effectiveStock,
  isLowStock,
  isOutOfStock,
  paginateItems,
  sortAdminProducts,
  type AdminProductListItem,
} from "./adminProductFilters.ts";
import {
  countImportRowsByAction,
  evaluateApplyGate,
  filterImportRows,
  hasWarning,
  parseEntityJsonInput,
} from "./adminCatalogImportUi.ts";
import type { CatalogImportRow } from "../services/adminCatalogImport.ts";

// ---------------------------------------------------------------------------
// Variant combinations
// ---------------------------------------------------------------------------

test("combinationSignature is order-independent and matches the backend's canonical format", () => {
  const a = combinationSignature([{ optionCode: "shade", valueCode: "a1" }, { optionCode: "SIZE", valueCode: "MEDIUM" }]);
  const b = combinationSignature([{ optionCode: "SIZE", valueCode: "medium" }, { optionCode: "SHADE", valueCode: "A1" }]);
  assert.equal(a, b);
  assert.equal(a, "SHADE=A1, SIZE=MEDIUM");
});

test("combinationDisplayLabel produces a friendly, sorted, human-readable label", () => {
  const label = combinationDisplayLabel([
    { optionNameEn: "Pack Size", valueEn: "6" },
    { optionNameEn: "Shade", valueEn: "A1" },
  ]);
  assert.equal(label, "Pack Size 6 / Shade A1");
});

test("generateVariantCombinations produces the cartesian product across selected option values only", () => {
  const options = [
    { id: "opt-shade", code: "SHADE", nameEn: "Shade", values: [{ id: "v-a1", code: "A1", valueEn: "A1" }, { id: "v-a2", code: "A2", valueEn: "A2" }] },
    { id: "opt-size", code: "SIZE", nameEn: "Size", values: [{ id: "v-s", code: "S", valueEn: "Small" }, { id: "v-m", code: "M", valueEn: "Medium" }] },
  ];
  const combinations = generateVariantCombinations(options, { "opt-shade": ["v-a1", "v-a2"], "opt-size": ["v-s"] });
  assert.equal(combinations.length, 2);
  assert.deepEqual(combinations.map((c) => c.signature).sort(), ["SHADE=A1, SIZE=S", "SHADE=A2, SIZE=S"]);
});

test("generateVariantCombinations skips option dimensions with nothing selected rather than producing zero rows", () => {
  const options = [
    { id: "opt-shade", code: "SHADE", nameEn: "Shade", values: [{ id: "v-a1", code: "A1", valueEn: "A1" }] },
    { id: "opt-size", code: "SIZE", nameEn: "Size", values: [{ id: "v-s", code: "S", valueEn: "Small" }] },
  ];
  const combinations = generateVariantCombinations(options, { "opt-shade": ["v-a1"] });
  assert.equal(combinations.length, 1);
  assert.equal(combinations[0].signature, "SHADE=A1");
});

test("generateVariantCombinations returns nothing when no option has a selected value", () => {
  const options = [{ id: "opt-shade", code: "SHADE", nameEn: "Shade", values: [{ id: "v-a1", code: "A1", valueEn: "A1" }] }];
  assert.deepEqual(generateVariantCombinations(options, {}), []);
});

test("findDuplicateSignatures flags every signature that appears more than once, not just the second occurrence", () => {
  const duplicates = findDuplicateSignatures([
    { signature: "SHADE=A1" },
    { signature: "SHADE=A2" },
    { signature: "SHADE=A1" },
  ]);
  assert.equal(duplicates.size, 1);
  assert.ok(duplicates.has("SHADE=A1"));
  assert.equal(duplicates.has("SHADE=A2"), false);
});

test("extractDuplicateCombinationText parses the backend's safe conflict message and returns null otherwise", () => {
  assert.equal(
    extractDuplicateCombinationText("Duplicate variant combination for this product: SHADE=A1, SIZE=MEDIUM"),
    "SHADE=A1, SIZE=MEDIUM"
  );
  assert.equal(extractDuplicateCombinationText("Variant SKU already exists."), null);
});

// ---------------------------------------------------------------------------
// Admin product list filtering/sorting/pagination
// ---------------------------------------------------------------------------

function product(overrides: Partial<AdminProductListItem> = {}): AdminProductListItem {
  return {
    id: "product-1",
    name: "Composite Bur",
    sku: "SKU-1",
    externalProductId: null,
    status: "ACTIVE",
    isAvailable: true,
    price: 100,
    stock: 10,
    brand: null,
    category: null,
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

test("a simple product's effective price and stock come from its own fields", () => {
  const simple = product({ price: 150, stock: 8, hasVariants: false });
  assert.deepEqual(effectivePrice(simple), { min: 150, max: 150 });
  assert.equal(effectiveStock(simple), 8);
});

test("a simple discounted product's admin list price uses its effective selling price", () => {
  const discounted = product({ price: 150, effectivePrice: 120, stock: 8, hasVariants: false });
  assert.deepEqual(effectivePrice(discounted), { min: 120, max: 120 });
});

test("a variant product's effective price range and total stock come from the variant summary, not the parent fields", () => {
  const variantProduct = product({ price: 999, stock: 999, hasVariants: true, priceMin: 80, priceMax: 120, totalStock: 14 });
  assert.deepEqual(effectivePrice(variantProduct), { min: 80, max: 120 });
  assert.equal(effectiveStock(variantProduct), 14);
});

test("isLowStock and isOutOfStock read the authoritative status field, matching backend-derived state", () => {
  assert.equal(isLowStock(product({ status: "LOW_STOCK" })), true);
  assert.equal(isLowStock(product({ status: "ACTIVE" })), false);
  assert.equal(isOutOfStock(product({ status: "OUT_OF_STOCK" })), true);
  assert.equal(isOutOfStock(product({ hasVariants: true, totalStock: 0, status: "ACTIVE" })), true);
});

test("applyAdminProductFilters filters by product type, stock level, and source system independently", () => {
  const products = [
    product({ id: "simple", hasVariants: false }),
    product({ id: "variant", hasVariants: true, priceMin: 1, priceMax: 1, totalStock: 1 }),
    product({ id: "low", status: "LOW_STOCK" }),
    product({ id: "owner-sourced", sourceSystem: "OWNER" }),
  ];

  assert.deepEqual(applyAdminProductFilters(products, { productType: "simple", stockFilter: "all", sourceSystem: "all" }).map((p) => p.id), ["simple", "low", "owner-sourced"]);
  assert.deepEqual(applyAdminProductFilters(products, { productType: "variant", stockFilter: "all", sourceSystem: "all" }).map((p) => p.id), ["variant"]);
  assert.deepEqual(applyAdminProductFilters(products, { productType: "all", stockFilter: "lowStock", sourceSystem: "all" }).map((p) => p.id), ["low"]);
  assert.deepEqual(applyAdminProductFilters(products, { productType: "all", stockFilter: "all", sourceSystem: "OWNER" }).map((p) => p.id), ["owner-sourced"]);
});

test("sortAdminProducts sorts by the effective (variant-aware) price and stock, and reverses direction on desc", () => {
  const products = [
    product({ id: "a", price: 300 }),
    product({ id: "b", price: 100 }),
    product({ id: "c", price: 200 }),
  ];
  assert.deepEqual(sortAdminProducts(products, "price", "asc").map((p) => p.id), ["b", "c", "a"]);
  assert.deepEqual(sortAdminProducts(products, "price", "desc").map((p) => p.id), ["a", "c", "b"]);
});

test("paginateItems clamps to a valid page and reports the correct page count", () => {
  const items = Array.from({ length: 45 }, (_, index) => index);
  const first = paginateItems(items, 1, 20);
  assert.equal(first.pageItems.length, 20);
  assert.equal(first.pageCount, 3);

  const outOfRange = paginateItems(items, 99, 20);
  assert.equal(outOfRange.page, 3);
  assert.equal(outOfRange.pageItems.length, 5);
});

test("collectSourceSystems returns the unique, sorted, non-empty source systems present", () => {
  const products = [product({ sourceSystem: "OWNER" }), product({ sourceSystem: "OWNER" }), product({ sourceSystem: "TOOTHPICK" }), product({ sourceSystem: null })];
  assert.deepEqual(collectSourceSystems(products), ["OWNER", "TOOTHPICK"]);
});

// ---------------------------------------------------------------------------
// Import Center: preview summary, row filters, and the apply gate
// ---------------------------------------------------------------------------

function importRow(overrides: Partial<CatalogImportRow> = {}): CatalogImportRow {
  return {
    id: "row-1",
    entityType: "PRODUCTS",
    rowNumber: 2,
    externalId: null,
    sku: "SKU-1",
    action: "CREATE",
    validationMessages: [],
    ...overrides,
  };
}

test("countImportRowsByAction tallies every action, including zero counts for actions absent from the batch", () => {
  const counts = countImportRowsByAction([importRow({ action: "CREATE" }), importRow({ action: "CREATE" }), importRow({ action: "SKIP" })]);
  assert.deepEqual(counts, { CREATE: 2, UPDATE: 0, SKIP: 1, CONFLICT: 0, ERROR: 0 });
});

test("filterImportRows returns every row for 'all' and only matching rows for a specific action", () => {
  const rows = [importRow({ action: "CREATE" }), importRow({ action: "ERROR" })];
  assert.equal(filterImportRows(rows, "all").length, 2);
  assert.equal(filterImportRows(rows, "ERROR").length, 1);
});

test("hasWarning is true only for a non-blocking row that still carries a validation message", () => {
  assert.equal(hasWarning(importRow({ action: "CREATE", validationMessages: ["Image rights are unconfirmed."] })), true);
  assert.equal(hasWarning(importRow({ action: "CREATE", validationMessages: [] })), false);
  assert.equal(hasWarning(importRow({ action: "ERROR", validationMessages: ["Something is wrong."] })), false);
});

test("evaluateApplyGate blocks apply for every unsafe state and only allows it once every condition clears", () => {
  assert.equal(evaluateApplyGate(null, 0, false, true).canApply, false);
  assert.equal(evaluateApplyGate(null, 0, false, true).reason, "NO_PREVIEW");

  const batch = { status: "PREVIEW" as const, errorRows: 0 };
  assert.equal(evaluateApplyGate({ ...batch, status: "APPLIED" }, 0, false, true).reason, "ALREADY_APPLIED");
  assert.equal(evaluateApplyGate(batch, 0, true, true).reason, "STALE_PREVIEW");
  assert.equal(evaluateApplyGate({ ...batch, errorRows: 1 }, 0, false, true).reason, "HAS_ERRORS");
  assert.equal(evaluateApplyGate(batch, 1, false, true).reason, "HAS_CONFLICTS");
  assert.equal(evaluateApplyGate(batch, 0, false, false).reason, "CONFIRMATION_REQUIRED");
  assert.equal(evaluateApplyGate(batch, 0, false, true).canApply, true);
});

test("parseEntityJsonInput accepts a JSON array of row objects and rejects everything else", () => {
  assert.deepEqual(parseEntityJsonInput(""), { ok: true, rows: [] });
  assert.deepEqual(parseEntityJsonInput('[{"sku":"A"}]'), { ok: true, rows: [{ sku: "A" }] });
  assert.equal(parseEntityJsonInput("{not json").ok, false);
  assert.equal(parseEntityJsonInput('{"sku":"A"}').ok, false);
  assert.equal(parseEntityJsonInput("[1, 2, 3]").ok, false);
});
