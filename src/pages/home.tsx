import { useState, useEffect, useRef, type FormEvent } from "react";
import { Link } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import {
  Check, Activity, Wrench, ShoppingBag, Droplet, Smile,
  Shield, Hexagon, FileText, Pill,
  Phone, MapPin, MessageCircle, ShoppingCart,
  type LucideIcon,
} from "lucide-react";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { Button } from "@/components/dental/Button";
import { ProductCarouselRow } from "@/components/dental/ProductCarouselRow";
import { SectionReveal } from "@/components/dental/SectionReveal";
import { mockProducts } from "@/data/products";
import { SEO } from "@/components/SEO";
import { useLanguage } from "@/context/LanguageContext";
import { getCategoryTranslationKey } from "@/lib/catalogTranslations";

// ─── Static data ──────────────────────────────────────────────────────────────

const CATEGORIES = [
  { name: "Endodontics", slug: "endodontics", icon: Activity, count: "120+", description: "Root canal files, obturation tools, and endodontic essentials." },
  { name: "Dental Instruments", slug: "hand-instruments", icon: Wrench, count: "90+", description: "Mirrors, probes, tweezers, and everyday clinical instruments." },
  { name: "Clinic Essentials", slug: "sterilization-disposables", icon: ShoppingBag, count: "150+", description: "Daily-use products and consumables for smooth clinic operations." },
  { name: "Restorative Materials", slug: "composites-bonding", icon: Droplet, count: "80+", description: "Composite, bonding, etching, and finishing products." },
  { name: "Orthodontics", slug: "orthodontics", icon: Smile, count: "70+", description: "Brackets, wires, elastics, and orthodontic accessories." },
  { name: "Infection Control", slug: "infection-control", icon: Shield, count: "60+", description: "Sterilization, disinfection, and protective supplies." },
  { name: "Dental Burs", slug: "dental-burs", icon: Hexagon, count: "100+", description: "Burs for cutting, shaping, and finishing procedures." },
  { name: "Impression Materials", slug: "impression-materials", icon: FileText, count: "45+", description: "Materials and accessories for precise dental impressions." },
  { name: "Implantology", slug: "implantology", icon: Pill, count: "55+", description: "Implant tools, components, and clinical essentials." },
];

const FEATURES = [
  { num: "01", titleKey: "home.features.authenticTitle", bodyKey: "home.features.authenticBody" },
  { num: "02", titleKey: "home.features.pricesTitle", bodyKey: "home.features.pricesBody" },
  { num: "03", titleKey: "home.features.deliveryTitle", bodyKey: "home.features.deliveryBody" },
  { num: "04", titleKey: "home.features.rangeTitle", bodyKey: "home.features.rangeBody" },
  { num: "05", titleKey: "home.features.orderingTitle", bodyKey: "home.features.orderingBody" },
  { num: "06", titleKey: "home.features.supportTitle", bodyKey: "home.features.supportBody" },
];

const HOME_CONTACT_ROWS: {
  Icon: LucideIcon;
  labelKey: string;
  value: string;
  href: string;
}[] = [
  { Icon: MessageCircle, labelKey: "home.contact.ordersWhatsApp", value: "01035777335", href: "https://wa.me/201035777335" },
  { Icon: Phone, labelKey: "home.contact.mainSupport", value: "01552229405", href: "tel:+201552229405" },
  { Icon: MapPin, labelKey: "home.contact.branch", value: "01065057035", href: "tel:+201065057035" },
];

const WEEKLY_OFFER_ITEMS = [
  { name: "Videya K-File", brand: "Videya", category: "Endodontics", currentPrice: 220, oldPrice: 280 },
  { name: "Cheek Retractor", brand: "X Dental", category: "Clinic Essentials", currentPrice: 95, oldPrice: 130 },
  { name: "Dental Mirror Set", brand: "X Dental", category: "Dental Instruments", currentPrice: 180, oldPrice: 220 },
  { name: "Sterilization Pouch", brand: "X Dental", category: "Infection Control", currentPrice: 240, oldPrice: 290 },
  { name: "Endo File Organizer", brand: "Meta Biomed", category: "Endodontics", currentPrice: 310, oldPrice: 390 },
  { name: "Cotton Roll Holder", brand: "X Dental", category: "Clinic Essentials", currentPrice: 145, oldPrice: 185 },
  { name: "Periodontal Probe", brand: "Hu-Friedy", category: "Hand Instruments", currentPrice: 360, oldPrice: 450 },
  { name: "Composite Applicator", brand: "3M", category: "Composites & Bonding", currentPrice: 275, oldPrice: 340 },
  { name: "Ortho Ligature Kit", brand: "Forestadent", category: "Orthodontics", currentPrice: 420, oldPrice: 520 },
  { name: "Impression Tray Set", brand: "Dentsply", category: "Impression Materials", currentPrice: 510, oldPrice: 620 },
  { name: "Surgical Suction Tips", brand: "X Dental", category: "Clinic Essentials", currentPrice: 190, oldPrice: 240 },
  { name: "Implant Driver Kit", brand: "X Dental", category: "Implantology", currentPrice: 760, oldPrice: 920 },
];

const LEFT_BRANDS = ["3M", "Dentsply Sirona", "Hu-Friedy"];
const RIGHT_BRANDS = ["Ivoclar Vivadent", "GC Corporation", "Septodont", "Kerr", "Coltene"];
const TRUSTED_BRANDS_ORBIT_PATH = "M 1037.91 557.55 C 1041.95 590.51 818.51 644.9 538.83 679.1 C 259.16 713.29 29.13 714.41 25.09 681.45 C 21.05 648.49 244.49 594.1 524.17 559.9 C 803.84 525.71 1033.87 524.59 1037.91 557.55";
const HOME_INFO_STRIP_KEYS = [
  "products",
  "brands",
  "delivery",
  "quoteSupport",
  "supplyLists",
  "specialRequests",
] as const;

// ─── Section header (reusable) ────────────────────────────────────────────────

function SectionHeader({
  title, subtitle, viewAllLink, viewAllText,
}: {
  title: React.ReactNode; subtitle?: string;
  viewAllLink?: string; viewAllText?: string;
}) {
  const { t } = useLanguage();

  return (
    <div className="mb-4 flex items-end justify-between gap-6 flex-wrap">
      <div className="max-w-[560px]">
        <h2 className="font-display font-semibold leading-[1.15]"
          style={{ fontSize: "clamp(28px, 3.4vw, 44px)", color: "var(--xd-text)" }}>
          {title}
        </h2>
        {subtitle && (
          <p className="mt-3 text-[16px] leading-[26px]" style={{ color: "var(--xd-muted-2)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {viewAllLink && (
        <Link href={viewAllLink}
          className="group flex items-center gap-2 text-[15px] font-semibold transition-all"
          style={{ color: "var(--xd-gold-text)" }}>
          {viewAllText ?? t("common.viewAll")}
          <DirectionalIcon
            direction="forward"
            size={17}
            className="transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
          />
        </Link>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const { isRtl, t } = useLanguage();
  const prefersReducedMotion = useReducedMotion();
  const weeklyOffers = mockProducts.filter(p => p.isWeeklyOffer);
  const productCardImage = `${import.meta.env.BASE_URL}toothtools.png`;
  const trustedBrandsImage = `${import.meta.env.BASE_URL}trusted-brand-implant.png`;
  const weeklyOfferProducts = WEEKLY_OFFER_ITEMS.map((offer, index) => {
    const source = weeklyOffers[index % weeklyOffers.length] ?? mockProducts[index % mockProducts.length];

    return {
      ...source,
      ...offer,
      id: `weekly-offer-${index + 1}`,
      image: productCardImage,
      isWeeklyOffer: true,
    };
  });
  const bestSellers = mockProducts.filter(p => p.isBestSeller);
  const bestSellerProducts = bestSellers.map(product => ({
    ...product,
    image: productCardImage,
  }));
  const recommended = mockProducts.filter(p => p.isRecommended);
  const recommendedProducts = recommended.map(product => ({
    ...product,
    image: productCardImage,
  }));
  const fastDelivery = mockProducts.filter(p => p.isFastDelivery);
  const fastDeliveryProducts = fastDelivery.map(product => ({
    ...product,
    image: productCardImage,
  }));

  // Feature-card auto-slider
  const [activeFeature, setActiveFeature] = useState(0);
  const [featureStep, setFeatureStep] = useState(0);
  const [featureTransitionEnabled, setFeatureTransitionEnabled] = useState(true);
  const featureTrackRef = useRef<HTMLDivElement>(null);
  const visibleFeatureCount = 3;
  const featureCards = [...FEATURES, ...FEATURES.slice(0, visibleFeatureCount)];
  const activeFeatureDot = activeFeature % FEATURES.length;
  const featureDirectionMultiplier = isRtl ? 1 : -1;

  useEffect(() => {
    const updateFeatureStep = () => {
      const track = featureTrackRef.current;
      const firstCard = track?.firstElementChild as HTMLElement | null;
      if (!track || !firstCard) return;

      const styles = window.getComputedStyle(track);
      const parsedGap = Number.parseFloat(styles.columnGap || styles.gap || "0");
      const gap = Number.isFinite(parsedGap) ? parsedGap : 0;
      setFeatureStep(firstCard.offsetWidth + gap);
    };

    updateFeatureStep();
    window.addEventListener("resize", updateFeatureStep);
    return () => window.removeEventListener("resize", updateFeatureStep);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const featureTimer = window.setInterval(() => {
      setFeatureTransitionEnabled(true);
      setActiveFeature(i => i + 1);
    }, 3500);
    return () => window.clearInterval(featureTimer);
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (activeFeature < FEATURES.length) return;

    const resetTimer = window.setTimeout(() => {
      setFeatureTransitionEnabled(false);
      setActiveFeature(0);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setFeatureTransitionEnabled(true));
      });
    }, 720);

    return () => window.clearTimeout(resetTimer);
  }, [activeFeature]);

  const handleFeaturePrev = () => {
    if (activeFeature === 0) {
      setFeatureTransitionEnabled(false);
      setActiveFeature(FEATURES.length);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setFeatureTransitionEnabled(true);
          setActiveFeature(FEATURES.length - 1);
        });
      });
      return;
    }

    setFeatureTransitionEnabled(true);
    setActiveFeature(i => i - 1);
  };

  const handleFeatureNext = () => {
    setFeatureTransitionEnabled(true);
    setActiveFeature(i => i + 1);
  };

  const handleFeatureDotClick = (index: number) => {
    setFeatureTransitionEnabled(true);
    setActiveFeature(index);
  };

  const handleFeatureLeftControl = () => {
    if (isRtl) {
      handleFeatureNext();
      return;
    }

    handleFeaturePrev();
  };

  const handleFeatureRightControl = () => {
    if (isRtl) {
      handleFeaturePrev();
      return;
    }

    handleFeatureNext();
  };

  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleNewsletterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    setEmail("");
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--xd-bg)" }}>
      <SEO page="home" />

      {/* ═══════════════════════════════════════════════════════
          1. HERO — wrapped in premium white card
      ═══════════════════════════════════════════════════════ */}
      <section className="px-5 sm:px-8 lg:px-12 pt-10 pb-16">
        <div className="max-w-[1344px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="relative overflow-visible"
          // style={{
          //   borderRadius: 32,
          //   background: "var(--xd-white)",
          //   boxShadow: "0 2px 24px rgba(5,5,5,0.04), 0 24px 60px rgba(5,5,5,0.05)",
          //   padding: "clamp(40px, 5vw, 64px) clamp(28px, 5vw, 64px) clamp(48px, 6vw, 80px)",
          //   minHeight: 660,
          // }}
          >
            {/* Ambient glows */}
            {/* <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ borderRadius: 32 }}>
              <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full"
                style={{ background: "radial-gradient(circle, var(--xd-gold-bg-soft) 0%, transparent 65%)" }} />
              <div className="absolute top-1/3 -left-40 w-[420px] h-[420px] rounded-full"
                style={{ background: "radial-gradient(circle, rgba(234,244,255,0.55) 0%, transparent 70%)" }} />
            </div> */}

            {/* Decorative "X Dental" background text — bottom-left */}
            <div
              className="absolute pointer-events-none select-none font-display font-bold leading-none whitespace-nowrap"
              style={{
                bottom: "clamp(18px, 3vw, 42px)",
                left: "50%",
                fontSize: "clamp(80px, 16vw, 210px)",
                color: "rgba(5,5,5,0.036)",
                letterSpacing: "-0.04em",
                transform: "translate(-50%,70%)",
                zIndex: 0,
              }}
            >
              X Dental
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-col lg:flex-row gap-10 lg:gap-12 items-stretch">

              {/* ── Left column (54%) ── */}
              <div className="flex flex-col justify-center lg:w-[54%] py-4">

                {/* Badge */}
                <div className="inline-flex items-center self-start gap-2"
                  style={{
                    height: 36, padding: "0 16px", borderRadius: 999,
                    background: "var(--xd-info-bg)",
                  }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: "var(--xd-gold-warm)" }} />
                  <span className="text-[14px] font-medium" style={{ color: "var(--xd-text)" }}>
                    {t("home.heroBadge")}
                  </span>
                </div>

                {/* Headline */}
                <h1
                  className="font-display font-semibold tracking-tight mt-7"
                  style={{
                    fontSize: "clamp(38px, 5.2vw, 64px)",
                    lineHeight: 1.06,
                    letterSpacing: "-0.03em",
                    color: "var(--xd-text)",
                    maxWidth: 600,
                  }}
                >
                  {t("home.heroTitle")}
                </h1>

                {/* Body */}
                <p className="mt-6 text-[17px] sm:text-[18px] leading-[1.7] max-w-[540px]"
                  style={{ color: "#3A3A3A" }}>
                  {t("home.heroBody")}
                </p>

                {/* CTAs */}
                <div className="flex flex-wrap items-center gap-4 mt-9">
                  <Link
                    href="/products"
                    className="inline-flex items-center justify-center gap-2 font-semibold transition-all hover:-translate-y-px focus-visible:-translate-y-px outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    style={{
                      height: 52, padding: "0 26px", borderRadius: 999,
                      background: "var(--xd-gold)", color: "var(--xd-text)",
                      fontSize: 15,
                      boxShadow: "0 8px 24px var(--xd-gold-border)",
                    }}
                    data-testid="button-hero-browse"
                  >
                    {t("home.browseProducts")}
                    <DirectionalIcon direction="forward" size={16} strokeWidth={2.25} />
                  </Link>
                  <Link
                    href="/contact"
                    className="inline-flex items-center justify-center font-semibold transition-all hover:-translate-y-px focus-visible:-translate-y-px outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                    style={{
                      height: 52, padding: "0 26px", borderRadius: 999,
                      background: "transparent",
                      border: "1px solid rgba(5,5,5,0.16)",
                      color: "var(--xd-text)", fontSize: 15,
                    }}
                    data-testid="button-hero-quote"
                  >
                    {t("common.requestQuote")}
                  </Link>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-12 mt-16">
                  {[
                    { num: "500+", label: t("home.stats.products") },
                    { num: "50+", label: t("home.stats.brands") },
                    { num: "1,200+", label: t("home.stats.clinics") },
                  ].map(({ num, label }) => (
                    <div key={label}>
                      <div className="font-display font-semibold leading-[1.1]"
                        style={{ fontSize: 34, color: "var(--xd-text)", letterSpacing: "-0.02em" }}>
                        {num}
                      </div>
                      <div className="text-[13px] font-medium mt-1" style={{ color: "var(--xd-muted-2)" }}>
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Right column visual (46%) ── */}
              <div className="relative lg:w-[46%] flex items-center justify-center min-h-[420px]">

                {/* Background ambient */}
                {/* <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-[420px] h-[420px] rounded-full"
                    style={{ background: "radial-gradient(circle, rgba(234,244,255,0.55) 0%, transparent 70%)", filter: "blur(40px)" }} />
                </div> */}

                {/* Back half of the orbit — occluded by the product image */}
                <div
                  className="absolute z-0 pointer-events-none"
                  style={{
                    width: "min(86%, 500px)",
                    height: 76,
                    top: "54%",
                    left: "47%",
                    transform: "translate(-50%, -50%) rotate(-8deg)",
                  }}
                >
                  <svg
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full overflow-visible"
                    preserveAspectRatio="none"
                    viewBox="0 0 500 76"
                  >
                    <defs>
                      <clipPath id="hero-orbit-back-clip">
                        <rect width="500" height="38" />
                      </clipPath>
                      <radialGradient id="hero-orbit-back-sphere" cx="32%" cy="28%" r="72%">
                        <stop offset="0%" stopColor="#FFF8C9" />
                        <stop offset="45%" stopColor="#F9DC5C" />
                        <stop offset="100%" stopColor="#B88A44" />
                      </radialGradient>
                    </defs>
                    <g clipPath="url(#hero-orbit-back-clip)" opacity="0.48">
                      <path
                        d="M 1 38 A 249 37 0 1 1 499 38 A 249 37 0 1 1 1 38"
                        fill="none"
                        pathLength="100"
                        stroke="var(--xd-gold-border)"
                        strokeLinecap="round"
                        strokeWidth="1"
                      />
                      <path
                        d="M 1 38 A 249 37 0 1 1 499 38 A 249 37 0 1 1 1 38"
                        fill="none"
                        pathLength="100"
                        stroke="var(--xd-gold-warm)"
                        strokeDasharray="58 42"
                        strokeLinecap="round"
                        strokeWidth="1.45"
                      >
                        {!prefersReducedMotion && (
                          <animate
                            attributeName="stroke-dashoffset"
                            calcMode="linear"
                            dur="10s"
                            from="0"
                            repeatCount="indefinite"
                            to="-100"
                          />
                        )}
                      </path>
                      {!prefersReducedMotion && (
                        <circle
                          r="4"
                          fill="url(#hero-orbit-back-sphere)"
                          stroke="rgba(255,255,255,0.72)"
                          strokeWidth="0.75"
                        >
                          <animateMotion
                            calcMode="linear"
                            dur="10s"
                            path="M 1 38 A 249 37 0 1 1 499 38 A 249 37 0 1 1 1 38"
                            repeatCount="indefinite"
                          />
                        </circle>
                      )}
                    </g>
                  </svg>
                </div>

                {/* Front half of the same orbit — passes over the product image */}
                <div
                  className="absolute z-20 pointer-events-none"
                  style={{
                    width: "min(86%, 500px)",
                    height: 76,
                    top: "54%",
                    left: "47%",
                    transform: "translate(-50%, -50%) rotate(-8deg)",
                  }}
                >
                  <svg
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full overflow-visible"
                    preserveAspectRatio="none"
                    viewBox="0 0 500 76"
                  >
                    <defs>
                      <clipPath id="hero-orbit-front-clip">
                        <rect y="38" width="500" height="38" />
                      </clipPath>
                      <radialGradient id="hero-orbit-front-sphere" cx="32%" cy="28%" r="72%">
                        <stop offset="0%" stopColor="#FFFBE2" />
                        <stop offset="42%" stopColor="#F9DC5C" />
                        <stop offset="100%" stopColor="#B88A44" />
                      </radialGradient>
                      <filter id="hero-orbit-sphere-glow" x="-180%" y="-180%" width="460%" height="460%">
                        <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#B88A44" floodOpacity="0.38" />
                      </filter>
                    </defs>
                    <g clipPath="url(#hero-orbit-front-clip)">
                      <path
                        d="M 1 38 A 249 37 0 1 1 499 38 A 249 37 0 1 1 1 38"
                        fill="none"
                        pathLength="100"
                        stroke="var(--xd-gold-border)"
                        strokeLinecap="round"
                        strokeWidth="1"
                      />
                      <path
                        d="M 1 38 A 249 37 0 1 1 499 38 A 249 37 0 1 1 1 38"
                        fill="none"
                        pathLength="100"
                        stroke="var(--xd-gold-warm)"
                        strokeDasharray="58 42"
                        strokeLinecap="round"
                        strokeWidth="1.45"
                      >
                        {!prefersReducedMotion && (
                          <animate
                            attributeName="stroke-dashoffset"
                            calcMode="linear"
                            dur="10s"
                            from="0"
                            repeatCount="indefinite"
                            to="-100"
                          />
                        )}
                      </path>
                      {!prefersReducedMotion && (
                        <circle
                          r="4"
                          fill="url(#hero-orbit-front-sphere)"
                          filter="url(#hero-orbit-sphere-glow)"
                          stroke="rgba(255,255,255,0.92)"
                          strokeWidth="0.75"
                        >
                          <animateMotion
                            calcMode="linear"
                            dur="10s"
                            path="M 1 38 A 249 37 0 1 1 499 38 A 249 37 0 1 1 1 38"
                            repeatCount="indefinite"
                          />
                        </circle>
                      )}
                      {prefersReducedMotion && (
                        <circle
                          cx="1"
                          cy="38"
                          r="4"
                          fill="url(#hero-orbit-front-sphere)"
                          stroke="rgba(255,255,255,0.92)"
                          strokeWidth="0.75"
                        />
                      )}
                    </g>
                  </svg>
                </div>

                {/* Labels remain at their original coordinates */}
                <div
                  className="absolute z-20 pointer-events-none"
                  style={{
                    width: "min(86%, 500px)",
                    height: 76,
                    top: "60%",
                    left: "47%",
                    transform: "translate(-50%, -50%) rotate(-8deg)",
                  }}
                >
                  <svg
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full overflow-visible"
                    preserveAspectRatio="none"
                    viewBox="0 0 500 76"
                  >
                    {/* The orbit is rendered in the synchronized layers above. */}
                    {/* <ellipse
                      cx="250"
                      cy="38"
                      fill="none"
                      rx="249"
                      ry="37"
                      stroke="var(--xd-gold-border)"
                      strokeWidth="1"
                    /> */}
                  </svg>

                  {/* Best Sellers label */}
                  <div
                    className="absolute flex items-center gap-2 whitespace-nowrap"
                    style={{
                      top: "28%",
                      left: "2%",
                      height: 36, padding: "0 12px",
                      background: "rgba(255,255,255,0.92)",
                      border: "1px solid var(--xd-gold-border)",
                      borderRadius: 14,
                      backdropFilter: "blur(10px)",
                      WebkitBackdropFilter: "blur(10px)",
                      boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
                      transform: "translate(20%, -160%) rotate(8deg)",
                    }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: "var(--xd-gold-warm)" }} />
                    <span className="text-[11px] font-medium" style={{ color: "var(--xd-text)" }}>{t("common.bestSellers")}</span>
                  </div>

                  {/* Fast Delivery label */}
                  <div
                    className="absolute flex items-center gap-2 whitespace-nowrap"
                    style={{
                      top: "34%",
                      right: "2%",
                      height: 36, padding: "0 12px",
                      background: "rgba(255,255,255,0.92)",
                      border: "1px solid var(--xd-gold-border)",
                      borderRadius: 14,
                      backdropFilter: "blur(10px)",
                      WebkitBackdropFilter: "blur(10px)",
                      boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
                      transform: "translate(50%, -50%) rotate(8deg)",
                    }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: "var(--xd-gold-warm)" }} />
                    <span className="text-[11px] font-medium" style={{ color: "var(--xd-text)" }}>{t("common.fastDelivery")}</span>
                  </div>
                </div>

                {/* Product image */}
                <div className="relative z-10 flex items-center justify-center" style={{ width: "min(430px, 92vw)", height: "min(430px, 92vw)", transform: "translateX(-18px)" }}>
                  <img
                    src={`${import.meta.env.BASE_URL}toothtools.png`}
                    alt="Premium dental instruments"
                    width={2525}
                    height={2582}
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    className="w-full h-full object-contain"
                  // style={{ filter: "drop-shadow(0 24px 48px rgba(0,0,0,0.16))" }}
                  />
                </div>

                {/* Glassmorphism "Why Choose Us" overlay — bottom right */}
                <div
                  className="absolute z-20"
                  style={{
                    bottom: -2, right: 8,
                    width: 228,
                    background: "rgba(255,255,255,0.65)",
                    border: "1px solid var(--xd-gold-border-soft)",
                    borderRadius: 20,
                    padding: 18,
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    // boxShadow: "0 12px 32px rgba(0,0,0,0.08)",
                  }}
                >
                  <h3 className="font-display font-semibold mb-3"
                    style={{ fontSize: 16, color: "var(--xd-text)" }}>
                    {t("home.sections.whyTitle")}
                  </h3>
                  <div className="flex flex-col gap-2">
                    {[
                      t("home.features.authenticTitle"),
                      t("home.features.pricesTitle"),
                      t("home.features.rangeTitle"),
                      t("home.features.deliveryTitle"),
                    ].map(item => (
                      <div key={item} className="flex items-center gap-2.5">
                        <Check size={15} strokeWidth={2.5} style={{ color: "var(--xd-gold-warm)" }} />
                        <span className="text-[13px]" style={{ color: "var(--xd-text)" }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <HomeInfoStrip />

      {/* ═══════════════════════════════════════════════════════
          2. CATEGORIES
      ═══════════════════════════════════════════════════════ */}
      <section className="py-20 lg:py-24 px-5 sm:px-8 lg:px-12" style={{ background: "var(--xd-bg)" }}>
        <SectionReveal className="max-w-[1344px] mx-auto">
          {/* Editorial heading */}
          <div className="text-center mb-12">
            <div className="text-[13px] font-medium uppercase tracking-[0.1em] mb-5"
              style={{ color: "var(--xd-muted-2)" }}>
              {t("nav.categories")}
            </div>
            <h2 className="font-display tracking-tight"
              style={{ fontSize: "clamp(32px, 4.2vw, 56px)", lineHeight: 1.12, letterSpacing: "-0.02em" }}>
              <span className="font-light" style={{ color: "var(--xd-text)" }}>{t("home.sections.categoriesTitle")}</span>
              <br />
              <span className="font-normal" style={{ color: "var(--xd-muted-2)" }}>{t("home.sections.categoriesSubtitle")}</span>
            </h2>
            <p className="mt-6 text-[16px] leading-[26px] max-w-[560px] mx-auto"
              style={{ color: "var(--xd-muted-2)" }}>
              {t("home.sections.categoriesSubtitle")}
            </p>
          </div>

          {/* 3×3 cards with hover-reveal description */}
          <div className="mx-auto grid max-w-[1120px] grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 overflow-visible">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <div
                  key={cat.slug}
                  className="relative h-[210px] lg:h-[224px] overflow-visible hover:z-30 focus-within:z-30"
                >
                  <Link
                    href={`/products?category=${cat.slug}`}
                    className="group absolute inset-0 z-0 flex h-full flex-col items-center justify-center overflow-hidden text-center cursor-pointer transition-[transform,border-color,box-shadow,background] duration-300 ease-out hover:z-30 hover:-translate-y-[2px] focus-visible:z-30 focus-visible:-translate-y-[2px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--xd-bg)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:focus-visible:translate-y-0"
                    style={{
                      padding: "24px 26px",
                      background: "rgba(255,255,255,0.70)",
                      border: "1px solid var(--xd-gold-border-soft)",
                      borderRadius: 24,
                      backdropFilter: "blur(20px)",
                      WebkitBackdropFilter: "blur(20px)",
                      boxShadow: "var(--xd-shadow-card)",
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.borderColor = "var(--xd-gold-border-hover)";
                      el.style.boxShadow = "0 18px 44px var(--xd-gold-bg-medium)";
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.borderColor = "var(--xd-gold-border-soft)";
                      el.style.boxShadow = "var(--xd-shadow-card)";
                    }}
                  >
                    <div
                      className="flex shrink-0 items-center justify-center"
                      style={{
                        width: 50, height: 50,
                        background: "rgba(234,244,255,0.7)",
                        borderRadius: 15,
                      }}
                    >
                      <Icon size={23} strokeWidth={1.6} style={{ color: "var(--xd-text)" }} />
                    </div>

                    <div className="mt-4">
                      <h3 className="font-display font-semibold leading-tight mb-1.5"
                        style={{ fontSize: 18, color: "var(--xd-text)" }}>
                        {t(getCategoryTranslationKey(cat.name), { fallback: cat.name })}
                      </h3>
                      <div className="text-[13px] font-semibold"
                        style={{ color: "var(--xd-gold-text)" }}>
                        {cat.count} {t("common.products")}
                      </div>

                      {/* Description: revealed on hover OR focus (keyboard-accessible) */}
                      <p
                        className="mx-auto max-h-0 max-w-[280px] overflow-hidden text-[13px] leading-[20px] opacity-0 translate-y-2 transition-all duration-300 ease-out group-hover:mt-2.5 group-hover:max-h-[48px] group-hover:opacity-100 group-hover:translate-y-0 group-focus-visible:mt-2.5 group-focus-visible:max-h-[48px] group-focus-visible:opacity-100 group-focus-visible:translate-y-0"
                        style={{ color: "#717182" }}
                      >
                        {t(`home.categoryDescriptions.${cat.slug}`, { fallback: cat.description })}
                      </p>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </SectionReveal>
      </section>

      {/* ═══════════════════════════════════════════════════════
          3. WEEKLY OFFERS
      ═══════════════════════════════════════════════════════ */}
      <section className="py-20 px-5 sm:px-8 lg:px-12">
        <SectionReveal className="max-w-[1344px] mx-auto">
          <SectionHeader
            title={t("home.sections.weeklyTitle")}
            subtitle={t("home.sections.weeklySubtitle")}
            viewAllLink="/products?isWeeklyOffer=true"
            viewAllText={t("common.viewAll")}
          />
          <ProductCarouselRow title="" products={weeklyOfferProducts} viewAllLink="" autoSlide />
        </SectionReveal>
      </section>

      {/* ═══════════════════════════════════════════════════════
          4. BEST SELLERS
      ═══════════════════════════════════════════════════════ */}
      <section className="py-20 px-5 sm:px-8 lg:px-12" style={{ background: "var(--xd-bg)" }}>
        <SectionReveal className="max-w-[1344px] mx-auto">
          <SectionHeader
            title={t("home.sections.bestSellersTitle")}
            subtitle={t("home.sections.bestSellersSubtitle")}
            viewAllLink="/products?isBestSeller=true"
            viewAllText={t("common.viewAll")}
          />
          <ProductCarouselRow title="" products={bestSellerProducts} viewAllLink="" autoSlide />
        </SectionReveal>
      </section>

      {/* ═══════════════════════════════════════════════════════
          5. WHY CHOOSE — auto-sliding feature cards
      ═══════════════════════════════════════════════════════ */}
      <section className="py-24 px-5 sm:px-8 lg:px-12" style={{ background: "var(--xd-bg)" }}>
        <SectionReveal className="max-w-[1344px] mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-10" style={{ marginBottom: 72 }}>
            <h2
              className="font-display m-0"
              style={{
                fontSize: "clamp(42px, 5.8vw, 76px)",
                fontWeight: 300,
                lineHeight: 1.16,
                letterSpacing: "-0.03em",
                color: "#050505",
                maxWidth: 660,
              }}
            >
              {t("home.sections.whyTitle")}
            </h2>

            <p
              className="text-[15px] leading-[26px] lg:mt-7 shrink-0"
              style={{
                color: "#717182",
                maxWidth: 340,
              }}
            >
              {t("home.sections.whySubtitle")}
            </p>
          </div>

          <div className="overflow-hidden">
            <div
              ref={featureTrackRef}
              data-rtl-carousel="home-features"
              dir={isRtl ? "rtl" : "ltr"}
              className="flex gap-6"
              style={{
                transform: `translate3d(${featureDirectionMultiplier * activeFeature * featureStep}px, 0, 0)`,
                transition: featureTransitionEnabled && !prefersReducedMotion
                  ? "transform 720ms cubic-bezier(0.22, 1, 0.36, 1)"
                  : "none",
                willChange: prefersReducedMotion ? "auto" : "transform",
              }}
            >
              {featureCards.map((feature, idx) => (
                <div
                  key={`${feature.num}-${idx}`}
                  className="shrink-0 basis-full sm:basis-[330px] lg:basis-[357px]"
                >
                  <WhyFeatureCard
                    title={t(feature.titleKey)}
                    body={t(feature.bodyKey)}
                    number={feature.num}
                    isActive={idx % FEATURES.length === activeFeatureDot}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center" style={{ gap: 12, marginTop: 40 }}>
            <Button
              type="button"
              onClick={handleFeatureLeftControl}
              variant="secondary"
              size="icon"
              className="h-12 w-12"
              aria-label={isRtl ? "Next feature cards" : "Previous feature cards"}
            >
              <DirectionalIcon direction={isRtl ? "forward" : "back"} size={18} />
            </Button>

            <Button
              type="button"
              onClick={handleFeatureRightControl}
              variant="secondary"
              size="icon"
              className="h-12 w-12"
              aria-label={isRtl ? "Previous feature cards" : "Next feature cards"}
            >
              <DirectionalIcon direction={isRtl ? "back" : "forward"} size={18} />
            </Button>

            <div className="flex items-center" style={{ gap: 6, marginInlineStart: 8 }}>
              {FEATURES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => handleFeatureDotClick(i)}
                  aria-label={`Show feature ${i + 1}`}
                  aria-current={i === activeFeatureDot ? "true" : undefined}
                  className="transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--xd-bg)]"
                  style={{
                    width: i === activeFeatureDot ? 20 : 6,
                    height: 6,
                    borderRadius: 999,
                    backgroundColor: i === activeFeatureDot ? "var(--xd-gold-active)" : "rgba(5,5,5,0.18)",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                />
              ))}
            </div>
          </div>
        </SectionReveal>
      </section>

      {/* ═══════════════════════════════════════════════════════
          6. TRUSTED BRANDS
      ═══════════════════════════════════════════════════════ */}
      <section id="trusted-brands" className="py-24 px-5 sm:px-8 lg:px-12" style={{ background: "var(--xd-bg)" }}>
        <div className="max-w-[1344px] mx-auto">
          <SectionReveal
            className="relative overflow-hidden"
            style={{
              padding: "clamp(48px, 6vw, 72px) clamp(28px, 5vw, 64px)",
              borderRadius: 32,
              background: "rgba(255,255,255,0.86)",
              border: "1px solid var(--xd-gold-border-soft)",
              boxShadow: "var(--xd-shadow-strong)",
            }}
          >
            <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ borderRadius: 32 }}>
              <div
                className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-35"
                style={{ background: "radial-gradient(circle, var(--xd-gold-bg-medium) 0%, transparent 68%)" }}
              />
            </div>

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[190px_minmax(380px,1fr)_190px] xl:grid-cols-[220px_minmax(460px,1fr)_220px] gap-10 lg:gap-12 items-center">
              <div className="flex flex-col gap-8 lg:self-stretch lg:justify-between">
                <div>
                  <div
                    className="text-[11px] font-semibold uppercase tracking-[0.22em] mb-5"
                    style={{ color: "var(--xd-muted-2)" }}>
                    {t("home.sections.trustedBrandsEyebrow")}
                  </div>
                  <h2
                    className="font-display font-light mb-6"
                    style={{
                      fontSize: "clamp(46px, 5.2vw, 66px)",
                      lineHeight: 1.05,
                      color: "var(--xd-text)",
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {t("home.sections.trustedBrandsTitle")}
                  </h2>
                  <p
                    className="text-[14px] leading-[24px] max-w-[280px]"
                    style={{ color: "var(--xd-muted-2)" }}
                  >
                    {t("home.sections.trustedBrandsSubtitle")}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-5">
                  {LEFT_BRANDS.map(name => (
                    <BrandCard key={name} name={name} />
                  ))}
                </div>
              </div>

              <div className="relative flex min-h-[500px] flex-col items-center justify-center gap-7">
                <div
                  className="relative flex items-center justify-center overflow-visible"
                  style={{
                    width: "min(100%, 640px)",
                    height: "clamp(420px, 44vw, 560px)",
                  }}
                >
                  {/* Soft glow behind image */}
                  <div
                    className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-45 blur-3xl"
                    style={{
                      background:
                        "radial-gradient(circle, rgba(249,220,92,0.12) 0%, rgba(234,244,255,0.18) 44%, transparent 70%)",
                    }}
                  />

                  <TrustedBrandsOrbitStroke layer="back" animate={!prefersReducedMotion} />

                  {/* Badges follow the gold ellipse while remaining horizontal. */}
                  <TrustedBrandsOrbitBadge
                    phase="primary"
                    label={t("common.bestSellers")}
                  />
                  <TrustedBrandsOrbitBadge
                    phase="secondary"
                    label={t("home.sections.bestServiceBadge")}
                  />


                  {/* Main image */}
                  <img
                    src={trustedBrandsImage}
                    alt={t("home.sections.trustedBrandsTitle")}
                    width={1063}
                    height={1239}
                    loading="lazy"
                    decoding="async"
                    className="relative z-10 h-full w-full object-contain"
                    style={{
                      maxWidth: 540,
                      // filter: "drop-shadow(0 30px 48px rgba(5,5,5,0.16))",
                    }}
                  />

                  <TrustedBrandsOrbitStroke layer="front" animate={!prefersReducedMotion} />
                </div>

                <Link
                  href="/brands"
                  className="inline-flex items-center gap-2 font-semibold transition-all hover:-translate-y-px focus-visible:-translate-y-px outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  style={{
                    height: 46,
                    padding: "0 24px",
                    borderRadius: 999,
                    background: "var(--xd-gold)",
                    color: "var(--xd-text)",
                    fontSize: 14,
                    boxShadow: "0 6px 18px rgba(249,220,92,0.22)",
                  }}
                >
                  {t("footer.links.trustedBrands")}
                  <DirectionalIcon direction="forward" size={15} />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-5 lg:self-center">
                {RIGHT_BRANDS.map(name => (
                  <BrandCard key={name} name={name} />
                ))}
              </div>
            </div>
          </SectionReveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          7. RECOMMENDED
      ═══════════════════════════════════════════════════════ */}
      <section className="py-20 px-5 sm:px-8 lg:px-12" style={{ background: "var(--xd-bg)" }}>
        <SectionReveal className="max-w-[1344px] mx-auto">
          <SectionHeader
            title={t("home.sections.recommendedTitle")}
            subtitle={t("home.sections.recommendedSubtitle")}
            viewAllLink="/products?isRecommended=true"
            viewAllText={t("common.viewAll")}
          />
          <ProductCarouselRow title="" products={recommendedProducts} viewAllLink="" autoSlide />
        </SectionReveal>
      </section>

      {/* ═══════════════════════════════════════════════════════
          8. FAST DELIVERY
      ═══════════════════════════════════════════════════════ */}
      <section className="py-20 px-5 sm:px-8 lg:px-12" style={{ background: "var(--xd-bg)" }}>
        <SectionReveal className="max-w-[1344px] mx-auto">
          <SectionHeader
            title={t("home.sections.fastDeliveryTitle")}
            subtitle={t("home.sections.fastDeliverySubtitle")}
            viewAllLink="/products?isFastDelivery=true"
            viewAllText={t("home.sections.viewFastDelivery")}
          />
          <ProductCarouselRow title="" products={fastDeliveryProducts} viewAllLink="" autoSlide />
        </SectionReveal>
      </section>

      {/* ═══════════════════════════════════════════════════════
          9. CONTACT / NEWSLETTER
      ═══════════════════════════════════════════════════════ */}
      <section className="px-5 py-14 sm:px-8 lg:px-12 lg:py-16">
        <SectionReveal className="mx-auto max-w-[1344px]">
          <div className="grid items-stretch gap-8 lg:grid-cols-2 lg:gap-10">
            <div className="flex flex-col justify-center">
              <div className="inline-flex w-fit items-center rounded-full border border-[var(--xd-gold-border-soft)] bg-white/60 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--xd-gold-active)]">
                X Dental Store
              </div>

              <h2 className="mt-5 max-w-[560px] font-display text-[clamp(28px,3.5vw,44px)] font-semibold leading-[1.1] tracking-[-0.02em] text-[var(--xd-text)]">
                {t("home.contact.headline")}
              </h2>
              <p className="mt-3 max-w-[560px] text-[15px] leading-[24px] text-[var(--xd-muted-2)] sm:text-[16px] sm:leading-[26px]">
                {t("home.contact.body")}
              </p>

              <div className="mt-7 flex flex-col gap-4">
                {HOME_CONTACT_ROWS.map(({ Icon, labelKey, value, href }) => (
                  <div key={labelKey} className="flex min-w-0 items-center gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-text)]">
                      <Icon size={17} strokeWidth={1.75} />
                    </span>
                    <a href={href} className="min-w-0 transition hover:text-[#050505]">
                      <span className="mb-0.5 block text-[11px] text-[var(--xd-muted-2)]">
                        {t(labelKey)}
                      </span>
                      <span dir="ltr" className="block text-[14.5px] font-medium text-[var(--xd-text)]">
                        {value}
                      </span>
                    </a>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex h-full flex-col justify-center rounded-[24px] border border-[var(--xd-gold-border-soft)] bg-white/80 p-6 shadow-[0_16px_42px_rgba(5,5,5,0.045)] sm:p-8 lg:p-9">
              <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--xd-gold-active)]">
                {t("home.contact.newsletterEyebrow")}
              </p>
              <h3 className="mt-2 font-display text-[24px] font-semibold leading-[1.3] text-[#050505]">
                {t("home.contact.newsletterTitle")}
              </h3>
              <p className="mt-3 max-w-[500px] text-[14px] leading-[23px] text-[#717182]">
                {t("home.contact.newsletterBody")}
              </p>

              {submitted ? (
                <div className="mt-6 flex items-center gap-2.5 rounded-[12px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] px-4 py-3.5">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--xd-gold-active)]" />
                  <span className="text-[14px] font-medium text-[#050505]">
                    {t("home.contact.subscribed")}
                  </span>
                </div>
              ) : (
                <form onSubmit={handleNewsletterSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={t("footer.emailPlaceholder")}
                    required
                    className="h-[50px] min-w-0 flex-1 rounded-[12px] border border-[#050505]/10 bg-[var(--xd-bg)]/80 px-4 text-[14px] text-[#050505] outline-none transition focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    className="h-[50px] shrink-0 gap-1.5 px-6 text-[14px] font-semibold"
                  >
                    {t("common.subscribe")}
                    <DirectionalIcon direction="forward" size={15} />
                  </Button>
                </form>
              )}
            </div>
          </div>
        </SectionReveal>
      </section>
    </div>
  );
}

function TrustedBrandsOrbitStroke({
  layer,
  animate,
}: {
  layer: "back" | "front";
  animate: boolean;
}) {
  const isFront = layer === "front";
  const clipId = `trusted-brands-orbit-${layer}-clip`;

  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 m-auto h-full w-full max-w-[540px] ${isFront ? "z-[15]" : "z-[5]"}`}
      preserveAspectRatio="xMidYMid meet"
      viewBox="0 0 1063 1239"
    >
      <defs>
        <clipPath id={clipId}>
          <polygon
            points={isFront
              ? "0,685 1063,554 1063,1239 0,1239"
              : "0,0 1063,0 1063,554 0,685"}
          />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`} opacity={isFront ? 0.72 : 0.3}>
        <path
          d={TRUSTED_BRANDS_ORBIT_PATH}
          fill="none"
          pathLength="100"
          stroke="var(--xd-gold-warm)"
          strokeDasharray="58 42"
          strokeLinecap="round"
          strokeWidth="2.2"
        >
          {animate && (
            <animate
              attributeName="stroke-dashoffset"
              calcMode="linear"
              dur="20s"
              from="0"
              repeatCount="indefinite"
              to="-100"
            />
          )}
        </path>
      </g>
    </svg>
  );
}

function TrustedBrandsOrbitBadge({
  phase,
  label,
}: {
  phase: "primary" | "secondary";
  label: string;
}) {
  return (
    <>
      <span className="sr-only">{label}</span>
      {(["back", "front"] as const).map(depth => (
        <div
          key={depth}
          aria-hidden="true"
          className={`trusted-brands-orbit-badge trusted-brands-orbit-badge--${phase} trusted-brands-orbit-badge--${depth} pointer-events-none flex items-center gap-2 whitespace-nowrap px-3.5 py-2 text-[12px] font-semibold`}
          style={{
            background: "rgba(255,255,255,0.94)",
            border: "1px solid var(--xd-gold-border)",
            borderRadius: 999,
            boxShadow: "0 8px 24px rgba(5,5,5,0.03)",
            color: "var(--xd-text)",
          }}
        >
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: "var(--xd-gold)" }}
          />
          {label}
        </div>
      ))}
    </>
  );
}

function HomeInfoStrip() {
  const { isRtl, t } = useLanguage();
  const items = HOME_INFO_STRIP_KEYS.map(key => t(`home.infoStrip.${key}`));

  return (
    <section className="px-5 sm:px-8 lg:px-12">
      <div
        className="relative mx-auto max-w-[1344px] overflow-hidden border-y border-[#050505]/[0.05] py-5 motion-reduce:overflow-x-auto"
        aria-label={t("home.infoStrip.ariaLabel")}
      >
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-[var(--xd-bg)] to-transparent sm:w-28" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-[var(--xd-bg)] to-transparent sm:w-28" />

        <div
          className="about-value-marquee flex w-max items-center will-change-transform"
          dir="ltr"
        >
          {[false, true].map(isDuplicate => (
            <div
              key={isDuplicate ? "duplicate" : "primary"}
              className="flex shrink-0 items-center"
              aria-hidden={isDuplicate || undefined}
            >
              {items.map((item, index) => (
                <div key={`${item}-${index}`} className="flex shrink-0 items-center">
                  <span
                    dir={isRtl ? "rtl" : "ltr"}
                    className="flex w-[clamp(190px,18vw,290px)] justify-center px-4 text-center text-[14px] font-bold leading-none text-[#050505] sm:text-[15px]"
                  >
                    {item}
                  </span>

                  <span
                    className="flex w-[clamp(54px,5vw,88px)] items-center justify-center"
                    aria-hidden="true"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[#717182]" />
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Brand card sub-component ─────────────────────────────────────────────────

function WhyFeatureCard({
  title,
  body,
  number,
  isActive,
}: {
  title: string;
  body: string;
  number: string;
  isActive: boolean;
}) {
  return (
    <article
      className={`relative flex h-[270px] overflow-hidden rounded-[18px] border bg-white/70 p-6 transition-[border-color,box-shadow,transform] duration-500 sm:h-[300px] ${isActive
          ? "border-[var(--xd-gold-active)]/60 shadow-[var(--xd-shadow-hover)]"
          : "border-[#050505]/10 shadow-none"
        }`}
    >
      <div className="relative z-10">
        <h3 className="mb-3 max-w-[220px] text-[20px] font-semibold leading-[1.12] text-[#050505]">
          {title}
        </h3>

        <p className="max-w-[250px] text-[14px] leading-[23px] text-[#717182]">
          {body}
        </p>
      </div>

      <div
        className={`absolute bottom-[76px] left-6 right-6 h-px transition-colors duration-500 ${isActive ? "bg-[var(--xd-gold)]" : "bg-[#050505]/10"
          }`}
      />

      <span
        className={`pointer-events-none absolute -bottom-[32px] right-3 select-none font-display text-[104px] font-light leading-none transition-colors duration-500 sm:-bottom-[35px] sm:text-[116px] ${isActive ? "text-[var(--xd-gold-active)]" : "text-[#050505]/10"
          }`}
      >
        {number}
      </span>
    </article>
  );
}

function BrandCard({ name }: { name: string }) {
  const logoText = name
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Link
      href="/brands"
      aria-label={`View ${name} products`}
      className="flex h-[122px] w-full flex-col items-center justify-center gap-4 cursor-pointer text-center transition-all duration-200 hover:-translate-y-0.5 focus-visible:-translate-y-0.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      style={{
        padding: "18px 16px",
        borderRadius: 16,
        background: "rgba(255,255,255,0.80)",
        border: "1px solid var(--xd-gold-border-soft)",
        boxShadow: "0 8px 24px rgba(5,5,5,0.035)",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--xd-gold-border-hover)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--xd-gold-border-soft)"; }}
    >
      <div
        className="flex items-center justify-center font-display font-bold text-[11px] shrink-0"
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          background: "var(--xd-gold-bg-soft)",
          color: "var(--xd-text)",
        }}
      >
        {logoText}
      </div>
      <div className="text-[12px] leading-tight" style={{ color: "var(--xd-muted-2)" }}>
        {name}
      </div>
    </Link>
  );
}
