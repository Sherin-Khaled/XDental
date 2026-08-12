import test from "node:test";
import assert from "node:assert/strict";
import { isDeliveryOfferValidNow } from "./deliveryOffer.service.js";
import { isScheduledPromotionValidNow } from "./scheduledPromotion.service.js";

const weeklyPromotion = {
  isActive: true,
  status: "ACTIVE",
  timezone: "Africa/Cairo",
  scheduleType: "WEEKLY_RECURRING",
  weekdays: [2],
  startTime: "12:00",
  endTime: "14:00",
};

test("Scheduled Promotion time windows use Africa/Cairo start-inclusive and end-exclusive boundaries", () => {
  assert.equal(isScheduledPromotionValidNow(weeklyPromotion, new Date("2026-07-28T08:59:00.000Z")), false);
  assert.equal(isScheduledPromotionValidNow(weeklyPromotion, new Date("2026-07-28T09:00:00.000Z")), true);
  assert.equal(isScheduledPromotionValidNow(weeklyPromotion, new Date("2026-07-28T10:59:00.000Z")), true);
  assert.equal(isScheduledPromotionValidNow(weeklyPromotion, new Date("2026-07-28T11:00:00.000Z")), false);
});

test("Delivery Offer cutoff is evaluated in Africa/Cairo and stops exactly at cutoff", () => {
  const offer = {
    isActive: true,
    recurrenceType: "WEEKLY",
    weekdays: [2],
    cutoffTime: "14:00",
  };
  assert.equal(isDeliveryOfferValidNow(offer, new Date("2026-07-28T10:59:00.000Z")), true);
  assert.equal(isDeliveryOfferValidNow(offer, new Date("2026-07-28T11:00:00.000Z")), false);
});
