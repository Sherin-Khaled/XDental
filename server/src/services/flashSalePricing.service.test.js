import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveEffectiveProductPrices,
  selectBestValidFlashSale,
} from "./flashSalePricing.service.js";
import { evaluateCustomerBenefits } from "./customerBenefit.service.js";

const now = new Date("2026-07-28T12:00:00.000Z");
const product = { id: "product-1", price: 1_000 };

function sale(overrides = {}) {
  return {
    id: overrides.id ?? "sale-1",
    productId: product.id,
    salePrice: 800,
    startsAt: new Date("2026-07-28T00:00:00.000Z"),
    endsAt: new Date("2026-07-29T00:00:00.000Z"),
    isActive: true,
    ...overrides,
  };
}

test("selects the lowest currently valid Flash Sale for a product", () => {
  const selected = selectBestValidFlashSale(product, [
    sale({ id: "higher", salePrice: 850 }),
    sale({ id: "lowest", salePrice: 700 }),
    sale({ id: "inactive", salePrice: 500, isActive: false }),
  ], now);

  assert.equal(selected?.id, "lowest");
});

test("equal Flash Sale prices resolve deterministically by end time then stable id", () => {
  const selected = selectBestValidFlashSale(product, [
    sale({ id: "z-sale", salePrice: 700, endsAt: new Date("2026-07-30T00:00:00.000Z") }),
    sale({ id: "b-sale", salePrice: 700, endsAt: new Date("2026-07-29T00:00:00.000Z") }),
    sale({ id: "a-sale", salePrice: 700, endsAt: new Date("2026-07-29T00:00:00.000Z") }),
  ], now);
  assert.equal(selected?.id, "a-sale");
});

test("ignores scheduled, expired, inactive, and non-discount prices", () => {
  const selected = selectBestValidFlashSale(product, [
    sale({ startsAt: new Date("2026-07-29T00:00:00.000Z") }),
    sale({ endsAt: new Date("2026-07-28T12:00:00.000Z") }),
    sale({ isActive: false }),
    sale({ salePrice: 1_000 }),
    sale({ salePrice: 1_200 }),
    sale({ salePrice: 0 }),
  ], now);

  assert.equal(selected, null);
});

test("resolves sale and original prices from server data only", async () => {
  const database = {
    flashSale: { findMany: async () => [sale({ salePrice: 750 })] },
  };

  const prices = await resolveEffectiveProductPrices(database, [product], { now });
  assert.deepEqual(prices.get(product.id), {
    basePrice: 1_000,
    salePrice: null,
    effectivePrice: 750,
    price: 750,
    originalPrice: 1_000,
    flashSale: sale({ salePrice: 750 }),
  });
});

test("falls back to the catalog price when no valid sale exists", async () => {
  const database = {
    flashSale: { findMany: async () => [sale({ salePrice: 1_100 })] },
  };

  const prices = await resolveEffectiveProductPrices(database, [product], { now });
  assert.deepEqual(prices.get(product.id), {
    basePrice: 1_000,
    salePrice: null,
    effectivePrice: 1_000,
    price: 1_000,
    originalPrice: null,
    flashSale: null,
  });
});

test("uses a valid product sale price when no Flash Sale is active", async () => {
  const database = { flashSale: { findMany: async () => [] } };
  const discounted = { ...product, salePrice: 780 };
  const prices = await resolveEffectiveProductPrices(database, [discounted], { now });
  assert.deepEqual(prices.get(product.id), {
    basePrice: 1_000,
    salePrice: 780,
    effectivePrice: 780,
    price: 780,
    originalPrice: 1_000,
    flashSale: null,
  });
});

test("ignores product sale prices equal to or above the base price", async () => {
  const database = { flashSale: { findMany: async () => [] } };
  for (const salePrice of [1_000, 1_200]) {
    const prices = await resolveEffectiveProductPrices(database, [{ ...product, salePrice }], { now });
    assert.equal(prices.get(product.id).price, 1_000);
    assert.equal(prices.get(product.id).salePrice, null);
    assert.equal(prices.get(product.id).originalPrice, null);
  }
});

test("an active Flash Sale retains precedence over a product sale price", async () => {
  const flash = sale({ salePrice: 850 });
  const database = { flashSale: { findMany: async () => [flash] } };
  const prices = await resolveEffectiveProductPrices(database, [{ ...product, salePrice: 700 }], { now });
  assert.equal(prices.get(product.id).price, 850);
  assert.equal(prices.get(product.id).salePrice, 700);
  assert.equal(prices.get(product.id).flashSale.id, flash.id);
});

test("VIP benefits stack after the Flash Sale subtotal is resolved", async () => {
  const database = {
    flashSale: { findMany: async () => [sale({ salePrice: 800 })] },
    user: {
      findUnique: async () => ({
        id: "customer-1",
        role: "CUSTOMER",
        customerTier: "VIP",
        isActive: true,
        customerBenefits: [{
          id: "vip-10",
          userId: "customer-1",
          type: "PERCENTAGE_DISCOUNT",
          titleEn: "VIP 10%",
          titleAr: "VIP 10%",
          descriptionEn: null,
          descriptionAr: null,
          discountPercent: 10,
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
        }],
      }),
    },
  };

  const prices = await resolveEffectiveProductPrices(database, [product], { now });
  const subtotalCents = Math.round(prices.get(product.id).price * 100);
  const benefits = await evaluateCustomerBenefits(database, {
    userId: "customer-1",
    subtotalCents,
    shippingCents: 5_000,
    now,
  });

  assert.equal(subtotalCents, 80_000);
  assert.equal(benefits.discountCents, 8_000);
});
