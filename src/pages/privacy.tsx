import { Link } from "wouter";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { Button } from "@/components/dental/Button";
import { SectionReveal } from "@/components/dental/SectionReveal";
import { SEO } from "@/components/SEO";
import { useLanguage } from "@/context/LanguageContext";

const PRIVACY_SECTIONS = [
  { id: "introduction", paragraphs: ["paragraph1"] },
  {
    id: "informationCollected",
    paragraphs: ["paragraph1", "paragraph2", "paragraph3", "paragraph4", "paragraph5"],
  },
  { id: "informationUse", paragraphs: ["paragraph1", "paragraph2"] },
  { id: "specialtyPersonalization", paragraphs: ["paragraph1", "paragraph2"] },
  { id: "cookies", paragraphs: ["paragraph1", "paragraph2"] },
  { id: "informationSharing", paragraphs: ["paragraph1", "paragraph2", "paragraph3"] },
  { id: "thirdPartyServices", paragraphs: ["paragraph1", "paragraph2"] },
  { id: "dataSecurity", paragraphs: ["paragraph1", "paragraph2"] },
  { id: "dataRetention", paragraphs: ["paragraph1", "paragraph2"] },
  { id: "userRights", paragraphs: ["paragraph1", "paragraph2"] },
  { id: "marketing", paragraphs: ["paragraph1", "paragraph2"] },
  { id: "children", paragraphs: ["paragraph1"] },
  { id: "internationalTransfers", paragraphs: ["paragraph1", "paragraph2"] },
  { id: "businessTransfers", paragraphs: ["paragraph1"] },
  { id: "policyChanges", paragraphs: ["paragraph1", "paragraph2"] },
  { id: "contactInformation", paragraphs: ["paragraph1"] },
] as const;

export default function Privacy() {
  const { isRtl, t } = useLanguage();

  return (
    <main
      dir={isRtl ? "rtl" : "ltr"}
      className="box-border min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[var(--xd-bg)] text-[var(--xd-text)]"
    >
      <SEO
        page="privacy"
        title={t("privacyPage.seoTitle")}
        titleFormat="exact"
        description={t("privacyPage.seoDescription")}
      />

      <section className="box-border w-full max-w-[100vw] px-5 pb-16 pt-14 sm:px-8 sm:pt-16 lg:px-12 lg:pb-24 lg:pt-20">
        <div
          className="mx-0 w-full lg:mx-auto"
          style={{ maxWidth: "min(1344px, calc(100vw - 40px))" }}
        >
          <SectionReveal className="border-b border-[#050505]/10 pb-10 lg:pb-12">
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--xd-gold-text)]">
              {t("privacyPage.eyebrow")}
            </p>
            <div className="mt-4 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 max-w-[760px]">
                <h1 className="font-display text-[40px] font-semibold leading-[1.04] tracking-[-0.035em] sm:text-[52px] lg:text-[64px]">
                  {t("privacyPage.title")}
                </h1>
                <p className="mt-5 max-w-full text-[15px] leading-[26px] text-[var(--xd-muted-2)] sm:max-w-[620px] sm:text-[16px]">
                  {t("privacyPage.description")}
                </p>
              </div>

              <div className="shrink-0 text-start lg:text-end">
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--xd-muted-2)]">
                  {t("privacyPage.lastUpdatedLabel")}
                </p>
                <p className="mt-1 text-[15px] font-semibold text-[var(--xd-text)]">
                  {t("privacyPage.lastUpdatedDate")}
                </p>
              </div>
            </div>
          </SectionReveal>

          <div className="grid gap-12 pt-12 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-16 lg:pt-14">
            <div className="space-y-12">
              {PRIVACY_SECTIONS.map((section, index) => (
                <section key={section.id} className="grid min-w-0 gap-4 border-b border-[#050505]/[0.07] pb-10 last:border-b-0 last:pb-0 sm:grid-cols-[72px_minmax(0,1fr)] sm:gap-8">
                  <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--xd-gold-text)]">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-display text-[22px] font-semibold leading-[1.22] tracking-[-0.02em] text-[var(--xd-text)] sm:text-[26px]">
                      {t(`privacyPage.sections.${section.id}.title`)}
                    </h2>
                    <div className="mt-4 space-y-4">
                      {section.paragraphs.map((paragraphKey) => (
                        <p key={paragraphKey} className="max-w-[860px] break-words text-[15px] leading-[27px] text-[var(--xd-muted-2)]">
                          {t(`privacyPage.sections.${section.id}.${paragraphKey}`)}
                        </p>
                      ))}
                    </div>
                  </div>
                </section>
              ))}
            </div>

            <aside className="lg:sticky lg:top-32 lg:h-fit">
              <SectionReveal delay={0.08} className="border-s-2 border-[var(--xd-gold)] ps-5">
                <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--xd-gold-text)]">
                  {t("privacyPage.sidebar.title")}
                </p>
                <p className="mt-3 text-[14px] leading-[24px] text-[var(--xd-muted-2)]">
                  {t("privacyPage.sidebar.description")}
                </p>
                <Button asChild variant="primary" size="sm" className="mt-6 w-fit gap-2 px-5 text-[13px]">
                  <Link href="/contact">
                    {t("privacyPage.sidebar.cta")}
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
