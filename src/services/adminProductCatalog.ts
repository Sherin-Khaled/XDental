import { apiRequest } from "./http";

/** Typed wrappers around the Phase 7A admin variant/option/image endpoints (server/src/controllers/adminVariantCatalog.controller.js). */

export type AdminVariantStatus = "ACTIVE" | "LOW_STOCK" | "OUT_OF_STOCK" | "DRAFT" | "INACTIVE";

export type AdminProductOptionValue = {
  id: string;
  optionId: string;
  code: string;
  valueEn: string;
  valueAr: string | null;
  displayHex: string | null;
  sortOrder: number;
};

export type AdminProductOption = {
  id: string;
  productId: string;
  code: string;
  nameEn: string;
  nameAr: string | null;
  sortOrder: number;
  values: AdminProductOptionValue[];
};

export type AdminVariantSelection = {
  optionId: string;
  optionValueId: string;
  option: { id: string; code: string; nameEn: string; nameAr: string | null };
  optionValue: { id: string; code: string; valueEn: string; valueAr: string | null; displayHex: string | null };
};

export type AdminProductVariant = {
  id: string;
  productId: string;
  externalVariantId: string | null;
  sourceSystem: string | null;
  sku: string | null;
  barcode: string | null;
  nameEn: string | null;
  nameAr: string | null;
  priceOverride: number | null;
  stockQuantity: number;
  lowStockThreshold: number;
  status: AdminVariantStatus;
  isAvailable: boolean;
  sortOrder: number;
  lastSyncedAt: string | null;
  selections: AdminVariantSelection[];
};

export type AdminProductImage = {
  id: string;
  productId: string;
  variantId: string | null;
  url: string;
  altEn: string | null;
  altAr: string | null;
  sortOrder: number;
  isPrimary: boolean;
  sourceSystem: string | null;
  sourceUrl: string | null;
  rightsConfirmed: boolean;
  rightsNote: string | null;
};

export type AdminProductCatalog = {
  id: string;
  externalProductId: string | null;
  name: string;
  nameAr: string | null;
  slug: string;
  brand: string | null;
  brandId: string | null;
  sku: string | null;
  category: string | null;
  categoryId: string | null;
  description: string | null;
  descriptionAr: string | null;
  shortDescription: string | null;
  shortDescriptionAr: string | null;
  price: number | null;
  stockQuantity: number | null;
  status: AdminVariantStatus;
  featured: boolean;
  isAvailable: boolean;
  imageUrl: string | null;
  sourceSystem: string | null;
  lastSyncedAt: string | null;
  options: AdminProductOption[];
  variants: AdminProductVariant[];
  images: AdminProductImage[];
};

export async function getAdminProductCatalog(productId: string, signal?: AbortSignal) {
  const result = await apiRequest<{ product: AdminProductCatalog }>(
    `/admin/products/${encodeURIComponent(productId)}/variant-catalog`,
    { signal }
  );
  return result.product;
}

export type AdminProductOptionInput = {
  code: string;
  nameEn: string;
  nameAr?: string;
  sortOrder?: number;
};

export async function createAdminProductOption(productId: string, input: AdminProductOptionInput) {
  const result = await apiRequest<{ option: AdminProductOption }>(
    `/admin/products/${encodeURIComponent(productId)}/options`,
    { method: "POST", body: JSON.stringify(input) }
  );
  return result.option;
}

export type AdminProductOptionValueInput = {
  code: string;
  valueEn: string;
  valueAr?: string;
  displayHex?: string;
  sortOrder?: number;
};

export async function createAdminProductOptionValue(optionId: string, input: AdminProductOptionValueInput) {
  const result = await apiRequest<{ value: AdminProductOptionValue }>(
    `/admin/product-options/${encodeURIComponent(optionId)}/values`,
    { method: "POST", body: JSON.stringify(input) }
  );
  return result.value;
}

export async function deleteAdminProductOptionValue(valueId: string, force = false) {
  return apiRequest<{ message: string; deactivatedVariantCount: number }>(
    `/admin/product-option-values/${encodeURIComponent(valueId)}`,
    { method: "DELETE", body: JSON.stringify({ force }) }
  );
}

export type AdminProductVariantInput = {
  sku?: string;
  barcode?: string;
  status?: AdminVariantStatus;
  stockQuantity: number;
  lowStockThreshold?: number;
  priceOverride?: number | null;
  nameEn?: string;
  nameAr?: string;
  externalVariantId?: string;
  sourceSystem?: string;
  isAvailable?: boolean;
  sortOrder?: number;
};

export async function createAdminProductVariant(productId: string, input: AdminProductVariantInput) {
  const result = await apiRequest<{ variant: AdminProductVariant }>(
    `/admin/products/${encodeURIComponent(productId)}/variants`,
    { method: "POST", body: JSON.stringify(input) }
  );
  return result.variant;
}

export async function updateAdminProductVariant(variantId: string, input: Partial<AdminProductVariantInput>) {
  const result = await apiRequest<{ variant: AdminProductVariant }>(
    `/admin/product-variants/${encodeURIComponent(variantId)}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
  return result.variant;
}

export async function replaceAdminVariantOptionValues(variantId: string, optionValueIds: string[]) {
  return apiRequest<{ message: string }>(
    `/admin/product-variants/${encodeURIComponent(variantId)}/option-values`,
    { method: "PUT", body: JSON.stringify({ optionValueIds }) }
  );
}

export type AdminProductGalleryImageInput = {
  url: string;
  variantId?: string | null;
  altEn?: string;
  altAr?: string;
  sortOrder?: number;
  isPrimary?: boolean;
  sourceSystem?: string;
  sourceUrl?: string;
  rightsConfirmed?: boolean;
  rightsNote?: string;
};

export async function createAdminProductGalleryImage(productId: string, input: AdminProductGalleryImageInput) {
  const result = await apiRequest<{ image: AdminProductImage }>(
    `/admin/products/${encodeURIComponent(productId)}/gallery-images`,
    { method: "POST", body: JSON.stringify(input) }
  );
  return result.image;
}

export async function updateAdminProductGalleryImage(
  imageId: string,
  input: Partial<Omit<AdminProductGalleryImageInput, "variantId">>
) {
  const result = await apiRequest<{ image: AdminProductImage }>(
    `/admin/product-images/${encodeURIComponent(imageId)}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
  return result.image;
}

export async function reorderAdminProductGalleryImages(productId: string, imageIds: string[]) {
  const result = await apiRequest<{ images: AdminProductImage[] }>(
    `/admin/products/${encodeURIComponent(productId)}/gallery-images/reorder`,
    { method: "PUT", body: JSON.stringify({ imageIds }) }
  );
  return result.images;
}

export async function deleteAdminProductGalleryImage(imageId: string) {
  return apiRequest<{ message: string }>(`/admin/product-images/${encodeURIComponent(imageId)}`, {
    method: "DELETE",
  });
}
