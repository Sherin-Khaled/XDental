import test from "node:test";
import assert from "node:assert/strict";
import {
  DeliveryOfferEligibilityError,
  evaluateDeliveryOfferPricing,
} from "./deliveryOffer.service.js";

const now = new Date("2026-07-28T12:00:00.000Z");

function offer(overrides = {}) {
  return {
    id: overrides.id ?? "offer-1",
    titleEn: overrides.titleEn ?? "Delivery offer",
    titleAr: overrides.titleAr ?? "Delivery offer AR",
    offerType: "DISCOUNTED_DELIVERY",
    recurrenceType: "WEEKLY",
    weekdays: [2],
    cutoffTime: null,
    specificDate: null,
    startDate: null,
    endDate: null,
    isActive: true,
    discountType: "PERCENTAGE",
    discountValue: 50,
    minimumOrderAmount: 0,
    appliesToStandard: true,
    appliesToFast: true,
    createdAt: now,
    ...overrides,
  };
}

function database(offers, { location = true } = {}) {
  return {
    userClinicLocation: {
      findFirst: async ({ where }) =>
        location && where.id === "location-1" && where.userId === "customer-1"
          ? { id: "location-1", deliveryZoneId: "zone-1", deliveryZone: { isActive: true } }
          : null,
    },
    deliveryOffer: { findMany: async () => offers },
  };
}

function evaluate(db, overrides = {}) {
  return evaluateDeliveryOfferPricing(db, {
    userId: "customer-1",
    clinicLocationId: "location-1",
    deliveryMethod: "standard",
    subtotalCents: 100_000,
    shippingCents: 5_000,
    now,
    ...overrides,
  });
}

test("Delivery Offer Free Delivery reduces eligible shipping to zero", async () => {
  const result = await evaluate(database([offer({ offerType: "FREE_DELIVERY", discountType: null, discountValue: null })]));
  assert.equal(result.shippingDiscountCents, 5_000);
  assert.equal(result.shippingCents, 0);
  assert.equal(result.freeShippingSources.length, 1);
});

test("percentage and fixed Delivery Offers discount shipping and cap at the fee", async () => {
  const percentage = await evaluate(database([offer()]));
  const fixed = await evaluate(database([offer({ discountType: "FIXED", discountValue: 20 })]));
  const capped = await evaluate(database([offer({ discountType: "FIXED", discountValue: 500 })]));

  assert.deepEqual(
    [percentage.shippingDiscountCents, fixed.shippingDiscountCents, capped.shippingDiscountCents],
    [2_500, 2_000, 5_000]
  );
  assert.equal(capped.shippingCents, 0);
});

test("Pickup receives no Delivery Offer shipping discount", async () => {
  const result = await evaluate(database([offer({ offerType: "FREE_DELIVERY" })]), {
    deliveryMethod: "pickup",
    shippingCents: 0,
  });
  assert.equal(result.shippingDiscountCents, 0);
  assert.equal(result.appliedOffer, null);
});

test("Delivery Offers enforce minimum subtotal and delivery-method applicability", async () => {
  const result = await evaluate(database([
    offer({ id: "minimum", minimumOrderAmount: 1_001 }),
    offer({ id: "fast-only", appliesToStandard: false, appliesToFast: true }),
  ]));
  assert.equal(result.shippingDiscountCents, 0);
});

test("saved clinic location ownership is required and another customer's location is rejected", async () => {
  await assert.rejects(
    evaluate(database([offer()]), { userId: "customer-2" }),
    (error) => error instanceof DeliveryOfferEligibilityError && error.code === "INVALID_CLINIC_LOCATION"
  );
});

test("manual addresses without a verified saved location receive no zone offer", async () => {
  const result = await evaluateDeliveryOfferPricing(database([offer()]), {
    userId: "customer-1",
    clinicLocationId: null,
    deliveryMethod: "standard",
    subtotalCents: 100_000,
    shippingCents: 5_000,
    now,
  });
  assert.equal(result.shippingCents, 5_000);
  assert.equal(result.appliedOffer, null);
});

test("multiple Delivery Offers choose lowest final shipping with deterministic ties", async () => {
  const result = await evaluate(database([
    offer({ id: "older-half", discountValue: 50, createdAt: new Date("2026-07-27T12:00:00Z") }),
    offer({ id: "newer-half", discountValue: 50, createdAt: new Date("2026-07-28T12:00:00Z") }),
    offer({ id: "weak", discountValue: 10 }),
  ]));
  assert.equal(result.shippingCents, 2_500);
  assert.equal(result.appliedOffer.sourceId, "newer-half");

  const freeWinsTie = await evaluate(database([
    offer({ id: "fixed-all", discountType: "FIXED", discountValue: 50 }),
    offer({ id: "free", offerType: "FREE_DELIVERY", discountType: null, discountValue: null }),
  ]));
  assert.equal(freeWinsTie.appliedOffer.sourceId, "free");
});
