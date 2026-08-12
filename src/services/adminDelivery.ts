import { apiRequest } from "./http";
import type { DeliveryZone } from "./delivery";

export type AdminDeliveryZone = DeliveryZone & {
  userCount: number;
  offerCount: number;
};

export type AdminDeliveryZoneInput = {
  slug: string;
  nameEn: string;
  nameAr: string;
  isActive: boolean;
  displayOrder: number;
};

export type AdminDeliveryOffer = {
  id: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  offerType:
    | "SAME_DAY_DELIVERY"
    | "FREE_DELIVERY"
    | "DISCOUNTED_DELIVERY"
    | "CUSTOM";
  recurrenceType: "WEEKLY" | "SPECIFIC_DATE" | "DATE_RANGE";
  weekdays: number[];
  specificDate: string | null;
  startDate: string | null;
  endDate: string | null;
  cutoffTime: string | null;
  timezone: string;
  discountType: "PERCENTAGE" | "FIXED" | null;
  discountValue: number | null;
  minimumOrderAmount: number | null;
  appliesToStandard: boolean;
  appliesToFast: boolean;
  isActive: boolean;
  isCurrentlyValid: boolean;
  deliveryZones: AdminDeliveryZone[];
  createdAt: string;
  updatedAt: string;
};

export type AdminDeliveryOfferInput = {
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  offerType: AdminDeliveryOffer["offerType"];
  recurrenceType: AdminDeliveryOffer["recurrenceType"];
  weekdays: number[];
  specificDate: string | null;
  startDate: string | null;
  endDate: string | null;
  cutoffTime: string | null;
  discountType: "PERCENTAGE" | "FIXED" | null;
  discountValue: number | null;
  minimumOrderAmount: number | null;
  appliesToStandard: boolean;
  appliesToFast: boolean;
  isActive: boolean;
  deliveryZoneIds: string[];
};

export type EligibleDeliveryUser = {
  id: string;
  name: string;
  email: string;
  matchedLocations: Array<{
    deliveryZoneId: string;
    nameEn: string;
    nameAr: string;
  }>;
};

export async function getAdminDeliveryZones(signal?: AbortSignal) {
  const result = await apiRequest<{ deliveryZones: AdminDeliveryZone[] }>(
    "/admin/delivery-zones",
    { signal }
  );
  return result.deliveryZones;
}

export async function createAdminDeliveryZone(
  input: AdminDeliveryZoneInput
) {
  const result = await apiRequest<{ deliveryZone: AdminDeliveryZone }>(
    "/admin/delivery-zones",
    { method: "POST", body: JSON.stringify(input) }
  );
  return result.deliveryZone;
}

export async function updateAdminDeliveryZone(
  id: string,
  input: AdminDeliveryZoneInput
) {
  const result = await apiRequest<{ deliveryZone: AdminDeliveryZone }>(
    `/admin/delivery-zones/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
  return result.deliveryZone;
}

export async function deleteAdminDeliveryZone(id: string) {
  return apiRequest<{ message: string }>(
    `/admin/delivery-zones/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

export async function getAdminDeliveryOffers(signal?: AbortSignal) {
  const result = await apiRequest<{ deliveryOffers: AdminDeliveryOffer[] }>(
    "/admin/delivery-offers",
    { signal }
  );
  return result.deliveryOffers;
}

export async function createAdminDeliveryOffer(
  input: AdminDeliveryOfferInput
) {
  const result = await apiRequest<{ deliveryOffer: AdminDeliveryOffer }>(
    "/admin/delivery-offers",
    { method: "POST", body: JSON.stringify(input) }
  );
  return result.deliveryOffer;
}

export async function updateAdminDeliveryOffer(
  id: string,
  input: AdminDeliveryOfferInput
) {
  const result = await apiRequest<{ deliveryOffer: AdminDeliveryOffer }>(
    `/admin/delivery-offers/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
  return result.deliveryOffer;
}

export async function deleteAdminDeliveryOffer(id: string) {
  return apiRequest<{ message: string }>(
    `/admin/delivery-offers/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

export async function getEligibleUsersForDeliveryOffer(
  id: string,
  signal?: AbortSignal
) {
  return apiRequest<{
    isCurrentlyValid: boolean;
    eligibleUsers: EligibleDeliveryUser[];
  }>(`/admin/delivery-offers/${encodeURIComponent(id)}/eligible-users`, {
    signal,
  });
}
