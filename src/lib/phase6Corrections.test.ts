import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function repoSource(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("welcome popup reads the safe public loyalty contract", () => {
  const popup = source("components/WelcomeRewardsPopup.tsx");
  const service = source("services/loyalty.ts");
  assert.match(popup, /getPublicLoyaltySettings/);
  assert.match(popup, /welcomeMinimumSubtotalEgp/);
  assert.match(popup, /welcomeExpiryDays/);
  assert.match(service, /apiRequest<\{ settings: PublicLoyaltySettings \}>/);
  assert.match(service, /"\/loyalty\/settings"/);
});

test("admin loyalty refresh keeps the selected customer stable and submits signed integers unchanged", () => {
  const loyalty = source("pages/admin/loyalty.tsx");
  const refreshSelected = loyalty.slice(
    loyalty.indexOf("const refreshSelected"),
    loyalty.indexOf("const submitPoints")
  );
  assert.match(refreshSelected, /getAdminLoyaltyCustomer\(selectedId\)/);
  assert.doesNotMatch(refreshSelected, /setSelectedId/);
  assert.match(loyalty, /points: Number\(points\)/);
});

test("checkout shows the approved welcome threshold and keeps expiry guidance in the welcome surface", () => {
  const checkout = source("pages/checkout.tsx");
  const popup = source("components/WelcomeRewardsPopup.tsx");
  const orderTypes = source("services/orders.ts");
  const serverPricing = repoSource("server/src/services/orderPricing.service.js");
  assert.match(checkout, /vipShippingDiscount/);
  assert.match(checkout, /welcomeMinimumSubtotal/);
  assert.match(checkout, /pointsMinimumRule/);
  assert.doesNotMatch(checkout, /welcomeExpiryDays/);
  assert.match(popup, /welcomeExpiryDays/);
  assert.match(orderTypes, /vipShippingSource/);
  assert.match(serverPricing, /VIP_STANDARD_FREE_SHIPPING/);
  assert.match(serverPricing, /VIP_FAST_UPGRADE_ONLY/);
});

test("account lifecycle UI uses the protected request workflow and hides deleted-account benefit controls", () => {
  const details = source("pages/admin/user-details.tsx");
  const service = source("services/adminUsers.ts");
  assert.match(details, /INITIATE_DEACTIVATION/);
  assert.match(details, /INITIATE_DELETION/);
  assert.match(details, /user\.lifecycleState !== "DELETED"/);
  assert.match(service, /account-action-requests/);
});

test("VIP pricing does not bypass the normal pending-review order workflow", () => {
  const orderController = repoSource("server/src/controllers/order.controller.js");
  const createSection = orderController.slice(
    orderController.indexOf("const createdOrder = await database.order.create"),
    orderController.indexOf("await debitOrderLoyalty")
  );
  assert.match(createSection, /status: "PENDING_REVIEW"/);
  assert.doesNotMatch(createSection, /customerTier|VIP|CONFIRMED/);
});

test("deleted customer benefits are rejected by every mutation endpoint", () => {
  const adminUsers = repoSource("server/src/controllers/adminUser.controller.js");
  const guards = adminUsers.match(/lifecycleState === "DELETED"/g) ?? [];
  assert.ok(guards.length >= 4);
  assert.match(adminUsers, /Deleted accounts cannot manage benefits/);
});

test("loyalty UI presents immediate welcome rewards and keeps usable and pending balances separate", () => {
  const popup = source("components/WelcomeRewardsPopup.tsx");
  const dashboard = source("pages/account-dashboard.tsx");
  const wallet = source("pages/account-wallet.tsx");
  assert.match(popup, /Get EGP \{value\} toward your first order/);
  assert.doesNotMatch(popup, /pending welcome points/i);
  assert.match(popup, /welcomeExpiryDays/);
  assert.match(popup, /welcomeMinimumSubtotalEgp/);
  assert.match(dashboard, /Available Points/);
  assert.match(dashboard, /Open Orders/);
  assert.match(wallet, /pendingPoints > 0/);
  assert.match(wallet, /become available after delivery/);
});

test("checkout uses the premium location select and a non-wrapping EGP money component", () => {
  const checkout = source("pages/checkout.tsx");
  const money = source("components/dental/Money.tsx");
  assert.match(checkout, /DentalSelect/);
  assert.match(checkout, /Use manual delivery address/);
  assert.match(checkout, /Location-based delivery offers are not applied to manual addresses/);
  assert.match(checkout, /Redeem reward points/);
  assert.match(checkout, /Use store credit/);
  assert.match(checkout, /<Money amount=/);
  assert.match(money, /whitespace-nowrap/);
  assert.match(money, /formatCurrency/);
});

test("VIP and admin UI distinguish automatic tier value from optional benefits and lifecycle actions", () => {
  const dashboard = source("pages/account-dashboard.tsx");
  const loyalty = source("pages/admin/loyalty.tsx");
  const users = source("pages/admin/users.tsx");
  const details = source("pages/admin/user-details.tsx");
  assert.match(dashboard, /automatic VIP tier benefits are active/i);
  assert.match(dashboard, /Additional assigned benefits/);
  assert.match(loyalty, /\["customers", "transactions", "settings"\]/);
  assert.doesNotMatch(loyalty, /Signed points \(\+ or -\)/);
  assert.match(loyalty, /Add or remove loyalty points/);
  assert.match(users, /lifecycleState/);
  assert.match(details, /Confirm VIP tier benefits/);
  assert.match(details, /Add Additional VIP Benefit/);
  assert.match(details, /user\.lifecycleState !== "DELETED"/);
});
