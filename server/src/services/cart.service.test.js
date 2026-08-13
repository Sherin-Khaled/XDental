import test from "node:test";
import assert from "node:assert/strict";
import {
  CartRequestError,
  addUserCartItem,
  clearUserCart,
  getUserCart,
  mergeUserCart,
  normalizeSelectedOptions,
  parseCartItemInput,
  setUserCartItemQuantity,
} from "./cart.service.js";

test("normalizes cart input without accepting invalid IDs, quantities, or oversized options", () => {
  assert.deepEqual(parseCartItemInput({
    productId: " product-1 ",
    quantity: 2,
    selectedOptions: " Blue ",
  }), {
    productId: "product-1",
    quantity: 2,
    selectedOptions: "Blue",
  });
  assert.equal(normalizeSelectedOptions(null), "");
  assert.throws(
    () => parseCartItemInput({ productId: "", quantity: 1 }),
    CartRequestError
  );
  for (const quantity of [0, -1]) {
    assert.throws(
      () => parseCartItemInput({ productId: "product-1", quantity }),
      (error) =>
        error instanceof CartRequestError &&
        error.code === "INVALID_CART_QUANTITY" &&
        error.requestedQuantity === quantity
    );
  }
  assert.throws(
    () => normalizeSelectedOptions("x".repeat(301)),
    CartRequestError
  );
});

test("reads only the authenticated user's cart", async () => {
  let capturedQuery;
  const database = {
    cartItem: {
      findMany: async (query) => {
        capturedQuery = query;
        return [];
      },
    },
  };

  await getUserCart(database, "customer-a");
  assert.equal(capturedQuery.where.userId, "customer-a");
  assert.deepEqual(capturedQuery.include, { product: true });
});

test("adds a cart item under the authenticated user and never trusts browser product data", async () => {
  let upsertQuery;
  const transaction = {
    product: {
      findUnique: async () => ({
        id: "product-1",
        name: "Server Product",
        price: 250,
        stockQuantity: 10,
        status: "ACTIVE",
        isAvailable: true,
      }),
    },
    cartItem: {
      findMany: async () => [],
      count: async () => 0,
      upsert: async (query) => {
        upsertQuery = query;
      },
    },
  };
  const database = {
    $transaction: async (callback) => callback(transaction),
  };

  await addUserCartItem(database, "customer-a", {
    productId: "product-1",
    quantity: 2,
    selectedOptions: null,
    price: 1,
    productName: "Browser Product",
  });

  assert.deepEqual(upsertQuery.create, {
    userId: "customer-a",
    productId: "product-1",
    quantity: 2,
    selectedOptions: "",
  });
  assert.equal("price" in upsertQuery.create, false);
  assert.equal("productName" in upsertQuery.create, false);
  assert.equal(
    upsertQuery.where.userId_productId_selectedOptions.userId,
    "customer-a"
  );
});

test("rejects unavailable products before storing them", async () => {
  const transaction = {
    product: {
      findUnique: async () => ({
        id: "product-1",
        name: "Unavailable Product",
        price: 250,
        stockQuantity: 10,
        status: "INACTIVE",
        isAvailable: false,
      }),
    },
    cartItem: {
      findMany: async () => [],
    },
  };
  const database = {
    $transaction: async (callback) => callback(transaction),
  };

  await assert.rejects(
    addUserCartItem(database, "customer-a", {
      productId: "product-1",
      quantity: 1,
    }),
    (error) => error instanceof CartRequestError && error.statusCode === 409
  );
});

test("rejects inquiry and quote products before they can be stored in a cart", async () => {
  for (const purchaseMode of ["INQUIRY", "QUOTE"]) {
    const transaction = {
      product: {
        findUnique: async () => ({
          id: "product-1",
          name: "Request-only Product",
          price: 250,
          stockQuantity: 10,
          status: "ACTIVE",
          isAvailable: true,
          purchaseMode,
          variants: [],
        }),
      },
      cartItem: { findMany: async () => [] },
    };
    await assert.rejects(
      addUserCartItem({ $transaction: async (callback) => callback(transaction) }, "customer-a", {
        productId: "product-1",
        quantity: 1,
      }),
      (error) => error instanceof CartRequestError && error.code === "PRODUCT_REQUIRES_REQUEST"
    );
  }
});

test("allows exactly the available stock and rejects one unit above it", async () => {
  let savedQuantity = null;
  const transaction = {
    product: {
      findUnique: async () => ({
        id: "product-1",
        name: "Last Product",
        price: 250,
        stockQuantity: 1,
        status: "LOW_STOCK",
        isAvailable: true,
      }),
    },
    cartItem: {
      findMany: async () => [],
      count: async () => 0,
      upsert: async ({ create }) => {
        savedQuantity = create.quantity;
      },
    },
  };
  const database = { $transaction: async (callback) => callback(transaction) };

  await addUserCartItem(database, "customer-a", {
    productId: "product-1",
    quantity: 1,
  });
  assert.equal(savedQuantity, 1);

  await assert.rejects(
    addUserCartItem(database, "customer-a", {
      productId: "product-1",
      quantity: 2,
    }),
    (error) =>
      error instanceof CartRequestError &&
      error.code === "INSUFFICIENT_STOCK" &&
      error.requestedQuantity === 2 &&
      error.availableQuantity === 1
  );
});

test("repeated adds and product-option lines share one physical stock limit", async () => {
  const transaction = {
    product: {
      findUnique: async () => ({
        id: "product-1",
        name: "Single Unit Product",
        price: 250,
        stockQuantity: 1,
        status: "ACTIVE",
        isAvailable: true,
      }),
    },
    cartItem: {
      findMany: async () => [
        { id: "line-a", productId: "product-1", selectedOptions: "Blue", quantity: 1 },
      ],
    },
  };
  const database = { $transaction: async (callback) => callback(transaction) };

  for (const selectedOptions of ["Blue", "Red"]) {
    await assert.rejects(
      addUserCartItem(database, "customer-a", {
        productId: "product-1",
        quantity: 1,
        selectedOptions,
      }),
      (error) =>
        error instanceof CartRequestError &&
        error.code === "INSUFFICIENT_STOCK" &&
        error.availableQuantity === 1
    );
  }
});

test("quantity updates validate the total across product-option lines", async () => {
  let updateCalled = false;
  const transaction = {
    product: {
      findUnique: async () => ({
        id: "product-1",
        name: "Option Product",
        price: 250,
        stockQuantity: 2,
        status: "ACTIVE",
        isAvailable: true,
      }),
    },
    cartItem: {
      findMany: async () => [
        { id: "line-a", productId: "product-1", selectedOptions: "Blue", quantity: 1 },
        { id: "line-b", productId: "product-1", selectedOptions: "Red", quantity: 1 },
      ],
      update: async () => {
        updateCalled = true;
      },
    },
  };
  const database = { $transaction: async (callback) => callback(transaction) };

  await assert.rejects(
    setUserCartItemQuantity(database, "customer-a", {
      productId: "product-1",
      quantity: 2,
      selectedOptions: "Blue",
    }),
    (error) =>
      error instanceof CartRequestError &&
      error.code === "INSUFFICIENT_STOCK" &&
      error.requestedQuantity === 3 &&
      error.availableQuantity === 2
  );
  assert.equal(updateCalled, false);
});

test("guest-cart merge rejects a stale quantity without changing stored lines", async () => {
  let upsertCalled = false;
  const transaction = {
    product: {
      findMany: async () => [{
        id: "product-1",
        name: "Merge Product",
        price: 250,
        stockQuantity: 1,
        status: "ACTIVE",
        isAvailable: true,
      }],
    },
    cartItem: {
      findMany: async () => [
        { id: "line-a", productId: "product-1", selectedOptions: "", quantity: 1 },
      ],
      upsert: async () => {
        upsertCalled = true;
      },
    },
  };
  const database = { $transaction: async (callback) => callback(transaction) };

  await assert.rejects(
    mergeUserCart(database, "customer-a", [{
      productId: "product-1",
      quantity: 1,
    }]),
    (error) =>
      error instanceof CartRequestError &&
      error.code === "INSUFFICIENT_STOCK" &&
      error.requestedQuantity === 2 &&
      error.availableQuantity === 1
  );
  assert.equal(upsertCalled, false);
});

function variantSelection() {
  return { option: { code: "SHADE", nameEn: "Shade", sortOrder: 0 }, optionValue: { code: "A1", valueEn: "A1" } };
}
function variantProduct(variants) {
  return {
    id: "product-variant",
    name: "Variant Product",
    price: 200,
    stockQuantity: null,
    status: "ACTIVE",
    isAvailable: true,
    variants,
  };
}
function activeVariant(overrides = {}) {
  return {
    id: "variant-a",
    sku: "SKU-A",
    priceOverride: null,
    stockQuantity: 4,
    lowStockThreshold: 5,
    status: "ACTIVE",
    isAvailable: true,
    selections: [variantSelection()],
    ...overrides,
  };
}

test("a variant is required when the product has variants", async () => {
  const transaction = {
    product: { findUnique: async () => variantProduct([activeVariant()]) },
    cartItem: { findMany: async () => [] },
  };
  const database = { $transaction: async (callback) => callback(transaction) };

  await assert.rejects(
    addUserCartItem(database, "customer-a", { productId: "product-variant", quantity: 1 }),
    (error) => error instanceof CartRequestError && error.code === "VARIANT_REQUIRED"
  );
});

test("an invalid variant id is rejected", async () => {
  const transaction = {
    product: { findUnique: async () => variantProduct([activeVariant()]) },
    cartItem: { findMany: async () => [] },
  };
  const database = { $transaction: async (callback) => callback(transaction) };

  await assert.rejects(
    addUserCartItem(database, "customer-a", { productId: "product-variant", variantId: "does-not-exist", quantity: 1 }),
    (error) => error instanceof CartRequestError && error.code === "INVALID_VARIANT"
  );
});

test("a variant id that belongs to a different product is rejected the same way as an unknown one", async () => {
  // The product lookup only returns this product's own variants, so a
  // variantId minted for another product can never resolve here.
  const transaction = {
    product: { findUnique: async () => variantProduct([activeVariant({ id: "variant-a" })]) },
    cartItem: { findMany: async () => [] },
  };
  const database = { $transaction: async (callback) => callback(transaction) };

  await assert.rejects(
    addUserCartItem(database, "customer-a", { productId: "product-variant", variantId: "variant-from-other-product", quantity: 1 }),
    (error) => error instanceof CartRequestError && error.code === "INVALID_VARIANT"
  );
});

test("adding the same variant twice merges into one cart row and sums the quantity", async () => {
  let created = null;
  let updatedQuantity = null;
  const transaction = {
    product: { findUnique: async () => variantProduct([activeVariant({ stockQuantity: 10 })]) },
    cartItem: {
      findMany: async () => created ? [created] : [],
      count: async () => created ? 1 : 0,
      create: async ({ data }) => { created = { id: "line-1", ...data }; return created; },
      update: async ({ data }) => { updatedQuantity = data.quantity; },
    },
  };
  const database = { $transaction: async (callback) => callback(transaction) };

  await addUserCartItem(database, "customer-a", { productId: "product-variant", variantId: "variant-a", quantity: 2 });
  assert.equal(created.variantId, "variant-a");
  assert.equal(created.quantity, 2);

  await addUserCartItem(database, "customer-a", { productId: "product-variant", variantId: "variant-a", quantity: 3 });
  assert.equal(updatedQuantity, 5, "the second add must update the existing row's quantity, not create a new one");
});

test("adding a different variant of the same product creates a separate cart row", async () => {
  const createdRows = [];
  const transaction = {
    product: {
      findUnique: async () => variantProduct([
        activeVariant({ id: "variant-a", stockQuantity: 10 }),
        activeVariant({ id: "variant-b", stockQuantity: 10, selections: [{ option: { code: "SHADE", nameEn: "Shade", sortOrder: 0 }, optionValue: { code: "A2", valueEn: "A2" } }] }),
      ]),
    },
    cartItem: {
      findMany: async () => createdRows,
      count: async () => createdRows.length,
      create: async ({ data }) => { const row = { id: `line-${createdRows.length + 1}`, ...data }; createdRows.push(row); return row; },
      update: async () => { throw new Error("must not update an existing row for a different variant"); },
    },
  };
  const database = { $transaction: async (callback) => callback(transaction) };

  await addUserCartItem(database, "customer-a", { productId: "product-variant", variantId: "variant-a", quantity: 1 });
  await addUserCartItem(database, "customer-a", { productId: "product-variant", variantId: "variant-b", quantity: 1 });

  assert.equal(createdRows.length, 2);
  assert.deepEqual(createdRows.map((row) => row.variantId).sort(), ["variant-a", "variant-b"]);
});

test("variant quantity is capped by that variant's own stock, independent of the parent product", async () => {
  const transaction = {
    product: { findUnique: async () => variantProduct([activeVariant({ stockQuantity: 2 })]) },
    cartItem: { findMany: async () => [] },
  };
  const database = { $transaction: async (callback) => callback(transaction) };

  await assert.rejects(
    addUserCartItem(database, "customer-a", { productId: "product-variant", variantId: "variant-a", quantity: 3 }),
    (error) =>
      error instanceof CartRequestError &&
      error.code === "INSUFFICIENT_STOCK" &&
      error.requestedQuantity === 3 &&
      error.availableQuantity === 2
  );
});

test("an inactive or unavailable variant is rejected even if it has stock", async () => {
  const transaction = {
    product: { findUnique: async () => variantProduct([activeVariant({ isAvailable: false })]) },
    cartItem: { findMany: async () => [] },
  };
  const database = { $transaction: async (callback) => callback(transaction) };

  await assert.rejects(
    addUserCartItem(database, "customer-a", { productId: "product-variant", variantId: "variant-a", quantity: 1 }),
    (error) => error instanceof CartRequestError && error.code === "VARIANT_UNAVAILABLE"
  );
});

test("a simple product rejects a browser-submitted variantId", async () => {
  const transaction = {
    product: {
      findUnique: async () => ({
        id: "product-1", name: "Simple Product", price: 100, stockQuantity: 10, status: "ACTIVE", isAvailable: true, variants: [],
      }),
    },
    cartItem: { findMany: async () => [] },
  };
  const database = { $transaction: async (callback) => callback(transaction) };

  await assert.rejects(
    addUserCartItem(database, "customer-a", { productId: "product-1", variantId: "unexpected-variant", quantity: 1 }),
    (error) => error instanceof CartRequestError && error.statusCode === 400
  );
});

test("clearing a cart is scoped to one authenticated user", async () => {
  let capturedQuery;
  const database = {
    cartItem: {
      deleteMany: async (query) => {
        capturedQuery = query;
      },
    },
  };

  await clearUserCart(database, "customer-b");
  assert.deepEqual(capturedQuery, { where: { userId: "customer-b" } });
});
