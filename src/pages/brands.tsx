import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Search } from "lucide-react";
import { SEO } from "@/components/SEO";
import { SectionReveal } from "@/components/dental/SectionReveal";
import { useLanguage } from "@/context/LanguageContext";

type BrandPreview = {
  id: string;
  name: string;
  slug: string;
  initials?: string;
};

const ASSET_IMAGE = `${import.meta.env.BASE_URL}toothtools.png`;

const FEATURED_BRANDS: BrandPreview[] = Array.from({ length: 88 }, (_, index) => ({
  id: `meta-biomed-${index + 1}`,
  name: "Meta Biomed",
  slug: "meta-biomed",
  initials: "MB",
}));

const LEFT_PARTNER_BRANDS: BrandPreview[] = [
  { id: "kerr-left", name: "Kerr", slug: "kerr", initials: "KR" },
  { id: "3m-left", name: "3M", slug: "3m", initials: "3M" },
];

const RIGHT_PARTNER_BRANDS: BrandPreview[] = [
  { id: "president-dental", name: "President Dental", slug: "president-dental", initials: "PD" },
  { id: "kerr-right", name: "Kerr", slug: "kerr", initials: "KR" },
  { id: "dm-trust", name: "DM Trust", slug: "dm-trust", initials: "DM" },
  { id: "coltene", name: "Coltene", slug: "coltene", initials: "CO" },
];

const HERO_BRAND_MARKS = ["3M", "MB", "KR", "PD", "CO", "DM"];

function getInitials(name: string) {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function Brands() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");

  const visibleBrands = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return !query
      ? FEATURED_BRANDS
      : FEATURED_BRANDS.filter((brand) =>
          [brand.name, brand.initials, brand.slug].filter(Boolean).join(" ").toLowerCase().includes(query)
        );
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-[var(--xd-bg)]">
      <SEO page="brands" />
      <HeroSection />

      <section className="px-5 pb-16 pt-12 sm:px-8 lg:px-12 lg:pb-20 lg:pt-16">
        <div className="mx-auto flex max-w-[1344px] flex-col items-center gap-14">
          <SectionReveal className="max-w-[780px] text-center">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8D8D9A]">
              {t("brandsPage.featuredEyebrow")}
            </p>
            <h2 className="font-display text-[34px] font-light leading-[1.18] tracking-[-0.035em] text-[#050505] sm:text-[48px] lg:text-[64px]">
              {t("brandsPage.featuredTitle")}
            </h2>
          </SectionReveal>

          <SectionReveal delay={0.06} className="w-full max-w-[720px]">
            <label className="relative block h-12 min-w-0">
              <Search
                size={15}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9A9A9A]"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t("brandsPage.searchPlaceholder")}
                className="h-full w-full rounded-[16px] border border-[#050505]/[0.08] bg-white px-11 text-[14px] text-[#050505] outline-none transition focus:border-[var(--xd-gold-active)]/60 focus:ring-4 focus:ring-[var(--xd-gold-active)]/10"
              />
            </label>
          </SectionReveal>

          <SectionReveal
            delay={0.1}
            className="grid w-full grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8"
          >
            {visibleBrands.map((brand) => (
              <BrandTile key={brand.id} brand={brand} />
            ))}
          </SectionReveal>
        </div>
      </section>

      
    </div>
  );
}

function HeroSection() {
  const { t } = useLanguage();

  return (
    <section className="px-5 pt-10 sm:px-8 sm:pt-12 lg:px-12">
      <SectionReveal
        className="mx-auto max-w-[1344px] overflow-hidden rounded-[32px] bg-white shadow-[0_18px_44px_rgba(5,5,5,0.06)]"
      >
        <div className="relative grid min-h-[560px] grid-cols-1 gap-8 overflow-hidden px-5 py-12 sm:px-10 lg:grid-cols-[1fr_1.12fr_1fr] lg:px-14 lg:py-16">
          <div className="pointer-events-none absolute bottom-10 left-1/2 z-0 hidden -translate-x-1/2 select-none whitespace-nowrap font-display text-[170px] font-bold leading-none tracking-[-0.08em] text-[#050505]/[0.025] lg:block">
            X Dental
          </div>

          <div className="relative z-10 flex flex-col justify-between gap-10">
            <div>
              <h1 className="font-display text-[34px] font-bold leading-[1.02] tracking-[-0.045em] text-[#050505] sm:text-[56px] sm:leading-[0.98] sm:tracking-[-0.055em] lg:text-[68px]">
                {t("brandsPage.heroTitleLine1")}
                <br />
                {t("brandsPage.heroTitleLine2")}
              </h1>
              <p className="mt-6 max-w-[300px] text-[14px] leading-[24px] text-[#717182]">
                {t("brandsPage.heroBody", {
                  fallback:
                    "Explore dental suppliers and manufacturers by brand, specialty, and product category.",
                })}
              </p>
            </div>

            <p className="w-fit rounded-full border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--xd-gold-text)]">
              {t("brandsPage.brandCount", { fallback: "50+ trusted dental brands" })}
            </p>
          </div>

          <div className="relative z-10 flex min-h-[260px] items-center justify-center sm:min-h-[300px] lg:min-h-[430px]">
            <div className="absolute inset-0 m-auto h-[280px] w-[280px] rounded-full bg-[var(--xd-info-bg)]/40 blur-3xl" />
            <div className="relative z-10 grid w-full max-w-[360px] grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {HERO_BRAND_MARKS.map((mark) => (
                <div
                  key={mark}
                  className="flex aspect-square items-center justify-center rounded-[22px] border border-[var(--xd-gold-border-soft)] bg-white/82 font-display text-[30px] font-bold text-[#050505] shadow-[0_12px_30px_rgba(5,5,5,0.055)]"
                >
                  {mark}
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 flex flex-col justify-between gap-12 lg:items-end lg:text-right">
            <h2 className="font-display text-[34px] font-bold leading-[1.02] tracking-[-0.045em] text-[#050505] sm:text-[56px] sm:leading-[0.98] sm:tracking-[-0.055em] lg:mt-28 lg:text-[68px]">
              {t("brandsPage.supplierTitleLine1", { fallback: "Suppliers &" })}
              <br />
              {t("brandsPage.supplierTitleLine2", { fallback: "manufacturers" })}
            </h2>

            <p className="max-w-[310px] text-[14px] leading-[24px] text-[#717182]">
              {t("brandsPage.supplierBody", {
                fallback:
                  "Find products from reliable dental brands and compare options within the catalog.",
              })}
            </p>
          </div>
        </div>
      </SectionReveal>
    </section>
  );
}

function BrandTile({ brand }: { brand: BrandPreview }) {
  const initials = brand.initials ?? getInitials(brand.name);

  return (
    <Link
      href={`/products?brand=${brand.slug}`}
      className="flex h-[118px] min-w-0 flex-col items-center justify-center gap-3 rounded-[20px] border border-[var(--xd-gold-border-soft)] bg-white/80 p-4 text-center shadow-[0_8px_22px_rgba(5,5,5,0.045)] transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-[2px] hover:border-[var(--xd-gold-border-hover)] hover:shadow-[0_14px_30px_rgba(5,5,5,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:h-[124px] sm:p-5"
    >
      <span className="flex h-9 min-w-9 items-center justify-center rounded-[12px] border border-[#050505]/[0.06] bg-[#050505]/[0.04] px-2 font-display text-[11px] font-bold tracking-[0.02em] text-[#3A3A3A]">
        {initials}
      </span>
      <span className="text-[11px] font-medium leading-tight text-[#717182]">{brand.name}</span>
    </Link>
  );
}

function PartnersSection() {
  const { t } = useLanguage();

  return (
    <section className="px-5 pb-20 sm:px-8 lg:px-12">
      <SectionReveal
        className="mx-auto max-w-[1344px] overflow-hidden rounded-[32px] bg-white px-6 py-12 shadow-[0_18px_44px_rgba(5,5,5,0.04)] sm:px-10 lg:px-16 lg:py-16"
      >
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr_1fr] lg:items-center">
          <div className="flex flex-col gap-9">
            <div>
              <p className="mb-5 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#717182]">
                {t("brandsPage.partnersEyebrow", { fallback: "Supplier Network" })}
              </p>
              <h2 className="font-display text-[44px] font-light leading-[1.05] tracking-[-0.04em] text-[#050505] sm:text-[64px] lg:text-[72px]">
                {t("brandsPage.trusted")}
                <br />
                {t("nav.brands")}
              </h2>
              <p className="mt-7 max-w-[340px] text-[14px] leading-[24px] text-[#717182]">
                {t("brandsPage.partnersBody", {
                  fallback:
                    "Browse reliable manufacturers and suppliers represented in the X Dental catalog.",
                })}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6 lg:max-w-[220px] lg:grid-cols-1">
              {LEFT_PARTNER_BRANDS.map((brand) => (
                <PartnerCard key={brand.id} brand={brand} />
              ))}
            </div>
          </div>

          <div className="relative flex min-h-[420px] items-center justify-center">
            <div className="absolute left-1/2 top-[58%] h-[130px] w-[420px] max-w-[82vw] -translate-x-1/2 -translate-y-1/2 rotate-[-13deg] rounded-[50%] border border-[var(--xd-gold-border-hover)]" />
            <FloatingBadge className="left-[58%] top-[47%]" />
            <FloatingBadge className="left-[23%] top-[61%] hidden sm:flex" />
            <img
              src={ASSET_IMAGE}
              alt="Trusted dental supplier instruments"
              className="relative z-10 h-[420px] w-full object-contain sm:h-[520px]"
              style={{ filter: "drop-shadow(0 28px 42px rgba(5,5,5,0.16))" }}
            />
            <Link
              href="/products"
              className="absolute bottom-0 left-1/2 z-20 -translate-x-1/2 text-[14px] font-bold text-[var(--xd-gold-active)] underline underline-offset-4"
            >
              {t("common.viewAll")}
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-6 lg:grid-cols-1 lg:justify-self-end">
            {RIGHT_PARTNER_BRANDS.map((brand) => (
              <PartnerCard key={brand.id} brand={brand} />
            ))}
          </div>
        </div>
      </SectionReveal>
    </section>
  );
}

function FloatingBadge({ className = "" }: { className?: string }) {
  const { t } = useLanguage();

  return (
    <div
      className={`absolute z-20 flex items-center gap-2 rounded-[14px] border border-[var(--xd-gold-border-soft)] bg-white/95 px-4 py-3 text-[12px] font-medium text-[#050505] shadow-[0_8px_22px_rgba(5,5,5,0.08)] ${className}`}
    >
      <span className="h-2 w-2 rounded-full bg-[var(--xd-gold-active)]" />
      {t("common.bestSellers")}
    </div>
  );
}

function PartnerCard({ brand }: { brand: BrandPreview }) {
  const initials = brand.initials ?? getInitials(brand.name);

  return (
    <Link
      href={`/products?brand=${brand.slug}`}
      className="flex h-[124px] w-full min-w-0 flex-col items-center justify-center gap-4 rounded-[18px] border border-[var(--xd-gold-border-soft)] bg-white/70 px-5 text-center shadow-[0_8px_24px_rgba(5,5,5,0.045)] transition hover:-translate-y-0.5 hover:border-[var(--xd-gold-border-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)] lg:w-[194px]"
    >
      <span className="flex h-9 min-w-9 items-center justify-center rounded-[12px] border border-[#050505]/[0.06] bg-[#050505]/[0.04] px-2 font-display text-[11px] font-bold tracking-[0.02em] text-[#3A3A3A]">
        {initials}
      </span>
      <span className="text-[11px] font-medium leading-tight text-[#717182]">{brand.name}</span>
    </Link>
  );
}
