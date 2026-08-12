import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { previewCatalogImportFromExcel } from "./catalogImportExcel.service.js";
import { applyCatalogImportBatch } from "./catalogImport.service.js";

// ---------------------------------------------------------------------------
// Minimal valid-template header sets, mirroring the real X_Dental_Catalog_LIVE
// workbook's row-2 headers exactly (title row 1, headers row 2, data from row 3).
// ---------------------------------------------------------------------------
const HEADERS = {
  Brands: ["brand_id *", "brand_name_en *", "brand_name_ar *", "brand_slug", "country_of_origin", "brand_website", "logo_file_name", "image_rights_confirmed *", "sort_order", "status *", "import_action *", "internal_notes"],
  Categories: ["category_id *", "parent_category_id", "category_level *", "category_name_en *", "category_name_ar *", "category_slug", "description_en", "description_ar", "sort_order", "show_in_menu *", "status *", "import_action *", "internal_notes"],
  Products: ["product_id *", "product_sku *", "product_type *", "product_name_en *", "product_name_ar *", "brand_id *", "category_id *", "secondary_category_ids", "short_description_en", "short_description_ar", "long_description_en", "long_description_ar", "unit_of_measure *", "base_price *", "sale_price", "currency *", "tax_class", "barcode", "manufacturer_part_number", "country_of_origin", "storage_condition", "is_expiry_tracked", "shelf_life_months", "registration_number", "requires_prescription", "weight_grams", "length_mm", "width_mm", "height_mm", "availability *", "min_order_qty", "max_order_qty", "meta_title_en", "meta_title_ar", "meta_description_en", "meta_description_ar", "search_keywords", "image_rights_confirmed *", "status *", "import_action *", "internal_notes"],
  ProductOptions: ["option_id *", "product_id *", "option_code *", "option_name_en *", "option_name_ar *", "display_type *", "is_required_at_checkout *", "sort_order", "help_text_en", "help_text_ar", "import_action *", "internal_notes"],
  OptionValues: ["value_id *", "option_id *", "value_code *", "value_en *", "value_ar *", "swatch_hex", "swatch_image_file_name", "sort_order", "status *", "import_action *", "internal_notes"],
  Variants: ["variant_id *", "product_id *", "variant_sku *", "barcode", "variant_name_en", "variant_name_ar", "price *", "sale_price", "currency *", "cost_price", "weight_grams", "availability *", "is_default_variant *", "primary_image_file_name", "expiry_date", "lot_number", "status *", "import_action *", "internal_notes"],
  VariantOptionValues: ["link_id *", "variant_id *", "option_id *", "value_id *", "sort_order", "import_action *", "internal_notes"],
  Images: ["image_id *", "owner_type *", "owner_id *", "image_file_name *", "image_type *", "alt_text_en", "alt_text_ar", "caption_en", "caption_ar", "is_primary *", "sort_order", "image_rights_confirmed *", "rights_holder", "import_action *", "internal_notes", "image_url"],
  Inventory: ["inventory_id *", "variant_sku", "location_code", "stock_quantity *", "reserved_quantity", "low_stock_threshold", "backorder_policy", "lead_time_days", "expected_restock_date", "availability_override", "bin_location", "import_action *", "internal_notes", "external_product_id", "external_variant_id"],
};

function normalizeHeader(value) {
  return String(value).replace(/\s*\*\s*$/, "").trim();
}

/** Builds a minimal valid workbook buffer. `sheetsData[SheetName]` is an array of `{ header: value }` row objects. Options can omit a sheet, drop a header, or override the TemplateVersion cell to exercise structural-validation failures. */
async function buildWorkbookBuffer({ templateVersion = "1.0.0", sheetsData = {}, omitSheet = null, dropHeader = null, blankTemplateVersion = false } = {}) {
  const workbook = new ExcelJS.Workbook();
  const instructions = workbook.addWorksheet("Instructions");
  if (!blankTemplateVersion) instructions.getCell("B54").value = templateVersion;

  for (const [sheetName, headers] of Object.entries(HEADERS)) {
    if (omitSheet === sheetName) continue;
    const sheet = workbook.addWorksheet(sheetName);
    sheet.getRow(1).getCell(1).value = `TITLE ${sheetName}`;
    const activeHeaders = dropHeader && dropHeader.sheet === sheetName
      ? headers.filter((h) => normalizeHeader(h) !== dropHeader.header)
      : headers;
    activeHeaders.forEach((h, i) => { sheet.getRow(2).getCell(i + 1).value = h; });
    const rows = sheetsData[sheetName] ?? [];
    rows.forEach((rowValues, rowIndex) => {
      const excelRow = rowIndex + 3;
      activeHeaders.forEach((h, colIndex) => {
        const key = normalizeHeader(h);
        if (key in rowValues) sheet.getRow(excelRow).getCell(colIndex + 1).value = rowValues[key];
      });
    });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

const BASE_BRAND = { brand_id: "B1", brand_name_en: "Acme Dental", brand_name_ar: "أكمي", image_rights_confirmed: "No", status: "active", import_action: "create" };
const BASE_CATEGORY = { category_id: "C1", category_level: "1", category_name_en: "Consumables", category_name_ar: "مستهلكات", show_in_menu: "Yes", status: "active", import_action: "create" };
function simpleProductRow(overrides = {}) {
  return {
    product_id: "P1", product_sku: "SKU-1", product_type: "simple", product_name_en: "Widget", product_name_ar: "أداة",
    brand_id: "B1", category_id: "C1", unit_of_measure: "piece", base_price: "100", currency: "EGP",
    availability: "in_stock", image_rights_confirmed: "No", status: "draft", import_action: "create",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// A minimal in-memory Prisma-shaped fake, extended from the JSON importer's
// own test harness with a catalogImportRow handle for the Excel enrichment pass.
// ---------------------------------------------------------------------------
function createFakeDatabase(seed = {}) {
  const store = { brands: [], categories: [], products: [], options: [], values: [], variants: [], selections: [], images: [], ...seed };
  let seq = 1;
  const nextId = (prefix) => `${prefix}-${seq++}`;

  function matchesWhere(record, where) {
    return Object.entries(where).every(([key, condition]) => {
      if (condition && typeof condition === "object" && !(condition instanceof Date) && "equals" in condition) {
        return String(record[key] ?? "").toLowerCase() === String(condition.equals).toLowerCase();
      }
      return record[key] === condition;
    });
  }
  function findFirstIn(list, where) {
    return list.find((record) => matchesWhere(record, where)) ?? null;
  }
  function hydrateVariant(variant) {
    return {
      ...variant,
      selections: store.selections
        .filter((s) => s.variantId === variant.id)
        .map((s) => ({ option: store.options.find((o) => o.id === s.optionId) ?? null, optionValue: store.values.find((v) => v.id === s.optionValueId) ?? null })),
    };
  }

  const database = {
    batches: new Map(),
    store,
    brand: {
      findFirst: async ({ where }) => findFirstIn(store.brands, where),
      findMany: async ({ where }) => store.brands.filter((b) => matchesWhere(b, where)),
      findUnique: async ({ where }) => store.brands.find((b) => b.id === where.id) ?? null,
      create: async ({ data }) => { const r = { id: nextId("brand"), updatedAt: new Date(), ...data }; store.brands.push(r); return r; },
      update: async ({ where, data }) => { const r = store.brands.find((b) => b.id === where.id); assignDefined(r, data); r.updatedAt = new Date(); return r; },
    },
    category: {
      findFirst: async ({ where }) => findFirstIn(store.categories, where),
      findMany: async ({ where }) => store.categories.filter((c) => matchesWhere(c, where)),
      findUnique: async ({ where }) => store.categories.find((c) => c.id === where.id) ?? null,
      create: async ({ data }) => { const r = { id: nextId("cat"), updatedAt: new Date(), ...data }; store.categories.push(r); return r; },
      update: async ({ where, data }) => { const r = store.categories.find((c) => c.id === where.id); assignDefined(r, data); r.updatedAt = new Date(); return r; },
    },
    product: {
      findFirst: async ({ where }) => {
        if (where.OR) return store.products.find((p) => where.OR.some((c) => matchesWhere(p, c))) ?? null;
        return findFirstIn(store.products, where);
      },
      findUnique: async ({ where }) => store.products.find((p) => p.id === where.id) ?? null,
      // Nullable scalar columns default to null when a create omits them —
      // mirrors real Prisma/Postgres behavior for an unset optional column.
      create: async ({ data }) => {
        const r = {
          id: nextId("prod"), updatedAt: new Date(),
          nameAr: null, salePrice: null, description: null, descriptionAr: null,
          shortDescription: null, shortDescriptionAr: null, imageUrl: null,
          ...data,
        };
        store.products.push(r);
        return r;
      },
      update: async ({ where, data }) => { const r = store.products.find((p) => p.id === where.id); assignDefined(r, data); r.updatedAt = new Date(); return r; },
      updateMany: async ({ where, data }) => {
        const matches = store.products.filter((p) => matchesWhere(p, where));
        matches.forEach((p) => assignDefined(p, data));
        return { count: matches.length };
      },
    },
    productOption: {
      findFirst: async ({ where }) => store.options.find((o) => (where.productId === undefined || o.productId === where.productId) && (where.code === undefined || o.code === where.code)) ?? null,
      create: async ({ data }) => { const r = { id: nextId("opt"), updatedAt: new Date(), ...data }; store.options.push(r); return r; },
      update: async ({ where, data }) => { const r = store.options.find((o) => o.id === where.id); assignDefined(r, data); r.updatedAt = new Date(); return r; },
    },
    productOptionValue: {
      findFirst: async ({ where }) => store.values.find((v) => v.optionId === where.optionId && v.code === where.code) ?? null,
      create: async ({ data }) => { const r = { id: nextId("val"), updatedAt: new Date(), ...data }; store.values.push(r); return r; },
      update: async ({ where, data }) => { const r = store.values.find((v) => v.id === where.id); assignDefined(r, data); r.updatedAt = new Date(); return r; },
    },
    productVariant: {
      findFirst: async ({ where }) => findFirstIn(store.variants, where),
      findUnique: async ({ where, select }) => {
        const record = store.variants.find((v) => v.id === where.id);
        if (!record) return null;
        const hydrated = hydrateVariant(record);
        if (!select) return hydrated;
        return Object.fromEntries(Object.keys(select).map((key) => [key, hydrated[key]]));
      },
      findMany: async ({ where }) => store.variants
        .filter((v) => (where.productId === undefined || v.productId === where.productId) && (!where.id?.notIn || !where.id.notIn.includes(v.id)))
        .map(hydrateVariant),
      create: async ({ data }) => { const r = { id: nextId("var"), updatedAt: new Date(), lowStockThreshold: 5, ...data }; store.variants.push(r); return r; },
      update: async ({ where, data }) => { const r = store.variants.find((v) => v.id === where.id); assignDefined(r, data); r.updatedAt = new Date(); return r; },
    },
    productVariantOptionValue: {
      findFirst: async ({ where }) => store.selections.find((s) => s.variantId === where.variantId && s.optionId === where.optionId) ?? null,
      deleteMany: async ({ where }) => { store.selections = store.selections.filter((s) => !(s.variantId === where.variantId && s.optionId === where.optionId)); },
      create: async ({ data }) => { store.selections.push(data); return data; },
    },
    productImage: {
      findFirst: async ({ where }) => store.images.find((i) => i.productId === where.productId && (i.variantId ?? null) === (where.variantId ?? null) && i.url === where.url) ?? null,
      updateMany: async ({ where, data }) => { store.images.filter((i) => i.productId === where.productId && (i.variantId ?? null) === (where.variantId ?? null) && i.isPrimary === where.isPrimary).forEach((i) => Object.assign(i, data)); },
      create: async ({ data }) => { const r = { id: nextId("img"), ...data }; store.images.push(r); return r; },
    },
    catalogImportBatch: {
      create: async ({ data }) => {
        const rows = data.rows.create.map((row) => ({ id: nextId("row"), ...row }));
        const batch = { id: nextId("batch"), sourceSystem: data.sourceSystem, filename: data.filename, dryRun: data.dryRun, totalRows: data.totalRows, validRows: data.validRows, warningRows: data.warningRows, errorRows: data.errorRows, createdById: data.createdById, status: "PREVIEW", rows };
        database.batches.set(batch.id, batch);
        return batch;
      },
      findUnique: async ({ where }) => database.batches.get(where.id) ?? null,
      update: async ({ where, data }) => { const batch = database.batches.get(where.id); const updated = { ...batch, ...data }; database.batches.set(where.id, updated); return updated; },
    },
    catalogImportRow: {
      update: async ({ where, data }) => {
        for (const batch of database.batches.values()) {
          const row = batch.rows.find((r) => r.id === where.id);
          if (row) { Object.assign(row, data); return row; }
        }
        return null;
      },
    },
    $transaction: async (fn) => {
      const snapshot = structuredClone(store);
      try { return await fn(database); }
      catch (error) { for (const key of Object.keys(snapshot)) store[key] = snapshot[key]; throw error; }
    },
  };
  return database;
}

function rowsOf(batch, entityType) {
  return batch.rows.filter((r) => r.entityType === entityType);
}

/** Mirrors Prisma's real update semantics: an `undefined` field means "leave this column alone", unlike Object.assign which would overwrite it with undefined. */
function assignDefined(target, patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) target[key] = value;
  }
  return target;
}

// 1. Valid simple product with no variant.
test("a valid simple product with no Variants row previews cleanly and needs no variant record", async () => {
  const db = createFakeDatabase();
  const buffer = await buildWorkbookBuffer({
    sheetsData: {
      Brands: [BASE_BRAND],
      Categories: [BASE_CATEGORY],
      Products: [simpleProductRow()],
      Inventory: [{ inventory_id: "INV1", stock_quantity: "5", import_action: "create", external_product_id: "P1", external_variant_id: "" }],
    },
  });
  const { batch } = await previewCatalogImportFromExcel(db, { workbookBuffer: buffer, sourceSystem: "EXCEL_IMPORT" });
  assert.equal(rowsOf(batch, "PRODUCTS")[0].action, "CREATE");
  assert.equal(rowsOf(batch, "VARIANTS").length, 0);
  assert.equal(batch.errorRows, 0);
});

test("Excel preview preserves sale_price and commit saves it on the Product", async () => {
  const db = createFakeDatabase();
  const buffer = await buildWorkbookBuffer({
    sheetsData: {
      Brands: [BASE_BRAND],
      Categories: [BASE_CATEGORY],
      Products: [simpleProductRow({ base_price: "100", sale_price: "75", status: "active" })],
      Inventory: [{ inventory_id: "INV1", stock_quantity: "20", import_action: "create", external_product_id: "P1", external_variant_id: "" }],
    },
  });
  const { batch } = await previewCatalogImportFromExcel(db, { workbookBuffer: buffer, sourceSystem: "EXCEL_IMPORT" });
  const productRow = rowsOf(batch, "PRODUCTS")[0];
  assert.equal(productRow.normalizedPayload.price, 100);
  assert.equal(productRow.normalizedPayload.salePrice, 75);
  assert.equal(productRow.normalizedPayload.salePriceProvided, true);
  assert.equal(batch.errorRows, 0);

  await applyCatalogImportBatch(db, { batchId: batch.id, confirmed: true, actorId: "admin-1" });
  assert.equal(db.store.products[0].price, 100);
  assert.equal(db.store.products[0].salePrice, 75);
});

// 2. Product inventory using productExternalId.
test("an Inventory row using productExternalId updates the simple product's own stock", async () => {
  const db = createFakeDatabase();
  const buffer = await buildWorkbookBuffer({
    sheetsData: {
      Brands: [BASE_BRAND], Categories: [BASE_CATEGORY], Products: [simpleProductRow()],
      Inventory: [{ inventory_id: "INV1", stock_quantity: "7", import_action: "create", external_product_id: "P1", external_variant_id: "" }],
    },
  });
  const { batch } = await previewCatalogImportFromExcel(db, { workbookBuffer: buffer, sourceSystem: "EXCEL_IMPORT" });
  const invRow = rowsOf(batch, "INVENTORY")[0];
  assert.equal(invRow.normalizedPayload.productExternalId, "P1");
  assert.equal(invRow.normalizedPayload.externalVariantId, null);
  assert.equal(invRow.normalizedPayload.stockQuantity, 7);
});

// 3. Valid variable-product inventory using externalVariantId.
test("a variable product's Inventory row resolves through externalVariantId, not a SKU", async () => {
  const db = createFakeDatabase();
  const buffer = await buildWorkbookBuffer({
    sheetsData: {
      Brands: [BASE_BRAND], Categories: [BASE_CATEGORY],
      Products: [simpleProductRow({ product_type: "variable" })],
      Variants: [{ variant_id: "V1", product_id: "P1", variant_sku: "SKU-1-A", price: "100", availability: "in_stock", is_default_variant: "Yes", status: "active", import_action: "create" }],
      Inventory: [{ inventory_id: "INV1", stock_quantity: "9", import_action: "create", external_product_id: "", external_variant_id: "V1" }],
    },
  });
  const { batch } = await previewCatalogImportFromExcel(db, { workbookBuffer: buffer, sourceSystem: "EXCEL_IMPORT" });
  const variantRow = rowsOf(batch, "VARIANTS")[0];
  assert.equal(variantRow.action, "CREATE");
  const invRow = rowsOf(batch, "INVENTORY")[0];
  assert.equal(invRow.normalizedPayload.externalVariantId, "V1");
  assert.equal(invRow.normalizedPayload.productExternalId, null);
  assert.equal(invRow.normalizedPayload.stockQuantity, 9);
  assert.equal(batch.errorRows, 0);
});

// 4. Unsupported template version.
test("an unsupported TemplateVersion is rejected before any preview batch is created", async () => {
  const db = createFakeDatabase();
  const buffer = await buildWorkbookBuffer({ templateVersion: "9.9.9" });
  await assert.rejects(
    previewCatalogImportFromExcel(db, { workbookBuffer: buffer, sourceSystem: "EXCEL_IMPORT" }),
    (error) => error.statusCode === 422 && /Unsupported TemplateVersion/.test(error.message)
  );
  assert.equal(db.batches.size, 0);
});

// 5. Missing required sheet.
test("a missing required sheet is rejected before any preview batch is created", async () => {
  const db = createFakeDatabase();
  const buffer = await buildWorkbookBuffer({ omitSheet: "Inventory" });
  await assert.rejects(
    previewCatalogImportFromExcel(db, { workbookBuffer: buffer, sourceSystem: "EXCEL_IMPORT" }),
    (error) => error.statusCode === 422 && /Required sheet "Inventory" was not found/.test(error.message)
  );
  assert.equal(db.batches.size, 0);
});

// 6. Missing required header.
test("a missing required header is rejected before any preview batch is created", async () => {
  const db = createFakeDatabase();
  const buffer = await buildWorkbookBuffer({ dropHeader: { sheet: "Products", header: "product_sku" } });
  await assert.rejects(
    previewCatalogImportFromExcel(db, { workbookBuffer: buffer, sourceSystem: "EXCEL_IMPORT" }),
    (error) => error.statusCode === 422 && /Products.*missing required header.*product_sku/.test(error.message)
  );
  assert.equal(db.batches.size, 0);
});

// 7. Duplicate product ID.
test("two Products rows sharing a product_id are flagged as a conflict, not silently both created", async () => {
  const db = createFakeDatabase();
  const buffer = await buildWorkbookBuffer({
    sheetsData: {
      Brands: [BASE_BRAND], Categories: [BASE_CATEGORY],
      Products: [simpleProductRow({ product_sku: "SKU-1" }), simpleProductRow({ product_sku: "SKU-2" })],
    },
  });
  const { batch } = await previewCatalogImportFromExcel(db, { workbookBuffer: buffer, sourceSystem: "EXCEL_IMPORT" });
  const productRows = rowsOf(batch, "PRODUCTS");
  assert.equal(productRows[1].action, "CONFLICT");
  assert.match(productRows[1].validationMessages.join(" "), /Duplicate product_id "P1"/);
  assert.equal(db.store.products.length, 0, "preview must make no catalog mutation");
});

// 8. Duplicate product SKU.
test("two Products rows sharing a product_sku are flagged as a conflict", async () => {
  const db = createFakeDatabase();
  const buffer = await buildWorkbookBuffer({
    sheetsData: {
      Brands: [BASE_BRAND], Categories: [BASE_CATEGORY],
      Products: [simpleProductRow({ product_id: "P1" }), simpleProductRow({ product_id: "P2" })],
    },
  });
  const { batch } = await previewCatalogImportFromExcel(db, { workbookBuffer: buffer, sourceSystem: "EXCEL_IMPORT" });
  const productRows = rowsOf(batch, "PRODUCTS");
  assert.equal(productRows[1].action, "CONFLICT");
  assert.match(productRows[1].validationMessages.join(" "), /Duplicate product_sku "SKU-1"/);
});

// 9. Unknown brand.
test("a Products row referencing a brand_id absent from both the workbook and the database is an error", async () => {
  const db = createFakeDatabase();
  const buffer = await buildWorkbookBuffer({
    sheetsData: { Categories: [BASE_CATEGORY], Products: [simpleProductRow({ brand_id: "MISSING-BRAND" })] },
  });
  const { batch } = await previewCatalogImportFromExcel(db, { workbookBuffer: buffer, sourceSystem: "EXCEL_IMPORT" });
  const productRow = rowsOf(batch, "PRODUCTS")[0];
  assert.equal(productRow.action, "ERROR");
  assert.match(productRow.validationMessages.join(" "), /brandExternalId "MISSING-BRAND" was not found/);
});

// 10. Unknown category.
test("a Products row referencing a category_id absent from both the workbook and the database is an error", async () => {
  const db = createFakeDatabase();
  const buffer = await buildWorkbookBuffer({
    sheetsData: { Brands: [BASE_BRAND], Products: [simpleProductRow({ category_id: "MISSING-CAT" })] },
  });
  const { batch } = await previewCatalogImportFromExcel(db, { workbookBuffer: buffer, sourceSystem: "EXCEL_IMPORT" });
  const productRow = rowsOf(batch, "PRODUCTS")[0];
  assert.equal(productRow.action, "ERROR");
  assert.match(productRow.validationMessages.join(" "), /categoryExternalId "MISSING-CAT" was not found/);
});

// 11. Unknown inventory productExternalId.
test("an Inventory row whose productExternalId resolves to nothing is an error", async () => {
  const db = createFakeDatabase();
  const buffer = await buildWorkbookBuffer({
    sheetsData: { Inventory: [{ inventory_id: "INV1", stock_quantity: "5", import_action: "create", external_product_id: "GHOST-PRODUCT", external_variant_id: "" }] },
  });
  const { batch } = await previewCatalogImportFromExcel(db, { workbookBuffer: buffer, sourceSystem: "EXCEL_IMPORT" });
  const invRow = rowsOf(batch, "INVENTORY")[0];
  assert.equal(invRow.action, "ERROR");
  assert.match(invRow.validationMessages.join(" "), /productExternalId "GHOST-PRODUCT" was not found/);
});

// 12. Both inventory external IDs populated.
test("an Inventory row with both external_product_id and external_variant_id populated is rejected as ambiguous", async () => {
  const db = createFakeDatabase();
  const buffer = await buildWorkbookBuffer({
    sheetsData: {
      Brands: [BASE_BRAND], Categories: [BASE_CATEGORY], Products: [simpleProductRow()],
      Inventory: [{ inventory_id: "INV1", stock_quantity: "5", import_action: "create", external_product_id: "P1", external_variant_id: "V1" }],
    },
  });
  const { batch } = await previewCatalogImportFromExcel(db, { workbookBuffer: buffer, sourceSystem: "EXCEL_IMPORT" });
  const invRow = rowsOf(batch, "INVENTORY")[0];
  assert.equal(invRow.action, "ERROR");
  assert.match(invRow.validationMessages.join(" "), /Only one of productExternalId or externalVariantId may be set/);
});

// 13. Both inventory external IDs blank.
test("an Inventory row with neither external_product_id nor external_variant_id populated is rejected", async () => {
  const db = createFakeDatabase();
  const buffer = await buildWorkbookBuffer({
    sheetsData: { Inventory: [{ inventory_id: "INV1", stock_quantity: "5", import_action: "create", external_product_id: "", external_variant_id: "" }] },
  });
  const { batch } = await previewCatalogImportFromExcel(db, { workbookBuffer: buffer, sourceSystem: "EXCEL_IMPORT" });
  const invRow = rowsOf(batch, "INVENTORY")[0];
  assert.equal(invRow.action, "ERROR");
  assert.match(invRow.validationMessages.join(" "), /Either productExternalId or externalVariantId is required/);
});

// 14. Provisional-data warnings.
test("provisional price, stock, and manufacturer-verification notes surface as non-blocking preview warnings", async () => {
  const db = createFakeDatabase();
  const buffer = await buildWorkbookBuffer({
    sheetsData: {
      Brands: [BASE_BRAND], Categories: [BASE_CATEGORY],
      Products: [simpleProductRow({ internal_notes: "Provisional staging price; X Dental review is required before publication. Not verified by manufacturer: stock, price." })],
      Inventory: [{ inventory_id: "INV1", stock_quantity: "3", import_action: "create", external_product_id: "P1", external_variant_id: "", internal_notes: "Provisional staging stock = 3 for website testing." }],
    },
  });
  const { batch } = await previewCatalogImportFromExcel(db, { workbookBuffer: buffer, sourceSystem: "EXCEL_IMPORT" });
  const productRow = rowsOf(batch, "PRODUCTS")[0];
  assert.equal(productRow.action, "CREATE", "warnings must not block an otherwise-valid row");
  assert.match(productRow.validationMessages.join(" "), /requires X Dental review/);
  assert.match(productRow.validationMessages.join(" "), /provisional staging value/);
  assert.match(productRow.validationMessages.join(" "), /Manufacturer verification is incomplete/);
  const invRow = rowsOf(batch, "INVENTORY")[0];
  assert.match(invRow.validationMessages.join(" "), /provisional staging value/);
  assert.ok(batch.warningRows >= 2);
});

// 15. Empty Images sheet.
test("an empty Images sheet does not block the preview", async () => {
  const db = createFakeDatabase();
  const buffer = await buildWorkbookBuffer({
    sheetsData: { Brands: [BASE_BRAND], Categories: [BASE_CATEGORY], Products: [simpleProductRow()] },
  });
  const { batch } = await previewCatalogImportFromExcel(db, { workbookBuffer: buffer, sourceSystem: "EXCEL_IMPORT" });
  assert.equal(rowsOf(batch, "IMAGES").length, 0);
  assert.equal(batch.errorRows, 0);
});

// 16. Missing-image placeholder behaviour.
test("a product with no Images rows is flagged in preview to use the storefront's safe placeholder image", async () => {
  const db = createFakeDatabase();
  const buffer = await buildWorkbookBuffer({
    sheetsData: { Brands: [BASE_BRAND], Categories: [BASE_CATEGORY], Products: [simpleProductRow()] },
  });
  const { batch } = await previewCatalogImportFromExcel(db, { workbookBuffer: buffer, sourceSystem: "EXCEL_IMPORT" });
  const productRow = rowsOf(batch, "PRODUCTS")[0];
  assert.match(productRow.validationMessages.join(" "), /safe placeholder image will be used/);
});

// 17. Dry-run without database writes.
test("preview never writes Brand, Category, Product, Variant, or Inventory data — only the audit batch", async () => {
  const db = createFakeDatabase();
  const buffer = await buildWorkbookBuffer({
    sheetsData: {
      Brands: [BASE_BRAND], Categories: [BASE_CATEGORY], Products: [simpleProductRow()],
      Inventory: [{ inventory_id: "INV1", stock_quantity: "5", import_action: "create", external_product_id: "P1", external_variant_id: "" }],
    },
  });
  const { batch } = await previewCatalogImportFromExcel(db, { workbookBuffer: buffer, sourceSystem: "EXCEL_IMPORT" });
  assert.equal(batch.status, "PREVIEW");
  assert.equal(batch.dryRun, true);
  assert.equal(db.store.brands.length, 0);
  assert.equal(db.store.categories.length, 0);
  assert.equal(db.store.products.length, 0);
  assert.equal(db.store.variants.length, 0);
});

// 18. Successful confirmed transaction.
test("a confirmed apply of a clean Excel-sourced preview commits the product as DRAFT with Inventory-driven stock", async () => {
  const db = createFakeDatabase();
  const buffer = await buildWorkbookBuffer({
    sheetsData: {
      Brands: [BASE_BRAND], Categories: [BASE_CATEGORY], Products: [simpleProductRow()],
      Inventory: [{ inventory_id: "INV1", stock_quantity: "5", import_action: "create", external_product_id: "P1", external_variant_id: "" }],
    },
  });
  const { batch } = await previewCatalogImportFromExcel(db, { workbookBuffer: buffer, sourceSystem: "EXCEL_IMPORT" });
  assert.equal(batch.errorRows, 0);
  const applied = await applyCatalogImportBatch(db, { batchId: batch.id, confirmed: true, actorId: "admin-1" });
  assert.equal(applied.status, "APPLIED");
  assert.equal(db.store.products.length, 1);
  assert.equal(db.store.products[0].status, "DRAFT", "an explicit workbook status must survive the Inventory row applying stock afterward");
  assert.equal(db.store.products[0].isAvailable, false);
  assert.equal(db.store.products[0].stockQuantity, 5);
});

// 19. Rollback on commit failure.
test("apply rolls back every change in the batch when one row fails during commit", async () => {
  const db = createFakeDatabase();
  const buffer = await buildWorkbookBuffer({
    sheetsData: { Brands: [BASE_BRAND], Categories: [BASE_CATEGORY], Products: [simpleProductRow()] },
  });
  const { batch } = await previewCatalogImportFromExcel(db, { workbookBuffer: buffer, sourceSystem: "EXCEL_IMPORT" });
  const productRow = batch.rows.find((r) => r.entityType === "PRODUCTS");
  productRow.action = "UPDATE";
  productRow.normalizedPayload.targetId = "will-not-exist";
  productRow.normalizedPayload.targetUpdatedAt = new Date().toISOString();
  await assert.rejects(applyCatalogImportBatch(db, { batchId: batch.id, confirmed: true, actorId: "admin-1" }));
  assert.equal(db.store.brands.length, 0, "the brand created earlier in the same failed transaction must be rolled back");
  assert.equal(db.store.products.length, 0);
});

// 20. Repeated batch upload.
test("uploading the same workbook a second time after a successful import previews cleanly with no duplicate-identifier conflicts", async () => {
  const db = createFakeDatabase();
  const buffer = await buildWorkbookBuffer({
    sheetsData: {
      Brands: [BASE_BRAND], Categories: [BASE_CATEGORY], Products: [simpleProductRow()],
      Inventory: [{ inventory_id: "INV1", stock_quantity: "5", import_action: "create", external_product_id: "P1", external_variant_id: "" }],
    },
  });
  const first = await previewCatalogImportFromExcel(db, { workbookBuffer: buffer, sourceSystem: "EXCEL_IMPORT" });
  await applyCatalogImportBatch(db, { batchId: first.batch.id, confirmed: true, actorId: "admin-1" });

  const second = await previewCatalogImportFromExcel(db, { workbookBuffer: buffer, sourceSystem: "EXCEL_IMPORT" });
  assert.equal(second.batch.errorRows, 0, "re-uploading the same workbook must not be treated as a duplicate-identifier conflict");
  const productRow = rowsOf(second.batch, "PRODUCTS")[0];
  assert.notEqual(productRow.action, "CONFLICT");
  assert.equal(db.store.products.length, 1, "the second preview must not create a second product");
});

// ---------------------------------------------------------------------------
// Launch-readiness correction: bilingual product fields and category hierarchy
// mapped from the real workbook columns.
// ---------------------------------------------------------------------------

test("product_name_ar, short_description_en/ar, and long_description_ar map through the Excel path and survive commit", async () => {
  const db = createFakeDatabase();
  const buffer = await buildWorkbookBuffer({
    sheetsData: {
      Brands: [BASE_BRAND], Categories: [BASE_CATEGORY],
      Products: [simpleProductRow({
        product_name_ar: "أداة",
        short_description_en: "Short EN.",
        short_description_ar: "قصير بالعربية.",
        long_description_en: "Long EN.",
        long_description_ar: "طويل بالعربية.",
      })],
    },
  });
  const { batch } = await previewCatalogImportFromExcel(db, { workbookBuffer: buffer, sourceSystem: "EXCEL_IMPORT" });
  const row = rowsOf(batch, "PRODUCTS")[0];
  assert.equal(row.normalizedPayload.nameAr, "أداة");
  assert.equal(row.normalizedPayload.shortDescription, "Short EN.");
  assert.equal(row.normalizedPayload.shortDescriptionAr, "قصير بالعربية.");
  assert.equal(row.normalizedPayload.description, "Long EN.");
  assert.equal(row.normalizedPayload.descriptionAr, "طويل بالعربية.");

  await applyCatalogImportBatch(db, { batchId: batch.id, confirmed: true, actorId: "admin-1" });
  const product = db.store.products[0];
  assert.equal(product.nameAr, "أداة");
  assert.equal(product.shortDescriptionAr, "قصير بالعربية.");
  assert.equal(product.descriptionAr, "طويل بالعربية.");
});

test("parent_category_id maps through the Excel path and the hierarchy survives commit", async () => {
  const db = createFakeDatabase();
  const buffer = await buildWorkbookBuffer({
    sheetsData: {
      Brands: [BASE_BRAND],
      Categories: [
        { category_id: "C1", category_level: "1", category_name_en: "Restorative", category_name_ar: "الترميم", show_in_menu: "Yes", status: "active", import_action: "create" },
        { category_id: "C2", parent_category_id: "C1", category_level: "2", category_name_en: "Composite", category_name_ar: "مركب", show_in_menu: "Yes", status: "active", import_action: "create" },
      ],
      Products: [simpleProductRow({ category_id: "C2" })],
    },
  });
  const { batch } = await previewCatalogImportFromExcel(db, { workbookBuffer: buffer, sourceSystem: "EXCEL_IMPORT" });
  assert.equal(batch.errorRows, 0);
  await applyCatalogImportBatch(db, { batchId: batch.id, confirmed: true, actorId: "admin-1" });

  const parent = db.store.categories.find((c) => c.externalCategoryId === "C1");
  const child = db.store.categories.find((c) => c.externalCategoryId === "C2");
  assert.equal(child.parentId, parent.id);
  assert.equal(parent.parentId ?? null, null);
});

test("an unresolvable parent_category_id fails preview with no catalog mutation", async () => {
  const db = createFakeDatabase();
  const buffer = await buildWorkbookBuffer({
    sheetsData: {
      Categories: [{ category_id: "C2", parent_category_id: "GHOST", category_level: "2", category_name_en: "Composite", category_name_ar: "مركب", show_in_menu: "Yes", status: "active", import_action: "create" }],
    },
  });
  const { batch } = await previewCatalogImportFromExcel(db, { workbookBuffer: buffer, sourceSystem: "EXCEL_IMPORT" });
  const row = rowsOf(batch, "CATEGORIES")[0];
  assert.equal(row.action, "ERROR");
  assert.match(row.validationMessages.join(" "), /parentExternalCategoryId "GHOST" was not found/);
  assert.equal(db.store.categories.length, 0);
});
