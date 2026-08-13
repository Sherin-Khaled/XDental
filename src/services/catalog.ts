import { ApiError, apiRequest, resolveApiAssetUrl } from "./http";
import type { Product } from "@/types/product";

export const CATALOG_FALLBACK_IMAGE = `${import.meta.env.BASE_URL}toothtools.webp`;

export type PublicProductStatus = "ACTIVE" | "LOW_STOCK" | "OUT_OF_STOCK";

type PublicCatalogReference = { name: string; slug: string };

export type PublicCatalogProduct = {
  id: string;
  sku: string | null;
  slug: string;
  name: string;
  nameAr: string | null;
  brand: PublicCatalogReference | null;
  category: PublicCatalogReference | null;
  price: number;
  basePrice: number;
  salePrice: number | null;
  effectivePrice: number;
  originalPrice: number | null;
  stockQuantity: number | null;
  stock: number | null;
  status: PublicProductStatus;
  imageUrl: string | null;
  images: string[];
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
  purchaseMode: "STANDARD" | "INQUIRY" | "QUOTE";
  available: boolean;
  isAvailable: boolean;
  deliveryLabel?: string | null;
  options: string[];
};

export type CatalogCategory = {
  id: string;
  name: string;
  nameAr: string | null;
  slug: string;
  description: string | null;
  icon?: string | null;
  imageUrl?: string | null;
  parentId?: string | null;
  parentSlug?: string | null;
  displayOrder?: number;
  productCount: number;
};

/** Node of the public category tree (main -> subcategories -> deeper levels). */
export type CatalogCategoryNode = {
  id: string;
  name: string;
  nameAr: string | null;
  slug: string;
  description: string | null;
  icon: string | null;
  imageUrl: string | null;
  displayOrder: number;
  productCount: number;
  children: CatalogCategoryNode[];
};

export type CatalogBrand = {
  id: string;
  name: string;
  slug: string;
  country: string | null;
  logoUrl: string | null;
  description: string | null;
  featured: boolean;
  productCount: number;
};

type ProductPage = {
  products: PublicCatalogProduct[];
  pagination: { page: number; limit: number; total: number; pages: number };
};

export function mapProduct(product: PublicCatalogProduct): Product {
  const available = product.available && product.status !== "OUT_OF_STOCK";
  const productImage = resolveApiAssetUrl(product.imageUrl || product.images[0]);
  const isFastDelivery = product.isFastDelivery;
  return {
    id: product.id,
    sku: product.sku,
    slug: product.slug,
    name: product.name,
    nameAr: product.nameAr,
    brand: product.brand?.name || "X Dental",
    category: product.category?.name || "Dental Supplies",
    image: productImage || CATALOG_FALLBACK_IMAGE,
    currentPrice: Number(product.price),
    oldPrice:
      product.originalPrice && Number(product.originalPrice) > Number(product.price)
        ? Number(product.originalPrice)
        : null,
    discountPercentage: null,
    rating: null,
    reviewCount: null,
    stockStatus: !available ? "Out of Stock" : product.status === "LOW_STOCK" ? "Low Stock" : "In Stock",
    deliveryLabel: product.deliveryLabel ?? (isFastDelivery ? "Fast Delivery" : null),
    options: product.options ?? [],
    isWeeklyOffer: product.isWeeklyOffer,
    isBestSeller: product.isBestSeller,
    isNewArrival: product.isNewArrival,
    isHotDeal: product.isHotDeal,
    isRecommended: product.featured,
    isFastDelivery,
    isNew: product.isNewArrival,
    purchaseMode: product.purchaseMode,
    isFavorite: false,
    description: product.description,
    descriptionAr: product.descriptionAr,
    shortDescription: product.shortDescription,
    shortDescriptionAr: product.shortDescriptionAr,
    stockQuantity: product.stockQuantity,
    status: product.status,
    available,
  };
}

export type ProductSortOrder = "recommended" | "price-low" | "price-high" | "name";

export async function fetchPublicProducts(
  params: {
    search?: string;
    category?: string;
    categories?: string[];
    brand?: string;
    brands?: string[];
    status?: PublicProductStatus;
    availability?: "available" | "out-of-stock" | "low-stock";
    featured?: boolean;
    isWeeklyOffer?: boolean;
    isBestSeller?: boolean;
    isNewArrival?: boolean;
    isHotDeal?: boolean;
    isFastDelivery?: boolean;
    hasDiscount?: boolean;
    priceMin?: number;
    priceMax?: number;
    sort?: ProductSortOrder;
    ids?: string[];
    page?: number;
    limit?: number;
    signal?: AbortSignal;
  } = {}
) {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.categories?.length) query.set("categories", params.categories.join(","));
  if (params.category?.trim()) query.set("category", params.category.trim());
  if (params.brands?.length) query.set("brands", params.brands.join(","));
  if (params.brand?.trim()) query.set("brand", params.brand.trim());
  if (params.status) query.set("status", params.status);
  if (params.availability) query.set("availability", params.availability);
  if (params.featured !== undefined) query.set("featured", String(params.featured));
  for (const field of ["isWeeklyOffer", "isBestSeller", "isNewArrival", "isHotDeal", "isFastDelivery"] as const) {
    if (params[field] !== undefined) query.set(field, String(params[field]));
  }
  if (params.hasDiscount !== undefined) query.set("hasDiscount", String(params.hasDiscount));
  if (params.priceMin !== undefined) query.set("priceMin", String(params.priceMin));
  if (params.priceMax !== undefined) query.set("priceMax", String(params.priceMax));
  if (params.sort) query.set("sort", params.sort);
  if (params.ids?.length) query.set("ids", params.ids.join(","));
  query.set("page", String(params.page ?? 1));
  query.set("limit", String(params.limit ?? 24));
  const result = await apiRequest<ProductPage>(`/products?${query.toString()}`, { signal: params.signal });
  return { products: result.products.map(mapProduct), pagination: result.pagination };
}

/** Small, bounded lookup for a known set of product ids (cart/wishlist/supply-list hydration) — never a full-catalogue fetch. */
export async function fetchPublicProductsByIds(ids: string[], signal?: AbortSignal) {
  if (ids.length === 0) return [];
  const { products } = await fetchPublicProducts({ ids, limit: Math.min(ids.length, 100), signal });
  return products;
}

export async function fetchPublicProduct(identifier: string, signal?: AbortSignal) {
  try {
    const result = await apiRequest<{ product: PublicCatalogProduct }>(
      `/products/${encodeURIComponent(identifier)}`,
      { signal }
    );
    return mapProduct(result.product);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function fetchPublicCategories(signal?: AbortSignal) {
  const result = await apiRequest<{ categories: CatalogCategory[] }>("/categories", { signal });
  return result.categories;
}

export async function fetchPublicCategoryTree(signal?: AbortSignal) {
  const result = await apiRequest<{ categories: CatalogCategoryNode[] }>("/categories/tree", { signal });
  return result.categories;
}

export async function fetchPublicBrands(signal?: AbortSignal) {
  const result = await apiRequest<{ brands: CatalogBrand[] }>("/brands", { signal });
  return result.brands;
}
