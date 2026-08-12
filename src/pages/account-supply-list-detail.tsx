import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Link, useParams } from "wouter";
import {
  FileText,
  Minus,
  MoreVertical,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { AccountSidebar } from "@/components/dental/AccountSidebar";
import { Button } from "@/components/dental/Button";
import { Container } from "@/components/dental/Container";
import { DentalSelect, type DentalSelectOption } from "@/components/dental/Select";
import { useLanguage } from "@/context/LanguageContext";
import { useStore } from "@/context/StoreContext";
import { fetchPublicProducts } from "@/services/catalog";
import { useClickOutside } from "@/hooks/use-click-outside";
import {
  type SupplyList,
  type SupplyListDetailAvailability,
  type SupplyListDetailItem,
} from "@/data/supplyLists";
import {
  fetchSupplyList,
  replaceSupplyListItems,
} from "@/services/supplyLists";
import { createQuote, getMyQuote } from "@/services/quotes";
import { accountT, accountValue } from "@/lib/accountI18n";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/product";
import { getProductStockLimit } from "@/lib/cartStock";

type AvailabilityFilter = "all" | SupplyListDetailAvailability;

const optionChoices = ["Shade A1", "Shade A2", "Shade A3", "Universal"];

function useModalCloseBehavior(onClose: () => void, lockBodyScroll = true) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!lockBodyScroll) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [lockBodyScroll]);
}

function closeOnOverlayPointerDown(event: PointerEvent<HTMLDivElement>, onClose: () => void) {
  if (event.target === event.currentTarget) {
    onClose();
  }
}

function formatCurrency(value: number) {
  return `EGP ${value.toLocaleString("en-US")}`;
}

function updatedLabel(days: number, t: ReturnType<typeof useLanguage>["t"]) {
  if (days <= 0) return accountT(t, "supplyLists.updatedToday", "Updated today");
  if (days === 1) return accountT(t, "supplyLists.updatedOneFullDay", "Updated 1 day ago");
  return accountT(t, "supplyLists.updatedFullDays", "Updated {days} days ago", { days });
}

function getAvailabilityOptions(t: ReturnType<typeof useLanguage>["t"]): DentalSelectOption[] {
  return [
    { value: "all", label: accountValue(t, "All Availability") },
    { value: "available", label: accountValue(t, "Available") },
    { value: "out-of-stock", label: accountValue(t, "Out of Stock") },
    { value: "needs-options", label: accountValue(t, "Need Options") },
  ];
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "min-w-0 max-w-full rounded-[24px] border border-[var(--xd-gold-border-soft)] bg-white/85 shadow-[0_14px_36px_rgba(5,5,5,0.04)] backdrop-blur",
        className
      )}
    >
      {children}
    </section>
  );
}

function BranchPill({ branch }: { branch: string }) {
  const { t } = useLanguage();

  return (
    <span className="inline-flex rounded-[7px] bg-[var(--xd-info-bg)] px-2.5 py-1 text-[11px] font-bold text-[var(--xd-info-text)]">
      {accountValue(t, branch)}
    </span>
  );
}

function MetricCard({
  label,
  value,
  tone = "gold",
}: {
  label: string;
  value: string | number;
  tone?: "gold" | "green" | "red";
}) {
  const toneClassName =
    tone === "green" ? "text-[#2BA84A]" : tone === "red" ? "text-[#F44336]" : "text-[var(--xd-gold-active)]";

  return (
    <Card className="flex min-h-[92px] items-center justify-center px-4 py-5 text-center">
      <div>
        <p className={cn("font-display text-[24px] font-bold leading-none", toneClassName)}>{value}</p>
        <p className="mt-3 text-[12px] font-bold text-[#8A8D9A]">{label}</p>
      </div>
    </Card>
  );
}

function QuantityStepper({
  value,
  onChange,
  disabled = false,
  max = 99,
}: {
  value: number;
  onChange: (quantity: number) => void;
  disabled?: boolean;
  max?: number;
}) {
  const { t } = useLanguage();

  return (
    <div
      className={cn(
        "inline-grid h-9 grid-cols-[32px_42px_32px] items-center rounded-full border border-[var(--xd-gold-border-soft)] bg-white",
        disabled && "opacity-55"
      )}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={disabled || value <= 1}
        aria-label={accountT(t, "common.decreaseQuantity", "Decrease quantity")}
        className="flex h-full items-center justify-center rounded-l-full text-[var(--xd-gold-active)] transition hover:text-[#050505] disabled:text-[var(--xd-gold-active)]/40"
      >
        <Minus size={14} />
      </button>
      <span className="text-center text-[13px] font-bold text-[#050505]">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label={accountT(t, "common.increaseQuantity", "Increase quantity")}
        className="flex h-full items-center justify-center rounded-r-full text-[var(--xd-gold-active)] transition hover:text-[#050505] disabled:text-[var(--xd-gold-active)]/40"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

function DetailProductImage({ item }: { item: SupplyListDetailItem }) {
  const [hasImageError, setHasImageError] = useState(false);
  const productImage = item.image;

  return (
    <div className="flex h-[76px] w-[76px] shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-[var(--xd-gold-border-soft)] bg-white sm:h-[80px] sm:w-[80px]">
      {productImage && !hasImageError ? (
        <img
          src={productImage}
          alt={item.name}
          width={2525}
          height={2582}
          loading="lazy"
          decoding="async"
          onError={() => setHasImageError(true)}
          className="h-full w-full object-contain p-2 mix-blend-multiply"
        />
      ) : (
        <Package size={22} strokeWidth={1.8} className="text-[var(--xd-gold-hover)]" />
      )}
    </div>
  );
}

function toCartProduct(item: SupplyListDetailItem): Product {
  const available =
    item.isAvailable !== false &&
    item.status !== "OUT_OF_STOCK" &&
    item.availability !== "out-of-stock";
  return {
    id: item.productId,
    name: item.name,
    brand: item.brand,
    category: item.category,
    currentPrice: item.unitPrice,
    stockStatus: !available
      ? "Out of Stock"
      : item.status === "LOW_STOCK"
        ? "Low Stock"
        : "In Stock",
    sku: item.sku,
    image: item.image,
    stockQuantity: item.stockQuantity,
    status: item.status,
    available,
  };
}

function ProductRow({
  item,
  quantity,
  onQuantityChange,
  onRemove,
  onSelectOptions,
}: {
  item: SupplyListDetailItem;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
  onSelectOptions: () => void;
}) {
  const { t } = useLanguage();
  const isOutOfStock = item.availability === "out-of-stock";
  const needsOptions = item.availability === "needs-options";
  const maximumQuantity = getProductStockLimit(toCartProduct(item)) ?? 99;

  return (
    <article className="grid gap-4 border-b border-[#050505]/[0.06] py-6 last:border-b-0 md:grid-cols-[80px_minmax(0,1fr)_190px] md:items-center">
      <div className="flex items-start gap-4 md:block">
        <DetailProductImage item={item} />
        <div className="min-w-0 md:hidden">
          <h3 className="text-[14px] font-bold leading-5 text-[#050505]">{item.name}</h3>
          <p className="mt-2 text-[12px] font-bold text-[#717182]">{formatCurrency(item.unitPrice)}</p>
        </div>
      </div>

      <div className="min-w-0">
        <h3 className="hidden text-[14px] font-bold leading-5 text-[#050505] md:block">{item.name}</h3>
        <div className="mt-2 space-y-1 text-[12px] leading-5 text-[#8A8D9A]">
          <p>
            {accountT(t, "common.brandWithColon", "Brand:")} <span>{item.brand}</span>
          </p>
          <p>{item.details.join(" . ")}</p>
          <p>{accountT(t, "common.skuWithValue", "SKU: {sku}", { sku: item.sku })}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 md:flex-col md:items-end">
        <p className="hidden text-[13px] font-bold text-[#717182] md:block">{formatCurrency(item.unitPrice)}</p>
        {isOutOfStock ? (
          <span className="inline-flex rounded-full bg-[#F44336]/10 px-3 py-1.5 text-[11px] font-bold text-[#F44336]">
            {accountValue(t, "Out of Stock")}
          </span>
        ) : needsOptions ? (
          <Button
            type="button"
            onClick={onSelectOptions}
            variant="secondary"
            size="sm"
            className="h-9 border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] px-4 text-[12px] text-[#F59E0B] hover:bg-[var(--xd-gold)]/15"
          >
            {accountT(t, "supplyLists.detail.selectOptions", "Select Options")}
          </Button>
        ) : (
          <QuantityStepper
            value={quantity}
            max={maximumQuantity}
            onChange={onQuantityChange}
          />
        )}
        <p className="text-[17px] font-bold text-[#050505]">{formatCurrency(item.unitPrice * quantity)}</p>

        <button
          type="button"
          onClick={onRemove}
          className="inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-1 text-[12px] font-bold text-[#8A8D9A] transition hover:bg-[#050505]/[0.04] hover:text-[#F44336] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F44336]/30"
        >
          <Trash2 size={13} />
          {accountT(t, "common.remove", "Remove")}
        </button>
      </div>
    </article>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-4 text-[13px]">
      <span className="font-medium text-[#8A8D9A]">{label}</span>
      <span className="font-bold text-[#050505]">{value}</span>
    </div>
  );
}

function ActionMenu({
  onClose,
  onReset,
  onRemoveUnavailable,
  onClearList,
}: {
  onClose: () => void;
  onReset: () => void;
  onRemoveUnavailable: () => void;
  onClearList: () => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-52 overflow-hidden rounded-[16px] border border-[var(--xd-gold-border-soft)] bg-white p-1.5 shadow-[0_18px_44px_rgba(5,5,5,0.12)]">
      {[
        [accountT(t, "supplyLists.detail.resetList", "Reset list"), onReset],
        [accountT(t, "supplyLists.detail.removeUnavailable", "Remove unavailable"), onRemoveUnavailable],
        [accountT(t, "supplyLists.detail.clearList", "Clear list"), onClearList],
      ].map(([label, action]) => (
        <button
          key={label as string}
          type="button"
          onClick={() => {
            (action as () => void)();
            onClose();
          }}
          className={cn(
            "block w-full rounded-[12px] px-4 py-3 text-left text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset",
            label === accountT(t, "supplyLists.detail.clearList", "Clear list")
              ? "text-[#F44336] hover:bg-[#F44336]/[0.06] focus-visible:ring-[#F44336]/30"
              : "text-[#717182] hover:bg-[var(--xd-gold-bg-soft)] hover:text-[#050505] focus-visible:ring-[var(--xd-gold-border)]"
          )}
        >
          {label as string}
        </button>
      ))}
    </div>
  );
}

function AddProductModal({
  items,
  onClose,
  onAddProduct,
}: {
  items: SupplyListDetailItem[];
  onClose: () => void;
  onAddProduct: (product: Product) => void;
}) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(true);
  const existingProductIds = new Set(items.map((item) => item.productId));
  const availableProducts = candidates.filter((product) => !existingProductIds.has(product.id));
  useModalCloseBehavior(onClose);

  // Small, bounded server search — this modal no longer holds the full
  // catalogue, so results are limited to what the user is actively typing.
  useEffect(() => {
    const controller = new AbortController();
    setIsSearching(true);
    const debounce = window.setTimeout(() => {
      fetchPublicProducts({ search: query.trim() || undefined, limit: 20, signal: controller.signal })
        .then(({ products }) => {
          if (!controller.signal.aborted) setCandidates(products);
        })
        .catch(() => {})
        .finally(() => {
          if (!controller.signal.aborted) setIsSearching(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(debounce);
      controller.abort();
    };
  }, [query]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-[#050505]/40 px-4 py-4 sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-products-title"
      onPointerDown={(event) => closeOnOverlayPointerDown(event, onClose)}
    >
      <div className="flex max-h-[calc(100dvh-32px)] w-full max-w-[680px] flex-col overflow-hidden rounded-[28px] border border-[var(--xd-gold-border-soft)] bg-white shadow-[0_24px_70px_rgba(5,5,5,0.18)] sm:max-h-[calc(100vh-64px)]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#050505]/[0.06] p-6 pb-5 sm:p-8 sm:pb-6">
          <div>
            <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--xd-gold-active)]">
              {accountT(t, "supplyLists.eyebrow", "Supply Lists")}
            </p>
            <h2 id="add-products-title" className="font-display text-[28px] font-bold text-[#050505]">
              {accountT(t, "supplyLists.detail.addProducts", "Add Products")}
            </h2>
            <p className="mt-2 text-[14px] leading-6 text-[#8A8D9A]">
              {accountT(t, "supplyLists.detail.addProductsDescription", "Choose products to add to this reusable clinic list.")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#717182] transition hover:bg-[#050505]/[0.04] hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
            aria-label={accountT(t, "supplyLists.detail.closeAddProducts", "Close add products")}
          >
            <Plus size={18} className="rotate-45" />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto p-6 pt-5 sm:p-8 sm:pt-6">
          <label className="relative mb-4 block">
            <span className="sr-only">
              {accountT(t, "supplyLists.detail.addProductsSearchLabel", "Search products to add")}
            </span>
            <Search
              size={17}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8A8D9A]"
            />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={accountT(t, "supplyLists.detail.addProductsSearchPlaceholder", "Search products to add")}
              className="h-12 w-full rounded-full border border-[#050505]/10 bg-white px-4 pl-11 text-[14px] text-[#050505] outline-none transition placeholder:text-[#B3B4BD] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10"
            />
          </label>

          <div className="divide-y divide-[#050505]/[0.06] rounded-[18px] border border-[#050505]/[0.08]">
            {isSearching ? (
              <div className="p-8 text-center">
                <p className="text-[14px] font-bold text-[#050505]">{accountT(t, "common.loading", "Loading...")}</p>
              </div>
            ) : availableProducts.length > 0 ? (
              availableProducts.map((product) => (
                <div
                  key={product.id}
                  className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div>
                    <p className="text-[14px] font-bold text-[#050505]">{product.name}</p>
                    <p className="mt-1 text-[12px] leading-5 text-[#8A8D9A]">
                      {product.brand} . {product.category} . {formatCurrency(product.currentPrice)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => onAddProduct(product)}
                    variant="secondary"
                    size="sm"
                    className="h-10 gap-1 px-4 text-[13px] text-[var(--xd-gold-active)]"
                  >
                    <Plus size={15} />
                    {accountT(t, "common.add", "Add")}
                  </Button>
                </div>
              ))
            ) : (
              <div className="p-8 text-center">
                <p className="text-[14px] font-bold text-[#050505]">
                  {query.trim()
                    ? accountT(t, "supplyLists.detail.noSearchResults", "No products match your search.")
                    : accountT(t, "supplyLists.detail.allProductsAlreadyInList", "All matching products are already in this list.")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OptionModal({
  item,
  selectedOption,
  onChange,
  onClose,
  onApply,
}: {
  item: SupplyListDetailItem;
  selectedOption: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onApply: () => void;
}) {
  const { t } = useLanguage();
  useModalCloseBehavior(onClose);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[#050505]/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="select-options-title"
      onPointerDown={(event) => closeOnOverlayPointerDown(event, onClose)}
    >
      <div className="w-full max-w-[520px] rounded-[28px] border border-[var(--xd-gold-border-soft)] bg-white p-6 shadow-[0_24px_70px_rgba(5,5,5,0.18)] sm:p-8">
        <h2 id="select-options-title" className="font-display text-[26px] font-bold text-[#050505]">
          {accountT(t, "supplyLists.detail.selectOptions", "Select Options")}
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-[#8A8D9A]">{item.name}</p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {optionChoices.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={cn(
                "h-11 rounded-full border px-4 text-[13px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]",
                selectedOption === option
                  ? "xd-gradient-gold-border bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-text)]"
                  : "border-[#050505]/10 text-[#717182] hover:border-[var(--xd-gold-border)] hover:text-[#050505]"
              )}
            >
              {option}
            </button>
          ))}
        </div>

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-full px-5 text-[14px] font-bold text-[#717182] transition hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
          >
            {accountT(t, "common.cancel", "Cancel")}
          </button>
          <Button type="button" onClick={onApply} variant="primary" size="sm" className="h-11 px-6 text-[14px]">
            {accountT(t, "supplyLists.detail.applyOption", "Apply Option")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function QuoteModal({
  listName,
  productCount,
  subtotal,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  listName: string;
  productCount: number;
  subtotal: number;
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { t } = useLanguage();
  useModalCloseBehavior(onClose);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[#050505]/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quote-request-title"
      onPointerDown={(event) => closeOnOverlayPointerDown(event, onClose)}
    >
      <div className="w-full max-w-[520px] rounded-[28px] border border-[var(--xd-gold-border-soft)] bg-white p-6 shadow-[0_24px_70px_rgba(5,5,5,0.18)] sm:p-8">
        <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--xd-gold-active)]">
          {accountT(t, "dashboard.quickActionItems.requestQuote.title", "Request Quote")}
        </p>
        <h2 id="quote-request-title" className="font-display text-[28px] font-bold text-[#050505]">
          {listName}
        </h2>
        <div className="mt-5 space-y-3 rounded-[18px] border border-[#050505]/[0.08] bg-[var(--xd-bg)]/70 p-4">
          <SummaryRow label={accountT(t, "common.products", "Products")} value={productCount} />
          <SummaryRow label={accountT(t, "supplyLists.detail.estimatedSubtotal", "Estimated subtotal")} value={formatCurrency(subtotal)} />
        </div>
        <p className="mt-4 text-[13px] leading-6 text-[#8A8D9A]">
          {accountT(t, "supplyLists.detail.quoteRequestDescription", "Submitting this request sends the current list quantities and selected options to the quotes workflow.")}
        </p>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-[12px] border border-[#B42318]/20 bg-[#B42318]/[0.06] px-4 py-3 text-[13px] font-semibold text-[#B42318]"
          >
            {error}
          </p>
        )}

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-full px-5 text-[14px] font-bold text-[#717182] transition hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {accountT(t, "common.cancel", "Cancel")}
          </button>
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={onSubmit}
            variant="primary"
            size="sm"
            className="h-11 px-6 text-[14px]"
          >
            {isSubmitting
              ? t("quoteWorkflow.submitting")
              : accountT(t, "quotes.submitQuoteRequest", "Submit Quote Request")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmptyOrMissingList({ loading = false }: { loading?: boolean }) {
  const { t } = useLanguage();

  return (
    <div className="overflow-x-hidden bg-[var(--xd-bg)] pb-14 pt-10 lg:pb-20 lg:pt-14">
      <Container className="overflow-x-clip">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:gap-7">
          <AccountSidebar />
          <Card className="p-8 text-center">
            <h1 className="font-display text-[28px] font-bold text-[#050505]">
              {loading
                ? accountT(t, "common.loading", "Loading...")
                : accountT(
                    t,
                    "supplyLists.detail.notFoundTitle",
                    "Supply list not found"
                  )}
            </h1>
            <p className="mx-auto mt-2 max-w-[440px] text-[14px] leading-6 text-[#8A8D9A]">
              {loading
                ? accountT(
                    t,
                    "supplyLists.detail.loadingDescription",
                    "Loading your saved products and current availability."
                  )
                : accountT(
                    t,
                    "supplyLists.detail.notFoundDescription",
                    "The requested supply list may have been removed or renamed."
                  )}
            </p>
            {!loading && (
              <Button asChild variant="primary" size="sm" className="mt-6 h-11 px-6 text-[14px]">
                <Link href="/account/supply-lists">{accountT(t, "supplyLists.detail.backToSupplyLists", "Back to My Supply Lists")}</Link>
              </Button>
            )}
          </Card>
        </div>
      </Container>
    </div>
  );
}

export default function AccountSupplyListDetail() {
  const { id } = useParams();
  const { addToCart } = useStore();
  const { t } = useLanguage();
  const [list, setList] = useState<SupplyList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("all");
  const [items, setItems] = useState<SupplyListDetailItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isQuoteOpen, setIsQuoteOpen] = useState(false);
  const [isQuoteSubmitting, setIsQuoteSubmitting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [submittedQuoteId, setSubmittedQuoteId] = useState<string | null>(null);
  const [optionItemId, setOptionItemId] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState(optionChoices[0]);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  const showStatusMessage = (
    message: string | null,
    quoteId: string | null = null
  ) => {
    setStatusMessage(message);
    setSubmittedQuoteId(quoteId);
  };

  useClickOutside(actionsMenuRef, () => setIsActionsOpen(false), {
    enabled: isActionsOpen,
  });

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setList(null);
    setItems([]);
    setQuantities({});
    setSearch("");
    setAvailabilityFilter("all");
    setStatusMessage(null);
    setSubmittedQuoteId(null);
    if (!id) {
      setIsLoading(false);
      return () => controller.abort();
    }

    void fetchSupplyList(id, controller.signal)
      .then((savedList) => {
        if (controller.signal.aborted) return;
        setList(savedList);
        setItems(savedList?.detailItems ?? []);
        setQuantities(
          Object.fromEntries(
            (savedList?.detailItems ?? []).map((item) => [
              item.id,
              item.quantity,
            ])
          )
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setList(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [id]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesAvailability =
        availabilityFilter === "all" || item.availability === availabilityFilter;
      const matchesSearch =
        !query ||
        [item.name, item.brand, item.sku, item.category, item.details.join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(query);

      return matchesAvailability && matchesSearch;
    });
  }, [availabilityFilter, items, search]);

  if (isLoading) {
    return <EmptyOrMissingList loading />;
  }

  if (!list) {
    return <EmptyOrMissingList />;
  }

  const productCount = items.reduce(
    (total, item) => total + (quantities[item.id] ?? item.quantity),
    0
  );
  const availableCount = items
    .filter((item) => item.availability === "available")
    .reduce((total, item) => total + (quantities[item.id] ?? item.quantity), 0);
  const outOfStockCount = items
    .filter((item) => item.availability === "out-of-stock")
    .reduce((total, item) => total + (quantities[item.id] ?? item.quantity), 0);
  const needsOptionsCount = items
    .filter((item) => item.availability === "needs-options")
    .reduce((total, item) => total + (quantities[item.id] ?? item.quantity), 0);
  const estimatedTotal = items.reduce(
    (total, item) => total + item.unitPrice * (quantities[item.id] ?? item.quantity),
    0
  );
  const visibleSubtotal = filteredItems.reduce(
    (total, item) => total + item.unitPrice * (quantities[item.id] ?? item.quantity),
    0
  );
  const availableItems = items.filter((item) => item.availability === "available");
  const optionItem = items.find((item) => item.id === optionItemId) ?? null;

  const updateQuantity = (itemId: string, quantity: number) => {
    setQuantities((current) => ({ ...current, [itemId]: quantity }));
    showStatusMessage(null);
  };

  const removeItem = (itemId: string) => {
    setItems((current) => current.filter((item) => item.id !== itemId));
    setQuantities((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
    showStatusMessage(accountT(t, "supplyLists.detail.messages.productRemoved", "Product removed from this list."));
  };

  const addAvailableToCart = () => {
    if (availableItems.length === 0) {
      showStatusMessage(accountT(t, "supplyLists.detail.messages.noAvailableProducts", "No available products can be added to cart."));
      return;
    }

    const addedCount = availableItems.reduce((count, item) => {
      const result = addToCart(
        toCartProduct(item),
        quantities[item.id] ?? item.quantity,
        item.selectedOption
      );
      return count + (result.ok ? 1 : 0);
    }, 0);
    showStatusMessage(
      addedCount > 0
        ? accountT(
            t,
            "supplyLists.detail.messages.availableAddedToCart",
            "{count} available products added to cart.",
            { count: addedCount }
          )
        : accountT(
            t,
            "cart.maximumAlreadyInCart",
            "You already have the maximum available quantity in your cart."
          )
    );
  };

  const requestQuote = () => {
    showStatusMessage(null);
    setQuoteError(null);
    if (items.length === 0) {
      showStatusMessage(
        accountT(
          t,
          "supplyLists.detail.messages.quoteNeedsProducts",
          "Add at least one product before requesting a quote."
        )
      );
      return;
    }
    if (items.length > 50) {
      showStatusMessage(
        accountT(
          t,
          "supplyLists.detail.messages.quoteItemLimit",
          "A quote request can include up to 50 different products."
        )
      );
      return;
    }
    setIsQuoteOpen(true);
  };

  const submitQuoteRequest = async () => {
    if (isQuoteSubmitting || items.length === 0 || items.length > 50) return;
    setIsQuoteSubmitting(true);
    setQuoteError(null);
    showStatusMessage(null);
    try {
      const quote = await createQuote({
        notes: [
          `Supply list: ${list.name}`,
          `Clinic branch: ${list.branch}`,
          list.description ? `List notes: ${list.description}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        items: items.map((item) => ({
          productId: item.productId,
          productName: item.name,
          brand: item.brand,
          sku: item.sku,
          quantity: quantities[item.id] ?? item.quantity,
          selectedOptions: item.selectedOption,
        })),
      });
      const persistedQuote = await getMyQuote(quote.id);
      setIsQuoteOpen(false);
      showStatusMessage(
        t("quoteWorkflow.requestSubmitted", {
          values: { quoteNumber: persistedQuote.quoteNumber },
        }),
        persistedQuote.id
      );
    } catch (requestError) {
      setQuoteError(
        requestError instanceof Error
          ? requestError.message
          : t("quoteWorkflow.requestError")
      );
    } finally {
      setIsQuoteSubmitting(false);
    }
  };

  const saveChanges = async () => {
    if (!list || isSaving) return;
    setIsSaving(true);
    try {
      const savedList = await replaceSupplyListItems(
        list.id,
        items.map((item) => ({
          productId: item.productId,
          quantity: quantities[item.id] ?? item.quantity,
          selectedOptions: item.selectedOption,
        }))
      );
      setList(savedList);
      setItems(savedList.detailItems);
      setQuantities(
        Object.fromEntries(
          savedList.detailItems.map((item) => [item.id, item.quantity])
        )
      );
      showStatusMessage(
        accountT(
          t,
          "supplyLists.detail.messages.saved",
          "List changes saved."
        )
      );
    } catch {
      showStatusMessage(accountT(t, "supplyLists.detail.messages.unableToSave", "Unable to save this list."));
    } finally {
      setIsSaving(false);
    }
  };

  const resetList = () => {
    setItems(list.detailItems);
    setQuantities(Object.fromEntries(list.detailItems.map((item) => [item.id, item.quantity])));
    setSearch("");
    setAvailabilityFilter("all");
    showStatusMessage(accountT(t, "supplyLists.detail.messages.reset", "List reset to its saved version."));
  };

  const removeUnavailable = () => {
    const unavailableIds = new Set(
      items
        .filter((item) => item.availability === "out-of-stock" || item.availability === "needs-options")
        .map((item) => item.id)
    );

    if (unavailableIds.size === 0) {
      showStatusMessage(accountT(t, "supplyLists.detail.messages.noUnavailableProducts", "There are no unavailable products to remove."));
      return;
    }

    setItems((current) => current.filter((item) => !unavailableIds.has(item.id)));
    setQuantities((current) => {
      const next = { ...current };
      unavailableIds.forEach((itemId) => {
        delete next[itemId];
      });
      return next;
    });
    showStatusMessage(accountT(t, "supplyLists.detail.messages.unavailableRemoved", "{count} unavailable products removed.", { count: unavailableIds.size }));
  };

  const clearList = () => {
    setItems([]);
    setQuantities({});
    setSearch("");
    setAvailabilityFilter("all");
    showStatusMessage(accountT(t, "supplyLists.detail.messages.cleared", "All products removed from this list."));
  };

  const addProductFromCatalog = (product: Product) => {
    const itemId = `added-${product.id}-${Date.now()}`;
    const item: SupplyListDetailItem = {
      id: itemId,
      productId: product.id,
      name: product.name,
      brand: product.brand,
      sku: product.sku ?? `SKU-${product.id}`,
      details: [product.options?.[0] ? accountT(t, "supplyLists.detail.optionValue", "Option: {option}", { option: product.options[0] }) : product.category],
      unitPrice: product.currentPrice,
      quantity: 1,
      availability: product.stockStatus === "Out of Stock" ? "out-of-stock" : "available",
      selectedOption: product.options?.[0],
      category: product.category,
      image: product.image,
    };

    setItems((current) => [...current, item]);
    setQuantities((current) => ({ ...current, [itemId]: 1 }));
    showStatusMessage(accountT(t, "supplyLists.detail.messages.productAdded", "{name} added to this list.", { name: product.name }));
  };

  const openOptions = (itemId: string) => {
    const item = items.find((candidate) => candidate.id === itemId);
    setOptionItemId(itemId);
    setSelectedOption(item?.selectedOption ?? optionChoices[0]);
  };

  const applyOptions = () => {
    if (!optionItemId) return;

    setItems((current) =>
      current.map((item) => {
        if (item.id !== optionItemId) return item;

        return {
          ...item,
          availability: "available",
          selectedOption,
          details: item.details.map((detail) =>
            detail.toLowerCase().includes("shade") || detail.toLowerCase().includes("option")
              ? selectedOption
              : detail
          ),
        };
      })
    );
    setQuantities((current) => ({
      ...current,
      [optionItemId]: current[optionItemId] ?? 1,
    }));
    showStatusMessage(accountT(t, "supplyLists.detail.messages.optionsSelected", "Product options selected."));
    setOptionItemId(null);
  };

  return (
    <div className="overflow-x-hidden bg-[var(--xd-bg)] pb-14 pt-10 lg:pb-20 lg:pt-14">
      <Container className="overflow-x-clip">
        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:gap-7">
          <AccountSidebar />

          <main className="min-w-0 space-y-7">
            <Link
              href="/account/supply-lists"
              className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#8A8D9A] transition hover:text-[#050505]"
            >
              <DirectionalIcon direction="back" family="chevron" size={15} />
              {accountT(t, "supplyLists.detail.backToSupplyLists", "Back to My Supply Lists")}
            </Link>

            <Card className={cn("relative p-6 sm:p-7", isActionsOpen && "z-40")}>
              <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <h1 className="break-words font-display text-[28px] font-bold leading-tight text-[#050505] sm:text-[36px]">
                    {accountValue(t, list.name)}
                  </h1>
                  <p className="mt-3 max-w-[760px] text-[14px] leading-6 text-[#8A8D9A]">
                    {accountValue(t, list.description)}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-[12px] font-bold">
                    <span className="text-[#050505]">
                      {productCount} <span className="text-[#8A8D9A]">{accountT(t, "common.products", "products")}</span>
                    </span>
                    <span className="text-[#D8D8D8]">.</span>
                    <BranchPill branch={list.branch} />
                    <span className="text-[#D8D8D8]">.</span>
                    <span className="text-[#8A8D9A]">{updatedLabel(list.updatedDaysAgo, t)}</span>
                  </div>
                </div>

                <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row">
                  <Button
                    type="button"
                    onClick={addAvailableToCart}
                    variant="primary"
                    className="h-12 w-full gap-1.5 px-5 text-[14px] sm:w-auto"
                  >
                    <ShoppingCart size={16} />
                    {accountT(t, "wishlist.addAllToCart", "Add All to Cart")}
                  </Button>
                  <Button
                    type="button"
                    onClick={requestQuote}
                    variant="secondary"
                    className="h-12 w-full gap-1.5 px-5 text-[14px] text-[var(--xd-gold-active)] sm:w-auto"
                  >
                    <FileText size={16} />
                    {accountT(t, "dashboard.quickActionItems.requestQuote.title", "Request Quote")}
                  </Button>
                  <div className="relative" ref={actionsMenuRef}>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      onClick={() => setIsActionsOpen((current) => !current)}
                      className="h-12 w-12"
                      aria-label={accountT(t, "supplyLists.detail.openListActions", "Open list actions")}
                      aria-expanded={isActionsOpen}
                    >
                      <MoreVertical size={18} />
                    </Button>
                    {isActionsOpen && (
                      <ActionMenu
                        onClose={() => setIsActionsOpen(false)}
                        onReset={resetList}
                        onRemoveUnavailable={removeUnavailable}
                        onClearList={clearList}
                      />
                    )}
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label={accountT(t, "common.products", "Products")} value={productCount} />
              <MetricCard label={accountValue(t, "Available")} value={availableCount} tone="green" />
              <MetricCard label={accountValue(t, "Out of Stock")} value={outOfStockCount} tone="red" />
              <MetricCard label={accountT(t, "supplyLists.detail.estimatedTotal", "Estimated Total")} value={formatCurrency(estimatedTotal)} />
            </div>

            {statusMessage && (
              <div
                role="status"
                className="flex flex-col gap-3 rounded-[14px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-active)]/[0.08] px-4 py-3 text-[13px] font-semibold text-[#5F5F5F] sm:flex-row sm:items-center sm:justify-between"
              >
                <span>{statusMessage}</span>
                {submittedQuoteId && (
                  <Button
                    asChild
                    variant="secondary"
                    size="sm"
                    className="h-9 shrink-0 px-4 text-[12px] text-[#050505]"
                  >
                    <Link href={`/account/quotes/${submittedQuoteId}`}>
                      {t("quoteWorkflow.quoteDetails")}
                    </Link>
                  </Button>
                )}
              </div>
            )}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <Card className="p-5 sm:p-6">
                <div className="mb-5">
                  <h2 className="text-[19px] font-bold text-[#050505]">{accountT(t, "supplyLists.detail.productsInList", "Products in this list")}</h2>
                  <p className="mt-2 text-[13px] leading-6 text-[#8A8D9A]">
                    {accountT(t, "supplyLists.detail.productsInListDescription", "Adjust quantities before adding products to cart or requesting a quote.")}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,1fr)_160px_150px]">
                  <label className="relative col-span-2 block min-w-0 lg:col-span-1">
                    <span className="sr-only">{accountT(t, "supplyLists.detail.searchProductsLabel", "Search products in this list")}</span>
                    <Search
                      size={17}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8A8D9A]"
                    />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder={accountT(t, "supplyLists.detail.searchProductsPlaceholder", "Search products in this list")}
                      className="h-12 w-full rounded-full border border-[#050505]/10 bg-white px-4 pl-11 text-[14px] text-[#050505] outline-none transition placeholder:text-[#B3B4BD] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10"
                    />
                  </label>

                  <DentalSelect
                    label={accountT(t, "supplyLists.detail.availabilityFilterLabel", "Filter products by availability")}
                    value={availabilityFilter}
                    onChange={(value) => setAvailabilityFilter(value as AvailabilityFilter)}
                    options={getAvailabilityOptions(t)}
                    className="min-w-0"
                    triggerClassName="h-12 rounded-full px-3 text-[12px] sm:px-4 sm:text-[13px]"
                  />

                  <Button
                    type="button"
                    onClick={() => setIsAddProductOpen(true)}
                    variant="secondary"
                    className="h-12 min-w-0 gap-1.5 rounded-full px-3 text-[12px] text-[var(--xd-gold-active)] sm:px-4 sm:text-[13px] lg:w-full"
                  >
                    <Plus size={16} />
                    {accountT(t, "supplyLists.detail.addProducts", "Add Products")}
                  </Button>
                </div>

                <div className="mt-6 px-0 sm:px-4">
                  {filteredItems.length > 0 ? (
                    filteredItems.map((item) => (
                      <ProductRow
                        key={item.id}
                        item={item}
                        quantity={quantities[item.id] ?? item.quantity}
                        onQuantityChange={(quantity) => updateQuantity(item.id, quantity)}
                        onRemove={() => removeItem(item.id)}
                        onSelectOptions={() => openOptions(item.id)}
                      />
                    ))
                  ) : (
                    <div className="py-14 text-center">
                      <h3 className="text-[16px] font-bold text-[#050505]">{accountT(t, "supplyLists.detail.noProductsTitle", "No products found")}</h3>
                      <p className="mt-2 text-[13px] text-[#8A8D9A]">
                        {accountT(t, "supplyLists.detail.noProductsDescription", "Try changing the search term or availability filter.")}
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="h-fit p-6 xl:sticky xl:top-28">
                <h2 className="text-[17px] font-bold text-[#050505]">{accountT(t, "supplyLists.detail.listSummary", "List Summary")}</h2>

                <div className="mt-7 space-y-4">
                  <SummaryRow label={accountT(t, "common.products", "Products")} value={productCount} />
                  <SummaryRow label={accountValue(t, "Available")} value={availableCount} />
                  <SummaryRow label={accountValue(t, "Out of Stock")} value={outOfStockCount} />
                  <SummaryRow label={accountValue(t, "Need Options")} value={needsOptionsCount} />
                </div>

                <div className="my-6 h-px bg-[#050505]/[0.07]" />

                <div>
                  <p className="font-display text-[21px] font-bold text-[var(--xd-gold-active)]">
                    {formatCurrency(estimatedTotal)}
                  </p>
                  <p className="mt-2 text-[12px] font-bold text-[#8A8D9A]">{accountT(t, "supplyLists.detail.estimatedSubtotal", "Estimated Subtotal")}</p>
                  {visibleSubtotal !== estimatedTotal && (
                    <p className="mt-2 text-[11px] font-semibold text-[#B3B4BD]">
                      {accountT(t, "supplyLists.detail.visibleItems", "Visible items: {amount}", { amount: formatCurrency(visibleSubtotal) })}
                    </p>
                  )}
                </div>

                <div className="mt-6 space-y-3">
                  <Button
                    type="button"
                    onClick={addAvailableToCart}
                    variant="primary"
                    className="h-12 w-full px-5 text-[14px]"
                  >
                    {accountT(t, "supplyLists.detail.addAllAvailableToCart", "Add All Available to Cart")}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void saveChanges()}
                    disabled={isSaving}
                    variant="secondary"
                    className="h-12 w-full px-5 text-[14px] text-[var(--xd-gold-active)]"
                  >
                    {isSaving
                      ? accountT(t, "common.saving", "Saving...")
                      : accountT(t, "common.saveChanges", "Save Changes")}
                  </Button>
                </div>

                <button
                  type="button"
                  onClick={requestQuote}
                  className="mx-auto mt-7 block text-[12px] font-bold text-[var(--xd-gold-active)] underline decoration-[var(--xd-gold-active)]/50 underline-offset-2 transition hover:text-[#050505]"
                >
                  {accountT(t, "dashboard.quickActionItems.requestQuote.title", "Request Quote")}
                </button>
              </Card>
            </div>
          </main>
        </div>
      </Container>

      {isAddProductOpen && (
        <AddProductModal
          items={items}
          onClose={() => setIsAddProductOpen(false)}
          onAddProduct={addProductFromCatalog}
        />
      )}

      {optionItem && (
        <OptionModal
          item={optionItem}
          selectedOption={selectedOption}
          onChange={setSelectedOption}
          onClose={() => setOptionItemId(null)}
          onApply={applyOptions}
        />
      )}

      {isQuoteOpen && (
        <QuoteModal
          listName={list.name}
          productCount={productCount}
          subtotal={estimatedTotal}
          error={quoteError}
          isSubmitting={isQuoteSubmitting}
          onClose={() => {
            if (!isQuoteSubmitting) {
              setIsQuoteOpen(false);
              setQuoteError(null);
            }
          }}
          onSubmit={() => void submitQuoteRequest()}
        />
      )}
    </div>
  );
}
