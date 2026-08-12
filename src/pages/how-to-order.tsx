import { Link } from "wouter";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { Button } from "@/components/dental/Button";
import { SectionReveal } from "@/components/dental/SectionReveal";
import { SEO } from "@/components/SEO";
import { useLanguage } from "@/context/LanguageContext";

const quickSteps = [
  "browse",
  "cartQuote",
  "paymentDelivery",
  "receive",
] as const;

const orderSteps = [
  {
    number: "01",
    id: "browseProducts",
  },
  {
    number: "02",
    id: "productDetails",
  },
  {
    number: "03",
    id: "cartOrQuote",
  },
  {
    number: "04",
    id: "account",
  },
  {
    number: "05",
    id: "payment",
  },
  {
    number: "06",
    id: "deliveryDetails",
  },
  {
    number: "07",
    id: "confirmation",
  },
  {
    number: "08",
    id: "tracking",
  },
] as const;

export default function HowToOrder() {
  const { isRtl, t } = useLanguage();

  return (
    <main
      dir={isRtl ? "rtl" : "ltr"}
      className="min-h-screen overflow-x-hidden bg-[var(--xd-bg)] text-[var(--xd-text)]"
    >
      <SEO
        page="howToOrder"
        title={t("howToOrderPage.seoTitle")}
        titleFormat="exact"
        description={t("howToOrderPage.seoDescription")}
      />

      <section className="px-5 pb-16 pt-14 sm:px-8 sm:pt-16 lg:px-12 lg:pb-24 lg:pt-20">
        <div className="mx-auto max-w-[1344px]">
          <SectionReveal className="flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between sm:gap-10">
            <div className="max-w-[660px]">
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--xd-gold-text)]">
                {t("howToOrderPage.eyebrow")}
              </p>
              <h1 className="mt-4 font-display text-[38px] font-semibold leading-[1.06] tracking-[-0.035em] text-[#050505] sm:text-[48px] lg:text-[56px]">
                {t("howToOrderPage.title")}
              </h1>
              <p className="mt-4 text-[15px] leading-[26px] text-[var(--xd-muted-2)] sm:text-[16px]">
                {t("howToOrderPage.description")}
              </p>
            </div>

            <Button asChild variant="primary" size="sm" className="w-fit shrink-0 gap-2 px-5 text-[13px]">
              <Link href="/contact">
                {t("howToOrderPage.supportCta")}
                <DirectionalIcon size={15} aria-hidden="true" />
              </Link>
            </Button>
          </SectionReveal>

          <SectionReveal
            delay={0.06}
            className="mt-10 grid gap-4 rounded-[24px] border border-[#050505]/10 bg-white/80 p-6 shadow-[0_10px_30px_rgba(5,5,5,0.03)] sm:grid-cols-2 lg:grid-cols-4 lg:p-8"
          >
            {quickSteps.map((stepId) => (
              <div key={stepId} className="rounded-[18px] border border-[#050505]/[0.06] bg-[var(--xd-bg)]/70 p-4">
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--xd-gold-text)]">
                  {t(`howToOrderPage.quickSteps.${stepId}.title`)}
                </p>
                <p className="mt-2 text-[14px] leading-[23px] text-[var(--xd-muted-2)]">
                  {t(`howToOrderPage.quickSteps.${stepId}.description`)}
                </p>
              </div>
            ))}
          </SectionReveal>

          <SectionReveal
            delay={0.08}
            className="mt-12 grid gap-8 border-t border-[#050505]/10 pt-12 lg:grid-cols-2"
          >
            {orderSteps.map((step) => (
              <article key={step.number} className="rounded-[20px] border border-[#050505]/[0.06] bg-white/80 p-6 shadow-[0_10px_24px_rgba(5,5,5,0.03)] sm:p-7">
                <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--xd-gold-text)]">
                  {step.number}
                </p>
                <h2 className="mt-3 text-[22px] font-semibold leading-[1.25] text-[#050505] sm:text-[24px]">
                  {t(`howToOrderPage.orderSteps.${step.id}.title`)}
                </h2>
                <p className="mt-3 text-[14px] leading-[24px] text-[var(--xd-muted-2)] sm:text-[15px]">
                  {t(`howToOrderPage.orderSteps.${step.id}.description`)}
                </p>
              </article>
            ))}
          </SectionReveal>

          <SectionReveal className="mt-16 flex flex-col items-start justify-between gap-7 rounded-[24px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] px-6 py-9 sm:px-9 lg:flex-row lg:items-center lg:px-12 lg:py-11">
            <div className="max-w-[650px]">
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--xd-gold-text)]">
                {t("howToOrderPage.help.eyebrow")}
              </p>
              <h2 className="mt-2 font-display text-[30px] font-semibold tracking-[-0.025em] text-[#050505] sm:text-[36px]">
                {t("howToOrderPage.help.title")}
              </h2>
              <p className="mt-3 text-[14px] leading-[23px] text-[var(--xd-muted-2)]">
                {t("howToOrderPage.help.description")}
              </p>
            </div>
            <Button asChild variant="primary" className="shrink-0 gap-2 px-6 text-[14px]">
              <Link href="/contact">
                {t("howToOrderPage.supportCta")}
                <DirectionalIcon size={16} aria-hidden="true" />
              </Link>
            </Button>
          </SectionReveal>
        </div>
      </section>
    </main>
  );
}
