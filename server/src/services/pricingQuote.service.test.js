import test from "node:test";
import assert from "node:assert/strict";
import {
  createPricingInputFingerprint,
  createPricingQuoteToken,
  PricingQuoteError,
  PRICING_QUOTE_TTL_MS,
  requiresPriceReview,
  verifyPricingQuoteToken,
} from "./pricingQuote.service.js";

const secret = "phase-4-test-secret-that-is-longer-than-thirty-two-characters";
const now = new Date("2026-07-31T12:00:00.000Z");

function input(overrides = {}) {
  return {
    itemReferences: [{ productId: "product-1", sku: "SKU-1", quantity: 2 }],
    deliveryMethod: "standard",
    promoCode: " save10 ",
    clinicLocationId: "location-1",
    ...overrides,
  };
}

test("pricing input fingerprints are stable across item order and code casing", () => {
  const left = createPricingInputFingerprint(input({
    itemReferences: [
      { productId: "product-2", quantity: 1 },
      { productId: "product-1", sku: "SKU-1", quantity: 2 },
    ],
  }));
  const right = createPricingInputFingerprint(input({
    promoCode: "SAVE10",
    itemReferences: [
      { sku: "sku-1", productId: "product-1", quantity: 2 },
      { productId: "product-2", quantity: 1 },
    ],
  }));
  assert.equal(left, right);
});

test("the pricing fingerprint changes when only the selected variant changes", () => {
  const base = createPricingInputFingerprint(input({
    itemReferences: [{ productId: "product-1", variantId: "variant-a", quantity: 1 }],
  }));
  const otherVariant = createPricingInputFingerprint(input({
    itemReferences: [{ productId: "product-1", variantId: "variant-b", quantity: 1 }],
  }));
  const noVariant = createPricingInputFingerprint(input({
    itemReferences: [{ productId: "product-1", quantity: 1 }],
  }));
  assert.notEqual(base, otherVariant, "a quote issued for one variant must not verify a request for a different variant");
  assert.notEqual(base, noVariant);
});

test("a signed pricing quote verifies for the same user and pricing inputs", () => {
  const inputFingerprint = createPricingInputFingerprint(input());
  const token = createPricingQuoteToken({
    userId: "customer-1",
    inputFingerprint,
    reviewedTotalCents: 123_456,
    now,
    secret,
  });
  const payload = verifyPricingQuoteToken(token, {
    userId: "customer-1",
    inputFingerprint,
    now,
    secret,
  });
  assert.equal(payload.total, 123_456);
  assert.equal(Buffer.from(token.split(".")[0], "base64url").toString("utf8").includes("customer-1"), false);
});

test("tampered, cross-user, changed-input, and expired quotes are rejected", () => {
  const inputFingerprint = createPricingInputFingerprint(input());
  const token = createPricingQuoteToken({
    userId: "customer-1",
    inputFingerprint,
    reviewedTotalCents: 105_000,
    now,
    secret,
  });
  const cases = [
    () => verifyPricingQuoteToken(`${token.slice(0, -1)}x`, { userId: "customer-1", inputFingerprint, now, secret }),
    () => verifyPricingQuoteToken(token, { userId: "customer-2", inputFingerprint, now, secret }),
    () => verifyPricingQuoteToken(token, { userId: "customer-1", inputFingerprint: "changed", now, secret }),
    () => verifyPricingQuoteToken(token, {
      userId: "customer-1",
      inputFingerprint,
      now: new Date(now.getTime() + PRICING_QUOTE_TTL_MS),
      secret,
    }),
  ];
  for (const action of cases) {
    assert.throws(action, PricingQuoteError);
  }
});

test("missing or short signing secrets fail closed", () => {
  assert.throws(
    () => createPricingQuoteToken({
      userId: "customer-1",
      inputFingerprint: "fingerprint",
      reviewedTotalCents: 1,
      now,
      secret: "short",
    }),
    (error) => error instanceof PricingQuoteError && error.code === "PRICING_QUOTE_UNAVAILABLE"
  );
});

test("only a higher current total requires a second customer confirmation", () => {
  assert.equal(requiresPriceReview(105_001, 105_000), true);
  assert.equal(requiresPriceReview(105_000, 105_000), false);
  assert.equal(requiresPriceReview(104_999, 105_000), false);
});
