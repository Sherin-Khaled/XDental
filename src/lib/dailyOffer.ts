export type ScheduledOfferDay =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type WeeklyOffer = {
  id: string;
  day: ScheduledOfferDay;
  enabled: boolean;
  badgeEn?: string;
  badgeAr?: string;
  eyebrowEn?: string;
  eyebrowAr?: string;
  titleEn?: string;
  titleAr?: string;
  descriptionEn?: string;
  descriptionAr?: string;
  ctaTextEn?: string;
  ctaTextAr?: string;
  secondaryTextEn?: string;
  secondaryTextAr?: string;
  ctaUrl: string;
  image?: string;
};

export type ScheduledOfferSettings = WeeklyOffer;
export type DailyOfferSettings = WeeklyOffer;

export const WEEKLY_OFFER_CALENDAR_STORAGE_KEY =
  "x-dental-weekly-offer-calendar-settings";
export const SCHEDULED_OFFER_STORAGE_KEY = WEEKLY_OFFER_CALENDAR_STORAGE_KEY;
export const DAILY_OFFER_STORAGE_KEY = WEEKLY_OFFER_CALENDAR_STORAGE_KEY;

const DEFAULT_CTA_TEXT = "Shop Offer";
const DEFAULT_SECONDARY_TEXT = "Maybe Later";

const weekdayByDateIndex: ScheduledOfferDay[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export const scheduledOfferDays: ScheduledOfferDay[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const defaultWeeklyOfferCalendar: WeeklyOffer[] = [
  {
    id: "monday-endo-offer",
    day: "monday",
    enabled: true,
    badgeEn: "15% OFF",
    eyebrowEn: "Monday Offer",
    titleEn: "Endodontic Monday Deal",
    descriptionEn: "Save on selected endodontic essentials every Monday.",
    ctaUrl: "/products?offer=monday-endo",
  },
  {
    id: "tuesday-restorative-offer",
    day: "tuesday",
    enabled: true,
    badgeEn: "10% OFF",
    eyebrowEn: "Tuesday Offer",
    titleEn: "Restorative Tuesday Deal",
    descriptionEn: "Save on selected restorative materials every Tuesday.",
    ctaUrl: "/products?offer=tuesday-restorative",
  },
  {
    id: "wednesday-instrument-offer",
    day: "wednesday",
    enabled: true,
    badgeEn: "12% OFF",
    eyebrowEn: "Wednesday Offer",
    titleEn: "Instrument Wednesday Deal",
    descriptionEn: "Save on selected dental instruments every Wednesday.",
    ctaUrl: "/products?offer=wednesday-instruments",
  },
  {
    id: "thursday-implantology-offer",
    day: "thursday",
    enabled: true,
    badgeEn: "15% OFF",
    eyebrowEn: "Thursday Offer",
    titleEn: "Implantology Thursday Deal",
    descriptionEn: "Save on selected implantology essentials every Thursday.",
    ctaUrl: "/products?offer=thursday-implantology",
  },
  {
    id: "friday-clinic-essentials-offer",
    day: "friday",
    enabled: true,
    badgeEn: "10% OFF",
    eyebrowEn: "Friday Offer",
    titleEn: "Clinic Essentials Friday Deal",
    descriptionEn: "Save on selected clinic essentials every Friday.",
    ctaUrl: "/products?offer=friday-clinic-essentials",
  },
  {
    id: "saturday-infection-control-offer",
    day: "saturday",
    enabled: true,
    badgeEn: "12% OFF",
    eyebrowEn: "Saturday Offer",
    titleEn: "Infection Control Saturday Deal",
    descriptionEn: "Save on selected infection control supplies every Saturday.",
    ctaUrl: "/products?offer=saturday-infection-control",
  },
  {
    id: "sunday-best-sellers-offer",
    day: "sunday",
    enabled: true,
    badgeEn: "15% OFF",
    eyebrowEn: "Sunday Offer",
    titleEn: "Best Sellers Sunday Deal",
    descriptionEn: "Save on selected best-selling dental supplies every Sunday.",
    ctaUrl: "/products?offer=sunday-best-sellers",
  },
];

function safeReadStorage(key: string) {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWriteStorage(key: string, value: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures so the store keeps rendering normally.
  }
}

function safeRemoveStorage(key: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures so the store keeps rendering normally.
  }
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function isScheduledOfferDay(value: unknown): value is ScheduledOfferDay {
  return typeof value === "string" && scheduledOfferDays.includes(value as ScheduledOfferDay);
}

function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}

function getString(value: unknown, fallback?: string) {
  return trimString(value) || fallback;
}

function getDefaultOfferForDay(day: ScheduledOfferDay) {
  return defaultWeeklyOfferCalendar.find((offer) => offer.day === day)!;
}

function normalizeWeeklyOffer(value: unknown, day: ScheduledOfferDay): WeeklyOffer {
  const fallback = getDefaultOfferForDay(day);
  const parsed = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    ...fallback,
    id: getString(parsed.id, fallback.id) ?? fallback.id,
    day,
    enabled: parsed.enabled === undefined ? fallback.enabled : Boolean(parsed.enabled),
    badgeEn: getString(parsed.badgeEn, getString(parsed.discountLabel, fallback.badgeEn)),
    badgeAr: getString(parsed.badgeAr),
    eyebrowEn: getString(parsed.eyebrowEn, fallback.eyebrowEn),
    eyebrowAr: getString(parsed.eyebrowAr),
    titleEn: getString(parsed.titleEn, fallback.titleEn),
    titleAr: getString(parsed.titleAr),
    descriptionEn: getString(parsed.descriptionEn, fallback.descriptionEn),
    descriptionAr: getString(parsed.descriptionAr),
    ctaTextEn: getString(parsed.ctaTextEn, fallback.ctaTextEn ?? DEFAULT_CTA_TEXT),
    ctaTextAr: getString(parsed.ctaTextAr),
    secondaryTextEn: getString(
      parsed.secondaryTextEn,
      fallback.secondaryTextEn ?? DEFAULT_SECONDARY_TEXT
    ),
    secondaryTextAr: getString(parsed.secondaryTextAr),
    ctaUrl: getString(parsed.ctaUrl, fallback.ctaUrl) ?? fallback.ctaUrl,
    image: getString(parsed.image),
  };
}

function parseWeeklyOfferCalendar(rawValue: string | null) {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    const rawOffers =
      Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && Array.isArray((parsed as { offers?: unknown }).offers)
          ? (parsed as { offers: unknown[] }).offers
          : null;

    if (!rawOffers) return null;

    return scheduledOfferDays.map((day) => {
      const matchingOffer = rawOffers.find(
        (offer) =>
          offer &&
          typeof offer === "object" &&
          isScheduledOfferDay((offer as { day?: unknown }).day) &&
          (offer as { day: ScheduledOfferDay }).day === day
      );

      return normalizeWeeklyOffer(matchingOffer, day);
    });
  } catch {
    return null;
  }
}

export function getLocalDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join("-");
}

export function getCurrentWeekday(date = new Date()): ScheduledOfferDay {
  return weekdayByDateIndex[date.getDay()];
}

export const getScheduledOfferDay = getCurrentWeekday;

export function getScheduledOfferDismissedKey(
  offer: Pick<WeeklyOffer, "id">,
  date = new Date()
) {
  return `x-dental-scheduled-offer-dismissed-${offer.id.trim()}-${getLocalDateKey(date)}`;
}

export function getDefaultWeeklyOfferCalendarSettings() {
  return defaultWeeklyOfferCalendar.map((offer) => ({
    ...offer,
    ctaTextEn: offer.ctaTextEn ?? DEFAULT_CTA_TEXT,
    secondaryTextEn: offer.secondaryTextEn ?? DEFAULT_SECONDARY_TEXT,
  }));
}

export function getDefaultScheduledOfferSettings() {
  return getDefaultOfferForDay("monday");
}

export const getDefaultDailyOfferSettings = getDefaultScheduledOfferSettings;

export function getWeeklyOfferCalendarSettings() {
  return (
    parseWeeklyOfferCalendar(safeReadStorage(WEEKLY_OFFER_CALENDAR_STORAGE_KEY)) ??
    getDefaultWeeklyOfferCalendarSettings()
  );
}

export function saveWeeklyOfferCalendarSettings(offers: WeeklyOffer[]) {
  safeWriteStorage(WEEKLY_OFFER_CALENDAR_STORAGE_KEY, JSON.stringify(offers));
}

export function resetWeeklyOfferCalendarSettings() {
  safeRemoveStorage(WEEKLY_OFFER_CALENDAR_STORAGE_KEY);
}

export function getTodayOffer(now = new Date()) {
  const currentDay = getCurrentWeekday(now);
  const offer = getWeeklyOfferCalendarSettings().find((item) => item.day === currentDay);

  return offer && isOfferActiveToday(offer, now) ? offer : null;
}

export function isOfferActiveToday(offer: WeeklyOffer, now = new Date()) {
  return offer.enabled && offer.day === getCurrentWeekday(now);
}

export const getActiveScheduledOffer = getTodayOffer;
export const getActiveDailyOffer = getTodayOffer;

export function getScheduledOfferSettings() {
  return getTodayOffer() ?? getDefaultScheduledOfferSettings();
}

export const getDailyOfferSettings = getScheduledOfferSettings;

export function saveScheduledOfferSettings(settings: WeeklyOffer) {
  const nextOffers = getWeeklyOfferCalendarSettings().map((offer) =>
    offer.day === settings.day ? normalizeWeeklyOffer(settings, settings.day) : offer
  );

  saveWeeklyOfferCalendarSettings(nextOffers);
}

export const saveDailyOfferSettings = saveScheduledOfferSettings;

export function resetScheduledOfferSettings() {
  resetWeeklyOfferCalendarSettings();
}

export const resetDailyOfferSettings = resetScheduledOfferSettings;

export function isScheduledOfferDismissedToday(
  offer: Pick<WeeklyOffer, "id">,
  date = new Date()
) {
  return safeReadStorage(getScheduledOfferDismissedKey(offer, date)) === "true";
}

export function dismissScheduledOfferForToday(
  offer: Pick<WeeklyOffer, "id">,
  date = new Date()
) {
  safeWriteStorage(getScheduledOfferDismissedKey(offer, date), "true");
}
