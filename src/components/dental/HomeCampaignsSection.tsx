import { Link } from "wouter";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { SectionReveal } from "@/components/dental/SectionReveal";
import { useLanguage } from "@/context/LanguageContext";
import { getActiveHomeCampaigns, type HomeCampaign } from "@/data/homeCampaigns";

function resolveCampaignImage(src: string) {
  if (/^https?:\/\//.test(src)) return src;
  return `${import.meta.env.BASE_URL}${src.replace(/^\//, "")}`;
}

function CampaignImage({ campaign, className }: { campaign: HomeCampaign; className: string }) {
  const { language } = useLanguage();

  return (
    <picture>
      {campaign.mobileImage && (
        <source media="(max-width: 639px)" srcSet={resolveCampaignImage(campaign.mobileImage)} />
      )}
      <img
        src={resolveCampaignImage(campaign.desktopImage)}
        alt={campaign.imageAlt[language]}
        loading="lazy"
        decoding="async"
        className={className}
      />
    </picture>
  );
}

function CampaignCta({ campaign, inverse = false }: { campaign: HomeCampaign; inverse?: boolean }) {
  const { language } = useLanguage();

  return (
    <span
      className={`inline-flex w-fit items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-bold transition-colors sm:px-5 ${
        inverse
          ? "bg-white text-[#050505] group-hover:bg-[#F9DC5C]"
          : "border border-[var(--xd-gold-border-soft)] bg-white/85 text-[var(--xd-text)] group-hover:border-[var(--xd-gold-border-hover)] group-hover:bg-white dark:!border-[rgba(255,231,122,0.62)] dark:!bg-[#F2D24B] dark:!text-[#17150D] dark:group-hover:!border-[#FFF1A0] dark:group-hover:!bg-[#F7E77A]"
      }`}
    >
      {campaign.ctaLabel[language]}
      <DirectionalIcon direction="forward" size={15} strokeWidth={2.2} />
    </span>
  );
}

function FeatureCampaignCard({ campaign }: { campaign: HomeCampaign }) {
  const { language, isRtl } = useLanguage();
  const imageTransform = isRtl
    ? "[transform:scaleX(-1)] group-hover:[transform:scaleX(-1)_scale(1.025)] motion-reduce:group-hover:[transform:scaleX(-1)]"
    : "group-hover:scale-[1.025] motion-reduce:group-hover:scale-100";

  return (
    <Link
      href={campaign.ctaUrl}
      aria-label={`${campaign.title[language]} — ${campaign.ctaLabel[language]}`}
      className="group relative flex min-h-[430px] overflow-hidden rounded-[28px] border border-[var(--xd-gold-border-soft)] bg-[#171612] shadow-[0_18px_48px_rgba(5,5,5,0.10)] outline-none transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-[var(--xd-gold-border-hover)] hover:shadow-[0_24px_58px_rgba(5,5,5,0.14)] focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:min-h-[500px] lg:min-h-[560px]"
    >
      <CampaignImage
        campaign={campaign}
        className={`absolute inset-0 h-full w-full object-cover object-[64%_center] opacity-100 transition-transform duration-700 ease-out motion-reduce:transition-none sm:object-center ${imageTransform}`}
      />
      <div
        className="absolute inset-0"
        style={{
          background: isRtl
            ? "linear-gradient(270deg, rgba(5,5,5,0.72) 0%, rgba(5,5,5,0.48) 34%, rgba(5,5,5,0.10) 62%, rgba(5,5,5,0) 78%)"
            : "linear-gradient(90deg, rgba(5,5,5,0.88) 0%, rgba(5,5,5,0.68) 42%, rgba(5,5,5,0.08) 78%)",
        }}
      />
      <div className="relative z-10 flex max-w-[590px] flex-col items-start justify-end p-7 text-start sm:p-10 lg:p-12">
        <span className="mb-5 inline-flex rounded-full border border-white/25 bg-white/10 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#F9DC5C] backdrop-blur-md">
          {campaign.eyebrow[language]}
        </span>
        <h3 className="max-w-[520px] font-display text-[32px] font-semibold leading-[1.08] tracking-[-0.03em] text-white sm:text-[42px] lg:text-[48px]">
          {campaign.title[language]}
        </h3>
        <p className="mt-4 max-w-[500px] text-[14px] leading-6 text-white/75 sm:text-[16px] sm:leading-7">
          {campaign.subtitle[language]}
        </p>
        <div className="mt-7">
          <CampaignCta campaign={campaign} inverse />
        </div>
      </div>
    </Link>
  );
}

const compactToneClasses: Record<HomeCampaign["tone"], string> = {
  photo: "bg-[#171612]",
  gold: "bg-[linear-gradient(135deg,#FFFEF9_0%,#FFF7D9_62%,#F7E7A5_100%)] dark:border-[rgba(242,210,75,0.24)] dark:bg-[linear-gradient(135deg,#141413_0%,#191814_62%,#201C13_100%)]",
  blue: "bg-[linear-gradient(135deg,#FCFEFF_0%,#EDF6FC_58%,#DCECF7_100%)] dark:border-[rgba(147,197,253,0.20)] dark:bg-[linear-gradient(135deg,#101416_0%,#131A20_58%,#17232B_100%)]",
};

function CompactCampaignCard({ campaign }: { campaign: HomeCampaign }) {
  const { language } = useLanguage();

  return (
    <Link
      href={campaign.ctaUrl}
      aria-label={`${campaign.title[language]} — ${campaign.ctaLabel[language]}`}
      className={`group relative flex min-h-[260px] overflow-hidden rounded-[26px] border border-[var(--xd-gold-border-soft)] p-7 text-start shadow-[0_12px_34px_rgba(5,5,5,0.055)] outline-none transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-[var(--xd-gold-border-hover)] hover:shadow-[0_18px_42px_rgba(5,5,5,0.09)] focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.30)] dark:hover:shadow-[0_20px_46px_rgba(0,0,0,0.38)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:min-h-[270px] sm:p-8 ${compactToneClasses[campaign.tone]}`}
    >
      <div className="relative z-10 flex max-w-[62%] flex-col items-start">
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--xd-gold-text)] dark:text-[#F2D24B]">
          {campaign.eyebrow[language]}
        </span>
        <h3 className="mt-3 font-display text-[24px] font-semibold leading-[1.12] tracking-[-0.025em] text-[var(--xd-text)] dark:text-[#F7F2E6] sm:text-[27px]">
          {campaign.title[language]}
        </h3>
        <p className="mt-3 text-[13px] leading-[21px] text-[var(--xd-text-muted)] dark:text-[#D0CCBF] sm:text-[14px] sm:leading-[22px]">
          {campaign.subtitle[language]}
        </p>
        <div className="mt-5">
          <CampaignCta campaign={campaign} />
        </div>
      </div>
      <CampaignImage
        campaign={campaign}
        className="absolute -bottom-[6%] end-[-3%] h-[76%] w-[42%] object-contain opacity-100 transition-transform duration-500 ease-out group-hover:scale-[1.035] dark:opacity-100 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
      <div className="pointer-events-none absolute -end-16 -top-20 h-44 w-44 rounded-full border border-[var(--xd-gold-border-soft)] opacity-50 dark:opacity-25" />
    </Link>
  );
}

export function HomeCampaignsSection() {
  const { t } = useLanguage();
  const campaigns = getActiveHomeCampaigns();
  const featureCampaign = campaigns.find((campaign) => campaign.layout === "feature");
  const compactCampaigns = campaigns.filter((campaign) => campaign.layout === "compact").slice(0, 2);

  if (!featureCampaign && compactCampaigns.length === 0) return null;

  return (
    <section className="px-5 py-20 sm:px-8 lg:px-12 lg:py-24" aria-labelledby="home-campaigns-title">
      <SectionReveal className="mx-auto max-w-[1344px]">
        <div className="mb-10 flex flex-col gap-6 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-[720px]">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--xd-gold-text)]">
              {t("home.campaigns.eyebrow")}
            </p>
            <h2
              id="home-campaigns-title"
              className="font-display text-[34px] font-semibold leading-[1.1] tracking-[-0.035em] text-[var(--xd-text)] sm:text-[44px] lg:text-[50px]"
            >
              {t("home.campaigns.title")}
            </h2>
            <p className="mt-4 max-w-[660px] text-[15px] leading-7 text-[var(--xd-text-muted)] sm:text-[16px]">
              {t("home.campaigns.subtitle")}
            </p>
          </div>
          <Link
            href="/products"
            className="group inline-flex w-fit shrink-0 items-center gap-2 text-[14px] font-bold text-[var(--xd-gold-text)] outline-none transition-colors hover:text-[var(--xd-text)] focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--xd-bg)]"
          >
            {t("home.campaigns.viewAll")}
            <DirectionalIcon direction="forward" size={17} className="transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 motion-reduce:transition-none" />
          </Link>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)] lg:gap-6">
          {featureCampaign && <FeatureCampaignCard campaign={featureCampaign} />}
          {compactCampaigns.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1 lg:gap-6">
              {compactCampaigns.map((campaign) => (
                <CompactCampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
          )}
        </div>
      </SectionReveal>
    </section>
  );
}
