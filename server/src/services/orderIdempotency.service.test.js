import test from "node:test";
import assert from "node:assert/strict";
import {
  createOrderRequestFingerprint,
  executeIdempotentOrderCreation,
  isOrderIdempotencyConflict,
  normalizeOrderIdempotencyKey,
  OrderIdempotencyError,
} from "./orderIdempotency.service.js";

const KEY = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_KEY = "a5ffb27f-43d4-4800-93e8-ec86b8df710d";

function requestInput(overrides = {}) {
  return {
    contact: {
      name: " Dr. Mazen ",
      email: "MAZEN@EXAMPLE.COM",
      phone: "01000000000",
    },
    deliveryMethod: "standard",
    paymentMethod: "cash",
    promoCode: " save20 ",
    shippingAddress: {
      country: "Egypt",
      governorate: "Cairo",
      cityArea: "Nasr City",
      street: "Dental Street",
      building: "12",
      apartmentFloor: "3",
      postalCode: "",
      deliveryNotes: "",
      clinicName: "X Clinic",
      clinicBranch: "Main",
      orderNotes: "Call first",
    },
    items: [
      { productId: "product-b", sku: "B-2", quantity: 2 },
      { productId: "product-a", sku: "A-1", quantity: 1 },
    ],
    ...overrides,
  };
}

function createFakeOrderDatabase(initialOrders = []) {
  const state = {
    orders: initialOrders.map((order) => ({ ...order })),
    counts: {
      orders: initialOrders.length,
      orderItems: 0,
      notifications: 0,
      stockOperations: 0,
      syncOperations: 0,
    },
    nextOrderNumber: 1,
  };

  const findOrder = ({ where }) => {
    const key = where.userId_idempotencyKey;
    return (
      state.orders.find(
        (order) =>
          order.userId === key.userId &&
          order.idempotencyKey === key.idempotencyKey
      ) ?? null
    );
  };

  const transaction = {
    order: {
      create: async ({ data }) => {
        if (
          state.orders.some(
            (order) =>
              order.userId === data.userId &&
              order.idempotencyKey === data.idempotencyKey
          )
        ) {
          const error = new Error("Unique constraint");
          error.code = "P2002";
          error.meta = { target: ["userId", "idempotencyKey"] };
          throw error;
        }
        const order = {
          id: `order-${state.counts.orders + 1}`,
          orderNumber: `ORD-TEST-${state.nextOrderNumber++}`,
          ...data,
        };
        state.orders.push(order);
        state.counts.orders += 1;
        state.counts.orderItems += data.items.length;
        return order;
      },
    },
  };

  return {
    state,
    order: { findUnique: async (query) => findOrder(query) },
    $transaction: async (work) => work(transaction),
  };
}

function createOrderCallback(database, {
  userId,
  idempotencyKey,
  requestFingerprint,
  total = 150,
}) {
  return async (transaction) => {
    const order = await transaction.order.create({
      data: {
        userId,
        idempotencyKey,
        requestFingerprint,
        total,
        items: [{ productId: "product-a", quantity: 1 }],
      },
    });
    database.state.counts.notifications += 1;
    database.state.counts.stockOperations += 1;
    database.state.counts.syncOperations += 1;
    return order;
  };
}

function execute(database, {
  userId = "customer-a",
  idempotencyKey = KEY,
  input = requestInput(),
  total,
} = {}) {
  const requestFingerprint = createOrderRequestFingerprint(input);
  return executeIdempotentOrderCreation({
    database,
    userId,
    idempotencyKey,
    requestFingerprint,
    create: createOrderCallback(database, {
      userId,
      idempotencyKey,
      requestFingerprint,
      total,
    }),
  });
}

test("accepts UUID-style checkout keys and trims harmless outer whitespace", () => {
  assert.equal(
    normalizeOrderIdempotencyKey(" 550e8400-e29b-41d4-a716-446655440000 "),
    "550e8400-e29b-41d4-a716-446655440000"
  );
});

test("rejects missing, short, oversized, or unsafe checkout keys", () => {
  assert.equal(normalizeOrderIdempotencyKey(undefined), "");
  assert.equal(normalizeOrderIdempotencyKey("short"), "");
  assert.equal(normalizeOrderIdempotencyKey("x".repeat(129)), "");
  assert.equal(normalizeOrderIdempotencyKey("checkout key with spaces"), "");
  assert.equal(normalizeOrderIdempotencyKey("<script>checkout-key</script>"), "");
});

test("recognizes only the per-user idempotency unique conflict", () => {
  assert.equal(isOrderIdempotencyConflict({
    code: "P2002",
    meta: { target: ["userId", "idempotencyKey"] },
  }), true);
  assert.equal(isOrderIdempotencyConflict({
    code: "P2002",
    meta: { target: "Order_userId_idempotencyKey_key" },
  }), true);
  assert.equal(isOrderIdempotencyConflict({
    code: "P2002",
    meta: { target: ["orderNumber"] },
  }), false);
  assert.equal(isOrderIdempotencyConflict({ code: "P2025" }), false);
});

test("creates one order for a first request and marks it as non-replay", async () => {
  const database = createFakeOrderDatabase();
  const result = await execute(database);

  assert.equal(result.created, true);
  assert.equal(result.idempotentReplay, false);
  assert.equal(database.state.counts.orders, 1);
  assert.equal(database.state.counts.orderItems, 1);
});

test("same key and normalized payload returns the same order", async () => {
  const database = createFakeOrderDatabase();
  const first = await execute(database);
  const replay = await execute(database, {
    input: requestInput({
      items: [...requestInput().items].reverse(),
      contact: {
        name: "Dr. Mazen",
        email: "mazen@example.com",
        phone: "01000000000",
      },
    }),
  });

  assert.equal(replay.idempotentReplay, true);
  assert.equal(replay.order.id, first.order.id);
  assert.equal(replay.order.orderNumber, first.order.orderNumber);
});

test("successful replay returns before current pricing or promotion recalculation", async () => {
  const input = requestInput();
  const requestFingerprint = createOrderRequestFingerprint(input);
  const existingOrder = {
    id: "existing-order",
    userId: "customer-a",
    orderNumber: "ORD-EXISTING",
    idempotencyKey: KEY,
    requestFingerprint,
    total: 150,
  };
  const database = createFakeOrderDatabase([existingOrder]);
  let pricingRecalculations = 0;

  const replay = await executeIdempotentOrderCreation({
    database,
    userId: "customer-a",
    idempotencyKey: KEY,
    requestFingerprint,
    create: async () => {
      pricingRecalculations += 1;
      throw new Error("must not run for a replay");
    },
  });

  assert.equal(replay.idempotentReplay, true);
  assert.equal(replay.order.total, 150);
  assert.equal(pricingRecalculations, 0);
});

test("sequential duplicate requests create one order and one set of side effects", async () => {
  const database = createFakeOrderDatabase();
  await execute(database);
  await execute(database);

  assert.deepEqual(database.state.counts, {
    orders: 1,
    orderItems: 1,
    notifications: 1,
    stockOperations: 1,
    syncOperations: 1,
  });
});

test("concurrent duplicate requests use the unique constraint and create one order", async () => {
  const database = createFakeOrderDatabase();
  const [first, second] = await Promise.all([
    execute(database),
    execute(database),
  ]);

  assert.equal(database.state.counts.orders, 1);
  assert.equal(database.state.counts.orderItems, 1);
  assert.equal(database.state.counts.notifications, 1);
  assert.equal(database.state.counts.stockOperations, 1);
  assert.equal(first.order.id, second.order.id);
  assert.equal(
    [first.idempotentReplay, second.idempotentReplay].filter(Boolean).length,
    1
  );
});

test("the same idempotency key with a different variant is treated as a changed request, not a safe replay", async () => {
  const database = createFakeOrderDatabase();
  await execute(database, {
    input: requestInput({ items: [{ productId: "product-a", sku: "A-1", variantId: "variant-a", quantity: 1 }] }),
  });

  await assert.rejects(
    execute(database, {
      input: requestInput({ items: [{ productId: "product-a", sku: "A-1", variantId: "variant-b", quantity: 1 }] }),
    }),
    (error) => error instanceof OrderIdempotencyError && error.code === "IDEMPOTENCY_KEY_REUSED"
  );
  assert.equal(database.state.counts.orders, 1, "the second variant must never be silently discarded as an identical replay");
});

test("same key with a different payload returns the stable 409 conflict", async () => {
  const database = createFakeOrderDatabase();
  await execute(database);

  await assert.rejects(
    execute(database, {
      input: requestInput({
        shippingAddress: {
          ...requestInput().shippingAddress,
          building: "99",
        },
      }),
    }),
    (error) =>
      error instanceof OrderIdempotencyError &&
      error.statusCode === 409 &&
      error.code === "IDEMPOTENCY_KEY_REUSED"
  );
  assert.equal(database.state.counts.orders, 1);
});

test("different keys with the same payload represent intentional separate orders", async () => {
  const database = createFakeOrderDatabase();
  const first = await execute(database);
  const second = await execute(database, { idempotencyKey: OTHER_KEY });

  assert.equal(database.state.counts.orders, 2);
  assert.notEqual(first.order.id, second.order.id);
  assert.notEqual(first.order.orderNumber, second.order.orderNumber);
});

test("different authenticated customers may independently use the same key", async () => {
  const database = createFakeOrderDatabase();
  await execute(database, { userId: "customer-a" });
  await execute(database, { userId: "customer-b" });

  assert.equal(database.state.counts.orders, 2);
  assert.equal(
    database.state.orders.filter((order) => order.idempotencyKey === KEY).length,
    2
  );
});

test("existing old orders with null idempotency fields remain untouched and readable", async () => {
  const oldOrder = {
    id: "old-order",
    userId: "customer-a",
    orderNumber: "ORD-OLD-1",
    idempotencyKey: null,
    requestFingerprint: null,
  };
  const database = createFakeOrderDatabase([oldOrder]);
  const result = await execute(database);

  assert.deepEqual(database.state.orders[0], oldOrder);
  assert.equal(database.state.orders[0].orderNumber, "ORD-OLD-1");
  assert.equal(result.created, true);
});

test("fingerprint excludes frontend totals and creation uses the authoritative value", async () => {
  const inputWithFakeTotals = {
    ...requestInput(),
    subtotal: 1,
    shipping: 1,
    discount: 99999,
    total: 0,
  };
  assert.equal(
    createOrderRequestFingerprint(inputWithFakeTotals),
    createOrderRequestFingerprint({
      ...inputWithFakeTotals,
      subtotal: 90000,
      shipping: 80000,
      discount: 0,
      total: 170000,
    })
  );

  const database = createFakeOrderDatabase();
  const result = await execute(database, {
    input: inputWithFakeTotals,
    total: 150,
  });
  assert.equal(result.order.total, 150);
});

test("unrelated Prisma failures are not converted into replays", async () => {
  const error = Object.assign(new Error("Database unavailable"), { code: "P1001" });
  const database = {
    order: { findUnique: async () => null },
    $transaction: async () => {
      throw error;
    },
  };
  await assert.rejects(execute(database), error);
});
