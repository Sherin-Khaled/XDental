import { apiRequest } from "./http";
import { mapProduct, type PublicCatalogProduct } from "./catalog";
import type { Product } from "@/types/product";

type PublicFlashSaleResponse = {
  id: string;
  salePrice: number;
  startsAt: string;
  endsAt: string;
  product: PublicCatalogProduct;
};

export type ActiveFlashSale = {
  id: string;
  salePrice: number;
  startsAt: string;
  endsAt: string;
  product: Product;
};

/**
 * Fetches up to two currently valid Home flash sales. The backend is
 * the source of truth for validity (active flag, date range, product still
 * available, sale price still genuinely lower than the product price) — this
 * client only maps the shape, it never invents or extends an offer. The
 * singular fallback supports a staggered frontend/backend deployment.
 */
export async function fetchActiveFlashSales(signal?: AbortSignal) {
  const result = await apiRequest<{
    flashSales?: PublicFlashSaleResponse[];
    flashSale?: PublicFlashSaleResponse | null;
  }>("/flash-sale", { signal });
  const flashSales = result.flashSales
    ?? (result.flashSale ? [result.flashSale] : []);

  return flashSales.slice(0, 2).map((flashSale) => ({
    id: flashSale.id,
    salePrice: flashSale.salePrice,
    startsAt: flashSale.startsAt,
    endsAt: flashSale.endsAt,
    product: mapProduct(flashSale.product),
  } satisfies ActiveFlashSale));
}
