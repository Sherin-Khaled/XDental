export type CampaignText = {
  en: string;
  ar: string;
};

export type HomeCampaign = {
  id: string;
  title: CampaignText;
  subtitle: CampaignText;
  eyebrow: CampaignText;
  ctaLabel: CampaignText;
  ctaUrl: "/products" | "/brands" | "/categories" | "/contact" | "/shipping-delivery";
  active: boolean;
  startDate?: string;
  endDate?: string;
  desktopImage: string;
  mobileImage?: string;
  imageAlt: CampaignText;
  layout: "feature" | "compact";
  tone: "photo" | "gold" | "blue";
};

export const HOME_CAMPAIGNS: HomeCampaign[] = [
  {
    id: "clinic-restocking",
    title: {
      en: "Complete clinic restocking, made simpler.",
      ar: "تجهيز متكامل لعيادتك بخطوات أبسط.",
    },
    subtitle: {
      en: "Explore dependable dental supplies for daily procedures, patient care, and smoother clinic operations.",
      ar: "اكتشف مستلزمات أسنان موثوقة للإجراءات اليومية ورعاية المرضى وتشغيل العيادة بسلاسة.",
    },
    eyebrow: { en: "Clinic essentials", ar: "أساسيات العيادة" },
    ctaLabel: { en: "View Products", ar: "عرض المنتجات" },
    ctaUrl: "/products",
    active: true,
    desktopImage: "/hero%20section/img_1.jpg",
    mobileImage: "/hero%20section/img_1.jpg",
    imageAlt: {
      en: "A confident smile representing complete clinic care",
      ar: "ابتسامة تعبر عن رعاية متكاملة داخل العيادة",
    },
    layout: "feature",
    tone: "photo",
  },
  {
    id: "oral-care-equipment",
    title: { en: "Everyday oral care equipment", ar: "أجهزة العناية اليومية بالفم" },
    subtitle: {
      en: "Browse practical equipment selected for modern dental care.",
      ar: "تصفح أجهزة عملية مختارة للعناية الحديثة بالأسنان.",
    },
    eyebrow: { en: "Equipment spotlight", ar: "أجهزة مختارة" },
    ctaLabel: { en: "Browse Categories", ar: "تصفح التصنيفات" },
    ctaUrl: "/categories",
    active: true,
    desktopImage: "/hero%20section/img_2.png",
    imageAlt: {
      en: "Professional oral care equipment",
      ar: "أجهزة احترافية للعناية بالفم",
    },
    layout: "compact",
    tone: "gold",
  },
  {
    id: "trusted-implant-brands",
    title: { en: "Trusted implant solutions", ar: "حلول زراعة أسنان موثوقة" },
    subtitle: {
      en: "Discover established dental brands for precise clinical workflows.",
      ar: "اكتشف علامات أسنان موثوقة لخطوات علاجية أكثر دقة.",
    },
    eyebrow: { en: "Partner brands", ar: "علامات شريكة" },
    ctaLabel: { en: "Explore Brands", ar: "استكشف العلامات" },
    ctaUrl: "/brands",
    active: true,
    desktopImage: "/hero%20section/img_3.png",
    imageAlt: {
      en: "Exploded view of a dental implant system",
      ar: "عرض تفصيلي لنظام زراعة أسنان",
    },
    layout: "compact",
    tone: "blue",
  },
];

export function getActiveHomeCampaigns(now = new Date()) {
  const timestamp = now.getTime();

  return HOME_CAMPAIGNS.filter((campaign) => {
    if (!campaign.active) return false;
    if (campaign.startDate && new Date(campaign.startDate).getTime() > timestamp) return false;
    if (campaign.endDate && new Date(campaign.endDate).getTime() <= timestamp) return false;
    return true;
  });
}
