import { prisma } from "../config/db.js";
import {
  PROMOTION_TIMEZONE,
  getCurrentScheduledPromotions,
  hasScheduledPromotionOccurrence,
  isScheduledPromotionValidNow,
  serializeScheduledPromotion,
} from "../services/scheduledPromotion.service.js";
import { cleanText, isValidId } from "../utils/records.js";

const PROMOTION_TYPES = new Set([
  "INFORMATIONAL",
  "PERCENTAGE_DISCOUNT",
  "FIXED_DISCOUNT",
  "COUPON",
  "FREE_DELIVERY",
  "CUSTOM",
]);
const SCHEDULE_TYPES = new Set([
  "ONE_TIME_DATE",
  "DATE_RANGE",
  "WEEKLY_RECURRING",
  "ALWAYS_ACTIVE",
]);
const DISPLAY_PLACEMENTS = new Set([
  "ANNOUNCEMENT_BANNER",
  "NOTIFICATION_CENTER",
  "HOMEPAGE_PROMOTION_CARD",
  "ACCOUNT_DASHBOARD",
  "POPUP",
]);
const STATUSES = new Set([
  "DRAFT",
  "SCHEDULED",
  "ACTIVE",
  "PAUSED",
  "EXPIRED",
  "ARCHIVED",
]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const COUPON_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,39}$/;

function hasOwn(source, key) {
  return Object.prototype.hasOwnProperty.call(source ?? {}, key);
}

function valueFor(body, existing, key) {
  return hasOwn(body, key) ? body[key] : existing?.[key];
}

function optionalText(value, maxLength) {
  const text = cleanText(value, maxLength);
  return text || null;
}

function parseEnum(value, allowed, field, message) {
  const normalized = cleanText(value, 50).toUpperCase();
  if (!allowed.has(normalized)) return { error: { field, message } };
  return { value: normalized };
}

function parseDateOnly(value, field, label, required = false) {
  if (value instanceof Date) return { value };
  if (value === undefined || value === null || value === "") {
    return required
      ? { error: { field, message: `${label} is required.` } }
      : { value: null };
  }
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    return { error: { field, message: `${label} must use YYYY-MM-DD.` } };
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    return { error: { field, message: `${label} is invalid.` } };
  }
  return { value: parsed };
}

function parseOptionalTime(value, field, label) {
  if (value === undefined || value === null || value === "") return { value: null };
  const normalized = cleanText(value, 5);
  if (!TIME_PATTERN.test(normalized)) {
    return {
      error: { field, message: `${label} must use 24-hour HH:mm format.` },
    };
  }
  return { value: normalized };
}

function parseOptionalAmount(value, field, label) {
  if (value === undefined || value === null || value === "") return { value: null };
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > 100000000) {
    return { error: { field, message: `${label} must be a positive number.` } };
  }
  return { value: Math.round(number * 100) / 100 };
}

function parseOptionalMinimum(value) {
  if (value === undefined || value === null || value === "") return { value: null };
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100000000) {
    return {
      error: {
        field: "minimumOrderAmount",
        message: "Minimum order amount must be zero or greater.",
      },
    };
  }
  return { value: Math.round(number * 100) / 100 };
}

function parseUrl(value, field, label) {
  const text = optionalText(value, 1000);
  if (!text) return { value: null };
  if (text.startsWith("/") && !text.startsWith("//")) return { value: text };
  try {
    const url = new URL(text);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return { value: url.toString() };
    }
  } catch {
    // Return the localized field error below.
  }
  return {
    error: {
      field,
      message: `${label} must be a valid http, https, or site-relative URL.`,
    },
  };
}

async function parsePromotionInput(body, existing = null) {
  const parsed = {};
  const requiredTextFields = [
    ["titleEn", "English title", 160],
    ["titleAr", "Arabic title", 160],
    ["descriptionEn", "English description", 1200],
    ["descriptionAr", "Arabic description", 1200],
  ];

  for (const [field, label, maxLength] of requiredTextFields) {
    const value = cleanText(valueFor(body, existing, field), maxLength);
    if (!value) return { error: { field, message: `${label} is required.` } };
    parsed[field] = value;
  }

  const promotionType = parseEnum(
    valueFor(body, existing, "promotionType"),
    PROMOTION_TYPES,
    "promotionType",
    "Select a valid benefit type."
  );
  if (promotionType.error) return promotionType;

  const scheduleType = parseEnum(
    valueFor(body, existing, "scheduleType"),
    SCHEDULE_TYPES,
    "scheduleType",
    "Select a valid schedule type."
  );
  if (scheduleType.error) return scheduleType;

  const displayPlacement = parseEnum(
    valueFor(body, existing, "displayPlacement"),
    DISPLAY_PLACEMENTS,
    "displayPlacement",
    "Select a valid display placement."
  );
  if (displayPlacement.error) return displayPlacement;

  const status = parseEnum(
    valueFor(body, existing, "status") ?? "DRAFT",
    STATUSES,
    "status",
    "Select a valid promotion status."
  );
  if (status.error) return status;
  const requiresValidSchedule =
    status.value === "SCHEDULED" || status.value === "ACTIVE";

  const imageUrl = parseUrl(
    valueFor(body, existing, "imageUrl"),
    "imageUrl",
    "Image URL"
  );
  if (imageUrl.error) return imageUrl;
  const targetUrl = parseUrl(
    valueFor(body, existing, "targetUrl"),
    "targetUrl",
    "CTA destination"
  );
  if (targetUrl.error) return targetUrl;

  const discountPercent = parseOptionalAmount(
    valueFor(body, existing, "discountPercent"),
    "discountPercent",
    "Discount percentage"
  );
  if (discountPercent.error) return discountPercent;
  if (
    discountPercent.value !== null &&
    discountPercent.value > 100
  ) {
    return {
      error: {
        field: "discountPercent",
        message: "Enter a valid discount percentage between 1 and 100.",
      },
    };
  }

  const discountAmount = parseOptionalAmount(
    valueFor(body, existing, "discountAmount"),
    "discountAmount",
    "Discount amount"
  );
  if (discountAmount.error) return discountAmount;
  const minimumOrderAmount = parseOptionalMinimum(
    valueFor(body, existing, "minimumOrderAmount")
  );
  if (minimumOrderAmount.error) return minimumOrderAmount;

  let couponCode = optionalText(valueFor(body, existing, "couponCode"), 40);
  if (couponCode) couponCode = couponCode.toUpperCase();

  if (
    promotionType.value === "PERCENTAGE_DISCOUNT" &&
    discountPercent.value === null
  ) {
    return {
      error: {
        field: "discountPercent",
        message: "Enter a valid discount percentage between 1 and 100.",
      },
    };
  }
  if (
    promotionType.value === "FIXED_DISCOUNT" &&
    discountAmount.value === null
  ) {
    return {
      error: {
        field: "discountAmount",
        message: "Discount amount is required.",
      },
    };
  }
  if (
    promotionType.value === "COUPON" &&
    (!couponCode || !COUPON_PATTERN.test(couponCode))
  ) {
    return {
      error: {
        field: "couponCode",
        message: "Enter a valid coupon code using letters, numbers, hyphens, or underscores.",
      },
    };
  }
  if (promotionType.value === "COUPON") {
    const duplicate = await prisma.scheduledPromotion.findFirst({
      where: {
        couponCode: { equals: couponCode, mode: "insensitive" },
        ...(existing?.id ? { id: { not: existing.id } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      return {
        error: {
          field: "couponCode",
          message: "This coupon code already exists.",
        },
      };
    }
  }

  let weekdays = [];
  let startAt = null;
  let endAt = null;
  if (scheduleType.value === "WEEKLY_RECURRING") {
    const rawWeekdays = valueFor(body, existing, "weekdays");
    if (requiresValidSchedule && !Array.isArray(rawWeekdays)) {
      return {
        error: { field: "weekdays", message: "Select at least one weekday." },
      };
    }
    weekdays = Array.isArray(rawWeekdays)
      ? [...new Set(rawWeekdays.map(Number))].sort((a, b) => a - b)
      : [];
    if (
      (requiresValidSchedule && weekdays.length === 0) ||
      weekdays.some(
        (weekday) =>
          !Number.isInteger(weekday) || weekday < 0 || weekday > 6
      )
    ) {
      return {
        error: { field: "weekdays", message: "Select at least one valid weekday." },
      };
    }
  } else if (scheduleType.value === "ONE_TIME_DATE") {
    const start = parseDateOnly(
      valueFor(body, existing, "startAt"),
      "startAt",
      "Promotion date",
      requiresValidSchedule
    );
    if (start.error) return start;
    startAt = start.value;
  } else if (scheduleType.value === "DATE_RANGE") {
    const start = parseDateOnly(
      valueFor(body, existing, "startAt"),
      "startAt",
      "Start date",
      requiresValidSchedule
    );
    if (start.error) return start;
    const end = parseDateOnly(
      valueFor(body, existing, "endAt"),
      "endAt",
      "End date",
      requiresValidSchedule
    );
    if (end.error) return end;
    startAt = start.value;
    endAt = end.value;
  }

  const rawStartTime =
    scheduleType.value === "ALWAYS_ACTIVE"
      ? null
      : valueFor(body, existing, "startTime");
  const rawEndTime =
    scheduleType.value === "ALWAYS_ACTIVE"
      ? null
      : valueFor(body, existing, "endTime");
  const startTime = parseOptionalTime(
    rawStartTime,
    "startTime",
    "Start time"
  );
  if (startTime.error) return startTime;
  const endTime = parseOptionalTime(
    rawEndTime,
    "endTime",
    "End time"
  );
  if (endTime.error) return endTime;
  if (requiresValidSchedule) {
    if (
      scheduleType.value !== "ALWAYS_ACTIVE" &&
      Boolean(startTime.value) !== Boolean(endTime.value)
    ) {
      return {
        error: {
          field: startTime.value ? "endTime" : "startTime",
          message: "Enter both a start time and an end time, or select All day.",
        },
      };
    }
    if (scheduleType.value === "DATE_RANGE") {
      if (!startTime.value) {
        return {
          error: {
            field: "startTime",
            message: "Start time is required for a date range.",
          },
        };
      }
      if (!endTime.value) {
        return {
          error: {
            field: "endTime",
            message: "End time is required for a date range.",
          },
        };
      }
      if (
        startAt &&
        endAt &&
        (endAt < startAt ||
          (endAt.getTime() === startAt.getTime() &&
            endTime.value <= startTime.value))
      ) {
        return {
          error: {
            field: "endAt",
            message: "The end date and time must be after the start date and time.",
          },
        };
      }
    } else if (
      startTime.value &&
      endTime.value &&
      endTime.value <= startTime.value
    ) {
      return {
        error: {
          field: "endTime",
          message: "End time must be after the start time.",
        },
      };
    }
    if (
      status.value === "SCHEDULED" &&
      scheduleType.value === "ALWAYS_ACTIVE"
    ) {
      return {
        error: {
          field: "scheduleType",
          message: "Always-active promotions must be published now instead of scheduled.",
        },
      };
    }
  }

  const priority = Number(valueFor(body, existing, "priority") ?? 0);
  if (!Number.isInteger(priority) || priority < 0 || priority > 1000) {
    return {
      error: {
        field: "priority",
        message: "Priority must be a whole number between 0 and 1000.",
      },
    };
  }
  const isDismissible =
    valueFor(body, existing, "isDismissible") ?? true;
  if (typeof isDismissible !== "boolean") {
    return {
      error: {
        field: "isDismissible",
        message: "Dismissible must be true or false.",
      },
    };
  }
  const requestedIsActive = valueFor(body, existing, "isActive") ?? true;
  if (typeof requestedIsActive !== "boolean") {
    return {
      error: { field: "isActive", message: "Active must be true or false." },
    };
  }

  const value = {
      ...parsed,
      badgeEn: optionalText(valueFor(body, existing, "badgeEn"), 80),
      badgeAr: optionalText(valueFor(body, existing, "badgeAr"), 80),
      imageUrl: imageUrl.value,
      promotionType: promotionType.value,
      discountPercent:
        promotionType.value === "PERCENTAGE_DISCOUNT"
          ? discountPercent.value
          : null,
      discountAmount:
        promotionType.value === "FIXED_DISCOUNT"
          ? discountAmount.value
          : null,
      couponCode: promotionType.value === "COUPON" ? couponCode : null,
      minimumOrderAmount:
        promotionType.value === "INFORMATIONAL" || promotionType.value === "CUSTOM"
          ? null
          : minimumOrderAmount.value,
      targetUrl: targetUrl.value,
      buttonTextEn: optionalText(
        valueFor(body, existing, "buttonTextEn"),
        80
      ),
      buttonTextAr: optionalText(
        valueFor(body, existing, "buttonTextAr"),
        80
      ),
      scheduleType: scheduleType.value,
      weekdays,
      startAt,
      endAt,
      startTime: startTime.value,
      endTime: endTime.value,
      timezone: PROMOTION_TIMEZONE,
      displayPlacement: displayPlacement.value,
      priority,
      isDismissible,
      status: status.value,
      isActive:
        status.value === "ACTIVE" || status.value === "SCHEDULED"
          ? true
          : false,
  };

  if (
    status.value === "SCHEDULED" &&
    !hasScheduledPromotionOccurrence(value)
  ) {
    return {
      error: {
        field: "endAt",
        message: "This schedule has already ended. Choose a future occurrence.",
      },
    };
  }
  if (
    status.value === "ACTIVE" &&
    !isScheduledPromotionValidNow(value)
  ) {
    return {
      error: {
        field: "scheduleType",
        message: "Publish Now requires a schedule that is valid in Africa/Cairo right now.",
      },
    };
  }

  return {
    value,
  };
}

export async function getPublicScheduledPromotions(request, response) {
  const placementValue = request.query.placement;
  let placement;
  if (placementValue !== undefined) {
    const parsed = parseEnum(
      placementValue,
      DISPLAY_PLACEMENTS,
      "placement",
      "Select a valid display placement."
    );
    if (parsed.error) return response.status(400).json(parsed.error);
    placement = parsed.value;
  }

  const promotions = await getCurrentScheduledPromotions({ placement });
  response.set("Cache-Control", "no-store");
  return response.json({
    promotions,
    timezone: PROMOTION_TIMEZONE,
    serverTime: new Date().toISOString(),
  });
}

export async function getAdminScheduledPromotions(_request, response) {
  const promotions = await prisma.scheduledPromotion.findMany({
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
  return response.json({
    promotions: promotions
      .filter((promotion) => promotion.targetUrl !== "__X_DENTAL_COUPON__")
      .map((promotion) => serializeScheduledPromotion(promotion)),
  });
}

export async function createAdminScheduledPromotion(request, response) {
  const parsed = await parsePromotionInput(request.body ?? {});
  if (parsed.error) return response.status(400).json(parsed.error);
  try {
    const promotion = await prisma.scheduledPromotion.create({
      data: parsed.value,
    });
    return response
      .status(201)
      .json({ promotion: serializeScheduledPromotion(promotion) });
  } catch (error) {
    if (error?.code === "P2002") {
      return response.status(409).json({
        field: "couponCode",
        message: "This coupon code already exists.",
      });
    }
    throw error;
  }
}

export async function updateAdminScheduledPromotion(request, response) {
  if (!isValidId(request.params.id)) {
    return response.status(404).json({ message: "Promotion not found." });
  }
  const existing = await prisma.scheduledPromotion.findUnique({
    where: { id: request.params.id },
  });
  if (!existing) {
    return response.status(404).json({ message: "Promotion not found." });
  }
  const parsed = await parsePromotionInput(request.body ?? {}, existing);
  if (parsed.error) return response.status(400).json(parsed.error);
  try {
    const promotion = await prisma.scheduledPromotion.update({
      where: { id: existing.id },
      data: parsed.value,
    });
    return response.json({
      promotion: serializeScheduledPromotion(promotion),
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return response.status(409).json({
        field: "couponCode",
        message: "This coupon code already exists.",
      });
    }
    throw error;
  }
}

export async function archiveAdminScheduledPromotion(request, response) {
  if (!isValidId(request.params.id)) {
    return response.status(404).json({ message: "Promotion not found." });
  }
  const existing = await prisma.scheduledPromotion.findUnique({
    where: { id: request.params.id },
  });
  if (!existing) {
    return response.status(404).json({ message: "Promotion not found." });
  }
  const promotion = await prisma.scheduledPromotion.update({
    where: { id: existing.id },
    data: { status: "ARCHIVED", isActive: false },
  });
  return response.json({
    message: "Promotion archived successfully.",
    promotion: serializeScheduledPromotion(promotion),
  });
}
