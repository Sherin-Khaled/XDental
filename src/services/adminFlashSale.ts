import { apiRequest } from "./http";

export type AdminFlashSaleProduct = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  price: number | null;
  imageUrl: string | null;
  status: string;
  isAvailable: boolean;
};

export type AdminFlashSale = {
  id: string;
  salePrice: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  product: AdminFlashSaleProduct | null;
};

export type AdminFlashSaleInput = {
  productId: string;
  salePrice: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  displayOrder?: number;
};

export async function getAdminFlashSales(options: { signal?: AbortSignal } = {}) {
  const result = await apiRequest<{ flashSales: AdminFlashSale[] }>("/admin/flash-sales", {
    signal: options.signal,
  });
  return result.flashSales;
}

export async function createAdminFlashSale(input: AdminFlashSaleInput) {
  const result = await apiRequest<{ flashSale: AdminFlashSale }>("/admin/flash-sales", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return result.flashSale;
}

export async function updateAdminFlashSale(id: string, input: AdminFlashSaleInput) {
  const result = await apiRequest<{ flashSale: AdminFlashSale }>(`/admin/flash-sales/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return result.flashSale;
}

export async function deleteAdminFlashSale(id: string) {
  return apiRequest<{ message: string; flashSale: AdminFlashSale }>(`/admin/flash-sales/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
