import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { BadgePercent, Sparkles, X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import {
  getCurrentScheduledPromotions,
  type PromotionDisplayPlacement,
  type ScheduledPromotion,
} from "@/services/scheduledPromotions";
import { cn } from "@/lib/utils";

const DISMISSAL_PREFIX = "x-dental-scheduled-promotion";
const TIMEZONE = "Africa/Cairo";

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

function PromotionLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  if (/^https?:\/\//i.test(href)) return <a href={href}>{children}</a>;
  return <Link href={href}>{children}</Link>;
}

export function ScheduledPromotionPlacement({
  placement,
  className,
}: {
  placement: Exclude<PromotionDisplayPlacement, "POPUP">;
  className?: string;
}) {
  const { language } = useLanguage();
  const [promotion, setPromotion] = useState<ScheduledPromotion | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getCurrentScheduledPromotions(placement, controller.signal)
      .then((result) => {
        setPromotion(
          result.promotions.find(
            (item) => !item.isDismissible || !isDismissed(item)
          ) ?? null
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setPromotion(null);
      });
    return () => controller.abort();
  }, [placement]);

  const localized = useMemo(() => {
    if (!promotion) return null;
    const isArabic = language === "ar";
    return {
      title: isArabic ? promotion.titleAr : promotion.titleEn,
      description: isArabic
        ? promotion.descriptionAr
        : promotion.descriptionEn,
      badge: isArabic ? promotion.badgeAr : promotion.badgeEn,
      button: isArabic
        ? promotion.buttonTextAr
        : promotion.buttonTextEn,
    };
  }, [language, promotion]);

  if (!promotion || !localized) return null;

  const close = () => {
    if (!promotion.isDismissible) return;
    try {
      window.localStorage.setItem(dismissalKey(promotion), "true");
    } catch {
      // Storage restrictions must not break a promotion slot.
    }
    setPromotion(null);
  };

  const isBanner = placement === "ANNOUNCEMENT_BANNER";

  return (
    <section
      className={cn(
        "relative isolate overflow-hidden border border-[var(--xd-gold-border-soft)] bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(255,249,224,0.82))] shadow-[0_14px_36px_rgba(5,5,5,0.045)]",
        isBanner
          ? "rounded-[18px] px-4 py-3 sm:px-5"
          : "rounded-[24px] p-5 sm:p-6",
        className
      )}
      aria-label={localized.title}
    >
      <div className="pointer-events-none absolute -end-14 -top-20 -z-10 h-40 w-40 rounded-full bg-[#F9DC5C]/15 blur-3xl" />
      <div
        className={cn(
          "flex gap-3",
          isBanner
            ? "items-center"
            : "items-start sm:items-center",
          !isBanner && "sm:gap-4"
        )}
      >
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-[14px] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-text)]",
            isBanner ? "h-9 w-9" : "h-11 w-11"
          )}
        >
          <Sparkles size={isBanner ? 17 : 20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {localized.badge && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--xd-gold-border-soft)] bg-white/70 px-2.5 py-1 text-[11px] font-black text-[var(--xd-gold-text)]">
                <BadgePercent size={13} />
                {localized.badge}
              </span>
            )}
            <h2
              className={cn(
                "font-display font-bold text-[#050505]",
                isBanner ? "text-sm sm:text-[15px]" : "text-lg sm:text-xl"
              )}
            >
              {localized.title}
            </h2>
          </div>
          <p
            className={cn(
              "text-[#717182]",
              isBanner
                ? "mt-0.5 line-clamp-1 text-xs sm:text-[13px]"
                : "mt-2 max-w-3xl text-sm leading-6"
            )}
          >
            {localized.description}
          </p>
        </div>
        {promotion.targetUrl && (
          <PromotionLink href={promotion.targetUrl}>
            <span className="inline-flex h-9 shrink-0 items-center rounded-full bg-[#F9DC5C] px-4 text-xs font-black text-[#050505] transition hover:bg-[#E8C631]">
              {localized.button ||
                (language === "ar" ? "عرض التفاصيل" : "View Details")}
            </span>
          </PromotionLink>
        )}
        {promotion.isDismissible && (
          <button
            type="button"
            onClick={close}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#717182] transition hover:bg-black/5 hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A72C]/35"
            aria-label={language === "ar" ? "إغلاق العرض" : "Dismiss promotion"}
          >
            <X size={16} />
          </button>
        )}
      </div>
    </section>
  );
}
