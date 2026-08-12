import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const source = (relativePath: string) =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

test("automatic percentage and fixed promotions show real values and no coupon field", () => {
  const popup = source("src/components/DailyOfferAlert.tsx");
  assert.match(popup, /promotion\.promotionType === "PERCENTAGE_DISCOUNT"/);
  assert.match(popup, /promotion\.promotionType === "FIXED_DISCOUNT"/);
  assert.match(popup, /promotion\.discountPercent/);
  assert.match(popup, /promotion\.discountAmount/);
  assert.match(popup, /promotion-automatic-message/);
  assert.match(popup, /isCoupon && promotion\.couponCode/);
  assert.doesNotMatch(
    popup.slice(popup.indexOf("{value &&"), popup.indexOf("{isCoupon && promotion.couponCode")),
    /couponCode/
  );
});

test("promotion popup presents minimum order and safe schedule details", () => {
  const popup = source("src/components/DailyOfferAlert.tsx");
  assert.match(popup, /promotion\.minimumOrderAmount !== null/);
  assert.match(popup, /formatEgp\(promotion\.minimumOrderAmount/);
  assert.match(popup, /scheduleSummary/);
  assert.match(popup, /DATE_RANGE/);
  assert.match(popup, /ONE_TIME_DATE/);
  assert.match(popup, /WEEKLY_RECURRING/);
});

test("coupon promotions show only their real code and provide copy confirmation", () => {
  const popup = source("src/components/DailyOfferAlert.tsx");
  assert.match(popup, /promotion-coupon-code/);
  assert.match(popup, /navigator\.clipboard\.writeText\(promotion\.couponCode\)/);
  assert.match(popup, /setCopied\(true\)/);
  assert.match(popup, /dailyOffer\.copied/);
  assert.match(popup, /COUPON_ENGINE_MARKER/);
  assert.match(popup, /promotion\.targetUrl !== COUPON_ENGINE_MARKER/);
});

test("informational and custom campaigns never claim checkout savings", () => {
  const popup = source("src/components/DailyOfferAlert.tsx");
  assert.match(popup, /promotion\.promotionType === "INFORMATIONAL"/);
  assert.match(popup, /promotion\.promotionType === "CUSTOM"/);
  assert.match(popup, /isInformational && <p>\{t\("dailyOffer\.checkoutUnaffected"\)\}<\/p>/);
});

test("notification rows are transparent with isolated focus and hover states", () => {
  const dropdown = source("src/components/dental/NotificationDropdown.tsx");
  assert.match(dropdown, /notification-dropdown-row/);
  assert.match(dropdown, /bg-transparent/);
  assert.match(dropdown, /hover:bg-\[#050505\]\/\[0\.035\]/);
  assert.match(dropdown, /dark:hover:bg-white\/\[0\.045\]/);
  assert.match(dropdown, /focus-visible:ring-inset/);
  assert.doesNotMatch(dropdown, /dark:bg-\[#D4A72C\]\/10/);
  assert.doesNotMatch(dropdown, /rounded-\[16px\].*notification/);
});

test("notification list uses thin separators, one stable scrollbar, and read state", () => {
  const dropdown = source("src/components/dental/NotificationDropdown.tsx");
  const css = source("src/index.css");
  assert.match(dropdown, /divide-y divide-\[#050505\]\/\[0\.07\]/);
  assert.match(dropdown, /notification-dropdown-scrollbar max-h-\[430px\] overflow-y-auto/);
  assert.match(dropdown, /scrollbar-gutter:stable/);
  assert.match(css, /\.notification-dropdown-scrollbar/);
  assert.match(css, /scrollbar-width: thin/);
  assert.match(dropdown, /data-read=\{notification\.readAt/);
  assert.match(dropdown, /notification-unread-dot/);
  assert.match(dropdown, /notification\.readAt \? "font-semibold" : "font-bold"/);
});

test("customer and admin navbars reuse the shared notification dropdown", () => {
  assert.match(source("src/components/dental/Navbar.tsx"), /<NotificationDropdown/);
  assert.match(source("src/pages/admin/_components/AdminLayout.tsx"), /<NotificationDropdown/);
});

test("location banner explains the daily dismissal without changing its storage rules", () => {
  const banner = source("src/components/dental/DeliveryOfferAlert.tsx");
  const en = JSON.parse(source("src/locales/en.json"));
  const ar = JSON.parse(source("src/locales/ar.json"));
  assert.equal(en.deliveryAlerts.hideForToday, "Hide for today");
  assert.equal(
    en.deliveryAlerts.locationNeededDescription,
    "Save your clinic’s delivery area to see available delivery services and location-based offers."
  );
  assert.ok(ar.deliveryAlerts.hideForToday);
  assert.ok(ar.deliveryAlerts.locationNeededDescription);
  assert.match(banner, /cairoDateKey\(\)/);
  assert.match(banner, /currentUser\.id/);
  assert.match(banner, /window\.localStorage\.setItem\(storageKey, "1"\)/);
  assert.match(banner, /deliveryAlerts\.hideForToday/);
});

test("low-stock presentation is shared across product, detail, cart, and checkout", () => {
  const helper = source("src/components/dental/StockAvailability.tsx");
  assert.match(helper, /product\.status === "LOW_STOCK"/);
  assert.match(helper, /Number\.isInteger\(product\.stockQuantity\)/);
  assert.match(helper, /availabilityConfirmedWhenProcessed/);

  const productCard = source("src/components/dental/ProductCard.tsx");
  assert.match(productCard, /<LowStockNotice product=\{product\}/);
  assert.match(productCard, /min-h-7/);
  assert.match(source("src/pages/product-detail.tsx"), /variant="detail"/);
  assert.match(source("src/pages/cart.tsx"), /<LowStockNotice product=\{item\.product\}/);
  assert.match(source("src/pages/checkout.tsx"), /<LowStockNotice/);
});

test("out-of-stock fallbacks, localization, themes, and responsive layouts remain explicit", () => {
  for (const file of [
    "src/components/dental/ProductCard.tsx",
    "src/pages/product-detail.tsx",
    "src/pages/cart.tsx",
  ]) {
    const page = source(file);
    assert.match(page, /OUT_OF_STOCK|Out of Stock|isProductPurchasable/);
  }

  const en = JSON.parse(source("src/locales/en.json"));
  const ar = JSON.parse(source("src/locales/ar.json"));
  assert.ok(en.common.lowStockWithCount);
  assert.ok(ar.common.lowStockWithCount);
  assert.ok(en.common.outOfStock);
  assert.ok(ar.common.outOfStock);

  const popup = source("src/components/DailyOfferAlert.tsx");
  assert.match(popup, /dark:bg-/);
  assert.match(popup, /sm:w-\[440px\]/);
  assert.match(popup, /dir=\{direction\}/);
  const banner = source("src/components/dental/DeliveryOfferAlert.tsx");
  assert.match(banner, /flex-wrap/);
  assert.match(banner, /sm:flex-nowrap/);
});
