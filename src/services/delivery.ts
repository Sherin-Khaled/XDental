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
  label?: string | null;
  addressLine?: string | null;
  governorate?: string | null;
  cityArea?: string | null;
  buildingNumber?: string | null;
  apartmentFloor?: string | null;
  postalCode?: string | null;
  isDefault?: boolean;
};

export type ClinicLocation = {
  id: string;
  deliveryZoneId: string;
  customArea: string | null;
  label: string | null;
  addressLine: string | null;
  governorate: string | null;
  cityArea: string | null;
  buildingNumber: string | null;
  apartmentFloor: string | null;
  postalCode: string | null;
  isDefault: boolean;
  deliveryZone: DeliveryZone;
};

export type SavedClinicLocationInput = ClinicLocationInput & {
  label: string;
  addressLine: string;
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

export async function createMyClinicLocation(input: SavedClinicLocationInput) {
  const result = await apiRequest<{ clinicLocation: ClinicLocation }>(
    "/delivery-zones/my",
    { method: "POST", body: JSON.stringify(input) }
  );
  return result.clinicLocation;
}

export async function updateMyClinicLocation(
  locationId: string,
  input: SavedClinicLocationInput
) {
  const result = await apiRequest<{ clinicLocation: ClinicLocation }>(
    `/delivery-zones/my/${encodeURIComponent(locationId)}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
  return result.clinicLocation;
}

export async function deleteMyClinicLocation(locationId: string) {
  await apiRequest(`/delivery-zones/my/${encodeURIComponent(locationId)}`, {
    method: "DELETE",
  });
}

export async function getMyMatchingDeliveryOffers(signal?: AbortSignal) {
  return apiRequest<MyMatchingDeliveryOffersResponse>("/delivery-offers/my", {
    signal,
  });
}
