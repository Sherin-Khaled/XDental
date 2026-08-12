import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
  ClipboardCheck,
  MessageCircle,
  PackageCheck,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { Link } from "wouter";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { Button } from "@/components/dental/Button";
import { SectionReveal } from "@/components/dental/SectionReveal";
import { SEO } from "@/components/SEO";
import { useLanguage } from "@/context/LanguageContext";

type ReturnsSection = {
  id: string;
  paragraphs: string[];
  bullets?: string[];
};

type ReturnsStep = {
  id: string;
  Icon: LucideIcon;
};

const RETURN_STEPS: ReturnsStep[] = [
  {
    id: "contactSupport",
    Icon: MessageCircle,
  },
  {
    id: "reviewEligibility",
    Icon: ClipboardCheck,
  },
  {
    id: "confirmResolution",
    Icon: PackageCheck,
  },
];

const RETURNS_SECTIONS: ReturnsSection[] = [
  { id: "requests", paragraphs: ["paragraph1"] },
  { id: "period", paragraphs: ["paragraph1"] },
  { id: "conditions", paragraphs: ["paragraph1", "paragraph2"] },
  { id: "nonReturnable", paragraphs: ["paragraph1"], bullets: ["bullet1", "bullet2", "bullet3", "bullet4", "bullet5", "bullet6", "bullet7", "bullet8"] },
  { id: "orderIssues", paragraphs: ["paragraph1"] },
  { id: "refunds", paragraphs: ["paragraph1", "paragraph2"] },
  { id: "exchanges", paragraphs: ["paragraph1"] },
  { id: "shippingFees", paragraphs: ["paragraph1", "paragraph2"] },
  { id: "specialOrders", paragraphs: ["paragraph1", "paragraph2"] },
  { id: "updates", paragraphs: ["paragraph1"] },
];

export default function ReturnsPolicy() {
  const { isRtl, t } = useLanguage();
  return (
    <main dir={isRtl ? "rtl" : "ltr"} className="box-border min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[var(--xd-bg)] text-[var(--xd-text)]">
      <SEO
        page="returnsPolicy"
        title={t("returnsPolicyPage.seoTitle")}
        titleFormat="exact"
        description={t("returnsPolicyPage.seoDescription")}
      />

      <section className="box-border w-full max-w-[100vw] px-5 pb-16 pt-14 sm:px-8 sm:pt-16 lg:px-12 lg:pb-24 lg:pt-20">
        <div className="mx-auto w-full max-w-[1344px]">
          <SectionReveal className="border-b border-[#050505]/10 pb-10 lg:pb-12">
            <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 max-w-[780px]">
                <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--xd-gold-text)]">
                  {t("returnsPolicyPage.eyebrow")}
                </p>
                <h1 className="mt-4 font-display text-[40px] font-semibold leading-[1.04] tracking-[-0.035em] sm:text-[52px] lg:text-[64px]">
                  {t("returnsPolicyPage.title")}
                </h1>
                <p className="mt-5 max-w-[680px] text-[15px] leading-[26px] text-[var(--xd-muted-2)] sm:text-[16px]">
                  {t("returnsPolicyPage.description")}
                </p>
              </div>

              <Button asChild variant="primary" size="sm" className="w-fit shrink-0 gap-2 px-5 text-[13px]">
                <Link href="/contact">
                  {t("returnsPolicyPage.contactSupport")}
                  <DirectionalIcon size={15} aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </SectionReveal>

          <SectionReveal delay={0.05} className="border-b border-[#050505]/10 py-12 lg:py-14">
            <div className="grid gap-5 md:grid-cols-3">
              {RETURN_STEPS.map(({ id, Icon }, index) => (
                <article key={id} className="rounded-[22px] border border-[var(--xd-gold-border-soft)] bg-white/70 p-6 shadow-[0_12px_34px_rgba(5,5,5,0.04)]">
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-text)]">
                      <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
                    </span>
                    <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--xd-gold-text)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h2 className="mt-5 font-display text-[22px] font-semibold leading-[1.24] tracking-[-0.02em]">
                    {t(`returnsPolicyPage.steps.${id}.title`)}
                  </h2>
                  <p className="mt-3 text-[14px] leading-[24px] text-[var(--xd-muted-2)]">
                    {t(`returnsPolicyPage.steps.${id}.description`)}
                  </p>
                </article>
              ))}
            </div>
          </SectionReveal>

          <div className="grid gap-12 pt-12 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-16 lg:pt-14">
            <div className="space-y-12">
              {RETURNS_SECTIONS.map((section, index) => (
                <section key={section.id} className="grid min-w-0 gap-4 border-b border-[#050505]/[0.07] pb-10 last:border-b-0 last:pb-0 sm:grid-cols-[72px_minmax(0,1fr)] sm:gap-8">
                  <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--xd-gold-text)]">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-display text-[22px] font-semibold leading-[1.22] tracking-[-0.02em] text-[var(--xd-text)] sm:text-[26px]">
                      {t(`returnsPolicyPage.sections.${section.id}.title`)}
                    </h2>
                    <div className="mt-4 space-y-4">
                      {section.paragraphs.map((paragraphKey) => (
                        <p key={paragraphKey} className="max-w-[860px] break-words text-[15px] leading-[27px] text-[var(--xd-muted-2)]">
                          {t(`returnsPolicyPage.sections.${section.id}.${paragraphKey}`)}
                        </p>
                      ))}
                    </div>
                    {section.bullets && (
                      <ul className="mt-5 grid gap-3">
                        {section.bullets.map((bulletKey) => (
                          <li key={bulletKey} className="flex max-w-[860px] items-start gap-3 text-[14px] leading-[24px] text-[var(--xd-muted-2)]">
                            <CheckCircle2 className="mt-0.5 shrink-0 text-[var(--xd-gold-text)]" size={17} strokeWidth={2} aria-hidden="true" />
                            <span>{t(`returnsPolicyPage.sections.${section.id}.${bulletKey}`)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>
              ))}
            </div>

            <aside className="lg:sticky lg:top-32 lg:h-fit">
              <SectionReveal delay={0.1} className="border-s-2 border-[var(--xd-gold)] ps-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-text)]">
                  <ShieldCheck size={19} strokeWidth={1.9} aria-hidden="true" />
                </span>
                <p className="mt-5 text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--xd-gold-text)]">
                  {t("returnsPolicyPage.sidebar.title")}
                </p>
                <p className="mt-3 text-[14px] leading-[24px] text-[var(--xd-muted-2)]">
                  {t("returnsPolicyPage.sidebar.description")}
                </p>
                <div className="mt-5 flex items-start gap-3 text-[14px] leading-[24px] text-[var(--xd-muted-2)]">
                  <RefreshCcw className="mt-0.5 shrink-0 text-[var(--xd-gold-text)]" size={17} strokeWidth={2} aria-hidden="true" />
                  <span>{t("returnsPolicyPage.sidebar.notice")}</span>
                </div>
                <Button asChild variant="primary" size="sm" className="mt-6 w-fit gap-2 px-5 text-[13px]">
                  <Link href="/contact">
                    {t("returnsPolicyPage.contactSupport")}
                    <DirectionalIcon size={15} aria-hidden="true" />
                  </Link>
                </Button>
              </SectionReveal>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
