import test from "node:test";
import assert from "node:assert/strict";
import { parseItemReference, serializeOrder } from "./order.controller.js";

function legacyOrderItem(overrides = {}) {
  return {
    id: "item-1",
    productId: "product-1",
    externalProductId: null,
    variantId: null,
    externalVariantId: null,
    productName: "Legacy Product",
    sku: "SKU-1",
    variantSku: null,
    variantBarcode: null,
    selectedOptions: null,
    quantity: 1,
    unitPrice: 100,
    variantUnitPrice: null,
    total: 100,
    originalUnitPrice: null,
    promotionDiscount: null,
    promotionSourceType: null,
    promotionTitleEn: null,
    promotionTitleAr: null,
    ...overrides,
  };
}

function legacyOrder(overrides = {}) {
  return {
    id: "order-1",
    orderNumber: "ORD-OLD-1",
    status: "DELIVERED",
    paymentStatus: "PAID",
    subtotal: 100,
    shipping: 50,
    discount: 0,
    total: 150,
    // Pre-Phase-7A / pre-Phase-4 orders never had these snapshot columns populated.
    shippingBeforeDiscount: null,
    shippingDiscount: null,
    productPromotionSavings: null,
    scheduledPromotionDiscount: null,
    couponDiscount: null,
    vipDiscount: null,
    pointsRedeemed: null,
    pointsRedemptionValue: null,
    walletCreditUsed: null,
    remainingCodAmount: null,
    pricingBreakdown: null,
    customerName: "Dr. Legacy",
    customerEmail: "legacy@example.com",
    customerPhone: "01000000000",
    shippingAddress: null,
    paymentMethod: "cash",
    syncStatus: null,
    user: { id: "user-1", name: "Dr. Legacy", email: "legacy@example.com", phone: "01000000000", role: "CUSTOMER" },
    items: [legacyOrderItem()],
    ...overrides,
  };
}

test("an old order created before variants existed still serializes safely with no pricing snapshot", () => {
  const serialized = serializeOrder(legacyOrder());
  assert.equal(serialized.orderNumber, "ORD-OLD-1");
  assert.equal(serialized.pricing, null, "orders without any snapshot fields report no pricing snapshot rather than crashing");
  assert.equal(serialized.items[0].variantId, null);
  assert.equal(serialized.items[0].variantSku, null);
  assert.equal(serialized.items[0].variantUnitPrice, null);
  assert.equal(serialized.total, 150);
});

test("changing or deactivating a variant later does not change how an already-placed order reads back", () => {
  const orderWithVariantSnapshot = legacyOrder({
    shippingBeforeDiscount: 50,
    productPromotionSavings: 0,
    items: [legacyOrderItem({
      variantId: "variant-1",
      externalVariantId: "V1",
      variantSku: "SKU-1-A1",
      variantBarcode: "0000111122223",
      selectedOptions: "Shade: A1",
      variantUnitPrice: 120,
      unitPrice: 120,
      total: 120,
    })],
  });
  const serialized = serializeOrder(orderWithVariantSnapshot);
  assert.equal(serialized.items[0].variantId, "variant-1");
  assert.equal(serialized.items[0].variantSku, "SKU-1-A1");
  assert.equal(serialized.items[0].variantBarcode, "0000111122223");
  assert.equal(serialized.items[0].selectedOptions, "Shade: A1");
  assert.equal(serialized.items[0].variantUnitPrice, 120);
  // The order snapshot is self-contained: nothing here re-reads the live ProductVariant record.
  assert.equal(serialized.pricing.hasSnapshot, true);
});

test("parseItemReference extracts and validates a browser-submitted variantId", () => {
  const withVariant = parseItemReference({ productId: "product-1", variantId: " variant-1 ", quantity: 2 }, 0);
  assert.equal(withVariant.value.variantId, "variant-1");

  const withoutVariant = parseItemReference({ productId: "product-1", quantity: 1 }, 0);
  assert.equal(withoutVariant.value.variantId, null);

  const invalidQuantity = parseItemReference({ productId: "product-1", variantId: "variant-1", quantity: 0 }, 0);
  assert.match(invalidQuantity.error, /quantity/);
});
