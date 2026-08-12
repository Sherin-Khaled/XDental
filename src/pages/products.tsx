import { useDeferredValue, useEffect, useId, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Container } from "@/components/dental/Container";
import { Button } from "@/components/dental/Button";
import { DentalSelect } from "@/components/dental/Select";
import { ProductCard } from "@/components/dental/ProductCard";
import { SectionReveal } from "@/components/dental/SectionReveal";
import { Checkbox } from "@/components/ui/checkbox";
import { useCatalog } from "@/context/CatalogContext";
import { useStore } from "@/context/StoreContext";
import { fetchPublicProducts, type CatalogBrand, type ProductSortOrder } from "@/services/catalog";
import { SEO } from "@/components/SEO";
import { useLanguage } from "@/context/LanguageContext";
import { getCategorySlugFromSearch, getLocalizedCategoryName, getSubcategorySlugFromSearch } from "@/lib/catalogTranslations";
import type { CatalogCategoryNode } from "@/services/catalog";
import type { Product } from "@/types/product";
import { cn } from "@/lib/utils";
import {
  DEFAULT_CLINIC_SPECIALTY,
  getClinicEssentialsCategoryNames,
  normalizeClinicSpecialty,
} from "@/lib/clinicSpecialties";
import {
  ChevronDown,
  Filter,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

const collectionChips = [
  { value: "All Products", labelKey: "products.collections.all" },
  { value: "Weekly Offers", labelKey: "products.collections.weekly" },
  { value: "Hot Deals", labelKey: "products.collections.hot" },
  { value: "Fast Delivery", labelKey: "products.collections.fast" },
  { value: "New Arrivals", labelKey: "products.collections.new" },
  { value: "Best Selling", labelKey: "products.collections.best" },
  { value: "Limited Stock", labelKey: "products.collections.limited" },
  { value: "Clinic Essentials", labelKey: "products.collections.clinic" },
];

const collectionQueryValues: Record<string, string> = {
  "all-products": "All Products",
  all: "All Products",
  "weekly-offers": "Weekly Offers",
  weekly: "Weekly Offers",
  "hot-deals": "Hot Deals",
  hot: "Hot Deals",
  "fast-delivery": "Fast Delivery",
  fast: "Fast Delivery",
  "new-arrivals": "New Arrivals",
  new: "New Arrivals",
  "best-selling": "Best Selling",
  "best-sellers": "Best Selling",
  best: "Best Selling",
  "limited-stock": "Limited Stock",
  limited: "Limited Stock",
  "clinic-essentials": "Clinic Essentials",
  clinic: "Clinic Essentials",
};

function normalizeCollectionQuery(value: string | null) {
  return value?.trim().toLowerCase().replace(/[\s_]+/g, "-") ?? "";
}

function normalizeBrandQuery(value: string | null) {
  return value?.trim().toLowerCase().replace(/[\s_]+/g, "-") ?? "";
}

function getCollectionFromSearchParams(searchParams: URLSearchParams) {
  if (searchParams.get("isWeeklyOffer") === "true") return "Weekly Offers";
  if (searchParams.get("isBestSeller") === "true") return "Best Selling";
  if (searchParams.get("isNewArrival") === "true") return "New Arrivals";
  if (searchParams.get("isFastDelivery") === "true") return "Fast Delivery";

  return collectionQueryValues[normalizeCollectionQuery(searchParams.get("collection"))] ?? "All Products";
}

const availabilityOptions = [
  { value: "In Stock", labelKey: "common.inStock" },
  { value: "Fast Delivery", labelKey: "common.fastDelivery" },
  { value: "Limited Stock", labelKey: "common.limitedStock" },
  { value: "Out of Stock", labelKey: "common.outOfStock" },
];

const offerFilters = [
  { value: "Weekly Offers", labelKey: "common.weeklyOffers" },
  { value: "Hot Deals", labelKey: "common.hotDeals" },
  { value: "Discounted", labelKey: "common.discounted" },
  { value: "New Arrivals", labelKey: "common.newArrivals" },
  { value: "Best Selling", labelKey: "common.bestSellers" },
];

type SortOrder = ProductSortOrder;
const EAGER_PRODUCT_IMAGE_COUNT = 6;
const PRODUCTS_PAGE_SIZE = 24;
const SEARCH_DEBOUNCE_MS = 300;

type CategoryIndexEntry = {
  node: CatalogCategoryNode;
  parent: CatalogCategoryNode | null;
  root: CatalogCategoryNode;
};

/** Indexes every tree node by slug with its parent and root main category. */
function indexCategoryTree(tree: CatalogCategoryNode[]) {
  const bySlug = new Map<string, CategoryIndexEntry>();
  const visit = (node: CatalogCategoryNode, parent: CatalogCategoryNode | null, root: CatalogCategoryNode) => {
    bySlug.set(node.slug, { node, parent, root });
    node.children.forEach((child) => visit(child, node, root));
  };
  tree.forEach((root) => visit(root, null, root));
  return bySlug;
}

function collectSubtreeSlugs(node: CatalogCategoryNode, into = new Set<string>()) {
  into.add(node.slug);
  node.children.forEach((child) => collectSubtreeSlugs(child, into));
  return into;
}

function getCategorySlugsFromSearch(searchParams: URLSearchParams) {
  return [...new Set(
    searchParams
      .getAll("categories")
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter(Boolean)
  )];
}

function getBrandSlugsFromSearch(searchParams: URLSearchParams) {
  return [...new Set(
    searchParams
      .getAll("brands")
      .flatMap((value) => value.split(","))
      .map((value) => normalizeBrandQuery(value))
      .filter(Boolean)
  )];
}

function normalizeBrandSearch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLocaleLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "");
}

type SelectedCategoryChip = {
  node: CatalogCategoryNode;
  removesSubtree: boolean;
};

function collectSelectedCategoryChips(
  tree: CatalogCategoryNode[],
  selected: ReadonlySet<string>
) {
  const chips: SelectedCategoryChip[] = [];
  const visit = (node: CatalogCategoryNode) => {
    const subtree = [...collectSubtreeSlugs(node)];
    if (subtree.every((slug) => selected.has(slug))) {
      chips.push({ node, removesSubtree: true });
      return;
    }
    if (selected.has(node.slug)) chips.push({ node, removesSubtree: false });
    node.children.forEach(visit);
  };
  tree.forEach(visit);
  return chips;
}

export default function Products() {
  const { isRtl, language, t } = useLanguage();
  const { categoryTree, brands: catalogBrands, isLoading: isCatalogLoading } = useCatalog();
  const { currentUser, isAuthenticated } = useStore();
  const [, navigate] = useLocation();
  const search = useSearch();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const activeCategorySlug = useMemo(() => getCategorySlugFromSearch(search), [search]);
  const activeSubcategorySlug = useMemo(() => getSubcategorySlugFromSearch(search), [search]);
  const activeCollectionFromSearch = useMemo(
    () => getCollectionFromSearchParams(searchParams),
    [searchParams]
  );
  const [activeCollection, setActiveCollection] = useState(activeCollectionFromSearch);
  const [showFilters, setShowFilters] = useState(true);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAvailability, setSelectedAvailability] = useState<string[]>([]);
  const [selectedOffers, setSelectedOffers] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });
  const [sortOrder, setSortOrder] = useState<SortOrder>("recommended");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<{ page: number; limit: number; total: number; pages: number } | null>(null);
  const [page, setPage] = useState(1);
  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    setActiveCollection(activeCollectionFromSearch);
  }, [activeCollectionFromSearch]);

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchQuery(searchQuery.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const treeIndex = useMemo(() => indexCategoryTree(categoryTree), [categoryTree]);

  const selectedBrandSlugs = useMemo(() => {
    const brandBySlug = new Map(catalogBrands.map((brand) => [brand.slug, brand]));
    const explicitSlugs = getBrandSlugsFromSearch(searchParams);
    if (explicitSlugs.length > 0) {
      return explicitSlugs.filter((slug) => brandBySlug.has(slug));
    }

    const legacyBrand = normalizeBrandQuery(searchParams.get("brand"));
    if (!legacyBrand) return [];
    const match = catalogBrands.find(
      (brand) =>
        brand.slug === legacyBrand ||
        normalizeBrandQuery(brand.name) === legacyBrand
    );
    return match ? [match.slug] : [];
  }, [catalogBrands, searchParams]);

  const selectedCategorySlugs = useMemo(() => {
    const explicitSlugs = getCategorySlugsFromSearch(searchParams);
    if (explicitSlugs.length > 0) {
      return explicitSlugs.filter((slug) => treeIndex.has(slug));
    }

    // Existing CategoryBar/footer links remain compatible. A legacy category
    // path represents the full active subtree in the new checkbox model.
    const legacySlug =
      activeSubcategorySlug ||
      (activeCategorySlug !== "all" ? activeCategorySlug : "");
    const legacyNode = legacySlug ? treeIndex.get(legacySlug)?.node : undefined;
    return legacyNode ? [...collectSubtreeSlugs(legacyNode)] : [];
  }, [activeCategorySlug, activeSubcategorySlug, searchParams, treeIndex]);

  const selectedCategorySet = useMemo(
    () => new Set(selectedCategorySlugs),
    [selectedCategorySlugs]
  );

  const selectedCategoryChips = useMemo(
    () => collectSelectedCategoryChips(categoryTree, selectedCategorySet),
    [categoryTree, selectedCategorySet]
  );

  const allowedCategoryNames = useMemo(() => {
    if (selectedCategorySlugs.length === 0) return null;
    return new Set(
      selectedCategorySlugs
        .map((slug) => treeIndex.get(slug)?.node.name.toLowerCase())
        .filter((name): name is string => Boolean(name))
    );
  }, [selectedCategorySlugs, treeIndex]);

  const hasClinicSpecialty = Boolean(currentUser?.clinicSpecialty?.trim());
  const activeClinicSpecialty = isAuthenticated && hasClinicSpecialty
    ? normalizeClinicSpecialty(currentUser?.clinicSpecialty)
    : DEFAULT_CLINIC_SPECIALTY;

  // Clinic Essentials remains a personalized collection outside the taxonomy.
  // Guests receive the curated General Dentistry category set.
  const clinicEssentialsNames = useMemo(() => {
    return getClinicEssentialsCategoryNames(categoryTree, activeClinicSpecialty);
  }, [activeClinicSpecialty, categoryTree]);

  const updateSelectedCategories = (next: ReadonlySet<string>) => {
    const params = new URLSearchParams(search);
    params.delete("category");
    params.delete("subcategory");
    const slugs = [...next].filter((slug) => treeIndex.has(slug)).sort();
    if (slugs.length > 0) params.set("categories", slugs.join(","));
    else params.delete("categories");
    const query = params.toString();
    navigate(query ? `/products?${query}` : "/products");
  };

  const toggleCategoryNode = (node: CatalogCategoryNode, checked: boolean) => {
    const next = new Set(selectedCategorySet);
    for (const slug of collectSubtreeSlugs(node)) {
      if (checked) next.add(slug);
      else next.delete(slug);
    }
    updateSelectedCategories(next);
  };

  const removeCategoryChip = (chip: SelectedCategoryChip) => {
    const next = new Set(selectedCategorySet);
    const slugs = chip.removesSubtree
      ? collectSubtreeSlugs(chip.node)
      : new Set([chip.node.slug]);
    slugs.forEach((slug) => next.delete(slug));
    updateSelectedCategories(next);
  };

  // Maps every UI filter (collection chip, taxonomy checkboxes, availability
  // checkboxes, offer checkboxes, price range, search, sort) to the public
  // products API's server-side query params. Category/brand sets here come
  // from small, already-loaded metadata (categoryTree/catalogBrands), never
  // from product records, so intersecting them client-side stays cheap.
  //
  // A few UI options can never match any real product today (isNew and the
  // fast-delivery flag are always false — see mapProduct in services/catalog.ts)
  // or represent an internally-contradictory combination (e.g. selecting both
  // "Limited Stock" the collection and "Out of Stock" the availability
  // checkbox). Those resolve to `alwaysEmpty` instead of a request.
  const queryParams = useMemo(() => {
    const collectionAlwaysEmpty = activeCollection === "Fast Delivery" || activeCollection === "New Arrivals";

    const collectionCategoryNames = activeCollection === "Clinic Essentials" ? clinicEssentialsNames : null;
    let categoryNames: string[] | undefined;
    if (allowedCategoryNames && collectionCategoryNames) {
      categoryNames = [...allowedCategoryNames].filter((name) => collectionCategoryNames.has(name)).sort();
    } else if (allowedCategoryNames) {
      categoryNames = [...allowedCategoryNames].sort();
    } else if (collectionCategoryNames) {
      categoryNames = [...collectionCategoryNames].sort();
    }
    const categoryContradiction = Boolean(
      (allowedCategoryNames || collectionCategoryNames) && categoryNames && categoryNames.length === 0
    );

    const offersWantFeatured = selectedOffers.includes("Weekly Offers") || selectedOffers.includes("Best Selling");
    const offersWantDiscount = selectedOffers.includes("Hot Deals") || selectedOffers.includes("Discounted");
    const offersContribute = offersWantFeatured || offersWantDiscount;
    const offersAlwaysEmpty = selectedOffers.length > 0 && !offersContribute;
    const wantsFeatured = activeCollection === "Weekly Offers" || activeCollection === "Best Selling" || offersWantFeatured;
    const wantsDiscount = activeCollection === "Hot Deals" || offersWantDiscount;

    const stockOptions = selectedAvailability.filter((option) => option !== "Fast Delivery");
    const availabilityAlwaysEmpty = selectedAvailability.length > 0 && stockOptions.length === 0;
    let availabilityParam: "available" | "out-of-stock" | "low-stock" | undefined;
    if (activeCollection === "Limited Stock") availabilityParam = "low-stock";
    if (stockOptions.length === 1) {
      const mapped = stockOptions[0] === "In Stock" ? "available" : stockOptions[0] === "Out of Stock" ? "out-of-stock" : "low-stock";
      availabilityParam = availabilityParam && availabilityParam !== mapped ? availabilityParam : mapped;
    } else if (stockOptions.length > 1 && !stockOptions.includes("Out of Stock")) {
      // "available" already covers ACTIVE + LOW_STOCK server-side, matching
      // the original OR semantics for "In Stock" + "Limited Stock" together.
      availabilityParam = availabilityParam ?? "available";
    }
    const availabilityContradiction =
      activeCollection === "Limited Stock" && stockOptions.length === 1 && stockOptions[0] === "Out of Stock";

    if (
      collectionAlwaysEmpty ||
      categoryContradiction ||
      offersAlwaysEmpty ||
      availabilityAlwaysEmpty ||
      availabilityContradiction
    ) {
      return { alwaysEmpty: true as const };
    }

    return {
      alwaysEmpty: false as const,
      search: debouncedSearchQuery || undefined,
      categories: categoryNames,
      brands: selectedBrandSlugs.length > 0 ? [...selectedBrandSlugs].sort() : undefined,
      featured: wantsFeatured || undefined,
      hasDiscount: wantsDiscount || undefined,
      availability: availabilityParam,
      priceMin: priceRange.min.trim() ? Number(priceRange.min) : undefined,
      priceMax: priceRange.max.trim() ? Number(priceRange.max) : undefined,
      sort: sortOrder,
    };
  }, [
    activeCollection,
    allowedCategoryNames,
    clinicEssentialsNames,
    debouncedSearchQuery,
    priceRange,
    selectedAvailability,
    selectedBrandSlugs,
    selectedOffers,
    sortOrder,
  ]);
  const queryParamsKey = JSON.stringify(queryParams);

  useEffect(() => {
    setPage(1);
    if (queryParams.alwaysEmpty) {
      setProducts([]);
      setPagination({ page: 1, limit: PRODUCTS_PAGE_SIZE, total: 0, pages: 0 });
      setProductsError(null);
      setIsProductsLoading(false);
      return;
    }
    const { alwaysEmpty: _alwaysEmpty, ...fetchParams } = queryParams;
    const controller = new AbortController();
    setIsProductsLoading(true);
    setProductsError(null);
    fetchPublicProducts({ ...fetchParams, page: 1, limit: PRODUCTS_PAGE_SIZE, signal: controller.signal })
      .then(({ products: results, pagination: nextPagination }) => {
        if (controller.signal.aborted) return;
        setProducts(results);
        setPagination(nextPagination);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setProductsError(
            error instanceof Error ? error.message : t("products.catalogUnavailable", { fallback: "The product catalog is temporarily unavailable." })
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsProductsLoading(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryParamsKey, retryNonce]);

  const handleLoadMore = () => {
    if (!pagination || page >= pagination.pages || isLoadingMore || queryParams.alwaysEmpty) return;
    const { alwaysEmpty: _alwaysEmpty, ...fetchParams } = queryParams;
    const nextPage = page + 1;
    setIsLoadingMore(true);
    fetchPublicProducts({ ...fetchParams, page: nextPage, limit: PRODUCTS_PAGE_SIZE })
      .then(({ products: results, pagination: nextPagination }) => {
        setProducts((current) => [...current, ...results]);
        setPagination(nextPagination);
        setPage(nextPage);
      })
      .catch(() => {})
      .finally(() => setIsLoadingMore(false));
  };

  const pageTitle =
    selectedCategoryChips.length === 1
      ? getLocalizedCategoryName(selectedCategoryChips[0].node, language, t)
      : activeCollection === "Weekly Offers"
        ? t("products.titleWeekly")
        : t("products.titleAll");

  const selectedFilterCount =
    selectedCategoryChips.length +
    selectedBrandSlugs.length +
    selectedAvailability.length +
    selectedOffers.length +
    (priceRange.min || priceRange.max ? 1 : 0);

  const updateSelectedBrands = (next: ReadonlySet<string>) => {
    const validSlugs = new Set(catalogBrands.map((brand) => brand.slug));
    const slugs = [...next].filter((slug) => validSlugs.has(slug)).sort();
    const params = new URLSearchParams(search);
    params.delete("brand");
    if (slugs.length > 0) params.set("brands", slugs.join(","));
    else params.delete("brands");
    const query = params.toString();
    navigate(query ? `/products?${query}` : "/products");
  };

  const toggleBrand = (brand: CatalogBrand) => {
    const next = new Set(selectedBrandSlugs);
    if (next.has(brand.slug)) next.delete(brand.slug);
    else next.add(brand.slug);
    updateSelectedBrands(next);
  };

  const clearBrands = () => updateSelectedBrands(new Set());

  const toggleAvailability = (option: string) => {
    setSelectedAvailability((prev) =>
      prev.includes(option)
        ? prev.filter((item) => item !== option)
        : [...prev, option]
    );
  };

  const toggleOffer = (offer: string) => {
    setSelectedOffers((prev) =>
      prev.includes(offer) ? prev.filter((item) => item !== offer) : [...prev, offer]
    );
  };

  const clearFilters = () => {
    navigate("/products");
    setActiveCollection("All Products");
    setSearchQuery("");
    setSelectedAvailability([]);
    setSelectedOffers([]);
    setPriceRange({ min: "", max: "" });
  };

  useEffect(() => {
    if (!isMobileFilterOpen) return;

    const originalOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileFilterOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileFilterOpen]);

  return (
    <div className="bg-[var(--xd-bg)] pb-16 lg:pb-20">
      <SEO page="products" />
      <Container className="pt-12">
        {/* Page Title */}
        <SectionReveal className="mb-10">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--xd-gold-text)]">
            {t("products.catalogEyebrow")}
          </p>

          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <h1 className="font-display text-[36px] font-semibold leading-[1.12] text-[#050505] sm:text-[42px] md:text-[48px]">
                {pageTitle}
              </h1>
              <p className="mt-3 max-w-[680px] text-[16px] leading-[26px] text-[#717182]">
                {t("products.intro")}
              </p>
            </div>

            <p className="text-sm text-[#717182]">
              {t("products.showingResults", { values: { count: pagination?.total ?? products.length } })}
            </p>
          </div>
        </SectionReveal>

        {/* Control Bar */}
        <SectionReveal delay={0.06} className="mb-10 flex flex-wrap items-center gap-3 overflow-visible rounded-[24px] backdrop-blur-xl">
          <Button
            type="button"
            onClick={() => setShowFilters((prev) => !prev)}
            variant="secondary"
            size="sm"
            className={`hidden h-12 shrink-0 gap-2 rounded-full px-5 text-sm font-medium lg:flex ${
              showFilters ? "border-[var(--xd-gold-border-hover)] bg-[var(--xd-gold-bg-soft)]" : ""
            }`}
          >
            <SlidersHorizontal size={16} />
            {t("common.filters")}
          </Button>

          <Button
            type="button"
            onClick={() => setIsMobileFilterOpen(true)}
            variant="secondary"
            size="sm"
            className="flex h-12 shrink-0 gap-2 rounded-full px-5 text-sm font-medium lg:hidden"
          >
            <Filter size={16} />
            {t("common.filters")}
            {selectedFilterCount > 0 && (
              <span
                aria-hidden="true"
                className="flex min-w-5 items-center justify-center rounded-full bg-[var(--xd-gold-active)] px-1.5 py-0.5 text-[11px] font-bold text-white"
              >
                {selectedFilterCount}
              </span>
            )}
            <span className="sr-only" aria-live="polite">
              {t("products.selectedFilterCount", {
                fallback: "{count} filters selected",
                values: { count: selectedFilterCount },
              })}
            </span>
          </Button>

          <div className="flex h-12 min-w-[220px] flex-1 items-center gap-3 rounded-full border border-[#050505]/[0.08] bg-white/70 px-4">
            <Search size={16} className="text-[#717182]" />
            <input
              type="text"
              placeholder={t("products.searchPlaceholder")}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-full flex-1 bg-transparent text-sm text-[#050505] outline-none placeholder:text-[#9A9A9A]"
            />
          </div>

          <DentalSelect
            label={t("products.sortLabel")}
            value={sortOrder}
            onChange={(value) => setSortOrder(value as SortOrder)}
            className="hidden w-[190px] shrink-0 md:block"
            triggerClassName="h-12 rounded-full border-[#050505]/[0.08] bg-white/70 px-5 text-sm font-medium"
            options={[
              { value: "recommended", label: t("common.recommended") },
              { value: "price-low", label: t("common.priceLowHigh") },
              { value: "price-high", label: t("common.priceHighLow") },
              { value: "name", label: t("common.nameAz") },
            ]}
          />
        </SectionReveal>

        {/* Collection Chips */}
        <SectionReveal delay={0.08} className="mb-10">
          <div className="no-scrollbar -mx-4 -my-4 flex items-center gap-2 overflow-x-auto overflow-y-hidden px-4 py-6">
            {collectionChips.map((chip) => {
              const isActive = activeCollection === chip.value;

              return (
                <Button
                  key={chip.value}
                  type="button"
                  onClick={() => setActiveCollection(chip.value)}
                  variant={isActive ? "primary" : "secondary"}
                  size="sm"
                  className="h-10 shrink-0 px-4 text-[13px] font-medium"
                >
                  {t(chip.labelKey)}
                </Button>
              );
            })}
          </div>
        </SectionReveal>

        {/* Main Products Area */}
        <div className="flex gap-6 overflow-visible">
          {/* Desktop Sidebar */}
          {showFilters && (
            <aside className="hidden w-[280px] shrink-0 lg:block">
              <div className="sticky top-28">
                <FilterPanel
                  categoryTree={categoryTree}
                  selectedCategorySlugs={selectedCategorySlugs}
                  onToggleCategory={toggleCategoryNode}
                  brands={catalogBrands}
                  brandsLoading={isCatalogLoading}
                  selectedBrandSlugs={selectedBrandSlugs}
                  selectedAvailability={selectedAvailability}
                  selectedOffers={selectedOffers}
                  priceRange={priceRange}
                  toggleBrand={toggleBrand}
                  clearBrands={clearBrands}
                  toggleAvailability={toggleAvailability}
                  toggleOffer={toggleOffer}
                  setPriceRange={setPriceRange}
                  clearFilters={clearFilters}
                />
              </div>
            </aside>
          )}

          {/* Mobile Filter Drawer */}
          {isMobileFilterOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div
                className="absolute inset-0 bg-[#050505]/30 backdrop-blur-sm"
                onClick={() => setIsMobileFilterOpen(false)}
              />

              <div
                className={cn(
                  "absolute inset-y-0 w-full max-w-[340px] overflow-y-auto bg-[var(--xd-bg)] p-5 shadow-2xl",
                  isRtl ? "right-0" : "left-0"
                )}
              >
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="font-display text-xl font-semibold text-[#050505]">
                    {t("common.filters")}
                  </h2>
                  <Button
                    type="button"
                    onClick={() => setIsMobileFilterOpen(false)}
                    aria-label={t("common.close")}
                    variant="tertiary"
                    size="icon"
                    className="h-10 w-10 bg-white"
                  >
                    <X size={20} />
                  </Button>
                </div>

                <FilterPanel
                  categoryTree={categoryTree}
                  selectedCategorySlugs={selectedCategorySlugs}
                  onToggleCategory={toggleCategoryNode}
                  brands={catalogBrands}
                  brandsLoading={isCatalogLoading}
                  selectedBrandSlugs={selectedBrandSlugs}
                  selectedAvailability={selectedAvailability}
                  selectedOffers={selectedOffers}
                  priceRange={priceRange}
                  toggleBrand={toggleBrand}
                  clearBrands={clearBrands}
                  toggleAvailability={toggleAvailability}
                  toggleOffer={toggleOffer}
                  setPriceRange={setPriceRange}
                  clearFilters={clearFilters}
                />
              </div>
            </div>
          )}

          {/* Product Grid */}
          <main className="min-w-0 flex-1 overflow-visible">
            {selectedCategoryChips.length > 0 && (
              <div
                className="mb-4 flex flex-wrap items-center gap-2"
                aria-label={t("products.selectedCategories", {
                  fallback: "Selected categories",
                })}
              >
                {selectedCategoryChips.map((chip) => (
                  <button
                    key={chip.node.id}
                    type="button"
                    onClick={() => removeCategoryChip(chip)}
                    className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[var(--xd-gold-border)] bg-[var(--xd-gold-bg-soft)] px-3 text-[12px] font-semibold text-[#3A3A3A] transition hover:border-[var(--xd-gold-border-hover)] hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)]"
                    aria-label={t("products.removeCategoryFilter", {
                      fallback: "Remove {category} filter",
                      values: {
                        category: getLocalizedCategoryName(chip.node, language, t),
                      },
                    })}
                  >
                    {getLocalizedCategoryName(chip.node, language, t)}
                    <X size={13} aria-hidden="true" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => updateSelectedCategories(new Set())}
                  className="min-h-9 rounded-full px-3 text-[12px] font-semibold text-[var(--xd-gold-text)] transition hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)]"
                >
                  {t("common.clearAll")}
                </button>
              </div>
            )}
            {isProductsLoading ? (
              <div className={`products-grid px-1 pb-6 pt-2 ${showFilters ? "products-grid--with-filters" : ""}`}>
                {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-[340px] animate-pulse rounded-[24px] border border-[var(--xd-gold-border-soft)] bg-white/65" />)}
              </div>
            ) : productsError ? (
              <div role="alert" className="rounded-[28px] border border-[#F2C8C8] bg-[#FFF3F3] px-6 py-16 text-center">
                <h3 className="text-xl font-semibold text-[#B42318]">{t("products.catalogUnavailable", { fallback: "The product catalog is temporarily unavailable." })}</h3>
                <p className="mx-auto mt-2 max-w-[420px] text-sm text-[#717182]">{productsError}</p>
                <Button type="button" onClick={() => setRetryNonce((n) => n + 1)} variant="secondary" size="sm" className="mt-6">{t("common.retry", { fallback: "Retry" })}</Button>
              </div>
            ) : products.length > 0 ? (
              <div
                className={`products-grid overflow-visible px-1 pb-6 pt-2 ${
                  showFilters ? "products-grid--with-filters" : ""
                }`}
              >
                {products.map((product, index) => (
                  <div
                    key={product.id}
                    className="min-w-0 overflow-visible"
                  >
                    <ProductCard
                      product={product}
                      imageLoading={index < EAGER_PRODUCT_IMAGE_COUNT ? "eager" : "lazy"}
                      imageFetchPriority={index < EAGER_PRODUCT_IMAGE_COUNT ? "high" : "auto"}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[28px] border border-[var(--xd-gold-border-soft)] bg-white/70 px-6 py-20 text-center shadow-[0_12px_32px_rgba(5,5,5,0.04)] backdrop-blur-xl">
                <h3 className="mb-2 text-xl font-semibold text-[#050505]">
                  {t("products.noProductsTitle")}
                </h3>
                <p className="mx-auto max-w-[420px] text-[#717182]">
                  {activeCollection === "Clinic Essentials"
                    ? isAuthenticated && hasClinicSpecialty
                      ? t("products.clinicEssentialsEmptyPersonalized", {
                          fallback: "No products are currently assigned to your clinic specialty.",
                        })
                      : isAuthenticated
                        ? t("products.clinicEssentialsEmptyMissingSpecialty", {
                            fallback: "No general clinic essentials are available yet. Choose your clinic specialty in your profile for relevant products.",
                          })
                      : t("products.clinicEssentialsEmptyGuest", {
                          fallback: "No general clinic essentials are available yet. Sign in to use your clinic specialty when matching products are added.",
                        })
                    : t("products.noProductsBody")}
                </p>
                <Button
                  type="button"
                  onClick={clearFilters}
                  variant="primary"
                  size="sm"
                  className="mt-6 h-11 px-6 text-sm font-semibold"
                >
                  {t("common.clearFilters")}
                </Button>
              </div>
            )}

            {pagination && page < pagination.pages && (
              <div className="mt-14 flex justify-center">
                <Button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  variant="secondary"
                  className="px-8 text-sm font-medium"
                >
                  {isLoadingMore ? t("common.loading", { fallback: "Loading..." }) : t("common.loadMoreProducts")}
                </Button>
              </div>
            )}
          </main>
        </div>
      </Container>
    </div>
  );
}

function FilterPanel({
  categoryTree,
  selectedCategorySlugs,
  onToggleCategory,
  brands,
  brandsLoading,
  selectedBrandSlugs,
  selectedAvailability,
  selectedOffers,
  priceRange,
  toggleBrand,
  clearBrands,
  toggleAvailability,
  toggleOffer,
  setPriceRange,
  clearFilters,
}: {
  categoryTree: CatalogCategoryNode[];
  selectedCategorySlugs: string[];
  onToggleCategory: (node: CatalogCategoryNode, checked: boolean) => void;
  brands: CatalogBrand[];
  brandsLoading: boolean;
  selectedBrandSlugs: string[];
  selectedAvailability: string[];
  selectedOffers: string[];
  priceRange: { min: string; max: string };
  toggleBrand: (brand: CatalogBrand) => void;
  clearBrands: () => void;
  toggleAvailability: (option: string) => void;
  toggleOffer: (offer: string) => void;
  setPriceRange: (value: { min: string; max: string }) => void;
  clearFilters: () => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="font-display text-[18px] font-semibold text-[#050505]">
          {t("common.filters")}
        </h2>
        <Button
          type="button"
          onClick={clearFilters}
          variant="tertiary"
          size="sm"
          className="h-auto px-0 py-0 text-sm font-medium text-[var(--xd-gold-text)] hover:bg-transparent hover:text-[#050505]"
        >
          {t("common.clearAll")}
        </Button>
      </div>

      <FilterSection title={t("products.category")}>
        <CategoryTreeFilter
          tree={categoryTree}
          selectedSlugs={selectedCategorySlugs}
          onToggle={onToggleCategory}
        />
      </FilterSection>

      <FilterSection title={t("products.brand")}>
        <BrandFilter
          brands={brands}
          isLoading={brandsLoading}
          selectedSlugs={selectedBrandSlugs}
          onToggle={toggleBrand}
          onClear={clearBrands}
        />
      </FilterSection>

      <FilterSection title={t("products.priceRange")}>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder={t("common.min")}
            value={priceRange.min}
            onChange={(event) =>
              setPriceRange({ ...priceRange, min: event.target.value })
            }
            className="h-10 min-w-0 flex-1 rounded-xl border border-[#050505]/[0.08] bg-white/70 px-3 text-[13px] text-[#050505] outline-none focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-bg-soft)]"
          />
          <span className="text-sm text-[#717182]">-</span>
          <input
            type="number"
            placeholder={t("common.max")}
            value={priceRange.max}
            onChange={(event) =>
              setPriceRange({ ...priceRange, max: event.target.value })
            }
            className="h-10 min-w-0 flex-1 rounded-xl border border-[#050505]/[0.08] bg-white/70 px-3 text-[13px] text-[#050505] outline-none focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-bg-soft)]"
          />
        </div>
      </FilterSection>

      <FilterSection title={t("products.availability")}>
        <div className="flex flex-col gap-2.5">
          {availabilityOptions.map((option) => (
            <CheckboxRow
              key={option.value}
              label={t(option.labelKey)}
              checked={selectedAvailability.includes(option.value)}
              onChange={() => toggleAvailability(option.value)}
            />
          ))}
        </div>
      </FilterSection>

      <FilterSection title={t("products.offers")}>
        <div className="flex flex-col gap-2.5">
          {offerFilters.map((offer) => (
            <CheckboxRow
              key={offer.value}
              label={t(offer.labelKey)}
              checked={selectedOffers.includes(offer.value)}
              onChange={() => toggleOffer(offer.value)}
            />
          ))}
        </div>
      </FilterSection>
    </div>
  );
}

function BrandFilter({
  brands,
  isLoading,
  selectedSlugs,
  onToggle,
  onClear,
}: {
  brands: CatalogBrand[];
  isLoading: boolean;
  selectedSlugs: string[];
  onToggle: (brand: CatalogBrand) => void;
  onClear: () => void;
}) {
  const { t } = useLanguage();
  const [searchValue, setSearchValue] = useState("");
  const deferredSearch = useDeferredValue(searchValue);
  const selected = useMemo(() => new Set(selectedSlugs), [selectedSlugs]);
  const filteredBrands = useMemo(() => {
    const query = normalizeBrandSearch(deferredSearch);
    return brands
      .filter((brand) => {
        if (!query) return true;
        return (
          normalizeBrandSearch(brand.name).includes(query) ||
          normalizeBrandSearch(brand.slug).includes(query)
        );
      })
      .sort((left, right) =>
        left.name.localeCompare(right.name, undefined, { sensitivity: "base" })
      );
  }, [brands, deferredSearch]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium text-[#717182]" aria-live="polite">
          {t("products.brandsSelected", {
            fallback: "{count} selected",
            values: { count: selectedSlugs.length },
          })}
        </span>
        {selectedSlugs.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] font-semibold text-[var(--xd-gold-text)] transition hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)]"
          >
            {t("products.clearBrands", { fallback: "Clear brands" })}
          </button>
        )}
      </div>

      <label className="mb-3 flex h-9 items-center gap-2 rounded-xl border border-[#050505]/[0.08] bg-[var(--xd-surface)] px-3 transition focus-within:border-[var(--xd-gold-border-hover)] focus-within:ring-2 focus-within:ring-[var(--xd-gold-bg-soft)]">
        <Search size={14} className="shrink-0 text-[#717182]" aria-hidden="true" />
        <span className="sr-only">
          {t("products.searchBrands", { fallback: "Search brands" })}
        </span>
        <input
          type="search"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder={t("products.searchBrands", { fallback: "Search brands" })}
          className="h-full min-w-0 flex-1 bg-transparent text-[12px] text-[#050505] outline-none placeholder:text-[#8A8D9A]"
        />
      </label>

      {isLoading ? (
        <div aria-label={t("products.loadingBrands", { fallback: "Loading brands" })} className="space-y-2.5">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="h-[18px] animate-pulse rounded-md bg-[#050505]/[0.06]"
            />
          ))}
        </div>
      ) : filteredBrands.length === 0 ? (
        <p className="rounded-xl bg-[var(--xd-gold-bg-soft)] px-3 py-4 text-center text-[12px] text-[#717182]">
          {t("products.noBrandsFound", { fallback: "No brands found" })}
        </p>
      ) : (
        <div
          className="flex max-h-[280px] flex-col gap-2.5 overflow-y-auto pe-1"
          role="group"
          aria-label={t("products.brandResults", { fallback: "Brand results" })}
        >
          {filteredBrands.map((brand) => (
            <CheckboxRow
              key={brand.id}
              label={brand.name}
              count={brand.productCount}
              checked={selected.has(brand.slug)}
              onChange={() => onToggle(brand)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Hierarchical multi-select category tree. Each parent reflects its complete
 * active subtree and becomes indeterminate when only part is selected.
 */
function CategoryTreeFilter({
  tree,
  selectedSlugs,
  onToggle,
}: {
  tree: CatalogCategoryNode[];
  selectedSlugs: string[];
  onToggle: (node: CatalogCategoryNode, checked: boolean) => void;
}) {
  const { language, t } = useLanguage();
  const [expandedSlugs, setExpandedSlugs] = useState<string[]>([]);
  const selected = useMemo(() => new Set(selectedSlugs), [selectedSlugs]);

  useEffect(() => {
    const containingSelections: string[] = [];
    const visit = (node: CatalogCategoryNode) => {
      if (
        node.children.length > 0 &&
        [...collectSubtreeSlugs(node)].some((slug) => selected.has(slug))
      ) {
        containingSelections.push(node.slug);
      }
      node.children.forEach(visit);
    };
    tree.forEach(visit);
    if (containingSelections.length === 0) return;
    setExpandedSlugs((previous) => [
      ...new Set([...previous, ...containingSelections]),
    ]);
  }, [selected, tree]);

  const toggleExpanded = (slug: string) => {
    setExpandedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((item) => item !== slug) : [...prev, slug]
    );
  };

  const renderNode = (node: CatalogCategoryNode, depth: number) => {
    const subtreeSlugs = [...collectSubtreeSlugs(node)];
    const selectedCount = subtreeSlugs.filter((slug) => selected.has(slug)).length;
    const checkedState =
      selectedCount === 0
        ? false
        : selectedCount === subtreeSlugs.length
          ? true
          : "indeterminate";
    const isExpanded = expandedSlugs.includes(node.slug);
    const hasChildren = node.children.length > 0;
    const checkboxId = `category-filter-${node.id}`;
    const label = getLocalizedCategoryName(node, language, t);

    return (
      <div key={node.id}>
        <div
          className="flex min-h-9 items-center gap-2 rounded-[9px] py-1 transition hover:bg-[var(--xd-gold-bg-soft)]"
          style={{ paddingInlineStart: `${depth * 16}px` }}
        >
          <Checkbox
            id={checkboxId}
            variant="filter"
            checked={checkedState}
            onCheckedChange={(value) => onToggle(node, value === true)}
            aria-label={label}
            className="h-[18px] w-[18px] rounded-[5px]"
          />
          <label
            htmlFor={checkboxId}
            className={cn(
              "min-w-0 flex-1 cursor-pointer text-[13px] leading-5",
              checkedState
                ? "font-semibold text-[#050505]"
                : "font-medium text-[#717182]"
            )}
          >
            <span className="break-words">{label}</span>
            {node.productCount > 0 && (
              <span className="ms-1.5 text-[11px] font-medium text-[#8A8D9A]">
                ({node.productCount})
              </span>
            )}
          </label>
          {hasChildren && (
            <button
              type="button"
              onClick={() => toggleExpanded(node.slug)}
              aria-expanded={isExpanded}
              aria-label={t("products.toggleCategoryGroup", {
                fallback: "Toggle {category} subcategories",
                values: { category: label },
              })}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-[#717182] transition hover:bg-white hover:text-[var(--xd-gold-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)]"
            >
              <ChevronDown
                size={14}
                aria-hidden="true"
                className={cn(
                  "transition-transform",
                  isExpanded ? "rotate-180" : ""
                )}
              />
            </button>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="flex max-h-[420px] flex-col gap-1 overflow-y-auto pe-1">
      {tree.map((node) => renderNode(node, 0))}
    </div>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[16px] border border-[var(--xd-gold-border-soft)] bg-white/70 p-4 shadow-[0_10px_24px_rgba(5,5,5,0.035)] backdrop-blur-xl">
      <h3 className="mb-3 text-[12px] font-semibold text-[#050505]">{title}</h3>
      {children}
    </div>
  );
}

function CheckboxRow({
  label,
  count,
  checked,
  onChange,
}: {
  label: string;
  count?: number;
  checked: boolean;
  onChange: () => void;
}) {
  const checkboxId = useId();

  return (
    <div className="group flex items-center gap-2.5">
      <Checkbox
        id={checkboxId}
        variant="filter"
        checked={checked}
        onCheckedChange={onChange}
        aria-label={label}
        className="h-[18px] w-[18px] rounded-[5px]"
      />
      <label
        htmlFor={checkboxId}
        className="cursor-pointer text-[13px] text-[#717182] transition-colors group-hover:text-[#050505]"
      >
        {label}
        {typeof count === "number" && (
          <span className="ms-1 text-[11px] font-medium text-[#8A8D9A]">
            ({count})
          </span>
        )}
      </label>
    </div>
  );
}
