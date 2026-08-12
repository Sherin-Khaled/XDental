import test from "node:test";
import assert from "node:assert/strict";
import {
  commitOrderStatusTransition,
  decrementOrderStock,
  OrderRequestError,
  restoreOrderStock,
} from "./orderStock.service.js";

function simpleProduct(overrides = {}) {
  return {
    id: "product-1",
    sku: "SKU-1",
    slug: "product-1",
    externalProductId: null,
    name: "Simple Product",
    stockQuantity: 10,
    status: "ACTIVE",
    isAvailable: true,
    ...overrides,
  };
}

function variantRecord(overrides = {}) {
  return {
    id: "variant-1",
    productId: "product-1",
    stockQuantity: 5,
    lowStockThreshold: 5,
    status: "ACTIVE",
    isAvailable: true,
    ...overrides,
  };
}

function createFakeDatabase({ product, variant, variants: variantList, order } = {}) {
  const products = product ? [{ ...product }] : [];
  const variants = variantList ? variantList.map((v) => ({ ...v })) : variant ? [{ ...variant }] : [];
  const orders = order ? [{ ...order }] : [];
  return {
    products,
    variants,
    orders,
    order: {
      updateMany: async ({ where, data }) => {
        // Mirrors Postgres: the row must still be in `where.status` for the swap to apply.
        const match = orders.find((o) => o.id === where.id && o.status === where.status);
        if (!match) return { count: 0 };
        match.status = data.status;
        return { count: 1 };
      },
    },
    product: {
      findMany: async ({ where }) => products.filter((p) =>
        (where.OR ?? []).some((condition) =>
          Object.entries(condition).every(([key, value]) =>
            value && typeof value === "object" && "in" in value ? value.in.includes(p[key]) : p[key] === value
          )
        )
      ),
      updateMany: async ({ where, data }) => {
        const match = products.find((p) =>
          p.id === where.id
          && where.status.in.includes(p.status)
          && p.isAvailable === where.isAvailable
          && p.stockQuantity >= where.stockQuantity.gte
        );
        if (!match) return { count: 0 };
        match.stockQuantity += data.stockQuantity.decrement ? -data.stockQuantity.decrement : (data.stockQuantity.increment ?? 0);
        return { count: 1 };
      },
      findUnique: async ({ where }) => products.find((p) => p.id === where.id) ?? null,
      update: async ({ where, data }) => {
        const record = products.find((p) => p.id === where.id);
        if (data.stockQuantity?.increment !== undefined) record.stockQuantity += data.stockQuantity.increment;
        if (data.status !== undefined) record.status = data.status;
        if (data.isAvailable !== undefined) record.isAvailable = data.isAvailable;
        return record;
      },
    },
    productVariant: {
      updateMany: async ({ where, data }) => {
        const match = variants.find((v) =>
          v.id === where.id
          && (where.productId === undefined || v.productId === where.productId)
          && where.status.in.includes(v.status)
          && v.isAvailable === where.isAvailable
          && v.stockQuantity >= where.stockQuantity.gte
        );
        if (!match) return { count: 0 };
        match.stockQuantity -= data.stockQuantity.decrement;
        return { count: 1 };
      },
      findUnique: async ({ where }) => variants.find((v) => v.id === where.id) ?? null,
      update: async ({ where, data }) => {
        const record = variants.find((v) => v.id === where.id);
        if (data.stockQuantity?.increment !== undefined) record.stockQuantity += data.stockQuantity.increment;
        if (data.status !== undefined) record.status = data.status;
        if (data.isAvailable !== undefined) record.isAvailable = data.isAvailable;
        return record;
      },
    },
  };
}

function orderItem(overrides = {}) {
  return {
    productId: "product-1",
    externalProductId: null,
    sku: "SKU-1",
    variantId: null,
    productName: "Item",
    quantity: 1,
    ...overrides,
  };
}

test("simple product order decrements only Product.stockQuantity", async () => {
  const db = createFakeDatabase({ product: simpleProduct({ stockQuantity: 10 }) });
  await decrementOrderStock(db, { items: [orderItem({ quantity: 3 })] });
  assert.equal(db.products[0].stockQuantity, 7);
  assert.equal(db.variants.length, 0);
});

test("variant product order decrements only the selected ProductVariant.stockQuantity, never the parent Product", async () => {
  const db = createFakeDatabase({ product: simpleProduct({ stockQuantity: 10 }), variant: variantRecord({ stockQuantity: 5 }) });
  await decrementOrderStock(db, { items: [orderItem({ variantId: "variant-1", productName: "Item (Shade A1)", quantity: 2 })] });
  assert.equal(db.variants[0].stockQuantity, 3);
  assert.equal(db.products[0].stockQuantity, 10, "parent Product stock must not change for a variant order");
});

test("insufficient stock is rejected with a 409 and no partial decrement occurs", async () => {
  const db = createFakeDatabase({ product: simpleProduct({ stockQuantity: 2 }) });
  await assert.rejects(
    decrementOrderStock(db, { items: [orderItem({ quantity: 3 })] }),
    (error) => error.statusCode === 409
  );
  assert.equal(db.products[0].stockQuantity, 2);
});

test("insufficient variant stock is rejected with a 409 without touching the parent product", async () => {
  const db = createFakeDatabase({ product: simpleProduct({ stockQuantity: 10 }), variant: variantRecord({ stockQuantity: 1 }) });
  await assert.rejects(
    decrementOrderStock(db, { items: [orderItem({ variantId: "variant-1", quantity: 2 })] }),
    (error) => error.statusCode === 409
  );
  assert.equal(db.variants[0].stockQuantity, 1);
  assert.equal(db.products[0].stockQuantity, 10);
});

test("a concurrent race that drops stock below the requested quantity fails the atomic guard, not a lost update", async () => {
  // Pre-check sees enough stock, but a simulated concurrent order already
  // consumed it by the time the conditional updateMany runs.
  const db = createFakeDatabase({ product: simpleProduct({ stockQuantity: 5 }) });
  const originalUpdateMany = db.product.updateMany;
  let firstCall = true;
  db.product.updateMany = async (args) => {
    if (firstCall) { firstCall = false; db.products[0].stockQuantity = 0; }
    return originalUpdateMany(args);
  };
  await assert.rejects(
    decrementOrderStock(db, { items: [orderItem({ quantity: 3 })] }),
    (error) => error instanceof OrderRequestError && error.statusCode === 409
  );
  assert.equal(db.products[0].stockQuantity, 0, "the raced-away stock must not be double-decremented");
});

test("restoring a simple product order increments only Product.stockQuantity", async () => {
  const db = createFakeDatabase({ product: simpleProduct({ stockQuantity: 7 }) });
  await restoreOrderStock(db, { items: [orderItem({ quantity: 3 })] });
  assert.equal(db.products[0].stockQuantity, 10);
});

test("restoring a variant product order increments only the variant's stock, never the parent product", async () => {
  const db = createFakeDatabase({ product: simpleProduct({ stockQuantity: 10 }), variant: variantRecord({ stockQuantity: 3 }) });
  await restoreOrderStock(db, { items: [orderItem({ variantId: "variant-1", quantity: 2 })] });
  assert.equal(db.variants[0].stockQuantity, 5);
  assert.equal(db.products[0].stockQuantity, 10);
});

test("multiple variants in one order are decremented and restored independently", async () => {
  const db = createFakeDatabase({
    product: simpleProduct({ id: "product-1" }),
    variants: [
      variantRecord({ id: "variant-a", productId: "product-1", stockQuantity: 5 }),
      variantRecord({ id: "variant-b", productId: "product-1", stockQuantity: 8 }),
    ],
  });

  await decrementOrderStock(db, {
    items: [
      orderItem({ variantId: "variant-a", quantity: 2 }),
      orderItem({ variantId: "variant-b", quantity: 3 }),
    ],
  });
  assert.equal(db.variants.find((v) => v.id === "variant-a").stockQuantity, 3);
  assert.equal(db.variants.find((v) => v.id === "variant-b").stockQuantity, 5);

  await restoreOrderStock(db, {
    items: [
      orderItem({ variantId: "variant-a", quantity: 2 }),
    ],
  });
  assert.equal(db.variants.find((v) => v.id === "variant-a").stockQuantity, 5);
  assert.equal(db.variants.find((v) => v.id === "variant-b").stockQuantity, 5, "restoring one variant must not affect another variant of the same product");
});

// ---------------------------------------------------------------------------
// commitOrderStatusTransition: guarded transition + duplicate-restoration replay
// ---------------------------------------------------------------------------

function testOrder(overrides = {}) {
  return { id: "order-1", status: "PENDING_REVIEW", items: [orderItem({ quantity: 2 })], ...overrides };
}

test("confirming a simple-product order decrements stock exactly once, and replaying the same confirmation does not decrement again", async () => {
  const db = createFakeDatabase({ product: simpleProduct({ stockQuantity: 10 }), order: testOrder() });
  // A frozen snapshot, not the live db.orders[0] reference — mirroring what a
  // real replayed or concurrently-racing request actually reads and submits.
  const order = { ...db.orders[0] };

  const first = await commitOrderStatusTransition(db, order, "CONFIRMED");
  assert.equal(first.won, true);
  assert.equal(db.products[0].stockQuantity, 8);
  assert.equal(db.orders[0].status, "CONFIRMED");

  // Replay with the same in-memory `order` snapshot (still "PENDING_REVIEW"),
  // exactly as a retried or duplicated request would submit it.
  const replay = await commitOrderStatusTransition(db, order, "CONFIRMED");
  assert.equal(replay.won, false, "the order already moved to CONFIRMED, so this call must lose the compare-and-swap");
  assert.equal(db.products[0].stockQuantity, 8, "stock must not be decremented a second time");
});

test("confirming a variant-product order decrements the variant's stock exactly once on replay", async () => {
  const db = createFakeDatabase({
    product: simpleProduct({ stockQuantity: 10 }),
    variant: variantRecord({ stockQuantity: 5 }),
    order: testOrder({ items: [orderItem({ variantId: "variant-1", quantity: 2 })] }),
  });
  // A frozen snapshot, not the live db.orders[0] reference — mirroring what a
  // real replayed or concurrently-racing request actually reads and submits.
  const order = { ...db.orders[0] };

  await commitOrderStatusTransition(db, order, "CONFIRMED");
  assert.equal(db.variants[0].stockQuantity, 3);

  const replay = await commitOrderStatusTransition(db, order, "CONFIRMED");
  assert.equal(replay.won, false);
  assert.equal(db.variants[0].stockQuantity, 3, "variant stock must not be decremented a second time");
  assert.equal(db.products[0].stockQuantity, 10);
});

test("canceling a confirmed simple-product order restores stock exactly once, and a replayed cancellation does not restore twice", async () => {
  const db = createFakeDatabase({ product: simpleProduct({ stockQuantity: 8 }), order: testOrder({ status: "CONFIRMED" }) });
  // A frozen snapshot, not the live db.orders[0] reference — mirroring what a
  // real replayed or concurrently-racing request actually reads and submits.
  const order = { ...db.orders[0] };

  const first = await commitOrderStatusTransition(db, order, "CANCELED");
  assert.equal(first.won, true);
  assert.equal(db.products[0].stockQuantity, 10);

  const replay = await commitOrderStatusTransition(db, order, "CANCELED");
  assert.equal(replay.won, false, "the order already moved to CANCELED, so a replayed or stale cancellation must lose the compare-and-swap");
  assert.equal(db.products[0].stockQuantity, 10, "stock must not be restored a second time");
});

test("canceling a confirmed variant-product order restores variant stock exactly once, and a replayed cancellation does not restore twice", async () => {
  const db = createFakeDatabase({
    product: simpleProduct({ stockQuantity: 10 }),
    variant: variantRecord({ stockQuantity: 3 }),
    order: testOrder({ status: "CONFIRMED", items: [orderItem({ variantId: "variant-1", quantity: 2 })] }),
  });
  // A frozen snapshot, not the live db.orders[0] reference — mirroring what a
  // real replayed or concurrently-racing request actually reads and submits.
  const order = { ...db.orders[0] };

  const first = await commitOrderStatusTransition(db, order, "CANCELED");
  assert.equal(first.won, true);
  assert.equal(db.variants[0].stockQuantity, 5);

  const replay = await commitOrderStatusTransition(db, order, "CANCELED");
  assert.equal(replay.won, false);
  assert.equal(db.variants[0].stockQuantity, 5, "variant stock must not be restored a second time");
  assert.equal(db.products[0].stockQuantity, 10, "the parent product must never be touched for a variant order");
});

test("canceling from a status that never committed stock (PENDING_REVIEW) does not restore any stock", async () => {
  const db = createFakeDatabase({ product: simpleProduct({ stockQuantity: 10 }), order: testOrder({ status: "PENDING_REVIEW" }) });
  // A frozen snapshot, not the live db.orders[0] reference — mirroring what a
  // real replayed or concurrently-racing request actually reads and submits.
  const order = { ...db.orders[0] };

  const result = await commitOrderStatusTransition(db, order, "CANCELED");
  assert.equal(result.won, true);
  assert.equal(db.products[0].stockQuantity, 10, "PENDING_REVIEW never committed stock, so cancellation must not restore any");
});

test("a transition into a non-stock-affecting status (e.g. REJECTED) touches no stock at all", async () => {
  const db = createFakeDatabase({ product: simpleProduct({ stockQuantity: 10 }), order: testOrder({ status: "PENDING_REVIEW" }) });
  // A frozen snapshot, not the live db.orders[0] reference — mirroring what a
  // real replayed or concurrently-racing request actually reads and submits.
  const order = { ...db.orders[0] };

  const result = await commitOrderStatusTransition(db, order, "REJECTED");
  assert.equal(result.won, true);
  assert.equal(db.products[0].stockQuantity, 10);
});
