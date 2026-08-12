import { apiRequest } from "./http";

export type AdminBrandStatus = "ACTIVE" | "INACTIVE" | "NEEDS_LOGO";

export type AdminBrand = {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  logoUrl: string | null;
  description: string | null;
  featured: boolean;
  status: AdminBrandStatus;
  productCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminBrandInput = {
  name: string;
  country?: string;
  logoUrl?: string;
  description?: string;
  featured: boolean;
  status: AdminBrandStatus;
};

export async function getAdminBrands(
  options: { search?: string; status?: AdminBrandStatus; featured?: boolean; signal?: AbortSignal } = {}
) {
  const params = new URLSearchParams();
  if (options.search?.trim()) params.set("search", options.search.trim());
  if (options.status) params.set("status", options.status);
  if (options.featured !== undefined) params.set("featured", String(options.featured));
  const query = params.toString();
  const result = await apiRequest<{ brands: AdminBrand[] }>(
    `/admin/brands${query ? `?${query}` : ""}`,
    { signal: options.signal }
  );
  return result.brands;
}

export async function createAdminBrand(input: AdminBrandInput) {
  const result = await apiRequest<{ brand: AdminBrand }>("/admin/brands", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return result.brand;
}

export async function updateAdminBrand(id: string, input: AdminBrandInput) {
  const result = await apiRequest<{ brand: AdminBrand }>(`/admin/brands/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return result.brand;
}

export async function deleteAdminBrand(id: string) {
  return apiRequest<{ message: string; brand: AdminBrand }>(`/admin/brands/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
