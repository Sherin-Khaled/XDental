export const WELCOME_REWARDS_DISMISSAL_KEY = "xdental:welcome-rewards-dismissed-at";
export const WELCOME_REWARDS_RESHOW_MS = 7 * 24 * 60 * 60 * 1000;

const EXCLUDED_PATHS = new Set([
  "/signin",
  "/login",
  "/signup",
  "/checkout",
  "/order-confirmed",
]);

export function isWelcomeRewardsExcludedPath(location: string) {
  const pathname = location.split("?")[0].replace(/\/$/, "") || "/";
  return EXCLUDED_PATHS.has(pathname);
}

export function shouldShowWelcomeRewardsPopup({
  isAuthenticated,
  isAuthLoading,
  location,
  dismissedAt,
  now = Date.now(),
}: {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  location: string;
  dismissedAt: number | null;
  now?: number;
}) {
  if (isAuthLoading || isAuthenticated || isWelcomeRewardsExcludedPath(location)) {
    return false;
  }
  return dismissedAt === null
    || !Number.isFinite(dismissedAt)
    || now - dismissedAt >= WELCOME_REWARDS_RESHOW_MS;
}
