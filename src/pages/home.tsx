import {
  useState,
  useEffect,
  useRef,
  type FormEvent,
  type KeyboardEvent,
  type TouchEvent,
} from "react";
import { Link } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import {
  Check,
  Phone,
  MapPin,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { Button } from "@/components/dental/Button";
import { FlashSaleSection } from "@/components/dental/FlashSaleSection";
import { HeroSlider } from "@/components/dental/hero-slider/HeroSlider";
import { HomeCampaignsSection } from "@/components/dental/HomeCampaignsSection";
import { PaymentPlansSection } from "@/components/dental/PaymentPlansSection";
import { PromotionalFlyerCarousel } from "@/components/dental/PromotionalFlyerCarousel";
import { ScheduledPromotionPlacement } from "@/components/dental/ScheduledPromotionPlacement";
import { ProductCarouselRow } from "@/components/dental/ProductCarouselRow";
import { PremiumAccentIcon } from "@/components/dental/PremiumAccentIcon";
import { SectionReveal } from "@/components/dental/SectionReveal";
import { useCatalog } from "@/context/CatalogContext";
import { useStore } from "@/context/StoreContext";
import { useHeroSlides } from "@/data/heroSlides";
import { PAYMENT_PLAN_PARTNERS } from "@/data/paymentPlans";
import { SEO } from "@/components/SEO";
import { useLanguage } from "@/context/LanguageContext";
import { subscribeToNewsletter } from "@/services/contact";
import { fetchPublicProducts } from "@/services/catalog";
import { ApiError } from "@/services/http";
import { getLocalizedCategoryName } from "@/lib/catalogTranslations";
import { getCategoryIcon } from "@/lib/categoryIcons";
import { useDirectionalNavigation } from "@/hooks/use-directional-navigation";
import {
  DEFAULT_CLINIC_SPECIALTY,
  getClinicEssentialsCategoryNames,
  normalizeClinicSpecialty,
} from "@/lib/clinicSpecialties";
import type { Product } from "@/types/product";

// ─── Static data ──────────────────────────────────────────────────────────────

const CATEGORY_PRESENTATION = [
  { slug: "endodontics", description: "Root canal files, obturation tools, and endodontic essentials." },
  { slug: "hand-instruments", description: "Mirrors, probes, tweezers, and everyday clinical instruments." },
  { slug: "sterilization-disposables", description: "Daily-use products and consumables for smooth clinic operations." },
  { slug: "sterilization-material", description: "Sterilization products for safe, compliant clinical workflows." },
  { slug: "disposable-material", description: "Disposable materials and single-use supplies for daily procedures." },
  { slug: "composites-bonding", description: "Composite, bonding, etching, and finishing products." },
  { slug: "orthodontics", description: "Brackets, wires, elastics, and orthodontic accessories." },
  { slug: "infection-control", description: "Sterilization, disinfection, and protective supplies." },
  { slug: "dental-burs", description: "Burs for cutting, shaping, and finishing procedures." },
  { slug: "burs", description: "Burs for cutting, shaping, and finishing procedures." },
  { slug: "impression-materials", description: "Materials and accessories for precise dental impressions." },
  { slug: "implantology", description: "Implant tools, components, and clinical essentials." },
  { slug: "anesthesia", description: "Anesthetic products and delivery essentials for clinical procedures." },
  { slug: "books", description: "Dental books, references, and educational resources." },
  { slug: "online-courses", description: "Educational resources and courses for dental professionals." },
  { slug: "laboratories", description: "Laboratory materials, tools, and workflow essentials." },
  { slug: "machines", description: "Dental machines and devices for clinic and lab workflows." },
  { slug: "machine-inquiries", description: "Machine and equipment inquiries for clinic procurement." },
];

const FEATURES = [
  { num: "01", titleKey: "home.features.authenticTitle", bodyKey: "home.features.authenticBody" },
  { num: "02", titleKey: "home.features.pricesTitle", bodyKey: "home.features.pricesBody" },
  { num: "03", titleKey: "home.features.deliveryTitle", bodyKey: "home.features.deliveryBody" },
  { num: "04", titleKey: "home.features.rangeTitle", bodyKey: "home.features.rangeBody" },
  { num: "05", titleKey: "home.features.orderingTitle", bodyKey: "home.features.orderingBody" },
  { num: "06", titleKey: "home.features.supportTitle", bodyKey: "home.features.supportBody" },
];

type FeatureRtlScrollModel = "negative" | "reverse" | "default";

let featureRtlScrollModel: FeatureRtlScrollModel | null = null;

function getFeatureRtlScrollModel(): FeatureRtlScrollModel {
  if (featureRtlScrollModel) return featureRtlScrollModel;

  const container = document.createElement("div");
  const content = document.createElement("div");
  container.dir = "rtl";
  container.style.cssText =
    "position:absolute;top:-9999px;width:4px;height:1px;overflow:scroll;visibility:hidden;";
  content.style.cssText = "width:8px;height:1px;";
  container.appendChild(content);
  document.body.appendChild(container);

  if (container.scrollLeft > 0) {
    featureRtlScrollModel = "default";
  } else {
    container.scrollLeft = 1;
    featureRtlScrollModel = container.scrollLeft === 0 ? "negative" : "reverse";
  }

  document.body.removeChild(container);
  return featureRtlScrollModel;
}

function scrollFeatureViewport(
  viewport: HTMLDivElement,
  logicalLeft: number,
  behavior: ScrollBehavior
) {
  const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
  const clampedLeft = Math.max(0, Math.min(logicalLeft, maxScrollLeft));

  switch (getFeatureRtlScrollModel()) {
    case "default":
      viewport.scrollTo({ left: maxScrollLeft - clampedLeft, behavior });
      return;
    case "reverse":
      viewport.scrollTo({ left: clampedLeft, behavior });
      return;
    case "negative":
    default:
      viewport.scrollTo({ left: -clampedLeft, behavior });
  }
}

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

const HOME_TRUSTED_BRAND_COUNT = 8;
const HOME_TRUSTED_BRAND_LEFT_COUNT = 3;
const HOME_TRUSTED_BRAND_PRIORITY_SLUGS = [
  "voco",
  "ultradent",
  "shofu",
  "tokuyama-dental",
  "zhermack",
  "fgm",
  "bisco",
  "kulzer",
  "acteon",
  "angelus",
  "bausch",
  "carestream",
  "dentaurum",
  "meta-biomed",
  "dmg",
  "fkg",
];
const HOME_TRUSTED_BRAND_EXCLUDED_SLUGS = new Set([
  "septodont",
  "kerr",
  "gc",
  "gc-corporation",
  "nsk",
  "refine-nsk",
  "ivoclar-vivadent",
  "woodpecker",
]);
const HOME_TRUSTED_BRAND_EXCLUDED_NAME_KEYS = new Set([
  "septodont",
  "kerr",
  "gc",
  "gccorporation",
  "nsk",
  "ivoclarvivadent",
  "woodpecker",
]);
const HOME_TRUSTED_BRAND_EXCLUDED_TOKENS = new Set([
  "septodont",
  "kerr",
  "gc",
  "nsk",
  "ivoclar",
  "vivadent",
  "woodpecker",
]);
const TRUSTED_BRANDS_ORBIT_PATH = "M 1037.91 557.55 C 1041.95 590.51 818.51 644.9 538.83 679.1 C 259.16 713.29 29.13 714.41 25.09 681.45 C 21.05 648.49 244.49 594.1 524.17 559.9 C 803.84 525.71 1033.87 524.59 1037.91 557.55";
type TestimonialCopy = {
  en: string;
  ar: string;
};

type HomeTestimonial = {
  id: string;
  row: 1 | 2;
  name: TestimonialCopy;
  role: TestimonialCopy;
  message: TestimonialCopy;
  rating: number;
};

type HomeTrustedBrand = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
};

function normalizeBrandKey(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

function getBrandTokens(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function isHomeTrustedBrandExcluded(brand: HomeTrustedBrand) {
  const slug = brand.slug.trim().toLowerCase();
  const nameKey = normalizeBrandKey(brand.name);
  const tokens = new Set([...getBrandTokens(brand.name), ...getBrandTokens(brand.slug)]);

  return (
    HOME_TRUSTED_BRAND_EXCLUDED_SLUGS.has(slug) ||
    HOME_TRUSTED_BRAND_EXCLUDED_NAME_KEYS.has(nameKey) ||
    [...HOME_TRUSTED_BRAND_EXCLUDED_TOKENS].some(token => tokens.has(token))
  );
}

function getTrustedBrandLogoUrl(brand: HomeTrustedBrand) {
  const logoUrl = brand.logoUrl?.trim();
  return logoUrl || null;
}

function getBrandInitials(name: string) {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function selectHomeTrustedBrands(brands: HomeTrustedBrand[]) {
  const bySlug = new Map(brands.map((brand) => [brand.slug.trim().toLowerCase(), brand]));
  const selected: HomeTrustedBrand[] = [];
  const selectedSlugs = new Set<string>();
  const add = (brand?: HomeTrustedBrand, requireLogo = true) => {
    const slug = brand?.slug.trim().toLowerCase();
    if (!brand || selected.length >= HOME_TRUSTED_BRAND_COUNT) return;
    if (!slug || selectedSlugs.has(slug) || isHomeTrustedBrandExcluded(brand)) return;
    if (requireLogo && !getTrustedBrandLogoUrl(brand)) return;

    selected.push(brand);
    selectedSlugs.add(slug);
  };

  for (const slug of HOME_TRUSTED_BRAND_PRIORITY_SLUGS) add(bySlug.get(slug));
  for (const brand of brands) add(brand);
  for (const brand of brands) add(brand, false);

  return selected.slice(0, HOME_TRUSTED_BRAND_COUNT);
}

// Edit this array to update the client messages shown on the Home page.
const HOME_TESTIMONIALS: HomeTestimonial[] = [
  {
    id: "mariam-hassan",
    row: 1,
    name: { en: "Dr. Mariam Hassan", ar: "د. مريم حسن" },
    role: { en: "Dentist", ar: "طبيبة أسنان" },
    message: {
      en: "The order arrived carefully packed, and every item matched the product details exactly.",
      ar: "وصل الطلب بتغليف ممتاز، وكانت كل المنتجات مطابقة للتفاصيل تمامًا.",
    },
    rating: 5,
  },
  {
    id: "omar-clinic",
    row: 1,
    name: { en: "Omar Dental Clinic", ar: "عيادة عمر للأسنان" },
    role: { en: "Clinic", ar: "عيادة" },
    message: {
      en: "Fast communication and dependable delivery made restocking the clinic much easier.",
      ar: "سرعة التواصل والالتزام في التوصيل جعلا تجهيز العيادة أسهل بكثير.",
    },
    rating: 5,
  },
  {
    id: "youssef-adel",
    row: 1,
    name: { en: "Dr. Youssef Adel", ar: "د. يوسف عادل" },
    role: { en: "Orthodontist", ar: "طبيب تقويم أسنان" },
    message: {
      en: "Clear product information, fair pricing, and helpful support whenever I had a question.",
      ar: "معلومات المنتجات واضحة، والأسعار مناسبة، والدعم متعاون في كل استفسار.",
    },
    rating: 5,
  },
  {
    id: "nour-salem",
    row: 1,
    name: { en: "Dr. Nour Salem", ar: "د. نور سالم" },
    role: { en: "Dentist", ar: "طبيبة أسنان" },
    message: {
      en: "A smooth ordering experience with professional service from selection through delivery.",
      ar: "تجربة طلب سلسة وخدمة احترافية من اختيار المنتجات وحتى الاستلام.",
    },
    rating: 5,
  },
  {
    id: "smile-care",
    row: 2,
    name: { en: "Smile Care Center", ar: "مركز سمايل كير" },
    role: { en: "Dental Center", ar: "مركز أسنان" },
    message: {
      en: "The team helped us find the right supplies quickly, and the full order arrived on time.",
      ar: "ساعدنا الفريق في اختيار المستلزمات المناسبة بسرعة، ووصل الطلب كاملًا في موعده.",
    },
    rating: 5,
  },
  {
    id: "ahmed-fathy",
    row: 2,
    name: { en: "Dr. Ahmed Fathy", ar: "د. أحمد فتحي" },
    role: { en: "Clinic Owner", ar: "مدير عيادة" },
    message: {
      en: "Consistent quality and responsive support. X Dental has become a trusted supplier for us.",
      ar: "جودة ثابتة ودعم سريع. أصبح إكس دنتال من الموردين الموثوقين لدينا.",
    },
    rating: 5,
  },
  {
    id: "reem-mahmoud",
    row: 2,
    name: { en: "Dr. Reem Mahmoud", ar: "د. ريم محمود" },
    role: { en: "Dentist", ar: "طبيبة أسنان" },
    message: {
      en: "I appreciated the quick follow-up and the care taken with delicate materials in my order.",
      ar: "أقدّر سرعة المتابعة والاهتمام بتغليف المواد الحساسة داخل طلبي.",
    },
    rating: 5,
  },
  {
    id: "bright-dental",
    row: 2,
    name: { en: "Bright Dental Clinic", ar: "عيادة برايت دنتال" },
    role: { en: "Clinic", ar: "عيادة" },
    message: {
      en: "Reliable stock, straightforward ordering, and service that understands clinic priorities.",
      ar: "توافر موثوق للمنتجات، وطلب سهل، وخدمة تفهم احتياجات العيادات.",
    },
    rating: 5,
  },
];

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

const HOME_SECTION_PRODUCT_LIMIT = 12;

export default function Home() {
  const { isRtl, t, language } = useLanguage();
  const { actionForKey, controlOrder } = useDirectionalNavigation();
  const {
    categoryTree,
    brands: catalogBrands,
    isLoading: isCatalogLoading,
    error: catalogError,
  } = useCatalog();
  const { currentUser, isAuthenticated } = useStore();
  const prefersReducedMotion = useReducedMotion();
  const trustedBrandsImage = `${import.meta.env.BASE_URL}hero%20section/brandsImg.png`;
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [clinicEssentialsProducts, setClinicEssentialsProducts] = useState<Product[]>([]);
  const [fastDeliveryProducts, setFastDeliveryProducts] = useState<Product[]>([]);
  const weeklyOfferProducts = featuredProducts;
  const bestSellerProducts = featuredProducts;
  const hasClinicSpecialty = Boolean(currentUser?.clinicSpecialty?.trim());
  const activeClinicSpecialty = isAuthenticated && hasClinicSpecialty
    ? normalizeClinicSpecialty(currentUser?.clinicSpecialty)
    : DEFAULT_CLINIC_SPECIALTY;

  // Small, bounded fetch: the "featured" flag backs both the Weekly Offers
  // and Best Sellers rows (they've always shared the same source list), so
  // one fetch of up to 12 products covers both sections. Falls back to an
  // unfiltered small page if nothing is marked featured yet.
  useEffect(() => {
    const controller = new AbortController();
    fetchPublicProducts({ featured: true, limit: HOME_SECTION_PRODUCT_LIMIT, signal: controller.signal })
      .then(async ({ products }) => {
        if (controller.signal.aborted) return;
        if (products.length > 0) {
          setFeaturedProducts(products);
          return;
        }
        const fallback = await fetchPublicProducts({ limit: HOME_SECTION_PRODUCT_LIMIT, signal: controller.signal });
        if (!controller.signal.aborted) setFeaturedProducts(fallback.products);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // Fast Delivery row: mirrors the previous behavior of showing the first
  // small batch of available products (not actually filtered by a delivery
  // flag — that flag is never set by any importer today).
  useEffect(() => {
    const controller = new AbortController();
    fetchPublicProducts({ availability: "available", limit: HOME_SECTION_PRODUCT_LIMIT, signal: controller.signal })
      .then(({ products }) => {
        if (!controller.signal.aborted) setFastDeliveryProducts(products);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // Clinic Essentials: resolve the specialty's category names client-side
  // (categoryTree is small, already-loaded metadata) then ask the server for
  // a bounded page of matching, available products.
  useEffect(() => {
    if (categoryTree.length === 0) {
      setClinicEssentialsProducts([]);
      return;
    }
    const categoryNames = [...getClinicEssentialsCategoryNames(categoryTree, activeClinicSpecialty)];
    if (categoryNames.length === 0) {
      setClinicEssentialsProducts([]);
      return;
    }
    const controller = new AbortController();
    fetchPublicProducts({
      categories: categoryNames,
      availability: "available",
      limit: HOME_SECTION_PRODUCT_LIMIT,
      signal: controller.signal,
    })
      .then(({ products }) => {
        if (!controller.signal.aborted) setClinicEssentialsProducts(products);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [categoryTree, activeClinicSpecialty]);

  const clinicEssentialsTitle = isAuthenticated && hasClinicSpecialty
    ? t("home.sections.clinicEssentialsPersonalizedTitle", {
        fallback: "Clinic Essentials for {specialty}",
        values: { specialty: activeClinicSpecialty },
      })
    : t("home.sections.clinicEssentialsTitle", { fallback: "Clinic Essentials" });
  const clinicEssentialsSubtitle = isAuthenticated && hasClinicSpecialty
    ? t("home.sections.clinicEssentialsPersonalizedSubtitle", {
        fallback: "Recommended supplies based on your clinic specialty.",
      })
    : isAuthenticated
      ? t("home.sections.clinicEssentialsMissingSpecialtySubtitle", {
          fallback: "Showing a general clinic selection. Choose your clinic specialty in your profile for relevant products.",
        })
      : t("home.sections.clinicEssentialsSubtitle", {
          fallback: "Popular supplies trusted by dental clinics.",
        });
  const trustedBrandCards = selectHomeTrustedBrands(catalogBrands);
  const leftTrustedBrands = trustedBrandCards.slice(0, HOME_TRUSTED_BRAND_LEFT_COUNT);
  const rightTrustedBrands = trustedBrandCards.slice(HOME_TRUSTED_BRAND_LEFT_COUNT);
  // Home cards show the main categories from the tree; counts include subs.
  const homeCategories = categoryTree.slice(0, 9).map((category) => {
    const presentation = CATEGORY_PRESENTATION.find((item) => item.slug === category.slug);
    return {
      ...category,
      icon: getCategoryIcon(category.slug, category.name),
      count: String(category.productCount),
      description: category.description || presentation?.description || "Dental products and clinic supplies.",
    };
  });

  // Feature-card auto-slider
  const [activeFeature, setActiveFeature] = useState(0);
  const [featureStep, setFeatureStep] = useState(0);
  const [featureTransitionEnabled, setFeatureTransitionEnabled] = useState(true);
  const featureViewportRef = useRef<HTMLDivElement>(null);
  const featureTrackRef = useRef<HTMLDivElement>(null);
  const featureTouchStartXRef = useRef<number | null>(null);
  const visibleFeatureCount = 3;
  const featureCards = [...FEATURES, ...FEATURES.slice(0, visibleFeatureCount)];
  const activeFeatureDot = activeFeature % FEATURES.length;

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
    if (!isRtl) {
      featureViewportRef.current?.scrollTo({ left: 0, behavior: "auto" });
      return;
    }

    setFeatureTransitionEnabled(false);
    setActiveFeature(0);
    const transitionFrame = window.requestAnimationFrame(() => {
      setFeatureTransitionEnabled(true);
    });

    return () => window.cancelAnimationFrame(transitionFrame);
  }, [isRtl]);

  useEffect(() => {
    if (!isRtl) return;

    const scrollFrame = window.requestAnimationFrame(() => {
      const viewport = featureViewportRef.current;
      if (!viewport) return;

      scrollFeatureViewport(
        viewport,
        activeFeature * featureStep,
        featureTransitionEnabled && !prefersReducedMotion ? "smooth" : "auto"
      );
    });

    return () => window.cancelAnimationFrame(scrollFrame);
  }, [activeFeature, featureStep, featureTransitionEnabled, isRtl, prefersReducedMotion]);

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

  const handleFeatureKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!isRtl) return;
    const action = actionForKey(event.key);
    if (!action) return;
    event.preventDefault();

    if (action === "next") {
      handleFeatureNext();
    } else {
      handleFeaturePrev();
    }
  };

  const handleFeatureTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (!isRtl) return;
    featureTouchStartXRef.current = event.touches[0]?.clientX ?? null;
  };

  const handleFeatureTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (!isRtl) return;

    const startX = featureTouchStartXRef.current;
    featureTouchStartXRef.current = null;
    if (startX === null) return;

    const endX = event.changedTouches[0]?.clientX;
    if (endX === undefined) return;

    const deltaX = endX - startX;
    if (Math.abs(deltaX) < 40) return;

    const moveNext = deltaX > 0;
    if (moveNext) {
      handleFeatureNext();
    } else {
      handleFeaturePrev();
    }
  };

  const featureNavigationControls = controlOrder.map((direction) => ({
    id: direction,
    action: direction === "next" ? handleFeatureNext : handleFeaturePrev,
    label: direction === "next"
      ? t("common.nextFeature", { fallback: "Next feature cards" })
      : t("common.previousFeature", { fallback: "Previous feature cards" }),
    direction,
  }));

  const heroSlides = useHeroSlides();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);

  // Stores the subscriber via POST /api/newsletter/subscribe; the confirmation
  // is only shown after the backend saves the email.
  const handleNewsletterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubscribing) return;
    const website = String(new FormData(event.currentTarget).get("website") ?? "").trim();

    setIsSubscribing(true);
    setSubscribeError(null);
    try {
      await subscribeToNewsletter({ email, source: "home", locale: language, website });
      setSubmitted(true);
      setEmail("");
    } catch (error) {
      setSubscribeError(
        error instanceof ApiError && error.status !== 0
          ? error.message
          : t("home.contact.subscribeError", {
              fallback: "The subscription could not be completed. Please try again.",
            })
      );
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--xd-bg)" }}>
      <SEO page="home" />

      {/* ═══════════════════════════════════════════════════════
          1. HERO — wrapped in premium white card
      ═══════════════════════════════════════════════════════ */}
      <section className="px-5 pb-10 pt-6 sm:px-8 lg:px-12 lg:pb-12 lg:pt-8">
        <div className="max-w-[1344px] mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="relative overflow-visible"
          >
            <HeroSlider slides={heroSlides} />
          </motion.div>
        </div>
      </section>

      <HomeInfoStrip />

      {/* Decorative "X Dental" background wordmark — sits below the payment strip */}
      {/* <div className="overflow-hidden px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
        <div
          className="pointer-events-none select-none text-center font-display font-bold leading-none whitespace-nowrap"
          style={{
            fontSize: "clamp(80px, 16vw, 210px)",
            color: "rgba(5,5,5,0.016)",
            letterSpacing: "-0.04em",
          }}
        >
          X Dental
        </div>
      </div> */}

      <HomeCampaignsSection />

      <ScheduledPromotionPlacement
        placement="HOMEPAGE_PROMOTION_CARD"
        className="mx-5 my-8 sm:mx-8 lg:mx-auto lg:w-[calc(100%-6rem)] lg:max-w-[1344px]"
      />

      {/* ═══════════════════════════════════════════════════════
          2. CATEGORIES
      ═══════════════════════════════════════════════════════ */}
      <section className="py-20 lg:py-24 px-5 sm:px-8 lg:px-12" style={{ background: "var(--xd-bg)" }}>
        <SectionReveal className="max-w-[1344px] mx-auto">
          {/* Editorial heading */}
          <div className="mx-auto mb-12 max-w-[680px] text-center">
            <div className="text-[13px] font-medium uppercase tracking-[0.1em] mb-5"
              style={{ color: "var(--xd-muted-2)" }}>
              {t("nav.categories")}
            </div>
            <h2 className="font-display tracking-tight"
              style={{ fontSize: "clamp(30px, 3.8vw, 50px)", lineHeight: 1.14, letterSpacing: "-0.02em" }}>
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
            {homeCategories.map((cat) => {
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
                      className="xd-accent-icon-surface xd-icon-card-surface flex shrink-0 items-center justify-center"
                      style={{
                        width: 50, height: 50,
                        borderRadius: 15,
                      }}
                    >
                      <PremiumAccentIcon icon={Icon} size={23} strokeWidth={1.6} />
                    </div>

                    <div className="mt-4">
                      <h3 className="font-display font-semibold leading-tight mb-1.5"
                        style={{ fontSize: 18, color: "var(--xd-text)" }}>
                        {getLocalizedCategoryName(cat, language, t)}
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
          {isCatalogLoading ? <div className="h-[330px] animate-pulse rounded-[24px] bg-white/65" /> : catalogError ? <div role="alert" className="rounded-[24px] border border-[#F2C8C8] bg-[#FFF3F3] p-6 text-center text-sm text-[#B42318]">{catalogError}</div> : weeklyOfferProducts.length ? <ProductCarouselRow title="" products={weeklyOfferProducts} viewAllLink="" autoSlide /> : <p className="rounded-[24px] bg-white/65 p-8 text-center text-sm text-[#717182]">{t("products.noProductsBody")}</p>}
        </SectionReveal>
      </section>

      <FlashSaleSection />

      <PaymentPlansSection />

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
                fontSize: "clamp(36px, 4.6vw, 56px)",
                fontWeight: 300,
                lineHeight: 1.15,
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

          <div onKeyDown={handleFeatureKeyDown}>
            <div
              ref={featureViewportRef}
              className="overflow-hidden"
              onTouchStart={handleFeatureTouchStart}
              onTouchEnd={handleFeatureTouchEnd}
            >
              <div
                ref={featureTrackRef}
                data-rtl-carousel="home-features"
                dir={isRtl ? "rtl" : "ltr"}
                className="flex gap-6"
                style={{
                  transform: isRtl
                    ? "none"
                    : `translate3d(${-activeFeature * featureStep}px, 0, 0)`,
                  transition: !isRtl && featureTransitionEnabled && !prefersReducedMotion
                    ? "transform 720ms cubic-bezier(0.22, 1, 0.36, 1)"
                    : "none",
                  willChange: !isRtl && !prefersReducedMotion ? "transform" : "auto",
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

            <div className="flex items-center" dir="ltr" style={{ gap: 12, marginTop: 40 }}>
              {featureNavigationControls.map((control) => (
                <Button
                  key={control.id}
                  type="button"
                  onClick={control.action}
                  variant="secondary"
                  size="icon"
                  className="h-12 w-12"
                  aria-label={control.label}
                >
                  <DirectionalIcon direction={control.direction} size={18} />
                </Button>
              ))}

              <div className="flex items-center" style={{ gap: 6, marginInlineStart: 8 }}>
                {FEATURES.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleFeatureDotClick(i)}
                    aria-label={isRtl ? `عرض الميزة ${i + 1}` : `Show feature ${i + 1}`}
                    aria-current={i === activeFeatureDot ? "true" : undefined}
                    style={{
                      width: i === activeFeatureDot ? 20 : 6,
                      height: 6,
                      borderRadius: 999,
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                    }}
                    className={`transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--xd-bg)] ${
                      i === activeFeatureDot ? "xd-gradient-gold" : "bg-[var(--xd-border-strong)]"
                    }`}
                  />
                ))}
              </div>
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
                  {leftTrustedBrands.map(brand => (
                    <BrandCard key={brand.id} brand={brand} />
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

                  <TrustedBrandsOrbitStroke layer="back" />

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

                  <TrustedBrandsOrbitStroke layer="front" />
                </div>

                <Link
                  href="/brands"
                  className="xd-gradient-primary-button inline-flex items-center gap-2 font-semibold hover:-translate-y-px focus-visible:-translate-y-px outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  style={{
                    height: 46,
                    padding: "0 24px",
                    borderRadius: 999,
                    background: "var(--xd-gold-gradient)",
                    color: "var(--xd-gold-foreground)",
                    fontSize: 14,
                    boxShadow: "var(--xd-gold-gradient-shadow)",
                  }}
                >
                  {t("footer.links.trustedBrands")}
                  <DirectionalIcon direction="forward" size={15} />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-5 lg:self-center">
                {rightTrustedBrands.map(brand => (
                  <BrandCard key={brand.id} brand={brand} />
                ))}
              </div>
            </div>
          </SectionReveal>
        </div>
      </section>

      <PromotionalFlyerCarousel />

      {/* ═══════════════════════════════════════════════════════
          7. RECOMMENDED
      ═══════════════════════════════════════════════════════ */}
      <section className="py-20 px-5 sm:px-8 lg:px-12" style={{ background: "var(--xd-bg)" }}>
        <SectionReveal className="max-w-[1344px] mx-auto">
          <SectionHeader
            title={clinicEssentialsTitle}
            subtitle={clinicEssentialsSubtitle}
            viewAllLink="/products?collection=clinic-essentials"
            viewAllText={t("common.viewAll")}
          />
          {clinicEssentialsProducts.length > 0 ? (
            <ProductCarouselRow title="" products={clinicEssentialsProducts} viewAllLink="" autoSlide />
          ) : (
            <p className="rounded-[24px] border border-[var(--xd-gold-border-soft)] bg-white/65 p-8 text-center text-sm text-[#717182]">
              {isAuthenticated && hasClinicSpecialty
                ? t("home.sections.clinicEssentialsEmptyPersonalized", {
                    fallback: "No products are currently assigned to your specialty. This collection will update when matching catalog products are available.",
                  })
                : isAuthenticated
                  ? t("home.sections.clinicEssentialsEmptyMissingSpecialty", {
                      fallback: "No general clinic essentials are available yet. Choose your clinic specialty in your profile for relevant products when they are added.",
                    })
                : t("home.sections.clinicEssentialsEmptyGuest", {
                    fallback: "General clinic essentials will appear here when matching catalog products are available. Sign in to use your clinic specialty.",
                  })}
            </p>
          )}
        </SectionReveal>
      </section>

      {/* ═══════════════════════════════════════════════════════
          8. FAST DELIVERY
      ═══════════════════════════════════════════════════════ */}
      <section className="relative bg-[var(--xd-bg)] py-20 px-5 sm:px-8 lg:px-12 dark:bg-[#0A0A0A]">
        <GoldMeshBackdrop variant="a" />
        <SectionReveal className="relative z-10 max-w-[1344px] mx-auto">
          <SectionHeader
            title={t("home.sections.fastDeliveryTitle")}
            subtitle={t("home.sections.fastDeliverySubtitle")}
            viewAllLink="/products?isFastDelivery=true"
            viewAllText={t("home.sections.viewFastDelivery")}
          />
          <ProductCarouselRow title="" products={fastDeliveryProducts} viewAllLink="" autoSlide />
        </SectionReveal>
      </section>

      <TestimonialsSection
        isRtl={isRtl}
        prefersReducedMotion={Boolean(prefersReducedMotion)}
      />

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
                    <span className="xd-accent-icon-surface xd-icon-card-surface flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
                      <PremiumAccentIcon icon={Icon} size={17} strokeWidth={1.75} />
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
                <>
                  <form onSubmit={handleNewsletterSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-10000px] h-px w-px overflow-hidden" />
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setSubscribeError(null);
                      }}
                      placeholder={t("footer.emailPlaceholder")}
                      required
                      className="h-[50px] min-w-0 flex-1 rounded-[12px] border border-[#050505]/10 bg-[var(--xd-bg)]/80 px-4 text-[14px] text-[#050505] outline-none transition focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10"
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={isSubscribing}
                      className="h-[50px] shrink-0 gap-1.5 px-6 text-[14px] font-semibold"
                    >
                      {t("common.subscribe")}
                      <DirectionalIcon direction="forward" size={15} />
                    </Button>
                  </form>
                  {subscribeError && (
                    <p role="alert" className="mt-3 text-[13px] font-semibold text-[#B42318]">
                      {subscribeError}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </SectionReveal>
      </section>
    </div>
  );
}

// Premium dark-mode mesh backdrop: asymmetric blurred gold/amber/champagne
// blobs over a near-black base, used in place of a single centered glow.
function GoldMeshBackdrop({ variant = "a" }: { variant?: "a" | "b" }) {
  const flipped = variant === "b";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 hidden overflow-hidden dark:block"
    >
      <div
        className={`absolute h-75 w-115 rounded-full blur-[110px] sm:h-130 sm:w-155 sm:blur-[150px] ${
          flipped
            ? "-right-24 -top-32 bg-[#D9A90F]/18"
            : "-left-24 -top-32 bg-[#F2D24B]/18"
        }`}
      />
      <div
        className={`absolute h-70 w-110 rounded-full blur-[100px] sm:h-115 sm:w-150 sm:blur-[140px] ${
          flipped
            ? "-left-20 -bottom-40 bg-[#F2D24B]/16"
            : "-right-20 -bottom-40 bg-[#D9A90F]/16"
        }`}
      />
      <div
        className={`absolute left-1/2 h-60 w-105 -translate-x-1/2 rounded-full bg-[#F7E9C6]/6 blur-[100px] sm:h-75 sm:w-140 sm:blur-[120px] ${
          flipped ? "top-[35%]" : "top-[42%]"
        } -translate-y-1/2`}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_38%,rgba(0,0,0,0.5)_100%)]" />
    </div>
  );
}

function TestimonialsSection({
  isRtl,
  prefersReducedMotion,
}: {
  isRtl: boolean;
  prefersReducedMotion: boolean;
}) {
  const copy = (value: TestimonialCopy) => value[isRtl ? "ar" : "en"];
  const rows = ([1, 2] as const).map(row => HOME_TESTIMONIALS.filter(item => item.row === row));

  return (
    <section
      className="home-testimonials relative bg-[var(--xd-bg)] py-20 pb-16 sm:py-24 sm:pb-20 dark:bg-[#0A0A0A]"
      aria-labelledby="home-testimonials-title"
    >
      <SectionReveal className="relative z-10 mx-auto max-w-[1344px] px-5 text-center sm:px-8 lg:px-12">
        <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#D9A90F]">
          X Dental Store
        </p>
        <h2
          id="home-testimonials-title"
          className="mt-4 font-display text-[clamp(30px,4vw,50px)] font-semibold leading-[1.1] tracking-[-0.02em] text-[var(--xd-text)] dark:text-white"
        >
          {isRtl ? "آراء عملائنا" : "What our clients say"}
        </h2>
        <p className="mx-auto mt-4 max-w-[620px] text-[15px] leading-7 text-[var(--xd-text-muted)] dark:text-white/60 sm:text-[16px]">
          {isRtl
            ? "رسائل وتجارب حقيقية من عملائنا مع المتجر."
            : "Real feedback from customers who trusted X Dental Store."}
        </p>
      </SectionReveal>

      <div className="relative mt-12 space-y-4 sm:mt-14 sm:space-y-5" dir="ltr">
        {rows.map((items, rowIndex) => (
          <div
            key={rowIndex}
            className="home-testimonial-row overflow-x-hidden overflow-y-visible py-3 pb-4"
            aria-label={isRtl ? `الصف ${rowIndex + 1} من آراء العملاء` : `Client testimonial row ${rowIndex + 1}`}
          >
            <div
              className={`home-testimonial-track ${rowIndex === 1 ? "home-testimonial-track--reverse" : ""} ${prefersReducedMotion ? "home-testimonial-track--static" : ""}`}
            >
              {[false, true].map(isDuplicate => (
                <div
                  key={isDuplicate ? "duplicate" : "primary"}
                  className="home-testimonial-group"
                  aria-hidden={isDuplicate || undefined}
                >
                  {items.map(item => (
                    <article
                      key={item.id}
                      dir={isRtl ? "rtl" : "ltr"}
                      className="home-testimonial-card flex flex-col justify-between rounded-[22px] border border-[var(--xd-gold-border-soft)] bg-white/90 p-6 text-start shadow-[0_8px_24px_rgba(0,0,0,0.05)] backdrop-blur-xl sm:p-7 dark:border-[#F2D24B]/20 dark:bg-[#0B0B0A] dark:shadow-[0_18px_30px_rgba(0,0,0,0.22)]"
                    >
                      <div>
                        <div
                          className="mb-4 tracking-[0.14em] text-[#F2D24B]"
                          role="img"
                          aria-label={isRtl ? `التقييم ${item.rating} من 5` : `${item.rating} out of 5 stars`}
                        >
                          <span aria-hidden="true">{"★".repeat(item.rating)}</span>
                        </div>
                        <p className="text-[15px] leading-7 text-[var(--xd-text)] dark:text-white/75 sm:text-[16px]">
                          “{copy(item.message)}”
                        </p>
                      </div>

                      <div className="mt-6 border-t border-[var(--xd-gold-border-soft)] pt-4 dark:border-white/[0.08]">
                        <p className="text-[14px] font-bold text-[var(--xd-text)] dark:text-white sm:text-[15px]">
                          {copy(item.name)}
                        </p>
                        <p className="mt-1 text-[12px] font-medium text-[#D9A90F]">
                          {copy(item.role)}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TrustedBrandsOrbitStroke({
  layer,
}: {
  layer: "back" | "front";
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
      {isFront && (
        <defs>
          <clipPath id={clipId}>
            <polygon points="0,685 1063,554 1063,1239 0,1239" />
          </clipPath>
        </defs>
      )}

      <g
        clipPath={isFront ? `url(#${clipId})` : undefined}
        opacity={isFront ? 0.78 : 0.68}
      >
        <path
          d={TRUSTED_BRANDS_ORBIT_PATH}
          fill="none"
          stroke="var(--xd-gold-warm)"
          strokeLinecap="round"
          strokeWidth="2.2"
        />
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

  return (
    <section className="px-5 sm:px-8 lg:px-12">
      <div
        className="payment-partner-strip mx-auto max-w-[1344px] overflow-hidden"
        aria-label={t("home.infoStrip.ariaLabel")}
      >
        <div className="relative overflow-hidden py-4 motion-reduce:overflow-x-auto sm:py-4.5">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[var(--xd-bg)] to-transparent sm:w-16" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[var(--xd-bg)] to-transparent sm:w-16" />

          <div
            className={`payment-partner-marquee flex w-max items-center will-change-transform ${
              isRtl ? "payment-partner-marquee--rtl" : ""
            }`}
            dir="ltr"
            data-payment-partner-direction={isRtl ? "rtl" : "ltr"}
          >
            {[false, true].map(isDuplicate => (
              <div
                key={isDuplicate ? "duplicate" : "primary"}
                className={`payment-partner-marquee-group flex shrink-0 items-center ${
                  isRtl ? "flex-row-reverse" : ""
                } ${
                  isDuplicate ? "motion-reduce:hidden" : ""
                }`}
                aria-hidden={isDuplicate || undefined}
              >
                {PAYMENT_PLAN_PARTNERS.map(partner => (
                  <div
                    key={partner.name}
                    className="payment-partner-marquee-item flex h-9 w-[clamp(154px,20vw,268.8px)] shrink-0 items-center justify-center px-8 sm:h-10 sm:px-10 lg:px-12"
                  >
                    <img
                      src={`${import.meta.env.BASE_URL}${partner.logo}`}
                      alt={isDuplicate ? "" : `${partner.name} logo`}
                      width={partner.logoWidth}
                      height={partner.logoHeight}
                      className="h-6 max-w-full object-contain sm:h-7"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
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
      className={`home-feature-card relative flex h-[270px] overflow-hidden rounded-[18px] border p-6 transition-[border-color,box-shadow,transform] duration-500 sm:h-[300px] ${isActive
          ? "home-feature-card--active shadow-[var(--xd-shadow-hover)]"
          : "shadow-none"
        }`}
    >
      <div className="relative z-10">
        <h3 className="mb-3 max-w-[220px] text-[20px] font-semibold leading-[1.12] text-[var(--xd-text)]">
          {title}
        </h3>

        <p className="max-w-[250px] text-[14px] leading-[23px] text-[var(--xd-text-muted)]">
          {body}
        </p>
      </div>

      <div
        className="home-feature-divider absolute bottom-[76px] left-6 right-6 h-px transition-opacity duration-500"
      />

      <span
        className="home-feature-number pointer-events-none absolute -bottom-[32px] right-3 select-none font-display text-[104px] font-light leading-none transition-opacity duration-500 sm:-bottom-[35px] sm:text-[116px]"
      >
        {number}
      </span>
    </article>
  );
}

function BrandCard({ brand }: { brand: HomeTrustedBrand }) {
  const { t } = useLanguage();
  const [logoFailed, setLogoFailed] = useState(false);
  const logoUrl = getTrustedBrandLogoUrl(brand);
  const showLogo = Boolean(logoUrl) && !logoFailed;

  return (
    <Link
      href={`/products?brand=${brand.slug}`}
      aria-label={t("home.sections.viewBrandProductsAriaLabel", { values: { brand: brand.name } })}
      title={brand.name}
      className="flex h-[122px] w-full flex-col items-center justify-center gap-3 cursor-pointer text-center transition-all duration-200 hover:-translate-y-0.5 focus-visible:-translate-y-0.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      style={{
        padding: "16px 14px",
        borderRadius: 16,
        background: "rgba(255,255,255,0.80)",
        border: "1px solid var(--xd-gold-border-soft)",
        boxShadow: "0 8px 24px rgba(5,5,5,0.035)",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--xd-gold-border-hover)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--xd-gold-border-soft)"; }}
    >
      <div
        className="flex h-[58px] w-full max-w-[150px] shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-white/70 px-3 py-2"
        style={{ border: "1px solid rgba(200, 164, 92, 0.10)" }}
      >
        {showLogo ? (
          <img
            src={logoUrl ?? undefined}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <span
            className="flex h-[42px] min-w-[42px] items-center justify-center rounded-[12px] px-2 font-display text-[11px] font-bold"
            style={{
              background: "var(--xd-gold-bg-soft)",
              color: "var(--xd-text)",
            }}
          >
            {getBrandInitials(brand.name)}
          </span>
        )}
      </div>
      <div className="line-clamp-2 text-[12px] font-medium leading-tight" style={{ color: "var(--xd-muted-2)" }}>
        {brand.name}
      </div>
    </Link>
  );
}
