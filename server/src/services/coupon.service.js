import {
  getEffectivePromotionStatus,
  isScheduledPromotionValidNow,
} from "./scheduledPromotion.service.js";

export const COUPON_ENGINE_MARKER = "__X_DENTAL_COUPON__";

function toCents(value) {
  return Math.max(0, Math.round(Number(value ?? 0) * 100));
}

export function normalizeCouponCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

export function couponDiscountType(coupon) {
  if (coupon.promotionType === "FREE_DELIVERY") return "FREE_SHIPPING";
  if (Number(coupon.discountPercent ?? 0) > 0) return "PERCENTAGE";
  return "FIXED";
}

export function serializeCoupon(coupon, now = new Date()) {
  return {
    id: coupon.id,
    code: normalizeCouponCode(coupon.couponCode),
    titleEn: coupon.titleEn,
    titleAr: coupon.titleAr,
    discountType: couponDiscountType(coupon),
    value:
      couponDiscountType(coupon) === "PERCENTAGE"
        ? Number(coupon.discountPercent)
        : couponDiscountType(coupon) === "FIXED"
          ? Number(coupon.discountAmount)
          : 0,
    minimumOrderAmount: Number(coupon.minimumOrderAmount ?? 0),
    scheduleType: coupon.scheduleType,
    startsAt: coupon.startAt,
    endsAt: coupon.endAt,
    startTime: coupon.startTime,
    endTime: coupon.endTime,
    isActive: coupon.isActive,
    status: getEffectivePromotionStatus(coupon, now),
    isCurrentlyValid: isScheduledPromotionValidNow(coupon, now),
    createdAt: coupon.createdAt,
    updatedAt: coupon.updatedAt,
  };
}

export async function evaluatePublicCoupon(
  database,
  { promoCode = "", subtotalCents, shippingCents, now = new Date() }
) {
  const code = normalizeCouponCode(promoCode);
  if (!code) return { status: "none" };

  const candidates = await database.scheduledPromotion.findMany({
    where: {
      couponCode: { equals: code, mode: "insensitive" },
      isActive: true,
      status: { in: ["ACTIVE", "SCHEDULED"] },
      OR: [
        { promotionType: "COUPON" },
        {
          promotionType: "FREE_DELIVERY",
          targetUrl: COUPON_ENGINE_MARKER,
        },
      ],
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
  });
  const eligible = candidates.filter((candidate) =>
    isScheduledPromotionValidNow(candidate, now)
  );
  if (eligible.length > 1) {
    return {
      status: "invalid",
      reason: "ambiguous",
      message: "This coupon cannot be applied safely. Please contact support.",
    };
  }
  const coupon = eligible[0];
  if (!coupon) {
    return {
      status: "invalid",
      reason: "unavailable",
      message: "This coupon is invalid, inactive, scheduled for another time, or expired.",
    };
  }

  const minimumOrderCents = toCents(coupon.minimumOrderAmount);
  if (subtotalCents < minimumOrderCents) {
    return {
      status: "invalid",
      reason: "minimum",
      minimumOrderAmount: minimumOrderCents / 100,
      message: `This coupon requires a minimum order of EGP ${minimumOrderCents / 100}.`,
    };
  }

  const type = couponDiscountType(coupon);
  let discountCents = 0;
  let discountedShippingCents = shippingCents;
  if (type === "PERCENTAGE") {
    const percent = Math.min(100, Math.max(0, Number(coupon.discountPercent ?? 0)));
    discountCents = Math.round(subtotalCents * (percent / 100));
  } else if (type === "FIXED") {
    discountCents = Math.min(subtotalCents, toCents(coupon.discountAmount));
  } else {
    discountedShippingCents = 0;
  }

  return {
    status: "valid",
    coupon: serializeCoupon(coupon, now),
    sourceType: "COUPON",
    sourceId: coupon.id,
    titleEn: coupon.titleEn,
    titleAr: coupon.titleAr,
    discountCents,
    shippingCents: discountedShippingCents,
  };
}
