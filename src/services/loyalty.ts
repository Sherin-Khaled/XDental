import { apiRequest } from "./http";

export type PublicLoyaltySettings = {
  welcomePoints: number;
  welcomeValueEgp: number;
  welcomeMinimumSubtotalEgp: number;
  welcomeExpiryDays: number;
  appliesTo: "PRODUCTS_ONLY";
};

export async function getPublicLoyaltySettings(signal?: AbortSignal) {
  const result = await apiRequest<{ settings: PublicLoyaltySettings }>(
    "/loyalty/settings",
    { signal }
  );
  return result.settings;
}
