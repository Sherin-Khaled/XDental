import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { BadgePercent, Sparkles, X } from "lucide-react";
import { Button } from "@/components/dental/Button";
import { useLanguage } from "@/context/LanguageContext";
import {
  dismissScheduledOfferForToday,
  getActiveScheduledOffer,
  isScheduledOfferDismissedToday,
  type ScheduledOfferSettings,
  WEEKLY_OFFER_CALENDAR_STORAGE_KEY,
} from "@/lib/dailyOffer";
import {
  ALERT_VISIBILITY_EVENT,
  isAlertVisible,
  setAlertVisible,
} from "@/lib/alertVisibility";

const INITIAL_DAILY_OFFER_DELAY_MS = 1_200;
const AFTER_NOTIFICATION_DELAY_MS = 700;

function hasRenderableOffer(offer: ScheduledOfferSettings | null) {
  return Boolean(offer && !isScheduledOfferDismissedToday(offer));
}

export function DailyOfferAlert() {
  const { language, direction, t } = useLanguage();
  const [offer, setOffer] = useState<ScheduledOfferSettings | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const offerCopy = useMemo(() => {
    if (!offer) return null;

    const isArabic = language === "ar";
    const dayCopyKey = `dailyOffer.weekly.${offer.day}`;

    return {
      discountLabel:
        (isArabic ? offer.badgeAr : offer.badgeEn)?.trim() ||
        t(`${dayCopyKey}.badge`, { fallback: t("dailyOffer.badge") }),
      meta:
        (isArabic ? offer.eyebrowAr : offer.eyebrowEn)?.trim() ||
        t(`${dayCopyKey}.meta`, { fallback: t("dailyOffer.meta") }),
      title:
        (isArabic ? offer.titleAr : offer.titleEn)?.trim() ||
        t(`${dayCopyKey}.title`, { fallback: t("dailyOffer.title") }),
      description:
        (isArabic ? offer.descriptionAr : offer.descriptionEn)?.trim() ||
        t(`${dayCopyKey}.description`, {
          fallback: t("dailyOffer.description"),
        }),
      ctaText:
        (isArabic ? offer.ctaTextAr : offer.ctaTextEn)?.trim() ||
        t("dailyOffer.cta"),
      secondaryText:
        (isArabic ? offer.secondaryTextAr : offer.secondaryTextEn)?.trim() ||
        t("dailyOffer.secondary"),
    };
  }, [language, offer, t]);

  useEffect(() => {
    let showTimer: number | undefined;

    const tryShowOffer = () => {
      const activeOffer = getActiveScheduledOffer();

      if (!hasRenderableOffer(activeOffer)) {
        setOffer(null);
        setIsVisible(false);
        return;
      }

      if (isAlertVisible("notification-prompt")) {
        return;
      }

      setOffer(activeOffer);
      setIsVisible(true);
    };

    showTimer = window.setTimeout(tryShowOffer, INITIAL_DAILY_OFFER_DELAY_MS);

    const handleVisibilityChange = (event: Event) => {
      const detail = (event as CustomEvent<{ alertName?: string; isVisible?: boolean }>).detail;

      if (detail?.alertName !== "notification-prompt" || detail.isVisible) {
        return;
      }

      window.setTimeout(tryShowOffer, AFTER_NOTIFICATION_DELAY_MS);
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (
        !event.key ||
        (event.key !== WEEKLY_OFFER_CALENDAR_STORAGE_KEY &&
          !event.key.startsWith("x-dental-scheduled-offer"))
      ) {
        return;
      }

      window.setTimeout(tryShowOffer, AFTER_NOTIFICATION_DELAY_MS);
    };

    window.addEventListener(ALERT_VISIBILITY_EVENT, handleVisibilityChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      if (showTimer) window.clearTimeout(showTimer);
      window.removeEventListener(ALERT_VISIBILITY_EVENT, handleVisibilityChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  useEffect(() => {
    setAlertVisible("daily-offer", isVisible);
    return () => setAlertVisible("daily-offer", false);
  }, [isVisible]);

  const dismissOffer = () => {
    if (offer) {
      dismissScheduledOfferForToday(offer);
    }
    setIsVisible(false);
  };

  if (!isVisible || !offer || !offerCopy) {
    return null;
  }

  return (
    <aside
      dir={direction}
      className={`fixed bottom-4 left-4 right-4 z-50 w-auto max-w-none rounded-[22px] border border-[var(--xd-gold-border-soft)] bg-white/[0.94] p-4 text-[var(--xd-text)] shadow-[0_24px_70px_rgba(5,5,5,0.16)] backdrop-blur-xl sm:bottom-6 sm:w-[440px] sm:max-w-[calc(100vw-48px)] sm:p-5 ${
        direction === "rtl"
          ? "sm:left-auto sm:right-6"
          : "sm:left-6 sm:right-auto"
      }`}
      role="dialog"
      aria-label={offerCopy.title}
    >
      <button
        type="button"
        onClick={dismissOffer}
        aria-label={t("dailyOffer.close")}
        className="absolute end-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-[#8A8D9A] transition-colors hover:bg-[#050505]/[0.04] hover:text-[var(--xd-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
      >
        <X size={18} strokeWidth={2} />
      </button>

      <div className="flex gap-3 pe-8 sm:gap-4">
        <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-active)] sm:h-11 sm:w-11">
          <Sparkles size={21} strokeWidth={1.9} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] px-2.5 py-1 text-[12px] font-bold text-[var(--xd-gold-text)]">
              <BadgePercent size={14} strokeWidth={2} />
              <span
                dir={language === "ar" ? "rtl" : "ltr"}
                className="whitespace-nowrap"
                style={{ unicodeBidi: "isolate" }}
              >
                {offerCopy.discountLabel}
              </span>
            </span>
            <span className="text-[12px] font-semibold text-[#717182]">
              {offerCopy.meta}
            </span>
          </div>

          <h2 className="mt-2.5 text-[18px] font-bold leading-[24px] text-[#050505]">
            {offerCopy.title}
          </h2>
          <p className="mt-1 text-[14px] leading-[22px] text-[var(--xd-muted-2)]">
            {offerCopy.description}
          </p>

          <div className="mt-5 flex flex-col gap-2 min-[420px]:flex-row">
            <Button
              asChild
              variant="primary"
              size="sm"
              className="h-11 px-5 text-[14px]"
            >
              <Link href={offer.ctaUrl} onClick={dismissOffer}>
                {offerCopy.ctaText}
              </Link>
            </Button>
            <Button
              type="button"
              onClick={dismissOffer}
              variant="secondary"
              size="sm"
              className="h-11 px-5 text-[14px]"
            >
              {offerCopy.secondaryText}
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
