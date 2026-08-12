import { apiRequest } from "./http";

export type DeliveryZone = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ClinicLocationInput = {
  deliveryZoneId: string;
  customArea?: string | null;
};

export type ClinicLocation = {
  id: string;
  deliveryZoneId: string;
  customArea: string | null;
  deliveryZone: DeliveryZone;
};

export type MatchingDeliveryLocation = {
  deliveryZoneId: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  customArea: string | null;
};

export type MatchingDeliveryOffer = {
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
  cutoffTime: string | null;
  timezone: string;
  discountType: "PERCENTAGE" | "FIXED" | null;
  discountValue: number | null;
  minimumOrderAmount: number | null;
  appliesToStandard: boolean;
  appliesToFast: boolean;
  matchedLocations: MatchingDeliveryLocation[];
};

export type MyMatchingDeliveryOffersResponse = {
  offers: MatchingDeliveryOffer[];
  needsClinicLocations: boolean;
  timezone: string;
  serverTime: string;
};

export async function getActiveDeliveryZones(signal?: AbortSignal) {
  const result = await apiRequest<{ deliveryZones: DeliveryZone[] }>(
    "/delivery-zones",
    { signal }
  );
  return result.deliveryZones;
}

export async function getMyClinicLocations(signal?: AbortSignal) {
  const result = await apiRequest<{ clinicLocations: ClinicLocation[] }>(
    "/delivery-zones/my",
    { signal }
  );
  return result.clinicLocations;
}

export async function updateMyClinicLocations(
  clinicLocations: ClinicLocationInput[]
) {
  const result = await apiRequest<{ clinicLocations: ClinicLocation[] }>(
    "/delivery-zones/my",
    {
      method: "PUT",
      body: JSON.stringify({ clinicLocations }),
    }
  );
  return result.clinicLocations;
}

export async function getMyMatchingDeliveryOffers(signal?: AbortSignal) {
  return apiRequest<MyMatchingDeliveryOffersResponse>("/delivery-offers/my", {
    signal,
  });
}
