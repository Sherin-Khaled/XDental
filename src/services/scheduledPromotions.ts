import { apiRequest } from "./http";

export type PromotionType =
  | "INFORMATIONAL"
  | "PERCENTAGE_DISCOUNT"
  | "FIXED_DISCOUNT"
  | "COUPON"
  | "FREE_DELIVERY"
  | "CUSTOM";

export type PromotionScheduleType =
  | "ONE_TIME_DATE"
  | "DATE_RANGE"
  | "WEEKLY_RECURRING"
  | "ALWAYS_ACTIVE";

export type PromotionDisplayPlacement =
  | "ANNOUNCEMENT_BANNER"
  | "NOTIFICATION_CENTER"
  | "HOMEPAGE_PROMOTION_CARD"
  | "ACCOUNT_DASHBOARD"
  | "POPUP";

export type PromotionStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "ACTIVE"
  | "PAUSED"
  | "EXPIRED"
  | "ARCHIVED";

export type ScheduledPromotion = {
  id: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  badgeEn: string | null;
  badgeAr: string | null;
  imageUrl: string | null;
  promotionType: PromotionType;
  discountPercent: number | null;
  discountAmount: number | null;
  couponCode: string | null;
  minimumOrderAmount: number | null;
  targetUrl: string | null;
  buttonTextEn: string | null;
  buttonTextAr: string | null;
  scheduleType: PromotionScheduleType;
  weekdays: number[];
  startAt: string | null;
  endAt: string | null;
  startTime: string | null;
  endTime: string | null;
  timezone: string;
  displayPlacement: PromotionDisplayPlacement;
  priority: number;
  isDismissible: boolean;
  status: PromotionStatus;
  storedStatus: PromotionStatus;
  isActive: boolean;
  isCurrentlyValid: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ScheduledPromotionInput = Omit<
  ScheduledPromotion,
  "id" | "timezone" | "storedStatus" | "isCurrentlyValid" | "createdAt" | "updatedAt"
>;

export async function getAdminScheduledPromotions(signal?: AbortSignal) {
  const result = await apiRequest<{ promotions: ScheduledPromotion[] }>(
    "/admin/scheduled-promotions",
    { signal }
  );
  return result.promotions;
}

export async function createAdminScheduledPromotion(
  input: ScheduledPromotionInput
) {
  const result = await apiRequest<{ promotion: ScheduledPromotion }>(
    "/admin/scheduled-promotions",
    { method: "POST", body: JSON.stringify(input) }
  );
  return result.promotion;
}

export async function updateAdminScheduledPromotion(
  id: string,
  input: ScheduledPromotionInput
) {
  const result = await apiRequest<{ promotion: ScheduledPromotion }>(
    `/admin/scheduled-promotions/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
  return result.promotion;
}

export async function archiveAdminScheduledPromotion(id: string) {
  return apiRequest<{ message: string; promotion: ScheduledPromotion }>(
    `/admin/scheduled-promotions/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

export async function getCurrentScheduledPromotions(
  placement: PromotionDisplayPlacement,
  signal?: AbortSignal
) {
  return apiRequest<{
    promotions: ScheduledPromotion[];
    timezone: string;
    serverTime: string;
  }>(`/promotions?placement=${encodeURIComponent(placement)}`, { signal });
}
