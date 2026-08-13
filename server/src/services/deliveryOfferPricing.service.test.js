import test from "node:test";
import assert from "node:assert/strict";
import {
  DeliveryOfferEligibilityError,
  evaluateDeliveryOfferPricing,
  isDeliveryOfferValidNow,
} from "./deliveryOffer.service.js";
import {
  LAUNCH_DELIVERY_ZONES,
  LAUNCH_FREE_DELIVERY_OFFERS,
  buildLaunchDeliverySeedTables,
} from "../config/launchBusinessRules.js";

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

test("launch free-delivery configuration matches Saturday-Wednesday areas and excludes Thursday-Friday", () => {
  const expectedByWeekday = new Map([
    [6, ["shubra", "zeitoun", "hadayek-el-qobba", "abbassia", "shubra-masr", "ain-shams", "heliopolis", "dokki", "manial", "mohandessin"]],
    [0, ["heliopolis", "first-settlement", "fifth-settlement", "dokki", "manial", "mohandessin"]],
    [1, ["nasr-city", "heliopolis", "dokki", "manial", "mohandessin"]],
    [2, ["first-settlement", "fifth-settlement", "dokki", "manial", "mohandessin"]],
    [3, ["sheikh-zayed", "6th-of-october", "dokki", "manial", "mohandessin"]],
  ]);
  const datesByWeekday = new Map([
    [6, new Date("2026-08-15T12:00:00Z")],
    [0, new Date("2026-08-16T12:00:00Z")],
    [1, new Date("2026-08-17T12:00:00Z")],
    [2, new Date("2026-08-18T12:00:00Z")],
    [3, new Date("2026-08-19T12:00:00Z")],
    [4, new Date("2026-08-20T12:00:00Z")],
    [5, new Date("2026-08-21T12:00:00Z")],
  ]);

  assert.equal(new Set(LAUNCH_DELIVERY_ZONES.map((zone) => zone.slug)).size, LAUNCH_DELIVERY_ZONES.length);
  const seedTables = buildLaunchDeliverySeedTables();
  assert.equal(seedTables.deliveryOffers.length, 5);
  assert.equal(seedTables.deliveryOfferZones.length, 31);
  for (const [weekday, expectedSlugs] of expectedByWeekday) {
    const matching = LAUNCH_FREE_DELIVERY_OFFERS.filter((configuredOffer) =>
      isDeliveryOfferValidNow(configuredOffer, datesByWeekday.get(weekday))
    );
    assert.equal(matching.length, 1);
    assert.deepEqual(matching[0].zoneSlugs, expectedSlugs);
    assert.equal(matching[0].offerType, "FREE_DELIVERY");
    assert.equal(matching[0].appliesToStandard, true);
    assert.equal(matching[0].appliesToFast, true);
  }
  for (const weekday of [4, 5]) {
    assert.equal(
      LAUNCH_FREE_DELIVERY_OFFERS.some((configuredOffer) =>
        isDeliveryOfferValidNow(configuredOffer, datesByWeekday.get(weekday))
      ),
      false
    );
  }
});
