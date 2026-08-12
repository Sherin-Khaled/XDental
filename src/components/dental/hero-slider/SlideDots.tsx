import { useLanguage } from "@/context/LanguageContext";

type SlideDotsProps = {
  count: number;
  activeIndex: number;
  onSelect: (index: number) => void;
  /** Changes whenever the autoplay timer restarts, so the fill re-syncs. */
  progressKey: number;
  progressMs: number;
  /** Whether autoplay is currently counting down (animates the fill). */
  progressRunning: boolean;
  /** Disables the fill animation entirely (reduced motion / no autoplay). */
  showProgress: boolean;
  /** Optional labels when the shared dots are used outside the hero. */
  ariaLabel?: string;
  getItemAriaLabel?: (index: number) => string;
};

/** Dot indicators; the active dot elongates into a pill whose fill shows the
 *  time remaining until the next slide. */
export function SlideDots({
  count,
  activeIndex,
  onSelect,
  progressKey,
  progressMs,
  progressRunning,
  showProgress,
  ariaLabel,
  getItemAriaLabel,
}: SlideDotsProps) {
  const { isRtl } = useLanguage();

  return (
    <div className="flex items-center gap-2.5" role="tablist" aria-label={ariaLabel ?? (isRtl ? "شرائح العرض" : "Hero slides")}>
      {Array.from({ length: count }, (_, index) => {
        const isActive = index === activeIndex;
        return (
          <button
            key={index}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={getItemAriaLabel?.(index) ?? (isRtl ? `الانتقال إلى الشريحة ${index + 1}` : `Go to slide ${index + 1}`)}
            onClick={() => onSelect(index)}
            className={`relative h-2.5 overflow-hidden rounded-full transition-[width,background-color] duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-focus-ring)] focus-visible:ring-offset-2 motion-reduce:transition-none ${
              isActive ? "w-9 bg-[#3A2600]/12 dark:bg-[#F2D24B]/18" : "w-2.5 bg-[#3A2600]/18 hover:bg-[#3A2600]/34 dark:bg-[#F2D24B]/24 dark:hover:bg-[#F2D24B]/42"
            }`}
          >
            {isActive && (
              <span
                key={showProgress ? progressKey : "static"}
                aria-hidden="true"
                className="absolute inset-y-0 start-0 rounded-full"
                style={{
                  background: "var(--xd-gold-gradient)",
                  width: showProgress ? undefined : "100%",
                  animation: showProgress ? `hero-dot-progress ${progressMs}ms linear forwards` : undefined,
                  animationPlayState: showProgress && !progressRunning ? "paused" : undefined,
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
