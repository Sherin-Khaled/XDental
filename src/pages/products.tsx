import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Container } from "@/components/dental/Container";
import { Button } from "@/components/dental/Button";
import { DentalSelect } from "@/components/dental/Select";
import { ProductCard } from "@/components/dental/ProductCard";
import { SectionReveal } from "@/components/dental/SectionReveal";
import { mockProducts } from "@/data/products";
import { mockCategories } from "@/data/categories";
import { mockBrands } from "@/data/brands";
import { SEO } from "@/components/SEO";
import { useLanguage } from "@/context/LanguageContext";
import { getCategorySlugFromSearch, getCategoryTranslationKey, normalizeCategorySlug } from "@/lib/catalogTranslations";
import {
  Check,
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

function getBrandFromSearchParams(searchParams: URLSearchParams) {
  const brandQuery = normalizeBrandQuery(searchParams.get("brand"));
  if (!brandQuery) return "";

  const matchedBrand = mockBrands.find((brand) => brand.slug === brandQuery);
  return matchedBrand?.name ?? brandQuery.replace(/-/g, " ");
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

type SortOrder = "recommended" | "price-low" | "price-high" | "name";
const EAGER_PRODUCT_IMAGE_COUNT = 6;

export default function Products() {
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const search = useSearch();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const activeCategory = useMemo(() => getCategorySlugFromSearch(search), [search]);
  const activeCollectionFromSearch = useMemo(
    () => getCollectionFromSearchParams(searchParams),
    [searchParams]
  );
  const activeBrandFromSearch = useMemo(
    () => getBrandFromSearchParams(searchParams),
    [searchParams]
  );

  const [activeCollection, setActiveCollection] = useState(activeCollectionFromSearch);
  const [showFilters, setShowFilters] = useState(true);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    activeCategory !== "all" ? [activeCategory] : []
  );
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedAvailability, setSelectedAvailability] = useState<string[]>([]);
  const [selectedOffers, setSelectedOffers] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState({ min: "", max: "" });
  const [sortOrder, setSortOrder] = useState<SortOrder>("recommended");

  useEffect(() => {
    setActiveCollection(activeCollectionFromSearch);
  }, [activeCollectionFromSearch]);

  useEffect(() => {
    setSelectedBrands(activeBrandFromSearch ? [activeBrandFromSearch] : []);
  }, [activeBrandFromSearch]);

  useEffect(() => {
    setSelectedCategories(activeCategory !== "all" ? [activeCategory] : []);
  }, [activeCategory]);

  const categories = useMemo(
    () => [{ id: "all", name: "All Products", slug: "all" }, ...mockCategories],
    []
  );
  const activeCategoryLabel = useMemo(
    () => mockCategories.find((category) => category.slug === activeCategory)?.name || activeCategory,
    [activeCategory]
  );
  const activeCategoryDisplay = useMemo(
    () => t(getCategoryTranslationKey(activeCategoryLabel), { fallback: activeCategoryLabel }),
    [activeCategoryLabel, t]
  );

  const filteredProducts = useMemo(() => {
    let result = [...mockProducts];

    if (selectedCategories.length > 0) {
      result = result.filter((product) =>
        selectedCategories.includes(normalizeCategorySlug(product.category))
      );
    }

    if (activeCollection !== "All Products") {
      result = result.filter((product) => {
        switch (activeCollection) {
          case "Weekly Offers":
            return product.isWeeklyOffer;
          case "Hot Deals":
            return Boolean(product.oldPrice && product.oldPrice > product.currentPrice);
          case "Fast Delivery":
            return product.isFastDelivery || product.deliveryLabel === "Fast Delivery";
          case "New Arrivals":
            return product.isNew;
          case "Best Selling":
            return product.isBestSeller;
          case "Limited Stock":
            return product.stockStatus === "Low Stock" || product.stockStatus === "Limited Stock";
          case "Clinic Essentials":
            return normalizeCategorySlug(product.category) === "clinic-essentials";
          default:
            return true;
        }
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((product) => {
        const searchableText = [
          product.name,
          product.brand,
          product.category,
          product.sku,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(query);
      });
    }

    if (selectedBrands.length > 0) {
      result = result.filter((product) =>
        selectedBrands.some((brand) =>
          product.brand?.toLowerCase().includes(brand.toLowerCase())
        )
      );
    }

    const min = Number(priceRange.min);
    const max = Number(priceRange.max);

    if (priceRange.min) {
      result = result.filter((product) => product.currentPrice >= min);
    }

    if (priceRange.max) {
      result = result.filter((product) => product.currentPrice <= max);
    }

    if (sortOrder === "price-low") {
      result.sort((a, b) => a.currentPrice - b.currentPrice);
    } else if (sortOrder === "price-high") {
      result.sort((a, b) => b.currentPrice - a.currentPrice);
    } else if (sortOrder === "name") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [selectedCategories, activeCollection, searchQuery, selectedBrands, priceRange, sortOrder]);

  const pageTitle =
    activeCategory !== "all"
      ? activeCategoryDisplay || t("products.fallbackTitle")
      : activeCollection === "Weekly Offers"
        ? t("products.titleWeekly")
        : t("products.titleAll");

  const toggleBrand = (brand: string) => {
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((item) => item !== brand) : [...prev, brand]
    );
  };

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

  const toggleCategory = (category: string) => {
    const nextCategory = normalizeCategorySlug(category);
    setSelectedCategories((prev) =>
      prev.includes(nextCategory)
        ? prev.filter((item) => item !== nextCategory)
        : [...prev, nextCategory]
    );
  };

  const clearFilters = () => {
    navigate("/products");
    setActiveCollection("All Products");
    setSearchQuery("");
    setSelectedCategories([]);
    setSelectedBrands([]);
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
              {t("products.showingResults", { values: { count: filteredProducts.length } })}
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
        <SectionReveal delay={0.08} className="no-scrollbar mb-10 flex items-center gap-2 overflow-x-auto overflow-y-hidden py-2">
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
        </SectionReveal>

        {/* Main Products Area */}
        <div className="flex gap-6 overflow-visible">
          {/* Desktop Sidebar */}
          {showFilters && (
            <aside className="hidden w-[280px] shrink-0 lg:block">
              <div className="sticky top-28">
                <FilterPanel
                  categories={categories.slice(1)}
                  selectedCategories={selectedCategories}
                  toggleCategory={toggleCategory}
                  selectedBrands={selectedBrands}
                  selectedAvailability={selectedAvailability}
                  selectedOffers={selectedOffers}
                  priceRange={priceRange}
                  toggleBrand={toggleBrand}
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

              <div className="absolute inset-y-0 left-0 w-full max-w-[340px] overflow-y-auto bg-[var(--xd-bg)] p-5 shadow-2xl">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="font-display text-xl font-semibold text-[#050505]">
                    {t("common.filters")}
                  </h2>
                  <Button
                    type="button"
                    onClick={() => setIsMobileFilterOpen(false)}
                    variant="tertiary"
                    size="icon"
                    className="h-10 w-10 bg-white"
                  >
                    <X size={20} />
                  </Button>
                </div>

                <FilterPanel
                  categories={categories.slice(1)}
                  selectedCategories={selectedCategories}
                  toggleCategory={toggleCategory}
                  selectedBrands={selectedBrands}
                  selectedAvailability={selectedAvailability}
                  selectedOffers={selectedOffers}
                  priceRange={priceRange}
                  toggleBrand={toggleBrand}
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
            {filteredProducts.length > 0 ? (
              <div
                className={`products-grid overflow-visible px-1 pb-6 pt-2 ${
                  showFilters ? "products-grid--with-filters" : ""
                }`}
              >
                {filteredProducts.map((product, index) => (
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
                  {t("products.noProductsBody")}
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

            {filteredProducts.length > 0 && (
              <div className="mt-14 flex justify-center">
                <Button
                  type="button"
                  variant="secondary"
                  className="px-8 text-sm font-medium"
                >
                  {t("common.loadMoreProducts")}
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
  categories,
  selectedCategories,
  toggleCategory,
  selectedBrands,
  selectedAvailability,
  selectedOffers,
  priceRange,
  toggleBrand,
  toggleAvailability,
  toggleOffer,
  setPriceRange,
  clearFilters,
}: {
  categories: { id: string; name: string; slug: string }[];
  selectedCategories: string[];
  toggleCategory: (category: string) => void;
  selectedBrands: string[];
  selectedAvailability: string[];
  selectedOffers: string[];
  priceRange: { min: string; max: string };
  toggleBrand: (brand: string) => void;
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
        <div className="flex flex-col gap-2.5">
          {categories.slice(0, 8).map((category) => (
            <CheckboxRow
              key={category.id}
              label={t(getCategoryTranslationKey(category.name), { fallback: category.name })}
              checked={selectedCategories.includes(category.slug)}
              onChange={() => toggleCategory(category.slug)}
            />
          ))}
        </div>
      </FilterSection>

      <FilterSection title={t("products.brand")}>
        <div className="flex flex-col gap-2.5">
          {mockBrands.slice(0, 6).map((brand) => (
            <CheckboxRow
              key={brand.id}
              label={brand.name}
              checked={selectedBrands.includes(brand.name)}
              onChange={() => toggleBrand(brand.name)}
            />
          ))}
        </div>
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
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <label className="group flex cursor-pointer items-center gap-2.5">
      <span className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 focus:outline-none"
        />
        <span
          aria-hidden="true"
          className="flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border transition"
          style={{
            backgroundColor: checked ? "#D4A72C" : "#FFFFFF",
            borderColor: checked ? "#D4A72C" : "rgba(212, 167, 44, 0.22)",
            boxShadow: isFocused ? "0 0 0 4px rgba(249, 220, 92, 0.12)" : "none",
          }}
        >
          <Check
            size={11}
            strokeWidth={3}
            className="pointer-events-none transition-opacity"
            style={{
              color: "#FFFFFF",
              opacity: checked ? 1 : 0,
            }}
          />
        </span>
      </span>
      <span className="text-[13px] text-[#717182] transition-colors group-hover:text-[#050505]">
        {label}
      </span>
    </label>
  );
}
