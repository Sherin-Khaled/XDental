import test from "node:test";
import assert from "node:assert/strict";
import { previewCatalogImport, applyCatalogImportBatch } from "./catalogImport.service.js";

/** A minimal in-memory Prisma-shaped fake with transaction snapshot/rollback support. */
function createFakeDatabase(seed = {}) {
  const store = {
    brands: [], categories: [], products: [], options: [], values: [], variants: [], selections: [], images: [],
    ...seed,
  };
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
        .filter((selection) => selection.variantId === variant.id)
        .map((selection) => ({
          option: store.options.find((option) => option.id === selection.optionId) ?? null,
          optionValue: store.values.find((value) => value.id === selection.optionValueId) ?? null,
        })),
    };
  }

  function buildHandle() {
    return {
      brand: {
        findFirst: async ({ where }) => findFirstIn(store.brands, where),
        findMany: async ({ where }) => store.brands.filter((b) => matchesWhere(b, where)),
        findUnique: async ({ where }) => store.brands.find((b) => b.id === where.id) ?? null,
        create: async ({ data }) => { const r = { id: nextId("brand"), updatedAt: new Date(), ...data }; store.brands.push(r); return r; },
        update: async ({ where, data }) => { const r = store.brands.find((b) => b.id === where.id); Object.assign(r, data, { updatedAt: new Date() }); return r; },
      },
      category: {
        findFirst: async ({ where }) => findFirstIn(store.categories, where),
        findMany: async ({ where }) => store.categories.filter((c) => matchesWhere(c, where)),
        findUnique: async ({ where }) => store.categories.find((c) => c.id === where.id) ?? null,
        create: async ({ data }) => { const r = { id: nextId("cat"), updatedAt: new Date(), ...data }; store.categories.push(r); return r; },
        update: async ({ where, data }) => { const r = store.categories.find((c) => c.id === where.id); Object.assign(r, data, { updatedAt: new Date() }); return r; },
      },
      product: {
        findFirst: async ({ where }) => {
          if (where.OR) return store.products.find((p) => where.OR.some((condition) => matchesWhere(p, condition))) ?? null;
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
        update: async ({ where, data }) => { const r = store.products.find((p) => p.id === where.id); Object.assign(r, data, { updatedAt: new Date() }); return r; },
      },
      productOption: {
        findFirst: async ({ where }) => store.options.find((o) => (where.productId === undefined || o.productId === where.productId) && (where.code === undefined || o.code === where.code)) ?? null,
        create: async ({ data }) => { const r = { id: nextId("opt"), updatedAt: new Date(), ...data }; store.options.push(r); return r; },
        update: async ({ where, data }) => { const r = store.options.find((o) => o.id === where.id); Object.assign(r, data, { updatedAt: new Date() }); return r; },
      },
      productOptionValue: {
        findFirst: async ({ where }) => store.values.find((v) => v.optionId === where.optionId && v.code === where.code) ?? null,
        create: async ({ data }) => { const r = { id: nextId("val"), updatedAt: new Date(), ...data }; store.values.push(r); return r; },
        update: async ({ where, data }) => { const r = store.values.find((v) => v.id === where.id); Object.assign(r, data, { updatedAt: new Date() }); return r; },
      },
      productVariant: {
        findFirst: async ({ where }) => findFirstIn(store.variants, where),
        findUnique: async ({ where }) => {
          const record = store.variants.find((v) => v.id === where.id);
          return record ? hydrateVariant(record) : null;
        },
        findMany: async ({ where }) => store.variants
          .filter((v) => (where.productId === undefined || v.productId === where.productId)
            && (!where.id?.notIn || !where.id.notIn.includes(v.id)))
          .map(hydrateVariant),
        create: async ({ data }) => { const r = { id: nextId("var"), updatedAt: new Date(), lowStockThreshold: 5, ...data }; store.variants.push(r); return r; },
        update: async ({ where, data }) => { const r = store.variants.find((v) => v.id === where.id); Object.assign(r, data, { updatedAt: new Date() }); return r; },
      },
      productVariantOptionValue: {
        findFirst: async ({ where }) => store.selections.find((s) => s.variantId === where.variantId && s.optionId === where.optionId) ?? null,
        deleteMany: async ({ where }) => { store.selections = store.selections.filter((s) => !(s.variantId === where.variantId && s.optionId === where.optionId)); },
        create: async ({ data }) => { store.selections.push(data); return data; },
      },
      productImage: {
        findFirst: async ({ where }) => store.images.find((i) => i.productId === where.productId && (i.variantId ?? null) === (where.variantId ?? null) && i.url === where.url) ?? null,
        updateMany: async ({ where, data }) => {
          store.images
            .filter((i) => i.productId === where.productId && (i.variantId ?? null) === (where.variantId ?? null) && i.isPrimary === where.isPrimary)
            .forEach((i) => Object.assign(i, data));
        },
        create: async ({ data }) => { const r = { id: nextId("img"), ...data }; store.images.push(r); return r; },
      },
      catalogImportBatch: {
        create: async ({ data }) => {
          const rows = data.rows.create.map((row) => ({ id: nextId("row"), ...row }));
          const batch = {
            id: nextId("batch"), sourceSystem: data.sourceSystem, filename: data.filename, dryRun: data.dryRun,
            totalRows: data.totalRows, validRows: data.validRows, warningRows: data.warningRows, errorRows: data.errorRows,
            createdById: data.createdById, status: "PREVIEW", rows,
          };
          database.batches.set(batch.id, batch);
          return batch;
        },
        findUnique: async ({ where }) => database.batches.get(where.id) ?? null,
        update: async ({ where, data }) => {
          const batch = database.batches.get(where.id);
          const updated = { ...batch, ...data };
          database.batches.set(where.id, updated);
          return updated;
        },
      },
    };
  }

  const database = {
    ...buildHandle(),
    batches: new Map(),
    store,
    $transaction: async (fn) => {
      const snapshot = structuredClone(store);
      try {
        return await fn(database);
      } catch (error) {
        for (const key of Object.keys(snapshot)) store[key] = snapshot[key];
        throw error;
      }
    },
  };
  return database;
}

function actionsOf(preview) {
  return preview.batch.rows.map((row) => `${row.entityType}:${row.action}`);
}

test("dry-run classifies rows into audit records without writing catalog data", async () => {
  const db = createFakeDatabase();
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: {
      BRANDS: [{ externalBrandId: "B1", name: "Acme Dental" }],
      PRODUCTS: [{ externalProductId: "P1", sku: "SKU-1", name: "Composite Bur", price: 100, stockQuantity: 20 }],
    },
  });
  assert.deepEqual(actionsOf(preview), ["BRANDS:CREATE", "PRODUCTS:CREATE"]);
  assert.equal(db.store.brands.length, 0);
  assert.equal(db.store.products.length, 0);
  assert.equal(preview.batch.status, "PREVIEW");
  assert.equal(preview.batch.dryRun, true);
});

test("preview classifies CREATE, UPDATE, and SKIP correctly against existing catalog state", async () => {
  const db = createFakeDatabase({
    products: [{ id: "prod-existing", sourceSystem: "OWNER", externalProductId: "P1", sku: "SKU-1", slug: "composite-bur", name: "Composite Bur", price: 100, stockQuantity: 20, updatedAt: new Date() }],
  });
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: {
      PRODUCTS: [
        { externalProductId: "P1", sku: "SKU-1", name: "Composite Bur", price: 100, stockQuantity: 20 }, // unchanged
        { externalProductId: "P2", sku: "SKU-2", name: "New Product", price: 50, stockQuantity: 5 }, // new
      ],
    },
  });
  const [unchanged, fresh] = preview.batch.rows;
  assert.equal(unchanged.action, "SKIP");
  assert.equal(fresh.action, "CREATE");

  const previewChanged = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: { PRODUCTS: [{ externalProductId: "P1", sku: "SKU-1", name: "Composite Bur", price: 120, stockQuantity: 20 }] },
  });
  assert.equal(previewChanged.batch.rows[0].action, "UPDATE");
});

test("salePrice equal to or above the base price is rejected consistently during preview", async () => {
  for (const salePrice of [100, 120]) {
    const db = createFakeDatabase();
    const preview = await previewCatalogImport(db, {
      sourceSystem: "OWNER",
      entities: { PRODUCTS: [{ externalProductId: "P1", sku: `SKU-${salePrice}`, name: "Product", price: 100, salePrice, stockQuantity: 20 }] },
    });
    assert.equal(preview.batch.rows[0].action, "ERROR");
    assert.match(preview.batch.rows[0].validationMessages.join(" "), /salePrice must be positive and lower than price/);
  }
});

test("an update without salePrice leaves an existing product sale price unchanged", async () => {
  const db = createFakeDatabase({
    products: [{ id: "prod-existing", sourceSystem: "OWNER", externalProductId: "P1", sku: "SKU-1", slug: "product", name: "Old Product", price: 100, salePrice: 80, stockQuantity: 20, updatedAt: new Date() }],
  });
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: { PRODUCTS: [{ externalProductId: "P1", sku: "SKU-1", name: "Updated Product", price: 100, stockQuantity: 20 }] },
  });
  assert.equal(preview.batch.rows[0].action, "UPDATE");
  assert.equal(preview.batch.rows[0].normalizedPayload.salePriceProvided, false);
  await applyCatalogImportBatch(db, { batchId: preview.batch.id, confirmed: true, actorId: "admin-1" });
  assert.equal(db.store.products[0].salePrice, 80);
});

test("an existing product without a sale price remains without one when salePrice is absent", async () => {
  const db = createFakeDatabase({
    products: [{ id: "prod-existing", sourceSystem: "OWNER", externalProductId: "P1", sku: "SKU-1", slug: "product", name: "Old Product", price: 100, salePrice: null, stockQuantity: 20, updatedAt: new Date() }],
  });
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: { PRODUCTS: [{ externalProductId: "P1", sku: "SKU-1", name: "Updated Product", price: 100, stockQuantity: 20 }] },
  });
  await applyCatalogImportBatch(db, { batchId: preview.batch.id, confirmed: true, actorId: "admin-1" });
  assert.equal(db.store.products[0].salePrice, null);
});

test("products match by sourceSystem+externalProductId even when SKU and name differ", async () => {
  const db = createFakeDatabase({
    products: [{ id: "prod-existing", sourceSystem: "OWNER", externalProductId: "P1", sku: "OLD-SKU", slug: "old-slug", name: "Old Name", price: 100, stockQuantity: 20, updatedAt: new Date() }],
  });
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: { PRODUCTS: [{ externalProductId: "P1", sku: "NEW-SKU", name: "New Name", price: 150, stockQuantity: 30 }] },
  });
  assert.equal(preview.batch.rows[0].action, "UPDATE");
  assert.equal(preview.batch.rows[0].normalizedPayload.targetId, "prod-existing");
});

test("products fall back to exact SKU matching when no externalProductId is supplied", async () => {
  const db = createFakeDatabase({
    products: [{ id: "prod-existing", sourceSystem: null, externalProductId: null, sku: "SKU-1", slug: "composite-bur", name: "Composite Bur", price: 100, stockQuantity: 20, updatedAt: new Date() }],
  });
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: { PRODUCTS: [{ sku: "sku-1", name: "Composite Bur", price: 110, stockQuantity: 20 }] },
  });
  assert.equal(preview.batch.rows[0].action, "UPDATE");
  assert.equal(preview.batch.rows[0].normalizedPayload.targetId, "prod-existing");
});

test("variants match by sourceSystem+externalVariantId", async () => {
  const db = createFakeDatabase({
    products: [{ id: "prod-1", sourceSystem: "OWNER", externalProductId: "P1", sku: "SKU-1", slug: "p1", name: "Product", price: 100, stockQuantity: 20, updatedAt: new Date() }],
    variants: [{ id: "var-1", productId: "prod-1", sourceSystem: "OWNER", externalVariantId: "V1", sku: "SKU-1-A", barcode: null, stockQuantity: 5, priceOverride: null, status: "ACTIVE", updatedAt: new Date() }],
  });
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: { VARIANTS: [{ productExternalId: "P1", externalVariantId: "V1", sku: "SKU-1-A", stockQuantity: 9 }] },
  });
  assert.equal(preview.batch.rows[0].action, "UPDATE");
  assert.equal(preview.batch.rows[0].normalizedPayload.targetId, "var-1");
});

test("a variant SKU and externalVariantId that point at two different existing variants is a conflict, never a silent merge", async () => {
  const db = createFakeDatabase({
    products: [{ id: "prod-1", sourceSystem: "OWNER", externalProductId: "P1", sku: "SKU-1", slug: "p1", name: "Product", price: 100, stockQuantity: 20, updatedAt: new Date() }],
    variants: [
      { id: "var-a", productId: "prod-1", sourceSystem: "OWNER", externalVariantId: "V1", sku: "SKU-1-A", barcode: null, stockQuantity: 5, priceOverride: null, status: "ACTIVE", updatedAt: new Date() },
      { id: "var-b", productId: "prod-1", sourceSystem: "OWNER", externalVariantId: "V2", sku: "SKU-1-B", barcode: null, stockQuantity: 5, priceOverride: null, status: "ACTIVE", updatedAt: new Date() },
    ],
  });
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    // externalVariantId resolves to var-a; sku resolves to var-b — must not merge onto either.
    entities: { VARIANTS: [{ productExternalId: "P1", externalVariantId: "V1", sku: "SKU-1-B", stockQuantity: 9 }] },
  });
  assert.equal(preview.batch.rows[0].action, "CONFLICT");
  assert.equal(db.store.variants[0].stockQuantity, 5, "no mutation must occur during preview");
});

test("conflicting identifiers pointing at different existing products are never silently merged", async () => {
  const db = createFakeDatabase({
    products: [
      { id: "prod-a", sourceSystem: "OWNER", externalProductId: "P1", sku: "SKU-A", slug: "a", name: "A", price: 100, stockQuantity: 10, updatedAt: new Date() },
      { id: "prod-b", sourceSystem: "OWNER", externalProductId: "P2", sku: "SKU-B", slug: "b", name: "B", price: 100, stockQuantity: 10, updatedAt: new Date() },
    ],
  });
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    // externalProductId points at prod-a, sku points at prod-b — must not merge either way.
    entities: { PRODUCTS: [{ externalProductId: "P1", sku: "SKU-B", name: "Merged?", price: 100, stockQuantity: 10 }] },
  });
  assert.equal(preview.batch.rows[0].action, "CONFLICT");
  assert.equal(preview.summary.errorRows, 1);
});

test("apply is atomic across every entity type in one pilot batch", async () => {
  const db = createFakeDatabase();
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: {
      BRANDS: [{ externalBrandId: "B1", name: "Acme Dental" }],
      CATEGORIES: [{ externalCategoryId: "C1", name: "Burs" }],
      PRODUCTS: [{ externalProductId: "P1", sku: "SKU-1", name: "Composite Bur", price: 100, stockQuantity: 20, brandExternalId: "B1", categoryExternalId: "C1" }],
      PRODUCT_OPTIONS: [{ productExternalId: "P1", code: "SHADE", nameEn: "Shade" }],
      OPTION_VALUES: [{ productExternalId: "P1", optionCode: "SHADE", code: "A1", valueEn: "A1" }],
      VARIANTS: [{ productExternalId: "P1", externalVariantId: "V1", sku: "SKU-1-A1", stockQuantity: 10 }],
      VARIANT_OPTION_VALUES: [{ externalVariantId: "V1", optionCode: "SHADE", valueCode: "A1" }],
      IMAGES: [{ productExternalId: "P1", url: "https://example.com/a1.jpg", rightsConfirmed: true }],
      INVENTORY: [{ externalVariantId: "V1", stockQuantity: 8 }],
    },
  });
  assert.equal(preview.summary.errorRows, 0);

  const applied = await applyCatalogImportBatch(db, { batchId: preview.batch.id, confirmed: true, actorId: "admin-1" });
  assert.equal(applied.status, "APPLIED");
  assert.equal(db.store.brands.length, 1);
  assert.equal(db.store.categories.length, 1);
  assert.equal(db.store.products.length, 1);
  assert.equal(db.store.products[0].brandId, db.store.brands[0].id);
  assert.equal(db.store.products[0].categoryId, db.store.categories[0].id);
  assert.equal(db.store.options.length, 1);
  assert.equal(db.store.values.length, 1);
  assert.equal(db.store.variants.length, 1);
  assert.equal(db.store.selections.length, 1);
  assert.equal(db.store.images.length, 1);
  assert.equal(db.store.variants[0].stockQuantity, 8); // INVENTORY row overrides the VARIANTS row's initial stock
});

test("adding a new option, value, and variant to an already-existing product resolves within the same batch", async () => {
  const db = createFakeDatabase({
    products: [{ id: "prod-1", sourceSystem: "OWNER", externalProductId: "P1", sku: "SKU-1", slug: "p1", name: "Product", price: 100, stockQuantity: 20, updatedAt: new Date() }],
  });
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: {
      PRODUCT_OPTIONS: [{ productExternalId: "P1", code: "SIZE", nameEn: "Size" }],
      OPTION_VALUES: [{ productExternalId: "P1", optionCode: "SIZE", code: "L", valueEn: "Large" }],
      VARIANTS: [{ productExternalId: "P1", externalVariantId: "V2", sku: "SKU-1-L", stockQuantity: 5 }],
      VARIANT_OPTION_VALUES: [{ externalVariantId: "V2", optionCode: "SIZE", valueCode: "L" }],
    },
  });
  assert.deepEqual(actionsOf(preview), ["PRODUCT_OPTIONS:CREATE", "OPTION_VALUES:CREATE", "VARIANTS:CREATE", "VARIANT_OPTION_VALUES:CREATE"]);
  const applied = await applyCatalogImportBatch(db, { batchId: preview.batch.id, confirmed: true, actorId: "admin-1" });
  assert.equal(applied.status, "APPLIED");
  assert.equal(db.store.options.length, 1);
  assert.equal(db.store.values.length, 1);
  assert.equal(db.store.variants.length, 1);
  assert.equal(db.store.selections.length, 1);
});

test("a row that fails during apply rolls back every other change from the same batch", async () => {
  const db = createFakeDatabase();
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: {
      BRANDS: [{ externalBrandId: "B1", name: "Acme Dental" }],
      PRODUCTS: [{ externalProductId: "P1", sku: "SKU-1", name: "Composite Bur", price: 100, stockQuantity: 20 }],
    },
  });
  // Simulate the target product changing after the preview was generated (a concurrent edit).
  const productRow = preview.batch.rows.find((row) => row.entityType === "PRODUCTS");
  productRow.action = "UPDATE";
  productRow.normalizedPayload.targetId = "will-not-exist";
  productRow.normalizedPayload.targetUpdatedAt = new Date().toISOString();

  await assert.rejects(
    applyCatalogImportBatch(db, { batchId: preview.batch.id, confirmed: true, actorId: "admin-1" })
  );
  assert.equal(db.store.brands.length, 0, "the brand created earlier in the same failed transaction must be rolled back");
  assert.equal(db.store.products.length, 0);
});

test("an already-applied batch is rejected and cannot be applied twice", async () => {
  const db = createFakeDatabase();
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: { BRANDS: [{ externalBrandId: "B1", name: "Acme Dental" }] },
  });
  await applyCatalogImportBatch(db, { batchId: preview.batch.id, confirmed: true, actorId: "admin-1" });
  await assert.rejects(
    applyCatalogImportBatch(db, { batchId: preview.batch.id, confirmed: true, actorId: "admin-1" }),
    (error) => error.statusCode === 409 && /already applied/i.test(error.message)
  );
  assert.equal(db.store.brands.length, 1);
});

test("a batch with unresolved errors or conflicts cannot be applied", async () => {
  const db = createFakeDatabase();
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: { PRODUCTS: [{ sku: "", name: "", price: -1, stockQuantity: -1 }] },
  });
  assert.equal(preview.batch.rows[0].action, "ERROR");
  await assert.rejects(
    applyCatalogImportBatch(db, { batchId: preview.batch.id, confirmed: true, actorId: "admin-1" }),
    (error) => error.statusCode === 409
  );
});

test("apply requires explicit confirmation", async () => {
  const db = createFakeDatabase();
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: { BRANDS: [{ externalBrandId: "B1", name: "Acme Dental" }] },
  });
  await assert.rejects(
    applyCatalogImportBatch(db, { batchId: preview.batch.id, confirmed: false, actorId: "admin-1" }),
    (error) => error.statusCode === 400
  );
});

test("images with unconfirmed rights still import but are flagged as a non-public review record", async () => {
  const db = createFakeDatabase({
    products: [{ id: "prod-1", sourceSystem: "OWNER", externalProductId: "P1", sku: "SKU-1", slug: "p1", name: "Product", price: 100, stockQuantity: 20, updatedAt: new Date() }],
  });
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: { IMAGES: [{ productExternalId: "P1", url: "https://example.com/unreviewed.jpg", rightsConfirmed: false }] },
  });
  const row = preview.batch.rows[0];
  assert.equal(row.action, "CREATE");
  assert.match(row.validationMessages.join(" "), /rights are unconfirmed/i);

  await applyCatalogImportBatch(db, { batchId: preview.batch.id, confirmed: true, actorId: "admin-1" });
  assert.equal(db.store.images[0].rightsConfirmed, false);
  assert.match(db.store.images[0].rightsNote, /hidden from public catalog/i);
});

test("duplicate image URLs within the same product+variant gallery are skipped, not duplicated", async () => {
  const db = createFakeDatabase({
    products: [{ id: "prod-1", sourceSystem: "OWNER", externalProductId: "P1", sku: "SKU-1", slug: "p1", name: "Product", price: 100, stockQuantity: 20, updatedAt: new Date() }],
    images: [{ id: "img-1", productId: "prod-1", variantId: null, url: "https://example.com/a.jpg", isPrimary: false }],
  });
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: { IMAGES: [{ productExternalId: "P1", url: "https://example.com/a.jpg", rightsConfirmed: true }] },
  });
  assert.equal(preview.batch.rows[0].action, "SKIP");
});

// ---------------------------------------------------------------------------
// Product brand/category relation resolution (Step 8: external id is a
// stable, sourceSystem-independent catalogue key; name/slug is a fallback
// used only when no external id is supplied; ambiguous or unknown references
// are always a blocking error, never a guess).
// ---------------------------------------------------------------------------

test("a product resolves brand and category by external id even when the import batch's sourceSystem differs from the one the brand/category were created under (EXCEL_IMPORT product referencing an X_DENTAL brand/category)", async () => {
  const db = createFakeDatabase({
    brands: [{ id: "brand-1", sourceSystem: "X_DENTAL", externalBrandId: "BR-XD-ACME", name: "Acme Dental", slug: "acme-dental", updatedAt: new Date() }],
    categories: [{ id: "cat-1", sourceSystem: "X_DENTAL", externalCategoryId: "CAT-XD-BURS", name: "Burs", slug: "burs", updatedAt: new Date() }],
  });
  const preview = await previewCatalogImport(db, {
    sourceSystem: "EXCEL_IMPORT",
    entities: { PRODUCTS: [{ externalProductId: "P1", sku: "SKU-1", name: "Composite Bur", price: 100, stockQuantity: 20, brandExternalId: "BR-XD-ACME", categoryExternalId: "CAT-XD-BURS" }] },
  });
  assert.equal(preview.summary.errorRows, 0);
  const applied = await applyCatalogImportBatch(db, { batchId: preview.batch.id, confirmed: true, actorId: "admin-1" });
  assert.equal(applied.status, "APPLIED");
  assert.equal(db.store.products[0].brandId, "brand-1");
  assert.equal(db.store.products[0].categoryId, "cat-1");
});

test("a TOOTHPICK_EG product batch resolves a brand and category created under a completely different, older sourceSystem", async () => {
  const db = createFakeDatabase({
    brands: [{ id: "brand-1", sourceSystem: null, externalBrandId: null, name: "Coltene", slug: "coltene", updatedAt: new Date() }],
    categories: [{ id: "cat-1", sourceSystem: "EXCEL_IMPORT", externalCategoryId: "CAT-008", name: "Extraction Instruments", slug: "extraction-instruments", updatedAt: new Date() }],
  });
  const preview = await previewCatalogImport(db, {
    sourceSystem: "TOOTHPICK_EG",
    entities: { PRODUCTS: [{ externalProductId: "P1", sku: "SKU-1", name: "Forceps", price: 100, stockQuantity: 20, brandName: "Coltene", categoryExternalId: "CAT-008" }] },
  });
  assert.equal(preview.summary.errorRows, 0, preview.batch.rows[0]?.validationMessages.join(" "));
  await applyCatalogImportBatch(db, { batchId: preview.batch.id, confirmed: true, actorId: "admin-1" });
  assert.equal(db.store.products[0].brandId, "brand-1");
  assert.equal(db.store.products[0].categoryId, "cat-1");
});

test("a product's category resolves by exact slug fallback when no categoryExternalId is supplied", async () => {
  const db = createFakeDatabase({
    categories: [{ id: "cat-1", sourceSystem: null, externalCategoryId: null, name: "Burs", slug: "burs", updatedAt: new Date() }],
  });
  const preview = await previewCatalogImport(db, {
    sourceSystem: "TOOTHPICK_EG",
    entities: { PRODUCTS: [{ externalProductId: "P1", sku: "SKU-1", name: "Composite Bur", price: 100, stockQuantity: 20, categorySlug: "Burs" }] },
  });
  assert.equal(preview.summary.errorRows, 0);
  await applyCatalogImportBatch(db, { batchId: preview.batch.id, confirmed: true, actorId: "admin-1" });
  assert.equal(db.store.products[0].categoryId, "cat-1");
});

test("a brandExternalId or categoryExternalId matching more than one existing record is rejected as ambiguous, not guessed", async () => {
  const db = createFakeDatabase({
    brands: [
      { id: "brand-1", sourceSystem: "X_DENTAL", externalBrandId: "BR-DUP", name: "Acme Dental", slug: "acme-dental", updatedAt: new Date() },
      { id: "brand-2", sourceSystem: "TOOTHPICK_EG", externalBrandId: "BR-DUP", name: "Acme Dental Egypt", slug: "acme-dental-egypt", updatedAt: new Date() },
    ],
  });
  const preview = await previewCatalogImport(db, {
    sourceSystem: "TOOTHPICK_EG",
    entities: { PRODUCTS: [{ externalProductId: "P1", sku: "SKU-1", name: "Composite Bur", price: 100, stockQuantity: 20, brandExternalId: "BR-DUP" }] },
  });
  assert.equal(preview.batch.rows[0].action, "ERROR");
  assert.match(preview.batch.rows[0].validationMessages.join(" "), /matches more than one brand/);
});

test("a categoryExternalId matching more than one existing record is rejected as ambiguous", async () => {
  const db = createFakeDatabase({
    categories: [
      { id: "cat-1", sourceSystem: "X_DENTAL", externalCategoryId: "CAT-DUP", name: "Burs", slug: "burs", updatedAt: new Date() },
      { id: "cat-2", sourceSystem: "TOOTHPICK_EG", externalCategoryId: "CAT-DUP", name: "Burs Egypt", slug: "burs-egypt", updatedAt: new Date() },
    ],
  });
  const preview = await previewCatalogImport(db, {
    sourceSystem: "TOOTHPICK_EG",
    entities: { PRODUCTS: [{ externalProductId: "P1", sku: "SKU-1", name: "Composite Bur", price: 100, stockQuantity: 20, categoryExternalId: "CAT-DUP" }] },
  });
  assert.equal(preview.batch.rows[0].action, "ERROR");
  assert.match(preview.batch.rows[0].validationMessages.join(" "), /matches more than one category/);
});

test("a non-empty brandExternalId that matches nothing is rejected, never auto-created from a Product row", async () => {
  const db = createFakeDatabase();
  const preview = await previewCatalogImport(db, {
    sourceSystem: "TOOTHPICK_EG",
    entities: { PRODUCTS: [{ externalProductId: "P1", sku: "SKU-1", name: "Composite Bur", price: 100, stockQuantity: 20, brandExternalId: "BR-GHOST" }] },
  });
  assert.equal(preview.batch.rows[0].action, "ERROR");
  assert.match(preview.batch.rows[0].validationMessages.join(" "), /brandExternalId "BR-GHOST" was not found/);
  assert.equal(db.store.brands.length, 0);
});

test("a categoryExternalId that matches nothing is a blocking error", async () => {
  const db = createFakeDatabase();
  const preview = await previewCatalogImport(db, {
    sourceSystem: "TOOTHPICK_EG",
    entities: { PRODUCTS: [{ externalProductId: "P1", sku: "SKU-1", name: "Composite Bur", price: 100, stockQuantity: 20, categoryExternalId: "CAT-GHOST" }] },
  });
  assert.equal(preview.batch.rows[0].action, "ERROR");
  assert.match(preview.batch.rows[0].validationMessages.join(" "), /categoryExternalId "CAT-GHOST" was not found/);
});

test("a similar-but-different brand name is never fuzzy matched (Bisco vs Bisico stay distinct)", async () => {
  const db = createFakeDatabase({
    brands: [{ id: "brand-1", sourceSystem: null, externalBrandId: null, name: "Bisco", slug: "bisco", updatedAt: new Date() }],
  });
  const preview = await previewCatalogImport(db, {
    sourceSystem: "TOOTHPICK_EG",
    entities: { PRODUCTS: [{ externalProductId: "P1", sku: "SKU-1", name: "Etchant", price: 100, stockQuantity: 20, brandName: "Bisico" }] },
  });
  assert.equal(preview.batch.rows[0].action, "ERROR");
  assert.match(preview.batch.rows[0].validationMessages.join(" "), /brand name "Bisico" was not found/);
});

test("a product with no brand or category reference at all is not an error (both remain optional)", async () => {
  const db = createFakeDatabase();
  const preview = await previewCatalogImport(db, {
    sourceSystem: "TOOTHPICK_EG",
    entities: { PRODUCTS: [{ externalProductId: "P1", sku: "SKU-1", name: "Unbranded Item", price: 100, stockQuantity: 20 }] },
  });
  assert.equal(preview.summary.errorRows, 0);
  const applied = await applyCatalogImportBatch(db, { batchId: preview.batch.id, confirmed: true, actorId: "admin-1" });
  assert.equal(applied.status, "APPLIED");
  assert.equal(db.store.products[0].brandId ?? null, null);
});

// ---------------------------------------------------------------------------
// Duplicate variant combination detection
// ---------------------------------------------------------------------------

function twoVariantEntities({ v1Pairs, v2Pairs }) {
  const optionCodes = [...new Set([...v1Pairs, ...v2Pairs].map((pair) => pair.optionCode))];
  return {
    PRODUCTS: [{ externalProductId: "P1", sku: "SKU-1", name: "Product", price: 100, stockQuantity: 20 }],
    PRODUCT_OPTIONS: optionCodes.map((code) => ({ productExternalId: "P1", code, nameEn: code })),
    OPTION_VALUES: [...v1Pairs, ...v2Pairs].reduce((rows, pair) => {
      if (!rows.some((row) => row.optionCode === pair.optionCode && row.code === pair.valueCode)) {
        rows.push({ productExternalId: "P1", optionCode: pair.optionCode, code: pair.valueCode, valueEn: pair.valueCode });
      }
      return rows;
    }, []),
    VARIANTS: [
      { productExternalId: "P1", externalVariantId: "V1", sku: "SKU-1-A", stockQuantity: 5 },
      { productExternalId: "P1", externalVariantId: "V2", sku: "SKU-1-B", stockQuantity: 5 },
    ],
    VARIANT_OPTION_VALUES: [
      ...v1Pairs.map((pair) => ({ externalVariantId: "V1", optionCode: pair.optionCode, valueCode: pair.valueCode })),
      ...v2Pairs.map((pair) => ({ externalVariantId: "V2", optionCode: pair.optionCode, valueCode: pair.valueCode })),
    ],
  };
}

test("two imported variants with the same one-option combination are both flagged as conflicts", async () => {
  const db = createFakeDatabase();
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: twoVariantEntities({
      v1Pairs: [{ optionCode: "SHADE", valueCode: "A1" }],
      v2Pairs: [{ optionCode: "SHADE", valueCode: "A1" }],
    }),
  });
  const vovRows = preview.batch.rows.filter((row) => row.entityType === "VARIANT_OPTION_VALUES");
  assert.equal(vovRows.length, 2);
  assert.ok(vovRows.every((row) => row.action === "CONFLICT"), "both conflicting variant references must be identified, not just one");
  assert.match(vovRows[0].validationMessages.join(" "), /Duplicate variant combination.*SHADE=A1/);
  assert.equal(db.store.variants.length, 0, "preview must make no catalog mutation");
});

test("two imported variants with the same multi-option combination are flagged, in any submitted row order", async () => {
  const db = createFakeDatabase();
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: twoVariantEntities({
      v1Pairs: [{ optionCode: "COLOR", valueCode: "BLUE" }, { optionCode: "SIZE", valueCode: "MEDIUM" }],
      // Same combination, submitted in the opposite option order.
      v2Pairs: [{ optionCode: "SIZE", valueCode: "MEDIUM" }, { optionCode: "COLOR", valueCode: "BLUE" }],
    }),
  });
  const vovRows = preview.batch.rows.filter((row) => row.entityType === "VARIANT_OPTION_VALUES");
  assert.ok(vovRows.every((row) => row.action === "CONFLICT"));
});

test("variants of two different parent products may legitimately share the same combination", async () => {
  const db = createFakeDatabase();
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: {
      PRODUCTS: [
        { externalProductId: "P1", sku: "SKU-1", name: "Product 1", price: 100, stockQuantity: 20 },
        { externalProductId: "P2", sku: "SKU-2", name: "Product 2", price: 100, stockQuantity: 20 },
      ],
      PRODUCT_OPTIONS: [
        { productExternalId: "P1", code: "SHADE", nameEn: "Shade" },
        { productExternalId: "P2", code: "SHADE", nameEn: "Shade" },
      ],
      OPTION_VALUES: [
        { productExternalId: "P1", optionCode: "SHADE", code: "A1", valueEn: "A1" },
        { productExternalId: "P2", optionCode: "SHADE", code: "A1", valueEn: "A1" },
      ],
      VARIANTS: [
        { productExternalId: "P1", externalVariantId: "V1", sku: "SKU-1-A", stockQuantity: 5 },
        { productExternalId: "P2", externalVariantId: "V2", sku: "SKU-2-A", stockQuantity: 5 },
      ],
      VARIANT_OPTION_VALUES: [
        { externalVariantId: "V1", optionCode: "SHADE", valueCode: "A1" },
        { externalVariantId: "V2", optionCode: "SHADE", valueCode: "A1" },
      ],
    },
  });
  const vovRows = preview.batch.rows.filter((row) => row.entityType === "VARIANT_OPTION_VALUES");
  assert.ok(vovRows.every((row) => row.action === "CREATE"));
});

test("a combination that differs in just one value is not treated as a duplicate", async () => {
  const db = createFakeDatabase();
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: twoVariantEntities({
      v1Pairs: [{ optionCode: "SHADE", valueCode: "A1" }],
      v2Pairs: [{ optionCode: "SHADE", valueCode: "A2" }],
    }),
  });
  const vovRows = preview.batch.rows.filter((row) => row.entityType === "VARIANT_OPTION_VALUES");
  assert.ok(vovRows.every((row) => row.action === "CREATE"));
});

test("an imported variant that duplicates an existing database variant's combination is a conflict", async () => {
  const db = createFakeDatabase({
    products: [{ id: "prod-1", sourceSystem: "OWNER", externalProductId: "P1", sku: "SKU-1", slug: "p1", name: "Product", price: 100, stockQuantity: 20, updatedAt: new Date() }],
    options: [{ id: "opt-shade", productId: "prod-1", code: "SHADE" }],
    values: [{ id: "val-a1", optionId: "opt-shade", code: "A1" }],
    variants: [{ id: "var-existing", productId: "prod-1", sourceSystem: "OWNER", externalVariantId: "V-EXISTING", sku: "SKU-1-EXISTING", status: "ACTIVE", stockQuantity: 3, updatedAt: new Date() }],
    selections: [{ variantId: "var-existing", optionId: "opt-shade", optionValueId: "val-a1" }],
  });
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: {
      PRODUCT_OPTIONS: [{ productExternalId: "P1", code: "SHADE", nameEn: "Shade" }],
      OPTION_VALUES: [{ productExternalId: "P1", optionCode: "SHADE", code: "A1", valueEn: "A1" }],
      VARIANTS: [{ productExternalId: "P1", externalVariantId: "V-NEW", sku: "SKU-1-NEW", stockQuantity: 5 }],
      VARIANT_OPTION_VALUES: [{ externalVariantId: "V-NEW", optionCode: "SHADE", valueCode: "A1" }],
    },
  });
  const vovRow = preview.batch.rows.find((row) => row.entityType === "VARIANT_OPTION_VALUES");
  assert.equal(vovRow.action, "CONFLICT");
  assert.match(vovRow.validationMessages.join(" "), /Duplicate variant combination.*SHADE=A1/);
});

test("a duplicate combination reached only through VARIANT_OPTION_VALUES rows against an existing variant is caught", async () => {
  // Two existing variants of the same product; the batch only edits ONE
  // dimension of variant V2 so that it now matches V1's full combination
  // (V1's other dimension is untouched, coming purely from the database).
  const db = createFakeDatabase({
    products: [{ id: "prod-1", sourceSystem: "OWNER", externalProductId: "P1", sku: "SKU-1", slug: "p1", name: "Product", price: 100, stockQuantity: 20, updatedAt: new Date() }],
    options: [
      { id: "opt-color", productId: "prod-1", code: "COLOR" },
      { id: "opt-size", productId: "prod-1", code: "SIZE" },
    ],
    values: [
      { id: "val-blue", optionId: "opt-color", code: "BLUE" },
      { id: "val-red", optionId: "opt-color", code: "RED" },
      { id: "val-medium", optionId: "opt-size", code: "MEDIUM" },
    ],
    variants: [
      { id: "var-1", productId: "prod-1", sourceSystem: "OWNER", externalVariantId: "V1", sku: "SKU-1-BLUE-M", status: "ACTIVE", stockQuantity: 3, updatedAt: new Date() },
      { id: "var-2", productId: "prod-1", sourceSystem: "OWNER", externalVariantId: "V2", sku: "SKU-1-RED-M", status: "ACTIVE", stockQuantity: 3, updatedAt: new Date() },
    ],
    selections: [
      { variantId: "var-1", optionId: "opt-color", optionValueId: "val-blue" },
      { variantId: "var-1", optionId: "opt-size", optionValueId: "val-medium" },
      { variantId: "var-2", optionId: "opt-color", optionValueId: "val-red" },
      { variantId: "var-2", optionId: "opt-size", optionValueId: "val-medium" },
    ],
  });
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    // Only re-point V2's COLOR from RED to BLUE; SIZE=MEDIUM is inherited from the database.
    entities: { VARIANT_OPTION_VALUES: [{ externalVariantId: "V2", optionCode: "COLOR", valueCode: "BLUE" }] },
  });
  const vovRow = preview.batch.rows[0];
  assert.equal(vovRow.action, "CONFLICT");
  assert.match(vovRow.validationMessages.join(" "), /COLOR=BLUE.*SIZE=MEDIUM|SIZE=MEDIUM.*COLOR=BLUE/);
});

test("a combination that becomes a duplicate after preview causes apply to roll back the entire batch", async () => {
  const db = createFakeDatabase({
    products: [{ id: "prod-1", sourceSystem: "OWNER", externalProductId: "P1", sku: "SKU-1", slug: "p1", name: "Product", price: 100, stockQuantity: 20, updatedAt: new Date() }],
    options: [{ id: "opt-shade", productId: "prod-1", code: "SHADE" }],
    values: [{ id: "val-a1", optionId: "opt-shade", code: "A1" }, { id: "val-a2", optionId: "opt-shade", code: "A2" }],
    variants: [{ id: "var-existing", productId: "prod-1", sourceSystem: "OWNER", externalVariantId: "V-EXISTING", sku: "SKU-1-EXISTING", status: "ACTIVE", stockQuantity: 3, updatedAt: new Date() }],
    selections: [{ variantId: "var-existing", optionId: "opt-shade", optionValueId: "val-a2" }],
  });
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: {
      VARIANTS: [{ productExternalId: "P1", externalVariantId: "V-NEW", sku: "SKU-1-NEW", stockQuantity: 5 }],
      VARIANT_OPTION_VALUES: [{ externalVariantId: "V-NEW", optionCode: "SHADE", valueCode: "A1" }],
    },
  });
  assert.equal(preview.summary.errorRows, 0, "no conflict exists at preview time");

  // Simulate a peer variant introduced by someone else after this preview was generated.
  db.store.variants.push({ id: "var-raced", productId: "prod-1", sourceSystem: "OWNER", externalVariantId: "V-RACED", sku: "SKU-1-RACED", status: "ACTIVE", stockQuantity: 1, updatedAt: new Date() });
  db.store.selections.push({ variantId: "var-raced", optionId: "opt-shade", optionValueId: "val-a1" });

  await assert.rejects(
    applyCatalogImportBatch(db, { batchId: preview.batch.id, confirmed: true, actorId: "admin-1" }),
    (error) => /Duplicate variant combination/.test(error.message)
  );
  assert.equal(db.store.variants.some((v) => v.externalVariantId === "V-NEW"), false, "the whole batch must roll back, including the new variant that would have introduced the duplicate");
});

// ---------------------------------------------------------------------------
// Launch-readiness correction: bilingual product fields and category hierarchy
// ---------------------------------------------------------------------------

test("Arabic product name, short description, and long description survive both preview and commit", async () => {
  const db = createFakeDatabase();
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: {
      PRODUCTS: [{
        externalProductId: "P1", sku: "SKU-1", name: "Composite Bur", nameAr: "مخرطة مركبة",
        price: 100, stockQuantity: 20,
        description: "Long English description.", descriptionAr: "وصف طويل بالعربية.",
        shortDescription: "Short English.", shortDescriptionAr: "قصير بالعربية.",
      }],
    },
  });
  const row = preview.batch.rows[0];
  assert.equal(row.normalizedPayload.nameAr, "مخرطة مركبة");
  assert.equal(row.normalizedPayload.descriptionAr, "وصف طويل بالعربية.");
  assert.equal(row.normalizedPayload.shortDescription, "Short English.");
  assert.equal(row.normalizedPayload.shortDescriptionAr, "قصير بالعربية.");

  await applyCatalogImportBatch(db, { batchId: preview.batch.id, confirmed: true, actorId: "admin-1" });
  const product = db.store.products[0];
  assert.equal(product.name, "Composite Bur");
  assert.equal(product.nameAr, "مخرطة مركبة");
  assert.equal(product.description, "Long English description.");
  assert.equal(product.descriptionAr, "وصف طويل بالعربية.");
  assert.equal(product.shortDescription, "Short English.");
  assert.equal(product.shortDescriptionAr, "قصير بالعربية.");
});

test("existing English-only product rows are unaffected: Arabic fields stay null when the row never supplies them", async () => {
  const db = createFakeDatabase();
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: { PRODUCTS: [{ externalProductId: "P1", sku: "SKU-1", name: "Composite Bur", price: 100, stockQuantity: 20 }] },
  });
  await applyCatalogImportBatch(db, { batchId: preview.batch.id, confirmed: true, actorId: "admin-1" });
  const product = db.store.products[0];
  assert.equal(product.nameAr, null);
  assert.equal(product.descriptionAr, null);
  assert.equal(product.shortDescription, null);
  assert.equal(product.shortDescriptionAr, null);
});

test("updating an existing product whose incoming row omits nameAr/imageUrl preserves the existing values instead of erasing them", async () => {
  const db = createFakeDatabase({
    products: [{
      id: "prod-1", sourceSystem: "EXCEL_IMPORT", externalProductId: "TP-EG-1", sku: "XD-TP-1", slug: "forceps",
      name: "Forceps", nameAr: "ملقاط", price: 100, salePrice: null, stockQuantity: 20,
      description: null, descriptionAr: null, shortDescription: null, shortDescriptionAr: null,
      imageUrl: "/api/uploads/product-images/existing.png", updatedAt: new Date(),
    }],
  });
  // A different sourceSystem (TOOTHPICK_EG) and the same SKU: matches by SKU,
  // not by sourceSystem+externalProductId — the row itself never mentions
  // nameAr or imageUrl at all (this launch's data source doesn't have them).
  const preview = await previewCatalogImport(db, {
    sourceSystem: "TOOTHPICK_EG",
    entities: { PRODUCTS: [{ externalProductId: "TP-EG-1", sku: "XD-TP-1", name: "Forceps", price: 99, stockQuantity: 2 }] },
  });
  assert.equal(preview.batch.rows[0].action, "UPDATE");
  await applyCatalogImportBatch(db, { batchId: preview.batch.id, confirmed: true, actorId: "admin-1" });
  const product = db.store.products[0];
  assert.equal(product.price, 99, "fields the row does supply still update");
  assert.equal(product.nameAr, "ملقاط", "nameAr the row never mentioned must survive the update");
  assert.equal(product.imageUrl, "/api/uploads/product-images/existing.png", "imageUrl the row never mentioned must survive the update");
});

test("a row that explicitly supplies nameAr/imageUrl still overwrites an existing product's prior values", async () => {
  const db = createFakeDatabase({
    products: [{
      id: "prod-1", sourceSystem: "OWNER", externalProductId: "P1", sku: "SKU-1", slug: "forceps",
      name: "Forceps", nameAr: "old", price: 100, salePrice: null, stockQuantity: 20,
      description: null, descriptionAr: null, shortDescription: null, shortDescriptionAr: null,
      imageUrl: "https://example.com/old.jpg", updatedAt: new Date(),
    }],
  });
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: { PRODUCTS: [{ externalProductId: "P1", sku: "SKU-1", name: "Forceps", price: 100, stockQuantity: 20, nameAr: "new", imageUrl: "https://example.com/new.jpg" }] },
  });
  await applyCatalogImportBatch(db, { batchId: preview.batch.id, confirmed: true, actorId: "admin-1" });
  const product = db.store.products[0];
  assert.equal(product.nameAr, "new");
  assert.equal(product.imageUrl, "https://example.com/new.jpg");
});

test("a child category resolves its parent by externalCategoryId and retains the link after commit", async () => {
  const db = createFakeDatabase();
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: {
      // Parent listed first, per the workbook's own "fill in parents before
      // children" convention: within one batch, a Categories row's parent
      // must already be resolvable (an earlier row or the database) — the
      // same ordering rule every other cross-reference in this file follows.
      CATEGORIES: [
        { externalCategoryId: "C1", name: "Restorative" },
        { externalCategoryId: "C2", name: "Composite Restorative", parentExternalCategoryId: "C1" },
      ],
    },
  });
  assert.equal(preview.summary.errorRows, 0);
  const applied = await applyCatalogImportBatch(db, { batchId: preview.batch.id, confirmed: true, actorId: "admin-1" });
  assert.equal(applied.status, "APPLIED");

  const parent = db.store.categories.find((c) => c.externalCategoryId === "C1");
  const child = db.store.categories.find((c) => c.externalCategoryId === "C2");
  assert.ok(parent && child);
  assert.equal(child.parentId, parent.id);
  assert.equal(parent.parentId ?? null, null, "a top-level category has no parent");
});

test("an existing category can be given a newly-imported parent, and an existing parent category is resolved by sourceSystem + externalCategoryId", async () => {
  const db = createFakeDatabase({
    categories: [{ id: "cat-existing", sourceSystem: "OWNER", externalCategoryId: "C2", name: "Composite Restorative", nameAr: null, description: null, parentId: null, updatedAt: new Date() }],
  });
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: { CATEGORIES: [{ externalCategoryId: "C1", name: "Restorative" }] },
  });
  assert.equal(preview.batch.rows[0].action, "CREATE");
  await applyCatalogImportBatch(db, { batchId: preview.batch.id, confirmed: true, actorId: "admin-1" });

  // A second batch links the pre-existing category to the newly created parent.
  const relink = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: { CATEGORIES: [{ externalCategoryId: "C2", name: "Composite Restorative", parentExternalCategoryId: "C1" }] },
  });
  assert.equal(relink.batch.rows[0].action, "SKIP", "text fields are unchanged; only the parent link differs");
  await applyCatalogImportBatch(db, { batchId: relink.batch.id, confirmed: true, actorId: "admin-1" });

  const parent = db.store.categories.find((c) => c.externalCategoryId === "C1");
  const child = db.store.categories.find((c) => c.externalCategoryId === "C2");
  assert.equal(child.parentId, parent.id);
});

test("a Categories row referencing an unknown parent is an error, and no category is created", async () => {
  const db = createFakeDatabase();
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: { CATEGORIES: [{ externalCategoryId: "C1", name: "Restorative", parentExternalCategoryId: "GHOST-PARENT" }] },
  });
  const row = preview.batch.rows[0];
  assert.equal(row.action, "ERROR");
  assert.match(row.validationMessages.join(" "), /parentExternalCategoryId "GHOST-PARENT" was not found/);
  assert.equal(db.store.categories.length, 0);
});

test("a category listed as its own parent is rejected", async () => {
  const db = createFakeDatabase();
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: { CATEGORIES: [{ externalCategoryId: "C1", name: "Restorative", parentExternalCategoryId: "C1" }] },
  });
  assert.equal(preview.batch.rows[0].action, "ERROR");
  assert.match(preview.batch.rows[0].validationMessages.join(" "), /cannot be its own parent/);
});

test("a circular category hierarchy introduced entirely within one batch is rejected at preview time", async () => {
  // All three already exist, so each row's own identity and its parent
  // reference both resolve through the database regardless of row order —
  // isolating the cycle check itself from the "parent must appear earlier"
  // ordering rule a genuinely brand-new chain would otherwise run into.
  const db = createFakeDatabase({
    categories: [
      { id: "cat-1", sourceSystem: "OWNER", externalCategoryId: "C1", name: "A", nameAr: null, description: null, parentId: null, updatedAt: new Date() },
      { id: "cat-2", sourceSystem: "OWNER", externalCategoryId: "C2", name: "B", nameAr: null, description: null, parentId: null, updatedAt: new Date() },
      { id: "cat-3", sourceSystem: "OWNER", externalCategoryId: "C3", name: "C", nameAr: null, description: null, parentId: null, updatedAt: new Date() },
    ],
  });
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: {
      CATEGORIES: [
        { externalCategoryId: "C1", name: "A", parentExternalCategoryId: "C2" },
        { externalCategoryId: "C2", name: "B", parentExternalCategoryId: "C3" },
        { externalCategoryId: "C3", name: "C", parentExternalCategoryId: "C1" },
      ],
    },
  });
  const rows = preview.batch.rows.filter((row) => row.entityType === "CATEGORIES");
  assert.ok(rows.every((row) => row.action === "CONFLICT"), "every category in the cycle must be flagged");
  assert.match(rows[0].validationMessages.join(" "), /Circular category hierarchy/);
  assert.equal(db.store.categories.every((c) => c.parentId === null), true, "preview must make no catalog mutation");
});

test("a circular category hierarchy that only completes through an existing database category is rejected at apply time", async () => {
  const db = createFakeDatabase({
    categories: [{ id: "cat-1", sourceSystem: "OWNER", externalCategoryId: "C1", name: "A", nameAr: null, description: null, parentId: null, updatedAt: new Date() }],
  });
  // Preview cannot see this cycle: C1 already exists with no parent, and C2 is
  // brand new — nothing in this batch's own rows loops back on itself yet.
  const preview = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: { CATEGORIES: [{ externalCategoryId: "C2", name: "B", parentExternalCategoryId: "C1" }] },
  });
  assert.equal(preview.summary.errorRows, 0);
  await applyCatalogImportBatch(db, { batchId: preview.batch.id, confirmed: true, actorId: "admin-1" });
  assert.equal(db.store.categories.find((c) => c.externalCategoryId === "C2").parentId, db.store.categories.find((c) => c.externalCategoryId === "C1").id);

  // Now close the loop: point C1's parent back at C2.
  const closeLoop = await previewCatalogImport(db, {
    sourceSystem: "OWNER",
    entities: { CATEGORIES: [{ externalCategoryId: "C1", name: "A", parentExternalCategoryId: "C2" }] },
  });
  assert.equal(closeLoop.summary.errorRows, 0, "still invisible to the batch-local preview check");
  await assert.rejects(
    applyCatalogImportBatch(db, { batchId: closeLoop.batch.id, confirmed: true, actorId: "admin-1" }),
    (error) => /[Cc]ircular category hierarchy/.test(error.message)
  );
  assert.equal(db.store.categories.find((c) => c.externalCategoryId === "C1").parentId, null, "apply must roll back the whole transaction, leaving C1's original parent untouched");
});

// Regression: a real controlled import against a pre-seeded catalog hit this
// exact case — a pre-existing category with no sourceSystem/externalCategoryId
// of its own matches a Categories row by name alone (SKIP). It is never
// touched by applyCategoryRow (SKIP rows are not applied) and so never gets
// this batch's externalCategoryId written to it. A later row naming it as a
// parent must still resolve, via the SKIP row's own preview-matched targetId
// rather than a fresh sourceSystem+externalCategoryId database lookup.
test("a pre-existing category matched by name only (no sourceSystem/externalCategoryId of its own) can still be resolved as another row's parent", async () => {
  const db = createFakeDatabase({
    categories: [{ id: "cat-legacy", sourceSystem: null, externalCategoryId: null, name: "Endodontics", nameAr: null, description: null, parentId: null, updatedAt: new Date() }],
  });
  const preview = await previewCatalogImport(db, {
    sourceSystem: "EXCEL_IMPORT",
    entities: {
      CATEGORIES: [
        { externalCategoryId: "C3", name: "Endodontics" }, // matches cat-legacy by name -> SKIP
        { externalCategoryId: "C4", name: "Obturation Materials", parentExternalCategoryId: "C3" },
      ],
    },
  });
  const rows = preview.batch.rows.filter((row) => row.entityType === "CATEGORIES");
  assert.equal(rows[0].action, "SKIP");
  assert.equal(rows[1].action, "CREATE");
  assert.equal(preview.summary.errorRows, 0);

  const applied = await applyCatalogImportBatch(db, { batchId: preview.batch.id, confirmed: true, actorId: "admin-1" });
  assert.equal(applied.status, "APPLIED");
  const child = db.store.categories.find((c) => c.externalCategoryId === "C4");
  assert.equal(child.parentId, "cat-legacy");
});
