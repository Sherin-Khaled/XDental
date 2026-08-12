import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateAuthoritativePricing,
  evaluateVipTierShipping,
  OrderPricingError,
  serializePricingTotals,
} from "./orderPricing.service.js";

const now = new Date("2026-07-28T12:00:00.000Z");

function product(overrides = {}) {
  return {
    id: "product-1",
    externalProductId: null,
    sku: "SKU-1",
    slug: "product-1",
    name: "Dental Product",
    price: 1_000,
    status: "ACTIVE",
    isAvailable: true,
    stockQuantity: 100,
    ...overrides,
  };
}

function promotion(overrides = {}) {
  return {
    id: overrides.id ?? "promotion-1",
    titleEn: overrides.titleEn ?? "Promotion",
    titleAr: overrides.titleAr ?? "عرض",
    promotionType: "PERCENTAGE_DISCOUNT",
    discountPercent: 10,
    discountAmount: null,
    couponCode: null,
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
    updatedAt: now,
    ...overrides,
  };
}

function benefit(overrides = {}) {
  return {
    id: overrides.id ?? "benefit-1",
    userId: "customer-1",
    type: "PERCENTAGE_DISCOUNT",
    titleEn: "VIP benefit",
    titleAr: "ميزة VIP",
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
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function database({
  catalogProduct = product(),
  flashSales = [],
  promotions = [],
  coupons = [],
  benefits = [],
  tier = "STANDARD",
  location = null,
  deliveryOffers = [],
} = {}) {
  return {
    product: { findMany: async () => [catalogProduct] },
    flashSale: { findMany: async () => flashSales },
    scheduledPromotion: {
      findMany: async ({ where }) => where.couponCode ? coupons : promotions,
    },
    user: {
      findUnique: async ({ where }) => where.id === "customer-1"
        ? {
            id: "customer-1",
            role: "CUSTOMER",
            customerTier: tier,
            isActive: true,
            customerBenefits: benefits,
          }
        : null,
    },
    userClinicLocation: { findFirst: async () => location },
    deliveryOffer: { findMany: async () => deliveryOffers },
  };
}

function calculate(db, overrides = {}) {
  return calculateAuthoritativePricing(db, {
    userId: "customer-1",
    itemReferences: [{ productId: "product-1", quantity: 1 }],
    deliveryMethod: "standard",
    promoCode: "",
    clinicLocationId: null,
    now,
    ...overrides,
  });
}

test("catalog pricing is authoritative when no promotion is eligible", async () => {
  const pricing = await calculate(database());
  assert.equal(pricing.subtotalCents, 100_000);
  assert.equal(pricing.shippingCents, 5_000);
  assert.equal(pricing.totalCents, 105_000);
  assert.equal(pricing.totalDiscountCents, 0);
});

test("a valid product sale price is authoritative for cart and checkout totals", async () => {
  const pricing = await calculate(database({ catalogProduct: product({ salePrice: 750 }) }));
  assert.equal(pricing.originalSubtotalCents, 100_000);
  assert.equal(pricing.subtotalCents, 75_000);
  assert.equal(pricing.items[0].unitPriceCents, 75_000);
  assert.equal(pricing.items[0].originalUnitPriceCents, 100_000);
  assert.equal(pricing.items[0].promotionDiscountCents, 25_000);
  assert.equal(pricing.items[0].promotionSourceType, "CATALOG_SALE_PRICE");
});

test("authoritative pricing accepts available stock and rejects an over-stock request", async () => {
  const db = database({ catalogProduct: product({ stockQuantity: 1 }) });
  const accepted = await calculate(db, {
    itemReferences: [{ productId: "product-1", quantity: 1 }],
  });
  assert.equal(accepted.items[0].quantity, 1);

  await assert.rejects(
    calculate(db, {
      itemReferences: [{ productId: "product-1", quantity: 2 }],
    }),
    (error) =>
      error instanceof OrderPricingError &&
      error.code === "INSUFFICIENT_STOCK" &&
      error.requestedQuantity === 2 &&
      error.availableQuantity === 1
  );
});

test("Flash Sale applies before an automatic Scheduled Promotion", async () => {
  const flashSale = {
    id: "flash-1",
    productId: "product-1",
    salePrice: 800,
    startsAt: new Date("2026-07-28T00:00:00.000Z"),
    endsAt: new Date("2026-07-29T00:00:00.000Z"),
    isActive: true,
  };
  const pricing = await calculate(database({
    flashSales: [flashSale],
    promotions: [promotion()],
  }));
  assert.equal(pricing.originalSubtotalCents, 100_000);
  assert.equal(pricing.subtotalCents, 80_000);
  assert.equal(pricing.productPromotionSavingsCents, 20_000);
  assert.equal(pricing.scheduledPromotionDiscountCents, 8_000);
  assert.equal(pricing.totalCents, 77_000);
  assert.equal(pricing.items[0].promotionSourceId, "flash-1");
});

test("Coupon wins an equal monetary tie over VIP and Scheduled Promotion", async () => {
  const coupon = promotion({
    id: "coupon-1",
    titleEn: "SAVE10",
    promotionType: "COUPON",
    couponCode: "SAVE10",
  });
  const pricing = await calculate(database({
    promotions: [promotion({ id: "scheduled-1" })],
    coupons: [coupon],
    benefits: [benefit()],
    tier: "VIP",
  }), { promoCode: "save10" });
  assert.equal(pricing.winningMonetaryDiscount.sourceType, "COUPON");
  assert.equal(pricing.couponDiscountCents, 10_000);
  assert.equal(pricing.vipDiscountCents, 0);
  assert.equal(pricing.scheduledPromotionDiscountCents, 0);
});

test("the highest monetary candidate wins even when it has lower source precedence", async () => {
  const pricing = await calculate(database({
    promotions: [promotion({ discountPercent: 30 })],
    coupons: [promotion({
      id: "coupon-10",
      promotionType: "COUPON",
      couponCode: "SAVE10",
      discountPercent: 10,
    })],
    benefits: [benefit({ discountPercent: 20 })],
    tier: "VIP",
  }), { promoCode: "SAVE10" });

  assert.equal(pricing.winningMonetaryDiscount.sourceType, "SCHEDULED_PROMOTION");
  assert.equal(pricing.monetaryDiscountCents, 30_000);
});

test("VIP wins an exact monetary tie over Scheduled Promotion without a tying coupon", async () => {
  const pricing = await calculate(database({
    promotions: [promotion()],
    benefits: [benefit()],
    tier: "VIP",
  }));

  assert.equal(pricing.winningMonetaryDiscount.sourceType, "VIP_BENEFIT");
  assert.equal(pricing.vipDiscountCents, 10_000);
});

test("Scheduled Promotion ties resolve by priority, newest creation time, then stable id", async () => {
  const highPriority = await calculate(database({
    promotions: [
      promotion({ id: "low", priority: 1 }),
      promotion({ id: "high", priority: 2, createdAt: new Date("2026-07-01T00:00:00Z") }),
    ],
  }));
  assert.equal(highPriority.winningMonetaryDiscount.sourceId, "high");

  const newest = await calculate(database({
    promotions: [
      promotion({ id: "older", createdAt: new Date("2026-07-01T00:00:00Z") }),
      promotion({ id: "newer", createdAt: new Date("2026-07-02T00:00:00Z") }),
    ],
  }));
  assert.equal(newest.winningMonetaryDiscount.sourceId, "newer");

  const stableId = await calculate(database({
    promotions: [promotion({ id: "b" }), promotion({ id: "a" })],
  }));
  assert.equal(stableId.winningMonetaryDiscount.sourceId, "a");
});

test("Scheduled Coupon remains manual and applies only after matching code entry", async () => {
  const scheduledCoupon = promotion({
    id: "scheduled-coupon",
    promotionType: "COUPON",
    couponCode: "ENTER10",
  });
  const withoutCode = await calculate(database({ coupons: [scheduledCoupon] }));
  const withCode = await calculate(database({ coupons: [scheduledCoupon] }), {
    promoCode: " enter10 ",
  });

  assert.equal(withoutCode.couponDiscountCents, 0);
  assert.equal(withCode.couponDiscountCents, 10_000);
});

test("minimum-order thresholds use the effective subtotal after Flash Sale pricing", async () => {
  const flashSale = {
    id: "flash-minimum",
    productId: "product-1",
    salePrice: 800,
    startsAt: new Date("2026-07-28T00:00:00.000Z"),
    endsAt: new Date("2026-07-29T00:00:00.000Z"),
    isActive: true,
  };
  const pricing = await calculate(database({
    flashSales: [flashSale],
    promotions: [promotion({ minimumOrderAmount: 900 })],
  }));

  assert.equal(pricing.subtotalCents, 80_000);
  assert.equal(pricing.scheduledPromotionDiscountCents, 0);
});

test("personal VIP promo codes are isolated to their assigned active VIP customer", async () => {
  const personalBenefit = benefit({
    type: "PROMO_CODE",
    promoCode: "VIP20",
    discountPercent: 20,
  });
  const assigned = await calculate(database({
    benefits: [personalBenefit],
    tier: "VIP",
  }), { promoCode: "vip20" });
  assert.equal(assigned.vipDiscountCents, 20_000);
  assert.equal(assigned.pricingBreakdown.enteredCouponCode, "VIP20");
  assert.equal("enteredCouponCode" in serializePricingTotals(assigned), false);

  await assert.rejects(
    calculate(database({ benefits: [personalBenefit], tier: "VIP" }), {
      userId: "customer-2",
      promoCode: "VIP20",
    }),
    (error) => error instanceof OrderPricingError && error.code === "INVALID_PROMO_CODE"
  );
});

test("a captured pricing snapshot does not change when the source promotion object is edited", async () => {
  const source = promotion({ titleEn: "Original title", discountPercent: 10 });
  const pricing = await calculate(database({ promotions: [source] }));
  const snapshot = structuredClone(pricing.pricingBreakdown);

  source.titleEn = "Edited title";
  source.discountPercent = 99;

  assert.deepEqual(pricing.pricingBreakdown, snapshot);
  assert.equal(pricing.pricingBreakdown.winningMonetarySource.titleEn, "Original title");
  assert.equal(pricing.pricingBreakdown.monetaryDiscount, 100);
});

test("free shipping combines with only the winning monetary discount", async () => {
  const pricing = await calculate(database({
    promotions: [promotion({
      promotionType: "FIXED_DISCOUNT",
      discountPercent: null,
      discountAmount: 100,
    })],
    benefits: [benefit({ type: "FREE_SHIPPING", discountPercent: null })],
    tier: "VIP",
  }));
  assert.equal(pricing.shippingCents, 0);
  assert.equal(pricing.shippingDiscountCents, 5_000);
  assert.equal(pricing.monetaryDiscountCents, 10_000);
  assert.equal(pricing.totalCents, 90_000);
});

test("active VIP tier automatically makes Standard free, Fast upgrade-only, and Pickup free", async () => {
  const vipDatabase = database({ tier: "VIP" });
  const standard = await calculate(vipDatabase, { deliveryMethod: "standard" });
  const fast = await calculate(vipDatabase, { deliveryMethod: "fast" });
  const pickup = await calculate(vipDatabase, { deliveryMethod: "pickup" });

  assert.equal(standard.shippingCents, 0);
  assert.equal(standard.vipShippingDiscountCents, 5_000);
  assert.equal(standard.vipShippingSource.sourceType, "VIP_STANDARD_FREE_SHIPPING");
  assert.equal(fast.shippingCents, 3_000);
  assert.equal(fast.vipShippingDiscountCents, 5_000);
  assert.equal(fast.vipShippingSource.sourceType, "VIP_FAST_UPGRADE_ONLY");
  assert.equal(pickup.shippingCents, 0);
});

test("a stronger free-shipping benefit reduces VIP Fast to zero", async () => {
  const pricing = await calculate(database({
    tier: "VIP",
    benefits: [benefit({ type: "FREE_SHIPPING", discountPercent: null })],
  }), { deliveryMethod: "fast" });

  assert.equal(pricing.shippingCents, 0);
  assert.equal(pricing.vipShippingDiscountCents, 5_000);
  assert.equal(pricing.freeShippingSource.sourceType, "VIP_BENEFIT");
});

test("VIP Fast upgrade calculation is clamped and can never make shipping negative", async () => {
  const pricing = await evaluateVipTierShipping(database({ tier: "VIP" }), {
    userId: "customer-1",
    deliveryMethod: "fast",
    shippingCents: 3_000,
  });
  assert.equal(pricing.shippingCents, 0);
  assert.equal(pricing.source.sourceType, "VIP_FAST_UPGRADE_ONLY");
});

test("a matching saved clinic location can receive the best delivery offer", async () => {
  const offer = {
    id: "delivery-1",
    titleEn: "Half-price delivery",
    titleAr: "توصيل بنصف السعر",
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
    appliesToFast: false,
    createdAt: now,
  };
  const pricing = await calculate(database({
    location: { id: "location-1", deliveryZoneId: "zone-1", deliveryZone: { isActive: true } },
    deliveryOffers: [offer],
  }), { clinicLocationId: "location-1" });
  assert.equal(pricing.deliveryOfferDiscountCents, 2_500);
  assert.equal(pricing.shippingCents, 2_500);
  assert.equal(pricing.totalCents, 102_500);
});

test("manual addresses do not receive location-based delivery offers", async () => {
  const pricing = await calculate(database({
    deliveryOffers: [{ id: "should-not-be-read" }],
  }));
  assert.equal(pricing.deliveryOfferDiscountCents, 0);
  assert.equal(pricing.shippingCents, 5_000);
});

test("zero, negative, null, and malformed catalog prices fail closed", async () => {
  for (const price of [0, -1, null, "not-a-price"]) {
    await assert.rejects(
      calculate(database({ catalogProduct: product({ price }) })),
      (error) => error instanceof OrderPricingError && error.code === "INVALID_PRODUCT_PRICE"
    );
  }
});

function variant(overrides = {}) {
  return {
    id: "variant-1",
    externalVariantId: null,
    sku: "SKU-1-A1",
    barcode: null,
    priceOverride: null,
    stockQuantity: 5,
    lowStockThreshold: 5,
    status: "ACTIVE",
    isAvailable: true,
    selections: [{ option: { code: "SHADE", nameEn: "Shade", sortOrder: 0 }, optionValue: { code: "A1", valueEn: "A1" } }],
    ...overrides,
  };
}
function productWithVariant(variantOverrides = {}, productOverrides = {}) {
  return product({ variants: [variant(variantOverrides)], ...productOverrides });
}

test("checkout reloads the authoritative variant price instead of trusting the client", async () => {
  const db = database({ catalogProduct: productWithVariant({ priceOverride: 250 }) });
  const pricing = await calculate(db, { itemReferences: [{ productId: "product-1", variantId: "variant-1", quantity: 1, price: 1 }] });
  assert.equal(pricing.items[0].unitPriceCents, 25_000);
  assert.equal(pricing.subtotalCents, 25_000);
});

test("a variant with no price override falls back to the parent product's effective price", async () => {
  const db = database({ catalogProduct: productWithVariant({ priceOverride: null }) });
  const pricing = await calculate(db, { itemReferences: [{ productId: "product-1", variantId: "variant-1", quantity: 1 }] });
  assert.equal(pricing.items[0].unitPriceCents, 100_000);
});

test("an unavailable or out-of-stock variant is rejected even though the parent product is orderable", async () => {
  const db = database({ catalogProduct: productWithVariant({ isAvailable: false }) });
  await assert.rejects(
    calculate(db, { itemReferences: [{ productId: "product-1", variantId: "variant-1", quantity: 1 }] }),
    (error) => error instanceof OrderPricingError && error.code === "VARIANT_UNAVAILABLE"
  );
});

test("ordering more than the variant's own stock is rejected without checking parent product stock", async () => {
  const db = database({ catalogProduct: productWithVariant({ stockQuantity: 2 }, { stockQuantity: 999 }) });
  await assert.rejects(
    calculate(db, { itemReferences: [{ productId: "product-1", variantId: "variant-1", quantity: 3 }] }),
    (error) => error instanceof OrderPricingError && error.code === "INSUFFICIENT_STOCK" && error.availableQuantity === 2
  );
});

test("a variant product requires a variantId and a variantId is rejected for a simple product", async () => {
  const dbWithVariants = database({ catalogProduct: productWithVariant() });
  await assert.rejects(
    calculate(dbWithVariants, { itemReferences: [{ productId: "product-1", quantity: 1 }] }),
    (error) => error instanceof OrderPricingError && error.code === "VARIANT_REQUIRED"
  );

  const simpleDb = database({ catalogProduct: product() });
  await assert.rejects(
    calculate(simpleDb, { itemReferences: [{ productId: "product-1", variantId: "variant-1", quantity: 1 }] }),
    (error) => error instanceof OrderPricingError && error.code === "INVALID_VARIANT"
  );
});

test("order items carry a complete, immutable variant snapshot for storage on the order", async () => {
  const db = database({ catalogProduct: productWithVariant({ sku: "SKU-1-A1", barcode: "0000111122223", priceOverride: 180 }) });
  const pricing = await calculate(db, { itemReferences: [{ productId: "product-1", variantId: "variant-1", quantity: 1 }] });
  const item = pricing.items[0];
  assert.equal(item.variantId, "variant-1");
  assert.equal(item.variantSku, "SKU-1-A1");
  assert.equal(item.variantBarcode, "0000111122223");
  assert.equal(item.selectedOptions, "Shade: A1");
  assert.equal(item.variantUnitPriceCents, 18_000);
  assert.match(item.productName, /Shade: A1/);
});

test("public preview totals omit internal source and benefit identifiers", async () => {
  const pricing = await calculate(database({
    promotions: [promotion({ id: "private-promotion-id" })],
  }));
  const serialized = serializePricingTotals(pricing);
  assert.equal("id" in serialized.winningMonetarySource, false);
  assert.equal(JSON.stringify(serialized).includes("private-promotion-id"), false);
});
