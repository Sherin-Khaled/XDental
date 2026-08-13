import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Check, ShieldCheck, Package } from "lucide-react";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { Button } from "@/components/dental/Button";
import { Container } from "@/components/dental/Container";
import { LowStockNotice } from "@/components/dental/StockAvailability";
import { useStore } from "@/context/StoreContext";
import type { CartItem } from "@/types/product";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils";
import { DentalSelect } from "@/components/dental/Select";
import { Money } from "@/components/dental/Money";
import { SEO } from "@/components/SEO";
import { useLanguage } from "@/context/LanguageContext";
import { getLocalizedProductName } from "@/lib/catalogTranslations";
import { ApiError } from "@/services/http";
import { getCartStockIssues } from "@/lib/cartStock";
import { useImageFallback } from "@/hooks/use-image-fallback";
import {
  createOrder,
  previewOrderTotals,
  type CreateOrderInput,
  type TrustedOrderTotals,
} from "@/services/orders";
import {
  applyEmptyCheckoutContactFields,
  buildCheckoutContactAutofill,
  isValidEgyptianMobilePhone,
  shouldApplyCheckoutContactAutofill,
  shouldResetCheckoutForAccount,
} from "@/lib/checkoutAutofill";
import {
  clearCheckoutAttempt,
  completeCheckoutAttemptOnce,
  fingerprintCheckoutAttempt,
  invalidateChangedCheckoutAttempt,
  resolveCheckoutAttempt,
  runSingleCheckoutSubmission,
} from "@/lib/checkoutIdempotency";

const CHECKOUT_IMAGE = `${import.meta.env.BASE_URL}toothtools.webp`;

const inputClassName =
  "h-12 w-full rounded-[12px] border border-[#050505]/10 bg-white px-4 text-[14px] font-medium text-[#050505] outline-none transition placeholder:text-[#B3B4BD] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-bg-soft)] disabled:bg-[#F3F2ED] disabled:text-[#5F5F5F]";

const invalidInputClassName =
  "border-[#F44336]/60 focus:border-[#F44336] focus:ring-[#F44336]/10";

const textAreaClassName =
  "min-h-[92px] w-full resize-none rounded-[12px] border border-[#050505]/10 bg-white px-4 py-3 text-[14px] font-medium text-[#050505] outline-none transition placeholder:text-[#9FA1AC] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-bg-soft)]";

type CheckoutStepId = "delivery" | "payment" | "review";
type ShippingMethodId = "standard" | "fast" | "pickup";
type PaymentMethodId = "cash";

const checkoutSteps: { id: CheckoutStepId; number: number; labelKey: string }[] = [
  { id: "delivery", number: 1, labelKey: "checkout.steps.delivery" },
  { id: "payment", number: 2, labelKey: "checkout.steps.payment" },
  { id: "review", number: 3, labelKey: "checkout.steps.review" },
];

const shippingMethods: {
  id: ShippingMethodId;
  titleKey: string;
  descriptionKey: string;
  priceKey: string;
  amount: number;
}[] = [
    {
      id: "standard",
      titleKey: "checkout.shippingMethods.standard.title",
      descriptionKey: "checkout.shippingMethods.standard.description",
      priceKey: "checkout.shippingMethods.standard.price",
      amount: 50,
    },
    {
      id: "fast",
      titleKey: "checkout.shippingMethods.fast.title",
      descriptionKey: "checkout.shippingMethods.fast.description",
      priceKey: "checkout.shippingMethods.fast.price",
      amount: 80,
    },
    {
      id: "pickup",
      titleKey: "checkout.shippingMethods.pickup.title",
      descriptionKey: "checkout.shippingMethods.pickup.description",
      priceKey: "checkout.shippingMethods.pickup.price",
      amount: 0,
    },
  ];

const paymentMethods: {
  id: PaymentMethodId;
  titleKey: string;
  shortKey: string;
}[] = [
    { id: "cash", titleKey: "checkout.paymentMethods.cash.title", shortKey: "checkout.paymentMethods.cash.short" },
  ];

function FormCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[22px] border border-[var(--xd-gold-border-soft)] bg-white/86 p-5 shadow-[0_14px_34px_rgba(5,5,5,0.035)] sm:p-6">
      <h2 className="text-[18px] font-bold leading-tight text-[#050505]">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Field({
  id,
  label,
  required,
  note,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  note?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="block text-[13px] font-bold text-[#050505]">
        {label}
        {required && <span className="ml-1 text-[var(--xd-gold-active)]">*</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[12px] font-semibold leading-5 text-[#F44336]">
          {error}
        </p>
      )}
      {note && <p className="text-[12px] font-medium leading-5 text-[#8A8D9A]">{note}</p>}
    </div>
  );
}

function Stepper({ currentStep }: { currentStep: CheckoutStepId }) {
  const { t } = useLanguage();
  const currentStepIndex = checkoutSteps.findIndex((step) => step.id === currentStep);

  return (
    <div className="flex flex-wrap items-center gap-3 sm:gap-4">
      {checkoutSteps.map((step, index) => {
        const isComplete = index < currentStepIndex;
        const isActive = step.id === currentStep;

        return (
          <div key={step.id} className="flex items-center gap-3">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold",
                  isActive || isComplete
                    ? "xd-gradient-gold text-[#050505]"
                    : "bg-[#050505]/[0.08] text-[#8A8D9A]"
                )}
              >
                {isComplete ? <Check size={16} /> : step.number}
              </span>
              <span
                className={cn(
                  "text-[13px] font-bold",
                  isActive || isComplete ? "text-[#050505]" : "text-[#8A8D9A]"
                )}
              >
                {t(step.labelKey)}
              </span>
            </div>
            {index < checkoutSteps.length - 1 && (
              <DirectionalIcon direction="forward" family="chevron" size={16} className="text-[#8A8D9A]" aria-hidden="true" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function CheckoutImage({ image, name }: { image?: string; name: string }) {
  const checkoutImage = useImageFallback(image, CHECKOUT_IMAGE);

  return (
    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[10px] border border-[var(--xd-gold-border-soft)] bg-white">
      <img
        src={checkoutImage.src}
        onError={checkoutImage.onError}
        alt={name}
        width={2525}
        height={2582}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-contain p-1.5 mix-blend-multiply"
      />
    </div>
  );
}

function OrderSummary({
  items,
  subtotal,
  shipping,
  discount,
  total,
  pricing,
}: {
  items: CartItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  pricing: TrustedOrderTotals | null;
}) {
  const { t, language } = useLanguage();
  const monetaryLabel = pricing?.winningMonetarySource
    ? language === "ar"
      ? pricing.winningMonetarySource.titleAr
      : pricing.winningMonetarySource.titleEn
    : t("common.discount", { fallback: "Discount" });
  const freeShippingLabel = pricing?.freeShippingSource
    ? language === "ar"
      ? pricing.freeShippingSource.titleAr
      : pricing.freeShippingSource.titleEn
    : null;
  const vipShippingLabel = pricing?.vipShippingSource
    ? language === "ar"
      ? pricing.vipShippingSource.titleAr
      : pricing.vipShippingSource.titleEn
    : null;

  return (
    <aside className="min-w-0">
      <div className="sticky top-28 rounded-[24px] border border-[var(--xd-gold-border-soft)] bg-white/88 p-6 shadow-[0_18px_44px_rgba(5,5,5,0.06)]">
        <h2 className="font-display text-[22px] font-bold leading-tight text-[#050505]">
          {t("cart.summary")}
        </h2>

        <div className="mt-7 space-y-4">
          {items.map((item, index) => (
            (() => {
              const productName = getLocalizedProductName(item.product, language, t);

              return (
                <div
                  key={`${item.product.id}-${item.selectedOptions ?? index}`}
                  className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3"
                >
                  <CheckoutImage image={item.product.image} name={productName} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-[#050505]">{productName}</p>
                    <p className="mt-1 text-[12px] font-semibold text-[#8A8D9A]">{t("common.quantity")}: {item.quantity}</p>
                    <LowStockNotice product={item.product} className="mt-1.5" />
                  </div>
                  <p className="text-[13px] font-bold text-[var(--xd-gold-active)]">
                    <Money amount={item.product.currentPrice * item.quantity} />
                  </p>
                </div>
              );
            })()
          ))}
        </div>

        <div className="mt-6 border-t border-[#050505]/[0.07] pt-5">
          <dl className="space-y-4 text-[14px]">
            {pricing && pricing.productPromotionSavings > 0 && (
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[#8A8D9A]">{t("checkout.originalProductsSubtotal", { fallback: "Original products subtotal" })}</dt>
                <dd className="font-bold text-[#050505]"><Money amount={pricing.originalSubtotal} /></dd>
              </div>
            )}
            {pricing && pricing.productPromotionSavings > 0 && (
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[var(--xd-gold-text)]">{t("checkout.productPromotionSavings", { fallback: "Product / Flash savings" })}</dt>
                <dd className="font-bold text-[var(--xd-gold-text)]">−<Money amount={pricing.productPromotionSavings} /></dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[#8A8D9A]">{t("checkout.itemsSubtotal")}</dt>
              <dd className="font-bold text-[#050505]"><Money amount={subtotal} /></dd>
            </div>
            {pricing && pricing.shippingDiscount > 0 && (
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[#8A8D9A]">{t("checkout.shippingBeforeDiscount", { fallback: "Shipping before discount" })}</dt>
                <dd className="font-bold text-[#050505]"><Money amount={pricing.shippingBeforeDiscount} /></dd>
              </div>
            )}
            {pricing && pricing.deliveryOfferDiscount > 0 && (
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[var(--xd-gold-text)]">{t("checkout.deliveryOfferDiscount", { fallback: "Delivery Offer discount" })}</dt>
                <dd className="font-bold text-[var(--xd-gold-text)]">−<Money amount={pricing.deliveryOfferDiscount} /></dd>
              </div>
            )}
            {pricing && pricing.vipShippingDiscount > 0 && (
              <div className="flex items-center justify-between gap-4">
                <dt className="min-w-0 text-[var(--xd-gold-text)]">
                  {vipShippingLabel || t("checkout.vipShippingDiscount", { fallback: "VIP delivery saving" })}
                </dt>
                <dd className="shrink-0 font-bold text-[var(--xd-gold-text)]">−<Money amount={pricing.vipShippingDiscount} /></dd>
              </div>
            )}
            {freeShippingLabel && pricing && pricing.shippingDiscount > pricing.deliveryOfferDiscount + pricing.vipShippingDiscount && (
              <div className="flex items-center justify-between gap-4">
                <dt className="min-w-0 text-[var(--xd-gold-text)]">{freeShippingLabel}</dt>
                <dd className="shrink-0 font-bold text-[var(--xd-gold-text)]">{t("checkout.freeShippingApplied", { fallback: "Free shipping" })}</dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[#8A8D9A]">{t("checkout.finalShipping", { fallback: "Final shipping" })}</dt>
              <dd className="font-bold text-[#050505]"><Money amount={shipping} /></dd>
            </div>
            {discount > 0 && (
              <div className="flex items-center justify-between gap-4">
                <dt className="min-w-0 text-[var(--xd-gold-text)]">{monetaryLabel}</dt>
                <dd className="font-bold text-[var(--xd-gold-text)]">−<Money amount={discount} /></dd>
              </div>
            )}
            {pricing && pricing.pointsRedeemed > 0 && (
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[var(--xd-gold-text)]">
                  {t("checkout.rewards.pointsRedeemed", { fallback: "Points redeemed" })}
                  <span className="ms-1 text-[11px] text-[#8A8D9A]">
                    ({pricing.pointsRedeemed.toLocaleString("en-US")})
                  </span>
                </dt>
                <dd className="font-bold text-[var(--xd-gold-text)]">
                  −<Money amount={pricing.pointsRedemptionValue} />
                </dd>
              </div>
            )}
            {pricing && pricing.walletCreditUsed > 0 && (
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[var(--xd-gold-text)]">
                  {t("checkout.rewards.walletUsed", { fallback: "Wallet credit used" })}
                </dt>
                <dd className="font-bold text-[var(--xd-gold-text)]">
                  −<Money amount={pricing.walletCreditUsed} />
                </dd>
              </div>
            )}
            {pricing && pricing.totalSavings > 0 && (
              <div className="flex items-center justify-between gap-4 border-t border-[#050505]/[0.06] pt-4">
                <dt className="font-semibold text-[#8A8D9A]">{t("checkout.totalSavings", { fallback: "Total savings" })}</dt>
                <dd className="font-bold text-[var(--xd-gold-text)]"><Money amount={pricing.totalSavings} /></dd>
              </div>
            )}
          </dl>
        </div>

        <div className="mt-6 border-t border-[#050505]/[0.07] pt-5">
          <div className="flex items-end justify-between gap-4">
            <span className="text-[17px] font-bold text-[#050505]">{t("common.total")}</span>
            <span className="font-display text-[26px] font-bold text-[var(--xd-gold-active)]">
              <Money amount={total} />
            </span>
          </div>
          {pricing && (
            <div className="mt-3 flex items-center justify-between gap-4 rounded-[12px] bg-[var(--xd-gold-bg-soft)] px-3 py-2.5">
              <span className="text-[13px] font-bold text-[#5F5F5F] dark:text-[#D6D0C3]">
                {t("checkout.rewards.remainingCod", { fallback: "Remaining Cash on Delivery" })}
              </span>
              <span className="font-display text-[18px] font-bold text-[#050505] dark:text-[#F7F2E6]">
                <Money amount={pricing.remainingCodAmount} />
              </span>
            </div>
          )}
        </div>

        <div className="mt-7 flex items-start justify-center gap-2 rounded-[14px] bg-[var(--xd-bg)] px-4 py-3 text-center text-[12px] font-medium leading-5 text-[#8A8D9A]">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[var(--xd-gold-active)]" />
          <p>{t("checkout.secureNote")}</p>
        </div>
      </div>
    </aside>
  );
}

function SelectableOption({
  selected,
  invalid,
  title,
  description,
  price,
  onClick,
}: {
  selected: boolean;
  invalid?: boolean;
  title: string;
  description: string;
  price?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-4 rounded-[14px] border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]",
        selected
          ? "xd-gradient-gold-border bg-[var(--xd-gold-active)]/[0.08]"
          : invalid
            ? "border-[#F44336]/45 bg-[#F44336]/[0.025] hover:border-[#F44336]/65"
          : "border-[#050505]/[0.08] bg-white hover:border-[var(--xd-gold-border-hover)] hover:bg-[var(--xd-gold-active)]/[0.04]"
      )}
    >
      <span className="min-w-0">
        <span className="block text-[15px] font-bold text-[#050505]">{title}</span>
        <span className="mt-2 block text-[12px] font-medium leading-5 text-[#8A8D9A]">
          {description}
        </span>
      </span>
      {price && (
        <span className="shrink-0 text-[16px] font-bold text-[var(--xd-gold-active)]">{price}</span>
      )}
    </button>
  );
}

function PaymentRadioCard({
  id,
  title,
  short,
  selected,
  invalid,
  onSelect,
  icon: Icon,
  logoSrc,
}: {
  id: PaymentMethodId;
  title: string;
  short?: string;
  selected: boolean;
  invalid?: boolean;
  onSelect: () => void;
  icon?: any;
  logoSrc?: string | string[];
}) {
  return (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onSelect();
        }
      }}
      onClick={onSelect}
      className={cn(
        "checkout-payment-method inline-flex h-12 max-w-max items-center gap-2 rounded-full border px-4 text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border-hover)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--xd-surface)]",
        selected
          ? "checkout-payment-method--selected xd-gradient-gold-border bg-[rgba(249,220,92,0.10)] text-[#050505] dark:bg-[#1F1F1B] dark:text-[#F5F1E7] dark:hover:bg-[#25231D]"
          : invalid
            ? "border-[#F44336]/45 bg-white/55 hover:border-[#F44336]/65 hover:bg-[#F44336]/[0.025]"
          : "border-[#050505]/[0.08] bg-white/55 hover:border-[var(--xd-gold-border)] hover:bg-[var(--xd-gold)]/[0.05]"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "checkout-payment-method__indicator flex h-4 w-4 items-center justify-center rounded-full border",
          selected
            ? "border-[var(--xd-gold-active)] bg-[var(--xd-surface)] dark:border-[#F2D24B]"
            : "border-[#050505]/[0.12] bg-[var(--xd-surface)]"
        )}
      >
        {selected ? <span className="h-2 w-2 rounded-full bg-[var(--xd-gold)]" /> : null}
      </span>

      <div className="flex items-center gap-2">
        <div
          className={cn(
            "checkout-payment-method__icon flex flex-shrink-0 items-center justify-center",
            selected && "dark:text-[#F2D24B]"
          )}
          style={{ width: 40, height: 24 }}
        >
          {logoSrc ? (
            Array.isArray(logoSrc) ? (
              <div className="flex items-center gap-1">
                {logoSrc.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`${title} logo ${i + 1}`}
                    className="max-h-[22px] max-w-full object-contain"
                  />
                ))}
              </div>
            ) : (
              <img src={logoSrc} alt={`${title} logo`} className="max-h-[22px] max-w-full object-contain" />
            )
          ) : Icon ? (
            <Icon size={20} />
          ) : (
            <Package size={20} />
          )}
        </div>
        <span className="checkout-payment-method__label whitespace-nowrap">{title}</span>
      </div>
    </div>
  );
}

function ReviewCard({
  title,
  children,
  onEdit,
}: {
  title: string;
  children: ReactNode;
  onEdit?: () => void;
}) {
  const { t } = useLanguage();

  return (
    <section className="rounded-[22px] border border-[var(--xd-gold-border-soft)] bg-white/86 p-5 shadow-[0_14px_34px_rgba(5,5,5,0.035)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-[18px] font-bold leading-tight text-[#050505]">{title}</h2>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="rounded-full text-[13px] font-bold text-[var(--xd-gold-active)] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
          >
            {t("common.edit")}
          </button>
        )}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ReviewItemRow({ item }: { item: CartItem }) {
  const { t, language } = useLanguage();
  const productName = getLocalizedProductName(item.product, language, t);
  const optionDetails =
    item.selectedOptions || item.product.options?.join(" - ") || "Pack: 1 pcs";

  return (
    <article className="grid gap-4 border-b border-[#050505]/[0.07] py-5 first:pt-0 last:border-b-0 last:pb-0 sm:grid-cols-[76px_minmax(0,1fr)_auto]">
      <CheckoutImage image={item.product.image} name={productName} />
      <div className="min-w-0">
        <h3 className="text-[16px] font-bold leading-6 text-[#050505]">{productName}</h3>
        <div className="mt-2 space-y-1 text-[13px] font-semibold leading-5 text-[#8A8D9A]">
          <p>
            {t("common.brand")}: <span className="text-[#717182]">{item.product.brand}</span>
          </p>
          <p>{optionDetails}</p>
          <p>{t("common.quantity")}: {item.quantity}</p>
        </div>
        <LowStockNotice
          product={item.product}
          showAvailabilityNote
          className="mt-2.5"
        />
      </div>
      <p className="self-start font-display text-[18px] font-bold text-[var(--xd-gold-active)] sm:text-right">
        <Money amount={item.product.currentPrice * item.quantity} />
      </p>
    </article>
  );
}

const initialFormState = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  country: "Egypt",
  governorate: "",
  cityArea: "",
  streetAddress: "",
  buildingNumber: "",
  apartmentFloor: "",
  postalCode: "",
  deliveryNotes: "",
  clinicName: "",
  clinicBranch: "",
};

type CheckoutFormState = typeof initialFormState;
type CheckoutFormField = keyof CheckoutFormState;

type DeliveryFieldId =
  | "firstName"
  | "lastName"
  | "phone"
  | "email"
  | "governorate"
  | "cityArea"
  | "streetAddress"
  | "buildingNumber"
  | "apartmentFloor";

type PaymentFieldId =
  | "shippingMethod"
  | "paymentMethod";

const deliveryFieldOrder: DeliveryFieldId[] = [
  "firstName",
  "lastName",
  "phone",
  "email",
  "governorate",
  "cityArea",
  "streetAddress",
  "buildingNumber",
  "apartmentFloor",
];

const paymentFieldOrder: PaymentFieldId[] = [
  "shippingMethod",
  "paymentMethod",
];

function scrollToCheckoutTop() {
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  });
}

function focusCheckoutField(id: string) {
  window.requestAnimationFrame(() => {
    const field = document.getElementById(id);
    if (!field) return;
    field.focus({ preventScroll: true });
    field.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

export default function Checkout() {
  const {
    cart,
    cartTotal,
    clearCart,
    currentUser,
    isAuthenticated,
    isAuthLoading,
    waitForCartSync,
  } = useStore();
  const { t, language } = useLanguage();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const promoCode = new URLSearchParams(search).get("coupon")?.trim().toUpperCase() || undefined;
  const checkoutPath = promoCode ? `/checkout?coupon=${encodeURIComponent(promoCode)}` : "/checkout";
  const [currentStep, setCurrentStep] = useState<CheckoutStepId>("delivery");
  const [form, setForm] = useState(initialFormState);
  const [sendUpdates, setSendUpdates] = useState(true);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethodId | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>("cash");
  const [selectedClinicLocationId, setSelectedClinicLocationId] = useState<string>("");
  const [requestedPoints, setRequestedPoints] = useState(0);
  const [requestedWalletAmount, setRequestedWalletAmount] = useState("0");
  const [deliveryErrors, setDeliveryErrors] = useState<Partial<Record<DeliveryFieldId, string>>>({});
  const [paymentErrors, setPaymentErrors] = useState<Partial<Record<PaymentFieldId, string>>>({});
  const [orderNotes, setOrderNotes] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [trustedTotals, setTrustedTotals] = useState<TrustedOrderTotals | null>(null);
  const hasCompletedOrder = useRef(false);
  const activeSubmission = useRef<Promise<void> | null>(null);
  const editedCheckoutFields = useRef<Set<CheckoutFormField>>(new Set());
  const autofilledUserId = useRef<string | null>(null);
  const previousCheckoutUserId = useRef<string | null | undefined>(undefined);
  const checkoutItems = cart;
  const cartStockIssues = useMemo(() => getCartStockIssues(cart), [cart]);
  const subtotal = cartTotal;
  const selectedShippingMethod =
    shippingMethods.find((method) => method.id === shippingMethod);
  const selectedPaymentMethod =
    paymentMethods.find((method) => method.id === paymentMethod);
  const shipping = subtotal > 0 ? selectedShippingMethod?.amount ?? 0 : 0;
  const checkoutOrderInput = useMemo<CreateOrderInput>(
    () => ({
      customerName: `${form.firstName} ${form.lastName}`.trim(),
      customerEmail: form.email,
      customerPhone: form.phone,
      country: form.country,
      governorate: form.governorate,
      cityArea: form.cityArea,
      streetAddress: form.streetAddress,
      buildingNumber: form.buildingNumber,
      apartmentFloor: form.apartmentFloor,
      postalCode: form.postalCode,
      deliveryNotes: form.deliveryNotes,
      clinicName: form.clinicName,
      clinicBranch: form.clinicBranch,
      orderNotes,
      deliveryMethod: shippingMethod ?? "",
      paymentMethod,
      promoCode,
      requestedPoints,
      requestedWalletAmount,
      clinicLocationId: selectedClinicLocationId || null,
      items: cart.map((item) => ({
        productId: item.product.id,
        sku: item.product.sku ?? undefined,
        slug: item.product.slug ?? undefined,
        selectedOptions: item.selectedOptions ?? undefined,
        quantity: item.quantity,
      })),
    }),
    [cart, form, orderNotes, paymentMethod, promoCode, requestedPoints, requestedWalletAmount, selectedClinicLocationId, shippingMethod]
  );
  const checkoutFingerprint = useMemo(
    () => fingerprintCheckoutAttempt(checkoutOrderInput),
    [checkoutOrderInput]
  );

  useEffect(() => {
    const activeUserId =
      isAuthenticated && currentUser ? currentUser.id : null;
    const previousUserId = previousCheckoutUserId.current;

    if (isAuthLoading && previousUserId === undefined && !activeUserId) {
      return;
    }

    const accountChanged = shouldResetCheckoutForAccount(
      previousUserId,
      activeUserId
    );
    previousCheckoutUserId.current = activeUserId;

    if (!activeUserId || !currentUser) {
      if (accountChanged) {
        editedCheckoutFields.current.clear();
        setForm({ ...initialFormState });
        setCurrentStep("delivery");
        setDeliveryErrors({});
        setPaymentErrors({});
        setOrderNotes("");
        setStatusMessage(null);
        setSendUpdates(true);
        setShippingMethod(null);
        setPaymentMethod("cash");
        setSelectedClinicLocationId("");
        setRequestedPoints(0);
        setRequestedWalletAmount("0");
      }
      autofilledUserId.current = null;
      return;
    }

    if (
      !shouldApplyCheckoutContactAutofill(
        autofilledUserId.current,
        activeUserId,
        accountChanged
      )
    ) {
      return;
    }

    const contactAutofill = buildCheckoutContactAutofill(currentUser);

    if (accountChanged) {
      editedCheckoutFields.current.clear();
      setForm(
        applyEmptyCheckoutContactFields(
          { ...initialFormState },
          contactAutofill,
          editedCheckoutFields.current
        )
      );
      setCurrentStep("delivery");
      setDeliveryErrors({});
      setPaymentErrors({});
      setOrderNotes("");
      setStatusMessage(null);
      setSendUpdates(true);
      setShippingMethod(null);
      setPaymentMethod("cash");
      setSelectedClinicLocationId("");
      setRequestedPoints(0);
      setRequestedWalletAmount("0");
    } else {
      setForm((current) =>
        applyEmptyCheckoutContactFields(
          current,
          contactAutofill,
          editedCheckoutFields.current
        )
      );
    }

    autofilledUserId.current = activeUserId;
  }, [currentUser, isAuthenticated, isAuthLoading]);

  useEffect(() => {
    if (isAuthLoading || hasCompletedOrder.current) return;
    if (!isAuthenticated) {
      setLocation(`/signin?redirect=${encodeURIComponent(checkoutPath)}`, { replace: true });
      return;
    }
    if (cart.length === 0) {
      setLocation("/cart?checkout=empty", { replace: true });
    }
  }, [cart.length, checkoutPath, isAuthenticated, isAuthLoading, setLocation]);

  useEffect(() => {
    if (
      isAuthLoading ||
      hasCompletedOrder.current ||
      cart.length === 0 ||
      cartStockIssues.length === 0
    ) {
      return;
    }
    setStatusMessage(
      t("cart.availableQuantityChanged", {
        fallback: "The available quantity changed. Update this item before checkout.",
      })
    );
    setLocation("/cart?checkout=stock", { replace: true });
  }, [cart.length, cartStockIssues.length, isAuthLoading, setLocation, t]);

  useEffect(() => {
    if (!isAuthenticated || !currentUser || isSubmitting || hasCompletedOrder.current) return;
    try {
      invalidateChangedCheckoutAttempt(
        window.sessionStorage,
        currentUser.id,
        checkoutFingerprint
      );
    } catch {
      // Storage availability is checked again before submission so checkout
      // can show a safe, localized error without sending an unprotected retry.
    }
  }, [checkoutFingerprint, currentUser, isAuthenticated, isSubmitting]);

  useEffect(() => {
    if (!isAuthenticated || !shippingMethod || cart.length === 0) {
      setTrustedTotals(null);
      return;
    }
    const controller = new AbortController();
    previewOrderTotals(
      {
        deliveryMethod: shippingMethod,
        items: cart.map((item) => ({
          productId: item.product.id,
          sku: item.product.sku ?? undefined,
          slug: item.product.slug ?? undefined,
          selectedOptions: item.selectedOptions ?? undefined,
          quantity: item.quantity,
        })),
        promoCode,
        requestedPoints,
        requestedWalletAmount,
        clinicLocationId: selectedClinicLocationId || null,
      },
      controller.signal
    )
      .then((totals) => {
        setTrustedTotals(totals);
        if (requestedPoints > 0 || Number(requestedWalletAmount) > 0) {
          setStatusMessage(null);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setTrustedTotals(null);
          if (
            error instanceof ApiError &&
            (error.code === "INSUFFICIENT_STOCK" ||
              error.code === "PRODUCT_UNAVAILABLE")
          ) {
            setStatusMessage(
              t("cart.availableQuantityChanged", {
                fallback: "The available quantity changed. Update this item before checkout.",
              })
            );
            setLocation("/cart?checkout=stock", { replace: true });
            return;
          }
          if (promoCode || requestedPoints > 0 || Number(requestedWalletAmount) > 0) {
            setStatusMessage(
              error instanceof ApiError ? error.message : t("cart.couponInvalid")
            );
          }
        }
      });
    return () => controller.abort();
  }, [cart, isAuthenticated, promoCode, requestedPoints, requestedWalletAmount, selectedClinicLocationId, shippingMethod, t]);

  const displayedSubtotal = trustedTotals?.subtotal ?? subtotal;
  const displayedShipping = trustedTotals?.shipping ?? shipping;
  const displayedDiscount = trustedTotals?.discount ?? 0;
  const total = trustedTotals?.total ?? subtotal + shipping;

  const addressLines = [
    form.buildingNumber,
    form.streetAddress,
    form.cityArea,
    form.governorate,
  ].filter(Boolean);

  const validateDeliveryFields = () => {
    const errors: Partial<Record<DeliveryFieldId, string>> = {};
    const requiredFields: Array<[DeliveryFieldId, string]> = [
      ["firstName", "checkout.validation.firstNameRequired"],
      ["lastName", "checkout.validation.lastNameRequired"],
      ["phone", "checkout.validation.phoneRequired"],
      ["email", "checkout.validation.emailRequired"],
      ["governorate", "checkout.validation.governorateRequired"],
      ["cityArea", "checkout.validation.cityAreaRequired"],
      ["streetAddress", "checkout.validation.streetAddressRequired"],
      ["buildingNumber", "checkout.validation.buildingNumberRequired"],
      ["apartmentFloor", "checkout.validation.apartmentFloorRequired"],
    ];

    requiredFields.forEach(([field, messageKey]) => {
      if (!form[field].trim()) errors[field] = t(messageKey);
    });

    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = t("checkout.validation.emailInvalid");
    }
    if (form.phone.trim() && !isValidEgyptianMobilePhone(form.phone)) {
      errors.phone = t("checkout.validation.phoneInvalid");
    }

    return errors;
  };

  const validatePaymentFields = () => {
    const errors: Partial<Record<PaymentFieldId, string>> = {};

    if (!shippingMethod) {
      errors.shippingMethod = t("checkout.validation.shippingMethodRequired");
    }
    if (!paymentMethod) {
      errors.paymentMethod = t("checkout.validation.paymentMethodRequired");
    }

    return errors;
  };

  const showValidationErrors = (
    errors: Partial<Record<DeliveryFieldId | PaymentFieldId, string>>,
    fieldOrder: Array<DeliveryFieldId | PaymentFieldId>,
    step: CheckoutStepId
  ) => {
    const firstInvalidField = fieldOrder.find((field) => errors[field]);
    if (!firstInvalidField) return false;

    setCurrentStep(step);
    setStatusMessage(
      t("checkout.completeRequiredFields")
    );
    focusCheckoutField(
      firstInvalidField === "shippingMethod"
        ? "shipping-methods"
        : firstInvalidField === "paymentMethod"
          ? "payment-methods"
          : firstInvalidField
    );
    return true;
  };

  const clearDeliveryError = (field: DeliveryFieldId) => {
    setDeliveryErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const clearPaymentError = (field: PaymentFieldId) => {
    setPaymentErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handleFieldChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    editedCheckoutFields.current.add(name as CheckoutFormField);
    setForm((current) => ({ ...current, [name]: value }));
    if (deliveryFieldOrder.includes(name as DeliveryFieldId)) {
      clearDeliveryError(name as DeliveryFieldId);
    }
  };

  const selectShippingMethod = (method: ShippingMethodId) => {
    setShippingMethod(method);
    clearPaymentError("shippingMethod");
  };

  const selectPaymentMethod = (method: PaymentMethodId) => {
    setPaymentMethod(method);
    setPaymentErrors((current) => {
      const next = { ...current };
      delete next.paymentMethod;
      return next;
    });
  };

  const showStep = (step: CheckoutStepId) => {
    setStatusMessage(null);
    setCurrentStep(step);
    scrollToCheckoutTop();
  };

  const handleDeliverySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validateDeliveryFields();
    setDeliveryErrors(errors);
    if (showValidationErrors(errors, deliveryFieldOrder, "delivery")) return;
    showStep("payment");
  };

  const handlePaymentSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validatePaymentFields();
    setPaymentErrors(errors);
    if (showValidationErrors(errors, paymentFieldOrder, "payment")) return;
    showStep("review");
  };

  const handlePlaceOrder = () => {
    if (activeSubmission.current) return activeSubmission.current;
    if (isAuthLoading || isSubmitting) return;
    if (!isAuthenticated) {
      setLocation(`/signin?redirect=${encodeURIComponent(checkoutPath)}`);
      return;
    }
    const nextDeliveryErrors = validateDeliveryFields();
    setDeliveryErrors(nextDeliveryErrors);
    if (showValidationErrors(nextDeliveryErrors, deliveryFieldOrder, "delivery")) return;

    const nextPaymentErrors = validatePaymentFields();
    setPaymentErrors(nextPaymentErrors);
    if (showValidationErrors(nextPaymentErrors, paymentFieldOrder, "payment")) return;

    if (!shippingMethod || !paymentMethod) {
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);
    return runSingleCheckoutSubmission(activeSubmission, async () => {
      let attemptKey: string | undefined;
      try {
        await waitForCartSync();
        if (!currentUser) {
          setLocation(`/signin?redirect=${encodeURIComponent(checkoutPath)}`);
          return;
        }
        const attempt = resolveCheckoutAttempt(
          window.sessionStorage,
          currentUser.id,
          checkoutFingerprint
        );
        attemptKey = attempt.idempotencyKey;
        if (!trustedTotals?.pricingQuoteToken) {
          setStatusMessage(t("checkout.pricingReviewUnavailable", { fallback: "Reviewing the latest price. Please try again in a moment." }));
          return;
        }
        const { order } = await createOrder(
          { ...checkoutOrderInput, pricingQuoteToken: trustedTotals.pricingQuoteToken },
          attempt.idempotencyKey
        );

        completeCheckoutAttemptOnce(hasCompletedOrder, () => {
          try {
            clearCheckoutAttempt(window.sessionStorage, currentUser.id, attempt.idempotencyKey);
          } catch {
            // The order is already confirmed by the server, so local storage
            // cleanup must never block cart cleanup or confirmation routing.
          }
          clearCart();
          setLocation(`/order-confirmed?orderId=${encodeURIComponent(order.id)}`, { replace: true });
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          setLocation(`/signin?redirect=${encodeURIComponent(checkoutPath)}`);
          return;
        }
        if (
          error instanceof ApiError &&
          (error.code === "INSUFFICIENT_STOCK" ||
            error.code === "PRODUCT_UNAVAILABLE")
        ) {
          setStatusMessage(
            t("cart.availableQuantityChanged", {
              fallback: "The available quantity changed. Update this item before checkout.",
            })
          );
          setLocation("/cart?checkout=stock", { replace: true });
          return;
        }
        if (
          error instanceof ApiError &&
          error.code === "PRICE_CHANGED_REVIEW_REQUIRED" &&
          currentUser
        ) {
          const refreshedTotals = (error.payload as { totals?: TrustedOrderTotals } | undefined)?.totals;
          if (refreshedTotals?.pricingQuoteToken) {
            setTrustedTotals(refreshedTotals);
          }
          try {
            clearCheckoutAttempt(window.sessionStorage, currentUser.id, attemptKey);
          } catch {
            // A new logical attempt is still created when secure storage is available.
          }
          setStatusMessage(t("checkout.priceChangedReview", { fallback: "Pricing changed. Review the updated totals, then press Place Order again." }));
          return;
        }
        if (
          error instanceof ApiError &&
          error.code === "IDEMPOTENCY_KEY_REUSED" &&
          currentUser
        ) {
          try {
            clearCheckoutAttempt(window.sessionStorage, currentUser.id, attemptKey);
          } catch {
            // The server rejected the reused key; no order data is changed by
            // a storage cleanup failure.
          }
          setStatusMessage(t("checkout.idempotencyConflict"));
          return;
        }
        if (
          error instanceof ApiError &&
          (error.code === "IDEMPOTENCY_KEY_REQUIRED" ||
            error.code === "INVALID_IDEMPOTENCY_KEY")
        ) {
          setStatusMessage(t("checkout.idempotencyUnavailable"));
          return;
        }
        if (error instanceof ApiError && error.status === 0) {
          setStatusMessage(t("checkout.networkResultUnknown"));
          return;
        }
        setStatusMessage(
          error instanceof ApiError ? error.message : t("checkout.idempotencyUnavailable")
        );
      } finally {
        if (!hasCompletedOrder.current) setIsSubmitting(false);
      }
    });
  };

  const getDeliveryInputProps = (field: DeliveryFieldId) => ({
    "aria-describedby": deliveryErrors[field] ? `${field}-error` : undefined,
    "aria-invalid": Boolean(deliveryErrors[field]),
    className: cn(inputClassName, deliveryErrors[field] && invalidInputClassName),
  });

  if (cart.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[var(--xd-bg)] px-5 text-center">
        <p role="status" className="text-[14px] font-semibold text-[#717182]">
          {t("checkout.redirectingToCart")}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--xd-bg)] pb-16 pt-10 lg:pb-20 lg:pt-16">
      <SEO page="checkout" />
      <Container>
        <header className="mb-8 lg:mb-10">
          <h1 className="font-display text-[40px] font-bold leading-none text-[#050505] sm:text-[48px]">
            {t("checkout.title")}
          </h1>
          <p className="mt-4 max-w-[700px] text-[15px] leading-6 text-[#8A8D9A]">
            {t("checkout.intro")}
          </p>
          <div className="mt-7">
            <Stepper currentStep={currentStep} />
          </div>
        </header>

        {statusMessage && (
          <div role="status" aria-live="polite" className="mb-6 rounded-[16px] border border-[var(--xd-gold-active)]/24 bg-[var(--xd-gold-active)]/[0.08] px-4 py-3 text-[13px] font-semibold text-[#5F5F5F]">
            {statusMessage}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-10">
          {currentStep === "delivery" && (
            <form
              onSubmit={handleDeliverySubmit}
              noValidate
              className="min-w-0 space-y-5"
            >
              <FormCard title={t("checkout.contactDetails")}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="firstName" label={t("checkout.firstName")} required error={deliveryErrors.firstName}>
                    <input
                      id="firstName"
                      name="firstName"
                      value={form.firstName}
                      onChange={handleFieldChange}
                      required
                      autoComplete="given-name"
                      {...getDeliveryInputProps("firstName")}
                    />
                  </Field>
                  <Field id="lastName" label={t("checkout.lastName")} required error={deliveryErrors.lastName}>
                    <input
                      id="lastName"
                      name="lastName"
                      value={form.lastName}
                      onChange={handleFieldChange}
                      required
                      autoComplete="family-name"
                      {...getDeliveryInputProps("lastName")}
                    />
                  </Field>
                  <Field
                    id="phone"
                    label={t("checkout.phone")}
                    required
                    note={t("checkout.phoneNote")}
                    error={deliveryErrors.phone}
                    className="sm:col-span-2"
                  >
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={form.phone}
                      onChange={handleFieldChange}
                      required
                      autoComplete="tel"
                      {...getDeliveryInputProps("phone")}
                    />
                  </Field>
                  <Field id="email" label={t("checkout.email")} required error={deliveryErrors.email} className="sm:col-span-2">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleFieldChange}
                      required
                      autoComplete="email"
                      {...getDeliveryInputProps("email")}
                    />
                  </Field>
                </div>
              </FormCard>

              <FormCard title={t("checkout.shippingAddress")}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="country" label={t("checkout.country")} required className="sm:col-span-2">
                    <input
                      id="country"
                      name="country"
                      value={language === "ar" ? "مصر" : form.country}
                      onChange={handleFieldChange}
                      className={inputClassName}
                      disabled
                    />
                  </Field>
                  <Field id="governorate" label={t("checkout.governorate")} required error={deliveryErrors.governorate}>
                    <input
                      id="governorate"
                      name="governorate"
                      value={form.governorate}
                      onChange={handleFieldChange}
                      required
                      autoComplete="address-level1"
                      {...getDeliveryInputProps("governorate")}
                    />
                  </Field>
                  <Field id="cityArea" label={t("checkout.cityArea")} required error={deliveryErrors.cityArea}>
                    <input
                      id="cityArea"
                      name="cityArea"
                      value={form.cityArea}
                      onChange={handleFieldChange}
                      required
                      autoComplete="address-level2"
                      {...getDeliveryInputProps("cityArea")}
                    />
                  </Field>
                  <Field id="streetAddress" label={t("checkout.streetAddress")} required error={deliveryErrors.streetAddress} className="sm:col-span-2">
                    <input
                      id="streetAddress"
                      name="streetAddress"
                      value={form.streetAddress}
                      onChange={handleFieldChange}
                      required
                      autoComplete="street-address"
                      {...getDeliveryInputProps("streetAddress")}
                    />
                  </Field>
                  <Field id="buildingNumber" label={t("checkout.buildingNumber")} required error={deliveryErrors.buildingNumber}>
                    <input
                      id="buildingNumber"
                      name="buildingNumber"
                      value={form.buildingNumber}
                      onChange={handleFieldChange}
                      required
                      autoComplete="address-line2"
                      {...getDeliveryInputProps("buildingNumber")}
                    />
                  </Field>
                  <Field id="apartmentFloor" label={t("checkout.apartmentFloor")} required error={deliveryErrors.apartmentFloor}>
                    <input
                      id="apartmentFloor"
                      name="apartmentFloor"
                      value={form.apartmentFloor}
                      onChange={handleFieldChange}
                      required
                      autoComplete="address-line3"
                      {...getDeliveryInputProps("apartmentFloor")}
                    />
                  </Field>
                  <Field id="postalCode" label={t("checkout.postalCode")} className="sm:col-span-2">
                    <input
                      id="postalCode"
                      name="postalCode"
                      value={form.postalCode}
                      onChange={handleFieldChange}
                      autoComplete="postal-code"
                      className={inputClassName}
                    />
                  </Field>
                  <Field id="deliveryNotes" label={t("checkout.deliveryNotes")} className="sm:col-span-2">
                    <textarea
                      id="deliveryNotes"
                      name="deliveryNotes"
                      value={form.deliveryNotes}
                      onChange={handleFieldChange}
                      placeholder={t("checkout.deliveryNotesPlaceholder")}
                      className={textAreaClassName}
                    />
                  </Field>
                </div>
              </FormCard>

              {currentUser && currentUser.clinicLocations.length > 0 && (
                <FormCard title={t("checkout.deliveryOfferLocationTitle", { fallback: "Delivery offer location" })}>
                  <p className="mb-3 text-[12px] leading-5 text-[#717182] dark:text-[#C6BEAE]">
                    {t("checkout.deliveryOfferLocationHelp", { fallback: "Select a saved clinic location to check location-based delivery offers, or use your manual delivery address without a zone-based offer." })}
                  </p>
                  <DentalSelect
                    label={t("checkout.deliveryOfferLocationLabel", { fallback: "Delivery offer location" })}
                    value={selectedClinicLocationId || "manual"}
                    onChange={(value) => setSelectedClinicLocationId(value === "manual" ? "" : value)}
                    placeholder={t("checkout.manualAddressNoZoneOffer", { fallback: "Use manual delivery address" })}
                    triggerClassName="dark:border-white/10 dark:bg-white/[0.04] dark:text-[#F7F2E6]"
                    contentClassName="max-h-[min(320px,calc(100vh-180px))] overflow-y-auto"
                    options={[
                      { value: "manual", label: t("checkout.manualAddressNoZoneOffer", { fallback: "Use manual delivery address" }) },
                      ...currentUser.clinicLocations.map((location) => ({
                        value: location.id,
                        label: `${location.customArea || (language === "ar" ? location.deliveryZone.nameAr : location.deliveryZone.nameEn)} · ${language === "ar" ? location.deliveryZone.nameAr : location.deliveryZone.nameEn}`,
                      })),
                    ]}
                  />
                  <p className="mt-3 text-[12px] leading-5 text-[#8A8D9A] dark:text-[#BDB6A8]">
                    {selectedClinicLocationId
                      ? t("checkout.savedLocationZoneStatus", { fallback: "The selected saved location and its delivery zone are verified securely at checkout." })
                      : t("checkout.manualAddressNoZoneOfferHelp", { fallback: "Location-based delivery offers are not applied to manual addresses." })}
                  </p>
                </FormCard>
              )}

              <FormCard title={t("checkout.clinicDetails")}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="clinicName" label={t("checkout.clinicName")}>
                    <input
                      id="clinicName"
                      name="clinicName"
                      value={form.clinicName}
                      onChange={handleFieldChange}
                      autoComplete="organization"
                      className={inputClassName}
                    />
                  </Field>
                  <Field id="clinicBranch" label={t("checkout.clinicBranch")}>
                    <input
                      id="clinicBranch"
                      name="clinicBranch"
                      value={form.clinicBranch}
                      onChange={handleFieldChange}
                      className={inputClassName}
                    />
                  </Field>
                </div>
              </FormCard>

              <label className="flex cursor-pointer items-start gap-3 px-1 py-2 text-[13px] font-bold leading-5 text-[#050505]">
                <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                  <input
                    type="checkbox"
                    checked={sendUpdates}
                    onChange={(event) => setSendUpdates(event.target.checked)}
                    className="peer h-5 w-5 appearance-none rounded-[6px] border border-[var(--xd-gold-border)] bg-white transition checked:border-[var(--xd-gold-active)] checked:bg-[var(--xd-gold-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
                  />
                  <Check
                    size={13}
                    className="pointer-events-none absolute text-white opacity-0 transition peer-checked:opacity-100"
                  />
                </span>
                {t("checkout.updates")}
              </label>

              <div className="flex flex-col gap-4 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <Link
                  href="/cart"
                  className="inline-flex items-center gap-2 rounded-full text-[13px] font-bold text-[#8A8D9A] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
                >
                  <DirectionalIcon direction="back" size={15} />
                  {t("common.backToCart")}
                </Link>
                <Button type="submit" size="lg" className="h-12 min-w-[190px] px-8 text-[14px]">
                  {t("checkout.continuePayment")}
                </Button>
              </div>
            </form>
          )}

          {currentStep === "payment" && (
            <form
              onSubmit={handlePaymentSubmit}
              noValidate
              className="min-w-0 space-y-5"
            >
              <FormCard title={t("checkout.shippingMethod")}>
                <div
                  id="shipping-methods"
                  role="radiogroup"
                  aria-invalid={Boolean(paymentErrors.shippingMethod)}
                  aria-describedby={paymentErrors.shippingMethod ? "shippingMethod-error" : undefined}
                  tabIndex={-1}
                  className="space-y-3 outline-none"
                >
                  {shippingMethods.map((method) => (
                    <SelectableOption
                      key={method.id}
                      selected={shippingMethod === method.id}
                      invalid={Boolean(paymentErrors.shippingMethod)}
                      title={t(method.titleKey)}
                      description={t(method.descriptionKey)}
                      price={t(method.priceKey)}
                      onClick={() => selectShippingMethod(method.id)}
                    />
                  ))}
                </div>
                {paymentErrors.shippingMethod && (
                  <p id="shippingMethod-error" role="alert" className="mt-3 text-[12px] font-semibold leading-5 text-[#F44336]">
                    {paymentErrors.shippingMethod}
                  </p>
                )}
              </FormCard>

              <FormCard title={t("checkout.paymentMethod")}>
                <div
                  id="payment-methods"
                  role="radiogroup"
                  aria-invalid={Boolean(paymentErrors.paymentMethod)}
                  aria-describedby={paymentErrors.paymentMethod ? "paymentMethod-error" : undefined}
                  tabIndex={-1}
                  className="flex flex-wrap items-center gap-3 outline-none"
                >
                  {paymentMethods.map((method) => (
                    <PaymentRadioCard
                      key={method.id}
                      id={method.id}
                      title={t(method.titleKey)}
                      short={t(method.shortKey)}
                      selected={paymentMethod === method.id}
                      invalid={Boolean(paymentErrors.paymentMethod)}
                      onSelect={() => selectPaymentMethod(method.id)}
                      icon={Package}
                    />
                  ))}
                </div>
                {paymentErrors.paymentMethod && (
                  <p id="paymentMethod-error" role="alert" className="mt-3 text-[12px] font-semibold leading-5 text-[#F44336]">
                    {paymentErrors.paymentMethod}
                  </p>
                )}

                <div className="checkout-payment-info mt-4 rounded-[16px] border border-[var(--xd-gold-border-soft)] bg-[rgba(249,220,92,0.05)] p-4 text-[13px] text-[#050505] dark:border-[var(--xd-gold-border)] dark:bg-[#1F1F1B] dark:text-[#F5F1E7]">
                  <div className="checkout-payment-info__title text-[14px] font-semibold text-[#050505] dark:text-[#F5F1E7]">{t("checkout.paymentMethods.cash.title")}</div>
                  <p className="checkout-payment-info__description mt-2 text-[13px] leading-5 text-[#8A8D9A] dark:text-[#CEC8BA]">
                    {t("checkout.cashNote")}
                  </p>
                  <p className="checkout-payment-info__description mt-2 text-[13px] leading-5 text-[#8A8D9A] dark:text-[#CEC8BA]">
                    {t("checkout.internalDeliveryNote")}
                  </p>
                  </div>
              </FormCard>

              <FormCard
                title={t("checkout.rewards.title", {
                  fallback: "Rewards & Wallet",
                })}
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="rounded-[16px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)]/40 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <label htmlFor="requestedPoints" className="text-[13px] font-bold text-[#050505] dark:text-[#F7F2E6]">
                          {t("checkout.rewards.pointsLabel", { fallback: "Redeem reward points" })}
                        </label>
                        <p className="mt-1 text-[12px] leading-5 text-[#717182] dark:text-[#C6BEAE]">
                          {t("checkout.rewards.pointsAvailable", {
                            fallback: "{points} available · maximum {maximum}",
                            values: {
                              points: trustedTotals?.availablePoints?.toLocaleString("en-US") ?? "0",
                              maximum: trustedTotals?.maximumRedeemablePoints?.toLocaleString("en-US") ?? "0",
                            },
                          })}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 text-[12px] font-bold text-[var(--xd-gold-text)] hover:text-[#050505] dark:hover:text-[#F7F2E6]"
                        disabled={!trustedTotals?.maximumRedeemablePoints}
                        onClick={() => setRequestedPoints(trustedTotals?.maximumRedeemablePoints ?? 0)}
                      >
                        {t("checkout.rewards.useMaximum", { fallback: "Use maximum" })}
                      </button>
                    </div>
                    {trustedTotals?.maximumRedeemablePoints ? <input
                      id="requestedPoints"
                      type="number"
                      min={0}
                      max={trustedTotals?.maximumRedeemablePoints ?? 0}
                      step={trustedTotals?.pointsPerRedemptionUnit ?? 100}
                      value={requestedPoints}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        setRequestedPoints(Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0);
                      }}
                      className={`mt-3 ${inputClassName}`}
                    /> : <p className="mt-3 rounded-[12px] bg-white/60 px-3 py-2.5 text-[12px] font-semibold text-[#717182] dark:bg-white/[0.04] dark:text-[#C6BEAE]">{t("checkout.rewards.pointsUnavailable", { fallback: "No reward points are usable for this checkout yet." })}</p>}
                      <p className="mt-2 text-[11px] leading-4 text-[#8A8D9A] dark:text-[#BDB6A8]">
                        {t("checkout.rewards.pointsRule", {
                          fallback: "100 points = EGP 10. Points apply to products only and cannot pay shipping.",
                        })}
                      </p>
                      {trustedTotals && (
                        <p className="mt-1 text-[11px] leading-4 text-[#8A8D9A] dark:text-[#BDB6A8]">
                          {t("checkout.rewards.pointsMinimumRule", {
                            fallback: "Points can be redeemed on orders of EGP {minimum} or more.",
                            values: {
                              minimum: trustedTotals.welcomeMinimumSubtotal,
                            },
                          })}
                        </p>
                      )}
                  </div>

                  <div className="rounded-[16px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)]/40 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <label htmlFor="requestedWalletAmount" className="text-[13px] font-bold text-[#050505] dark:text-[#F7F2E6]">
                          {t("checkout.rewards.walletLabel", { fallback: "Use store credit" })}
                        </label>
                        <p className="mt-1 text-[12px] leading-5 text-[#717182] dark:text-[#C6BEAE]">
                          {t("checkout.rewards.walletAvailable", {
                            fallback: "Available: {amount}",
                            values: { amount: formatCurrency(trustedTotals?.walletBalance ?? 0) },
                          })}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 text-[12px] font-bold text-[var(--xd-gold-text)] hover:text-[#050505] dark:hover:text-[#F7F2E6]"
                        disabled={!trustedTotals?.walletBalance}
                        onClick={() =>
                          setRequestedWalletAmount(
                            Math.min(
                              trustedTotals?.walletBalance ?? 0,
                              trustedTotals?.total ?? 0
                            ).toFixed(2)
                          )
                        }
                      >
                        {t("checkout.rewards.useMaximum", { fallback: "Use maximum" })}
                      </button>
                    </div>
                    {trustedTotals?.walletBalance ? <input
                      id="requestedWalletAmount"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max={Math.min(
                        trustedTotals?.walletBalance ?? 0,
                        trustedTotals?.total ?? 0
                      )}
                      step="0.01"
                      value={requestedWalletAmount}
                      onChange={(event) => setRequestedWalletAmount(event.target.value || "0")}
                      className={`mt-3 ${inputClassName}`}
                    /> : <p className="mt-3 rounded-[12px] bg-white/60 px-3 py-2.5 text-[12px] font-semibold text-[#717182] dark:bg-white/[0.04] dark:text-[#C6BEAE]">{t("checkout.rewards.walletUnavailable", { fallback: "No store credit is available for this checkout." })}</p>}
                    <p className="mt-2 text-[11px] leading-4 text-[#8A8D9A] dark:text-[#BDB6A8]">
                      {t("checkout.rewards.walletRule", {
                        fallback: "Store credit can cover products and shipping. Any remainder stays Cash on Delivery.",
                      })}
                    </p>
                  </div>
                </div>
              </FormCard>

              <FormCard title={t("checkout.orderNotes")}> 
                <textarea
                  value={orderNotes}
                  onChange={(event) => setOrderNotes(event.target.value)}
                  placeholder={t("checkout.orderNotesPlaceholder")}
                  className={textAreaClassName}
                />
              </FormCard>

              <div className="flex flex-col gap-4 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => showStep("delivery")}
                  className="inline-flex items-center gap-2 rounded-full text-[13px] font-bold text-[#8A8D9A] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
                >
                  <DirectionalIcon direction="back" size={15} />
                  {t("checkout.backDelivery")}
                </button>
                <Button type="submit" size="lg" className="h-12 min-w-[170px] px-8 text-[14px]">
                  {t("checkout.reviewOrder")}
                </Button>
              </div>
            </form>
          )}

          {currentStep === "review" && (
            <div className="min-w-0 space-y-5">
              <ReviewCard title={t("checkout.shippingAddress")} onEdit={() => showStep("delivery")}>
                <div className="space-y-1 text-[15px] font-medium leading-7 text-[#050505]">
                  {addressLines.map((line, index) => (
                    <p key={`${line}-${index}`}>{line}</p>
                  ))}
                </div>
              </ReviewCard>

              <ReviewCard title={t("checkout.shippingMethod")} onEdit={() => showStep("payment")}>
                <p className="text-[15px] font-medium leading-7 text-[#050505]">
                  {selectedShippingMethod && t(selectedShippingMethod.titleKey)}
                  {selectedShippingMethod && selectedShippingMethod.id !== "pickup" && (
                    <span> ({t(selectedShippingMethod.descriptionKey)})</span>
                  )}
                </p>
              </ReviewCard>

              <ReviewCard title={t("checkout.paymentMethod")} onEdit={() => showStep("payment")}>
                <p className="text-[15px] font-medium leading-7 text-[#050505]">
                  {selectedPaymentMethod && t(selectedPaymentMethod.titleKey)}
                </p>
              </ReviewCard>

              <ReviewCard title={t("checkout.itemsReview")}>
                <div className="space-y-0">
                  {checkoutItems.map((item, index) => (
                    <ReviewItemRow
                      key={`${item.product.id}-${item.selectedOptions ?? index}`}
                      item={item}
                    />
                  ))}
                </div>
              </ReviewCard>

              <div className="flex flex-col gap-4 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => showStep("payment")}
                  className="inline-flex items-center gap-2 rounded-full text-[13px] font-bold text-[#8A8D9A] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
                >
                  <DirectionalIcon direction="back" size={15} />
                  {t("checkout.backPayment")}
                </button>
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
                  <p
                    role="status"
                    className="max-w-[420px] text-[12px] font-semibold leading-5 text-[#717182] sm:text-end"
                  >
                    {t("checkout.orderReady")}
                  </p>
                  <Button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handlePlaceOrder}
                    size="lg"
                    className="h-12 min-w-[160px] px-8 text-[14px]"
                  >
                    {isSubmitting ? t("checkout.placingOrder") : t("checkout.placeOrder")}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <OrderSummary
            items={checkoutItems}
            subtotal={displayedSubtotal}
            shipping={displayedShipping}
            discount={displayedDiscount}
            total={total}
            pricing={trustedTotals}
          />
        </div>
      </Container>
    </div>
  );
}
