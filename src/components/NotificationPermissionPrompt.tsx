import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import {
  ALERT_VISIBILITY_EVENT,
  isAlertVisible,
  setAlertVisible,
} from "@/lib/alertVisibility";

const DISMISSED_UNTIL_KEY = "x-dental-notification-prompt-dismissed-until";
const ENABLED_KEY = "x-dental-notification-enabled";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const PROMPT_DELAY_MS = 8_000;

function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures so the prompt still works in restricted modes.
  }
}

function isDismissed() {
  const dismissedUntil = Number(readStorage(DISMISSED_UNTIL_KEY));
  return Number.isFinite(dismissedUntil) && dismissedUntil > Date.now();
}

function canShowPrompt() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }

  if (readStorage(ENABLED_KEY) === "true") {
    return false;
  }

  const permission = window.Notification.permission;

  if (permission === "granted") {
    writeStorage(ENABLED_KEY, "true");
    return false;
  }

  if (permission === "denied") {
    return false;
  }

  return !isDismissed();
}

export function NotificationPermissionPrompt() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!canShowPrompt()) {
      return;
    }

    const showPrompt = () => {
      if (isAlertVisible("daily-offer")) {
        return;
      }

      if (canShowPrompt()) {
        setIsVisible(true);
      }
    };

    const timeoutId = window.setTimeout(showPrompt, PROMPT_DELAY_MS);

    const handleScroll = () => {
      const scrollableHeight =
        document.documentElement.scrollHeight - window.innerHeight;

      if (scrollableHeight <= 0) {
        return;
      }

      if (window.scrollY / scrollableHeight >= 0.3) {
        showPrompt();
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    const handleAlertVisibilityChange = (event: Event) => {
      const detail = (event as CustomEvent<{ alertName?: string; isVisible?: boolean }>).detail;

      if (detail?.alertName === "daily-offer" && !detail.isVisible) {
        window.setTimeout(showPrompt, 700);
      }
    };

    window.addEventListener(ALERT_VISIBILITY_EVENT, handleAlertVisibilityChange);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener(ALERT_VISIBILITY_EVENT, handleAlertVisibilityChange);
    };
  }, []);

  useEffect(() => {
    setAlertVisible("notification-prompt", isVisible);
    return () => setAlertVisible("notification-prompt", false);
  }, [isVisible]);

  const dismissForSevenDays = () => {
    writeStorage(
      DISMISSED_UNTIL_KEY,
      String(Date.now() + DISMISS_DURATION_MS)
    );
    setIsVisible(false);
  };

  const handleEnableNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setIsVisible(false);
      return;
    }

    try {
      const permission = await window.Notification.requestPermission();

      if (permission === "granted") {
        writeStorage(ENABLED_KEY, "true");
      } else if (permission !== "denied") {
        writeStorage(
          DISMISSED_UNTIL_KEY,
          String(Date.now() + DISMISS_DURATION_MS)
        );
      }
    } finally {
      setIsVisible(false);
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <aside
      className="fixed inset-x-4 bottom-4 z-40 rounded-[18px] border border-[var(--xd-gold-border-soft)] bg-white/[0.94] p-4 text-[var(--xd-text)] shadow-[0_20px_54px_rgba(5,5,5,0.14)] backdrop-blur-xl sm:left-6 sm:right-auto sm:bottom-6 sm:w-[450px]"
      role="dialog"
      aria-label="Notification permission prompt"
    >
      <button
        type="button"
        onClick={dismissForSevenDays}
        aria-label="Close notification prompt"
        className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-[#8A8D9A] transition-colors hover:bg-[#050505]/[0.04] hover:text-[var(--xd-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E5A7D]/30"
      >
        <X size={19} strokeWidth={2} />
      </button>

      <div className="flex gap-4 pr-8">
        <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--xd-info-bg)] text-[#2E5A7D]">
          <Bell size={21} strokeWidth={2} />
        </span>

        <div className="min-w-0">
          <h2 className="text-[16px] font-bold leading-[22px] text-[var(--xd-text)]">
            Stay Updated
          </h2>
          <p className="mt-1 max-w-[330px] text-[14px] leading-[22px] text-[var(--xd-muted-2)]">
            Get real-time updates about your orders, shipments, and important
            messages.
          </p>

          <div className="mt-5 flex flex-col gap-2 min-[420px]:flex-row">
            <button
              type="button"
              onClick={handleEnableNotifications}
              className="inline-flex h-11 items-center justify-center rounded-[9px] bg-[#2E5A7D] px-5 text-[14px] font-bold text-white transition hover:-translate-y-[1px] hover:bg-[#254B6A] hover:shadow-[0_12px_26px_rgba(46,90,125,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E5A7D]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              Enable Notifications
            </button>
            <button
              type="button"
              onClick={dismissForSevenDays}
              className="inline-flex h-11 items-center justify-center rounded-[9px] bg-[#F2F3F5] px-5 text-[14px] font-semibold text-[var(--xd-muted-2)] transition hover:-translate-y-[1px] hover:bg-[#ECEEF1] hover:text-[var(--xd-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E5A7D]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
