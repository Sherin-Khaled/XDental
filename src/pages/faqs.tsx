import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  FileText,
  HelpCircle,
  PackageSearch,
  UserRound,
} from "lucide-react";
import { Link } from "wouter";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { Button } from "@/components/dental/Button";
import { Container } from "@/components/dental/Container";
import { SectionReveal } from "@/components/dental/SectionReveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SEO } from "@/components/SEO";
import { useLanguage } from "@/context/LanguageContext";

type FaqCategory = {
  id: string;
  key: string;
  Icon: LucideIcon;
  items: string[];
};

const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: "orders-quotes",
    key: "ordersQuotes",
    Icon: FileText,
    items: ["quoteBeforeOrdering", "trackQuotes", "orderVsQuote"],
  },
  {
    id: "supply-lists",
    key: "supplyLists",
    Icon: ClipboardList,
    items: ["saveRepeatedLists", "whatIsSupplyList", "cartToSupplyList"],
  },
  {
    id: "product-requests",
    key: "productRequests",
    Icon: PackageSearch,
    items: ["unlistedProduct", "unavailableProduct", "requestsInAccount"],
  },
  {
    id: "account-support",
    key: "accountSupport",
    Icon: UserRound,
    items: ["accountRequired", "contactSupport"],
  },
];

export default function Faqs() {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--xd-bg)] text-[var(--xd-text)]">
      <SEO page="faqs" />

      <section className="pb-14 pt-8 sm:pt-10 lg:pb-20 lg:pt-12">
        <Container>
          <SectionReveal className="relative overflow-hidden rounded-[28px] border border-[var(--xd-gold-border-soft)] bg-white/80 px-6 py-14 shadow-[var(--xd-shadow-strong)] sm:px-10 sm:py-16 lg:rounded-[32px] lg:px-16 lg:py-20">
            <div
              aria-hidden="true"
              className="absolute -end-24 -top-28 h-80 w-80 rounded-full bg-[var(--xd-gold-bg-medium)] blur-3xl"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-28 -start-20 h-64 w-64 rounded-full bg-[var(--xd-gold-bg-soft)] blur-3xl"
            />

            <div className="relative mx-auto max-w-[820px] text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-[14px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-active)] shadow-[0_8px_24px_rgba(212,167,44,0.10)]">
                <HelpCircle size={22} strokeWidth={1.8} />
              </span>
              <p className="mt-5 text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--xd-gold-text)]">
                {t("faqsPage.eyebrow")}
              </p>
              <h1 className="mx-auto mt-4 max-w-[760px] font-display text-[42px] font-semibold leading-[1.05] tracking-[-0.04em] sm:text-[56px] lg:text-[66px]">
                {t("faqsPage.heroTitle")}
              </h1>
              <p className="mx-auto mt-6 max-w-[660px] text-[15px] leading-[26px] text-[var(--xd-muted-2)] sm:text-[16px]">
                {t("faqsPage.heroBody")}
              </p>
            </div>

            <nav
              aria-label={t("faqsPage.categoryNavLabel")}
              className="relative mx-auto mt-10 flex max-w-[900px] flex-wrap justify-center gap-2.5"
            >
              {FAQ_CATEGORIES.map(({ id, key, Icon }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--xd-gold-border-soft)] bg-white/80 px-4 py-2 text-[13px] font-semibold text-[var(--xd-text)] shadow-[0_6px_18px_rgba(5,5,5,0.035)] transition hover:-translate-y-0.5 hover:border-[var(--xd-gold-border-hover)] hover:shadow-[0_10px_24px_rgba(212,167,44,0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)] motion-reduce:transform-none"
                >
                  <Icon size={15} aria-hidden="true" />
                  {t(`faqsPage.categories.${key}.title`)}
                </a>
              ))}
            </nav>
          </SectionReveal>
        </Container>
      </section>

      <section className="pb-16 lg:pb-24">
        <Container className="max-w-[1120px]">
          <SectionReveal className="mb-9 text-center lg:mb-12">
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--xd-gold-text)]">
              {t("faqsPage.libraryEyebrow")}
            </p>
            <h2 className="mt-3 font-display text-[34px] font-light tracking-[-0.03em] sm:text-[44px]">
              {t("faqsPage.libraryTitle")}
            </h2>
          </SectionReveal>

          <div className="space-y-8 lg:space-y-10">
            {FAQ_CATEGORIES.map(({ id, key, Icon, items }, categoryIndex) => (
              <SectionReveal
                key={id}
                id={id}
                delay={categoryIndex * 0.03}
                className="scroll-mt-28 rounded-[22px] border border-[var(--xd-gold-border-soft)] bg-white/65 p-4 shadow-[var(--xd-shadow-card)] sm:p-6 lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8 lg:p-8"
              >
                <div className="mb-5 lg:mb-0">
                  <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-active)]">
                    <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-display text-[22px] font-semibold leading-[1.25] tracking-[-0.02em]">
                    {t(`faqsPage.categories.${key}.title`)}
                  </h3>
                  <p className="mt-2 max-w-[240px] text-[13px] leading-[21px] text-[var(--xd-muted-2)]">
                    {t(`faqsPage.categories.${key}.description`)}
                  </p>
                </div>

                <Accordion type="multiple" className="min-w-0 space-y-3">
                  {items.map((item) => (
                    <AccordionItem
                      key={item}
                      value={`${key}-${item}`}
                      className="overflow-hidden rounded-[14px] border border-[var(--xd-border-soft)] bg-white px-4 shadow-[0_6px_18px_rgba(5,5,5,0.025)] transition-colors data-[state=open]:border-[var(--xd-gold-border)] sm:px-5"
                    >
                      <AccordionTrigger className="min-h-[62px] py-4 text-start text-[14px] font-bold leading-[22px] text-[var(--xd-text)] hover:no-underline [&>svg]:ms-4 [&>svg]:text-[var(--xd-gold-active)]">
                        {t(`faqsPage.categories.${key}.items.${item}.question`)}
                      </AccordionTrigger>
                      <AccordionContent className="pe-8 pb-5 text-start text-[13px] leading-[22px] text-[var(--xd-muted-2)] sm:text-[14px] sm:leading-[24px]">
                        {t(`faqsPage.categories.${key}.items.${item}.answer`)}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </SectionReveal>
            ))}
          </div>
        </Container>
      </section>

      <section className="pb-16 lg:pb-24">
        <Container className="max-w-[1120px]">
          <SectionReveal className="flex flex-col items-start justify-between gap-7 rounded-[24px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] px-6 py-9 sm:px-9 lg:flex-row lg:items-center lg:px-12 lg:py-11">
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
        </Container>
      </section>
    </main>
  );
}
