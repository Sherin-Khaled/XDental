import test from "node:test";
import assert from "node:assert/strict";
import {
  COUPON_ENGINE_MARKER,
  evaluatePublicCoupon,
  normalizeCouponCode,
} from "./coupon.service.js";

const now = new Date("2026-07-28T12:00:00.000Z");

function coupon(overrides = {}) {
  return {
    id: "coupon-1",
    couponCode: "SAVE10",
    promotionType: "COUPON",
    discountPercent: 10,
    discountAmount: null,
    minimumOrderAmount: 500,
    scheduleType: "ALWAYS_ACTIVE",
    weekdays: [],
    startAt: null,
    endAt: null,
    startTime: null,
    endTime: null,
    timezone: "Africa/Cairo",
    isActive: true,
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function databaseFor(records) {
  return { scheduledPromotion: { findMany: async () => records } };
}

test("normalizes coupon codes consistently", () => {
  assert.equal(normalizeCouponCode(" save-10 "), "SAVE-10");
});

test("applies a valid percentage coupon to the authoritative subtotal", async () => {
  const result = await evaluatePublicCoupon(databaseFor([coupon()]), {
    promoCode: "save10",
    subtotalCents: 100_000,
    shippingCents: 5_000,
    now,
  });
  assert.equal(result.status, "valid");
  assert.equal(result.discountCents, 10_000);
  assert.equal(result.shippingCents, 5_000);
});

test("applies fixed and free-shipping coupons safely", async () => {
  const fixed = await evaluatePublicCoupon(databaseFor([
    coupon({ discountPercent: null, discountAmount: 150, minimumOrderAmount: 0 }),
  ]), {
    promoCode: "SAVE10",
    subtotalCents: 10_000,
    shippingCents: 5_000,
    now,
  });
  const shipping = await evaluatePublicCoupon(databaseFor([
    coupon({ promotionType: "FREE_DELIVERY", discountPercent: null }),
  ]), {
    promoCode: "SAVE10",
    subtotalCents: 100_000,
    shippingCents: 8_000,
    now,
  });
  assert.equal(fixed.discountCents, 10_000);
  assert.equal(shipping.discountCents, 0);
  assert.equal(shipping.shippingCents, 0);
});

test("rejects minimum-order and unavailable coupons", async () => {
  const minimum = await evaluatePublicCoupon(databaseFor([coupon()]), {
    promoCode: "SAVE10",
    subtotalCents: 40_000,
    shippingCents: 5_000,
    now,
  });
  const unavailable = await evaluatePublicCoupon(databaseFor([]), {
    promoCode: "MISSING",
    subtotalCents: 100_000,
    shippingCents: 5_000,
    now,
  });
  assert.equal(minimum.status, "invalid");
  assert.equal(minimum.reason, "minimum");
  assert.equal(unavailable.status, "invalid");
});

test("ordinary Scheduled Coupon and Coupons-page marker records both redeem case-insensitively", async () => {
  for (const targetUrl of [null, COUPON_ENGINE_MARKER]) {
    const result = await evaluatePublicCoupon(databaseFor([coupon({ targetUrl })]), {
      promoCode: "  sAvE10  ",
      subtotalCents: 100_000,
      shippingCents: 5_000,
      now,
    });
    assert.equal(result.status, "valid");
    assert.equal(result.sourceType, "COUPON");
  }
});

test("duplicate eligible coupon ambiguity fails safely", async () => {
  const result = await evaluatePublicCoupon(databaseFor([
    coupon({ id: "coupon-a" }),
    coupon({ id: "coupon-b" }),
  ]), {
    promoCode: "SAVE10",
    subtotalCents: 100_000,
    shippingCents: 5_000,
    now,
  });

  assert.equal(result.status, "invalid");
  assert.equal(result.reason, "ambiguous");
});
