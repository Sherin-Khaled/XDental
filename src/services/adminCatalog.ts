import { apiRequest } from "./http";

export type AdminCategoryStatus = "ACTIVE" | "DRAFT" | "INACTIVE";
export type AdminProductStatus = "ACTIVE" | "LOW_STOCK" | "OUT_OF_STOCK" | "DRAFT" | "INACTIVE";
export type AdminProductPurchaseMode = "STANDARD" | "INQUIRY" | "QUOTE";

export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: AdminCategoryStatus;
  parentId: string | null;
  parentName: string | null;
  parentSlug: string | null;
  displayOrder: number;
  childCount: number;
  productCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminCatalogReference = {
  id: string | null;
  name: string;
  slug: string | null;
};

export type AdminProduct = {
  id: string;
  externalProductId: string | null;
  name: string;
  nameAr: string | null;
  slug: string;
  sku: string;
  brand: AdminCatalogReference | null;
  category: AdminCatalogReference | null;
  price: number | null;
  basePrice: number | null;
  salePrice: number | null;
  effectivePrice: number | null;
  originalPrice: number | null;
  stock: number;
  status: AdminProductStatus;
  imageUrl: string | null;
  description: string | null;
  descriptionAr: string | null;
  shortDescription: string | null;
  shortDescriptionAr: string | null;
  featured: boolean;
  isWeeklyOffer: boolean;
  isBestSeller: boolean;
  isNewArrival: boolean;
  isHotDeal: boolean;
  isFastDelivery: boolean;
  purchaseMode: AdminProductPurchaseMode;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
  /** Read-only variant summary — see server/src/services/variantCatalog.service.js. Absent/false for simple products. */
  sourceSystem?: string | null;
  lastSyncedAt?: string | null;
  hasVariants?: boolean;
  variantCount?: number;
  priceMin?: number | null;
  priceMax?: number | null;
  totalStock?: number | null;
};

export type AdminCategoryInput = {
  name: string;
  slug?: string;
  description?: string;
  status: AdminCategoryStatus;
  /** Parent category id for subcategories; empty string/null clears it. */
  parentId?: string | null;
};

export type AdminProductInput = {
  name: string;
  nameAr?: string;
  sku: string;
  brandId?: string;
  categoryId?: string;
  price: number;
  stock: number;
  status: AdminProductStatus;
  imageUrl?: string;
  description?: string;
  descriptionAr?: string;
  shortDescription?: string;
  shortDescriptionAr?: string;
  featured: boolean;
  isWeeklyOffer?: boolean;
  isBestSeller?: boolean;
  isNewArrival?: boolean;
  isHotDeal?: boolean;
  isFastDelivery?: boolean;
  purchaseMode?: AdminProductPurchaseMode;
};

export async function getAdminCategories(
  options: { search?: string; status?: AdminCategoryStatus; signal?: AbortSignal } = {}
) {
  const params = new URLSearchParams();
  if (options.search?.trim()) params.set("search", options.search.trim());
  if (options.status) params.set("status", options.status);
  const query = params.toString();
  const result = await apiRequest<{ categories: AdminCategory[] }>(
    `/admin/categories${query ? `?${query}` : ""}`,
    { signal: options.signal }
  );
  return result.categories;
}

export async function createAdminCategory(input: AdminCategoryInput) {
  const result = await apiRequest<{ category: AdminCategory }>("/admin/categories", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return result.category;
}

export async function updateAdminCategory(id: string, input: AdminCategoryInput) {
  const result = await apiRequest<{ category: AdminCategory }>(`/admin/categories/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return result.category;
}

export async function deleteAdminCategory(id: string) {
  return apiRequest<{ message: string; category: AdminCategory }>(`/admin/categories/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export type AdminProductTypeFilter = "all" | "simple" | "variant";
export type AdminProductStockFilter = "all" | "lowStock" | "outOfStock";
export type AdminProductSortKey = "name" | "price" | "stock" | "updatedAt";
export type AdminProductSortDirection = "asc" | "desc";

export type AdminProductPage = {
  products: AdminProduct[];
  pagination: { page: number; limit: number; total: number; pages: number };
  sourceSystems: string[];
};

export async function getAdminProducts(
  options: {
    search?: string;
    status?: AdminProductStatus;
    brandId?: string;
    categoryId?: string;
    sourceSystem?: string;
    productType?: AdminProductTypeFilter;
    stockFilter?: AdminProductStockFilter;
    sort?: AdminProductSortKey;
    direction?: AdminProductSortDirection;
    page?: number;
    limit?: number;
    signal?: AbortSignal;
  } = {}
): Promise<AdminProductPage> {
  const params = new URLSearchParams();
  if (options.search?.trim()) params.set("search", options.search.trim());
  if (options.status) params.set("status", options.status);
  if (options.brandId) params.set("brandId", options.brandId);
  if (options.categoryId) params.set("categoryId", options.categoryId);
  if (options.sourceSystem) params.set("sourceSystem", options.sourceSystem);
  if (options.productType) params.set("productType", options.productType);
  if (options.stockFilter) params.set("stockFilter", options.stockFilter);
  if (options.sort) params.set("sort", options.sort);
  if (options.direction) params.set("direction", options.direction);
  params.set("page", String(options.page ?? 1));
  params.set("limit", String(options.limit ?? 50));
  const query = params.toString();
  return apiRequest<AdminProductPage>(`/admin/products${query ? `?${query}` : ""}`, { signal: options.signal });
}

export async function createAdminProduct(input: AdminProductInput) {
  const result = await apiRequest<{ product: AdminProduct }>("/admin/products", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return result.product;
}

export async function updateAdminProduct(id: string, input: AdminProductInput) {
  const result = await apiRequest<{ product: AdminProduct }>(`/admin/products/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return result.product;
}

export async function deleteAdminProduct(id: string) {
  return apiRequest<{ message: string; product: AdminProduct }>(`/admin/products/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function uploadAdminProductImage(file: File) {
  return apiRequest<{ imageUrl: string }>("/admin/product-images", {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
}
