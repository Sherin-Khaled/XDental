import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const selectPrimitive = read("../components/ui/select.tsx");
const dentalSelect = read("../components/dental/Select.tsx");
const adminForm = read("../pages/admin/_components/admin-form.tsx");
const adminLayout = read("../pages/admin/_components/AdminLayout.tsx");
const delivery = read("../pages/admin/delivery.tsx");
const promotions = read("../pages/admin/scheduled-promotions.tsx");
const users = read("../pages/admin/users.tsx");
const coupons = read("../pages/admin/coupons.tsx");
const products = read("../pages/admin/products.tsx");
const flashSale = read("../pages/admin/flash-sale.tsx");
const accountRequests = read("../pages/admin/account-requests.tsx");
const emailOperations = read("../pages/admin/_components/EmailOperationsPanel.tsx");
const styles = read("../index.css");

test("shared select uses a stable, collision-aware portal", () => {
  assert.match(selectPrimitive, /<SelectPrimitive\.Portal>/);
  assert.match(selectPrimitive, /data-xd-select-content/);
  assert.doesNotMatch(selectPrimitive, /data-\[state=open\]:zoom-in-95/);
  assert.doesNotMatch(selectPrimitive, /data-\[side=bottom\]:translate-y-1/);
  assert.match(dentalSelect, /collisionPadding=\{16\}/);
  assert.match(dentalSelect, /avoidCollisions/);
  assert.match(dentalSelect, /z-\[110\]/);
});

test("shared select isolates options, identifies selection, and scrolls internally", () => {
  assert.match(dentalSelect, /my-0\.5/);
  assert.match(dentalSelect, /focus:border-\[#D4A72C\]\/35/);
  assert.match(dentalSelect, /data-\[state=checked\]:border-\[#D4A72C\]\/30/);
  assert.match(selectPrimitive, /overflow-y-auto overflow-x-hidden/);
  assert.match(selectPrimitive, /SelectPrimitive\.ItemIndicator/);
});

test("select keeps Radix keyboard behavior and follows the active RTL direction", () => {
  assert.match(selectPrimitive, /SelectPrimitive\.Root/);
  assert.match(dentalSelect, /const resolvedDirection = dir \?\? direction/);
  assert.match(dentalSelect, /dir=\{resolvedDirection\}/);
  assert.match(adminForm, /data-admin-select-popover/);
  assert.match(adminForm, /collisionPadding=\{16\}/);
});

test("Admin does not retain native select controls", () => {
  assert.doesNotMatch(emailOperations, /<select[\s>]/);
  assert.match(emailOperations, /<DentalSelect/);
});

test("gold primary actions force dark readable text in all themes", () => {
  assert.match(styles, /--xd-gold-foreground:\s+#050505/);
  assert.match(styles, /\.xd-gradient-primary-button,[\s\S]*color: var\(--xd-gold-foreground\) !important/);
  assert.match(styles, /-webkit-text-fill-color: var\(--xd-gold-foreground\)/);
  assert.match(styles, /\.dark \.xd-gradient-primary-button[\s\S]*color: #050505 !important/);
});

test("promotion helpers are concise and Schedule Summary is theme-aware", () => {
  assert.match(promotions, /Applies automatically at checkout while this promotion is active\./);
  assert.match(promotions, /Customers must enter this code before checkout\./);
  assert.match(promotions, /All dates and times use Cairo time\./);
  assert.match(promotions, /تستخدم جميع التواريخ والأوقات توقيت القاهرة\./);
  assert.match(promotions, /data-admin-schedule-summary/);
  assert.match(promotions, /dark:bg-\[#1C1B16\]/);
  assert.match(promotions, /dark:text-\[#F5F1E7\]/);
});

test("Delivery uses accessible tabs, record-first panels, and dialog editors", () => {
  assert.match(delivery, /data-admin-delivery-tabs/);
  assert.match(delivery, /<TabsTrigger value="zones"/);
  assert.match(delivery, /<TabsTrigger value="offers"/);
  assert.match(delivery, /data-admin-delivery-panel="zones"/);
  assert.match(delivery, /data-admin-delivery-panel="offers"/);
  assert.match(delivery, /data-admin-dialog="delivery-zone-editor"/);
  assert.match(delivery, /data-admin-dialog="delivery-offer-editor"/);
  assert.match(delivery, /offer\.deliveryZones\.length/);
  assert.match(delivery, /A geographic clinic-delivery area, such as New Cairo\./);
  assert.match(delivery, /A scheduled service or shipping benefit assigned to selected delivery zones\./);
});

test("Admin owns one page scrollbar and dialogs own one body scrollbar", () => {
  assert.match(adminLayout, /xd-admin-page-active/);
  assert.match(adminLayout, /data-admin-main-scroll/);
  assert.match(adminLayout, /flex-1 overflow-y-auto overflow-x-hidden/);
  assert.match(styles, /html\.xd-admin-page-active body[\s\S]*overflow: hidden/);
  for (const source of [users, coupons, products, flashSale, promotions, delivery]) {
    assert.match(source, /max-h-\[calc\(100dvh-2rem\)\]/);
    assert.match(source, /flex-1[^"]*overflow-y-auto|overflow-y-auto[^"]*flex-1/);
  }
  assert.match(accountRequests, /max-h-\[calc\(100dvh-1rem\)\]/);
  assert.match(accountRequests, /flex-1 overflow-y-auto/);
});

