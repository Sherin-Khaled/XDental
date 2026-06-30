import type { CartItem } from "@/types/product";

export type CouponType = "percentage" | "fixed" | "free_shipping";

export type Coupon = {
  code: string;
  type: CouponType;
  value: number;
  label: string;
  minimumSubtotal: number;
  enabled: boolean;
  terms: string;
  usageNote: string;
  categorySlugs?: string[];
  minimumAppliesToEligibleSubtotal?: boolean;
};

export type CouponValidationError =
  | "empty"
  | "not_found"
  | "unavailable"
  | "minimum"
  | "category_mismatch"
  | "not_eligible";

export type CouponValidationResult =
  | {
      status: "valid";
      coupon: Coupon;
      code: string;
      discount: number;
    }
  | {
      status: "invalid";
      reason: CouponValidationError;
      minimumSubtotal?: number;
    };

const mockCoupons: Coupon[] = [
  {
    code: "WELCOME10",
    type: "percentage",
    value: 10,
    label: "10% off",
    minimumSubtotal: 500,
    enabled: true,
    terms: "10% off orders with subtotal of EGP 500 or more.",
    usageNote: "Preview-only welcome discount. Real first-order and usage limits must be enforced by backend.",
  },
  {
    code: "CLINIC15",
    type: "percentage",
    value: 15,
    label: "15% off clinic essentials",
    minimumSubtotal: 1500,
    enabled: true,
    terms: "15% off Clinic Essentials products only with eligible subtotal of EGP 1,500 or more.",
    usageNote: "Preview-only category coupon. Backend should enforce eligible products and usage limits.",
    categorySlugs: ["clinic-essentials"],
    minimumAppliesToEligibleSubtotal: true,
  },
  {
    code: "SAVE100",
    type: "fixed",
    value: 100,
    label: "EGP 100 off",
    minimumSubtotal: 1000,
    enabled: true,
    terms: "EGP 100 off orders with subtotal of EGP 1,000 or more.",
    usageNote: "Preview-only fixed discount. Backend should enforce usage limits.",
  },
  {
    code: "FREESHIP",
    type: "free_shipping",
    value: 50,
    label: "Free shipping",
    minimumSubtotal: 1000,
    enabled: true,
    terms: "Free shipping on orders with subtotal of EGP 1,000 or more.",
    usageNote: "Preview-only shipping discount. Backend should enforce shipping rules and usage limits.",
  },
];

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function normalizeCategorySlug(category: string) {
  return category.trim().toLowerCase().replace(/&/g, "and").replace(/[\s_]+/g, "-");
}

function getEligibleSubtotal(coupon: Coupon, items: CartItem[], subtotal: number) {
  if (!coupon.categorySlugs?.length) return subtotal;

  return items.reduce((total, item) => {
    const categorySlug = normalizeCategorySlug(item.product.category);
    if (!coupon.categorySlugs?.includes(categorySlug)) return total;

    return total + item.product.currentPrice * item.quantity;
  }, 0);
}

export function validateCoupon(
  code: string,
  {
    subtotal,
    shipping,
    items,
  }: {
    subtotal: number;
    shipping: number;
    items: CartItem[];
  }
): CouponValidationResult {
  const normalizedCode = normalizeCode(code);

  if (!normalizedCode) {
    return { status: "invalid", reason: "empty" };
  }

  const coupon = mockCoupons.find((item) => item.code === normalizedCode);

  if (!coupon) {
    return { status: "invalid", reason: "not_found" };
  }

  if (!coupon.enabled) {
    return { status: "invalid", reason: "unavailable" };
  }

  const eligibleSubtotal = getEligibleSubtotal(coupon, items, subtotal);

  if (coupon.categorySlugs?.length && eligibleSubtotal <= 0) {
    return { status: "invalid", reason: "category_mismatch" };
  }

  const minimumSubtotalBase = coupon.minimumAppliesToEligibleSubtotal
    ? eligibleSubtotal
    : subtotal;

  if (minimumSubtotalBase < coupon.minimumSubtotal) {
    return {
      status: "invalid",
      reason: "minimum",
      minimumSubtotal: coupon.minimumSubtotal,
    };
  }

  if (eligibleSubtotal <= 0) {
    return { status: "invalid", reason: "not_eligible" };
  }

  const discount =
    coupon.type === "percentage"
      ? Math.round(eligibleSubtotal * (coupon.value / 100))
      : coupon.type === "fixed"
        ? Math.min(coupon.value, subtotal)
        : Math.min(coupon.value, shipping);

  return {
    status: "valid",
    coupon,
    code: normalizedCode,
    discount: Math.max(0, discount),
  };
}
