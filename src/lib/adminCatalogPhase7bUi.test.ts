import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), "utf8");

const products = read("../pages/admin/products.tsx");
const productEditor = read("../pages/admin/product-editor.tsx");
const variantsPanel = read("../pages/admin/_components/ProductVariantsPanel.tsx");
const imagesPanel = read("../pages/admin/_components/ProductImagesPanel.tsx");
const catalogImport = read("../pages/admin/catalog-import.tsx");
const catalogImportHistory = read("../pages/admin/catalog-import-history.tsx");
const adminLayout = read("../pages/admin/_components/AdminLayout.tsx");
const app = read("../App.tsx");
const en = JSON.parse(read("../locales/en.json"));
const ar = JSON.parse(read("../locales/ar.json"));

function getKey(tree: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object" || !(segment in current)) return undefined;
    return (current as Record<string, unknown>)[segment];
  }, tree);
}

// 1 & 2 & 3: existing simple products still render; variant badge, price range, and total stock are shown.
test("the products list still renders SKU, price, and stock for a simple product, plus a variant badge and range for a variant product", () => {
  assert.match(products, /product\.sku/);
  assert.match(products, /formatPriceCell\(product\)/);
  assert.match(products, /effectiveStock\(product\)/);
  assert.match(products, /product\.hasVariants \? "purple" : "slate"/);
  assert.match(products, /t\("admin\.products\.typeVariant"\)/);
  assert.match(products, /t\("admin\.products\.typeSimple"\)/);
});

// 4 & 5: product create/edit form and simple/variant mode messaging.
test("the product editor's Details form disables simple-only fields and explains fallback pricing for variant products", () => {
  assert.match(productEditor, /disabled=\{summary\?\.hasVariants\}/);
  assert.match(productEditor, /admin\.productEditor\.variantParentPricingNotice/);
  assert.match(productEditor, /admin\.productEditor\.fallbackPriceHint/);
  assert.match(productEditor, /validate\(\)/);
});

// 6 & 7: option and option-value editors.
test("the variant panel provides an option editor and a per-option value editor with validation", () => {
  assert.match(variantsPanel, /createAdminProductOption\(/);
  assert.match(variantsPanel, /createAdminProductOptionValue\(/);
  assert.match(variantsPanel, /admin\.variants\.optionValidation/);
  assert.match(variantsPanel, /admin\.variants\.valueValidation/);
});

// 8, 9, 10: duplicate combination / SKU / barcode errors surface from the backend's safe 409 messages.
test("duplicate combination, SKU, and barcode conflicts from the backend are shown to the operator without a raw Prisma error", () => {
  assert.match(variantsPanel, /extractDuplicateCombinationText/);
  assert.match(variantsPanel, /admin\.variants\.duplicateCombinationError/);
  assert.match(variantsPanel, /safeErrorMessage/);
  assert.doesNotMatch(variantsPanel, /P2002/);
  assert.doesNotMatch(imagesPanel, /P2002/);
  assert.doesNotMatch(catalogImport, /P2002/);
});

// 11: variant price fallback display.
test("a variant with no price override is labeled as using the parent price rather than showing a blank or zero", () => {
  assert.match(variantsPanel, /variant\.priceOverride === null/);
  assert.match(variantsPanel, /admin\.variants\.usesParentPrice/);
});

// 12: variant stock editing.
test("the variant edit dialog includes a stock quantity field validated as a non-negative whole number", () => {
  assert.match(variantsPanel, /edit-stock/);
  assert.match(variantsPanel, /admin\.variants\.stockValidation/);
});

// 13 & 14: image gallery and primary image selection.
test("the image gallery supports adding, reordering, and marking an image primary, scoped to product or a specific variant", () => {
  assert.match(imagesPanel, /createAdminProductGalleryImage\(/);
  assert.match(imagesPanel, /reorderAdminProductGalleryImages\(/);
  assert.match(imagesPanel, /setPrimary/);
  assert.match(imagesPanel, /variantId=\{null\}/);
  assert.match(imagesPanel, /variantId=\{selectedVariantId\}/);
});

// 15: rights-unconfirmed warning, and no misleading publish action.
test("a rights-unconfirmed image is clearly labeled review-only and there is no publish action that would bypass it", () => {
  assert.match(imagesPanel, /admin\.images\.reviewOnlyLabel/);
  assert.match(imagesPanel, /!image\.rightsConfirmed/);
  assert.doesNotMatch(imagesPanel, />Publish</i);
});

// 16: import upload stage.
test("the import upload stage validates each entity's JSON input before preview is allowed", () => {
  assert.match(catalogImport, /parseEntityJsonInput/);
  assert.match(catalogImport, /admin\.catalogImport\.noRowsProvided/);
  assert.match(catalogImport, /admin\.catalogImport\.sourceSystemRequired/);
});

// 17: preview summary cards.
test("the import preview shows total/create/update/skip/conflict/error/warning summary counts", () => {
  for (const key of ["totalRows", "action.CREATE", "action.UPDATE", "action.SKIP", "action.CONFLICT", "action.ERROR", "warnings"]) {
    assert.ok(getKey(en, `admin.catalogImport.${key}`), `missing en key admin.catalogImport.${key}`);
  }
  assert.match(catalogImport, /rowCounts\.CREATE/);
  assert.match(catalogImport, /batch\.warningRows/);
});

// 18: row-action filter tabs.
test("the import preview and history both offer row-action filter tabs driven by the same shared logic", () => {
  assert.match(catalogImport, /IMPORT_ROW_FILTER_TABS/);
  assert.match(catalogImportHistory, /IMPORT_ROW_FILTER_TABS/);
  assert.match(catalogImport, /filterImportRows|filteredRows/);
});

// 19: conflict/error row messages, including the safe duplicate-combination phrasing.
test("import rows show their validation messages, and a duplicate-combination message is rendered without a raw database ID", () => {
  assert.match(catalogImport, /row\.validationMessages\.join/);
  assert.match(catalogImport, /admin\.catalogImport\.duplicateCombinationLabel/);
});

// 20 & 21: Apply is gated and requires explicit confirmation.
test("the Apply button is driven by evaluateApplyGate and a confirmation checkbox, not just row counts", () => {
  assert.match(catalogImport, /evaluateApplyGate\(/);
  assert.match(catalogImport, /disabled=\{!gate\.canApply \|\| isApplying\}/);
  assert.match(catalogImport, /isConfirmed/);
  assert.match(catalogImport, /admin\.catalogImport\.confirmCheckbox/);
});

// 22: applied result.
test("a successfully applied batch shows batch id, applied time, actor, and counts, and offers a fresh start rather than editing the same batch", () => {
  assert.match(catalogImport, /admin\.catalogImport\.batchId/);
  assert.match(catalogImport, /admin\.catalogImport\.appliedAt/);
  assert.match(catalogImport, /admin\.catalogImport\.actor/);
  assert.match(catalogImport, /startOver/);
});

// 23: import history with row-level drill-down, and no delete action.
test("import history lists batches and supports row-level drill-down without offering to delete audit history", () => {
  assert.match(catalogImportHistory, /getAdminCatalogImportBatches/);
  assert.match(catalogImportHistory, /getAdminCatalogImportBatch\(/);
  assert.match(catalogImportHistory, /selectedBatchId/);
  assert.doesNotMatch(catalogImportHistory, /deleteAdminCatalogImportBatch|DELETE.*catalog-imports/);
});

// 24: English/Arabic — every admin.* key referenced by the new pages exists in both locales.
test("every admin.* translation key referenced by the new Phase 7B pages exists in both English and Arabic", () => {
  const files = [products, productEditor, variantsPanel, imagesPanel, catalogImport, catalogImportHistory, adminLayout];
  const staticKeyRe = /t\("(admin\.[a-zA-Z0-9_.]+)"/g;
  const dynamicKeyRe = /t\(`(admin\.[a-zA-Z0-9_.]+)\.\$\{[a-zA-Z_.]+\}`/g;
  const missing: string[] = [];
  for (const source of files) {
    for (const match of source.matchAll(staticKeyRe)) {
      if (getKey(en, match[1]) === undefined) missing.push(`en:${match[1]}`);
      if (getKey(ar, match[1]) === undefined) missing.push(`ar:${match[1]}`);
    }
    for (const match of source.matchAll(dynamicKeyRe)) {
      if (getKey(en, match[1]) === undefined) missing.push(`en:${match[1]}.*`);
      if (getKey(ar, match[1]) === undefined) missing.push(`ar:${match[1]}.*`);
    }
  }
  assert.deepEqual(missing, []);
});

// 25: RTL/LTR — logical properties, not hardcoded left/right.
test("the new Phase 7B pages use logical start/end spacing instead of hardcoded left/right classes", () => {
  const files = { products, productEditor, variantsPanel, imagesPanel, catalogImport, catalogImportHistory };
  for (const [name, source] of Object.entries(files)) {
    assert.doesNotMatch(source, /\b(?:ml|mr|pl|pr)-\[/, `${name} should use ms-/me-/ps-/pe- instead of hardcoded ml-/mr-/pl-/pr-`);
  }
});

// 26: light/dark mode.
test("the new custom summary/status components carry dark: variants, not just the light-mode palette", () => {
  assert.match(productEditor, /function SummaryPill/);
  assert.match(productEditor, /dark:border-white\/10 dark:bg-white\/\[0\.03\]/);
  assert.match(catalogImport, /function SummaryCard/);
  assert.match(catalogImport, /dark:border-\[#43A862\]\/45/);
});

// 27: responsive layout at tablet/laptop widths — grid/flex breakpoints present.
test("the products list and product editor summary use responsive grid breakpoints rather than a fixed-width layout", () => {
  assert.match(products, /xl:grid-cols-4/);
  assert.match(productEditor, /sm:grid-cols-3 lg:grid-cols-6/);
  assert.match(catalogImport, /sm:grid-cols-4 lg:grid-cols-7/);
});

// 28: existing Admin pages remain functional — nav wiring is additive, not a replacement of existing items.
test("existing admin nav items and routes are preserved alongside the new Catalog Import entries", () => {
  for (const existingHref of ["/admin/orders", "/admin/brands", "/admin/categories", "/admin/users", "/admin/settings"]) {
    assert.ok(adminLayout.includes(`href: "${existingHref}"`), `expected existing nav item ${existingHref} to remain`);
    assert.ok(app.includes(`path="${existingHref}"`), `expected existing route ${existingHref} to remain`);
  }
  assert.match(adminLayout, /href: "\/admin\/catalog-import"/);
  assert.match(adminLayout, /href: "\/admin\/catalog-import\/history"/);
  assert.match(app, /path="\/admin\/products\/:id"/);
});

test("catalog-import and catalog-import/history never highlight as active simultaneously (longest-prefix nav match)", () => {
  assert.match(adminLayout, /findActiveNavHref/);
  assert.match(adminLayout, /item\.href\.length > longest\.length/);
});

// ---------------------------------------------------------------------------
// Phase 7B safety/visual-QA correction: no physical product deletion in
// normal workflows, and the JSON import is honestly labeled as a technical,
// non-final format.
// ---------------------------------------------------------------------------

test("the Products list offers no physical Delete action", () => {
  assert.doesNotMatch(products, /deleteAdminProduct/);
  assert.doesNotMatch(products, /admin\.products\.deleteProduct/);
  assert.doesNotMatch(products, /admin\.products\.deleteConfirmation/);
  assert.doesNotMatch(products, /<Trash2/);
  assert.doesNotMatch(products, /setDeleteTarget/);
});

test("no normal product workflow file calls the product DELETE endpoint", () => {
  for (const [name, source] of Object.entries({ products, productEditor, variantsPanel })) {
    assert.doesNotMatch(source, /deleteAdminProduct\(/, `${name} must not call deleteAdminProduct`);
  }
});

test("Activate, Deactivate, and Duplicate as Draft remain the normal product lifecycle actions", () => {
  assert.match(products, /admin\.products\.activate/);
  assert.match(products, /admin\.products\.deactivate/);
  assert.match(products, /toggleActivation/);
  assert.match(products, /admin\.products\.duplicateAsDraft/);
  assert.match(products, /duplicateAsDraft/);
  // Duplicate as Draft reuses the existing create endpoint rather than a new one.
  assert.match(products, /createAdminProduct\(\{/);
});

test("View, Edit, Open Variants, and Open Images remain available per product row", () => {
  assert.match(products, /admin\.products\.view/);
  assert.match(products, /admin\.products\.edit/);
  assert.match(products, /admin\.products\.openVariants/);
  assert.match(products, /admin\.products\.openImages/);
});

test("the import upload stage is clearly labeled Technical JSON Import with an explanation that Excel import is a later phase", () => {
  assert.match(catalogImport, /admin\.catalogImport\.technicalFormatLabel/);
  assert.match(catalogImport, /admin\.catalogImport\.technicalFormatExplanation/);
  assert.equal(getKey(en, "admin.catalogImport.technicalFormatLabel"), "Technical JSON Import");
  assert.equal(getKey(ar, "admin.catalogImport.technicalFormatLabel"), "استيراد JSON تقني");
  assert.match(String(getKey(en, "admin.catalogImport.technicalFormatExplanation")), /next catalog-data phase/);
  assert.match(String(getKey(ar, "admin.catalogImport.technicalFormatExplanation")), /مرحلة بيانات المنتجات التالية/);
});

test("the technical import explanation does not claim JSON is the final client-facing workflow", () => {
  assert.doesNotMatch(catalogImport, />Client Import</);
  assert.doesNotMatch(catalogImport, /final (client|customer) (import|workflow)/i);
});

// Phase 7C adds the pilot .xlsx workbook import alongside the Technical JSON
// Import; CSV import was never introduced anywhere on these pages.
test("catalog import supports .xlsx workbook upload but no CSV upload", () => {
  assert.match(catalogImport, /previewAdminCatalogImportExcel/);
  assert.match(catalogImport, /accept=".xlsx"/);
  for (const source of [catalogImport, catalogImportHistory]) {
    assert.doesNotMatch(source, /\.csv\b|text\/csv/i);
  }
});

// Visual QA correction: the Edit Variant dialog previously used AlertDialog
// (no viewport height cap in the shared component) for a 5-field form, which
// could overflow a short viewport. It must use the viewport-safe Dialog
// pattern already established by the product create/edit form.
test("the Edit Variant dialog uses the viewport-safe Dialog pattern, not an unbounded AlertDialog", () => {
  assert.match(variantsPanel, /max-h-\[calc\(100dvh-2rem\)\]/);
  assert.match(variantsPanel, /overflow-y-auto overflow-x-hidden px-6 py-5/);
  assert.match(variantsPanel, /<Dialog open onOpenChange/);
});

// Visual QA correction: back/forward chevrons must flip in RTL like every
// other directional icon in this codebase (see DirectionalIcon.tsx).
test("back and forward navigation icons use DirectionalIcon instead of a hardcoded chevron", () => {
  for (const [name, source] of Object.entries({ productEditor, catalogImportHistory, catalogImport })) {
    assert.doesNotMatch(source, /<ChevronLeft\b|<ChevronRight\b/, `${name} should use DirectionalIcon, not a hardcoded chevron`);
  }
  assert.match(productEditor, /direction="back" family="chevron"/);
  assert.match(catalogImportHistory, /direction="back" family="chevron"/);
  assert.match(catalogImport, /direction="forward" family="chevron"/);
});

// Visual QA correction: a long product name must not force horizontal page
// overflow in the editor header (min-w-0 on the flex chain + truncate).
test("the product editor header contains long product names instead of overflowing", () => {
  assert.match(productEditor, /flex min-w-0 flex-col gap-4 sm:flex-row/);
  assert.match(productEditor, /flex min-w-0 items-center gap-4/);
  assert.match(productEditor, /mt-1 truncate text-2xl font-bold/);
});
