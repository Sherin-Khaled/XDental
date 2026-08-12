import { useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Search } from "lucide-react";
import { SEO } from "@/components/SEO";
import { SectionReveal } from "@/components/dental/SectionReveal";
import { useLanguage } from "@/context/LanguageContext";
import { useCatalog } from "@/context/CatalogContext";

type BrandPreview = {
  id: string;
  name: string;
  slug: string;
  initials?: string;
  logoUrl?: string | null;
};

const BRANDS_PER_PAGE = 20;

const FULL_BLEED_BRAND_LOGO_SLUGS = new Set([
  "aditek",
  "alliedstar",
  "amanngirrbach",
  "amd-lasers",
]);

const ASSET_IMAGE = `${import.meta.env.BASE_URL}toothtools.webp`;

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

const HERO_BRAND_COUNT = 6;

// Most recognizable dental brands in the catalog, strongest first. The hero
// picks the first ones that exist in the live data with a usable logo.
const HERO_PRIORITY_SLUGS = [
  "3m",
  "dentsply-sirona",
  "kerr",
  "gc",
  "nsk",
  "ivoclar-vivadent",
  "woodpecker",
  "coltene",
  "ultradent",
  "shofu",
  "voco",
  "meta-biomed",
];

// Shown while the catalog is loading or unavailable so the hero never renders
// empty squares.
const HERO_FALLBACK_BRANDS: BrandPreview[] = [
  { id: "hero-dentsply-sirona", name: "Dentsply Sirona", slug: "dentsply-sirona", initials: "DS" },
  { id: "hero-kerr", name: "Kerr", slug: "kerr", initials: "KR" },
  { id: "hero-gc", name: "GC", slug: "gc", initials: "GC" },
  { id: "hero-nsk", name: "NSK", slug: "nsk", initials: "NS" },
  { id: "hero-ivoclar-vivadent", name: "Ivoclar Vivadent", slug: "ivoclar-vivadent", initials: "IV" },
  { id: "hero-woodpecker", name: "Woodpecker", slug: "woodpecker", initials: "WP" },
];

function selectHeroBrands(brands: BrandPreview[]): BrandPreview[] {
  const bySlug = new Map(brands.map((brand) => [brand.slug, brand]));
  const selected: BrandPreview[] = [];
  const taken = new Set<string>();
  const add = (brand?: BrandPreview) => {
    if (brand && !taken.has(brand.id) && selected.length < HERO_BRAND_COUNT) {
      selected.push(brand);
      taken.add(brand.id);
    }
  };

  for (const slug of HERO_PRIORITY_SLUGS) {
    const brand = bySlug.get(slug);
    if (brand?.logoUrl) add(brand);
  }
  for (const brand of brands) {
    if (selected.length === HERO_BRAND_COUNT) break;
    if (brand.logoUrl) add(brand);
  }
  for (const brand of brands) {
    if (selected.length === HERO_BRAND_COUNT) break;
    add(brand);
  }
  return selected;
}

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
  const { brands, isLoading, error, refresh } = useCatalog();
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const gridTopRef = useRef<HTMLDivElement>(null);
  const catalogBrands = useMemo<BrandPreview[]>(() => brands.map((brand) => ({
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    initials: getInitials(brand.name),
    logoUrl: brand.logoUrl,
  })), [brands]);

  const heroBrands = useMemo(() => selectHeroBrands(catalogBrands), [catalogBrands]);

  const visibleBrands = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return !query
      ? catalogBrands
      : catalogBrands.filter((brand) =>
          [brand.name, brand.initials, brand.slug].filter(Boolean).join(" ").toLowerCase().includes(query)
        );
  }, [catalogBrands, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(visibleBrands.length / BRANDS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pagedBrands = useMemo(
    () => visibleBrands.slice((currentPage - 1) * BRANDS_PER_PAGE, currentPage * BRANDS_PER_PAGE),
    [visibleBrands, currentPage]
  );

  const goToPage = (nextPage: number) => {
    setPage(Math.min(Math.max(nextPage, 1), totalPages));
    gridTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-[var(--xd-bg)]">
      <SEO page="brands" />
      <HeroSection brands={heroBrands.length > 0 ? heroBrands : HERO_FALLBACK_BRANDS} />

      <section className="px-5 pb-16 pt-12 sm:px-8 lg:px-12 lg:pb-20 lg:pt-16">
        <div className="mx-auto flex max-w-[1344px] flex-col items-center gap-14">
          <SectionReveal className="max-w-[680px] text-center">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8D8D9A]">
              {t("brandsPage.featuredEyebrow")}
            </p>
            <h2 className="font-display text-[34px] font-light leading-[1.18] tracking-[-0.035em] text-[#050505] sm:text-[44px] lg:text-[52px]">
              {t("brandsPage.featuredTitle")}
            </h2>
          </SectionReveal>

          <SectionReveal delay={0.06} className="w-full max-w-[720px]">
            <div ref={gridTopRef} className="scroll-mt-28" />
            <label className="relative block h-12 min-w-0">
              <Search
                size={15}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9A9A9A]"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setPage(1);
                }}
                placeholder={t("brandsPage.searchPlaceholder")}
                className="h-full w-full rounded-[16px] border border-[#050505]/[0.08] bg-white px-11 text-[14px] text-[#050505] outline-none transition focus:border-[var(--xd-gold-active)]/60 focus:ring-4 focus:ring-[var(--xd-gold-active)]/10"
              />
            </label>
          </SectionReveal>

          {isLoading ? <div className="grid w-full grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 xl:gap-6">{Array.from({ length: 10 }, (_, index) => <div key={index} className="h-[172px] animate-pulse rounded-[22px] bg-white/65" />)}</div> : error ? <div role="alert" className="w-full max-w-[720px] rounded-[20px] border border-[#F2C8C8] bg-[#FFF3F3] p-6 text-center text-sm text-[#B42318]">{error}<button type="button" onClick={() => void refresh()} className="ms-3 font-bold underline">{t("common.retry", { fallback: "Retry" })}</button></div> : (
            <SectionReveal
              delay={0.1}
              // amount must be 0 so the reveal fires even when the paged grid
              // is taller than the viewport on small screens.
              amount={0}
              className="flex w-full flex-col gap-12"
            >
              {visibleBrands.length === 0 ? (
                <div className="mx-auto w-full max-w-[520px] rounded-[22px] border border-[#050505]/[0.06] bg-white/80 px-8 py-14 text-center shadow-[0_8px_22px_rgba(5,5,5,0.04)]">
                  <p className="text-[16px] font-semibold text-[#050505]">
                    {t("brandsPage.noResultsTitle", { fallback: "No brands found." })}
                  </p>
                  <p className="mt-2 text-[13px] leading-[22px] text-[#717182]">
                    {t("brandsPage.noResultsBody", { fallback: "Try a different brand name or check the spelling." })}
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid w-full grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 xl:gap-6">
                    {pagedBrands.map((brand) => (
                      <BrandTile key={brand.id} brand={brand} />
                    ))}
                  </div>
                  {totalPages > 1 && (
                    <BrandsPagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={goToPage}
                    />
                  )}
                </>
              )}
            </SectionReveal>
          )}
        </div>
      </section>

      
    </div>
  );
}

function HeroSection({ brands }: { brands: BrandPreview[] }) {
  const { isRtl, t } = useLanguage();

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
              <h1
                className={`font-display font-bold tracking-[-0.045em] text-[#050505] ${
                  isRtl
                    ? "text-[30px] leading-[1.08] sm:text-[clamp(2.7rem,4.2vw,3.625rem)] sm:tracking-[-0.055em]"
                    : "text-[34px] leading-[1.02] sm:text-[56px] sm:leading-[0.98] sm:tracking-[-0.055em] lg:text-[68px]"
                }`}
              >
                {t("brandsPage.heroTitleLine1")}
                <br />
                {t("brandsPage.heroTitleLine2")}
              </h1>
              <p className="mt-6 max-w-[300px] text-[14px] leading-[24px] text-[#717182]">
                {t("brandsPage.heroBody")}
              </p>
            </div>

            <p className="w-fit rounded-full border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--xd-gold-text)]">
              {t("brandsPage.brandCount")}
            </p>
          </div>

          <div className="relative z-10 flex min-h-[260px] items-center justify-center sm:min-h-[300px] lg:min-h-[430px]">
            <div className="absolute inset-0 m-auto h-[280px] w-[280px] rounded-full bg-[var(--xd-info-bg)]/40 blur-3xl" />
            <div className="relative z-10 grid w-full max-w-[396px] grid-cols-3 gap-3 sm:gap-4">
              {brands.slice(0, HERO_BRAND_COUNT).map((brand) => (
                <HeroBrandCard key={brand.id} brand={brand} />
              ))}
            </div>
          </div>

          <div className="relative z-10 flex flex-col justify-between gap-12 lg:items-end lg:text-right">
            <h2
              className={`font-display font-bold tracking-[-0.045em] text-[#050505] lg:mt-28 ${
                isRtl
                  ? "max-w-full text-balance text-[28px] leading-[1.08] sm:text-[clamp(2.4rem,3.7vw,3.5rem)] sm:tracking-[-0.055em]"
                  : "text-[34px] leading-[1.02] sm:text-[56px] sm:leading-[0.98] sm:tracking-[-0.055em] lg:text-[68px]"
              }`}
            >
              {t("brandsPage.supplierTitleLine1")}
              {" "}
              <br className={isRtl ? "hidden" : undefined} />
              {t("brandsPage.supplierTitleLine2")}
            </h2>

            <p className="max-w-[310px] text-[14px] leading-[24px] text-[#717182]">
              {t("brandsPage.supplierBody")}
            </p>
          </div>
        </div>
      </SectionReveal>
    </section>
  );
}

// Per-asset fitting for the hero logos, in two families:
// - "block" assets (Dentsply Sirona, NSK) are full-bleed colored tiles, so
//   they cover the whole card interior without a white inset.
// - "wordmark" assets are short, wide marks with baked-in padding; each gets
//   a contain fit plus a scale chosen from its measured artwork bounds so it
//   reads large without ever cropping the artwork (only blank padding).
const HERO_LOGO_CLASS_BY_SLUG: Record<string, string> = {
  "dentsply-sirona": "h-full w-full object-cover",
  nsk: "h-full w-full object-cover",
  kerr: "h-full w-full scale-[1.3] object-contain mix-blend-multiply",
  gc: "h-full w-full scale-[1.08] object-contain mix-blend-multiply",
  "ivoclar-vivadent": "h-full w-full scale-[1.08] object-contain mix-blend-multiply",
  woodpecker: "h-[88%] w-[88%] object-contain mix-blend-multiply",
};

const HERO_LOGO_CLASS_DEFAULT = "h-[80%] w-[80%] object-contain mix-blend-multiply";

function HeroBrandCard({ brand }: { brand: BrandPreview }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const initials = brand.initials ?? getInitials(brand.name);
  const showLogo = Boolean(brand.logoUrl) && !logoFailed;

  return (
    <Link
      href={`/products?brand=${brand.slug}`}
      aria-label={brand.name}
      title={brand.name}
      // bg-[#FEFEFE] instead of bg-white on purpose: the dark-theme compat
      // layer remaps bg-white to a dark surface, and these cards must stay
      // white in both themes so the logos remain legible.
      className="group flex aspect-square items-center justify-center overflow-hidden rounded-[22px] border border-[var(--xd-gold-border-soft)] bg-[#FEFEFE] shadow-[0_10px_26px_rgba(5,5,5,0.05)] transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:border-[var(--xd-gold-border-hover)] hover:shadow-[0_16px_34px_rgba(5,5,5,0.085)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      {showLogo ? (
        <img
          src={brand.logoUrl ?? undefined}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          onError={() => setLogoFailed(true)}
          className={HERO_LOGO_CLASS_BY_SLUG[brand.slug] ?? HERO_LOGO_CLASS_DEFAULT}
        />
      ) : (
        <span className="font-display text-[26px] font-bold tracking-[0.02em] text-[#2A2A2A] sm:text-[30px]">
          {initials}
        </span>
      )}
    </Link>
  );
}

function BrandTile({ brand }: { brand: BrandPreview }) {
  return (
    <Link
      href={`/products?brand=${brand.slug}`}
      className="flex min-h-[172px] min-w-0 flex-col items-center justify-center gap-4 rounded-[22px] border border-[var(--xd-gold-border-soft)] bg-white/80 p-5 text-center shadow-[0_8px_22px_rgba(5,5,5,0.045)] transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-[2px] hover:border-[var(--xd-gold-border-hover)] hover:shadow-[0_14px_30px_rgba(5,5,5,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:min-h-[184px] sm:p-6"
    >
      <BrandMark brand={brand} />
      <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-[#2B2B33] dark:text-[var(--xd-text-muted)] sm:text-[14px]">
        {brand.name}
      </span>
    </Link>
  );
}

function BrandMark({ brand }: { brand: BrandPreview }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const initials = brand.initials ?? getInitials(brand.name);
  const showLogo = Boolean(brand.logoUrl) && !logoFailed;
  const isFullBleed = FULL_BLEED_BRAND_LOGO_SLUGS.has(brand.slug);

  return (
    <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-[var(--xd-gold-border-soft)] bg-[#FEFEFE] shadow-[0_4px_12px_rgba(5,5,5,0.04)] sm:h-24 sm:w-24">
      {showLogo ? (
        <img
          src={brand.logoUrl ?? undefined}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          onError={() => setLogoFailed(true)}
          className={isFullBleed ? "block h-full w-full object-cover" : "h-[78%] w-[78%] object-contain"}
        />
      ) : (
        <span className="font-display text-[20px] font-bold tracking-[0.02em] text-[#2A2A2A] sm:text-[22px]">
          {initials}
        </span>
      )}
    </span>
  );
}

type PageItem = number | "ellipsis-start" | "ellipsis-end";

function getPageItems(current: number, total: number): PageItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const middleStart = Math.max(2, current - 1);
  const middleEnd = Math.min(total - 1, current + 1);
  const items: PageItem[] = [1];
  if (middleStart > 2) items.push("ellipsis-start");
  for (let pageNumber = middleStart; pageNumber <= middleEnd; pageNumber += 1) items.push(pageNumber);
  if (middleEnd < total - 1) items.push("ellipsis-end");
  items.push(total);
  return items;
}

function BrandsPagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const { t } = useLanguage();
  const navButtonClass =
    "flex h-10 items-center justify-center rounded-[12px] border border-[#050505]/[0.08] bg-white px-4 text-[13px] font-semibold text-[#3A3A3A] transition hover:border-[var(--xd-gold-border-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)] disabled:pointer-events-none disabled:opacity-40";

  return (
    <nav
      aria-label={t("brandsPage.paginationLabel", { fallback: "Brands pagination" })}
      className="flex flex-wrap items-center justify-center gap-2"
    >
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={navButtonClass}
      >
        {t("brandsPage.previousPage", { fallback: "Previous" })}
      </button>

      {getPageItems(currentPage, totalPages).map((item) =>
        typeof item === "number" ? (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            aria-current={item === currentPage ? "page" : undefined}
            className={
              item === currentPage
                ? "flex h-10 min-w-10 items-center justify-center rounded-[12px] border border-transparent bg-[var(--xd-gold-active)] px-3 text-[13px] font-bold text-[#050505] shadow-[0_6px_16px_rgba(5,5,5,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)] focus-visible:ring-offset-2"
                : "flex h-10 min-w-10 items-center justify-center rounded-[12px] border border-[#050505]/[0.08] bg-white px-3 text-[13px] font-semibold text-[#3A3A3A] transition hover:border-[var(--xd-gold-border-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)]"
            }
          >
            {item}
          </button>
        ) : (
          <span key={item} aria-hidden="true" className="px-1 text-[13px] font-semibold text-[#9A9A9A]">
            …
          </span>
        )
      )}

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={navButtonClass}
      >
        {t("brandsPage.nextPage", { fallback: "Next" })}
      </button>
    </nav>
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
