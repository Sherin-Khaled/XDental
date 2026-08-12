import { prisma } from "../config/db.js";

export const PROMOTION_TIMEZONE = "Africa/Cairo";

const PUBLIC_STATUSES = ["ACTIVE", "SCHEDULED"];
const WEEKDAY_INDEX = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function zonedClock(now = new Date(), timezone = PROMOTION_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((part) => [part.type, part.value])
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: WEEKDAY_INDEX[parts.weekday],
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function dateKey(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : null;
}

function timeMinutes(value) {
  if (typeof value !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return null;
  }
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function matchesDailyTimeWindow(promotion, clock) {
  const start = timeMinutes(promotion.startTime);
  const end = timeMinutes(promotion.endTime);
  if (start !== null && clock.minutes < start) return false;
  if (end !== null && clock.minutes >= end) return false;
  return true;
}

export function isScheduledPromotionValidNow(promotion, now = new Date()) {
  if (
    !promotion?.isActive ||
    !PUBLIC_STATUSES.includes(promotion.status)
  ) {
    return false;
  }

  const clock = zonedClock(now, promotion.timezone || PROMOTION_TIMEZONE);
  if (promotion.scheduleType === "ALWAYS_ACTIVE") return true;

  if (promotion.scheduleType === "WEEKLY_RECURRING") {
    return (
      Array.isArray(promotion.weekdays) &&
      promotion.weekdays.includes(clock.weekday) &&
      matchesDailyTimeWindow(promotion, clock)
    );
  }

  if (promotion.scheduleType === "ONE_TIME_DATE") {
    return (
      dateKey(promotion.startAt) === clock.date &&
      matchesDailyTimeWindow(promotion, clock)
    );
  }

  if (promotion.scheduleType === "DATE_RANGE") {
    const start = dateKey(promotion.startAt);
    const end = dateKey(promotion.endAt);
    const startMinutes = timeMinutes(promotion.startTime);
    const endMinutes = timeMinutes(promotion.endTime);
    if (!start || !end || startMinutes === null || endMinutes === null) {
      return false;
    }
    if (clock.date < start || clock.date > end) return false;
    if (clock.date === start && clock.minutes < startMinutes) return false;
    if (clock.date === end && clock.minutes >= endMinutes) return false;
    return true;
  }

  return false;
}

function isPromotionPast(promotion, now = new Date()) {
  const clock = zonedClock(now, promotion.timezone || PROMOTION_TIMEZONE);
  const start = dateKey(promotion.startAt);
  const end = dateKey(promotion.endAt);
  const endMinutes = timeMinutes(promotion.endTime);

  if (promotion.scheduleType === "ONE_TIME_DATE" && start) {
    if (clock.date > start) return true;
    return clock.date === start && endMinutes !== null && clock.minutes >= endMinutes;
  }
  if (promotion.scheduleType === "DATE_RANGE" && end) {
    if (clock.date > end) return true;
    return clock.date === end && endMinutes !== null && clock.minutes >= endMinutes;
  }
  return false;
}

export function hasScheduledPromotionOccurrence(promotion, now = new Date()) {
  if (promotion.scheduleType === "ALWAYS_ACTIVE") return true;
  if (promotion.scheduleType === "WEEKLY_RECURRING") {
    return Array.isArray(promotion.weekdays) && promotion.weekdays.length > 0;
  }
  return !isPromotionPast(promotion, now);
}

export function getEffectivePromotionStatus(promotion, now = new Date()) {
  if (["DRAFT", "PAUSED", "ARCHIVED"].includes(promotion.status)) {
    return promotion.status;
  }
  if (promotion.status === "EXPIRED" || isPromotionPast(promotion, now)) {
    return "EXPIRED";
  }
  if (isScheduledPromotionValidNow(promotion, now)) return "ACTIVE";
  return "SCHEDULED";
}

function decimalValue(value) {
  return value === null || value === undefined ? null : Number(value);
}

export function serializeScheduledPromotion(promotion, now = new Date()) {
  const effectiveStatus = getEffectivePromotionStatus(promotion, now);
  return {
    id: promotion.id,
    titleEn: promotion.titleEn,
    titleAr: promotion.titleAr,
    descriptionEn: promotion.descriptionEn,
    descriptionAr: promotion.descriptionAr,
    badgeEn: promotion.badgeEn ?? null,
    badgeAr: promotion.badgeAr ?? null,
    imageUrl: promotion.imageUrl ?? null,
    promotionType: promotion.promotionType,
    discountPercent: decimalValue(promotion.discountPercent),
    discountAmount: decimalValue(promotion.discountAmount),
    couponCode: promotion.couponCode ?? null,
    minimumOrderAmount: decimalValue(promotion.minimumOrderAmount),
    targetUrl: promotion.targetUrl ?? null,
    buttonTextEn: promotion.buttonTextEn ?? null,
    buttonTextAr: promotion.buttonTextAr ?? null,
    scheduleType: promotion.scheduleType,
    weekdays: promotion.weekdays,
    startAt: dateKey(promotion.startAt),
    endAt: dateKey(promotion.endAt),
    startTime: promotion.startTime ?? null,
    endTime: promotion.endTime ?? null,
    timezone: promotion.timezone,
    displayPlacement: promotion.displayPlacement,
    priority: promotion.priority,
    isDismissible: promotion.isDismissible,
    status: effectiveStatus,
    storedStatus: promotion.status,
    isActive: promotion.isActive,
    isCurrentlyValid: isScheduledPromotionValidNow(promotion, now),
    createdAt: promotion.createdAt,
    updatedAt: promotion.updatedAt,
  };
}

export async function getCurrentScheduledPromotions({
  placement,
  now = new Date(),
  database = prisma,
} = {}) {
  const promotions = await database.scheduledPromotion.findMany({
    where: {
      isActive: true,
      status: { in: PUBLIC_STATUSES },
      ...(placement ? { displayPlacement: placement } : {}),
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });

  return promotions
    .filter((promotion) => promotion.targetUrl !== "__X_DENTAL_COUPON__")
    .filter((promotion) => isScheduledPromotionValidNow(promotion, now))
    .map((promotion) => serializeScheduledPromotion(promotion, now));
}

function toCents(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.max(0, Math.round(number * 100)) : 0;
}

function safePricingSource(promotion) {
  return {
    sourceType: "SCHEDULED_PROMOTION",
    sourceId: promotion.id,
    titleEn: promotion.titleEn,
    titleAr: promotion.titleAr,
    priority: promotion.priority,
    createdAt: promotion.createdAt,
  };
}

/**
 * Returns checkout-capable automatic Scheduled Promotions. Coupon rows are
 * intentionally handled by the shared code-redemption service so they never
 * become automatic discounts.
 */
export async function getEligibleScheduledPromotionPricing(
  database,
  { subtotalCents, now = new Date() }
) {
  const promotions = await database.scheduledPromotion.findMany({
    where: {
      isActive: true,
      status: { in: PUBLIC_STATUSES },
      OR: [
        { targetUrl: null },
        { targetUrl: { not: "__X_DENTAL_COUPON__" } },
      ],
      promotionType: {
        in: ["PERCENTAGE_DISCOUNT", "FIXED_DISCOUNT", "FREE_DELIVERY"],
      },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }, { id: "asc" }],
  });

  const eligible = promotions.filter((promotion) =>
    isScheduledPromotionValidNow(promotion, now)
    && subtotalCents >= toCents(promotion.minimumOrderAmount)
  );

  const monetaryCandidates = eligible.flatMap((promotion) => {
    if (promotion.promotionType === "PERCENTAGE_DISCOUNT") {
      const percent = Math.min(100, Math.max(0, Number(promotion.discountPercent ?? 0)));
      if (!(percent > 0)) return [];
      return [{
        ...safePricingSource(promotion),
        discountCents: Math.min(subtotalCents, Math.round(subtotalCents * percent / 100)),
      }];
    }
    if (promotion.promotionType === "FIXED_DISCOUNT") {
      const discountCents = Math.min(subtotalCents, toCents(promotion.discountAmount));
      return discountCents > 0
        ? [{ ...safePricingSource(promotion), discountCents }]
        : [];
    }
    return [];
  });

  const freeShippingSources = eligible
    .filter((promotion) => promotion.promotionType === "FREE_DELIVERY")
    .map(safePricingSource);

  return { monetaryCandidates, freeShippingSources };
}
