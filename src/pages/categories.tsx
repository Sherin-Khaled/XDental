import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import {
  BadgePercent,
  Building2,
  FileText,
  Gift,
  PackageCheck,
  Search,
  ShoppingCart,
  Sparkles,
  Stethoscope,
  Tag,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { Container } from "@/components/dental/Container";
import { SectionReveal } from "@/components/dental/SectionReveal";
import { PremiumAccentIcon } from "@/components/dental/PremiumAccentIcon";
import { SEO } from "@/components/SEO";
import { useLanguage } from "@/context/LanguageContext";
import { useCatalog } from "@/context/CatalogContext";
import { getLocalizedCategoryName } from "@/lib/catalogTranslations";

const CATEGORY_IMAGE = `${import.meta.env.BASE_URL}toothtools.webp`;
const CAT_IMG_BASE = `${import.meta.env.BASE_URL}categories page/`;

type CategoryItem = {
  name: string;
  nameAr: string | null;
  slug: string;
  productCount: number;
  image: string;
};

type QuickAction = {
  label: string;
  href: string;
  Icon: LucideIcon;
};

// Original custom line-art icons mapped by category slug. Keys cover the
// website-managed taxonomy slugs (seeded from the backend) plus the legacy
// local slugs so admin-created categories with those names keep their icons.
const CATEGORY_IMAGES: Record<string, string> = {
  // Current owner-managed category-tree slugs
  restorative: `${CAT_IMG_BASE}Restorative Materials.svg`,
  endodontics: `${CAT_IMG_BASE}Endodontics.svg`,
  prosthodontics: `${CAT_IMG_BASE}Impression Materials.svg`,
  "perio-surgery": `${CAT_IMG_BASE}Surgery.svg`,
  orthodontics: `${CAT_IMG_BASE}Orthodontics.svg`,
  consumables: `${CAT_IMG_BASE}Consumables.svg`,
  instruments: `${CAT_IMG_BASE}Dental Instruments.svg`,
  equipments: `${CAT_IMG_BASE}Equipment.svg`,
  implant: `${CAT_IMG_BASE}Implantology.svg`,
  "dental-lab": `${CAT_IMG_BASE}Lab Supplies.svg`,
  bleaching: `${CAT_IMG_BASE}Whitening.svg`,
  "burs-stones": `${CAT_IMG_BASE}Burs & Rotary.svg`,
  "oral-care-system": `${CAT_IMG_BASE}Prophylaxis.svg`,
  // Website-managed taxonomy (backend slugs)
  anesthesia: `${CAT_IMG_BASE}Anesthesia.svg`,
  burs: `${CAT_IMG_BASE}Burs & Rotary.svg`,
  "disposable-material": `${CAT_IMG_BASE}Disposables.svg`,
  implantology: `${CAT_IMG_BASE}Implantology.svg`,
  laboratories: `${CAT_IMG_BASE}Lab Supplies.svg`,
  "machine-inquiries": `${CAT_IMG_BASE}Equipment.svg`,
  machines: `${CAT_IMG_BASE}Equipment.svg`,
  others: `${CAT_IMG_BASE}Clinic Essentials.svg`,
  periodontics: `${CAT_IMG_BASE}Periodontics.svg`,
  radiology: `${CAT_IMG_BASE}Radiology & Imaging.svg`,
  "restorative-materials": `${CAT_IMG_BASE}Restorative Materials.svg`,
  "sterilization-material": `${CAT_IMG_BASE}Infection Control.svg`,
  surgery: `${CAT_IMG_BASE}Surgery.svg`,
  // Legacy local slugs
  "composites-bonding": `${CAT_IMG_BASE}Restorative Materials.svg`,
  "hand-instruments": `${CAT_IMG_BASE}Dental Instruments.svg`,
  "sterilization-disposables": `${CAT_IMG_BASE}Consumables.svg`,
  equipment: `${CAT_IMG_BASE}Equipment.svg`,
  "infection-control": `${CAT_IMG_BASE}Infection Control.svg`,
  "clinic-essentials": `${CAT_IMG_BASE}Clinic Essentials.svg`,
  whitening: `${CAT_IMG_BASE}Whitening.svg`,
  "radiology-imaging": `${CAT_IMG_BASE}Radiology & Imaging.svg`,
  "burs-rotary": `${CAT_IMG_BASE}Burs & Rotary.svg`,
  "impression-materials": `${CAT_IMG_BASE}Impression Materials.svg`,
  prophylaxis: `${CAT_IMG_BASE}Prophylaxis.svg`,
  "lab-supplies": `${CAT_IMG_BASE}Lab Supplies.svg`,
  disposables: `${CAT_IMG_BASE}Disposables.svg`,
};

// No Pedodontics-specific asset currently exists. This neutral clinic icon is
// used only for genuinely unmapped categories, and development builds report
// the missing slug rather than silently repeating a taxonomy icon.
const CATEGORY_FALLBACK_ICON = `${CAT_IMG_BASE}Clinic Essentials.svg`;

function getCategoryIcon(slug: string): string {
  const image = CATEGORY_IMAGES[slug];

  if (!image && import.meta.env.DEV) {
    console.warn(`[Categories] Missing custom icon mapping for category slug "${slug}".`);
  }

  return image ?? CATEGORY_FALLBACK_ICON;
}

const quickActions: QuickAction[] = [
  { label: "Weekly Offers",     href: "/products?collection=weekly-offers",   Icon: ShoppingCart },
  { label: "Best Sellers",      href: "/products?collection=best-selling",    Icon: BadgePercent },
  { label: "New Arrivals",      href: "/products?collection=new-arrivals",    Icon: Sparkles     },
  { label: "Fast Delivery",     href: "/products?collection=fast-delivery",   Icon: Truck        },
  { label: "Clinic Essentials", href: "/products?collection=clinic-essentials", Icon: Stethoscope },
  { label: "Equipment & Machines", href: "/products?category=equipments",     Icon: PackageCheck },
  { label: "Trusted Brands",    href: "/brands",                              Icon: Building2    },
  { label: "Request a Quote",   href: "/account/quotes",                      Icon: FileText     },
];

export default function Categories() {
  const { language, t } = useLanguage();
  const { categoryTree, isLoading, error, refresh } = useCatalog();
  const [searchQuery, setSearchQuery] = useState("");
  // Tiles show the main categories; each count includes its subcategories.
  const categoryCards = useMemo<CategoryItem[]>(() => categoryTree.map((category) => ({
    name: category.name,
    nameAr: category.nameAr,
    slug: category.slug,
    productCount: category.productCount,
    image: getCategoryIcon(category.slug),
  })), [categoryTree]);

  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return !query
      ? categoryCards
      : categoryCards.filter((category) => {
          const localizedName = getLocalizedCategoryName(category, language, t);
          return (
            category.name.toLowerCase().includes(query) ||
            localizedName.toLocaleLowerCase(language).includes(query)
          );
        });
  }, [categoryCards, language, searchQuery, t]);

  return (
    <div className="bg-[var(--xd-bg)] pb-20">
      <SEO page="categories" />
      <section className="py-16 md:py-20">
        <Container>
          <SectionReveal className="mx-auto mb-10 max-w-[720px] text-center">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8C8798]">
              {t("nav.categories")}
            </p>
            <h1 className="font-display text-[36px] font-light leading-[1.12] text-[#050505] sm:text-[44px] lg:text-[58px]">
              {t("categoriesPage.title")}
            </h1>
            <p className="mx-auto mt-4 max-w-[470px] text-[14px] leading-[22px] text-[#717182] md:text-[15px] md:leading-[24px]">
              {t("categoriesPage.intro")}
            </p>
          </SectionReveal>

          <SectionReveal delay={0.06} className="mx-auto max-w-[560px]">
            <div className="flex h-12 w-full min-w-0 items-center gap-3 rounded-[16px] border border-[#050505]/[0.08] bg-white/90 px-4">
              <Search size={16} className="shrink-0 text-[#8C8798]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t("categoriesPage.searchPlaceholder")}
                className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-[#050505] outline-none placeholder:text-[#8C8798]"
              />
            </div>
          </SectionReveal>

          {isLoading ? <div className="mx-auto mt-12 grid max-w-[1120px] grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-[214px] animate-pulse rounded-[22px] bg-white/65" />)}</div> : error ? <div role="alert" className="mx-auto mt-12 max-w-[720px] rounded-[22px] border border-[#F2C8C8] bg-[#FFF3F3] p-6 text-center text-sm text-[#B42318]">{error}<button type="button" onClick={() => void refresh()} className="ms-3 font-bold underline">{t("common.retry", { fallback: "Retry" })}</button></div> : <SectionReveal delay={0.1} className="mx-auto mt-12 grid max-w-[1120px] grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {filteredCategories.map((category) => <CategoryTile key={category.slug} category={category} />)}
            {filteredCategories.length === 0 && <p className="col-span-full py-12 text-center text-sm text-[#717182]">{t("products.noProductsBody")}</p>}
          </SectionReveal>}
        </Container>
      </section>

      <PopularShortcuts />
      <ClinicHelp />
    </div>
  );
}

function CategoryTile({ category }: { category: CategoryItem }) {
  const { language, t } = useLanguage();
  const translatedName = getLocalizedCategoryName(category, language, t);

  return (
    <Link
      href={`/products?category=${category.slug}`}
      className="group block rounded-[22px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)]"
    >
      <article className="flex h-[214px] flex-col items-center justify-center rounded-[22px] border border-[var(--xd-gold-border-soft)] bg-white/60 p-6 text-center shadow-[0_10px_26px_rgba(5,5,5,0.045)] backdrop-blur-xl transition-[transform,border-color,box-shadow] duration-300 ease-out group-hover:-translate-y-[2px] group-hover:border-[var(--xd-gold-border-hover)] group-hover:shadow-[var(--xd-shadow-hover)] motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
        <div className="mb-4 transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
          <CategoryIconArtwork image={category.image} label={translatedName} />
        </div>
        <h2 className="font-display text-[17px] font-semibold leading-snug text-[#050505]">
          {translatedName}
        </h2>
        <p className="mt-2 text-[12px] font-semibold text-[var(--xd-gold-active)]">
          {category.productCount}+ {t("common.products")}
        </p>
      </article>
    </Link>
  );
}

const LIGHT_CATEGORY_ICON_FILTER =
  "drop-shadow(0.35px 0 0 #000) drop-shadow(-0.35px 0 0 #000) drop-shadow(0 0.35px 0 #000) drop-shadow(0 -0.35px 0 #000) brightness(0) saturate(100%) invert(68%) sepia(57%) saturate(450%) hue-rotate(359deg) brightness(95%) contrast(90%)";

// The source SVGs contain filled paths rather than stroke attributes. Layering
// their masks at sub-pixel offsets thickens the line art crisply in dark mode
// without blurring it or modifying the original SVG geometry.
const DARK_CATEGORY_ICON_OFFSETS = [
  [0, 0],
  [-0.8, 0],
  [0.8, 0],
  [0, -0.8],
  [0, 0.8],
  [-0.55, -0.55],
  [0.55, -0.55],
  [-0.55, 0.55],
  [0.55, 0.55],
] as const;

function CategoryIconArtwork({ image, label }: { image: string; label: string }) {
  const maskStyle = {
    WebkitMaskImage: `url("${image}")`,
    maskImage: `url("${image}")`,
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskSize: "contain",
    maskSize: "contain",
  } as const;

  return (
    <span role="img" aria-label={label} className="relative block h-20 w-20">
      <img
        src={image}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className="h-20 w-20 object-contain dark:hidden"
        style={{ filter: LIGHT_CATEGORY_ICON_FILTER }}
      />
      <span aria-hidden="true" className="absolute inset-0 hidden dark:block">
        {DARK_CATEGORY_ICON_OFFSETS.map(([x, y]) => (
          <span
            key={`${x}:${y}`}
            className="absolute inset-0 bg-[image:var(--xd-gold-gradient)]"
            style={{
              ...maskStyle,
              transform: `translate(${x}px, ${y}px)`,
            }}
          />
        ))}
      </span>
    </span>
  );
}

function PopularShortcuts() {
  const { t } = useLanguage();

  return (
    <section className="pb-16 lg:pb-20">
      <Container>
        <SectionReveal className="mx-auto max-w-[1220px] rounded-[32px] bg-white/72 px-7 py-12 shadow-[0_18px_50px_rgba(5,5,5,0.035)] md:px-16 md:py-16">
          <div className="max-w-[420px]">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8C8798]">
              {t("categoriesPage.shortcutsEyebrow")}
            </p>
            <h2 className="font-display text-[34px] font-light leading-[1.1] text-[#050505] sm:text-[42px] lg:text-[56px]">
              {t("categoriesPage.shortcutsTitle")}
              <br />
              {t("categoriesPage.shortcutsTitleSecond")}
            </h2>
            <p className="mt-6 text-[14px] leading-[24px] text-[#717182]">
              {t("categoriesPage.shortcutsIntro")}
            </p>
          </div>

          <div className="mt-10 grid max-w-[760px] grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map(({ label, href, Icon }) => (
              <Link
                key={label}
                href={href}
                className="group rounded-[18px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)]"
              >
                <article className="flex h-[110px] flex-col items-center justify-center rounded-[18px] border border-[var(--xd-gold-border-soft)] bg-white/68 px-6 text-center shadow-[0_10px_24px_rgba(5,5,5,0.04)] transition-[transform,border-color,box-shadow] duration-300 ease-out group-hover:-translate-y-[2px] group-hover:border-[var(--xd-gold-border-hover)] group-hover:shadow-[var(--xd-shadow-hover)] motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
                  <span className="xd-icon-amber xd-icon-card-surface mb-3 flex h-9 w-9 items-center justify-center rounded-[11px] bg-[var(--xd-gold-bg-soft)]">
                    <Icon size={18} />
                  </span>
                  <span className="text-[13px] font-semibold text-[#050505]">
                    {t(`categoriesPage.quickActions.${label}`, { fallback: label })}
                  </span>
                </article>
              </Link>
            ))}
          </div>
        </SectionReveal>
      </Container>
    </section>
  );
}

type CategoryWorkflowStep = {
  id: "step1" | "step2" | "step3" | "step4";
  Icon: LucideIcon;
  imageSrc: string;
  imageClassName: string;
  featureLinks?: Array<{
    href: "/account/wallet" | "/checkout";
    label: "walletLink" | "checkoutLink";
  }>;
};

const CATEGORY_WORKFLOW_STEPS: CategoryWorkflowStep[] = [
  {
    id: "step1",
    Icon: ShoppingCart,
    imageSrc: `${CAT_IMG_BASE}Clinic Essentials.svg`,
    imageClassName: "object-contain p-9",
  },
  {
    id: "step2",
    Icon: PackageCheck,
    imageSrc: `${CAT_IMG_BASE}Dental Instruments.svg`,
    imageClassName: "object-contain p-9",
  },
  {
    id: "step3",
    Icon: Gift,
    imageSrc: `${CAT_IMG_BASE}Consumables.svg`,
    imageClassName: "object-contain p-9",
    featureLinks: [
      { href: "/account/wallet", label: "walletLink" },
      { href: "/checkout", label: "checkoutLink" },
    ],
  },
  {
    id: "step4",
    Icon: Truck,
    imageSrc: CATEGORY_IMAGE,
    imageClassName: "object-contain p-6 mix-blend-multiply",
  },
];

function ClinicHelp() {
  const { isRtl, t } = useLanguage();
  const prefersReducedMotion = useReducedMotion();
  const timelineRef = useRef<HTMLDivElement>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showBottomProgress, setShowBottomProgress] = useState(true);

  const activeStep = CATEGORY_WORKFLOW_STEPS[currentStepIndex];
  const lastStepIndex = CATEGORY_WORKFLOW_STEPS.length - 1;

  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ["start start", "end end"],
  });

  const railScaleY = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const bottomScaleX = useTransform(scrollYProgress, [0, 1], [0, 1]);

  const textEnterX = isRtl ? -56 : 56;
  const textExitX = isRtl ? -18 : 18;
  const imageEnterX = isRtl ? -88 : 88;
  const imageExitX = isRtl ? -28 : 28;

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const nextStepIndex = Math.min(
      Math.floor(latest * CATEGORY_WORKFLOW_STEPS.length),
      lastStepIndex
    );

    setCurrentStepIndex((previousStepIndex) =>
      previousStepIndex === nextStepIndex ? previousStepIndex : nextStepIndex
    );
  });

  useEffect(() => {
    if (currentStepIndex !== lastStepIndex) {
      setShowBottomProgress(true);
      return;
    }

    const hideTimer = window.setTimeout(() => {
      setShowBottomProgress(false);
    }, 450);

    return () => window.clearTimeout(hideTimer);
  }, [currentStepIndex, lastStepIndex]);

  useEffect(() => {
    if (window.location.hash !== "#clinic-purchasing") return;

    const scrollFrame = window.requestAnimationFrame(() => {
      document.getElementById("clinic-purchasing")?.scrollIntoView();
    });

    return () => window.cancelAnimationFrame(scrollFrame);
  }, []);

  const scrollToStep = (stepIndex: number) => {
    const timeline = timelineRef.current;
    if (!timeline) return;

    const timelineTop = timeline.getBoundingClientRect().top + window.scrollY;
    const scrollableDistance = timeline.offsetHeight - window.innerHeight;
    const targetProgress =
      CATEGORY_WORKFLOW_STEPS.length <= 1 ? 0 : stepIndex / lastStepIndex;

    window.scrollTo({
      top: timelineTop + scrollableDistance * targetProgress,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  };

  return (
    <section
      id="clinic-purchasing"
      className="relative scroll-mt-[76px] bg-[var(--xd-bg)]"
    >
      {/* Mobile version */}
      <div className="px-5 py-14 lg:hidden">
        <div className="mx-auto max-w-[640px]">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#717182]">
            {t("categoriesPage.helpEyebrow")}
          </p>

          <h2 className="font-display text-[34px] font-light leading-[1.12] text-[#050505] sm:text-[44px]">
            {t("categoriesPage.helpTitle")}
            <span className="block text-[#717182]">
              {t("categoriesPage.helpTitleSecond")}
            </span>
          </h2>

          <div className="mt-9 flex flex-col gap-5">
            {CATEGORY_WORKFLOW_STEPS.map(
              ({
                id,
                Icon,
                imageSrc,
                imageClassName,
                featureLinks,
              }) => (
                <article
                  key={id}
                  className="overflow-hidden rounded-[20px] border border-[#050505]/[0.06] bg-white/70 p-5 shadow-[0_12px_32px_rgba(5,5,5,0.05)]"
                >
                  <div className="flex items-center gap-3">
                    <span className="xd-accent-icon-surface flex h-10 w-10 items-center justify-center rounded-full">
                      <PremiumAccentIcon icon={Icon} size={16} className="xd-timeline-step-icon" />
                    </span>

                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--xd-gold-text)]">
                      {t(`categoriesPage.workflow.steps.${id}.label`)}
                    </p>
                  </div>

                  <h3 className="mt-4 font-display text-[22px] font-bold leading-[29px] text-[#050505]">
                    {t(`categoriesPage.workflow.steps.${id}.title`)}
                  </h3>

                  <p className="mt-3 text-[14px] leading-[24px] text-[var(--xd-text-muted)]">
                    {t(`categoriesPage.workflow.steps.${id}.description`)}
                  </p>

                  {featureLinks && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {featureLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="inline-flex min-h-10 items-center rounded-full border border-[var(--xd-gold-border)] bg-[var(--xd-gold-bg-soft)] px-4 text-[12px] font-bold text-[var(--xd-gold-text)] transition hover:border-[var(--xd-gold-border-hover)] hover:bg-[var(--xd-gold-active)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border-hover)]"
                        >
                          {t(`categoriesPage.workflow.steps.${id}.${link.label}`)}
                        </Link>
                      ))}
                    </div>
                  )}

                  <div className="mt-5 aspect-[3/2] overflow-hidden rounded-[16px] bg-white">
                    <img
                      src={imageSrc}
                      alt={t(`categoriesPage.workflow.steps.${id}.imageAlt`)}
                      className={`h-full w-full ${imageClassName}`}
                      loading="lazy"
                    />
                  </div>
                </article>
              )
            )}
          </div>
        </div>
      </div>

      {/* Desktop version — same About page motion, smaller title/image */}
      <div ref={timelineRef} className="relative hidden h-[400vh] lg:block">
        <div className="sticky top-[76px] h-[calc(100vh-76px)]">
          <Container className="relative flex h-full flex-col justify-center px-5 lg:px-24">
            <div className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr] xl:gap-14">
              <div className="grid grid-cols-[64px_1fr] items-start gap-5">
                <div
                  className="relative flex flex-col items-center"
                  aria-label={t("categoriesPage.workflow.navigationLabel")}
                >
                  <div className="xd-timeline-rail absolute bottom-6 top-6 w-px" />

                  <motion.div
                    className="xd-timeline-rail-progress absolute bottom-6 top-6 w-px origin-top"
                    style={{ scaleY: railScaleY }}
                  />

                  <div className="relative flex flex-col items-center gap-10">
                    {CATEGORY_WORKFLOW_STEPS.map(({ Icon, id }, index) => {
                      const isActive = index === currentStepIndex;
                      const isVisited = index < currentStepIndex;
                      const stepLabel = t(`categoriesPage.workflow.steps.${id}.label`);
                      const stepState = isActive
                        ? "active"
                        : isVisited
                          ? "completed"
                          : "upcoming";

                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => scrollToStep(index)}
                          aria-label={t("categoriesPage.workflow.goToStep", {
                            values: { step: stepLabel },
                          })}
                          aria-current={isActive ? "step" : undefined}
                          data-state={stepState}
                          className={`xd-timeline-step xd-timeline-step--${stepState} relative flex h-12 w-12 items-center justify-center rounded-full`}
                        >
                          <span className="xd-timeline-step-ring absolute inset-0 rounded-full" />

                          <PremiumAccentIcon
                            icon={Icon}
                            size={17}
                            className="xd-timeline-step-icon relative z-10"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex min-h-[200px] items-start pt-1">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeStep.id}
                      initial={{ opacity: 0, x: textEnterX }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: textExitX }}
                      transition={{ duration: 0.58, ease: "easeOut" }}
                    >
                      <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--xd-gold-text)]">
                        {t(`categoriesPage.workflow.steps.${activeStep.id}.label`)}
                      </p>

                      <h2 className="mt-3 font-display text-[clamp(2rem,2.8vw,2.375rem)] font-bold leading-[1.12] text-[var(--xd-text)]">
                        {t(`categoriesPage.workflow.steps.${activeStep.id}.title`)}
                      </h2>

                      <p className="mt-4 max-w-[500px] text-[15px] leading-[26px] text-[var(--xd-text-muted)]">
                        {t(`categoriesPage.workflow.steps.${activeStep.id}.description`)}
                      </p>

                      {activeStep.featureLinks && (
                        <div className="mt-5 flex flex-wrap gap-2">
                          {activeStep.featureLinks.map((link) => (
                            <Link
                              key={link.href}
                              href={link.href}
                              className="inline-flex min-h-10 items-center rounded-full border border-[var(--xd-gold-border)] bg-[var(--xd-gold-bg-soft)] px-4 text-[12px] font-bold text-[var(--xd-gold-text)] transition hover:border-[var(--xd-gold-border-hover)] hover:bg-[var(--xd-gold-active)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border-hover)]"
                            >
                              {t(`categoriesPage.workflow.steps.${activeStep.id}.${link.label}`)}
                            </Link>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              <div className="flex justify-end">
                <div className="w-full max-w-[360px] xl:max-w-[390px]">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeStep.id}
                      initial={{ opacity: 0, x: imageEnterX, scale: 0.96 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: imageExitX, scale: 1.02 }}
                      transition={{ duration: 0.58, ease: "easeOut" }}
                      className="aspect-[3/2] overflow-hidden rounded-[24px] border border-[var(--xd-gold-border-soft)] bg-white/70 shadow-[0_18px_44px_rgba(5,5,5,0.06)]"
                    >
                      <img
                        src={activeStep.imageSrc}
                        alt={t(`categoriesPage.workflow.steps.${activeStep.id}.imageAlt`)}
                        className={`h-full w-full ${activeStep.imageClassName}`}
                        loading={currentStepIndex === 0 ? "eager" : "lazy"}
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-30">
              <div className="mx-auto h-[2px] w-full overflow-hidden rounded-full bg-[var(--xd-gold-bg-soft)]">
                <motion.div
                  className={`h-full origin-left rounded-full bg-[var(--xd-gold)] transition-[opacity] duration-700 ${
                    showBottomProgress ? "opacity-100" : "opacity-0"
                  }`}
                  style={{ scaleX: bottomScaleX }}
                />
              </div>
            </div>
          </Container>
        </div>
      </div>
    </section>
  );
}
