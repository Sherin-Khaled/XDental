import { useEffect, useMemo, useState, type FormEvent, type PointerEvent } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  Check,
  ClipboardList,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { Button } from "@/components/dental/Button";
import { Container } from "@/components/dental/Container";
import { ProductCard } from "@/components/dental/ProductCard";
import { LowStockNotice, isLowStockProduct } from "@/components/dental/StockAvailability";
import { useStore } from "@/context/StoreContext";
import { fetchPublicProducts } from "@/services/catalog";
import { createQuote, getMyQuote } from "@/services/quotes";
import type { SupplyList } from "@/data/supplyLists";
import {
  createSupplyList,
  fetchSupplyLists,
  mergeSupplyListItems,
} from "@/services/supplyLists";
import type { CartItem, Product } from "@/types/product";
import { formatCurrency } from "@/utils";
import { cn } from "@/lib/utils";
import { SEO } from "@/components/SEO";
import { useLanguage } from "@/context/LanguageContext";
import { getLocalizedProductName } from "@/lib/catalogTranslations";
import { previewCoupon, type CouponPreview } from "@/services/coupons";
import { ApiError } from "@/services/http";
import {
  canIncreaseCartProduct,
  cartProductQuantity,
  getCartStockIssueForProduct,
  getCartStockIssues,
  getProductStockLimit,
  isProductPurchasable,
  type CartStockIssue,
} from "@/lib/cartStock";
import { useImageFallback } from "@/hooks/use-image-fallback";

const CART_IMAGE = `${import.meta.env.BASE_URL}toothtools.webp`;

function useModalCloseBehavior(onClose: () => void) {
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
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);
}

function closeOnOverlayPointerDown(event: PointerEvent<HTMLDivElement>, onClose: () => void) {
  if (event.target === event.currentTarget) {
    onClose();
  }
}

function CartImage({ image, name, className }: { image?: string; name: string; className?: string }) {
  const cartImage = useImageFallback(image, CART_IMAGE);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[14px] border border-[var(--xd-gold-border-soft)] bg-white",
        className
      )}
    >
      <img
        src={cartImage.src}
        onError={cartImage.onError}
        alt={name}
        width={2525}
        height={2582}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-contain p-2 mix-blend-multiply"
      />
    </div>
  );
}

function QuantityStepper({
  quantity,
  onChange,
  disableIncrease = false,
}: {
  quantity: number;
  onChange: (quantity: number) => void;
  disableIncrease?: boolean;
}) {
  const { t } = useLanguage();

  return (
    <div className="inline-flex h-9 items-center rounded-full border border-[#050505]/[0.08] bg-white/80 p-1 shadow-[0_6px_16px_rgba(5,5,5,0.03)]">
      <button
        type="button"
        onClick={() => onChange(quantity - 1)}
        className="flex h-7 w-7 items-center justify-center rounded-full text-[#8A8D9A] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
        aria-label={t("cart.decreaseQuantity")}
      >
        <Minus size={14} />
      </button>
      <span className="min-w-8 select-none text-center text-[13px] font-bold text-[#050505]">
        {quantity}
      </span>
      <button
        type="button"
        onClick={() => onChange(quantity + 1)}
        disabled={disableIncrease}
        className="flex h-7 w-7 items-center justify-center rounded-full text-[#8A8D9A] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:text-[#8A8D9A]"
        aria-label={t("cart.increaseQuantity")}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

function CartItemRow({
  item,
  stockIssue,
  disableIncrease,
  onUpdateQuantity,
  onAdjustToAvailable,
  onRemove,
}: {
  item: CartItem;
  stockIssue: CartStockIssue | null;
  disableIncrease: boolean;
  onUpdateQuantity: (quantity: number) => void;
  onAdjustToAvailable: () => void;
  onRemove: () => void;
}) {
  const { t, language } = useLanguage();
  const productName = getLocalizedProductName(item.product, language, t);
  const optionDetails = item.selectedOptions
    ? item.selectedOptions
    : item.product.options?.slice(0, 3).join(" - ");
  const itemSubtotal = item.product.currentPrice * item.quantity;
  const isLowStock = isLowStockProduct(item.product);
  const isOutOfStock = !isProductPurchasable(item.product);

  return (
    <article className="grid gap-4 border-b border-[#050505]/[0.07] py-8 first:pt-0 last:border-b-0 sm:grid-cols-[112px_minmax(0,1fr)_120px]">
      <CartImage image={item.product.image} name={productName} className="h-[112px] w-[112px]" />

      <div className="min-w-0">
        <h2 className="text-[18px] font-bold leading-6 text-[#050505]">{productName}</h2>
        <div className="mt-3 space-y-2 text-[13px] font-medium leading-5 text-[#8A8D9A]">
          <p>
            {t("common.brand")}: <span className="font-bold text-[#050505]">{item.product.brand}</span>
          </p>
          {optionDetails && <p>{optionDetails}</p>}
          {isLowStock ? (
            <LowStockNotice product={item.product} />
          ) : (
            <p className={cn(
              "inline-flex items-center gap-1.5 font-semibold",
              isOutOfStock ? "text-[#C0392B]" : "text-[var(--xd-gold-active)]"
            )}>
              <Check size={13} />
              {t(isOutOfStock ? "common.outOfStock" : "common.inStock")}
            </p>
          )}
        </div>

        <div className="mt-4">
          <QuantityStepper
            quantity={item.quantity}
            onChange={onUpdateQuantity}
            disableIncrease={disableIncrease}
          />
        </div>
        {stockIssue && (
          <div
            role="alert"
            className="mt-3 max-w-[480px] rounded-[12px] border border-[#D97706]/25 bg-[#D97706]/[0.07] px-3 py-2.5 text-[12px] font-semibold leading-5 text-[#8A4B08] dark:border-[#F9DC5C]/25 dark:bg-[#F9DC5C]/[0.07] dark:text-[#F6D85D]"
          >
            <p>
              {stockIssue.availableQuantity !== null
                ? t("cart.insufficientStockProduct", {
                    fallback: "Only {count} unit(s) of {name} are currently available.",
                    values: {
                      count: stockIssue.availableQuantity,
                      name: productName,
                    },
                  })
                : t("cart.availableQuantityChanged", {
                    fallback: "The available quantity changed. Update this item before checkout.",
                  })}
            </p>
            {stockIssue.availableQuantity !== null && stockIssue.availableQuantity > 0 && (
              <button
                type="button"
                onClick={onAdjustToAvailable}
                className="mt-1.5 font-bold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-focus-ring)]"
              >
                {t("cart.adjustToAvailable", {
                  fallback: "Adjust to available quantity",
                })}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-start justify-between gap-4 sm:flex-col sm:items-end">
        <button
          type="button"
          onClick={onRemove}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#050505]/[0.08] bg-white/80 text-[#8A8D9A] transition-colors hover:border-[#F44336]/25 hover:text-[#F44336] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F44336]/30 sm:order-none"
          aria-label={t("cart.remove", { values: { name: productName } })}
        >
          <Trash2 size={15} />
        </button>
        <div className="text-right sm:mt-auto">
          <p className="font-display text-[20px] font-bold text-[var(--xd-gold-active)]">
            {formatCurrency(item.product.currentPrice)}
          </p>
          {item.quantity > 1 && (
            <p className="mt-2 text-[12px] font-medium text-[#8A8D9A]">
              {t("common.subtotal")}: {formatCurrency(itemSubtotal)}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function EmptyCart({
  statusMessage,
  onRequestQuote,
}: {
  statusMessage?: string | null;
  onRequestQuote: () => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="min-h-[70vh] bg-[var(--xd-bg)] px-4 py-20">
      <SEO page="cart" />
      <Container>
        <div className="mx-auto flex max-w-[520px] flex-col items-center text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full border border-[var(--xd-gold-border-soft)] bg-white text-[var(--xd-gold-active)] shadow-[0_14px_36px_rgba(5,5,5,0.05)]">
            <ShoppingCart size={30} />
          </span>
          <h1 className="mt-6 font-display text-[34px] font-bold text-[#050505]">{t("cart.emptyTitle")}</h1>
          <p className="mt-3 text-[15px] leading-6 text-[#8A8D9A]">
            {t("cart.emptyBody")}
          </p>
          {statusMessage && (
            <div
              role="status"
              className="mt-6 rounded-[14px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-active)]/[0.08] px-4 py-3 text-[13px] font-semibold text-[#5F5F5F]"
            >
              {statusMessage}
            </div>
          )}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="px-8 text-[15px]">
              <Link href="/products">{t("common.continueShopping")}</Link>
            </Button>
            <Button
              type="button"
              onClick={onRequestQuote}
              variant="secondary"
              size="lg"
              className="px-8 text-[15px] text-[#050505]"
            >
              {t("common.requestQuote")}
            </Button>
          </div>
        </div>
      </Container>
    </div>
  );
}

type SaveCartMode = "existing" | "new";

function SaveCartSupplyListModal({
  lists,
  mode,
  selectedListId,
  newListName,
  newListDescription,
  newListBranch,
  onModeChange,
  onSelectedListChange,
  onNewListNameChange,
  onNewListDescriptionChange,
  onNewListBranchChange,
  onClose,
  onSubmit,
}: {
  lists: SupplyList[];
  mode: SaveCartMode;
  selectedListId: string;
  newListName: string;
  newListDescription: string;
  newListBranch: string;
  onModeChange: (mode: SaveCartMode) => void;
  onSelectedListChange: (listId: string) => void;
  onNewListNameChange: (name: string) => void;
  onNewListDescriptionChange: (description: string) => void;
  onNewListBranchChange: (branch: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useLanguage();
  const availableLists = lists.filter((list) => list.status !== "Archived");
  const hasExistingLists = availableLists.length > 0;
  useModalCloseBehavior(onClose);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[#050505]/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-cart-supply-list-title"
      onPointerDown={(event) => closeOnOverlayPointerDown(event, onClose)}
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-[560px] rounded-[28px] border border-[var(--xd-gold-border-soft)] bg-white p-6 shadow-[0_24px_70px_rgba(5,5,5,0.18)] sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--xd-gold-active)]">
              {t("cart.saveListEyebrow", { fallback: "Supply Lists" })}
            </p>
            <h2 id="save-cart-supply-list-title" className="font-display text-[28px] font-bold text-[#050505]">
              {t("cart.saveListModalTitle", { fallback: "Save Cart as Supply List" })}
            </h2>
            <p className="mt-2 text-[14px] leading-6 text-[#8A8D9A]">
              {t("cart.saveListModalBody", {
                fallback: "Choose an existing list or create a new one. Current cart products will be added by default.",
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#717182] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
            aria-label={t("common.close", { fallback: "Close" })}
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-full bg-[var(--xd-bg)] p-1">
          <button
            type="button"
            disabled={!hasExistingLists}
            onClick={() => onModeChange("existing")}
            className={cn(
              "h-10 rounded-full text-[13px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)] disabled:cursor-not-allowed disabled:opacity-50",
              mode === "existing" ? "bg-white text-[#050505] shadow-[0_8px_18px_rgba(5,5,5,0.05)]" : "text-[#717182]"
            )}
          >
            {t("cart.saveListExisting", { fallback: "Existing list" })}
          </button>
          <button
            type="button"
            onClick={() => onModeChange("new")}
            className={cn(
              "h-10 rounded-full text-[13px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]",
              mode === "new" ? "bg-white text-[#050505] shadow-[0_8px_18px_rgba(5,5,5,0.05)]" : "text-[#717182]"
            )}
          >
            {t("cart.saveListNew", { fallback: "New list" })}
          </button>
        </div>

        {mode === "existing" && hasExistingLists ? (
          <label className="mt-5 block">
            <span className="mb-2 block text-[13px] font-bold text-[#050505]">
              {t("cart.saveListChooseExisting", { fallback: "Choose supply list" })}
            </span>
            <select
              value={selectedListId}
              onChange={(event) => onSelectedListChange(event.target.value)}
              className="h-12 w-full rounded-[12px] border border-[#050505]/10 bg-white px-4 text-[14px] font-semibold text-[#050505] outline-none transition focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10"
            >
              {availableLists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-2 block text-[13px] font-bold text-[#050505]">
                {t("cart.saveListName", { fallback: "List name" })}
              </span>
              <input
                required
                value={newListName}
                onChange={(event) => onNewListNameChange(event.target.value)}
                placeholder={t("cart.saveListNamePlaceholder", { fallback: "Cart Supply List" })}
                className="h-12 w-full rounded-[12px] border border-[#050505]/10 bg-white px-4 text-[14px] text-[#050505] outline-none transition placeholder:text-[#B3B4BD] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-[13px] font-bold text-[#050505]">
                {t("common.branch", { fallback: "Branch" })}
              </span>
              <select
                value={newListBranch}
                onChange={(event) => onNewListBranchChange(event.target.value)}
                className="h-12 w-full rounded-[12px] border border-[#050505]/10 bg-white px-4 text-[14px] font-semibold text-[#050505] outline-none transition focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10"
              >
                <option value="Main Clinic">{t("accountPages.values.branches.mainClinic", { fallback: "Main Clinic" })}</option>
                <option value="General">{t("accountPages.values.branches.general", { fallback: "General" })}</option>
                <option value="Nasr City Branch">{t("accountPages.values.branches.nasrCityBranch", { fallback: "Nasr City Branch" })}</option>
                <option value="Dokki Branch">{t("accountPages.values.branches.dokkiBranch", { fallback: "Dokki Branch" })}</option>
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-2 block text-[13px] font-bold text-[#050505]">
                {t("common.description", { fallback: "Description" })}
              </span>
              <textarea
                value={newListDescription}
                onChange={(event) => onNewListDescriptionChange(event.target.value)}
                placeholder={t("cart.saveListDescriptionPlaceholder", { fallback: "Saved from cart." })}
                className="min-h-[92px] w-full resize-none rounded-[14px] border border-[#050505]/10 bg-white px-4 py-3 text-[14px] text-[#050505] outline-none transition placeholder:text-[#B3B4BD] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10"
              />
            </label>
          </div>
        )}

        <div className="mt-5 flex items-start gap-3 rounded-[16px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-active)]/[0.06] px-4 py-3 text-[13px] font-semibold leading-5 text-[#5F5F5F]">
          <ClipboardList size={17} className="mt-0.5 shrink-0 text-[var(--xd-gold-active)]" />
          <span>{t("cart.saveListProductsDefault", { fallback: "Products in your current cart will be added to this supply list." })}</span>
        </div>

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-full px-5 text-[14px] font-bold text-[#717182] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
          >
            {t("common.cancel", { fallback: "Cancel" })}
          </button>
          <Button type="submit" variant="primary" size="sm" className="h-11 px-6 text-[14px]">
            {t("cart.saveListSubmit", { fallback: "Save Cart" })}
          </Button>
        </div>
      </form>
    </div>
  );
}

const RECOMMENDATION_LIMIT = 4;

export default function Cart() {
  const [recommendationCandidates, setRecommendationCandidates] = useState<Product[]>([]);
  const {
    cart,
    updateQuantity,
    removeFromCart,
    cartTotal,
    cartCount,
    isAuthenticated,
  } = useStore();
  const { t, language } = useLanguage();
  const [, navigate] = useLocation();
  const search = useSearch();
  const [couponCode, setCouponCode] = useState("");
  const [couponNotice, setCouponNotice] = useState<string | null>(null);
  const [couponPreview, setCouponPreview] = useState<CouponPreview | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [submittedQuoteId, setSubmittedQuoteId] = useState<string | null>(null);
  const [isQuoteSubmitting, setIsQuoteSubmitting] = useState(false);
  const [isSaveListModalOpen, setIsSaveListModalOpen] = useState(false);
  const [supplyLists, setSupplyLists] = useState<SupplyList[]>([]);
  const [isSavingSupplyList, setIsSavingSupplyList] = useState(false);
  const [saveListMode, setSaveListMode] = useState<SaveCartMode>("existing");
  const [selectedSupplyListId, setSelectedSupplyListId] = useState("");
  const [newSupplyListName, setNewSupplyListName] = useState("");
  const [newSupplyListDescription, setNewSupplyListDescription] = useState("");
  const [newSupplyListBranch, setNewSupplyListBranch] = useState("Main Clinic");
  const [savedSupplyList, setSavedSupplyList] = useState<SupplyList | null>(null);
  const checkoutState = new URLSearchParams(search).get("checkout");
  const checkoutNotice =
    checkoutState === "empty"
      ? t("cart.checkoutEmpty")
      : checkoutState === "unavailable"
        ? t("cart.checkoutUnavailable")
        : checkoutState === "stock"
          ? t("cart.availableQuantityChanged", {
              fallback: "The available quantity changed. Update this item before checkout.",
            })
        : null;
  const visibleStatusMessage = statusMessage ?? checkoutNotice;
  const shipping = cartTotal > 0 ? 50 : 0;
  const monetaryDiscount = couponPreview?.totals.discount ?? 0;
  const monetaryDiscountLabel = couponPreview?.totals.winningMonetarySource
    ? language === "ar"
      ? couponPreview.totals.winningMonetarySource.titleAr
      : couponPreview.totals.winningMonetarySource.titleEn
    : t("common.discount", { fallback: "Discount" });
  const displayedShipping = couponPreview?.totals.shipping ?? shipping;
  const total = couponPreview?.totals.total ?? cartTotal + shipping;
  const recommendations = useMemo(
    () =>
      recommendationCandidates
        .filter((product) => !cart.some((item) => item.product.id === product.id))
        .slice(0, RECOMMENDATION_LIMIT),
    [cart, recommendationCandidates]
  );
  const stockIssues = getCartStockIssues(cart);
  const hasStockIssues = stockIssues.length > 0;

  useEffect(() => {
    setCouponPreview(null);
    setCouponNotice(null);
  }, [cart]);

  useEffect(() => {
    const controller = new AbortController();
    fetchPublicProducts({
      featured: true,
      limit: RECOMMENDATION_LIMIT + cart.length,
      signal: controller.signal,
    })
      .then(({ products }) => {
        if (!controller.signal.aborted) setRecommendationCandidates(products);
      })
      .catch(() => {});
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplyCoupon = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = couponCode.trim().toUpperCase();
    if (!code) {
      setCouponPreview(null);
      setCouponNotice(t("cart.couponEmpty"));
      return;
    }
    setIsApplyingCoupon(true);
    setCouponNotice(null);
    try {
      const result = await previewCoupon(
        code,
        cart.map((item) => ({
          productId: item.product.id,
          sku: item.product.sku ?? undefined,
          slug: item.product.slug ?? undefined,
          selectedOptions: item.selectedOptions ?? undefined,
          quantity: item.quantity,
        }))
      );
      setCouponCode(result.coupon.code);
      setCouponPreview(result);
      const normalizedCode = result.coupon.code.trim().toUpperCase();
      const couponIsApplied =
        result.totals.appliedCoupon?.code.trim().toUpperCase() === normalizedCode
        || result.totals.appliedBenefits.some((benefit) => benefit.type === "PROMO_CODE");
      setCouponNotice(
        t(couponIsApplied ? "cart.couponApplied" : "cart.couponValidStrongerPromotion", {
          values: { code: result.coupon.code },
        })
      );
    } catch (error) {
      setCouponPreview(null);
      setCouponNotice(error instanceof ApiError ? error.message : t("cart.couponInvalid"));
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleRequestQuote = async () => {
    setSavedSupplyList(null);
    setSubmittedQuoteId(null);

    if (cart.length === 0) {
      setStatusMessage(t("cart.quoteEmpty"));
      return;
    }

    if (!isAuthenticated) {
      navigate("/signin?redirect=/cart");
      return;
    }

    setIsQuoteSubmitting(true);
    setStatusMessage(null);
    try {
      const quote = await createQuote({
        items: cart.map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          brand: item.product.brand,
          sku: item.product.sku ?? undefined,
          quantity: item.quantity,
          selectedOptions: item.selectedOptions ?? undefined,
          requestedPrice: item.product.currentPrice,
        })),
      });
      await getMyQuote(quote.id);
      setSubmittedQuoteId(quote.id);
      setStatusMessage(t("quoteWorkflow.requestSubmitted", { values: { quoteNumber: quote.quoteNumber } }));
    } catch (requestError) {
      setStatusMessage(requestError instanceof Error ? requestError.message : t("quoteWorkflow.requestError"));
    } finally {
      setIsQuoteSubmitting(false);
    }
  };

  const openSaveListModal = async () => {
    if (!isAuthenticated) {
      navigate("/signin?redirect=/cart");
      return;
    }
    if (isSavingSupplyList) return;
    setIsSavingSupplyList(true);
    setStatusMessage(null);
    try {
      const currentLists = await fetchSupplyLists();
      const availableLists = currentLists.filter(
        (list) => list.status !== "Archived"
      );
      setSupplyLists(currentLists);
      setSelectedSupplyListId(availableLists[0]?.id ?? "");
      setSaveListMode(availableLists.length > 0 ? "existing" : "new");
      setNewSupplyListName(
        t("cart.saveListNamePlaceholder", {
          fallback: "Cart Supply List",
        })
      );
      setNewSupplyListDescription("");
      setNewSupplyListBranch("Main Clinic");
      setSavedSupplyList(null);
      setSubmittedQuoteId(null);
      setIsSaveListModalOpen(true);
    } catch {
      setStatusMessage(
        t("cart.saveListError", {
          fallback: "Unable to load your supply lists. Please try again.",
        })
      );
    } finally {
      setIsSavingSupplyList(false);
    }
  };

  const handleSaveCartToList = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSavingSupplyList) return;
    const itemInputs = cart.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
      selectedOptions:
        item.selectedOptions ?? item.product.options?.[0] ?? null,
    }));
    setIsSavingSupplyList(true);
    try {
      let savedList: SupplyList;
      if (saveListMode === "existing") {
        if (!selectedSupplyListId) return;
        savedList = await mergeSupplyListItems(
          selectedSupplyListId,
          itemInputs
        );
        setSupplyLists((current) =>
          current.map((list) =>
            list.id === savedList.id ? savedList : list
          )
        );
      } else {
        const trimmedName = newSupplyListName.trim();
        if (!trimmedName) return;
        savedList = await createSupplyList({
          name: trimmedName,
          branch: newSupplyListBranch,
          description:
            newSupplyListDescription.trim() ||
            t("cart.saveListDescriptionDefault", {
              fallback: "Saved from cart.",
            }),
          items: itemInputs,
        });
        setSupplyLists((current) => [savedList, ...current]);
      }

      setSavedSupplyList(savedList);
      setSubmittedQuoteId(null);
      setStatusMessage(
        t("cart.savedToSupplyList", {
          fallback: "Cart saved to {name}.",
          values: { name: savedList.name },
        })
      );
      setIsSaveListModalOpen(false);
    } catch (error) {
      setStatusMessage(
        error instanceof ApiError
          ? error.message
          : t("cart.saveListError", {
              fallback: "Unable to save this supply list. Please try again.",
            })
      );
    } finally {
      setIsSavingSupplyList(false);
    }
  };

  if (cart.length === 0) {
    return <EmptyCart statusMessage={visibleStatusMessage} onRequestQuote={handleRequestQuote} />;
  }

  return (
    <div className="bg-[var(--xd-bg)] pb-16 pt-10 lg:pb-20 lg:pt-16">
      <SEO page="cart" />
      <Container>
        <div className="mb-10">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 rounded-full text-[13px] font-bold text-[#8A8D9A] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
          >
            <DirectionalIcon direction="back" size={15} />
            {t("common.continueShopping")}
          </Link>
          <h1 className="mt-5 font-display text-[38px] font-bold leading-none text-[#050505] sm:text-[48px]">
            {t("cart.title")}
          </h1>
          <p className="mt-4 max-w-[680px] text-[15px] leading-6 text-[#8A8D9A]">
            {t("cart.intro")}
          </p>
        </div>

        {visibleStatusMessage && (
          <div className="mb-6 flex flex-col gap-3 rounded-[16px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-active)]/[0.08] px-4 py-3 text-[13px] font-semibold text-[#5F5F5F] sm:flex-row sm:items-center sm:justify-between">
            <span>{visibleStatusMessage}</span>
            {savedSupplyList && (
              <Button asChild variant="secondary" size="sm" className="h-9 px-4 text-[12px] text-[#050505]">
                <Link href={`/account/supply-lists/${savedSupplyList.id}`}>
                  {t("cart.viewList", { fallback: "View list" })}
                </Link>
              </Button>
            )}
            {submittedQuoteId && (
              <Button asChild variant="secondary" size="sm" className="h-9 px-4 text-[12px] text-[#050505]">
                <Link href="/account/quotes">
                  {t("cart.viewQuotes")}
                </Link>
              </Button>
            )}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] xl:gap-10">
          <div className="min-w-0">
            <div className="rounded-[24px] bg-transparent">
              {cart.map((item, index) => (
                (() => {
                  const stockIssue =
                    getCartStockIssueForProduct(cart, item.product.id) ??
                    item.stockIssue ??
                    null;
                  const stockLimit = getProductStockLimit(item.product);
                  const productTotal = cartProductQuantity(cart, item.product.id);
                  const otherLineQuantity = productTotal - item.quantity;
                  const adjustToAvailable = () => {
                    const safeLineQuantity = Math.max(
                      0,
                      (stockLimit ?? 0) - otherLineQuantity
                    );
                    updateQuantity(
                      item.product.id,
                      safeLineQuantity,
                      item.selectedOptions
                    );
                  };
                  return (
                    <CartItemRow
                      key={`${item.product.id}-${item.selectedOptions ?? index}`}
                      item={item}
                      stockIssue={stockIssue}
                      disableIncrease={!canIncreaseCartProduct(cart, item.product)}
                      onUpdateQuantity={(quantity) => {
                        if (
                          stockIssue &&
                          quantity < item.quantity &&
                          stockLimit !== null
                        ) {
                          const safeLineQuantity = Math.max(
                            0,
                            Math.min(quantity, stockLimit - otherLineQuantity)
                          );
                          updateQuantity(
                            item.product.id,
                            safeLineQuantity,
                            item.selectedOptions
                          );
                          return;
                        }
                        updateQuantity(
                          item.product.id,
                          quantity,
                          item.selectedOptions
                        );
                      }}
                      onAdjustToAvailable={adjustToAvailable}
                      onRemove={() =>
                        removeFromCart(item.product.id, item.selectedOptions)
                      }
                    />
                  );
                })()
              ))}
            </div>

            <form
              onSubmit={handleApplyCoupon}
              className="mt-6 rounded-[20px] border border-[var(--xd-gold-border-soft)] bg-white/80 p-5 shadow-[0_12px_32px_rgba(5,5,5,0.035)]"
            >
              <label htmlFor="coupon-code" className="text-[15px] font-bold text-[#050505]">
                {t("cart.coupon")}
              </label>
              <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_92px]">
                <input
                  id="coupon-code"
                  value={couponCode}
                  onChange={(event) => {
                    setCouponCode(event.target.value);
                    setCouponPreview(null);
                    setCouponNotice(null);
                  }}
                  placeholder={t("cart.couponPlaceholder")}
                  className="h-12 rounded-[12px] border border-[#050505]/10 bg-white px-4 text-[14px] text-[#050505] outline-none transition placeholder:text-[#B3B4BD] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10"
                />
                <Button type="submit" disabled={isApplyingCoupon} className="h-12 px-6 text-[14px]">
                  {isApplyingCoupon ? t("common.loading", { fallback: "Checking..." }) : t("common.apply")}
                </Button>
              </div>
              {couponNotice && (
                <p role="status" className="mt-3 text-[13px] font-semibold text-[#8A6A1F]">
                  {couponNotice}
                </p>
              )}
            </form>

            <div className="mt-5 flex flex-col gap-4 rounded-[20px] border border-[var(--xd-gold-border-soft)] bg-white/80 p-5 shadow-[0_12px_32px_rgba(5,5,5,0.035)] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-[15px] font-bold text-[#050505]">{t("cart.saveListTitle")}</h2>
                <p className="mt-3 text-[13px] leading-5 text-[#8A8D9A]">
                  {t("cart.saveListBody")}
                </p>
              </div>
              <Button
                type="button"
                onClick={() => void openSaveListModal()}
                disabled={isSavingSupplyList}
                variant="secondary"
                size="sm"
                className="h-11 shrink-0 px-5 text-[13px] text-[#050505]"
              >
                {t("cart.saveAsList")}
              </Button>
            </div>
          </div>

          <aside className="min-w-0">
            <div className="sticky top-28 rounded-[24px] border border-[var(--xd-gold-border-soft)] bg-white/85 p-6 shadow-[0_18px_44px_rgba(5,5,5,0.06)]">
              <h2 className="font-display text-[22px] font-bold text-[#050505]">{t("cart.summary")}</h2>
              <dl className="mt-6 space-y-4 text-[14px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-[#8A8D9A]">{t("cart.itemsCount", { values: { count: cartCount } })}</dt>
                  <dd className="font-bold text-[#050505]">{formatCurrency(cartTotal)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#8A8D9A]">{t("common.shipping")}</dt>
                  <dd className="font-bold text-[#050505]">{formatCurrency(displayedShipping)}</dd>
                </div>
                {monetaryDiscount > 0 && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--xd-gold-text)]">{monetaryDiscountLabel}</dt>
                    <dd className="font-bold text-[var(--xd-gold-text)]">-{formatCurrency(monetaryDiscount)}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="text-[#8A8D9A]">{t("common.subtotal")}</dt>
                  <dd className="font-bold text-[#050505]">{formatCurrency(cartTotal)}</dd>
                </div>
              </dl>

              <div className="mt-6 border-t border-[#050505]/[0.07] pt-5">
                <div className="flex items-end justify-between gap-4">
                  <span className="text-[17px] font-bold text-[#050505]">{t("common.total")}</span>
                  <span className="font-display text-[25px] font-bold text-[var(--xd-gold-active)]">
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>

              <div className="mt-7 space-y-3">
                {hasStockIssues ? (
                  <Button disabled size="lg" className="h-12 w-full text-[14px]">
                    {t("cart.proceedCheckout")}
                  </Button>
                ) : (
                  <Button asChild size="lg" className="h-12 w-full text-[14px]">
                    <Link href={couponPreview ? `/checkout?coupon=${encodeURIComponent(couponPreview.coupon.code)}` : "/checkout"}>
                      {t("cart.proceedCheckout")}
                    </Link>
                  </Button>
                )}
                {hasStockIssues && (
                  <p className="text-center text-[12px] font-semibold leading-5 text-[#B45309] dark:text-[#F6D85D]">
                    {t("cart.availableQuantityChanged", {
                      fallback: "The available quantity changed. Update this item before checkout.",
                    })}
                  </p>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  className="h-12 w-full text-[14px] text-[#050505]"
                  onClick={() => void handleRequestQuote()}
                  disabled={isQuoteSubmitting}
                >
                  {isQuoteSubmitting ? t("quoteWorkflow.submitting") : t("common.requestQuote")}
                </Button>
              </div>

              <p className="mt-6 text-center text-[12px] leading-5 text-[#8A8D9A]">
                {t("cart.taxNote")}
              </p>
            </div>
          </aside>
        </div>

        <section className="mt-16">
          <h2 className="font-display text-[30px] font-bold leading-tight text-[#050505]">
            {t("cart.recommendedTitle")}
          </h2>
          <p className="mt-3 text-[14px] leading-6 text-[#8A8D9A]">
            {t("cart.recommendedBody")}
          </p>

          <div className="mt-8 grid gap-5 overflow-visible px-1 pb-6 pt-2 sm:grid-cols-2 lg:grid-cols-4">
            {recommendations.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      </Container>

      {isSaveListModalOpen && (
        <SaveCartSupplyListModal
          lists={supplyLists}
          mode={saveListMode}
          selectedListId={selectedSupplyListId}
          newListName={newSupplyListName}
          newListDescription={newSupplyListDescription}
          newListBranch={newSupplyListBranch}
          onModeChange={setSaveListMode}
          onSelectedListChange={setSelectedSupplyListId}
          onNewListNameChange={setNewSupplyListName}
          onNewListDescriptionChange={setNewSupplyListDescription}
          onNewListBranchChange={setNewSupplyListBranch}
          onClose={() => setIsSaveListModalOpen(false)}
          onSubmit={handleSaveCartToList}
        />
      )}
    </div>
  );
}
