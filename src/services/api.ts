/**
 * API service layer — X Dental Store
 *
 * Currently uses mock data. Replace the mock imports below with real HTTP
 * calls when a backend is ready. Each function maps 1-to-1 with a backend
 * endpoint so the swap is a one-file change.
 *
 * Suggested base URL pattern:
 *   const BASE = import.meta.env.VITE_API_URL ?? "/api";
 *   const res  = await fetch(`${BASE}/products`);
 */

import type { Product } from "@/types/product";
import { mockProducts } from "@/data/products";

// ─── Products ─────────────────────────────────────────────────────────────────

export async function fetchProducts(params?: {
  category?: string;
  brand?: string;
  search?: string;
  isWeeklyOffer?: boolean;
  isBestSeller?: boolean;
  isRecommended?: boolean;
  isFastDelivery?: boolean;
}): Promise<Product[]> {
  // TODO: replace with fetch(`${BASE}/products?${new URLSearchParams(params)}`)
  let result = [...mockProducts];
  if (params?.category) result = result.filter(p => p.category === params.category);
  if (params?.brand)    result = result.filter(p => p.brand === params.brand);
  if (params?.search)   result = result.filter(p => p.name.toLowerCase().includes(params.search!.toLowerCase()));
  if (params?.isWeeklyOffer)  result = result.filter(p => p.isWeeklyOffer);
  if (params?.isBestSeller)   result = result.filter(p => p.isBestSeller);
  if (params?.isRecommended)  result = result.filter(p => p.isRecommended);
  if (params?.isFastDelivery) result = result.filter(p => p.isFastDelivery);
  return result;
}

export async function fetchProductById(id: string): Promise<Product | undefined> {
  // TODO: replace with fetch(`${BASE}/products/${id}`)
  return mockProducts.find(p => p.id === id);
}

// ─── Catalog sections ─────────────────────────────────────────────────────────

export async function fetchFeaturedCatalog() {
  // TODO: replace with fetch(`${BASE}/catalog/featured`)
  return {
    weeklyOffers:  mockProducts.filter(p => p.isWeeklyOffer),
    bestSellers:   mockProducts.filter(p => p.isBestSeller),
    recommended:   mockProducts.filter(p => p.isRecommended),
    fastDelivery:  mockProducts.filter(p => p.isFastDelivery),
    newArrivals:   mockProducts.filter(p => p.isNew),
  };
}
