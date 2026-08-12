import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Settings loads preferences and sessions together and exposes retry", async () => {
  const settings = await source("../pages/account-settings.tsx");
  assert.match(settings, /Promise\.all\(\[\s*getAccountPreferences\(signal\),\s*getAccountSessions\(signal\)/);
  assert.match(settings, /onClick=\{\(\) => void loadSettings\(\)\}/);
});

test("Settings preference saves are optimistic and roll back on failure", async () => {
  const settings = await source("../pages/account-settings.tsx");
  assert.match(settings, /const previous = preferences;/);
  assert.match(settings, /setPreferences\(\{ \.\.\.preferences, \[key\]: nextValue \}\)/);
  assert.match(settings, /catch \{\s*setPreferences\(previous\)/);
  assert.match(settings, /savingPreferences\.has\(key\)/);
});

test("session listing, single revocation, and logout-others use real endpoints", async () => {
  const [settings, service] = await Promise.all([
    source("../pages/account-settings.tsx"),
    source("../services/account.ts"),
  ]);
  assert.match(settings, /sessions\.map\(\(session\)/);
  assert.match(settings, /revokeAccountSession\(session\.id\)/);
  assert.match(settings, /logoutOtherAccountSessions\(\)/);
  assert.match(service, /\/auth\/sessions\/logout-others/);
});

test("navbar and Settings use the same language state and account persistence path", async () => {
  const [navbar, settings, store] = await Promise.all([
    source("../components/dental/Navbar.tsx"),
    source("../pages/account-settings.tsx"),
    source("../context/StoreContext.tsx"),
  ]);
  assert.match(navbar, /changeLanguage\(language === "en" \? "ar" : "en"\)/);
  assert.match(settings, /changeLanguage\(nextLanguage\)/);
  assert.match(store, /updateAccountPreferences\(\{ language: nextLanguage \}\)/);
  assert.match(store, /setLanguage\("en"\)/);
});

test("Settings language selector uses the accessible shared control and literal language names", async () => {
  const [settings, select] = await Promise.all([
    source("../pages/account-settings.tsx"),
    source("../components/dental/Select.tsx"),
  ]);
  assert.match(settings, /<DentalSelect/);
  assert.match(settings, /\{ value: "en", label: "English" \}/);
  assert.match(settings, /\{ value: "ar", label: "العربية" \}/);
  assert.match(settings, /value=\{language\}/);
  assert.match(settings, /dir=\{direction\}/);
  assert.match(settings, /disabled=\{savingPreferences\.has\("language"\)\}/);
  assert.doesNotMatch(settings, /<select[\s>]/);
  assert.match(select, /disabled=\{disabled\}/);
  assert.match(select, /const resolvedDirection = dir \?\? direction/);
  assert.match(select, /dir=\{resolvedDirection\}/);
});

test("support refreshes on visibility, focus, ticket creation, and replies", async () => {
  const support = await source("../pages/account-support-tickets.tsx");
  assert.match(support, /document\.addEventListener\("visibilitychange", handleVisibility\)/);
  assert.match(support, /window\.addEventListener\("focus", handleFocus\)/);
  assert.ok((support.match(/void refreshTickets\(\);/g) ?? []).length >= 4);
  assert.match(support, /refreshController\.current\?\.abort\(\)/);
});

test("light-gold selected controls keep the shared dark foreground treatment", async () => {
  const [css, orders, notifications] = await Promise.all([
    source("../index.css"),
    source("../pages/account-orders.tsx"),
    source("../pages/account-notifications.tsx"),
  ]);
  assert.match(css, /\.xd-account-selected-gold-control/);
  assert.match(css, /color: var\(--xd-gold-foreground\)/);
  assert.match(orders, /xd-account-selected-gold-control xd-gradient-gold/);
  assert.match(notifications, /xd-account-selected-gold-control xd-gradient-gold/);
});
