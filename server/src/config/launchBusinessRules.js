export const LAUNCH_LOYALTY_PROGRAM_SETTINGS = Object.freeze({
  id: "default",
  enabled: true,
  standardPointsPerEgp10: 1,
  vipPointsPerEgp10: 2,
  pointsPerRedemptionUnit: 100,
  redemptionValueEgp: "10",
  welcomePoints: 5_000,
  welcomeMinimumSubtotalEgp: "5000",
  welcomeExpiryDays: 30,
  minimumRedemptionPoints: 100,
  maximumRedemptionPercent: "20",
  expiryMonths: 12,
});

export const LAUNCH_DELIVERY_ZONES = Object.freeze([
  { id: "zone-new-cairo", slug: "new-cairo", nameEn: "New Cairo", nameAr: "القاهرة الجديدة", isActive: true, displayOrder: 10 },
  { id: "zone-nasr-city", slug: "nasr-city", nameEn: "Nasr City", nameAr: "مدينة نصر", isActive: true, displayOrder: 20 },
  { id: "zone-heliopolis", slug: "heliopolis", nameEn: "Heliopolis", nameAr: "مصر الجديدة", isActive: true, displayOrder: 30 },
  { id: "zone-maadi", slug: "maadi", nameEn: "Maadi", nameAr: "المعادي", isActive: true, displayOrder: 40 },
  { id: "zone-dokki", slug: "dokki", nameEn: "Dokki", nameAr: "الدقي", isActive: true, displayOrder: 50 },
  { id: "zone-mohandessin", slug: "mohandessin", nameEn: "Mohandessin", nameAr: "المهندسين", isActive: true, displayOrder: 60 },
  { id: "zone-sixth-october", slug: "6th-of-october", nameEn: "6th of October", nameAr: "السادس من أكتوبر", isActive: true, displayOrder: 70 },
  { id: "zone-sheikh-zayed", slug: "sheikh-zayed", nameEn: "Sheikh Zayed", nameAr: "الشيخ زايد", isActive: true, displayOrder: 80 },
  { id: "zone-shubra", slug: "shubra", nameEn: "Shubra", nameAr: "شبرا", isActive: true, displayOrder: 90 },
  { id: "zone-zeitoun", slug: "zeitoun", nameEn: "El Zeitoun", nameAr: "الزيتون", isActive: true, displayOrder: 100 },
  { id: "zone-hadayek-el-qobba", slug: "hadayek-el-qobba", nameEn: "Hadayek El Qobba", nameAr: "حدائق القبة", isActive: true, displayOrder: 110 },
  { id: "zone-abbassia", slug: "abbassia", nameEn: "Abbassia", nameAr: "العباسية", isActive: true, displayOrder: 120 },
  { id: "zone-shubra-masr", slug: "shubra-masr", nameEn: "Shubra Masr", nameAr: "شبرا مصر", isActive: true, displayOrder: 130 },
  { id: "zone-ain-shams", slug: "ain-shams", nameEn: "Ain Shams", nameAr: "عين شمس", isActive: true, displayOrder: 140 },
  { id: "zone-first-settlement", slug: "first-settlement", nameEn: "First Settlement", nameAr: "التجمع الأول", isActive: true, displayOrder: 150 },
  { id: "zone-fifth-settlement", slug: "fifth-settlement", nameEn: "Fifth Settlement", nameAr: "التجمع الخامس", isActive: true, displayOrder: 160 },
  { id: "zone-manial", slug: "manial", nameEn: "Manial", nameAr: "المنيل", isActive: true, displayOrder: 170 },
  { id: "zone-other", slug: "other", nameEn: "Other", nameAr: "أخرى", isActive: true, displayOrder: 180 },
]);

const RECURRING_AREA_SLUGS = ["dokki", "manial", "mohandessin"];

export const LAUNCH_FREE_DELIVERY_OFFERS = Object.freeze([
  {
    id: "launch-free-delivery-saturday",
    titleEn: "Saturday area free delivery",
    titleAr: "توصيل مجاني لمناطق السبت",
    weekdays: [6],
    zoneSlugs: ["shubra", "zeitoun", "hadayek-el-qobba", "abbassia", "shubra-masr", "ain-shams", "heliopolis", ...RECURRING_AREA_SLUGS],
  },
  {
    id: "launch-free-delivery-sunday",
    titleEn: "Sunday area free delivery",
    titleAr: "توصيل مجاني لمناطق الأحد",
    weekdays: [0],
    zoneSlugs: ["heliopolis", "first-settlement", "fifth-settlement", ...RECURRING_AREA_SLUGS],
  },
  {
    id: "launch-free-delivery-monday",
    titleEn: "Monday area free delivery",
    titleAr: "توصيل مجاني لمناطق الاثنين",
    weekdays: [1],
    zoneSlugs: ["nasr-city", "heliopolis", ...RECURRING_AREA_SLUGS],
  },
  {
    id: "launch-free-delivery-tuesday",
    titleEn: "Tuesday area free delivery",
    titleAr: "توصيل مجاني لمناطق الثلاثاء",
    weekdays: [2],
    zoneSlugs: ["first-settlement", "fifth-settlement", ...RECURRING_AREA_SLUGS],
  },
  {
    id: "launch-free-delivery-wednesday",
    titleEn: "Wednesday area free delivery",
    titleAr: "توصيل مجاني لمناطق الأربعاء",
    weekdays: [3],
    zoneSlugs: ["sheikh-zayed", "6th-of-october", ...RECURRING_AREA_SLUGS],
  },
].map((offer) => ({
  ...offer,
  descriptionEn: "Free delivery for the listed clinic areas on this day.",
  descriptionAr: "توصيل مجاني لمناطق العيادات المحددة في هذا اليوم.",
  offerType: "FREE_DELIVERY",
  recurrenceType: "WEEKLY",
  cutoffTime: null,
  timezone: "Africa/Cairo",
  discountType: null,
  discountValue: null,
  minimumOrderAmount: null,
  appliesToStandard: true,
  appliesToFast: true,
  isActive: true,
})));

export function buildLaunchDeliverySeedTables() {
  const deliveryZones = LAUNCH_DELIVERY_ZONES.map((zone) => ({ ...zone }));
  const zoneIdsBySlug = new Map(deliveryZones.map((zone) => [zone.slug, zone.id]));
  const deliveryOffers = LAUNCH_FREE_DELIVERY_OFFERS.map(({ zoneSlugs, ...offer }) => ({ ...offer }));
  const deliveryOfferZones = LAUNCH_FREE_DELIVERY_OFFERS.flatMap((offer) =>
    offer.zoneSlugs.map((slug) => {
      const deliveryZoneId = zoneIdsBySlug.get(slug);
      if (!deliveryZoneId) throw new Error(`Launch delivery offer references missing zone: ${slug}`);
      return { offerId: offer.id, deliveryZoneId };
    })
  );
  return { deliveryZones, deliveryOffers, deliveryOfferZones };
}
