import { Link } from "wouter";
import type { CSSProperties, SyntheticEvent } from "react";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { useLanguage } from "@/context/LanguageContext";
import { getHeroFallbackImageSrc } from "@/data/heroSlides";
import type { HeroSlide as HeroSlideData, LocalizedText } from "@/types/heroSlide";
import { SlideCountdown } from "./SlideCountdown";
import { resolveApiAssetUrl } from "@/services/http";

type HeroSlideProps = {
  slide: HeroSlideData;
  isActive: boolean;
  slideNumber: number;
  totalSlides: number;
  prefersReducedMotion: boolean;
};

function resolveImageSrc(src: string) {
  if (/^https?:\/\//.test(src)) return src;
  if (src.startsWith("/api/")) return resolveApiAssetUrl(src) ?? src;
  return `${import.meta.env.BASE_URL}${src.replace(/^\//, "")}`;
}

/**
 * One unified background per slide, applied to the WHOLE card (never a
 * separate block behind the text). Colors are sampled from each photo's own
 * backdrop so the image blends into the card; the image edge is additionally
 * feathered with a mask gradient, so no seam or second rectangle appears.
 */
const CARD_BACKGROUNDS: Record<string, string> = {
  "hero-brand": "linear-gradient(90deg, #f6f3f1 0%, #e8edf2 48%, #b9dcf5 100%)",
  "hero-offer": "linear-gradient(100deg, #FBF6EB 0%, #F7EFDF 52%, #EFE3CB 100%)",
  "hero-equipment": "linear-gradient(100deg, #F5F8FC 0%, #EAF1F8 52%, #DFE9F4 100%)",
};

const ARABIC_CENTER_TINT =
  "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(191,219,254,0.04) 35%, rgba(255,255,255,0.14) 48%, rgba(191,219,254,0.08) 58%, rgba(255,255,255,0.06) 72%, rgba(255,255,255,0) 100%)";

const HERO_LIGHT_SURFACE_COLORS = {
  "--hero-text": "#0F172A",
  "--hero-highlight": "#7A5600",
  "--hero-body": "#334155",
  "--hero-muted": "#475569",
  "--hero-badge-bg": "#EAF4FF",
  "--hero-badge-text": "#234B6B",
  "--hero-focus-ring": "rgba(184,138,68,0.48)",
} as CSSProperties;

/** Renders one slide with a full-bleed image behind its coded content. */
export function HeroSlide({ slide, isActive, slideNumber, totalSlides }: HeroSlideProps) {
  const { language, isRtl } = useLanguage();
  const text = (value: LocalizedText) => value[language];
  const accent = slide.accentColor ?? "var(--hero-highlight)";
  const headline = text(slide.headline);
  const highlight = slide.headlineHighlight ? text(slide.headlineHighlight) : "";
  const highlightIndex = highlight ? headline.indexOf(highlight) : -1;
  const stats = (slide.stats ?? []).slice(0, 3);
  const isBrandSlide = slide.id === "hero-brand";
  const isOfferSlide = slide.id === "hero-offer";
  const headlineMaxWidth = isBrandSlide ? 560 : isOfferSlide ? 540 : 580;
  const paragraphMaxWidth = isBrandSlide ? 520 : isOfferSlide ? 510 : 530;
  const HeadlineTag = slideNumber === 1 ? "h1" : "h2";
  const fallbackImageSrc = resolveImageSrc(getHeroFallbackImageSrc(slide));
  const handleImageError = (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    if (image.dataset.fallbackApplied !== "true" && image.currentSrc !== fallbackImageSrc) {
      image.dataset.fallbackApplied = "true";
      image.parentElement
        ?.querySelectorAll("source")
        .forEach((source) => source.remove());
      image.src = fallbackImageSrc;
      return;
    }
    image.hidden = true;
  };

  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={isRtl ? `الشريحة ${slideNumber} من ${totalSlides}` : `Slide ${slideNumber} of ${totalSlides}`}
      aria-hidden={!isActive}
      inert={!isActive}
      className={`home-hero-light-surface relative isolate col-start-1 row-start-1 overflow-hidden rounded-[24px] transition-opacity duration-[400ms] ease-out motion-reduce:transition-none ${
        isActive ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      style={{ ...HERO_LIGHT_SURFACE_COLORS, background: CARD_BACKGROUNDS[slide.id] ?? "var(--xd-bg)" }}
    >
      <div
        dir={isRtl ? "rtl" : undefined}
        className="relative z-10 flex items-stretch px-6 sm:px-8 lg:min-h-[480px] lg:px-12"
        style={isRtl ? { textAlign: "right" } : undefined}
      >
        <div
          className={`flex w-full flex-col justify-center pt-10 pb-10 sm:pt-12 sm:pb-12 lg:pt-9 lg:pb-6 transition-transform duration-[400ms] ease-out motion-reduce:transform-none motion-reduce:transition-none lg:w-[54%] ${
            isActive ? "-translate-y-4" : "translate-y-4"
          }`}
        >
          <div
            className="inline-flex items-center self-start gap-2"
            style={{ height: 36, padding: "0 16px", borderRadius: 999, background: "var(--hero-badge-bg)" }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--xd-gold-warm)" }} />
            <span className="text-[14px] font-medium" style={{ color: "var(--hero-badge-text)" }}>
              {text(slide.badgeText)}
            </span>
          </div>

          <HeadlineTag
            className="mt-4 font-display font-semibold tracking-tight"
            style={{
              fontSize: "clamp(32px, 4vw, 54px)",
              lineHeight: 1,
              letterSpacing: "-0.03em",
              color: "var(--hero-text)",
              maxWidth: headlineMaxWidth,
            }}
          >
            {highlightIndex === -1 ? (
              headline
            ) : (
              <>
                {headline.slice(0, highlightIndex)}
                <span style={{ color: accent }}>{highlight}</span>
                {headline.slice(highlightIndex + highlight.length)}
              </>
            )}
          </HeadlineTag>

          <p
            className="mt-4 text-[15px] leading-[1.45] sm:text-[16px] lg:text-[17px]"
            style={{ color: "var(--hero-body)", maxWidth: paragraphMaxWidth }}
          >
            {text(slide.subtext)}
          </p>

          {slide.countdownTo && <SlideCountdown to={slide.countdownTo} accentColor={slide.accentColor} />}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              href={slide.primaryCta.href}
              className="xd-gradient-primary-button inline-flex items-center justify-center gap-2 font-semibold outline-none hover:-translate-y-px focus-visible:-translate-y-px focus-visible:ring-2 focus-visible:ring-[var(--hero-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              style={{
                height: 46,
                padding: "0 22px",
                borderRadius: 999,
                background: "var(--xd-gold-gradient)",
                color: "var(--hero-text)",
                fontSize: 15,
                boxShadow: "var(--xd-gold-gradient-shadow)",
              }}
              data-testid={`hero-slide-${slide.id}-primary-cta`}
            >
              {text(slide.primaryCta.label)}
              <DirectionalIcon direction="forward" size={16} strokeWidth={2.25} />
            </Link>
            {slide.secondaryCta && (
              <Link
                href={slide.secondaryCta.href}
                className="inline-flex items-center justify-center border border-[rgba(15,23,42,0.28)] bg-[rgba(255,255,255,0.34)] font-semibold text-[var(--hero-text)] outline-none transition-all hover:-translate-y-px hover:border-[rgba(122,86,0,0.42)] hover:bg-[rgba(255,255,255,0.62)] focus-visible:-translate-y-px focus-visible:ring-2 focus-visible:ring-[var(--hero-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                style={{
                  height: 46,
                  padding: "0 22px",
                  borderRadius: 999,
                  fontSize: 15,
                }}
                data-testid={`hero-slide-${slide.id}-secondary-cta`}
              >
                {text(slide.secondaryCta.label)}
              </Link>
            )}
          </div>

          {stats.length > 0 && (
            <div className="mt-6 flex items-start gap-7 sm:gap-8">
              {stats.map((stat) => (
                <div key={text(stat.label)}>
                  <div
                    className="font-display font-semibold leading-[1.1]"
                    style={{
                      fontSize: "clamp(30px, 2.4vw, 34px)",
                      color: "var(--hero-text)",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {text(stat.value)}
                  </div>
                  <div className="mt-1 text-[12px] font-medium sm:text-[13px]" style={{ color: "var(--hero-muted)" }}>
                    {text(stat.label)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isRtl ? (
        /*
          Arabic uses the exact English media geometry and image fitting below.
          Logical end positioning mirrors the media window to the physical
          left in RTL; only the image pixels are horizontally flipped.
        */
        <>
          <div className="relative -mt-4 aspect-[16/9] w-full sm:-mt-6 lg:absolute lg:inset-y-0 lg:end-0 lg:mt-0 lg:aspect-auto lg:w-[58%]">
            <picture className="block h-full w-full">
              {slide.mobileImage?.src && (
                <source media="(max-width: 1023px)" srcSet={resolveImageSrc(slide.mobileImage.src)} />
              )}
              <img
                src={resolveImageSrc(slide.image.src)}
                alt={text(slide.image.alt)}
                width={1672}
                height={941}
                loading={slideNumber === 1 ? "eager" : "lazy"}
                fetchPriority={slideNumber === 1 ? "high" : undefined}
                decoding="async"
                onError={handleImageError}
                className="pointer-events-none h-full w-full select-none object-cover object-top [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,black_18%)] [mask-image:linear-gradient(to_bottom,transparent_0%,black_18%)] lg:object-[right_top] lg:[-webkit-mask-image:linear-gradient(to_right,transparent_0%,black_24%)] lg:[mask-image:linear-gradient(to_right,transparent_0%,black_24%)]"
                style={{
                  transform: "scaleX(-1)",
                  transformOrigin: "center",
                  opacity: 1,
                }}
              />
            </picture>
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{ background: ARABIC_CENTER_TINT }}
          />
        </>
      ) : (
        /*
          Media window (real <img>, no CSS background). Geometry is chosen so
          the face can NEVER be cropped vertically:
          - Desktop (lg+): an absolute window on the end side (58% wide, full
            height). The window is always "taller" relative to the 1672x941
            photo, so object-cover fills the HEIGHT exactly and only trims the
            photo's left backdrop (object-position right/top keeps the subject
            and the top of the frame).
          - Mobile/tablet: the image flows below the content at its native 16:9
            ratio, so object-cover fits it exactly with zero cropping.
          The mask gradient feathers the image edge into the card's single
          unified background — no seam, no second background block, no overlay
          rectangle behind the text.
        */
        <div className="relative -mt-4 aspect-[16/9] w-full sm:-mt-6 lg:absolute lg:inset-y-0 lg:end-0 lg:mt-0 lg:aspect-auto lg:w-[58%]">
          <picture className="block h-full w-full">
            {slide.mobileImage?.src && (
              <source media="(max-width: 1023px)" srcSet={resolveImageSrc(slide.mobileImage.src)} />
            )}
            <img
              src={resolveImageSrc(slide.image.src)}
              alt={text(slide.image.alt)}
              width={1672}
              height={941}
              loading={slideNumber === 1 ? "eager" : "lazy"}
              fetchPriority={slideNumber === 1 ? "high" : undefined}
              decoding="async"
              onError={handleImageError}
              className="pointer-events-none h-full w-full select-none object-cover object-top [-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,black_18%)] [mask-image:linear-gradient(to_bottom,transparent_0%,black_18%)] lg:object-[right_top] lg:[-webkit-mask-image:linear-gradient(to_right,transparent_0%,black_24%)] lg:[mask-image:linear-gradient(to_right,transparent_0%,black_24%)]"
            />
          </picture>
        </div>
      )}
    </div>
  );
}
