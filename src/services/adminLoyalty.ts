import { apiRequest } from "./http";
import type {
  CustomerLoyaltySummary,
  LoyaltyPointTransaction,
  LoyaltyProgramSettings,
  WalletTransaction,
} from "./account";

export type AdminLoyaltyCustomer = {
  id: string;
  name: string;
  email: string;
  customerTier: "standard" | "vip";
  isActive: boolean;
  availablePoints: number;
  pendingPoints: number;
  walletBalance: number;
};

export type AdminLoyaltyCustomerDetail = CustomerLoyaltySummary & {
  customer: {
    id: string;
    name: string;
    email: string;
    customerTier: "standard" | "vip";
    isActive: boolean;
  };
};

export async function getAdminLoyaltyCustomers(search = "", signal?: AbortSignal) {
  const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
  const result = await apiRequest<{ customers: AdminLoyaltyCustomer[] }>(
    `/admin/loyalty/customers${query}`,
    { signal }
  );
  return result.customers;
}

export function getAdminLoyaltyCustomer(userId: string, signal?: AbortSignal) {
  return apiRequest<AdminLoyaltyCustomerDetail>(
    `/admin/loyalty/customers/${encodeURIComponent(userId)}`,
    { signal }
  );
}

export async function adjustAdminCustomerPoints(
  userId: string,
  input: { points: number; reason: string },
  idempotencyKey: string
) {
  return apiRequest<{ transaction: LoyaltyPointTransaction; created: boolean }>(
    `/admin/loyalty/customers/${encodeURIComponent(userId)}/points`,
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ ...input, confirmation: "ADJUST_POINTS" }),
    }
  );
}

export async function adjustAdminCustomerWallet(
  userId: string,
  input: {
    amount: string;
    adjustmentType: "REFUND_CREDIT" | "PROMOTIONAL_CREDIT" | "ADMIN_CREDIT" | "ADMIN_DEBIT";
    reason: string;
    approvalReference?: string;
  },
  idempotencyKey: string
) {
  return apiRequest<{ transaction: WalletTransaction; created: boolean }>(
    `/admin/loyalty/customers/${encodeURIComponent(userId)}/wallet`,
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ ...input, confirmation: "ADJUST_WALLET" }),
    }
  );
}

export async function getAdminLoyaltySettings(signal?: AbortSignal) {
  const result = await apiRequest<{ settings: LoyaltyProgramSettings }>(
    "/admin/loyalty/settings",
    { signal }
  );
  return result.settings;
}

export async function updateAdminLoyaltySettings(
  patch: LoyaltyProgramSettings
) {
  const result = await apiRequest<{ settings: LoyaltyProgramSettings }>(
    "/admin/loyalty/settings",
    {
      method: "PATCH",
      body: JSON.stringify({
        ...patch,
        confirmation: "UPDATE_LOYALTY_SETTINGS",
      }),
    }
  );
  return result.settings;
}
