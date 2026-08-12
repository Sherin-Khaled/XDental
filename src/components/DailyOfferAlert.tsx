import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  BadgePercent,
  CalendarClock,
  Check,
  Clipboard,
  Info,
  Sparkles,
  Truck,
  X,
} from "lucide-react";
import { Button } from "@/components/dental/Button";
import { useLanguage } from "@/context/LanguageContext";
import {
  getCurrentScheduledPromotions,
  type PromotionType,
  type ScheduledPromotion,
} from "@/services/scheduledPromotions";
import {
  ALERT_VISIBILITY_EVENT,
  isAlertVisible,
  setAlertVisible,
} from "@/lib/alertVisibility";

const INITIAL_DELAY_MS = 1_200;
const AFTER_NOTIFICATION_DELAY_MS = 700;
const DISMISSAL_PREFIX = "x-dental-scheduled-promotion";
const TIMEZONE = "Africa/Cairo";
const COUPON_ENGINE_MARKER = "__X_DENTAL_COUPON__";

type Translate = (
  key: string,
  options?: { fallback?: string; values?: Record<string, string | number> }
) => string;

const PROMOTION_TYPE_KEYS: Record<PromotionType, string> = {
  INFORMATIONAL: "informational",
  PERCENTAGE_DISCOUNT: "percentageDiscount",
  FIXED_DISCOUNT: "fixedDiscount",
  COUPON: "coupon",
  FREE_DELIVERY: "freeDelivery",
  CUSTOM: "custom",
};

function cairoDateKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dismissalKey(promotion: Pick<ScheduledPromotion, "id">) {
  return `${DISMISSAL_PREFIX}:${promotion.id}:${cairoDateKey()}`;
}

function isDismissed(promotion: Pick<ScheduledPromotion, "id">) {
  try {
    return window.localStorage.getItem(dismissalKey(promotion)) === "true";
  } catch {
    return false;
  }
}

function dismiss(promotion: Pick<ScheduledPromotion, "id">) {
  try {
    window.localStorage.setItem(dismissalKey(promotion), "true");
  } catch {
    // Storage restrictions must not break the page.
  }
}

function formatEgp(value: number, language: "en" | "ar") {
  return new Intl.NumberFormat(language === "ar" ? "ar-EG" : "en-EG", {
    style: "currency",
    currency: "EGP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPromotionDate(value: string | null, language: "en" | "ar") {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-EG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TIMEZONE,
  }).format(date);
}

function formatTime(value: string | null, language: "en" | "ar") {
  if (!value || !/^\d{2}:\d{2}/.test(value)) return null;
  return new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-EG", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`2000-01-01T${value.slice(0, 5)}:00Z`));
}

function scheduleSummary(
  promotion: ScheduledPromotion,
  language: "en" | "ar",
  t: Translate
) {
  const endDate = formatPromotionDate(promotion.endAt, language);
  if (promotion.scheduleType === "DATE_RANGE" && endDate) {
    return t("dailyOffer.endsOn", {
      fallback: "Ends {date}",
      values: { date: endDate, time: "" },
    });
  }

  const startDate = formatPromotionDate(promotion.startAt, language);
  if (promotion.scheduleType === "ONE_TIME_DATE" && startDate) {
    return t("dailyOffer.validOn", {
      fallback: "Valid on {date}",
      values: { date: startDate, time: "" },
    });
  }

  if (promotion.scheduleType === "WEEKLY_RECURRING" && promotion.weekdays.length > 0) {
    const weekdays = promotion.weekdays
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      .map((day) =>
        new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-EG", {
          weekday: "short",
          timeZone: "UTC",
        }).format(new Date(Date.UTC(2023, 0, 1 + day)))
      )
      .join(language === "ar" ? "، " : ", ");
    if (!weekdays) return null;
    const startTime = formatTime(promotion.startTime, language);
    const endTime = formatTime(promotion.endTime, language);
    const timeWindow = startTime && endTime ? ` · ${startTime}–${endTime}` : "";
    return t("dailyOffer.weeklySchedule", {
      fallback: "Every {days}{time}",
      values: { days: weekdays, time: timeWindow },
    });
  }

  return null;
}

function CtaLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: ReactNode;
  onClick: () => void;
}) {
  if (/^https?:\/\//i.test(href)) {
    return (
      <a href={href} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} onClick={onClick}>
      {children}
    </Link>
  );
}

export function DailyOfferAlert() {
  const { language, direction, t } = useLanguage();
  const [promotion, setPromotion] = useState<ScheduledPromotion | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const presentation = useMemo(() => {
    if (!promotion) return null;
    const isArabic = language === "ar";
    const promotionTypeKey = PROMOTION_TYPE_KEYS[promotion.promotionType];
    const typeLabel = t(`dailyOffer.types.${promotionTypeKey}`);
    const title = isArabic ? promotion.titleAr : promotion.titleEn;
    const description = isArabic ? promotion.descriptionAr : promotion.descriptionEn;
    const cta =
      (isArabic ? promotion.buttonTextAr : promotion.buttonTextEn)?.trim() ||
      t("dailyOffer.cta");
    const secondary = t("dailyOffer.secondary");
    const minimum =
      promotion.minimumOrderAmount !== null && promotion.minimumOrderAmount > 0
        ? t("dailyOffer.minimumOrder", {
            fallback: "Minimum order: {amount}",
            values: { amount: formatEgp(promotion.minimumOrderAmount, language) },
          })
        : null;
    const schedule = scheduleSummary(promotion, language, t);
    const safeTargetUrl =
      promotion.targetUrl && promotion.targetUrl !== COUPON_ENGINE_MARKER
        ? promotion.targetUrl
        : null;

    return {
      title,
      description,
      cta,
      secondary,
      typeLabel,
      minimum,
      schedule,
      safeTargetUrl,
    };
  }, [language, promotion, t]);

  useEffect(() => {
    let controller: AbortController | null = null;
    let timer: number | undefined;

    const tryShowPromotion = async () => {
      if (isAlertVisible("notification-prompt")) return;
      controller?.abort();
      controller = new AbortController();
      try {
        const result = await getCurrentScheduledPromotions("POPUP", controller.signal);
        const next =
          result.promotions.find((item) => !item.isDismissible || !isDismissed(item)) ?? null;
        setPromotion(next);
        setIsVisible(Boolean(next));
      } catch {
        if (!controller.signal.aborted) {
          setPromotion(null);
          setIsVisible(false);
        }
      }
    };

    timer = window.setTimeout(() => void tryShowPromotion(), INITIAL_DELAY_MS);

    const handleVisibilityChange = (event: Event) => {
      const detail = (
        event as CustomEvent<{ alertName?: string; isVisible?: boolean }>
      ).detail;
      if (detail?.alertName !== "notification-prompt" || detail.isVisible) return;
      window.setTimeout(() => void tryShowPromotion(), AFTER_NOTIFICATION_DELAY_MS);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key?.startsWith(DISMISSAL_PREFIX)) void tryShowPromotion();
    };

    window.addEventListener(ALERT_VISIBILITY_EVENT, handleVisibilityChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      if (timer) window.clearTimeout(timer);
      controller?.abort();
      window.removeEventListener(ALERT_VISIBILITY_EVENT, handleVisibilityChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    setAlertVisible("daily-offer", isVisible);
    return () => setAlertVisible("daily-offer", false);
  }, [isVisible]);

  useEffect(() => {
    setCopied(false);
  }, [promotion?.id]);

  const dismissPromotion = () => {
    if (!promotion?.isDismissible) return;
    dismiss(promotion);
    setIsVisible(false);
  };

  const copyCouponCode = async () => {
    if (!promotion?.couponCode) return;
    try {
      await navigator.clipboard.writeText(promotion.couponCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  };

  if (!isVisible || !promotion || !presentation) return null;

  const isAutomaticDiscount =
    promotion.promotionType === "PERCENTAGE_DISCOUNT" ||
    promotion.promotionType === "FIXED_DISCOUNT";
  const isCoupon = promotion.promotionType === "COUPON";
  const isFreeDelivery = promotion.promotionType === "FREE_DELIVERY";
  const isInformational =
    promotion.promotionType === "INFORMATIONAL" || promotion.promotionType === "CUSTOM";
  const value =
    promotion.promotionType === "PERCENTAGE_DISCOUNT" && promotion.discountPercent !== null
      ? `${promotion.discountPercent}%`
      : promotion.promotionType === "FIXED_DISCOUNT" && promotion.discountAmount !== null
        ? formatEgp(promotion.discountAmount, language)
        : null;

  return (
    <aside
      dir={direction}
      className={`fixed bottom-4 left-4 right-4 z-50 w-auto max-w-none overflow-hidden rounded-[22px] border border-[var(--xd-gold-border-soft)] bg-white/[0.96] p-4 text-[var(--xd-text)] shadow-[0_24px_70px_rgba(5,5,5,0.18)] backdrop-blur-xl dark:bg-[#171714]/[0.97] sm:bottom-6 sm:w-[440px] sm:max-w-[calc(100vw-48px)] sm:p-5 ${
        direction === "rtl" ? "sm:left-auto sm:right-6" : "sm:left-6 sm:right-auto"
      }`}
      role="dialog"
      aria-label={presentation.title}
      data-testid="daily-offer-alert"
    >
      {promotion.isDismissible && (
        <button
          type="button"
          onClick={dismissPromotion}
          aria-label={t("dailyOffer.close")}
          className="absolute end-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-[#8A8D9A] transition-colors hover:bg-[#050505]/[0.04] hover:text-[var(--xd-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)] dark:hover:bg-white/[0.06]"
        >
          <X size={18} strokeWidth={2} />
        </button>
      )}

      <div className="flex min-w-0 gap-3 pe-8 sm:gap-4">
        <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-active)] sm:h-11 sm:w-11">
          {isFreeDelivery ? (
            <Truck size={21} strokeWidth={1.9} />
          ) : isInformational ? (
            <Info size={21} strokeWidth={1.9} />
          ) : (
            <Sparkles size={21} strokeWidth={1.9} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--xd-gold-text)]">
            <BadgePercent size={13} strokeWidth={2} />
            <span className="truncate">{presentation.typeLabel}</span>
          </span>

          <h2 className="mt-2.5 text-[18px] font-bold leading-[24px] text-[#050505] dark:text-[#F7F3E9]">
            {presentation.title}
          </h2>
          <p className="mt-1 text-[13px] leading-[20px] text-[var(--xd-text-muted)]">
            {presentation.description}
          </p>

          {value && (
            <div
              className="mt-3 inline-flex rounded-[14px] border border-[var(--xd-gold-border)] bg-[var(--xd-gold-bg-soft)] px-3.5 py-2 text-[22px] font-black leading-none text-[var(--xd-gold-text)]"
              data-testid="promotion-value"
            >
              {value}
            </div>
          )}

          {isCoupon && promotion.couponCode && (
            <div className="mt-3 rounded-[14px] border border-dashed border-[var(--xd-gold-border)] bg-[var(--xd-gold-bg-soft)] p-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--xd-text-muted)]">
                {t("dailyOffer.couponCode")}
              </span>
              <div className="mt-1.5 flex min-w-0 items-center gap-2">
                <code
                  dir="ltr"
                  className="min-w-0 flex-1 truncate text-[17px] font-black tracking-[0.08em] text-[var(--xd-text)]"
                  data-testid="promotion-coupon-code"
                >
                  {promotion.couponCode}
                </code>
                <button
                  type="button"
                  onClick={() => void copyCouponCode()}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[var(--xd-gold-border)] bg-[var(--xd-surface)] px-3 text-[11px] font-bold text-[var(--xd-gold-text)] transition-colors hover:bg-[var(--xd-gold-bg-medium)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-focus-ring)]"
                  aria-live="polite"
                >
                  {copied ? <Check size={14} /> : <Clipboard size={14} />}
                  {copied ? t("dailyOffer.copied") : t("dailyOffer.copyCode")}
                </button>
              </div>
            </div>
          )}

          <div className="mt-3 space-y-1.5 text-[12px] font-semibold leading-[18px] text-[var(--xd-text-muted)]">
            {isAutomaticDiscount && (
              <p className="text-[var(--xd-text)]" data-testid="promotion-automatic-message">
                {t("dailyOffer.automaticCheckout")}
              </p>
            )}
            {isCoupon && promotion.couponCode && (
              <p className="text-[var(--xd-text)]">{t("dailyOffer.couponInstruction")}</p>
            )}
            {isFreeDelivery && (
              <p className="text-[var(--xd-text)]">{t("dailyOffer.freeDeliveryAutomatic")}</p>
            )}
            {isInformational && <p>{t("dailyOffer.checkoutUnaffected")}</p>}
            {presentation.minimum && <p>{presentation.minimum}</p>}
            {presentation.schedule && (
              <p className="flex items-start gap-1.5">
                <CalendarClock size={14} className="mt-0.5 shrink-0 text-[var(--xd-gold-text)]" />
                <span>{presentation.schedule}</span>
              </p>
            )}
          </div>

          {(presentation.safeTargetUrl || promotion.isDismissible) && (
            <div className="mt-4 flex flex-col gap-2 min-[420px]:flex-row">
              {presentation.safeTargetUrl && (
                <Button asChild variant="primary" size="sm" className="h-10 px-4 text-[13px]">
                  <CtaLink
                    href={presentation.safeTargetUrl}
                    onClick={() => {
                      if (promotion.isDismissible) dismissPromotion();
                    }}
                  >
                    {presentation.cta}
                  </CtaLink>
                </Button>
              )}
              {promotion.isDismissible && (
                <Button
                  type="button"
                  onClick={dismissPromotion}
                  variant="secondary"
                  size="sm"
                  className="h-10 px-4 text-[13px]"
                >
                  {presentation.secondary}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
