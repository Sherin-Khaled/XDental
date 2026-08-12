import { useEffect, useState } from "react";
import { apiRequest } from "@/services/http";
import type { HeroSlide } from "@/types/heroSlide";

// ─────────────────────────────────────────────────────────────────────────────
// Local seed — the same three records the backend seed inserts into the
// hero_slides table. They render on first paint (no blank hero, no fetch
// waterfall) and act as the fallback when the API is unreachable. Once the
// admin dashboard manages hero_slides, edits arrive through GET
// /api/hero-slides and silently replace these.
// ─────────────────────────────────────────────────────────────────────────────

const HERO_SUPPORT_CARD: NonNullable<HeroSlide["glassCard"]> = {
  title: { en: "Need Help Choosing?", ar: "تحتاج مساعدة في الاختيار؟" },
  items: [
    { en: "Chat with our support team", ar: "تواصل مع فريق الدعم" },
    { en: "Ask about products, brands, or availability", ar: "اسأل عن المنتجات أو العلامات أو التوفر" },
    { en: "Get help with quotes and clinic orders", ar: "احصل على مساعدة في عروض الأسعار وطلبات العيادة" },
    { en: "We will reply as soon as possible", ar: "سنرد في أقرب وقت ممكن" },
  ],
};

export const DEFAULT_HERO_IMAGE_URLS = {
  "hero-brand": "/hero%20section/firstslide.png",
  "hero-offer": "/hero%20section/secondslide.png",
  "hero-equipment": "/hero%20section/Thirdslide.png",
} as const;

const BRAND_SLIDE_IMAGE: HeroSlide["image"] = {
  src: DEFAULT_HERO_IMAGE_URLS["hero-brand"],
  alt: {
    en: "Dental professional presenting dental care products",
    ar: "متخصصة تعرض منتجات العناية بالأسنان",
  },
};

const OFFER_SLIDE_IMAGE: HeroSlide["image"] = {
  src: DEFAULT_HERO_IMAGE_URLS["hero-offer"],
  alt: { en: "Dental supplies delivered by the X Dental team", ar: "مستلزمات أسنان بتوصيل من فريق X Dental" },
};

const EQUIPMENT_SLIDE_IMAGE: HeroSlide["image"] = {
  src: DEFAULT_HERO_IMAGE_URLS["hero-equipment"],
  alt: { en: "Endodontic motors and dental equipment", ar: "محركات علاج جذور ومعدات أسنان" },
};

export const DEFAULT_HERO_SLIDES: HeroSlide[] = [
  {
    id: "hero-brand",
    order: 1,
    isActive: true,
    badgeText: { en: "Trusted Dental Supplies", ar: "مستلزمات أسنان موثوقة" },
    headline: {
      en: "Premium Dental Products for Clinics & Professionals",
      ar: "منتجات أسنان متميزة للعيادات والأطباء",
    },
    headlineHighlight: { en: "Clinics & Professionals", ar: "للعيادات والأطباء" },
    subtext: {
      en: "We provide high-quality dental instruments, clinic essentials, and trusted brands - all in one place with competitive pricing and reliable delivery.",
      ar: "نوفر أدوات أسنان عالية الجودة ومستلزمات عيادات وعلامات تجارية موثوقة في مكان واحد، بأسعار تنافسية وتوصيل يعتمد عليه.",
    },
    primaryCta: { label: { en: "Browse Products", ar: "تصفح المنتجات" }, href: "/products" },
    secondaryCta: { label: { en: "Request a Quote", ar: "اطلب عرض سعر" }, href: "/contact" },
    image: BRAND_SLIDE_IMAGE,
    glassCard: HERO_SUPPORT_CARD,
    floatingLabels: [
      { en: "Best Sellers", ar: "الأكثر مبيعًا" },
      { en: "Fast Delivery", ar: "توصيل سريع" },
    ],
    stats: [
      { value: { en: "500+", ar: "500+" }, label: { en: "Products", ar: "منتج" } },
      { value: { en: "50+", ar: "50+" }, label: { en: "Trusted Brands", ar: "علامة موثوقة" } },
      { value: { en: "1,200+", ar: "1,200+" }, label: { en: "Clinics Served", ar: "عيادة نخدمها" } },
    ],
  },
  {
    id: "hero-offer",
    order: 2,
    isActive: true,
    badgeText: { en: "Cash on Delivery", ar: "الدفع عند الاستلام" },
    headline: {
      en: "Clinic Essentials, Delivered by X Dental",
      ar: "مستلزمات عيادتك، بتوصيل من فريق X Dental",
    },
    headlineHighlight: { en: "Delivered by X Dental", ar: "بتوصيل من فريق X Dental" },
    subtext: {
      en: "Order trusted dental supplies and our team will contact you to confirm availability, delivery details, and Cash on Delivery payment.",
      ar: "اطلب مستلزمات أسنان موثوقة وسيتواصل معك فريقنا لتأكيد التوفر وتفاصيل التوصيل والدفع نقدًا عند الاستلام.",
    },
    primaryCta: {
      label: { en: "Shop Products", ar: "تسوق المنتجات" },
      href: "/products",
    },
    secondaryCta: {
      label: { en: "Contact Support", ar: "تواصل مع الدعم" },
      href: "/contact",
    },
    image: OFFER_SLIDE_IMAGE,
    glassCard: null,
    floatingLabels: [
      { en: "Cash on Delivery", ar: "الدفع عند الاستلام" },
      { en: "Team Delivery", ar: "توصيل بواسطة فريقنا" },
    ],
    countdownTo: null,
  },
  {
    id: "hero-equipment",
    order: 3,
    isActive: true,
    badgeText: { en: "New Arrivals", ar: "وصل حديثًا" },
    headline: {
      en: "Endo Motors & Equipment from Top Global Brands",
      ar: "أجهزة ومحركات علاج الجذور من أفضل العلامات العالمية",
    },
    headlineHighlight: {
      en: "Endo Motors & Equipment",
      ar: "أجهزة ومحركات علاج الجذور",
    },
    subtext: {
      en: "Professional endodontic equipment with warranty and fast nationwide delivery.",
      ar: "معدات علاج جذور احترافية بضمان وتوصيل سريع لجميع المحافظات.",
    },
    primaryCta: {
      label: { en: "Explore Equipment", ar: "استكشف الأجهزة" },
      href: "/products?category=machines",
    },
    secondaryCta: { label: { en: "All Brands", ar: "كل العلامات" }, href: "/brands" },
    image: EQUIPMENT_SLIDE_IMAGE,
    glassCard: null,
    floatingLabels: [
      { en: "Warranty", ar: "ضمان" },
      { en: "Best Price", ar: "أفضل سعر" },
    ],
    stats: [
      { value: { en: "50+", ar: "50+" }, label: { en: "Trusted Brands", ar: "علامة موثوقة" } },
      { value: { en: "Warranty", ar: "ضمان" }, label: { en: "Included", ar: "مشمول" } },
      { value: { en: "Nationwide", ar: "لكل مصر" }, label: { en: "Delivery", ar: "توصيل" } },
    ],
  },
];

/** A slide is renderable when active and its countdown (if any) hasn't expired. */
export function getVisibleSlides(slides: HeroSlide[], now: Date = new Date()): HeroSlide[] {
  return slides
    .filter((slide) => {
      if (!slide.isActive) return false;
      if (slide.countdownTo && new Date(slide.countdownTo).getTime() <= now.getTime()) return false;
      return true;
    })
    .sort((a, b) => a.order - b.order);
}

export function getHeroFallbackImageSrc(slide: Pick<HeroSlide, "id" | "order">): string {
  return (
    DEFAULT_HERO_IMAGE_URLS[slide.id as keyof typeof DEFAULT_HERO_IMAGE_URLS] ??
    DEFAULT_HERO_SLIDES.find((fallback) => fallback.order === slide.order)?.image.src ??
    DEFAULT_HERO_IMAGE_URLS["hero-brand"]
  );
}

function applyMissingImageFallbacks(slides: HeroSlide[]): HeroSlide[] {
  return slides.map((slide) => {
    if (slide.image?.src) return slide;
    return {
      ...slide,
      image: {
        ...slide.image,
        src: getHeroFallbackImageSrc(slide),
      },
    };
  });
}

/**
 * Single data-access point for hero slides. Fetches the admin-managed records
 * from the backend; falls back to the bundled seed when the API is
 * unavailable so the hero always renders.
 */
export async function getHeroSlides(signal?: AbortSignal): Promise<HeroSlide[]> {
  try {
    const result = await apiRequest<{ slides: HeroSlide[] }>("/hero-slides", { signal });
    return applyMissingImageFallbacks(result.slides);
  } catch {
    return DEFAULT_HERO_SLIDES;
  }
}

/**
 * Slides for the home hero: seed data on first paint, silently replaced by
 * the API copy once it arrives.
 */
export function useHeroSlides(): HeroSlide[] {
  const [slides, setSlides] = useState<HeroSlide[]>(() => getVisibleSlides(DEFAULT_HERO_SLIDES));

  useEffect(() => {
    const controller = new AbortController();
    void getHeroSlides(controller.signal).then((next) => {
      if (!controller.signal.aborted) setSlides(getVisibleSlides(next));
    });
    return () => controller.abort();
  }, []);

  return slides;
}
