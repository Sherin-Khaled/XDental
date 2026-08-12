import test from "node:test";
import assert from "node:assert/strict";
import {
  isWelcomeRewardsExcludedPath,
  shouldShowWelcomeRewardsPopup,
  WELCOME_REWARDS_RESHOW_MS,
} from "./welcomeRewardsPopup.ts";

const now = Date.UTC(2026, 7, 2, 12, 0, 0);

test("guest popup is eligible for a signed-out visitor after auth resolves", () => {
  assert.equal(shouldShowWelcomeRewardsPopup({
    isAuthenticated: false,
    isAuthLoading: false,
    location: "/products",
    dismissedAt: null,
    now,
  }), true);
});

test("guest popup never appears while auth loads or after sign in", () => {
  assert.equal(shouldShowWelcomeRewardsPopup({
    isAuthenticated: false,
    isAuthLoading: true,
    location: "/",
    dismissedAt: null,
    now,
  }), false);
  assert.equal(shouldShowWelcomeRewardsPopup({
    isAuthenticated: true,
    isAuthLoading: false,
    location: "/",
    dismissedAt: null,
    now,
  }), false);
});

test("sign-in, sign-up, checkout and confirmation routes are excluded", () => {
  for (const location of [
    "/signin",
    "/signup/",
    "/checkout?step=2",
    "/order-confirmed?orderId=safe-id",
  ]) {
    assert.equal(isWelcomeRewardsExcludedPath(location), true, location);
    assert.equal(shouldShowWelcomeRewardsPopup({
      isAuthenticated: false,
      isAuthLoading: false,
      location,
      dismissedAt: null,
      now,
    }), false, location);
  }
});

test("dismissal suppresses the popup for seven days and then expires", () => {
  assert.equal(shouldShowWelcomeRewardsPopup({
    isAuthenticated: false,
    isAuthLoading: false,
    location: "/categories",
    dismissedAt: now - WELCOME_REWARDS_RESHOW_MS + 1,
    now,
  }), false);
  assert.equal(shouldShowWelcomeRewardsPopup({
    isAuthenticated: false,
    isAuthLoading: false,
    location: "/categories",
    dismissedAt: now - WELCOME_REWARDS_RESHOW_MS,
    now,
  }), true);
});
