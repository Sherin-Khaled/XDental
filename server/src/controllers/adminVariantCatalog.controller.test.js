import test from "node:test";
import assert from "node:assert/strict";
import {
  createProductVariant,
  replaceVariantOptionValues,
  updateProductVariant,
} from "./adminVariantCatalog.controller.js";

function p2002(target) {
  const error = new Error("Unique constraint failed");
  error.code = "P2002";
  error.meta = { target };
  return error;
}

/** A minimal fake modeling Prisma's real compound-unique behavior for variants. */
function createFakeVariantDatabase(seedVariants = []) {
  const variants = seedVariants.map((v) => ({ status: "ACTIVE", stockQuantity: 1, ...v }));
  let seq = 1;

  function violatesUnique(candidate, excludeId = null) {
    return variants.some((existing) => {
      if (existing.id === excludeId) return false;
      if (candidate.sku && existing.sku === candidate.sku) return true;
      if (candidate.barcode && existing.barcode === candidate.barcode) return true;
      if (
        candidate.sourceSystem && candidate.externalVariantId &&
        existing.sourceSystem === candidate.sourceSystem && existing.externalVariantId === candidate.externalVariantId
      ) return true;
      return false;
    });
  }

  return {
    variants,
    productVariant: {
      create: async ({ data }) => {
        if (violatesUnique(data)) throw p2002(["sku"]);
        const record = { id: `variant-${seq++}`, selections: [], ...data };
        variants.push(record);
        return record;
      },
      update: async ({ where, data }) => {
        if (violatesUnique(data, where.id)) throw p2002(["sku"]);
        const record = variants.find((v) => v.id === where.id);
        Object.assign(record, data);
        return record;
      },
    },
  };
}

test("creating a variant with a SKU that already exists on this product returns a safe 409, not a raw Prisma error", async () => {
  const db = createFakeVariantDatabase([{ id: "variant-1", sku: "SKU-A", barcode: null, sourceSystem: null, externalVariantId: null }]);
  const result = await createProductVariant(db, "product-1", { sku: "SKU-A", stockQuantity: 1 });
  assert.equal(result.error.status, 409);
  assert.equal(result.error.message, "Variant SKU, barcode, or external identifier already exists.");
  assert.equal(JSON.stringify(result).includes("P2002"), false);
});

test("creating a variant with a barcode that already exists on this product returns a safe 409", async () => {
  const db = createFakeVariantDatabase([{ id: "variant-1", sku: null, barcode: "0000111122223", sourceSystem: null, externalVariantId: null }]);
  const result = await createProductVariant(db, "product-1", { barcode: "0000111122223", stockQuantity: 1 });
  assert.equal(result.error.status, 409);
});

test("externalVariantId uniqueness is scoped by sourceSystem: the same external id under a different source does not conflict", async () => {
  const db = createFakeVariantDatabase([{ id: "variant-1", sku: null, barcode: null, sourceSystem: "OWNER", externalVariantId: "V1" }]);
  const sameSource = await createProductVariant(db, "product-1", { sourceSystem: "OWNER", externalVariantId: "V1", stockQuantity: 1 });
  assert.equal(sameSource.error.status, 409, "same sourceSystem + same externalVariantId must conflict");

  const differentSource = await createProductVariant(db, "product-1", { sourceSystem: "OTHER_SYSTEM", externalVariantId: "V1", stockQuantity: 1 });
  assert.equal(differentSource.error, undefined, "the same externalVariantId under a different sourceSystem must not conflict");
});

test("updating a variant's SKU to one already used by another variant returns a safe 409", async () => {
  const db = createFakeVariantDatabase([
    { id: "variant-1", sku: "SKU-A", barcode: null, sourceSystem: null, externalVariantId: null },
    { id: "variant-2", sku: "SKU-B", barcode: null, sourceSystem: null, externalVariantId: null },
  ]);
  const result = await updateProductVariant(db, db.variants[1], { sku: "SKU-A" });
  assert.equal(result.error.status, 409);
  assert.equal(result.error.message, "Variant SKU or barcode already exists.");
});

test("re-saving a variant's own SKU during an update is not treated as a conflict with itself", async () => {
  const db = createFakeVariantDatabase([{ id: "variant-1", sku: "SKU-A", barcode: null, sourceSystem: null, externalVariantId: null, stockQuantity: 3 }]);
  const result = await updateProductVariant(db, db.variants[0], { sku: "SKU-A", stockQuantity: 5 });
  assert.equal(result.error, undefined);
  assert.equal(result.variant.stockQuantity, 5);
});

function optionValue(id, optionId, optionCode, valueCode) {
  return { id, optionId, code: valueCode, option: { productId: "product-1", code: optionCode } };
}
function peerVariant(id, pairs) {
  return {
    id,
    productId: "product-1",
    selections: pairs.map(({ optionCode, valueCode }) => ({ option: { code: optionCode }, optionValue: { code: valueCode } })),
  };
}

function createFakeCombinationDatabase({ optionValues, peers }) {
  return {
    productOptionValue: {
      findMany: async ({ where }) => optionValues.filter((value) => where.id.in.includes(value.id)),
    },
    productVariant: {
      findMany: async ({ where }) => peers.filter((peer) => peer.productId === where.productId && peer.id !== where.id.not),
    },
    $transaction: async (fn) => fn({
      productVariantOptionValue: {
        deleteMany: async () => {},
        createMany: async () => {},
      },
    }),
  };
}

test("assigning a single-option combination that another variant of the same product already has is rejected", async () => {
  const db = createFakeCombinationDatabase({
    optionValues: [optionValue("value-a1", "option-shade", "SHADE", "A1")],
    peers: [peerVariant("variant-2", [{ optionCode: "SHADE", valueCode: "A1" }])],
  });
  const result = await replaceVariantOptionValues(db, { id: "variant-1", productId: "product-1" }, ["value-a1"]);
  assert.equal(result.error.status, 409);
  assert.match(result.error.message, /SHADE=A1/);
  assert.equal(JSON.stringify(result).match(/variant-2|option-shade/), null, "the message must not leak internal database IDs");
});

test("assigning a multi-option combination that duplicates another variant is rejected regardless of input order", async () => {
  const db = createFakeCombinationDatabase({
    optionValues: [
      optionValue("value-blue", "option-color", "COLOR", "BLUE"),
      optionValue("value-medium", "option-size", "SIZE", "MEDIUM"),
    ],
    peers: [peerVariant("variant-2", [{ optionCode: "SIZE", valueCode: "MEDIUM" }, { optionCode: "COLOR", valueCode: "BLUE" }])],
  });
  // Submitted in the opposite order from how the peer's selections are stored.
  const result = await replaceVariantOptionValues(db, { id: "variant-1", productId: "product-1" }, ["value-blue", "value-medium"]);
  assert.equal(result.error.status, 409);
});

test("a combination that differs in even one value is not a duplicate", async () => {
  const db = createFakeCombinationDatabase({
    optionValues: [
      optionValue("value-blue", "option-color", "COLOR", "BLUE"),
      optionValue("value-large", "option-size", "SIZE", "LARGE"),
    ],
    peers: [peerVariant("variant-2", [{ optionCode: "COLOR", valueCode: "BLUE" }, { optionCode: "SIZE", valueCode: "MEDIUM" }])],
  });
  const result = await replaceVariantOptionValues(db, { id: "variant-1", productId: "product-1" }, ["value-blue", "value-large"]);
  assert.equal(result.error, undefined);
  assert.equal(result.signature, "COLOR=BLUE, SIZE=LARGE");
});

test("the same option/value combination is allowed for variants of two different parent products", async () => {
  const db = createFakeCombinationDatabase({
    optionValues: [optionValue("value-a1", "option-shade", "SHADE", "A1")],
    // This peer belongs to a different product, so findMany's productId filter excludes it.
    peers: [{ ...peerVariant("variant-2", [{ optionCode: "SHADE", valueCode: "A1" }]), productId: "product-2" }],
  });
  const result = await replaceVariantOptionValues(db, { id: "variant-1", productId: "product-1" }, ["value-a1"]);
  assert.equal(result.error, undefined);
});

test("re-saving a variant's own unchanged combination succeeds even though it matches its own current selections", async () => {
  const db = createFakeCombinationDatabase({
    optionValues: [optionValue("value-a1", "option-shade", "SHADE", "A1")],
    peers: [], // the variant itself is excluded from `peers` by the productVariant.findMany id-not filter
  });
  const result = await replaceVariantOptionValues(db, { id: "variant-1", productId: "product-1" }, ["value-a1"]);
  assert.equal(result.error, undefined);
  assert.equal(result.message, "Variant option combination saved.");
});
