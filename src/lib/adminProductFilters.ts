/** Pure client-side search/filter/sort/pagination logic for the Admin Products list. */

export type AdminProductListItem = {
  id: string;
  name: string;
  sku: string;
  externalProductId: string | null;
  status: "ACTIVE" | "LOW_STOCK" | "OUT_OF_STOCK" | "DRAFT" | "INACTIVE";
  isAvailable: boolean;
  price: number | null;
  effectivePrice?: number | null;
  stock: number;
  brand: { id: string | null; name: string } | null;
  category: { id: string | null; name: string } | null;
  sourceSystem?: string | null;
  hasVariants?: boolean;
  priceMin?: number | null;
  priceMax?: number | null;
  totalStock?: number | null;
  updatedAt: string;
};

export type AdminProductTypeFilter = "all" | "simple" | "variant";
export type AdminProductStockFilter = "all" | "lowStock" | "outOfStock";
export type AdminProductSortKey = "name" | "price" | "stock" | "updatedAt";
export type SortDirection = "asc" | "desc";

export type AdminProductFilters = {
  productType: AdminProductTypeFilter;
  stockFilter: AdminProductStockFilter;
  sourceSystem: string;
};

/** True stock/price reads: variant products use the sellable-variant summary, simple products use their own fields. */
export function effectivePrice(product: AdminProductListItem): { min: number | null; max: number | null } {
  if (product.hasVariants) return { min: product.priceMin ?? null, max: product.priceMax ?? null };
  const price = product.effectivePrice ?? product.price;
  return { min: price, max: price };
}

export function effectiveStock(product: AdminProductListItem): number {
  return product.hasVariants ? product.totalStock ?? 0 : product.stock;
}

export function isLowStock(product: AdminProductListItem): boolean {
  return product.status === "LOW_STOCK";
}

export function isOutOfStock(product: AdminProductListItem): boolean {
  return product.status === "OUT_OF_STOCK" || effectiveStock(product) === 0;
}

export function applyAdminProductFilters<T extends AdminProductListItem>(
  products: T[],
  filters: AdminProductFilters
): T[] {
  return products.filter((product) => {
    if (filters.productType === "simple" && product.hasVariants) return false;
    if (filters.productType === "variant" && !product.hasVariants) return false;
    if (filters.stockFilter === "lowStock" && !isLowStock(product)) return false;
    if (filters.stockFilter === "outOfStock" && !isOutOfStock(product)) return false;
    if (filters.sourceSystem && filters.sourceSystem !== "all" && (product.sourceSystem ?? "") !== filters.sourceSystem) {
      return false;
    }
    return true;
  });
}

export function sortAdminProducts<T extends AdminProductListItem>(
  products: T[],
  key: AdminProductSortKey,
  direction: SortDirection
): T[] {
  const sorted = [...products].sort((a, b) => {
    switch (key) {
      case "name":
        return a.name.localeCompare(b.name);
      case "price": {
        const priceA = effectivePrice(a).min ?? -1;
        const priceB = effectivePrice(b).min ?? -1;
        return priceA - priceB;
      }
      case "stock":
        return effectiveStock(a) - effectiveStock(b);
      case "updatedAt":
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      default:
        return 0;
    }
  });
  return direction === "desc" ? sorted.reverse() : sorted;
}

export function paginateItems<T>(items: T[], page: number, pageSize: number): { pageItems: T[]; pageCount: number; page: number } {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * pageSize;
  return { pageItems: items.slice(start, start + pageSize), pageCount, page: safePage };
}

export function collectSourceSystems(products: AdminProductListItem[]): string[] {
  return [...new Set(products.map((product) => product.sourceSystem).filter((value): value is string => Boolean(value)))].sort();
}
