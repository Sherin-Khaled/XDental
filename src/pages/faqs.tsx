import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  ClipboardCheck,
  ClipboardList,
  FileText,
  HelpCircle,
  Inbox,
  MessageCircle,
  PackageSearch,
  PackageX,
  Repeat,
  ShoppingCart,
  UserRound,
} from "lucide-react";
import { Link } from "wouter";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { Button } from "@/components/dental/Button";
import { SectionReveal } from "@/components/dental/SectionReveal";
import { SEO } from "@/components/SEO";
import { useLanguage } from "@/context/LanguageContext";
import { FAQS, type FaqItem } from "@/data/faqs";

// Help-center icon per FAQ id; falls back to HelpCircle for any future item.
const FAQ_ICON_BY_ID: Record<string, LucideIcon> = {
  quoteBeforeOrdering: FileText,
  saveRepeatedLists: Repeat,
  unlistedProduct: PackageSearch,
  orderVsQuote: ArrowLeftRight,
  trackQuotes: ClipboardCheck,
  whatIsSupplyList: ClipboardList,
  cartToSupplyList: ShoppingCart,
  unavailableProduct: PackageX,
  requestsInAccount: Inbox,
  accountRequired: UserRound,
  contactSupport: MessageCircle,
};

export default function Faqs() {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--xd-bg)] text-[var(--xd-text)]">
      <SEO page="faqs" />

      <section className="px-5 pb-16 pt-14 sm:px-8 sm:pt-16 lg:px-12 lg:pb-24 lg:pt-20">
        <div className="mx-auto max-w-[1344px]">
          <SectionReveal className="flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between sm:gap-10">
            <div className="max-w-[620px]">
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--xd-gold-text)]">
                {t("faqsPage.eyebrow")}
              </p>
              <h1 className="mt-4 font-display text-[38px] font-semibold leading-[1.06] tracking-[-0.035em] sm:text-[48px] lg:text-[56px]">
                {t("faqsPage.heroTitle")}
              </h1>
              <p className="mt-4 text-[15px] leading-[26px] text-[var(--xd-muted-2)] sm:text-[16px]">
                {t("faqsPage.heroBody")}
              </p>
            </div>
            <Button asChild variant="primary" size="sm" className="w-fit shrink-0 gap-2 px-5 text-[13px]">
              <Link href="/contact">
                {t("faqsPage.headerCta")}
                <DirectionalIcon size={15} aria-hidden="true" />
              </Link>
            </Button>
          </SectionReveal>

          <SectionReveal
            delay={0.06}
            className="mt-12 grid grid-cols-1 gap-x-14 gap-y-11 border-t border-[#050505]/10 pt-11 md:grid-cols-2 lg:mt-14 lg:gap-x-20 lg:gap-y-14 lg:pt-14"
          >
            {FAQS.map((item) => (
              <FaqEntry key={item.id} item={item} />
            ))}
          </SectionReveal>

          <SectionReveal className="mt-16 flex flex-col items-start justify-between gap-7 rounded-[24px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] px-6 py-9 sm:px-9 lg:mt-24 lg:flex-row lg:items-center lg:px-12 lg:py-11">
            <div className="max-w-[650px]">
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--xd-gold-text)]">
                {t("faqsPage.ctaEyebrow")}
              </p>
              <h2 className="mt-2 font-display text-[30px] font-semibold tracking-[-0.025em] sm:text-[36px]">
                {t("faqsPage.ctaTitle")}
              </h2>
              <p className="mt-3 text-[14px] leading-[23px] text-[var(--xd-muted-2)]">
                {t("faqsPage.ctaBody")}
              </p>
            </div>
            <Button asChild variant="primary" className="shrink-0 gap-2 px-6 text-[14px]">
              <Link href="/contact">
                {t("faqsPage.ctaButton")}
                <DirectionalIcon size={16} aria-hidden="true" />
              </Link>
            </Button>
          </SectionReveal>
        </div>
      </section>
    </main>
  );
}

function FaqEntry({ item }: { item: FaqItem }) {
  const { t } = useLanguage();
  const Icon = FAQ_ICON_BY_ID[item.id] ?? HelpCircle;

  return (
    <article className="flex items-start gap-4 sm:gap-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[#050505]/[0.08] bg-white/80">
        <Icon size={17} strokeWidth={1.9} className="text-[var(--xd-text)]" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h3 className="text-[15px] font-bold leading-[24px] sm:text-[16px]">
          {t(item.questionKey)}
        </h3>
        <p className="mt-2 max-w-[480px] text-[14px] leading-[24px] text-[var(--xd-muted-2)]">
          {t(item.answerKey)}
        </p>
      </div>
    </article>
  );
}
