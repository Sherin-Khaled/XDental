import { apiRequest } from "./http";
import type { TrustedOrderTotals } from "./orders";

export type CouponDiscountType = "PERCENTAGE" | "FIXED" | "FREE_SHIPPING";

export type AdminCoupon = {
  id: string;
  code: string;
  discountType: CouponDiscountType;
  value: number;
  minimumOrderAmount: number;
  scheduleType: "ALWAYS_ACTIVE" | "DATE_RANGE";
  startsAt: string | null;
  endsAt: string | null;
  startTime: string | null;
  endTime: string | null;
  isActive: boolean;
  status: string;
  isCurrentlyValid: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminCouponInput = {
  code: string;
  discountType: CouponDiscountType;
  value: number;
  minimumOrderAmount: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

export type CouponPreview = {
  coupon: {
    code: string;
    titleEn?: string;
    titleAr?: string;
    discountType: CouponDiscountType;
    value: number;
    minimumOrderAmount: number;
  };
  totals: TrustedOrderTotals;
};

export async function previewCoupon(
  promoCode: string,
  items: Array<{
    productId?: string;
    sku?: string;
    slug?: string;
    selectedOptions?: string;
    quantity: number;
  }>
) {
  return apiRequest<CouponPreview>("/orders/coupon-preview", {
    method: "POST",
    body: JSON.stringify({ promoCode, items }),
  });
}

export async function getAdminCoupons(signal?: AbortSignal) {
  const result = await apiRequest<{ coupons: AdminCoupon[] }>("/admin/coupons", { signal });
  return result.coupons;
}

export async function createAdminCoupon(input: AdminCouponInput) {
  const result = await apiRequest<{ coupon: AdminCoupon }>("/admin/coupons", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return result.coupon;
}

export async function updateAdminCoupon(id: string, input: AdminCouponInput) {
  const result = await apiRequest<{ coupon: AdminCoupon }>(
    `/admin/coupons/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
  return result.coupon;
}

export async function deleteAdminCoupon(id: string) {
  return apiRequest<{ message: string }>(`/admin/coupons/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
