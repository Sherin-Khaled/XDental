import { useCallback, useEffect, useState, type FocusEvent } from "react";
import { useReducedMotion } from "framer-motion";
import type { CarouselApi } from "@/components/ui/carousel";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { SectionReveal } from "@/components/dental/SectionReveal";
import { useLanguage } from "@/context/LanguageContext";
import { useDirectionalNavigation } from "@/hooks/use-directional-navigation";
import { PROMOTIONAL_FLYERS } from "@/data/promotionalFlyers";

const AUTOPLAY_INTERVAL_MS = 2000;

export function PromotionalFlyerCarousel() {
  const { language, isRtl, t } = useLanguage();
  const { controlOrder } = useDirectionalNavigation();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const flyers = PROMOTIONAL_FLYERS[language];
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState === "visible"
  );

  const updateActiveIndex = useCallback((api: CarouselApi) => {
    if (!api) return;
    setActiveIndex(api.selectedScrollSnap());
  }, []);

  useEffect(() => {
    if (!carouselApi) return;

    updateActiveIndex(carouselApi);
    carouselApi.on("select", updateActiveIndex);
    carouselApi.on("reInit", updateActiveIndex);

    return () => {
      carouselApi.off("select", updateActiveIndex);
      carouselApi.off("reInit", updateActiveIndex);
    };
  }, [carouselApi, updateActiveIndex]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsDocumentVisible(document.visibilityState === "visible");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
    carouselApi?.scrollTo(0, true);
  }, [carouselApi, language]);

  useEffect(() => {
    if (
      !carouselApi ||
      flyers.length < 2 ||
      prefersReducedMotion ||
      isHovered ||
      isFocused ||
      !isDocumentVisible
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      carouselApi.scrollNext();
    }, AUTOPLAY_INTERVAL_MS);

    return () => window.clearTimeout(timer);
  }, [
    activeIndex,
    carouselApi,
    flyers.length,
    isDocumentVisible,
    isFocused,
    isHovered,
    prefersReducedMotion,
  ]);

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsFocused(false);
    }
  };

  const goToSlide = (index: number) => {
    carouselApi?.scrollTo(index, prefersReducedMotion);
  };

  const goToPreviousSlide = () => {
    carouselApi?.scrollPrev(prefersReducedMotion);
  };

  const goToNextSlide = () => {
    carouselApi?.scrollNext(prefersReducedMotion);
  };

  const arrowButtonClass =
    "hidden h-11 w-11 items-center justify-center rounded-full border border-[var(--xd-border-soft)] bg-[var(--xd-surface)] text-[var(--dental-brown)] shadow-[0_6px_18px_rgba(5,5,5,0.05)] transition-[transform,background-color,border-color,box-shadow] hover:-translate-y-px hover:border-[var(--xd-gold-border-hover)] hover:bg-[var(--xd-gold-bg-soft)] hover:shadow-[0_10px_24px_rgba(5,5,5,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--xd-bg)] sm:inline-flex motion-reduce:transition-none motion-reduce:hover:translate-y-0";

  return (
    <section
      id="promotional-flyers"
      className="px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12"
      aria-label={t("home.promotionalFlyers.ariaLabel")}
    >
      <SectionReveal className="mx-auto max-w-[1080px]">
        <Carousel
          key={language}
          setApi={setCarouselApi}
          opts={{
            align: "start",
            direction: isRtl ? "rtl" : "ltr",
            duration: prefersReducedMotion ? 0 : 28,
            loop: true,
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onFocusCapture={() => setIsFocused(true)}
          onBlurCapture={handleBlur}
          data-rtl-carousel="promotional-flyers"
          className="outline-none focus-within:ring-2 focus-within:ring-[var(--xd-gold-focus-ring)] focus-within:ring-offset-4 focus-within:ring-offset-[var(--xd-bg)]"
        >
          <div
            className="relative overflow-hidden rounded-[20px] border sm:rounded-[22px] lg:rounded-[24px]"
            style={{
              borderColor: "var(--xd-gold-border-soft)",
              background: "var(--xd-surface-strong)",
              boxShadow: "var(--xd-shadow-card)",
            }}
          >
            <CarouselContent className="ml-0">
              {flyers.map((flyer, index) => (
                <CarouselItem
                  key={flyer.id}
                  className="p-0"
                  aria-label={t("home.promotionalFlyers.slideLabel", {
                    values: { current: index + 1, total: flyers.length },
                  })}
                >
                  <div
                    className="relative w-full overflow-hidden"
                    style={{ aspectRatio: `${flyer.width} / ${flyer.height}` }}
                  >
                    <img
                      src={`${import.meta.env.BASE_URL}${flyer.src}`}
                      alt={flyer.alt}
                      width={flyer.width}
                      height={flyer.height}
                      loading={index === 0 ? "eager" : "lazy"}
                      fetchPriority={index === 0 ? "high" : "auto"}
                      decoding="async"
                      draggable={false}
                      className="absolute inset-0 h-full w-full select-none object-contain"
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </div>

          {flyers.length > 1 && (
            <div className="mt-5 flex items-center justify-center sm:justify-between">
              <div
                className="flex items-center gap-2.5"
                role="tablist"
                aria-label={t("home.promotionalFlyers.dotsLabel")}
              >
                {flyers.map((flyer, index) => {
                  const isActive = activeIndex === index;

                  return (
                    <button
                      key={flyer.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-label={t("home.promotionalFlyers.goToSlide", {
                        values: { number: index + 1 },
                      })}
                      onClick={() => goToSlide(index)}
                      className="h-2.5 rounded-full transition-[width,background-color] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-focus-ring)] focus-visible:ring-offset-2 motion-reduce:transition-none"
                      style={{
                        width: isActive ? 36 : 10,
                        background: isActive
                          ? "var(--xd-gold-gradient)"
                          : "rgba(5,5,5,0.18)",
                      }}
                    />
                  );
                })}
              </div>

              <div
                className="hidden items-center gap-2.5 sm:flex"
                dir="ltr"
                role="group"
                aria-label={t("home.promotionalFlyers.dotsLabel")}
              >
                {controlOrder.map((action) => (
                  <button
                    key={action}
                    type="button"
                    onClick={action === "next" ? goToNextSlide : goToPreviousSlide}
                    aria-label={
                      action === "next"
                        ? t("home.promotionalFlyers.next")
                        : t("home.promotionalFlyers.previous")
                    }
                    className={arrowButtonClass}
                    data-testid={`promotional-flyer-${action}`}
                  >
                    <DirectionalIcon direction={action} family="chevron" size={18} strokeWidth={2} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </Carousel>
      </SectionReveal>
    </section>
  );
}
