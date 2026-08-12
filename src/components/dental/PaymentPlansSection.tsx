import { useRef, useState, type KeyboardEvent } from "react";
import { useReducedMotion } from "framer-motion";
import { Clock3, ShieldCheck } from "lucide-react";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { Button } from "@/components/dental/Button";
import { SectionReveal } from "@/components/dental/SectionReveal";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useLanguage } from "@/context/LanguageContext";
import { useDirectionalNavigation } from "@/hooks/use-directional-navigation";
import { PAYMENT_PLAN_PARTNERS } from "@/data/paymentPlans";

export function PaymentPlansSection() {
  const { isRtl, t } = useLanguage();
  const { actionForKey, controlOrder } = useDirectionalNavigation();
  const prefersReducedMotion = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const scrollFrameRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollToPartner = (index: number) => {
    const normalizedIndex =
      (index + PAYMENT_PLAN_PARTNERS.length) % PAYMENT_PLAN_PARTNERS.length;

    cardRefs.current[normalizedIndex]?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "start",
    });
    setActiveIndex(normalizedIndex);
  };

  const updateActivePartner = () => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const targetEdge = isRtl ? scrollerRect.right : scrollerRect.left;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    cardRefs.current.forEach((card, index) => {
      if (!card) return;
      const cardRect = card.getBoundingClientRect();
      const cardEdge = isRtl ? cardRect.right : cardRect.left;
      const distance = Math.abs(cardEdge - targetEdge);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    setActiveIndex(closestIndex);
  };

  const handleScroll = () => {
    if (scrollFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRef.current);
    }

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      updateActivePartner();
      scrollFrameRef.current = null;
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const action = actionForKey(event.key);
    if (!action) return;
    event.preventDefault();
    scrollToPartner(activeIndex + (action === "next" ? 1 : -1));
  };

  const navigationControls = controlOrder.map((direction) => ({
    id: direction,
    delta: direction === "next" ? 1 : -1,
    label: direction === "next"
      ? t("home.paymentPlans.next")
      : t("home.paymentPlans.previous"),
    direction,
  }));

  return (
    <section
      id="payment-plans"
      className="px-5 py-20 sm:px-8 lg:px-12 lg:py-24"
      aria-labelledby="payment-plans-title"
      style={{ background: "var(--xd-bg)" }}
    >
      <SectionReveal className="mx-auto max-w-[1344px]">
        <div
          className="overflow-hidden rounded-[28px] border px-5 py-7 sm:rounded-[32px] sm:px-8 sm:py-9 lg:px-10 lg:py-10"
          onKeyDown={handleKeyDown}
          style={{
            borderColor: "var(--xd-gold-border-soft)",
            background:
              "radial-gradient(circle at 92% 0%, var(--xd-gold-bg-medium), transparent 34%), var(--xd-card-bg)",
            boxShadow: "var(--xd-shadow-card)",
          }}
        >
          <div className="mb-8 flex flex-col gap-6 lg:mb-10 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[720px]">
              <div
                className="mb-4 text-[12px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: "var(--xd-gold-text)" }}
              >
                {t("home.paymentPlans.eyebrow")}
              </div>
              <h2
                id="payment-plans-title"
                className="font-display font-semibold leading-[1.12]"
                style={{
                  color: "var(--xd-text)",
                  fontSize: "clamp(30px, 3.6vw, 46px)",
                  letterSpacing: "-0.025em",
                }}
              >
                {t("home.paymentPlans.title")}
              </h2>
              <p
                className="mt-4 max-w-[680px] text-[15px] leading-6 sm:text-[16px] sm:leading-[26px]"
                style={{ color: "var(--xd-muted-2)" }}
              >
                {t("home.paymentPlans.subtitle")}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2" dir="ltr">
              {navigationControls.map((control) => (
                <Button
                  key={control.id}
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="h-11 w-11"
                  onClick={() => scrollToPartner(activeIndex + control.delta)}
                  aria-label={control.label}
                >
                  <DirectionalIcon
                    direction={control.direction}
                    family="chevron"
                    size={20}
                  />
                </Button>
              ))}
            </div>
          </div>

          <div
            ref={scrollRef}
            dir={isRtl ? "rtl" : "ltr"}
            data-rtl-carousel="payment-plans"
            onScroll={handleScroll}
            className="-mx-1 flex snap-x snap-mandatory gap-5 overflow-x-auto px-1 pb-5 pt-1 scrollbar-hide sm:gap-6"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {PAYMENT_PLAN_PARTNERS.map((partner, index) => (
              <article
                key={partner.id}
                ref={(element) => {
                  cardRefs.current[index] = element;
                }}
                className="group flex min-h-[360px] w-[min(84vw,350px)] shrink-0 snap-start flex-col rounded-[22px] border p-5 transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-0.5 sm:min-h-[378px] sm:w-[370px] sm:rounded-[24px] sm:p-6 lg:w-[386px]"
                style={{
                  borderColor: "var(--xd-border-soft)",
                  background: "var(--xd-surface-strong)",
                  boxShadow: "0 10px 28px rgba(5,5,5,0.04)",
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div
                    className="flex h-[68px] min-w-[132px] items-center justify-center rounded-[16px] border px-5"
                    style={{
                      borderColor: "rgba(5,5,5,0.06)",
                      background: "rgba(255,255,255,0.92)",
                    }}
                  >
                    <img
                      src={`${import.meta.env.BASE_URL}${partner.logo}`}
                      alt={`${partner.name} logo`}
                      width={partner.logoWidth}
                      height={partner.logoHeight}
                      className="max-h-9 max-w-[116px] object-contain"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <span
                    className="rounded-full border px-3 py-1.5 text-[11px] font-semibold"
                    style={{
                      color: "var(--xd-gold-text)",
                      borderColor: "var(--xd-gold-border-soft)",
                      background: "var(--xd-gold-bg-soft)",
                    }}
                  >
                    {t("home.paymentPlans.status")}
                  </span>
                </div>

                <div className="mt-6 flex-1">
                  <h3
                    className="font-display text-[22px] font-semibold leading-[1.2]"
                    style={{ color: "var(--xd-text)" }}
                  >
                    {t(partner.titleKey)}
                  </h3>
                  <div
                    className="mt-4 flex w-fit items-center gap-2 rounded-full px-3 py-2 text-[12px] font-semibold"
                    style={{
                      color: "var(--xd-gold-text)",
                      background: "var(--xd-gold-bg-soft)",
                    }}
                  >
                    <Clock3 aria-hidden="true" size={14} strokeWidth={1.8} />
                    {t(partner.highlightKey)}
                  </div>
                  <p
                    className="mt-4 text-[14px] leading-[23px]"
                    style={{ color: "var(--xd-muted-2)" }}
                  >
                    {t(partner.descriptionKey)}
                  </p>
                </div>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="mt-6 w-fit gap-2 px-5"
                    >
                      {t("home.paymentPlans.cta")}
                      <DirectionalIcon direction="forward" size={16} />
                    </Button>
                  </DialogTrigger>
                  <DialogContent
                    className="w-[calc(100%_-_2rem)] max-w-[520px] rounded-[24px] border p-6 sm:p-8"
                    style={{
                      borderColor: "var(--xd-gold-border-soft)",
                      background: "var(--xd-surface-strong)",
                      boxShadow: "var(--xd-shadow-strong)",
                    }}
                  >
                    <DialogHeader className="text-start">
                      <div
                        className="mb-4 flex h-[68px] w-[142px] items-center justify-center rounded-[16px] border bg-white px-5"
                        style={{ borderColor: "rgba(5,5,5,0.07)" }}
                      >
                        <img
                          src={`${import.meta.env.BASE_URL}${partner.logo}`}
                          alt={`${partner.name} logo`}
                          width={partner.logoWidth}
                          height={partner.logoHeight}
                          className="max-h-9 max-w-[118px] object-contain"
                        />
                      </div>
                      <DialogTitle
                        className="font-display text-[26px] font-semibold leading-tight"
                        style={{ color: "var(--xd-text)" }}
                      >
                        {t(partner.titleKey)}
                      </DialogTitle>
                      <DialogDescription
                        className="pt-2 text-[14px] leading-6"
                        style={{ color: "var(--xd-muted-2)" }}
                      >
                        {t(partner.descriptionKey)}
                      </DialogDescription>
                    </DialogHeader>

                    <div
                      className="mt-2 flex items-start gap-3 rounded-[16px] border p-4"
                      style={{
                        borderColor: "var(--xd-gold-border-soft)",
                        background: "var(--xd-gold-bg-soft)",
                      }}
                    >
                      <ShieldCheck
                        aria-hidden="true"
                        className="mt-0.5 shrink-0"
                        size={19}
                        strokeWidth={1.7}
                        style={{ color: "var(--xd-gold-text)" }}
                      />
                      <p
                        className="text-[13px] leading-[21px]"
                        style={{ color: "var(--xd-text-muted)" }}
                      >
                        {t("home.paymentPlans.detailsNote")}
                      </p>
                    </div>

                    <DialogFooter className="mt-2 sm:justify-start">
                      <DialogClose asChild>
                        <Button type="button" variant="primary" size="sm">
                          {t("common.close")}
                        </Button>
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </article>
            ))}
          </div>

          <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div
              className="flex items-start gap-2.5 text-[12px] leading-5 sm:max-w-[760px]"
              style={{ color: "var(--xd-muted-2)" }}
            >
              <ShieldCheck
                aria-hidden="true"
                className="mt-0.5 shrink-0"
                size={16}
                strokeWidth={1.7}
                style={{ color: "var(--xd-gold-text)" }}
              />
              <span>{t("home.paymentPlans.checkoutNote")}</span>
            </div>

            <div
              className="flex items-center gap-2"
              role="group"
              aria-label={t("home.paymentPlans.pagination")}
            >
              {PAYMENT_PLAN_PARTNERS.map((partner, index) => (
                <button
                  key={partner.id}
                  type="button"
                  onClick={() => scrollToPartner(index)}
                  className="h-2 rounded-full transition-[width,background-color] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-focus-ring)] focus-visible:ring-offset-2"
                  style={{
                    width: activeIndex === index ? 30 : 8,
                    background:
                      activeIndex === index
                        ? "var(--xd-gold-gradient)"
                        : "var(--xd-border-strong)",
                  }}
                  aria-label={`${t("home.paymentPlans.goTo")} ${index + 1}`}
                  aria-current={activeIndex === index ? "true" : undefined}
                />
              ))}
            </div>
          </div>
        </div>
      </SectionReveal>
    </section>
  );
}
