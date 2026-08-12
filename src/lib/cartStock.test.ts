import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  canIncreaseCartProduct,
  getCartStockIssues,
  guardProductQuantity,
} from "./cartStock.ts";
import type { CartItem, Product } from "../types/product.ts";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const source = (relativePath: string) =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

function product(overrides = {}): Product {
  return {
    id: "product-1",
    name: "Dental Product",
    price: 100,
    stockQuantity: 1,
    status: "LOW_STOCK",
    available: true,
    ...overrides,
  } as unknown as Product;
}

test("stock one accepts quantity one and rejects quantity two", () => {
  assert.equal(guardProductQuantity(product(), 1).ok, true);
  assert.deepEqual(guardProductQuantity(product(), 2), {
    ok: false,
    code: "INSUFFICIENT_STOCK",
    productId: "product-1",
    productName: "Dental Product",
    requestedQuantity: 2,
    availableQuantity: 1,
  });
});

test("repeated option lines share the product's physical stock", () => {
  const itemProduct = product({ stockQuantity: 2 });
  const cart = [
    { product: itemProduct, quantity: 1, selectedOptions: "Blue" },
    { product: itemProduct, quantity: 1, selectedOptions: "Red" },
  ] as unknown as CartItem[];

  assert.equal(getCartStockIssues(cart).length, 0);
  assert.equal(canIncreaseCartProduct(cart, itemProduct), false);
});

test("stale and unavailable carts expose a blocking issue without removing items", () => {
  const staleCart = [{
    product: product({ stockQuantity: 1 }),
    quantity: 2,
  }] as unknown as CartItem[];
  const issue = getCartStockIssues(staleCart)[0];
  assert.equal(issue.code, "INSUFFICIENT_STOCK");
  assert.equal(issue.requestedQuantity, 2);
  assert.equal(staleCart[0].quantity, 2);

  const unavailable = guardProductQuantity(
    product({ status: "OUT_OF_STOCK", available: false, stockQuantity: 0 }),
    1
  );
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.ok ? null : unavailable.code, "PRODUCT_UNAVAILABLE");
});

test("all customer cart entry points use the shared guard", () => {
  const context = source("src/context/StoreContext.tsx");
  assert.match(context, /guardProductQuantity\(product, requestedTotal\)/);
  assert.match(context, /cartProductQuantity\(cartRef\.current, product\.id\)/);
  assert.match(context, /const nextItems = updater\(cartRef\.current\)/);

  for (const file of [
    "src/components/dental/ProductCard.tsx",
    "src/pages/product-detail.tsx",
    "src/pages/account-wishlist.tsx",
    "src/pages/account-supply-lists.tsx",
    "src/pages/account-supply-list-detail.tsx",
    "src/pages/account-product-requests.tsx",
    "src/pages/shipping-delivery.tsx",
  ]) {
    assert.match(source(file), /addToCart\(/, `${file} must use the guarded cart action`);
  }
});

test("product detail, cart, checkout, and authoritative order pricing enforce stock", () => {
  const detail = source("src/pages/product-detail.tsx");
  assert.match(detail, /getProductStockLimit\(product\)/);
  assert.match(detail, /max=\{maximumOrderQuantity\}/);

  const cart = source("src/pages/cart.tsx");
  assert.match(cart, /getCartStockIssues\(cart\)/);
  assert.match(cart, /disabled=\{disableIncrease\}/);
  assert.match(cart, /const hasStockIssues = stockIssues\.length > 0/);

  const checkout = source("src/pages/checkout.tsx");
  assert.match(checkout, /INSUFFICIENT_STOCK/);
  assert.match(checkout, /PRODUCT_UNAVAILABLE/);
  assert.match(checkout, /setLocation\("\/cart\?checkout=stock", \{ replace: true \}\)/);

  const orderController = source("server/src/controllers/order.controller.js");
  assert.match(orderController, /calculateAuthoritativePricing/);
  assert.match(orderController, /safeOrderErrorPayload/);
});

test("stock messages are localized in English and Arabic", () => {
  const en = JSON.parse(source("src/locales/en.json"));
  const ar = JSON.parse(source("src/locales/ar.json"));
  assert.equal(en.cart.maximumAlreadyInCart, "You already have the maximum available quantity in your cart.");
  assert.equal(en.cart.onlyCurrentlyAvailable, "Only {count} currently available.");
  assert.equal(ar.cart.onlyCurrentlyAvailable, "المتاح حاليًا {count} فقط.");
  assert.ok(ar.cart.availableQuantityChanged);
});
