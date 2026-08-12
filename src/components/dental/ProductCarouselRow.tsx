import React, { useEffect, useRef } from "react";
import { Link } from "wouter";
import { useReducedMotion } from "framer-motion";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { Button } from "@/components/dental/Button";
import { ProductCard } from "./ProductCard";
import { useLanguage } from "@/context/LanguageContext";
import {
  useDirectionalNavigation,
  type HorizontalNavigationAction,
} from "@/hooks/use-directional-navigation";
import type { Product } from "@/types/product";

type RtlScrollModel = "negative" | "reverse" | "default";

let detectedRtlScrollModel: RtlScrollModel | null = null;

function getRtlScrollModel(): RtlScrollModel {
  if (typeof document === "undefined" || !document.body) return "negative";
  if (detectedRtlScrollModel) return detectedRtlScrollModel;

  const container = document.createElement("div");
  const content = document.createElement("div");

  container.dir = "rtl";
  container.style.cssText =
    "position:absolute;top:-9999px;width:4px;height:1px;overflow:scroll;visibility:hidden;";
  content.style.width = "8px";
  content.style.height = "1px";
  container.appendChild(content);
  document.body.appendChild(container);

  if (container.scrollLeft > 0) {
    detectedRtlScrollModel = "default";
  } else {
    container.scrollLeft = 1;
    detectedRtlScrollModel = container.scrollLeft === 0 ? "negative" : "reverse";
  }

  document.body.removeChild(container);
  return detectedRtlScrollModel;
}

function getMaxScrollLeft(element: HTMLDivElement) {
  return Math.max(0, element.scrollWidth - element.clientWidth);
}

function getLogicalScrollLeft(element: HTMLDivElement, isRtl: boolean) {
  if (!isRtl) return element.scrollLeft;

  const maxScrollLeft = getMaxScrollLeft(element);

  switch (getRtlScrollModel()) {
    case "default":
      return maxScrollLeft - element.scrollLeft;
    case "reverse":
      return element.scrollLeft;
    case "negative":
    default:
      return -element.scrollLeft;
  }
}

function scrollToLogicalLeft(
  element: HTMLDivElement,
  logicalLeft: number,
  isRtl: boolean,
  behavior: ScrollBehavior = "smooth"
) {
  const maxScrollLeft = getMaxScrollLeft(element);
  const clampedLeft = Math.max(0, Math.min(logicalLeft, maxScrollLeft));

  if (!isRtl) {
    element.scrollTo({ left: clampedLeft, behavior });
    return;
  }

  switch (getRtlScrollModel()) {
    case "default":
      element.scrollTo({ left: maxScrollLeft - clampedLeft, behavior });
      return;
    case "reverse":
      element.scrollTo({ left: clampedLeft, behavior });
      return;
    case "negative":
    default:
      element.scrollTo({ left: -clampedLeft, behavior });
  }
}

interface ProductCarouselRowProps {
  title: string;
  viewAllLink?: string;
  products: Product[];
  autoSlide?: boolean;
  autoSlideIntervalMs?: number;
}

export function ProductCarouselRow({
  title,
  viewAllLink,
  products,
  autoSlide = false,
  autoSlideIntervalMs = 3000,
}: ProductCarouselRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { isRtl, t } = useLanguage();
  const { controlOrder } = useDirectionalNavigation();
  const prefersReducedMotion = useReducedMotion();

  const getScrollAmount = () => {
    const current = scrollRef.current;
    const firstCard = current?.firstElementChild as HTMLElement | null;

    if (!current || !firstCard) return 344;

    const styles = window.getComputedStyle(current);
    const gap = Number.parseFloat(styles.columnGap || styles.gap || "24") || 24;

    return firstCard.getBoundingClientRect().width + gap;
  };

  const scroll = (action: HorizontalNavigationAction) => {
    if (scrollRef.current) {
      const { current } = scrollRef;
      const nextLeft =
        getLogicalScrollLeft(current, isRtl) +
        (action === "next" ? 1 : -1) * getScrollAmount();

      scrollToLogicalLeft(current, nextLeft, isRtl, prefersReducedMotion ? "auto" : "smooth");
    }
  };

  useEffect(() => {
    const current = scrollRef.current;
    if (!current) return;

    scrollToLogicalLeft(current, 0, isRtl, "auto");
  }, [isRtl, products.length]);

  useEffect(() => {
    if (!autoSlide || prefersReducedMotion || products.length <= 1) return;

    const interval = window.setInterval(() => {
      const current = scrollRef.current;
      if (!current) return;

      const maxScrollLeft = current.scrollWidth - current.clientWidth;
      if (maxScrollLeft <= 0) return;

      const nextLeft = getLogicalScrollLeft(current, isRtl) + getScrollAmount();

      scrollToLogicalLeft(current, nextLeft >= maxScrollLeft - 8 ? 0 : nextLeft, isRtl);
    }, autoSlideIntervalMs);

    return () => window.clearInterval(interval);
  }, [autoSlide, autoSlideIntervalMs, isRtl, prefersReducedMotion, products.length]);

  if (!products?.length) return null;

  return (
    <div className="w-full">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="font-display text-2xl font-bold text-[#050505] sm:text-3xl">{title}</h2>
        
        <div className="flex shrink-0 items-center gap-4">
          {viewAllLink && (
            <Button
              asChild
              variant="tertiary"
              size="sm"
              className="hidden h-auto px-0 py-0 text-sm text-[var(--xd-gold-text)] hover:bg-transparent hover:text-[#050505] sm:inline-flex"
            >
              <Link href={viewAllLink}>{t("common.viewAll")}</Link>
            </Button>
          )}
          <div className="flex items-center gap-2" dir="ltr">
            {controlOrder.map((action) => (
              <Button
                key={action}
                type="button"
                onClick={() => scroll(action)}
                variant="secondary"
                size="icon"
                className="h-10 w-10"
                aria-label={
                  action === "next"
                    ? t("common.nextProducts", { fallback: "Next products" })
                    : t("common.previousProducts", { fallback: "Previous products" })
                }
              >
                <DirectionalIcon
                  direction={action}
                  family="chevron"
                  size={20}
                />
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div 
        ref={scrollRef}
        data-rtl-carousel="product-row"
        dir={isRtl ? "rtl" : "ltr"}
        className="flex gap-6 overflow-x-auto snap-x snap-mandatory scrollbar-hide px-1 pb-10 pt-3 -mb-10 -mt-3"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {products.map((product) => (
          <div key={product.id} className="w-[min(280px,calc(100vw-3rem))] shrink-0 snap-start overflow-visible sm:w-[320px]">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </div>
  );
}
