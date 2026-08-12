import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const source = (relativePath: string) =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test("Scheduled Promotion admin keeps type-specific monetary inputs and Cairo-time guidance", () => {
  const page = source("src/pages/admin/scheduled-promotions.tsx");
  for (const type of [
    "INFORMATIONAL",
    "PERCENTAGE_DISCOUNT",
    "FIXED_DISCOUNT",
    "COUPON",
    "FREE_DELIVERY",
    "CUSTOM",
  ]) {
    assert.match(page, new RegExp(type));
  }
  assert.match(page, /promotionType === "PERCENTAGE_DISCOUNT"/);
  assert.match(page, /promotionType === "FIXED_DISCOUNT"/);
  assert.match(page, /promotionType === "COUPON"/);
  assert.match(page, /All schedule evaluation uses Africa\/Cairo/);
});

test("Delivery Offer admin keeps type-specific rules and excludes Pickup from monetary controls", () => {
  const page = source("src/pages/admin/delivery.tsx");
  assert.match(page, /offerType === "SAME_DAY_DELIVERY"/);
  assert.match(page, /offerType === "FREE_DELIVERY"/);
  assert.match(page, /offerType === "DISCOUNTED_DELIVERY"/);
  assert.match(page, /offerType === "CUSTOM"/);
  assert.match(page, /appliesToStandard/);
  assert.match(page, /appliesToFast/);
  assert.match(page, /All dates and times use Cairo time/);
  assert.doesNotMatch(page, /appliesToPickup/);
});

test("Flash Sale admin exposes Cairo time and a non-blocking overlap warning", () => {
  const page = source("src/pages/admin/flash-sale.tsx");
  assert.match(page, /const CAIRO_TIMEZONE = "Africa\/Cairo"/);
  assert.match(page, /overlapCount > 0/);
  assert.match(page, /overlapWarning/);
});

test("Checkout renders authoritative savings and handles price re-review without clearing the cart", () => {
  const page = source("src/pages/checkout.tsx");
  for (const field of [
    "productPromotionSavings",
    "winningMonetarySource",
    "deliveryOfferDiscount",
    "shippingBeforeDiscount",
    "freeShippingSource",
    "totalSavings",
  ]) {
    assert.match(page, new RegExp(field));
  }
  assert.match(page, /PRICE_CHANGED_REVIEW_REQUIRED/);
  assert.match(page, /setTrustedTotals\(refreshedTotals\)/);
  assert.match(page, /clearCheckoutAttempt\(window\.sessionStorage, currentUser\.id, attemptKey\)/);

  const conflictBranch = page.slice(
    page.indexOf('error.code === "PRICE_CHANGED_REVIEW_REQUIRED"'),
    page.indexOf('error.code === "IDEMPOTENCY_KEY_REUSED"')
  );
  assert.doesNotMatch(conflictBranch, /clearCart\(/);
});

test("stored pricing breakdown is shared by admin, customer, and confirmation views with legacy fallback", () => {
  const breakdown = source("src/components/dental/OrderPricingBreakdown.tsx");
  assert.match(breakdown, /if \(!pricing\)/);
  assert.match(breakdown, /legacyPricing/);
  assert.match(breakdown, /winningMonetarySource/);
  assert.match(breakdown, /dark:text/);

  for (const pagePath of [
    "src/pages/admin/orders.tsx",
    "src/pages/account-order-detail.tsx",
    "src/pages/order-confirmed.tsx",
  ]) {
    assert.match(source(pagePath), /OrderPricingBreakdown/);
  }
});

test("customer VIP benefits are private account data with localized, light/dark presentation", () => {
  const accountService = source("src/services/account.ts");
  const dashboard = source("src/pages/account-dashboard.tsx");
  const en = JSON.parse(source("src/locales/en.json"));
  const ar = JSON.parse(source("src/locales/ar.json"));

  assert.match(accountService, /\/account\/vip-benefits/);
  assert.match(dashboard, /customerTier === "vip"/);
  assert.match(dashboard, /benefit\.promoCode/);
  assert.match(dashboard, /language === "ar"/);
  assert.match(dashboard, /dark:/);
  assert.ok(en.accountPages.dashboard.vipBenefitsTitle);
  assert.ok(ar.accountPages.dashboard.vipBenefitsTitle);
});
