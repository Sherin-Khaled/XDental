import { useEffect, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent, type TouchEvent } from "react";
import { Link } from "wouter";
import { Zap } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { Button } from "@/components/dental/Button";
import { SectionReveal } from "@/components/dental/SectionReveal";
import { SlideDots } from "@/components/dental/hero-slider/SlideDots";
import { useAutoRotate } from "@/components/dental/hero-slider/useAutoRotate";
import { useLanguage } from "@/context/LanguageContext";
import { getLocalizedProductName } from "@/lib/catalogTranslations";
import { useDirectionalNavigation } from "@/hooks/use-directional-navigation";
import { useImageFallback } from "@/hooks/use-image-fallback";
import { fetchActiveFlashSales, type ActiveFlashSale } from "@/services/flashSale";
import { CATALOG_FALLBACK_IMAGE } from "@/services/catalog";
import { calculateDiscount, formatCurrency } from "@/utils";

/**
 * Homepage Flash Sale section. Fully backend-driven: renders nothing while
 * loading, on a fetch error, or when the backend has no currently valid
 * flash sale (inactive, outside its date range, product unavailable, or an
 * invalid/inverted price) — never a placeholder product or a fabricated
 * countdown. The backend (`GET /api/flash-sale`) is the single source of
 * truth for whether a sale is currently valid; this component only renders
 * what it returns and re-derives the countdown from `endsAt` every second.
 */

const FLASH_SALE_SLIDE_INTERVAL_MS = 2000;
const SWIPE_THRESHOLD_PX = 40;

function getRemaining(endsAt: string, now: number) {
  const diff = new Date(endsAt).getTime() - now;
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor(diff / 3_600_000) % 24,
    minutes: Math.floor(diff / 60_000) % 60,
    seconds: Math.floor(diff / 1000) % 60,
  };
}

export function FlashSaleSection() {
  const { isRtl, t, language } = useLanguage();
  const { actionForKey, controlOrder } = useDirectionalNavigation();
  const prefersReducedMotion = useReducedMotion();
  const [flashSales, setFlashSales] = useState<ActiveFlashSale[] | undefined>(undefined);
  const [now, setNow] = useState(Date.now());
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchActiveFlashSales(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setFlashSales(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFlashSales([]);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const validFlashSales = useMemo(
    () => (flashSales ?? []).filter((flashSale) => getRemaining(flashSale.endsAt, now)),
    [flashSales, now],
  );

  const autoplayEnabled = !prefersReducedMotion;
  const { index, goTo, running, cycle } = useAutoRotate({
    length: validFlashSales.length,
    intervalMs: FLASH_SALE_SLIDE_INTERVAL_MS,
    enabled: autoplayEnabled,
    paused: hovered || focused,
  });

  const goToUserInitiated = (next: number) => {
    goTo(next);
    const slideNumber = (((next % validFlashSales.length) + validFlashSales.length) % validFlashSales.length) + 1;
    setAnnouncement(
      isRtl
        ? `العرض ${slideNumber} من ${validFlashSales.length}`
        : `Offer ${slideNumber} of ${validFlashSales.length}`,
    );
  };

  const goNext = () => goToUserInitiated(index + 1);
  const goPrev = () => goToUserInitiated(index - 1);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const action = actionForKey(event.key);
    if (!action) return;
    event.preventDefault();
    if (action === "next") goNext();
    else goPrev();
  };

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    if (touchStartX.current === null) return;
    const deltaX = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;
    const forward = (deltaX < 0) !== isRtl;
    if (forward) goNext();
    else goPrev();
  };

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
  };

  const flashSale = validFlashSales[index];
  const remaining = flashSale ? getRemaining(flashSale.endsAt, now) : null;

  const discountPercentage = useMemo(() => {
    if (!flashSale) return 0;
    return calculateDiscount(flashSale.product.currentPrice, flashSale.salePrice);
  }, [flashSale]);
  const featuredImage = useImageFallback(flashSale?.product.image, CATALOG_FALLBACK_IMAGE);

  // Loading, errored, absent, or just expired: render nothing. No skeleton,
  // no placeholder product, no resetting countdown.
  if (!flashSale || !remaining) return null;

  const { product } = flashSale;
  const productName = getLocalizedProductName(product, language, t);
  const tiles = [
    { value: remaining.days, label: t("flashSale.days") },
    { value: remaining.hours, label: t("flashSale.hours") },
    { value: remaining.minutes, label: t("flashSale.minutes") },
    { value: remaining.seconds, label: t("flashSale.seconds") },
  ];
  const arrowButtonClass =
    "hidden lg:inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--dental-brown)] transition hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-focus-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:bg-[image:var(--xd-gold-gradient)] dark:text-[#050505] dark:shadow-[var(--xd-gold-gradient-shadow)] dark:hover:bg-[image:var(--xd-gold-gradient-hover)]";
  const hasMultipleOffers = validFlashSales.length > 1;

  return (
    <section className="px-5 pb-4 sm:px-8 lg:px-12" aria-labelledby="home-flash-sale-title">
      <SectionReveal className="mx-auto max-w-[1344px]">
        <div
          role="region"
          aria-roledescription="carousel"
          aria-label={isRtl ? "عروض التخفيضات السريعة" : "Flash sale offers"}
          tabIndex={0}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="rounded-[24px] border border-[var(--xd-gold-border-soft)] p-5 outline-none shadow-[0_16px_42px_rgba(5,5,5,0.045)] focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-focus-ring)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--xd-bg)] sm:p-7 lg:p-8"
          style={{ background: "linear-gradient(135deg, var(--xd-gold-bg-soft) 0%, var(--xd-bg) 68%)" }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={flashSale.id}
              initial={prefersReducedMotion ? false : { opacity: 0, x: isRtl ? -18 : 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, x: isRtl ? 18 : -18 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
          {/* Header: title start, countdown end (stacks on mobile) */}
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="xd-accent-icon-surface xd-icon-card-surface flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]">
                <Zap size={19} strokeWidth={2.2} className="xd-icon-amber xd-premium-icon" />
              </span>
              <h2
                id="home-flash-sale-title"
                className="font-display text-[26px] font-semibold tracking-[-0.02em] text-[var(--xd-text)] sm:text-[30px]"
              >
                {t("flashSale.title")}
              </h2>
            </div>

            <div className="flex items-center gap-2.5" role="timer" aria-label={t("flashSale.endsIn")}>
              {tiles.map(({ value, label }) => (
                <div
                  key={label}
                  className="flex min-w-[60px] flex-col items-center rounded-[14px] border border-[var(--xd-gold-border-soft)] bg-white/80 px-3 py-2.5 dark:bg-white/5"
                >
                  <span dir="ltr" className="font-display text-[20px] font-bold leading-none text-[var(--xd-text)]">
                    {String(value).padStart(2, "0")}
                  </span>
                  <span className="mt-1 text-[11px] font-medium text-[var(--xd-muted-2)]">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Featured product: image ~1/3, content ~2/3 (stacked on mobile) */}
          <div className="mt-6 grid items-center gap-6 rounded-[20px] border border-[#050505]/[0.05] bg-white p-5 dark:border-white/[0.06] dark:bg-white/[0.03] sm:p-7 lg:grid-cols-[minmax(0,0.5fr)_minmax(0,1fr)] lg:gap-10 lg:p-9">
            <div className="flex items-center justify-center">
              <img
                src={featuredImage.src}
                onError={featuredImage.onError}
                alt={productName}
                loading="lazy"
                decoding="async"
                className="h-[220px] w-full max-w-[320px] object-contain sm:h-[260px]"
              />
            </div>

            <div className="min-w-0 text-start">
              <h3 className="font-display text-[24px] font-semibold leading-[1.15] tracking-[-0.02em] text-[var(--xd-text)] sm:text-[28px] lg:text-[32px]">
                {productName}
              </h3>
              {product.description && (
                <p className="mt-3 line-clamp-2 max-w-[640px] text-[14px] leading-[24px] text-[var(--xd-muted-2)] sm:text-[15px]">
                  {product.description}
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-baseline gap-3">
                <span className="font-display text-[24px] font-bold text-[var(--xd-gold-text)] sm:text-[26px]">
                  {formatCurrency(flashSale.salePrice)}
                </span>
                <span className="text-[16px] font-medium text-[#B3B4BD] line-through">
                  {formatCurrency(product.currentPrice)}
                </span>
                {discountPercentage > 0 && (
                  <span className="rounded-full bg-[var(--xd-gold-bg-soft)] px-2.5 py-1 text-[12px] font-bold text-[var(--xd-gold-active)]">
                    {t("flashSale.savePercentage", { values: { percentage: discountPercentage } })}
                  </span>
                )}
              </div>

              <div className="mt-6">
                <Button asChild variant="primary" className="h-[46px] w-full gap-2 rounded-full px-6 text-[14px] font-semibold sm:w-auto">
                  <Link href={`/products/${encodeURIComponent(product.slug ?? product.id)}`}>
                    {t("flashSale.viewProduct")}
                    <DirectionalIcon direction="forward" size={15} aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
            </motion.div>
          </AnimatePresence>

          <div className="relative z-10 mt-4 flex items-center justify-between gap-6">
            <SlideDots
              count={validFlashSales.length}
              activeIndex={index}
              onSelect={goToUserInitiated}
              progressKey={cycle}
              progressMs={FLASH_SALE_SLIDE_INTERVAL_MS}
              progressRunning={running}
              showProgress={autoplayEnabled && hasMultipleOffers}
              ariaLabel={isRtl ? "عروض التخفيضات السريعة" : "Flash sale offers"}
              getItemAriaLabel={(dotIndex) => isRtl
                ? `الانتقال إلى العرض ${dotIndex + 1}`
                : `Go to offer ${dotIndex + 1}`}
            />

            <div className="flex items-center gap-2.5" dir="ltr">
              {controlOrder.map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={action === "next" ? goNext : goPrev}
                  disabled={!hasMultipleOffers}
                  aria-label={
                    action === "next"
                      ? isRtl ? "العرض التالي" : "Next offer"
                      : isRtl ? "العرض السابق" : "Previous offer"
                  }
                  className={arrowButtonClass}
                >
                  <DirectionalIcon direction={action} family="chevron" size={18} strokeWidth={2} />
                </button>
              ))}
            </div>
          </div>

          <span aria-live="polite" className="sr-only">
            {announcement}
          </span>
        </div>
      </SectionReveal>
    </section>
  );
}
