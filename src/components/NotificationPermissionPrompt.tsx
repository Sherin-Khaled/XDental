import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import {
  ALERT_VISIBILITY_EVENT,
  isAlertVisible,
  setAlertVisible,
} from "@/lib/alertVisibility";
import { useStore } from "@/context/StoreContext";
import { useLanguage } from "@/context/LanguageContext";
import {
  enableBrowserPushForCustomer,
  prepareBrowserPushForCustomer,
} from "@/services/pushNotifications";

const DISMISSED_UNTIL_KEY = "x-dental-notification-prompt-dismissed-until";
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

export function NotificationPermissionPrompt() {
  const { currentUser, isAuthLoading } = useStore();
  const { language, direction } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const eligibleCustomerId =
    !isAuthLoading && currentUser?.role.toUpperCase() === "CUSTOMER"
      ? currentUser.id
      : null;

  useEffect(() => {
    setIsVisible(false);
    setErrorMessage("");

    if (!eligibleCustomerId) {
      return;
    }

    let cancelled = false;
    let timeoutId: number | undefined;
    const showPrompt = () => {
      if (cancelled || isDismissed()) {
        return;
      }
      if (isAlertVisible("daily-offer")) {
        return;
      }
      setIsVisible(true);
    };

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

    void prepareBrowserPushForCustomer(eligibleCustomerId)
      .then((preparation) => {
        if (cancelled || !preparation.showPrompt || isDismissed()) return;
        timeoutId = window.setTimeout(showPrompt, PROMPT_DELAY_MS);
        window.addEventListener("scroll", handleScroll, { passive: true });
      })
      .catch(() => {
        // Do not ask for browser permission when the authenticated push
        // configuration cannot be verified.
      });

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener(ALERT_VISIBILITY_EVENT, handleAlertVisibilityChange);
    };
  }, [eligibleCustomerId]);

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
    if (!eligibleCustomerId || isEnabling) return;

    setIsEnabling(true);
    setErrorMessage("");
    try {
      const result = await enableBrowserPushForCustomer(eligibleCustomerId);
      if (result === "enabled" || result === "denied") {
        setIsVisible(false);
      } else if (result === "dismissed") {
        writeStorage(
          DISMISSED_UNTIL_KEY,
          String(Date.now() + DISMISS_DURATION_MS)
        );
        setIsVisible(false);
      } else {
        setErrorMessage(
          language === "ar"
            ? "الإشعارات غير متاحة على هذا المتصفح حاليًا."
            : "Notifications are not available in this browser right now."
        );
      }
    } catch {
      setErrorMessage(
        language === "ar"
          ? "تعذر تفعيل الإشعارات الآن. يرجى المحاولة مرة أخرى."
          : "Notifications could not be enabled. Please try again."
      );
    } finally {
      setIsEnabling(false);
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <aside
      className="fixed inset-x-4 bottom-4 z-40 rounded-[18px] border border-[var(--xd-gold-border-soft)] bg-white/[0.94] p-4 text-[var(--xd-text)] shadow-[0_20px_54px_rgba(5,5,5,0.14)] backdrop-blur-xl sm:left-6 sm:right-auto sm:bottom-6 sm:w-[450px]"
      role="dialog"
      aria-label={language === "ar" ? "طلب إذن الإشعارات" : "Notification permission prompt"}
      dir={direction}
    >
      <button
        type="button"
        onClick={dismissForSevenDays}
        aria-label={language === "ar" ? "إغلاق طلب الإشعارات" : "Close notification prompt"}
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
            {language === "ar" ? "ابقَ على اطلاع" : "Stay Updated"}
          </h2>
          <p className="mt-1 max-w-[330px] text-[14px] leading-[22px] text-[var(--xd-muted-2)]">
            {language === "ar"
              ? "احصل على تحديثات فورية عن طلباتك والشحنات والرسائل المهمة."
              : "Get real-time updates about your orders, shipments, and important messages."}
          </p>
          {errorMessage ? (
            <p className="mt-2 text-[13px] leading-5 text-red-600" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <div className="mt-5 flex flex-col gap-2 min-[420px]:flex-row">
            <button
              type="button"
              onClick={handleEnableNotifications}
              disabled={isEnabling}
              className="inline-flex h-11 items-center justify-center rounded-[9px] bg-[#2E5A7D] px-5 text-[14px] font-bold text-white transition hover:-translate-y-[1px] hover:bg-[#254B6A] hover:shadow-[0_12px_26px_rgba(46,90,125,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E5A7D]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              {isEnabling
                ? language === "ar"
                  ? "جارٍ التفعيل..."
                  : "Enabling..."
                : language === "ar"
                  ? "تفعيل الإشعارات"
                  : "Enable Notifications"}
            </button>
            <button
              type="button"
              onClick={dismissForSevenDays}
              className="inline-flex h-11 items-center justify-center rounded-[9px] bg-[#F2F3F5] px-5 text-[14px] font-semibold text-[var(--xd-muted-2)] transition hover:-translate-y-[1px] hover:bg-[#ECEEF1] hover:text-[var(--xd-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E5A7D]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              {language === "ar" ? "ربما لاحقًا" : "Maybe Later"}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
