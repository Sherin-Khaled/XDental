import { apiRequest } from "./http";

export type AdminUserRole = "customer" | "support" | "admin";
export type CustomerTier = "standard" | "vip";

export type CustomerBenefit = {
  id: string;
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
  isActive: boolean;
  pausedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lifecycle: "ACTIVE" | "PAUSED" | "REVOKED" | "EXPIRED";
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: AdminUserRole;
  customerTier: CustomerTier;
  isActive: boolean;
  lifecycleState: "ACTIVE" | "DELETION_REQUESTED" | "DEACTIVATED" | "DELETED";
  lifecycleRequests: Array<{
    id: string;
    publicRequestNumber: string;
    type: "DEACTIVATION" | "DELETION";
    status: "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "CANCELED" | "COMPLETED";
    submittedAt: string;
    completedAt: string | null;
  }>;
  permissions: string[];
  permissionsUpdatedAt: string | null;
  permissionsUpdatedBy: { id: string; name: string; email: string } | null;
  activeBenefitCount: number;
  benefits: CustomerBenefit[];
  createdAt: string;
  updatedAt: string;
  orderCount: number;
  productRequestCount: number;
};

export type CreateAdminUserInput = {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: AdminUserRole;
  customerTier?: CustomerTier;
  permissions?: string[];
};

export async function getAdminUsers(
  options: { search?: string; role?: AdminUserRole; tier?: CustomerTier; signal?: AbortSignal } = {}
) {
  const params = new URLSearchParams();
  if (options.search?.trim()) params.set("search", options.search.trim());
  if (options.role) params.set("role", options.role);
  if (options.tier) params.set("tier", options.tier);
  const query = params.toString();
  const result = await apiRequest<{ users: AdminUser[] }>(
    `/admin/users${query ? `?${query}` : ""}`,
    { signal: options.signal }
  );
  return result.users;
}

export type PermissionCatalog = {
  permissions: string[];
  groups: Record<string, string[]>;
  presets: Record<string, string[]>;
};

export async function getPermissionCatalog() {
  return apiRequest<PermissionCatalog>("/admin/permissions");
}

export async function getAdminUser(id: string) {
  const result = await apiRequest<{ user: AdminUser }>(`/admin/users/${encodeURIComponent(id)}`);
  return result.user;
}

export async function updateCustomerTier(id: string, customerTier: CustomerTier) {
  const result = await apiRequest<{ user: AdminUser }>(`/admin/users/${encodeURIComponent(id)}/tier`, {
    method: "PATCH",
    body: JSON.stringify({ customerTier }),
  });
  return result.user;
}

export async function replaceSupportPermissions(id: string, permissions: string[]) {
  const result = await apiRequest<{ user: AdminUser }>(`/admin/users/${encodeURIComponent(id)}/permissions`, {
    method: "PUT",
    body: JSON.stringify({ permissions }),
  });
  return result.user;
}

export async function updateAdminUserStatus(id: string, isActive: boolean) {
  const result = await apiRequest<{ user: AdminUser }>(`/admin/users/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ isActive }),
  });
  return result.user;
}

export async function createAdminUserAccountActionRequest(
  id: string,
  input: {
    type: "DEACTIVATION" | "DELETION";
    customerResponse: string;
    adminNote: string;
    confirmation: "INITIATE_DEACTIVATION" | "INITIATE_DELETION";
  }
) {
  return apiRequest<{
    request: { id: string; publicRequestNumber: string };
    created: boolean;
  }>(`/admin/users/${encodeURIComponent(id)}/account-action-requests`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type CustomerBenefitInput = Omit<
  CustomerBenefit,
  "id" | "isActive" | "pausedAt" | "revokedAt" | "createdAt" | "updatedAt" | "lifecycle"
>;

export async function createCustomerBenefit(userId: string, input: CustomerBenefitInput) {
  const result = await apiRequest<{ benefit: CustomerBenefit }>(`/admin/users/${encodeURIComponent(userId)}/benefits`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return result.benefit;
}

export async function updateCustomerBenefit(userId: string, benefitId: string, input: Partial<CustomerBenefitInput>) {
  const result = await apiRequest<{ benefit: CustomerBenefit }>(
    `/admin/users/${encodeURIComponent(userId)}/benefits/${encodeURIComponent(benefitId)}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
  return result.benefit;
}

export async function updateCustomerBenefitLifecycle(
  userId: string,
  benefitId: string,
  action: "PAUSE" | "REACTIVATE" | "REVOKE"
) {
  const result = await apiRequest<{ benefit: CustomerBenefit }>(
    `/admin/users/${encodeURIComponent(userId)}/benefits/${encodeURIComponent(benefitId)}/lifecycle`,
    { method: "POST", body: JSON.stringify({ action }) }
  );
  return result.benefit;
}

export async function createAdminUser(input: CreateAdminUserInput) {
  const result = await apiRequest<{ user: AdminUser }>("/admin/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return result.user;
}
