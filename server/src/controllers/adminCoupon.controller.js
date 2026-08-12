import { prisma } from "../config/db.js";
import {
  COUPON_ENGINE_MARKER,
  normalizeCouponCode,
  serializeCoupon,
} from "../services/coupon.service.js";
import { cleanText } from "../utils/records.js";

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,39}$/;
const DISCOUNT_TYPES = new Set(["PERCENTAGE", "FIXED", "FREE_SHIPPING"]);
const LOCAL_DATE_TIME_PATTERN = /^(\d{4}-\d{2}-\d{2})T([0-2]\d:[0-5]\d)$/;

function fieldError(response, field, message) {
  return response.status(400).json({ field, message });
}

function parseLocalDateTime(value) {
  const match = cleanText(value, 30).match(LOCAL_DATE_TIME_PATTERN);
  if (!match) return null;
  const date = new Date(`${match[1]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : { date, time: match[2] };
}

async function parseCouponInput(body, response, existingId = null) {
  const code = normalizeCouponCode(body?.code);
  if (!CODE_PATTERN.test(code)) {
    fieldError(response, "code", "Use 2-40 letters, numbers, hyphens, or underscores.");
    return null;
  }
  const duplicate = await prisma.scheduledPromotion.findFirst({
    where: {
      couponCode: { equals: code, mode: "insensitive" },
      ...(existingId ? { id: { not: existingId } } : {}),
    },
    select: { id: true },
  });
  if (duplicate) {
    fieldError(response, "code", "This coupon code already exists.");
    return null;
  }

  const discountType = cleanText(body?.discountType, 30).toUpperCase();
  if (!DISCOUNT_TYPES.has(discountType)) {
    fieldError(response, "discountType", "Select a valid coupon type.");
    return null;
  }
  const value = Number(body?.value);
  if (discountType !== "FREE_SHIPPING" && (!Number.isFinite(value) || value <= 0)) {
    fieldError(response, "value", "Enter a discount value greater than zero.");
    return null;
  }
  if (discountType === "PERCENTAGE" && value > 100) {
    fieldError(response, "value", "Percentage discounts cannot exceed 100%.");
    return null;
  }
  const minimumOrderAmount = Number(body?.minimumOrderAmount ?? 0);
  if (!Number.isFinite(minimumOrderAmount) || minimumOrderAmount < 0) {
    fieldError(response, "minimumOrderAmount", "Minimum order must be zero or greater.");
    return null;
  }
  if (typeof body?.isActive !== "boolean") {
    fieldError(response, "isActive", "Active must be true or false.");
    return null;
  }

  const rawStartsAt = cleanText(body?.startsAt, 30);
  const rawEndsAt = cleanText(body?.endsAt, 30);
  let scheduleType = "ALWAYS_ACTIVE";
  let startAt = null;
  let endAt = null;
  let startTime = null;
  let endTime = null;
  if (rawStartsAt || rawEndsAt) {
    const start = parseLocalDateTime(rawStartsAt);
    const end = parseLocalDateTime(rawEndsAt);
    if (!start) {
      fieldError(response, "startsAt", "Enter a valid start date and time.");
      return null;
    }
    if (!end) {
      fieldError(response, "endsAt", "Enter a valid end date and time.");
      return null;
    }
    if (
      start.date > end.date ||
      (start.date.getTime() === end.date.getTime() && start.time >= end.time)
    ) {
      fieldError(response, "endsAt", "The end must be after the start.");
      return null;
    }
    scheduleType = "DATE_RANGE";
    startAt = start.date;
    endAt = end.date;
    startTime = start.time;
    endTime = end.time;
  }

  return {
    titleEn: `Coupon ${code}`,
    titleAr: `Coupon ${code}`,
    descriptionEn: `Customer coupon ${code}`,
    descriptionAr: `Customer coupon ${code}`,
    promotionType: discountType === "FREE_SHIPPING" ? "FREE_DELIVERY" : "COUPON",
    discountPercent: discountType === "PERCENTAGE" ? value : null,
    discountAmount: discountType === "FIXED" ? value : null,
    couponCode: code,
    targetUrl: COUPON_ENGINE_MARKER,
    minimumOrderAmount,
    scheduleType,
    weekdays: [],
    startAt,
    endAt,
    startTime,
    endTime,
    timezone: "Africa/Cairo",
    displayPlacement: "POPUP",
    priority: 0,
    isDismissible: false,
    status: body.isActive ? "ACTIVE" : "PAUSED",
    isActive: body.isActive,
  };
}

export async function getAdminCoupons(_request, response) {
  const coupons = await prisma.scheduledPromotion.findMany({
    where: {
      couponCode: { not: null },
      promotionType: { in: ["COUPON", "FREE_DELIVERY"] },
      targetUrl: COUPON_ENGINE_MARKER,
    },
    orderBy: [{ createdAt: "desc" }],
  });
  return response.json({ coupons: coupons.map((coupon) => serializeCoupon(coupon)) });
}

export async function createAdminCoupon(request, response) {
  const data = await parseCouponInput(request.body ?? {}, response);
  if (!data) return;
  try {
    const coupon = await prisma.scheduledPromotion.create({ data });
    return response.status(201).json({ coupon: serializeCoupon(coupon) });
  } catch (error) {
    if (error?.code === "P2002") {
      return response.status(409).json({ field: "code", message: "This coupon code already exists." });
    }
    throw error;
  }
}

export async function updateAdminCoupon(request, response) {
  const existing = await prisma.scheduledPromotion.findFirst({
    where: { id: request.params.id, couponCode: { not: null }, targetUrl: COUPON_ENGINE_MARKER },
  });
  if (!existing) return response.status(404).json({ message: "Coupon not found." });
  const data = await parseCouponInput(request.body ?? {}, response, existing.id);
  if (!data) return;
  try {
    const coupon = await prisma.scheduledPromotion.update({ where: { id: existing.id }, data });
    return response.json({ coupon: serializeCoupon(coupon) });
  } catch (error) {
    if (error?.code === "P2002") {
      return response.status(409).json({ field: "code", message: "This coupon code already exists." });
    }
    throw error;
  }
}

export async function deleteAdminCoupon(request, response) {
  const existing = await prisma.scheduledPromotion.findFirst({
    where: { id: request.params.id, couponCode: { not: null }, targetUrl: COUPON_ENGINE_MARKER },
  });
  if (!existing) return response.status(404).json({ message: "Coupon not found." });
  await prisma.scheduledPromotion.delete({ where: { id: existing.id } });
  return response.json({ message: "Coupon deleted successfully." });
}
