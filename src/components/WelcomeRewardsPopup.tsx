import { useEffect, useRef, useState } from "react";
import { Gift, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useStore } from "@/context/StoreContext";
import { useLanguage } from "@/context/LanguageContext";
import {
  shouldShowWelcomeRewardsPopup,
  WELCOME_REWARDS_DISMISSAL_KEY,
} from "@/lib/welcomeRewardsPopup";
import {
  getPublicLoyaltySettings,
  type PublicLoyaltySettings,
} from "@/services/loyalty";

const DISPLAY_DELAY_MS = 5_000;

function readDismissedAt() {
  try {
    const value = window.localStorage.getItem(WELCOME_REWARDS_DISMISSAL_KEY);
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function WelcomeRewardsPopup() {
  const { isAuthenticated, isAuthLoading } = useStore();
  const { t } = useLanguage();
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState<PublicLoyaltySettings | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    if (!isAuthenticated && !isAuthLoading) {
      getPublicLoyaltySettings(controller.signal)
        .then(setSettings)
        .catch(() => {
          if (!controller.signal.aborted) setSettings(null);
        });
    }
    return () => controller.abort();
  }, [isAuthenticated, isAuthLoading]);

  useEffect(() => {
    setIsOpen(false);
    if (
      !shouldShowWelcomeRewardsPopup({
        isAuthenticated,
        isAuthLoading,
        location,
        dismissedAt: readDismissedAt(),
      })
      || !settings
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (
        shouldShowWelcomeRewardsPopup({
          isAuthenticated,
          isAuthLoading,
          location,
          dismissedAt: readDismissedAt(),
        })
      ) {
        setIsOpen(true);
      }
    }, DISPLAY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isAuthenticated, isAuthLoading, location, settings]);

  const dismiss = () => {
    setIsOpen(false);
    try {
      window.localStorage.setItem(
        WELCOME_REWARDS_DISMISSAL_KEY,
        String(Date.now())
      );
    } catch {
      // A storage restriction must not block dismissing the current popup.
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  if (!isOpen || isAuthenticated || isAuthLoading) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[#050505]/45 p-4 backdrop-blur-[2px] sm:items-center" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-rewards-title"
        aria-describedby="welcome-rewards-description"
        className="relative w-full max-w-[520px] overflow-hidden rounded-[26px] border border-[var(--xd-gold-border-hover)] bg-[var(--xd-surface)] p-6 shadow-[0_28px_90px_rgba(5,5,5,0.30)] sm:p-8"
      >
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[var(--xd-gold-active)]/15 blur-3xl" />
        <button
          ref={closeButtonRef}
          type="button"
          onClick={dismiss}
          aria-label={t("common.close", { fallback: "Close" })}
          className="absolute end-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full text-[#717182] transition hover:bg-[var(--xd-gold-bg-soft)] hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)] dark:text-[#C6BEAE] dark:hover:text-[#F7F2E6]"
        >
          <X size={19} aria-hidden="true" />
        </button>

        <span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[image:var(--xd-gold-gradient)] text-[#050505] shadow-[0_12px_30px_rgba(212,167,44,0.22)]">
          <Gift size={26} aria-hidden="true" />
        </span>
        <h2 id="welcome-rewards-title" className="mt-5 pe-8 font-display text-[27px] font-bold leading-tight text-[#050505] dark:text-[#F7F2E6] sm:text-[31px]">
          {t("welcomeRewards.headline", {
            fallback: "Get EGP {value} toward your first order",
            values: { value: settings?.welcomeValueEgp ?? 500 },
          })}
        </h2>
        <p id="welcome-rewards-description" className="mt-3 text-[14px] leading-6 text-[#717182] dark:text-[#C6BEAE]">
          {t("welcomeRewards.description", {
            fallback: "Create your X Dental Store account and receive {points} welcome points (EGP {value}) to use on your first eligible purchase. Keep earning more points with every completed order.",
            values: {
              points: settings?.welcomePoints ?? 5_000,
              value: settings?.welcomeValueEgp ?? 500,
            },
          })}
        </p>
        <Link
          href="/signup?welcome=points"
          onClick={dismiss}
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[image:var(--xd-gold-gradient)] px-5 text-center text-[14px] font-bold text-[#050505] shadow-[0_12px_28px_rgba(212,167,44,0.20)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border-hover)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--xd-surface)]"
        >
          {t("welcomeRewards.cta", {
            fallback: "Create Account & Claim {points} Points",
            values: { points: settings?.welcomePoints ?? 5_000 },
          })}
        </Link>
        <p className="mt-3 text-center text-[11px] leading-5 text-[#8A8D9A] dark:text-[#BDB6A8]">
          {t("welcomeRewards.note", {
            fallback: "Valid for {days} days on eligible product purchases of EGP {minimum} or more. Points cannot be used for shipping.",
            values: {
              days: settings?.welcomeExpiryDays ?? 30,
              minimum: settings?.welcomeMinimumSubtotalEgp ?? 5_000,
            },
          })}
        </p>
      </section>
    </div>
  );
}
