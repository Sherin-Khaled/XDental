import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateStockAvailability,
  publicStockIssue,
} from "./stockAvailability.service.js";

function product(overrides = {}) {
  return {
    id: "product-1",
    name: "Dental Product",
    stockQuantity: 1,
    status: "ACTIVE",
    isAvailable: true,
    ...overrides,
  };
}

test("one available unit accepts one and rejects two with safe quantities", () => {
  assert.equal(evaluateStockAvailability(product(), 1), null);

  const issue = evaluateStockAvailability(product(), 2);
  assert.equal(issue.code, "INSUFFICIENT_STOCK");
  assert.equal(issue.requestedQuantity, 2);
  assert.equal(issue.availableQuantity, 1);
  assert.match(issue.message, /Only 1 unit\(s\)/);
});

test("unavailable, inactive, and zero-stock products fail closed", () => {
  for (const unavailableProduct of [
    product({ isAvailable: false }),
    product({ status: "INACTIVE" }),
    product({ stockQuantity: 0 }),
    null,
  ]) {
    const issue = evaluateStockAvailability(unavailableProduct, 1);
    assert.equal(issue.code, "PRODUCT_UNAVAILABLE");
    assert.equal(issue.availableQuantity, 0);
  }
});

test("the public stock issue omits internal status data", () => {
  const issue = publicStockIssue(evaluateStockAvailability(product(), 2));
  assert.deepEqual(issue, {
    code: "INSUFFICIENT_STOCK",
    requestedQuantity: 2,
    availableQuantity: 1,
    productId: "product-1",
    productName: "Dental Product",
  });
});
