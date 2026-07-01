import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Check, ShieldCheck, CreditCard, Wallet, RefreshCw, FileText, Package, ClipboardList } from "lucide-react";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { Button } from "@/components/dental/Button";
import { Container } from "@/components/dental/Container";
import { useStore } from "@/context/StoreContext";
import type { CartItem } from "@/types/product";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils";
import { SEO } from "@/components/SEO";
import { useLanguage } from "@/context/LanguageContext";
import { ApiError } from "@/services/http";
import { createOrder } from "@/services/orders";

const CHECKOUT_POINTS_KEY = "x-dental-checkout-points";
const CHECKOUT_REWARD_KEY = "x-dental-checkout-reward";
const POINT_VALUE_EGP = 0.1;
const POINTS_PER_EGP = 10; // 10 points = EGP 1

const CHECKOUT_IMAGE = `${import.meta.env.BASE_URL}toothtools.png`;

const inputClassName =
  "h-12 w-full rounded-[12px] border border-[#050505]/10 bg-white px-4 text-[14px] font-medium text-[#050505] outline-none transition placeholder:text-[#B3B4BD] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-bg-soft)] disabled:bg-[#F3F2ED] disabled:text-[#5F5F5F]";

const invalidInputClassName =
  "border-[#F44336]/60 focus:border-[#F44336] focus:ring-[#F44336]/10";

const textAreaClassName =
  "min-h-[92px] w-full resize-none rounded-[12px] border border-[#050505]/10 bg-white px-4 py-3 text-[14px] font-medium text-[#050505] outline-none transition placeholder:text-[#9FA1AC] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-bg-soft)]";

type CheckoutStepId = "delivery" | "payment" | "review";
type ShippingMethodId = "standard" | "fast" | "pickup";
type PaymentMethodId = "cash" | "card" | "fawry" | "wallet" | "instapay" | "bank";

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
    { id: "card", titleKey: "checkout.paymentMethods.card.title", shortKey: "checkout.paymentMethods.card.short" },
    { id: "fawry", titleKey: "checkout.paymentMethods.fawry.title", shortKey: "checkout.paymentMethods.fawry.short" },
    { id: "wallet", titleKey: "checkout.paymentMethods.wallet.title", shortKey: "checkout.paymentMethods.wallet.short" },
    { id: "instapay", titleKey: "checkout.paymentMethods.instapay.title", shortKey: "checkout.paymentMethods.instapay.short" },
    { id: "bank", titleKey: "checkout.paymentMethods.bank.title", shortKey: "checkout.paymentMethods.bank.short" },
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
                    ? "bg-[var(--xd-gold)] text-white"
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

function CheckoutImage({ name }: { name: string }) {
  return (
    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[10px] border border-[var(--xd-gold-border-soft)] bg-white">
      <img
        src={CHECKOUT_IMAGE}
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

type AppliedPoints = {
  type: "points";
  pointsToApply: number;
  source?: string;
  createdAt: number;
};

type AppliedReward = {
  type: "reward";
  rewardId: string;
  label: string;
  discountEGP: number;
  freeShipping?: boolean;
  minOrderEGP?: number;
  source?: string;
  createdAt: number;
};

function OrderSummary({
  items,
  subtotal,
  shipping,
  appliedPoints,
  appliedReward,
  pointsDiscountEGP,
  rewardDiscountEGP,
  shippingDiscountEGP,
  total,
}: {
  items: CartItem[];
  subtotal: number;
  shipping: number;
  appliedPoints: AppliedPoints | null;
  appliedReward: AppliedReward | null;
  pointsDiscountEGP: number;
  rewardDiscountEGP: number;
  shippingDiscountEGP: number;
  total: number;
}) {
  const { t } = useLanguage();
  const hasPointsDiscount = appliedPoints && pointsDiscountEGP > 0;
  const hasRewardDiscount = appliedReward && rewardDiscountEGP > 0;
  const hasShippingDiscount = shippingDiscountEGP > 0;

  return (
    <aside className="min-w-0">
      <div className="sticky top-28 rounded-[24px] border border-[var(--xd-gold-border-soft)] bg-white/88 p-6 shadow-[0_18px_44px_rgba(5,5,5,0.06)]">
        <h2 className="font-display text-[22px] font-bold leading-tight text-[#050505]">
          {t("cart.summary")}
        </h2>

        <div className="mt-7 space-y-4">
          {items.map((item, index) => (
            (() => {
              const productName = t(`products.items.${item.product.id}.name`, { fallback: item.product.name });

              return (
                <div
                  key={`${item.product.id}-${item.selectedOptions ?? index}`}
                  className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3"
                >
                  <CheckoutImage name={productName} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-[#050505]">{productName}</p>
                    <p className="mt-1 text-[12px] font-semibold text-[#8A8D9A]">{t("common.quantity")}: {item.quantity}</p>
                  </div>
                  <p className="text-[13px] font-bold text-[var(--xd-gold-active)]">
                    {formatCurrency(item.product.currentPrice * item.quantity)}
                  </p>
                </div>
              );
            })()
          ))}
        </div>

        <div className="mt-6 border-t border-[#050505]/[0.07] pt-5">
          <dl className="space-y-4 text-[14px]">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[#8A8D9A]">{t("checkout.itemsSubtotal")}</dt>
              <dd className="font-bold text-[#050505]">{formatCurrency(subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[#8A8D9A]">{t("common.shipping")}</dt>
              <dd className="font-bold text-[#050505]">{formatCurrency(shipping)}</dd>
            </div>
            {hasShippingDiscount && (
              <div className="flex items-start justify-between gap-4">
                <dt className="text-[#8A8D9A]">
                  <span>{t("checkout.freeShipping") || "Free Shipping"}</span>
                  {appliedReward?.label && (
                    <span className="mt-1 block text-[12px] font-semibold text-[#717182]">
                      {appliedReward.label}
                    </span>
                  )}
                </dt>
                <dd className="font-bold text-[#16803C]">{`-${formatCurrency(shippingDiscountEGP)}`}</dd>
              </div>
            )}
            {hasPointsDiscount && (
              <div className="flex items-start justify-between gap-4">
                <dt className="text-[#8A8D9A]">
                  <span>{t("checkout.pointsDiscount") || "Points Discount"}</span>
                  <span className="mt-1 block text-[12px] font-semibold text-[#717182]">
                    {appliedPoints.pointsToApply.toLocaleString()} {t("checkout.pts") || "pts"}
                  </span>
                </dt>
                <dd className="font-bold text-[#16803C]">{`-${formatCurrency(pointsDiscountEGP)}`}</dd>
              </div>
            )}
            {hasRewardDiscount && (
              <div className="flex items-start justify-between gap-4">
                <dt className="text-[#8A8D9A]">
                  <span>{t("checkout.rewardDiscount") || "Reward Discount"}</span>
                  {appliedReward.label && (
                    <span className="mt-1 block text-[12px] font-semibold text-[#717182]">
                      {appliedReward.label}
                    </span>
                  )}
                </dt>
                <dd className="font-bold text-[#16803C]">{`-${formatCurrency(rewardDiscountEGP)}`}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="mt-6 border-t border-[#050505]/[0.07] pt-5">
          <div className="flex items-end justify-between gap-4">
            <span className="text-[17px] font-bold text-[#050505]">{t("common.total")}</span>
            <span className="font-display text-[26px] font-bold text-[var(--xd-gold-active)]">
              {formatCurrency(total)}
            </span>
          </div>
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
          ? "border-[var(--xd-gold-active)] bg-[var(--xd-gold-active)]/[0.08]"
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
        "inline-flex items-center gap-2 max-w-max h-12 px-4 rounded-full border bg-white/55 text-[14px] font-semibold transition-colors focus-visible:outline-none",
        selected
          ? "border-[var(--xd-gold-border-hover)] bg-[var(--xd-gold)]/[0.10] text-[#050505]"
          : invalid
            ? "border-[#F44336]/45 hover:border-[#F44336]/65 hover:bg-[#F44336]/[0.025]"
          : "border-[#050505]/[0.08] hover:border-[var(--xd-gold-border)] hover:bg-[var(--xd-gold)]/[0.05]"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded-full border",
          selected ? "border-[var(--xd-gold-active)] bg-white" : "border-[#050505]/[0.12] bg-white"
        )}
      >
        {selected ? <span className="h-2 w-2 rounded-full bg-[var(--xd-gold)]" /> : null}
      </span>

      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 24 }}>
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
        <span className="whitespace-nowrap">{title}</span>
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
  const { t } = useLanguage();
  const productName = t(`products.items.${item.product.id}.name`, { fallback: item.product.name });
  const optionDetails =
    item.selectedOptions || item.product.options?.join(" - ") || "Pack: 1 pcs";

  return (
    <article className="grid gap-4 border-b border-[#050505]/[0.07] py-5 first:pt-0 last:border-b-0 last:pb-0 sm:grid-cols-[76px_minmax(0,1fr)_auto]">
      <CheckoutImage name={productName} />
      <div className="min-w-0">
        <h3 className="text-[16px] font-bold leading-6 text-[#050505]">{productName}</h3>
        <div className="mt-2 space-y-1 text-[13px] font-semibold leading-5 text-[#8A8D9A]">
          <p>
            {t("common.brand")}: <span className="text-[#717182]">{item.product.brand}</span>
          </p>
          <p>{optionDetails}</p>
          <p>{t("common.quantity")}: {item.quantity}</p>
        </div>
      </div>
      <p className="self-start font-display text-[18px] font-bold text-[var(--xd-gold-active)] sm:text-right">
        {formatCurrency(item.product.currentPrice * item.quantity)}
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
  | "paymentMethod"
  | "cardNumber"
  | "cardExpiry"
  | "cardName"
  | "cardCvv";

const initialCardState = {
  cardNumber: "",
  cardExpiry: "",
  cardName: "",
  cardCvv: "",
};

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
  "cardNumber",
  "cardExpiry",
  "cardName",
  "cardCvv",
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
  const { cart, cartTotal, clearCart, currentUser, isAuthenticated, isAuthLoading } = useStore();
  const { t, language } = useLanguage();
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState<CheckoutStepId>("delivery");
  const [form, setForm] = useState(initialFormState);
  const [sendUpdates, setSendUpdates] = useState(true);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethodId | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId | null>(null);
  const [points, setPoints] = useState("");
  const [pointsFeedback, setPointsFeedback] = useState<{ message: string; tone: "error" | "success" } | null>(null);
  const [deliveryErrors, setDeliveryErrors] = useState<Partial<Record<DeliveryFieldId, string>>>({});
  const [paymentErrors, setPaymentErrors] = useState<Partial<Record<PaymentFieldId, string>>>({});
  const [card, setCard] = useState(initialCardState);
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(false);
  const [orderNotes, setOrderNotes] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appliedPoints, setAppliedPoints] = useState<AppliedPoints | null>(null);
  const [appliedReward, setAppliedReward] = useState<AppliedReward | null>(null);
  const hasCompletedOrder = useRef(false);
  const checkoutItems = cart;
  const subtotal = cartTotal;
  const availablePoints = Math.max(0, Math.floor(currentUser?.stats?.points ?? 0));
  const selectedShippingMethod =
    shippingMethods.find((method) => method.id === shippingMethod);
  const selectedPaymentMethod =
    paymentMethods.find((method) => method.id === paymentMethod);
  const shipping = subtotal > 0 ? selectedShippingMethod?.amount ?? 0 : 0;

  useEffect(() => {
    if (isAuthLoading || hasCompletedOrder.current) return;
    if (!isAuthenticated) {
      setLocation(`/signin?redirect=${encodeURIComponent("/checkout")}`, { replace: true });
      return;
    }
    if (cart.length === 0) {
      setLocation("/cart?checkout=empty", { replace: true });
    }
  }, [cart.length, isAuthenticated, isAuthLoading, setLocation]);

  // Read applied points and reward from localStorage on mount (and when URL changes).
  // Only ONE benefit is active at a time. If both keys exist, we keep the
  // one with the newer `createdAt` (falling back to the reward if neither
  // has a timestamp, so legacy data does not double-apply).
  useEffect(() => {
    if (typeof window === "undefined" || isAuthLoading) return;

    const readFromQuery = (): number | null => {
      try {
        const params = new URLSearchParams(window.location.search);
        const raw = params.get("applyPoints");
        if (!raw) return null;
        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed <= 0) return null;
        return Math.floor(parsed);
      } catch {
        return null;
      }
    };

    const queryPoints = readFromQuery();

    const readPoints = (): AppliedPoints | null => {
      try {
        const raw = window.localStorage.getItem(CHECKOUT_POINTS_KEY);
        if (!raw) {
          if (queryPoints && queryPoints <= availablePoints) {
            return {
              type: "points",
              pointsToApply: queryPoints,
              source: "url",
              createdAt: Date.now(),
            };
          }
          return null;
        }
        const parsed = JSON.parse(raw) as Partial<AppliedPoints> | null;
        const stored =
          typeof parsed?.pointsToApply === "number"
            ? parsed.pointsToApply
            : typeof (parsed as { points?: number } | null)?.points === "number"
              ? (parsed as { points?: number }).points
              : null;
        const value = queryPoints ?? stored;
        if (!value || value <= 0) return null;
        const safePoints = Math.floor(value);
        if (safePoints > availablePoints) {
          window.localStorage.removeItem(CHECKOUT_POINTS_KEY);
          return null;
        }
        return {
          type: "points",
          pointsToApply: safePoints,
          source: parsed?.source ?? (queryPoints ? "url" : "wallet"),
          createdAt:
            typeof parsed?.createdAt === "number" ? parsed.createdAt : Date.now(),
        };
      } catch {
        return null;
      }
    };

    const readReward = (): AppliedReward | null => {
      try {
        const raw = window.localStorage.getItem(CHECKOUT_REWARD_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<AppliedReward> | null;
        if (!parsed || typeof parsed.rewardId !== "string") return null;
        return {
          type: "reward",
          rewardId: parsed.rewardId,
          label: typeof parsed.label === "string" ? parsed.label : "",
          discountEGP:
            typeof parsed.discountEGP === "number" ? parsed.discountEGP : 0,
          freeShipping: Boolean(parsed.freeShipping),
          minOrderEGP:
            typeof parsed.minOrderEGP === "number" ? parsed.minOrderEGP : 0,
          source: parsed.source,
          createdAt:
            typeof parsed.createdAt === "number" ? parsed.createdAt : Date.now(),
        };
      } catch {
        return null;
      }
    };

    const storedPoints = readPoints();
    const storedReward = readReward();

    // Resolve which benefit is active. Newer createdAt wins; if either
    // is missing a timestamp, prefer the reward (legacy fallback) so
    // both keys can't double-apply on first load.
    if (storedPoints && storedReward) {
      if (storedReward.createdAt >= storedPoints.createdAt) {
        setAppliedReward(storedReward);
        setAppliedPoints(null);
        setPoints("");
        // Drop the stale points key so the wallet reads as clean later.
        try {
          window.localStorage.removeItem(CHECKOUT_POINTS_KEY);
        } catch {
          /* storage unavailable */
        }
      } else {
        setAppliedPoints(storedPoints);
        setAppliedReward(null);
        setPoints(String(storedPoints.pointsToApply));
        try {
          window.localStorage.removeItem(CHECKOUT_REWARD_KEY);
        } catch {
          /* storage unavailable */
        }
      }
    } else if (storedPoints) {
      setAppliedPoints(storedPoints);
      setPoints(String(storedPoints.pointsToApply));
    } else if (storedReward) {
      setAppliedPoints(null);
      setAppliedReward(storedReward);
    } else {
      setAppliedPoints(null);
    }
  }, [availablePoints, isAuthLoading]);

  // Compute raw discount from points (10 points = EGP 1) and reward.
  const rawPointsDiscountEGP = appliedPoints
    ? appliedPoints.pointsToApply * POINT_VALUE_EGP
    : 0;
  const rawRewardDiscountEGP = appliedReward ? Math.max(0, appliedReward.discountEGP) : 0;

  // Determine whether the applied reward is eligible for this order.
  // (Used to gate the discount + free-shipping modifier.)
  const rewardMinOrder = appliedReward?.minOrderEGP ?? 0;
  const rewardEligible = appliedReward
    ? subtotal >= rewardMinOrder
    : false;

  // Free-shipping modifier: capped to actual shipping cost, and only
  // applied when the order is eligible for the reward and a paid shipping
  // method is selected (pickup is already free).
  const paidShipping = shippingMethod !== "pickup" ? shipping : 0;
  const freeShippingActive = Boolean(
    appliedReward?.freeShipping && rewardEligible && paidShipping > 0
  );
  const shippingDiscountEGP = freeShippingActive ? paidShipping : 0;

  // The reward monetary discount only applies if the order meets its
  // minimum requirement; otherwise the reward is ignored entirely.
  const effectiveRewardDiscountEGP = rewardEligible ? rawRewardDiscountEGP : 0;

  // Cap combined discount so it never exceeds the eligible order total
  // (subtotal + shipping - shippingDiscount). Discount is taken from the
  // pre-shipping total first.
  const maxDiscountBase = Math.max(0, subtotal + shipping - shippingDiscountEGP);
  const totalRawDiscount = rawPointsDiscountEGP + effectiveRewardDiscountEGP;
  const discountScale =
    totalRawDiscount > 0 && totalRawDiscount > maxDiscountBase && maxDiscountBase > 0
      ? maxDiscountBase / totalRawDiscount
      : 1;
  const pointsDiscountEGP = Math.max(0, Math.floor(rawPointsDiscountEGP * discountScale));
  const rewardDiscountEGP = Math.max(0, Math.floor(effectiveRewardDiscountEGP * discountScale));
  const total = Math.max(
    0,
    subtotal + shipping - pointsDiscountEGP - rewardDiscountEGP - shippingDiscountEGP
  );

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

    if (paymentMethod === "card") {
      const cardNumber = card.cardNumber.replace(/\s/g, "");
      if (!cardNumber) {
        errors.cardNumber = t("checkout.validation.cardNumberRequired");
      } else if (!/^\d{12,19}$/.test(cardNumber)) {
        errors.cardNumber = t("checkout.validation.cardNumberInvalid");
      }

      if (!card.cardExpiry.trim()) {
        errors.cardExpiry = t("checkout.validation.cardExpiryRequired");
      } else if (!/^(0[1-9]|1[0-2])\s?\/\s?\d{2}$/.test(card.cardExpiry.trim())) {
        errors.cardExpiry = t("checkout.validation.cardExpiryInvalid");
      }

      if (!card.cardName.trim()) {
        errors.cardName = t("checkout.validation.cardNameRequired");
      } else if (card.cardName.trim().length < 2) {
        errors.cardName = t("checkout.validation.cardNameInvalid");
      }

      if (!card.cardCvv.trim()) {
        errors.cardCvv = t("checkout.validation.cardCvvRequired");
      } else if (!/^\d{3,4}$/.test(card.cardCvv.trim())) {
        errors.cardCvv = t("checkout.validation.cardCvvInvalid");
      }
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
      step === "payment" && !errors.shippingMethod && !errors.paymentMethod
        ? t("checkout.completeCardFields")
        : t("checkout.completeRequiredFields")
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
    setForm((current) => ({ ...current, [name]: value }));
    if (deliveryFieldOrder.includes(name as DeliveryFieldId)) {
      clearDeliveryError(name as DeliveryFieldId);
    }
  };

  const handleCardChange = (event: ChangeEvent<HTMLInputElement>) => {
    const field = event.target.name as keyof typeof initialCardState;
    setCard((current) => ({ ...current, [field]: event.target.value }));
    clearPaymentError(field);
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
      if (method !== "card") {
        delete next.cardNumber;
        delete next.cardExpiry;
        delete next.cardName;
        delete next.cardCvv;
      }
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

  const clearAppliedPoints = () => {
    setAppliedPoints(null);
    try {
      window.localStorage.removeItem(CHECKOUT_POINTS_KEY);
    } catch {
      /* storage unavailable */
    }
  };

  const handleApplyPoints = () => {
    const trimmed = points.trim();
    const parsed = Number(trimmed);
    if (!trimmed || !Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
      clearAppliedPoints();
      setPointsFeedback({ message: t("checkout.pointsInvalid"), tone: "error" });
      return;
    }
    if (availablePoints === 0) {
      clearAppliedPoints();
      setPointsFeedback({ message: t("checkout.pointsUnavailable"), tone: "error" });
      return;
    }
    if (parsed > availablePoints) {
      clearAppliedPoints();
      setPointsFeedback({
        message: t("checkout.pointsExceeded", { values: { balance: availablePoints.toLocaleString() } }),
        tone: "error",
      });
      return;
    }
    // Applying points in-page replaces any active reward. Clear the
    // reward key + state so checkout never double-applies.
    setAppliedReward(null);
    try {
      window.localStorage.removeItem(CHECKOUT_REWARD_KEY);
    } catch {
      /* storage unavailable */
    }
    setAppliedPoints({
      type: "points",
      pointsToApply: parsed,
      source: "checkout",
      createdAt: Date.now(),
    });
    setPointsFeedback({
      message: t("checkout.pointsApplied", { values: { points: parsed.toLocaleString() } }),
      tone: "success",
    });
  };

  const handlePlaceOrder = async () => {
    if (isAuthLoading || isSubmitting) return;
    if (!isAuthenticated) {
      setLocation(`/signin?redirect=${encodeURIComponent("/checkout")}`);
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
    try {
      const order = await createOrder({
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
        deliveryMethod: shippingMethod,
        paymentMethod,
        items: cart.map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          sku: item.product.sku ?? undefined,
          selectedOptions: item.selectedOptions ?? undefined,
          quantity: item.quantity,
          unitPrice: item.product.currentPrice,
        })),
      });

      hasCompletedOrder.current = true;
      clearCart();
      try {
        window.localStorage.removeItem(CHECKOUT_POINTS_KEY);
        window.localStorage.removeItem(CHECKOUT_REWARD_KEY);
      } catch {
        /* storage unavailable */
      }
      setLocation(`/order-confirmed?orderId=${encodeURIComponent(order.id)}`, { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setLocation(`/signin?redirect=${encodeURIComponent("/checkout")}`);
        return;
      }
      setStatusMessage(t("checkout.createFailed"));
      setIsSubmitting(false);
    }
  };

  const getDeliveryInputProps = (field: DeliveryFieldId) => ({
    "aria-describedby": deliveryErrors[field] ? `${field}-error` : undefined,
    "aria-invalid": Boolean(deliveryErrors[field]),
    className: cn(inputClassName, deliveryErrors[field] && invalidInputClassName),
  });

  const getCardInputProps = (field: keyof typeof initialCardState) => ({
    "aria-describedby": paymentErrors[field] ? `${field}-error` : undefined,
    "aria-invalid": Boolean(paymentErrors[field]),
    className: cn(inputClassName, paymentErrors[field] && invalidInputClassName),
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

              <FormCard title={t("checkout.usePoints")}>
                <p className="text-[13px] font-semibold text-[#8A8D9A]">
                  {t("checkout.currentBalance")}{" "}
                  <span className="font-bold text-[#050505]">
                    {t("checkout.pointsBalance", { values: { balance: availablePoints.toLocaleString() } })}
                  </span>
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
                  <input
                    value={points}
                    onChange={(event) => {
                      setPoints(event.target.value);
                      setPointsFeedback(null);
                    }}
                    inputMode="numeric"
                    aria-invalid={pointsFeedback?.tone === "error"}
                    aria-describedby={pointsFeedback || availablePoints === 0 ? "points-feedback" : undefined}
                    placeholder={t("checkout.pointsPlaceholder")}
                    className={cn(inputClassName, pointsFeedback?.tone === "error" && invalidInputClassName)}
                  />
                  <Button
                    type="button"
                    onClick={handleApplyPoints}
                    className="h-12 px-5 text-[13px]"
                  >
                    {t("checkout.applyPoints")}
                  </Button>
                </div>
                {(pointsFeedback || availablePoints === 0) && (
                  <p
                    id="points-feedback"
                    role={pointsFeedback?.tone === "error" ? "alert" : "status"}
                    className={cn(
                      "mt-3 text-[12px] font-semibold leading-5",
                      pointsFeedback?.tone === "error"
                        ? "text-[#F44336]"
                        : pointsFeedback?.tone === "success"
                          ? "text-[#16803C]"
                          : "text-[#8A8D9A]"
                    )}
                  >
                    {pointsFeedback?.message ?? t("checkout.pointsUnavailable")}
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
                  {paymentMethods.map((method) => {
                    const base = `${import.meta.env.BASE_URL}payment-logos/`;
                    const LogosMap: Record<PaymentMethodId, { icon?: any; logo?: string | string[] }> = {
                      cash: { icon: Package },
                      card: { icon: CreditCard, logo: [base + "visa.svg", base + "mastercard.svg"] },
                      fawry: { icon: FileText, logo: base + "fawry.svg" },
                      wallet: { icon: Wallet },
                      instapay: { icon: RefreshCw, logo: base + "instapay.svg" },
                      bank: { icon: ClipboardList },
                    };

                    const meta = LogosMap[method.id] ?? {};

                    return (
                      <PaymentRadioCard
                        key={method.id}
                        id={method.id}
                        title={t(method.titleKey)}
                        short={t(method.shortKey)}
                        selected={paymentMethod === method.id}
                        invalid={Boolean(paymentErrors.paymentMethod)}
                        onSelect={() => selectPaymentMethod(method.id)}
                        icon={meta.icon}
                        logoSrc={meta.logo}
                      />
                    );
                  })}
                </div>
                {paymentErrors.paymentMethod && (
                  <p id="paymentMethod-error" role="alert" className="mt-3 text-[12px] font-semibold leading-5 text-[#F44336]">
                    {paymentErrors.paymentMethod}
                  </p>
                )}

                {paymentMethod && (
                  <div className="mt-4 rounded-[16px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold)]/[0.05] p-4 text-[13px] text-[#050505]">
                  {paymentMethod === "cash" && (
                    <div>
                      <div className="text-[14px] font-semibold">{t("checkout.paymentMethods.cash.title")}</div>
                      <p className="mt-2 text-[13px] text-[#8A8D9A]">
                        {t("checkout.cashNote")}
                      </p>
                    </div>
                  )}

                  {paymentMethod === "card" && (
                    <div>
                      <div className="text-[14px] font-semibold">{t("checkout.paymentMethods.card.title")}</div>
                      <p className="mt-2 text-[13px] text-[#8A8D9A]">{t("checkout.paymentMethods.card.short")}</p>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="block space-y-2">
                          <span className="sr-only">{t("checkout.cardNumber")}</span>
                          <input
                            id="cardNumber"
                            name="cardNumber"
                            type="text"
                            value={card.cardNumber}
                            onChange={handleCardChange}
                            inputMode="numeric"
                            autoComplete="cc-number"
                            required
                            minLength={12}
                            maxLength={23}
                            pattern={"[0-9\\s]{12,23}"}
                            title={t("checkout.completeCardFields")}
                            placeholder={t("checkout.cardNumber")}
                            {...getCardInputProps("cardNumber")}
                          />
                          {paymentErrors.cardNumber && (
                            <p id="cardNumber-error" role="alert" className="text-[12px] font-semibold leading-5 text-[#F44336]">
                              {paymentErrors.cardNumber}
                            </p>
                          )}
                        </label>
                        <label className="block space-y-2">
                          <span className="sr-only">{t("checkout.cardExpiry")}</span>
                          <input
                            id="cardExpiry"
                            name="cardExpiry"
                            type="text"
                            value={card.cardExpiry}
                            onChange={handleCardChange}
                            inputMode="numeric"
                            autoComplete="cc-exp"
                            required
                            maxLength={7}
                            pattern={"(0[1-9]|1[0-2])\\s?/\\s?[0-9]{2}"}
                            title={t("checkout.completeCardFields")}
                            placeholder={t("checkout.cardExpiry")}
                            {...getCardInputProps("cardExpiry")}
                          />
                          {paymentErrors.cardExpiry && (
                            <p id="cardExpiry-error" role="alert" className="text-[12px] font-semibold leading-5 text-[#F44336]">
                              {paymentErrors.cardExpiry}
                            </p>
                          )}
                        </label>
                        <label className="block space-y-2">
                          <span className="sr-only">{t("checkout.cardName")}</span>
                          <input
                            id="cardName"
                            name="cardName"
                            type="text"
                            value={card.cardName}
                            onChange={handleCardChange}
                            autoComplete="cc-name"
                            required
                            minLength={2}
                            title={t("checkout.completeCardFields")}
                            placeholder={t("checkout.cardName")}
                            {...getCardInputProps("cardName")}
                          />
                          {paymentErrors.cardName && (
                            <p id="cardName-error" role="alert" className="text-[12px] font-semibold leading-5 text-[#F44336]">
                              {paymentErrors.cardName}
                            </p>
                          )}
                        </label>
                        <label className="block space-y-2">
                          <span className="sr-only">{t("checkout.cardCvv")}</span>
                          <input
                            id="cardCvv"
                            name="cardCvv"
                            type="password"
                            value={card.cardCvv}
                            onChange={handleCardChange}
                            inputMode="numeric"
                            autoComplete="cc-csc"
                            required
                            minLength={3}
                            maxLength={4}
                            pattern="[0-9]{3,4}"
                            title={t("checkout.completeCardFields")}
                            placeholder={t("checkout.cardCvv")}
                            {...getCardInputProps("cardCvv")}
                          />
                          {paymentErrors.cardCvv && (
                            <p id="cardCvv-error" role="alert" className="text-[12px] font-semibold leading-5 text-[#F44336]">
                              {paymentErrors.cardCvv}
                            </p>
                          )}
                        </label>
                      </div>
                    </div>
                  )}

                  {paymentMethod === "fawry" && (
                    <div>
                      <div className="text-[14px] font-semibold">{t("checkout.paymentMethods.fawry.title")}</div>
                      <p className="mt-2 text-[13px] text-[#8A8D9A]">
                        {t("checkout.fawryNote")}
                      </p>
                    </div>
                  )}

                  {paymentMethod === "wallet" && (
                    <div>
                      <div className="text-[14px] font-semibold">{t("checkout.paymentMethods.wallet.title")}</div>
                      <p className="mt-2 text-[13px] text-[#8A8D9A]">
                        {t("checkout.walletNote")}
                      </p>
                    </div>
                  )}

                  {paymentMethod === "instapay" && (
                    <div>
                      <div className="text-[14px] font-semibold">{t("checkout.paymentMethods.instapay.title")}</div>
                      <p className="mt-2 text-[13px] text-[#8A8D9A]">
                        {t("checkout.instapayNote")}
                      </p>
                    </div>
                  )}

                  {paymentMethod === "bank" && (
                    <div>
                      <div className="text-[14px] font-semibold">{t("checkout.paymentMethods.bank.title")}</div>
                      <p className="mt-2 text-[13px] text-[#8A8D9A]">
                        {t("checkout.bankNote")}
                      </p>

                      <div className="mt-3 space-y-2">
                        <div className="text-[13px] font-semibold">{t("checkout.accountName")}</div>
                        <div className="text-[13px] font-semibold">{t("checkout.iban")}</div>
                      </div>
                    </div>
                  )}
                  </div>
                )}
              </FormCard>

              <FormCard title={t("checkout.billingAddress")}>
                <label className="flex cursor-pointer items-center gap-3 text-[13px] font-bold text-[#050505]">
                  <input
                    type="checkbox"
                    checked={billingSameAsShipping}
                    onChange={(event) => setBillingSameAsShipping(event.target.checked)}
                    className="h-4 w-4 rounded-[4px] border-[#050505]/10 text-[var(--xd-gold-active)] focus:ring-[var(--xd-gold-active)]/35"
                  />
                  {t("checkout.billingSame")}
                </label>
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
            subtotal={subtotal}
            shipping={shipping}
            appliedPoints={appliedPoints}
            appliedReward={appliedReward}
            pointsDiscountEGP={pointsDiscountEGP}
            rewardDiscountEGP={rewardDiscountEGP}
            shippingDiscountEGP={shippingDiscountEGP}
            total={total}
          />
        </div>
      </Container>
    </div>
  );
}
