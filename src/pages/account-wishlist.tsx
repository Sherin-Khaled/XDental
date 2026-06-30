import { useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { Heart, Search, ShoppingCart } from "lucide-react";
import { AccountSidebar } from "@/components/dental/AccountSidebar";
import {
  AccountFilterToolbar,
  accountFilterControlClassName,
  accountFilterSearchClassName,
  accountFilterTriggerClassName,
} from "@/components/dental/AccountFilterToolbar";
import { Button } from "@/components/dental/Button";
import { Container } from "@/components/dental/Container";
import { ProductCard } from "@/components/dental/ProductCard";
import { DentalSelect, type DentalSelectOption } from "@/components/dental/Select";
import { useLanguage } from "@/context/LanguageContext";
import { useStore } from "@/context/StoreContext";
import { mockProducts } from "@/data/products";
import { accountT, accountValue } from "@/lib/accountI18n";
import { cn } from "@/lib/utils";

type StockFilter = "all" | "In Stock" | "Low Stock" | "Out of Stock";
type SortOrder = "recent" | "price-low" | "price-high" | "name";

const inputClassName =
  "h-12 w-full rounded-full border border-[#050505]/10 bg-white px-4 text-[14px] text-[#050505] outline-none transition placeholder:text-[#B3B4BD] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10";

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-[24px] border border-[var(--xd-gold-active)]/[0.14] bg-white/85 shadow-[0_14px_36px_rgba(5,5,5,0.04)] backdrop-blur",
        className
      )}
    >
      {children}
    </section>
  );
}

function SelectControl({
  label,
  value,
  onChange,
  options,
  className,
  triggerClassName,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: DentalSelectOption[];
  className?: string;
  triggerClassName?: string;
}) {
  return (
    <DentalSelect
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      className={className}
      triggerClassName={triggerClassName}
    />
  );
}

export default function AccountWishlist() {
  const { wishlistIds, addToCart, clearWishlist } = useStore();
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("recent");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const wishlistedProducts = useMemo(
    () =>
      wishlistIds
        .map((id) => mockProducts.find((product) => product.id === id))
        .filter((product): product is (typeof mockProducts)[number] => Boolean(product)),
    [wishlistIds]
  );

  const availableProducts = useMemo(
    () => wishlistedProducts.filter((product) => product.stockStatus !== "Out of Stock"),
    [wishlistedProducts]
  );

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return wishlistedProducts
      .filter((product) => stockFilter === "all" || product.stockStatus === stockFilter)
      .filter((product) => {
        if (!query) return true;

        return [product.name, product.brand, product.category, product.sku ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => {
        if (sortOrder === "price-low") return a.currentPrice - b.currentPrice;
        if (sortOrder === "price-high") return b.currentPrice - a.currentPrice;
        if (sortOrder === "name") return a.name.localeCompare(b.name);

        return wishlistIds.indexOf(b.id) - wishlistIds.indexOf(a.id);
      });
  }, [search, sortOrder, stockFilter, wishlistIds, wishlistedProducts]);

  const recommendedProducts = useMemo(() => {
    const savedIds = new Set(wishlistIds);
    const recommendationPool = mockProducts.filter(
      (product) =>
        !savedIds.has(product.id) &&
        (product.isRecommended || product.isBestSeller || product.isWeeklyOffer)
    );
    const fallbackProducts = mockProducts.filter((product) => !savedIds.has(product.id));

    return [...recommendationPool, ...fallbackProducts]
      .filter(
        (product, index, products) =>
          products.findIndex((candidate) => candidate.id === product.id) === index
      )
      .slice(0, 4);
  }, [wishlistIds]);

  const handleAddAllToCart = () => {
    if (availableProducts.length === 0) {
      setStatusMessage(accountT(t, "wishlist.messages.noAvailableProducts", "No available wishlist products can be added to cart."));
      return;
    }

    availableProducts.forEach((product) => {
      addToCart(product, 1, product.options?.[0]);
    });

    setStatusMessage(accountT(t, "wishlist.messages.addedToCart", "{count} wishlist products added to cart.", { count: availableProducts.length }));
  };

  const handleClearWishlist = () => {
    clearWishlist();
    setSearch("");
    setStockFilter("all");
    setStatusMessage(accountT(t, "wishlist.messages.cleared", "Wishlist cleared."));
  };

  return (
    <div className="bg-[var(--xd-bg)] pb-14 pt-10 lg:pb-20 lg:pt-14">
      <Container className="overflow-x-clip">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:gap-7">
          <AccountSidebar />

          <main className="min-w-0 space-y-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--xd-gold-active)]">
                  {accountT(t, "wishlist.eyebrow", "Saved Products")}
                </p>
                <h1 className="font-display text-[42px] font-bold leading-none text-[#050505] sm:text-[48px]">
                  {accountT(t, "wishlist.title", "Wishlist")}
                </h1>
                <p className="mt-4 max-w-[760px] text-[15px] leading-6 text-[#6A6A6A]">
                  {accountT(t, "wishlist.description", "Keep products ready for later ordering, quote requests, or clinic supply planning.")}
                </p>
              </div>

              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button
                  type="button"
                  onClick={handleAddAllToCart}
                  disabled={availableProducts.length === 0}
                  variant="primary"
                  className="h-12 w-full gap-1 px-6 text-[14px] sm:w-auto"
                >
                  <ShoppingCart size={17} />
                  {accountT(t, "wishlist.addAllToCart", "Add All to Cart")}
                </Button>
                {wishlistedProducts.length > 0 && (
                  <Button
                    type="button"
                    onClick={handleClearWishlist}
                    variant="tertiary"
                    size="sm"
                    className="h-12 w-full border border-[#EF4444]/25 bg-[#EF4444]/[0.04] px-4 text-[13px] font-bold text-[#EF4444] hover:bg-[#EF4444]/[0.08] hover:text-[#B42318] sm:w-auto sm:px-[18px]"
                  >
                    {accountT(t, "wishlist.clearWishlist", "Clear Wishlist")}
                  </Button>
                )}
              </div>
            </div>

            {statusMessage && (
              <div
                role="status"
                className="rounded-[14px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-active)]/[0.08] px-4 py-3 text-[13px] font-semibold text-[#5F5F5F]"
              >
                {statusMessage}
              </div>
            )}

            <AccountFilterToolbar className="sm:grid-cols-[minmax(0,1fr)_150px_190px]">
              <label className={cn(accountFilterSearchClassName, "sm:col-span-1")}>
                <span className="sr-only">{accountT(t, "wishlist.searchLabel", "Search wishlist")}</span>
                <Search
                  size={17}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8A8D9A]"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={accountT(t, "wishlist.searchPlaceholder", "Search saved products")}
                  className={cn(inputClassName, "pl-11")}
                />
              </label>

              <SelectControl
                label={accountT(t, "wishlist.stockFilterLabel", "Filter wishlist by stock")}
                value={stockFilter}
                onChange={(value) => setStockFilter(value as StockFilter)}
                className={accountFilterControlClassName}
                triggerClassName={cn(accountFilterTriggerClassName, "sm:w-[150px] sm:text-[14px]")}
                options={[
                  { value: "all", label: accountValue(t, "All Stock") },
                  { value: "In Stock", label: accountValue(t, "In Stock") },
                  { value: "Low Stock", label: accountValue(t, "Low Stock") },
                  { value: "Out of Stock", label: accountValue(t, "Out of Stock") },
                ]}
              />

              <SelectControl
                label={accountT(t, "wishlist.sortLabel", "Sort wishlist")}
                value={sortOrder}
                onChange={(value) => setSortOrder(value as SortOrder)}
                className={accountFilterControlClassName}
                triggerClassName={cn(accountFilterTriggerClassName, "sm:w-[190px] sm:text-[14px]")}
                options={[
                  { value: "recent", label: accountValue(t, "Recently Saved") },
                  { value: "price-low", label: accountT(t, "filters.priceLow", "Price Low") },
                  { value: "price-high", label: accountT(t, "filters.priceHigh", "Price High") },
                  { value: "name", label: accountT(t, "filters.nameAz", "Name A-Z") },
                ]}
              />
            </AccountFilterToolbar>

            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 overflow-visible px-1 pb-6 pt-2 sm:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <Card className="p-10 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-active)]">
                  <Heart size={24} />
                </span>
                <h2 className="mt-4 text-[18px] font-bold text-[#050505]">
                  {wishlistedProducts.length === 0
                    ? accountT(t, "wishlist.emptyTitle", "Your wishlist is empty")
                    : accountT(t, "wishlist.noSavedProductsTitle", "No saved products found")}
                </h2>
                <p className="mx-auto mt-2 max-w-[440px] text-[14px] leading-6 text-[#8A8D9A]">
                  {wishlistedProducts.length === 0
                    ? accountT(t, "wishlist.emptyDescription", "Save products from the catalog by clicking the heart icon.")
                    : accountT(t, "wishlist.noSavedProductsDescription", "Try changing the search term or stock filter to find another saved product.")}
                </p>
                <Button asChild variant="primary" size="sm" className="mt-6 h-11 px-6 text-[14px]">
                  <Link href="/products">{accountT(t, "dashboard.quickActionItems.browseProducts.title", "Browse Products")}</Link>
                </Button>
              </Card>
            )}

            {recommendedProducts.length > 0 && (
              <section className="!mt-12 sm:!mt-14">
                <div className="mb-6">
                  <h2 className="font-display text-[26px] font-bold leading-tight text-[#050505] sm:text-[30px]">
                    {accountT(t, "wishlist.recommendedTitle", "Recommended for Your Practice")}
                  </h2>
                  <p className="mt-2 max-w-[620px] text-[14px] leading-6 text-[#8A8D9A]">
                    {accountT(t, "wishlist.recommendedDescription", "Explore dental supplies commonly saved and reordered by clinics.")}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-5 overflow-visible px-1 pb-6 pt-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {recommendedProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </section>
            )}
          </main>
        </div>
      </Container>
    </div>
  );
}
