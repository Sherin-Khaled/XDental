import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateCustomerBenefits,
  getBenefitLifecycle,
} from "./customerBenefit.service.js";

const now = new Date("2026-07-25T12:00:00.000Z");

function benefit(overrides = {}) {
  return {
    id: overrides.id ?? "benefit-1",
    userId: "customer-1",
    type: "FREE_SHIPPING",
    titleEn: "Benefit",
    titleAr: "ميزة",
    descriptionEn: null,
    descriptionAr: null,
    discountPercent: null,
    discountAmount: null,
    promoCode: null,
    minimumOrderAmount: null,
    startsAt: null,
    endsAt: null,
    isActive: true,
    pausedAt: null,
    revokedAt: null,
    revokedById: null,
    createdById: "admin-1",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function databaseFor(user) {
  return { user: { findUnique: async ({ where }) => (where.id === user.id ? user : null) } };
}

test("standard customers receive no VIP benefits", async () => {
  const result = await evaluateCustomerBenefits(
    databaseFor({ id: "customer-1", role: "CUSTOMER", customerTier: "STANDARD", isActive: true, customerBenefits: [benefit()] }),
    { userId: "customer-1", subtotalCents: 100_000, shippingCents: 5_000, now }
  );
  assert.equal(result.discountCents, 0);
  assert.equal(result.shippingCents, 5_000);
});

test("free shipping combines with the highest automatic monetary discount", async () => {
  const benefits = [
    benefit({ id: "ship", type: "FREE_SHIPPING" }),
    benefit({ id: "ten", type: "PERCENTAGE_DISCOUNT", discountPercent: 10 }),
    benefit({ id: "fixed", type: "FIXED_DISCOUNT", discountAmount: 150 }),
  ];
  const result = await evaluateCustomerBenefits(
    databaseFor({ id: "customer-1", role: "CUSTOMER", customerTier: "VIP", isActive: true, customerBenefits: benefits }),
    { userId: "customer-1", subtotalCents: 100_000, shippingCents: 5_000, now }
  );
  assert.equal(result.shippingCents, 0);
  assert.equal(result.discountCents, 15_000);
  assert.deepEqual(result.appliedBenefits.map(({ id }) => id), ["ship", "fixed"]);
});

test("minimum order, paused, revoked, future, and expired benefits do not apply", async () => {
  const benefits = [
    benefit({ id: "minimum", type: "FIXED_DISCOUNT", discountAmount: 100, minimumOrderAmount: 2000 }),
    benefit({ id: "paused", type: "PERCENTAGE_DISCOUNT", discountPercent: 90, isActive: false, pausedAt: now }),
    benefit({ id: "revoked", type: "FREE_SHIPPING", revokedAt: now }),
    benefit({ id: "future", type: "FREE_SHIPPING", startsAt: new Date("2026-08-01T00:00:00Z") }),
    benefit({ id: "expired", type: "FREE_SHIPPING", endsAt: new Date("2026-07-01T00:00:00Z") }),
  ];
  const result = await evaluateCustomerBenefits(
    databaseFor({ id: "customer-1", role: "CUSTOMER", customerTier: "VIP", isActive: true, customerBenefits: benefits }),
    { userId: "customer-1", subtotalCents: 100_000, shippingCents: 5_000, now }
  );
  assert.equal(result.discountCents, 0);
  assert.equal(result.shippingCents, 5_000);
  assert.equal(result.appliedBenefits.length, 0);
});

test("personal promo benefit only applies for the matching code", async () => {
  const user = {
    id: "customer-1",
    role: "CUSTOMER",
    customerTier: "VIP",
    isActive: true,
    customerBenefits: [benefit({ type: "PROMO_CODE", promoCode: "PERSONAL15", discountPercent: 15 })],
  };
  const rejected = await evaluateCustomerBenefits(databaseFor(user), {
    userId: user.id,
    subtotalCents: 100_000,
    shippingCents: 5_000,
    promoCode: "OTHER",
    now,
  });
  const accepted = await evaluateCustomerBenefits(databaseFor(user), {
    userId: user.id,
    subtotalCents: 100_000,
    shippingCents: 5_000,
    promoCode: "personal15",
    now,
  });
  assert.equal(rejected.discountCents, 0);
  assert.equal(accepted.discountCents, 15_000);
});

test("benefits are resolved for the authenticated user id only", async () => {
  const user = { id: "customer-1", role: "CUSTOMER", customerTier: "VIP", isActive: true, customerBenefits: [benefit()] };
  const result = await evaluateCustomerBenefits(databaseFor(user), {
    userId: "customer-2",
    subtotalCents: 100_000,
    shippingCents: 5_000,
    now,
  });
  assert.equal(result.shippingCents, 5_000);
  assert.equal(result.appliedBenefits.length, 0);
});

test("lifecycle reports active, paused, revoked, and expired states", () => {
  assert.equal(getBenefitLifecycle(benefit(), now), "ACTIVE");
  assert.equal(getBenefitLifecycle(benefit({ isActive: false, pausedAt: now }), now), "PAUSED");
  assert.equal(getBenefitLifecycle(benefit({ revokedAt: now }), now), "REVOKED");
  assert.equal(getBenefitLifecycle(benefit({ endsAt: new Date("2026-07-01") }), now), "EXPIRED");
});

