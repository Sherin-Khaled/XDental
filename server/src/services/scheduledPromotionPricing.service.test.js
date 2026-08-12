import test from "node:test";
import assert from "node:assert/strict";
import { getEligibleScheduledPromotionPricing } from "./scheduledPromotion.service.js";

const now = new Date("2026-07-28T12:00:00.000Z");

function promotion(overrides = {}) {
  return {
    id: overrides.id ?? "promotion-1",
    titleEn: overrides.titleEn ?? "Promotion",
    titleAr: overrides.titleAr ?? "Promotion AR",
    promotionType: "PERCENTAGE_DISCOUNT",
    discountPercent: 10,
    discountAmount: null,
    minimumOrderAmount: 0,
    targetUrl: null,
    scheduleType: "ALWAYS_ACTIVE",
    weekdays: [],
    startAt: null,
    endAt: null,
    startTime: null,
    endTime: null,
    timezone: "Africa/Cairo",
    isActive: true,
    status: "ACTIVE",
    priority: 0,
    createdAt: now,
    ...overrides,
  };
}

function database(records) {
  return { scheduledPromotion: { findMany: async () => records } };
}

test("active Scheduled Percentage applies automatically after minimum-subtotal eligibility", async () => {
  const eligible = await getEligibleScheduledPromotionPricing(
    database([promotion({ minimumOrderAmount: 500 })]),
    { subtotalCents: 80_000, now }
  );
  const belowMinimum = await getEligibleScheduledPromotionPricing(
    database([promotion({ minimumOrderAmount: 500 })]),
    { subtotalCents: 49_999, now }
  );

  assert.equal(eligible.monetaryCandidates[0].discountCents, 8_000);
  assert.equal(belowMinimum.monetaryCandidates.length, 0);
});

test("Scheduled Fixed discounts apply automatically and cap at the eligible subtotal", async () => {
  const result = await getEligibleScheduledPromotionPricing(
    database([promotion({
      promotionType: "FIXED_DISCOUNT",
      discountPercent: null,
      discountAmount: 1_500,
    })]),
    { subtotalCents: 100_000, now }
  );

  assert.equal(result.monetaryCandidates[0].discountCents, 100_000);
});

test("future, expired, paused, draft, archived, inactive, informational, and custom rows do not affect totals", async () => {
  const records = [
    promotion({ id: "future", scheduleType: "DATE_RANGE", startAt: new Date("2026-08-01"), endAt: new Date("2026-08-02"), startTime: "00:00", endTime: "23:59" }),
    promotion({ id: "expired", scheduleType: "DATE_RANGE", startAt: new Date("2026-07-01"), endAt: new Date("2026-07-02"), startTime: "00:00", endTime: "23:59" }),
    promotion({ id: "paused", status: "PAUSED" }),
    promotion({ id: "draft", status: "DRAFT" }),
    promotion({ id: "archived", status: "ARCHIVED" }),
    promotion({ id: "inactive", isActive: false }),
    promotion({ id: "informational", promotionType: "INFORMATIONAL" }),
    promotion({ id: "custom", promotionType: "CUSTOM" }),
    promotion({ id: "coupon", promotionType: "COUPON", couponCode: "ENTER-ME" }),
  ];

  const result = await getEligibleScheduledPromotionPricing(database(records), {
    subtotalCents: 100_000,
    now,
  });

  assert.equal(result.monetaryCandidates.length, 0);
  assert.equal(result.freeShippingSources.length, 0);
});

test("Scheduled Free Delivery is an automatic free-shipping candidate", async () => {
  const result = await getEligibleScheduledPromotionPricing(
    database([promotion({ promotionType: "FREE_DELIVERY", discountPercent: null })]),
    { subtotalCents: 100_000, now }
  );

  assert.equal(result.monetaryCandidates.length, 0);
  assert.equal(result.freeShippingSources[0].sourceType, "SCHEDULED_PROMOTION");
});
