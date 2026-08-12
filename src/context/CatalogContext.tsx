import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  fetchPublicBrands,
  fetchPublicCategories,
  fetchPublicCategoryTree,
  type CatalogBrand,
  type CatalogCategory,
  type CatalogCategoryNode,
} from "@/services/catalog";

// Deliberately metadata-only: categories and brands are small, fixed-size
// lists that every storefront page needs (nav, filters, search). Product
// *records* are not loaded here — the catalogue is thousands of rows, and a
// page that needs products fetches only the page/search/ids it actually
// needs via services/catalog.ts (fetchPublicProducts / fetchPublicProduct /
// fetchPublicProductsByIds). See CatalogContext's git history if you're
// looking for the old eager full-catalogue preload; it was removed because
// it downloaded the entire catalogue on every app load.
type CatalogContextValue = {
  categories: CatalogCategory[];
  categoryTree: CatalogCategoryNode[];
  brands: CatalogBrand[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const CatalogContext = createContext<CatalogContextValue | undefined>(undefined);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [categoryTree, setCategoryTree] = useState<CatalogCategoryNode[]>([]);
  const [brands, setBrands] = useState<CatalogBrand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCatalog = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const [nextCategories, nextTree, nextBrands] = await Promise.all([
        fetchPublicCategories(signal),
        fetchPublicCategoryTree(signal),
        fetchPublicBrands(signal),
      ]);
      setCategories(nextCategories);
      setCategoryTree(nextTree);
      setBrands(nextBrands);
    } catch (loadError) {
      if (!signal?.aborted) {
        setError(loadError instanceof Error ? loadError.message : "The product catalog could not be loaded.");
      }
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadCatalog(controller.signal);
    return () => controller.abort();
  }, [loadCatalog]);

  const value = useMemo<CatalogContextValue>(() => ({
    categories,
    categoryTree,
    brands,
    isLoading,
    error,
    refresh: () => loadCatalog(),
  }), [brands, categories, categoryTree, error, isLoading, loadCatalog]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (!context) throw new Error("useCatalog must be used within CatalogProvider.");
  return context;
}
