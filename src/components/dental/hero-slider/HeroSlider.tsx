import { useRef, useState, type FocusEvent, type KeyboardEvent, type TouchEvent } from "react";
import { useReducedMotion } from "framer-motion";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { useLanguage } from "@/context/LanguageContext";
import { useDirectionalNavigation } from "@/hooks/use-directional-navigation";
import type { HeroSlide as HeroSlideData } from "@/types/heroSlide";
import { HeroSlide } from "./HeroSlide";
import { SlideDots } from "./SlideDots";
import { useAutoRotate } from "./useAutoRotate";

const ROTATE_INTERVAL_MS = 3000;
const SWIPE_THRESHOLD_PX = 40;

/**
 * Auto-rotating hero carousel. Purely data-driven: pass the slides (already
 * filtered/sorted by the data layer) and it renders them into the shared
 * hero skeleton. Slides are stacked in one grid cell so the hero always
 * reserves the height of the tallest slide — no layout shift on rotation.
 */
export function HeroSlider({ slides }: { slides: HeroSlideData[] }) {
  const { isRtl } = useLanguage();
  const { actionForKey, controlOrder } = useDirectionalNavigation();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const touchStartX = useRef<number | null>(null);

  const autoplayEnabled = !prefersReducedMotion;
  const { index, goTo, running, cycle } = useAutoRotate({
    length: slides.length,
    intervalMs: ROTATE_INTERVAL_MS,
    enabled: autoplayEnabled,
    paused: hovered || focused,
  });

  if (slides.length === 0) return null;

  // Announce slide changes politely — only when the user triggered them.
  const goToUserInitiated = (next: number) => {
    goTo(next);
    const slideNumber = (((next % slides.length) + slides.length) % slides.length) + 1;
    setAnnouncement(
      isRtl
        ? `الشريحة ${slideNumber} من ${slides.length}`
        : `Slide ${slideNumber} of ${slides.length}`
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
    // Swiping toward the start of reading order advances; mirrored in RTL.
    const forward = (deltaX < 0) !== isRtl;
    if (forward) goNext();
    else goPrev();
  };

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
  };

  const arrowButtonClass =
    "hidden lg:inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--dental-brown)] transition hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-focus-ring)] focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:bg-[image:var(--xd-gold-gradient)] dark:text-[#050505] dark:shadow-[var(--xd-gold-gradient-shadow)] dark:hover:bg-[image:var(--xd-gold-gradient-hover)]";

  return (
    <section
      role="region"
      aria-roledescription="carousel"
      aria-label={isRtl ? "أبرز عروض المتجر" : "Store highlights"}
      tabIndex={0}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="relative overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-focus-ring)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--xd-bg)] rounded-[24px]"
    >
      {/* Slides stacked in one grid cell: the tallest one sets the height. */}
      <div className="grid">
        {slides.map((slide, slideIndex) => (
          <HeroSlide
            key={slide.id}
            slide={slide}
            isActive={slideIndex === index}
            slideNumber={slideIndex + 1}
            totalSlides={slides.length}
            prefersReducedMotion={prefersReducedMotion}
          />
        ))}
      </div>

      {/* Controls: dots aligned with the text column, arrows on the end side */}
      {slides.length > 1 && (
        <div className="relative z-10 mt-6 flex items-center justify-between gap-6">
          <SlideDots
            count={slides.length}
            activeIndex={index}
            onSelect={goToUserInitiated}
            progressKey={cycle}
            progressMs={ROTATE_INTERVAL_MS}
            progressRunning={running}
            showProgress={autoplayEnabled}
          />
          <div className="flex items-center gap-2.5" dir="ltr">
            {controlOrder.map((action) => (
              <button
                key={action}
                type="button"
                onClick={action === "next" ? goNext : goPrev}
                aria-label={
                  action === "next"
                    ? isRtl ? "الشريحة التالية" : "Next slide"
                    : isRtl ? "الشريحة السابقة" : "Previous slide"
                }
                className={arrowButtonClass}
              >
                <DirectionalIcon direction={action} family="chevron" size={18} strokeWidth={2} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Polite announcements for user-initiated slide changes only */}
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </section>
  );
}
