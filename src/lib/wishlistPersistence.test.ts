import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("authenticated Wishlist loads and mutates through the authoritative API", async () => {
  const [store, service] = await Promise.all([
    source("../context/StoreContext.tsx"),
    source("../services/wishlist.ts"),
  ]);
  assert.match(service, /apiRequest<WishlistResponse>\("\/wishlist"/);
  assert.match(service, /"\/wishlist\/items"/);
  assert.match(service, /method: "DELETE"/);
  assert.match(service, /"\/wishlist\/merge"/);
  assert.match(store, /loadAuthenticatedWishlist/);
  assert.match(store, /fetchMyWishlist/);
  assert.match(store, /mergeMyWishlist\(guestProductIds\)/);
  assert.match(store, /enqueueWishlistMutation/);
  assert.match(store, /addMyWishlistItem\(productId\)/);
  assert.match(store, /removeMyWishlistItem\(productId\)/);
  assert.match(store, /clearMyWishlist/);
});

test("guest Wishlist remains memory-only while authenticated mutations are persisted", async () => {
  const store = await source("../context/StoreContext.tsx");
  assert.match(store, /const initialWishlistIds: string\[\] = \[\]/);
  assert.doesNotMatch(store, /localStorage\.(setItem|getItem).*wishlist/);
  assert.match(store, /currentUserRef\.current\?\.role\.toLowerCase\(\) === "customer"/);
  assert.match(store, /const guestWishlistIds = wishlistRef\.current/);
});

test("Wishlist schema enforces account/product uniqueness and cascade safety", async () => {
  const [schema, migration, routes] = await Promise.all([
    source("../../server/prisma/schema.prisma"),
    source("../../server/prisma/migrations/20260813193000_add_persistent_wishlist/migration.sql"),
    source("../../server/src/routes/wishlist.routes.js"),
  ]);
  assert.match(schema, /model WishlistItem[\s\S]*@@unique\(\[userId, productId\]\)/);
  assert.match(schema, /model WishlistItem[\s\S]*product\s+Product\s+@relation\([^\n]*onDelete: Cascade/);
  assert.match(migration, /wishlist_items_userId_productId_key/);
  assert.match(migration, /REFERENCES "Product"\("id"\) ON DELETE CASCADE/);
  assert.match(routes, /router\.use\(requireAuthServiceReady, requireAuth\)/);
});
