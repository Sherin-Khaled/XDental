import { apiRequest } from "./http";

export type CustomerVipBenefit = {
  type: "FREE_SHIPPING" | "PERCENTAGE_DISCOUNT" | "FIXED_DISCOUNT" | "PROMO_CODE" | "CUSTOM";
  titleEn: string;
  titleAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  discountPercent: number | null;
  discountAmount: number | null;
  promoCode: string | null;
  minimumOrderAmount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  status: "ACTIVE" | "PAUSED" | "EXPIRED";
};

export async function getMyVipBenefits(signal?: AbortSignal) {
  return apiRequest<{
    customerTier: "standard" | "vip";
    benefits: CustomerVipBenefit[];
  }>("/account/vip-benefits", { signal });
}

export type AccountLanguage = "en" | "ar";

export type AccountPreferences = {
  orderUpdates: boolean;
  quoteUpdates: boolean;
  productRequestUpdates: boolean;
  backInStockUpdates: boolean;
  supportReplyUpdates: boolean;
  personalizedRecommendations: boolean;
  saveBrowsingActivity: boolean;
  useOrderHistoryForSuggestions: boolean;
  weeklyOffers: boolean;
  newArrivals: boolean;
  clinicSupplyOffers: boolean;
  marketingBackInStock: boolean;
  language: AccountLanguage;
  country: "Egypt";
  currency: "EGP";
};

export type AccountPreferencePatch = Partial<AccountPreferences>;

export type LoyaltyPointTransaction = {
  id: string;
  orderId: string | null;
  type: "WELCOME_PENDING" | "WELCOME_ACTIVATED" | "WELCOME_GRANTED" | "WELCOME_RESTORE" | "ORDER_EARN" | "REDEMPTION" | "RESTORE" | "REVERSAL" | "EXPIRATION" | "ADMIN_ADJUSTMENT";
  points: number;
  balanceAfter: number;
  status: "PENDING" | "ACTIVE" | "REVERSED" | "EXPIRED";
  expiresAt: string | null;
  description: string;
  actor: { id: string; name: string; role: string } | null;
  createdAt: string;
};

export type WalletTransaction = {
  id: string;
  orderId: string | null;
  type: "REFUND_CREDIT" | "PROMOTIONAL_CREDIT" | "ADMIN_CREDIT" | "ADMIN_DEBIT" | "ORDER_PAYMENT" | "RESTORE";
  amount: number;
  balanceAfter: number;
  description: string;
  actor: { id: string; name: string; role: string } | null;
  createdAt: string;
};

export type LoyaltyProgramSettings = {
  enabled: boolean;
  standardPointsPerEgp10: number;
  vipPointsPerEgp10: number;
  pointsPerRedemptionUnit: number;
  redemptionValueEgp: number;
  welcomePoints: number;
  welcomeMinimumSubtotalEgp: number;
  welcomeExpiryDays: number;
  minimumRedemptionPoints: number;
  maximumRedemptionPercent: number;
  expiryMonths: number;
};

export type CustomerLoyaltySummary = {
  account: {
    availablePoints: number;
    pendingPoints: number;
    lifetimeEarnedPoints: number;
    lifetimeRedeemedPoints: number;
    redeemablePointValue: number;
    walletBalance: number;
    pointsExpiringSoon: number;
  };
  customerTier: "standard" | "vip";
  settings: LoyaltyProgramSettings;
  pointTransactions: LoyaltyPointTransaction[];
  walletTransactions: WalletTransaction[];
};

export async function getMyLoyalty(signal?: AbortSignal) {
  return apiRequest<CustomerLoyaltySummary>("/account/loyalty", { signal });
}

export type AccountSession = {
  id: string;
  isCurrent: boolean;
  deviceSummary: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
};

export type AccountActionRequestType = "DEACTIVATION" | "DELETION";
export type AccountActionRequestStatus =
  | "PENDING"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "CANCELED"
  | "COMPLETED";

export type AccountActionRequest = {
  id: string;
  publicRequestNumber: string;
  type: AccountActionRequestType;
  status: AccountActionRequestStatus;
  customerReason: string | null;
  customerDetails: string | null;
  submittedAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  customerResponse: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  cancellationReason: string | null;
  canCancel: boolean;
};

export async function getAccountPreferences(signal?: AbortSignal) {
  return apiRequest<{
    preferences: AccountPreferences;
    persisted: boolean;
  }>("/account/preferences", { signal });
}

export async function updateAccountPreferences(
  patch: AccountPreferencePatch,
  signal?: AbortSignal
) {
  return apiRequest<{
    preferences: AccountPreferences;
    persisted: true;
  }>("/account/preferences", {
    method: "PATCH",
    body: JSON.stringify(patch),
    signal,
  });
}

export async function getAccountSessions(signal?: AbortSignal) {
  return apiRequest<{
    sessions: AccountSession[];
    currentSessionId: string | null;
    legacyCurrentSession: boolean;
  }>("/auth/sessions", { signal });
}

export async function revokeAccountSession(sessionId: string) {
  return apiRequest<{
    revoked: true;
    currentSessionRevoked: boolean;
  }>(`/auth/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
}

export async function logoutOtherAccountSessions() {
  return apiRequest<{ revokedCount: number }>("/auth/sessions/logout-others", {
    method: "POST",
  });
}

export async function getAccountActionRequests(signal?: AbortSignal) {
  const result = await apiRequest<{ requests: AccountActionRequest[] }>(
    "/account/action-requests",
    { signal }
  );
  return result.requests;
}

export async function createAccountActionRequest(input: {
  type: AccountActionRequestType;
  customerReason?: string;
  customerDetails?: string;
  confirmation: "DEACTIVATE" | "DELETE";
}) {
  return apiRequest<{ request: AccountActionRequest; created: boolean }>(
    "/account/action-requests",
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export async function cancelAccountActionRequest(
  requestId: string,
  cancellationReason?: string
) {
  const result = await apiRequest<{ request: AccountActionRequest }>(
    `/account/action-requests/${encodeURIComponent(requestId)}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({ cancellationReason }),
    }
  );
  return result.request;
}
