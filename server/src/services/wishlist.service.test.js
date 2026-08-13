import assert from "node:assert/strict";
import test from "node:test";
import {
  WishlistRequestError,
  addUserWishlistItem,
  getUserWishlist,
  mergeUserWishlist,
  removeUserWishlistItem,
} from "./wishlist.service.js";

test("wishlist list is customer-scoped and hides products invalidated from the public catalog", async () => {
  let query;
  const database = { wishlistItem: { findMany: async (value) => { query = value; return [{ productId: "product-1" }]; } } };
  assert.deepEqual(await getUserWishlist(database, "customer-a"), ["product-1"]);
  assert.equal(query.where.userId, "customer-a");
  assert.deepEqual(query.where.product.status.in, ["ACTIVE", "LOW_STOCK", "OUT_OF_STOCK"]);
  assert.deepEqual(query.where.product.price, { not: null });
});

test("add validates the server product, scopes ownership, and is idempotent", async () => {
  let created;
  const transaction = {
    product: { findFirst: async () => ({ id: "product-1" }) },
    wishlistItem: {
      findUnique: async () => null,
      count: async () => 0,
      upsert: async ({ create }) => { created = create; },
    },
  };
  await addUserWishlistItem({ $transaction: (callback) => callback(transaction) }, "customer-a", { productId: "product-1", userId: "customer-b" });
  assert.deepEqual(created, { userId: "customer-a", productId: "product-1" });

  let duplicateCreate = false;
  transaction.wishlistItem.findUnique = async () => ({ id: "existing" });
  transaction.wishlistItem.upsert = async () => { duplicateCreate = true; };
  await addUserWishlistItem({ $transaction: (callback) => callback(transaction) }, "customer-a", { productId: "product-1" });
  assert.equal(duplicateCreate, false);
});

test("add rejects unknown, draft, or otherwise non-public products", async () => {
  const transaction = { product: { findFirst: async () => null } };
  await assert.rejects(
    addUserWishlistItem({ $transaction: (callback) => callback(transaction) }, "customer-a", { productId: "draft-product" }),
    (error) => error instanceof WishlistRequestError && error.statusCode === 404
  );
});

test("remove can only target the authenticated customer's row", async () => {
  let where;
  const database = { wishlistItem: { deleteMany: async (query) => { where = query.where; } } };
  await removeUserWishlistItem(database, "customer-a", "product-1");
  assert.deepEqual(where, { userId: "customer-a", productId: "product-1" });
});

test("guest merge de-duplicates inputs, ignores invalidated products, and preserves existing rows", async () => {
  let created;
  const transaction = {
    product: { findMany: async () => [{ id: "product-1" }] },
    wishlistItem: {
      findMany: async () => [{ productId: "product-2" }],
      createMany: async (query) => { created = query; },
    },
  };
  await mergeUserWishlist(
    { $transaction: (callback) => callback(transaction) },
    "customer-a",
    ["product-1", "product-1", "invalidated-product"]
  );
  assert.deepEqual(created.data, [{ userId: "customer-a", productId: "product-1" }]);
  assert.equal(created.skipDuplicates, true);
});
