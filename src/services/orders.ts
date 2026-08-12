import { apiRequest } from "./http";

export type OrderStatus =
  | "PENDING_REVIEW"
  | "CONFIRMED"
  | "PREPARING"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "REJECTED"
  | "CANCELED";

export type OrderStatusLabel =
  | "Pending Review"
  | "Confirmed"
  | "Preparing"
  | "Out for Delivery"
  | "Delivered"
  | "Rejected"
  | "Canceled";

export type PaymentStatus = "PENDING_COLLECTION" | "PAID";
export type PaymentStatusLabel = "Pending Collection" | "Paid";

export type PublicOrderTrackingResult = {
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
};

export type OrderItem = {
  id: string;
  productId: string | null;
  externalProductId: string | null;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
  originalUnitPrice: number | null;
  promotionDiscount: number | null;
  promotionSourceType: string | null;
  promotionTitleEn: string | null;
  promotionTitleAr: string | null;
};

export type PricingSource = {
  type: string;
  titleEn: string;
  titleAr: string;
};

export type OrderPricingSnapshot = {
  hasSnapshot: true;
  originalSubtotal: number;
  productPromotionSavings: number;
  shippingBeforeDiscount: number;
  shippingDiscount: number;
  deliveryOfferDiscount: number;
  vipShippingDiscount: number;
  scheduledPromotionDiscount: number;
  couponDiscount: number;
  vipDiscount: number;
  monetaryDiscount: number;
  totalSavings: number;
  winningMonetarySource: PricingSource | null;
  freeShippingSource: PricingSource | null;
  deliveryOffer: PricingSource | null;
  vipShippingSource: PricingSource | null;
  loyalty: {
    pointsRedeemed: number;
    pointsRedemptionValue: number;
    walletCreditUsed: number;
    remainingCodAmount: number;
    eligibleEarningAmount: number;
    earningRatePointsPerEgp10: number;
  } | null;
};

export type CustomerOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  pointsRedeemed: number;
  pointsRedemptionValue: number;
  walletCreditUsed: number;
  remainingCodAmount: number;
  pricing: OrderPricingSnapshot | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: {
    name: string;
    line1: string;
    city: string;
    governorate: string;
    country: string;
    phone: string;
    apartmentFloor: string;
    postalCode: string;
    deliveryNotes: string;
    clinicName: string;
    clinicBranch: string;
  };
  deliveryMethod: string;
  orderNotes: string;
  paymentMethod: string;
  syncStatus: string | null;
  itemCount: number;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
};

export type CreateOrderInput = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  country: string;
  governorate: string;
  cityArea: string;
  streetAddress: string;
  buildingNumber: string;
  apartmentFloor?: string;
  postalCode?: string;
  deliveryNotes?: string;
  clinicName?: string;
  clinicBranch?: string;
  orderNotes?: string;
  deliveryMethod: string;
  paymentMethod: string;
  promoCode?: string;
  clinicLocationId?: string | null;
  pricingQuoteToken?: string;
  requestedPoints?: number;
  requestedWalletAmount?: number | string;
  items: Array<{
    productId?: string;
    externalProductId?: string;
    sku?: string;
    slug?: string;
    selectedOptions?: string;
    quantity: number;
  }>;
};

export type TrustedOrderTotals = {
  originalSubtotal: number;
  subtotal: number;
  productPromotionSavings: number;
  monetaryDiscount: number;
  scheduledPromotionDiscount: number;
  couponDiscount: number;
  vipDiscount: number;
  shippingBeforeDiscount: number;
  deliveryOfferDiscount: number;
  vipShippingDiscount: number;
  shippingDiscount: number;
  shipping: number;
  discount: number;
  totalSavings: number;
  total: number;
  availablePoints: number;
  pendingPoints: number;
  welcomePointsAvailable: number;
  welcomeMinimumSubtotal: number;
  welcomePointsEligible: boolean;
  pointValue: number;
  walletBalance: number;
  maximumRedeemablePoints: number;
  maximumRedemptionValue: number;
  pointsRedeemed: number;
  pointsRedemptionValue: number;
  walletCreditUsed: number;
  remainingCodAmount: number;
  earningRatePointsPerEgp10: number;
  eligibleEarningAmount: number;
  pointsPerRedemptionUnit: number;
  redemptionValueEgp: number;
  minimumRedemptionPoints: number;
  maximumRedemptionPercent: number;
  welcomeExpiryDays: number;
  winningMonetarySource: PricingSource | null;
  freeShippingSource: PricingSource | null;
  deliveryOffer: PricingSource | null;
  vipShippingSource: PricingSource | null;
  appliedBenefits: Array<{
    type: string;
    titleEn: string;
    titleAr: string;
    lifecycle: string;
  }>;
  appliedCoupon?: {
    code: string;
    discountType: string;
    value: number;
    minimumOrderAmount: number;
  } | null;
  combinationRule: string;
  pricingVersion: string;
  pricingQuoteToken?: string;
};

export type CreateOrderResponse = {
  order: CustomerOrder;
  idempotentReplay: boolean;
};

export function getOrderStatusLabel(status: OrderStatus): OrderStatusLabel {
  const labels: Record<OrderStatus, OrderStatusLabel> = {
    PENDING_REVIEW: "Pending Review",
    CONFIRMED: "Confirmed",
    PREPARING: "Preparing",
    OUT_FOR_DELIVERY: "Out for Delivery",
    DELIVERED: "Delivered",
    REJECTED: "Rejected",
    CANCELED: "Canceled",
  };
  return labels[status];
}

export function getPaymentStatusLabel(status: PaymentStatus): PaymentStatusLabel {
  return status === "PAID" ? "Paid" : "Pending Collection";
}

export async function createOrder(
  input: CreateOrderInput,
  idempotencyKey: string
) {
  return apiRequest<CreateOrderResponse>("/orders", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(input),
  });
}

export async function previewOrderTotals(
  input: Pick<CreateOrderInput, "deliveryMethod" | "items" | "promoCode" | "clinicLocationId" | "requestedPoints" | "requestedWalletAmount">,
  signal?: AbortSignal
) {
  const result = await apiRequest<{ totals: TrustedOrderTotals }>("/orders/preview", {
    method: "POST",
    body: JSON.stringify(input),
    signal,
  });
  return result.totals;
}

export async function getMyOrders() {
  const result = await apiRequest<{ orders: CustomerOrder[] }>("/orders/my");
  return result.orders;
}

export async function getMyOrder(id: string) {
  const result = await apiRequest<{ order: CustomerOrder }>(`/orders/my/${encodeURIComponent(id)}`);
  return result.order;
}

export async function trackPublicOrder(orderNumber: string, phone: string) {
  return apiRequest<PublicOrderTrackingResult>("/orders/track", {
    method: "POST",
    body: JSON.stringify({ orderNumber, phone }),
  });
}
