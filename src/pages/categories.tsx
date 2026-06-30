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
import { SEO } from "@/components/SEO";
import { useLanguage } from "@/context/LanguageContext";
import { getCategoryTranslationKey } from "@/lib/catalogTranslations";

const CATEGORY_IMAGE = `${import.meta.env.BASE_URL}toothtools.png`;
const CAT_IMG_BASE = `${import.meta.env.BASE_URL}categories page/`;

type CategoryItem = {
  name: string;
  slug: string;
  productCount: number;
  image: string;
};

type QuickAction = {
  label: string;
  href: string;
  Icon: LucideIcon;
};

const categoryCards: CategoryItem[] = [
  { name: "Endodontics",           slug: "endodontics",               productCount: 120, image: `${CAT_IMG_BASE}Endodontics.svg`           },
  { name: "Restorative Materials", slug: "composites-bonding",        productCount: 80,  image: `${CAT_IMG_BASE}Restorative Materials.svg` },
  { name: "Orthodontics",          slug: "orthodontics",              productCount: 70,  image: `${CAT_IMG_BASE}Orthodontics.svg`          },
  { name: "Dental Instruments",    slug: "hand-instruments",          productCount: 90,  image: `${CAT_IMG_BASE}Dental Instruments.svg`    },
  { name: "Consumables",           slug: "sterilization-disposables", productCount: 150, image: `${CAT_IMG_BASE}Consumables.svg`           },
  { name: "Equipment",             slug: "equipment",                 productCount: 45,  image: `${CAT_IMG_BASE}Equipment.svg`             },
  { name: "Surgery",               slug: "surgery",                   productCount: 65,  image: `${CAT_IMG_BASE}Surgery.svg`               },
  { name: "Implantology",          slug: "implantology",              productCount: 55,  image: `${CAT_IMG_BASE}Implantology.svg`          },
  { name: "Infection Control",     slug: "infection-control",         productCount: 60,  image: `${CAT_IMG_BASE}Infection Control.svg`     },
  { name: "Clinic Essentials",     slug: "clinic-essentials",         productCount: 150, image: `${CAT_IMG_BASE}Clinic Essentials.svg`     },
  { name: "Whitening",             slug: "whitening",                 productCount: 34,  image: `${CAT_IMG_BASE}Whitening.svg`             },
  { name: "Periodontics",          slug: "periodontics",              productCount: 78,  image: `${CAT_IMG_BASE}Periodontics.svg`          },
  { name: "Radiology & Imaging",   slug: "radiology-imaging",         productCount: 42,  image: `${CAT_IMG_BASE}Radiology & Imaging.svg`  },
  { name: "Burs & Rotary",         slug: "burs-rotary",               productCount: 100, image: `${CAT_IMG_BASE}Burs & Rotary.svg`        },
  { name: "Impression Materials",  slug: "impression-materials",      productCount: 67,  image: `${CAT_IMG_BASE}Impression Materials.svg` },
  { name: "Anesthesia",            slug: "anesthesia",                productCount: 45,  image: `${CAT_IMG_BASE}Anesthesia.svg`           },
  { name: "Prophylaxis",           slug: "prophylaxis",               productCount: 72,  image: `${CAT_IMG_BASE}Prophylaxis.svg`          },
  { name: "Lab Supplies",          slug: "lab-supplies",              productCount: 58,  image: `${CAT_IMG_BASE}Lab Supplies.svg`         },
  { name: "Disposables",           slug: "disposables",               productCount: 180, image: `${CAT_IMG_BASE}Disposables.svg`          },
];

const quickActions: QuickAction[] = [
  { label: "Weekly Offers",     href: "/products?collection=weekly-offers",   Icon: ShoppingCart },
  { label: "Best Sellers",      href: "/products?collection=best-selling",    Icon: BadgePercent },
  { label: "New Arrivals",      href: "/products?collection=new-arrivals",    Icon: Sparkles     },
  { label: "Fast Delivery",     href: "/products?collection=fast-delivery",   Icon: Truck        },
  { label: "Clinic Essentials", href: "/products?collection=clinic-essentials", Icon: Stethoscope },
  { label: "Equipment & Machines", href: "/products?category=equipment",      Icon: PackageCheck },
  { label: "Trusted Brands",    href: "/brands",                              Icon: Building2    },
  { label: "Request a Quote",   href: "/account/quotes",                      Icon: FileText     },
];

export default function Categories() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return !query
      ? categoryCards
      : categoryCards.filter((category) =>
          category.name.toLowerCase().includes(query)
        );
  }, [searchQuery]);

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

          <SectionReveal delay={0.1} className="mx-auto mt-12 grid max-w-[1120px] grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {filteredCategories.map((category) => (
              <CategoryTile key={category.slug} category={category} />
            ))}
          </SectionReveal>
        </Container>
      </section>

      <PopularShortcuts />
      <ClinicHelp />
    </div>
  );
}

function CategoryTile({ category }: { category: CategoryItem }) {
  const { t } = useLanguage();

  return (
    <Link
      href={`/products?category=${category.slug}`}
      className="group block rounded-[22px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)]"
    >
      <article className="flex h-[214px] flex-col items-center justify-center rounded-[22px] border border-[var(--xd-gold-border-soft)] bg-white/60 p-6 text-center shadow-[0_10px_26px_rgba(5,5,5,0.045)] backdrop-blur-xl transition-[transform,border-color,box-shadow] duration-300 ease-out group-hover:-translate-y-[2px] group-hover:border-[var(--xd-gold-border-hover)] group-hover:shadow-[var(--xd-shadow-hover)] motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
        <div className="mb-4 transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
          <img
            src={category.image}
            alt={category.name}
            loading="lazy"
            className="h-16 w-16 object-contain"
            style={{
              filter:
                "brightness(0) saturate(100%) invert(68%) sepia(57%) saturate(450%) hue-rotate(359deg) brightness(95%) contrast(90%)",
            }}
          />
        </div>
        <h2 className="font-display text-[17px] font-semibold leading-snug text-[#050505]">
          {t(getCategoryTranslationKey(category.name), { fallback: category.name })}
        </h2>
        <p className="mt-2 text-[12px] font-semibold text-[var(--xd-gold-active)]">
          {category.productCount}+ {t("common.products")}
        </p>
      </article>
    </Link>
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
                  <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-[11px] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-active)]">
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
  Icon: LucideIcon;
  step: string;
  title: string;
  body: string;
  imageSrc: string;
  imageAlt: string;
  imageClassName: string;
};

const CATEGORY_WORKFLOW_STEPS: CategoryWorkflowStep[] = [
  {
    Icon: ShoppingCart,
    step: "Step 1",
    title: "Browse by Category",
    body: "Find dental products organized by specialty, treatment type, and daily clinic needs.",
    imageSrc: `${CAT_IMG_BASE}Clinic Essentials.svg`,
    imageAlt: "Dental clinic essentials category",
    imageClassName: "object-contain p-9",
  },
  {
    Icon: PackageCheck,
    step: "Step 2",
    title: "Save to Supply Lists",
    body: "Keep frequently used products ready for reorder, comparison, or quote requests.",
    imageSrc: `${CAT_IMG_BASE}Dental Instruments.svg`,
    imageAlt: "Dental instruments for clinic supply lists",
    imageClassName: "object-contain p-9",
  },
  {
    Icon: FileText,
    step: "Step 3",
    title: "Request Bulk Quotes",
    body: "Send selected products to the sales team and receive pricing for clinic quantities.",
    imageSrc: `${CAT_IMG_BASE}Consumables.svg`,
    imageAlt: "Consumables prepared for quote request",
    imageClassName: "object-contain p-9",
  },
  {
    Icon: Truck,
    step: "Step 4",
    title: "Checkout & Track Orders",
    body: "Confirm your order, apply points or rewards, and track delivery from your account.",
    imageSrc: CATEGORY_IMAGE,
    imageAlt: "Dental products ready for checkout and delivery",
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
            {t("categoriesPage.helpEyebrow", {
              fallback: "Clinic Purchasing",
            })}
          </p>

          <h2 className="font-display text-[34px] font-light leading-[1.12] text-[#050505] sm:text-[44px]">
            {t("categoriesPage.helpTitle", {
              fallback: "How X Dental Store",
            })}
            <span className="block text-[#717182]">
              {t("categoriesPage.helpTitleSecond", {
                fallback: "helps your clinic.",
              })}
            </span>
          </h2>

          <div className="mt-9 flex flex-col gap-5">
            {CATEGORY_WORKFLOW_STEPS.map(
              ({
                Icon,
                step,
                title,
                body,
                imageSrc,
                imageAlt,
                imageClassName,
              }) => (
                <article
                  key={step}
                  className="overflow-hidden rounded-[20px] border border-[#050505]/[0.06] bg-white/70 p-5 shadow-[0_12px_32px_rgba(5,5,5,0.05)]"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--xd-gold-border-hover)] bg-[var(--xd-bg)] text-[var(--xd-gold-active)]">
                      <Icon size={16} />
                    </span>

                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0B3D2E]">
                      {step}
                    </p>
                  </div>

                  <h3 className="mt-4 font-display text-[22px] font-bold leading-[29px] text-[#050505]">
                    {title}
                  </h3>

                  <p className="mt-3 text-[14px] leading-[24px] text-[#0E0E0E]/75">
                    {body}
                  </p>

                  <div className="mt-5 aspect-[3/2] overflow-hidden rounded-[16px] bg-white">
                    <img
                      src={imageSrc}
                      alt={imageAlt}
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
                  aria-label="Clinic purchasing steps"
                >
                  <div className="absolute bottom-6 top-6 w-px bg-[var(--xd-gold)]/30" />

                  <motion.div
                    className="absolute bottom-6 top-6 w-px origin-top bg-[var(--xd-gold)]"
                    style={{ scaleY: railScaleY }}
                  />

                  <div className="relative flex flex-col items-center gap-10">
                    {CATEGORY_WORKFLOW_STEPS.map(({ Icon, step }, index) => {
                      const isActive = index === currentStepIndex;
                      const isVisited = index < currentStepIndex;

                      return (
                        <button
                          key={step}
                          type="button"
                          onClick={() => scrollToStep(index)}
                          aria-label={`Go to ${step}`}
                          aria-current={isActive ? "step" : undefined}
                          className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[var(--xd-bg)]"
                        >
                          <span
                            className={`absolute inset-0 rounded-full border transition-colors duration-300 ${
                              isActive
                                ? "border-[var(--xd-gold-active)]"
                                : "border-[var(--xd-gold-border)]"
                            }`}
                          />

                          <Icon
                            size={17}
                            className={`relative z-10 transition-colors duration-300 ${
                              isActive || isVisited
                                ? "text-[var(--xd-gold-active)]"
                                : "text-[var(--xd-gold-active)]/55"
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex min-h-[200px] items-start pt-1">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeStep.step}
                      initial={{ opacity: 0, x: textEnterX }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: textExitX }}
                      transition={{ duration: 0.58, ease: "easeOut" }}
                    >
                      <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#0B3D2E]">
                        {activeStep.step}
                      </p>

                      <h2 className="mt-3 font-display text-[34px] font-bold leading-[1.08] text-[#1F3D2B] xl:text-[40px]">
                        {activeStep.title}
                      </h2>

                      <p className="mt-4 max-w-[500px] text-[15px] leading-[26px] text-[#0E0E0E]/75">
                        {activeStep.body}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              <div className="flex justify-end">
                <div className="w-full max-w-[360px] xl:max-w-[390px]">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeStep.step}
                      initial={{ opacity: 0, x: imageEnterX, scale: 0.96 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: imageExitX, scale: 1.02 }}
                      transition={{ duration: 0.58, ease: "easeOut" }}
                      className="aspect-[3/2] overflow-hidden rounded-[24px] border border-[var(--xd-gold-border-soft)] bg-white/70 shadow-[0_18px_44px_rgba(5,5,5,0.06)]"
                    >
                      <img
                        src={activeStep.imageSrc}
                        alt={activeStep.imageAlt}
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
