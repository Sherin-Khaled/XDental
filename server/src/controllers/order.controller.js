import { prisma } from "../config/db.js";
import {
  createNotification,
  deliverNotificationPush,
} from "../services/notification.service.js";
import { cleanText, isValidId, nextPublicNumber } from "../utils/records.js";
import {
  createOrderRequestFingerprint,
  executeIdempotentOrderCreation,
  normalizeOrderIdempotencyKey,
  OrderIdempotencyError,
} from "../services/orderIdempotency.service.js";
import {
  calculateAuthoritativePricing,
  OrderPricingError,
  serializePricingTotals,
  SHIPPING_METHODS,
} from "../services/orderPricing.service.js";
import {
  createPricingInputFingerprint,
  createPricingQuoteToken,
  PricingQuoteError,
  requiresPriceReview,
  verifyPricingQuoteToken,
} from "../services/pricingQuote.service.js";
import {
  findPublicOrderTracking,
  PUBLIC_ORDER_NUMBER_MAX_LENGTH,
  PUBLIC_PHONE_MAX_LENGTH,
} from "../services/publicOrderTracking.service.js";
import {
  applyLoyaltyPricing,
  awardDeliveredOrderLoyalty,
  debitOrderLoyalty,
  LoyaltyError,
  restoreOrderLoyalty,
  serializeLoyaltyPricing,
} from "../services/loyalty.service.js";
import {
  commitOrderStatusTransition,
  OrderRequestError,
} from "../services/orderStock.service.js";

const PAYMENT_METHOD = "cash";
const ORDER_STATUSES = new Set([
  "PENDING_REVIEW",
  "CONFIRMED",
  "PREPARING",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "REJECTED",
  "CANCELED",
]);
const PAYMENT_STATUSES = new Set(["PENDING_COLLECTION", "PAID"]);
const ORDER_STATUS_TRANSITIONS = {
  PENDING_REVIEW: new Set(["CONFIRMED", "REJECTED", "CANCELED"]),
  CONFIRMED: new Set(["PREPARING", "CANCELED"]),
  PREPARING: new Set(["OUT_FOR_DELIVERY", "CANCELED"]),
  OUT_FOR_DELIVERY: new Set(["DELIVERED", "CANCELED"]),
  DELIVERED: new Set(),
  REJECTED: new Set(),
  CANCELED: new Set(),
};

const STATUS_NOTIFICATION_COPY = {
  PENDING_REVIEW: {
    title: "Order status updated",
    body: "Your order is pending review.",
  },
  CONFIRMED: {
    title: "Order confirmed",
    body: "Your order has been confirmed and is now being prepared for delivery.",
  },
  PREPARING: {
    title: "Order is being prepared",
    body: "The X Dental Store team is preparing your order for delivery.",
  },
  OUT_FOR_DELIVERY: {
    title: "Order is out for delivery",
    body: "Your order is on the way with the X Dental Store delivery team.",
  },
  DELIVERED: {
    title: "Order delivered",
    body: "Your order has been delivered.",
  },
  REJECTED: {
    title: "Order rejected",
    body: "Your order could not be confirmed. Please contact support if you need help.",
  },
  CANCELED: {
    title: "Order canceled",
    body: "Your order has been canceled. Contact support if you have any questions.",
  },
};

const PUBLIC_TRACKING_FAILURE_MESSAGE = "We could not find an order matching these details.";

class PriceReviewRequiredError extends Error {
  constructor(totals) {
    super("Pricing changed. Review the updated total before placing your order.");
    this.name = "PriceReviewRequiredError";
    this.statusCode = 409;
    this.code = "PRICE_CHANGED_REVIEW_REQUIRED";
    this.totals = totals;
  }
}

function safeOrderErrorPayload(error) {
  return {
    message: error.message,
    ...(error.code ? { code: error.code } : {}),
    ...(error.requestedQuantity !== undefined
      ? { requestedQuantity: error.requestedQuantity }
      : {}),
    ...(error.availableQuantity !== undefined
      ? { availableQuantity: error.availableQuantity }
      : {}),
    ...(error.productId !== undefined ? { productId: error.productId } : {}),
    ...(error.productName !== undefined
      ? { productName: error.productName }
      : {}),
  };
}

const orderInclude = {
  user: {
    select: { id: true, name: true, email: true, phone: true, role: true },
  },
  items: { orderBy: { createdAt: "asc" } },
};

function parseAddress(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function serializeOrder(order) {
  const address = parseAddress(order.shippingAddress);
  const storedBreakdown = order.pricingBreakdown
    && typeof order.pricingBreakdown === "object"
    && !Array.isArray(order.pricingBreakdown)
      ? order.pricingBreakdown
      : null;
  const safeSource = (source) => source && typeof source === "object"
    ? {
        type: typeof source.type === "string" ? source.type : "",
        titleEn: typeof source.titleEn === "string" ? source.titleEn : "",
        titleAr: typeof source.titleAr === "string" ? source.titleAr : "",
      }
    : null;
  const hasPricingSnapshot = Boolean(
    storedBreakdown
    || order.shippingBeforeDiscount !== null
    || order.productPromotionSavings !== null
  );
  const shippingBeforeDiscount = Number(order.shippingBeforeDiscount ?? order.shipping ?? 0);
  const shippingDiscount = Number(order.shippingDiscount ?? 0);
  const productPromotionSavings = Number(order.productPromotionSavings ?? 0);
  const monetaryDiscount = Number(order.discount ?? 0);
  const loyaltySnapshot = storedBreakdown?.loyalty
    && typeof storedBreakdown.loyalty === "object"
    && !Array.isArray(storedBreakdown.loyalty)
      ? storedBreakdown.loyalty
      : null;
  const pointsRedeemed = Number(order.pointsRedeemed ?? loyaltySnapshot?.pointsRedeemed ?? 0);
  const pointsRedemptionValue = Number(
    order.pointsRedemptionValue ?? loyaltySnapshot?.pointsRedemptionValue ?? 0
  );
  const walletCreditUsed = Number(
    order.walletCreditUsed ?? loyaltySnapshot?.walletCreditUsed ?? 0
  );
  const remainingCodAmount = Number(
    order.remainingCodAmount
      ?? loyaltySnapshot?.remainingCodAmount
      ?? order.total
      ?? 0
  );
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    subtotal: Number(order.subtotal ?? 0),
    shipping: Number(order.shipping ?? 0),
    discount: Number(order.discount ?? 0),
    total: Number(order.total ?? 0),
    pointsRedeemed,
    pointsRedemptionValue,
    walletCreditUsed,
    remainingCodAmount,
    pricing: hasPricingSnapshot
      ? {
          hasSnapshot: true,
          originalSubtotal: Number(storedBreakdown?.originalSubtotal ?? order.subtotal ?? 0),
          productPromotionSavings,
          shippingBeforeDiscount,
          shippingDiscount,
          deliveryOfferDiscount: Number(storedBreakdown?.deliveryOfferDiscount ?? 0),
          vipShippingDiscount: Number(storedBreakdown?.vipShippingDiscount ?? 0),
          scheduledPromotionDiscount: Number(order.scheduledPromotionDiscount ?? 0),
          couponDiscount: Number(order.couponDiscount ?? 0),
          vipDiscount: Number(order.vipDiscount ?? 0),
          monetaryDiscount,
          totalSavings: Number(
            storedBreakdown?.totalSavings
            ?? productPromotionSavings + shippingDiscount + monetaryDiscount
          ),
          winningMonetarySource: safeSource(storedBreakdown?.winningMonetarySource),
          freeShippingSource: safeSource(storedBreakdown?.freeShippingSource),
          deliveryOffer: safeSource(storedBreakdown?.deliveryOffer),
          vipShippingSource: safeSource(storedBreakdown?.vipShippingSource),
          loyalty: loyaltySnapshot
            ? {
                pointsRedeemed,
                pointsRedemptionValue,
                walletCreditUsed,
                remainingCodAmount,
                eligibleEarningAmount: Number(loyaltySnapshot.eligibleEarningAmount ?? 0),
                earningRatePointsPerEgp10: Number(
                  loyaltySnapshot.earningRatePointsPerEgp10 ?? 0
                ),
              }
            : null,
        }
      : null,
    customerName: order.customerName ?? "",
    customerEmail: order.customerEmail ?? "",
    customerPhone: order.customerPhone ?? "",
    customer: {
      id: order.user?.id ?? order.userId,
      name: order.customerName ?? order.user?.name ?? "",
      email: order.customerEmail ?? order.user?.email ?? "",
      phone: order.customerPhone ?? order.user?.phone ?? "",
      role: typeof order.user?.role === "string" ? order.user.role.toLowerCase() : "customer",
    },
    shippingAddress: {
      name: order.customerName ?? "",
      line1: [address.building, address.street].filter(Boolean).join(" "),
      city: address.cityArea ?? "",
      governorate: address.governorate ?? "",
      country: address.country ?? "Egypt",
      phone: order.customerPhone ?? "",
      apartmentFloor: address.apartmentFloor ?? "",
      postalCode: address.postalCode ?? "",
      deliveryNotes: address.deliveryNotes ?? "",
      clinicName: address.clinicName ?? "",
      clinicBranch: address.clinicBranch ?? "",
    },
    deliveryMethod: address.deliveryMethod ?? "",
    orderNotes: address.orderNotes ?? "",
    paymentMethod: order.paymentMethod ?? "",
    syncStatus: order.syncStatus ?? null,
    itemCount: order.items.reduce((count, item) => count + item.quantity, 0),
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId ?? null,
      externalProductId: item.externalProductId ?? null,
      variantId: item.variantId ?? null,
      externalVariantId: item.externalVariantId ?? null,
      productName: item.productName,
      sku: item.sku ?? "",
      variantSku: item.variantSku ?? null,
      variantBarcode: item.variantBarcode ?? null,
      selectedOptions: item.selectedOptions ?? null,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice ?? 0),
      variantUnitPrice: item.variantUnitPrice === null ? null : Number(item.variantUnitPrice ?? 0),
      total: Number(item.total ?? 0),
      originalUnitPrice:
        item.originalUnitPrice === null ? null : Number(item.originalUnitPrice),
      promotionDiscount:
        item.promotionDiscount === null ? null : Number(item.promotionDiscount),
      promotionSourceType: item.promotionSourceType ?? null,
      promotionTitleEn: item.promotionTitleEn ?? null,
      promotionTitleAr: item.promotionTitleAr ?? null,
    })),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function readRequiredText(body, keys, label, maxLength = 300) {
  const value = keys.map((key) => cleanText(body?.[key], maxLength)).find(Boolean) ?? "";
  return value ? { value } : { error: `${label} is required.` };
}

export async function trackPublicOrder(request, response) {
  const body = request.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return response.status(400).json({ message: "Order number and phone are required." });
  }

  const acceptedFields = new Set(["orderNumber", "phone"]);
  if (Object.keys(body).some((key) => !acceptedFields.has(key))) {
    return response.status(400).json({ message: "Only orderNumber and phone are accepted." });
  }

  if (typeof body.orderNumber !== "string" || !body.orderNumber.trim()) {
    return response.status(400).json({ message: "Order number is required.", field: "orderNumber" });
  }
  if (body.orderNumber.trim().length > PUBLIC_ORDER_NUMBER_MAX_LENGTH) {
    return response.status(400).json({ message: "Order number is invalid.", field: "orderNumber" });
  }
  if (typeof body.phone !== "string" || !body.phone.trim()) {
    return response.status(400).json({ message: "Phone number is required.", field: "phone" });
  }
  if (body.phone.trim().length > PUBLIC_PHONE_MAX_LENGTH) {
    return response.status(400).json({ message: "Phone number is invalid.", field: "phone" });
  }

  const order = await findPublicOrderTracking(prisma, {
    orderNumber: body.orderNumber,
    phone: body.phone,
  });
  if (!order) {
    return response.status(404).json({ message: PUBLIC_TRACKING_FAILURE_MESSAGE });
  }

  response.setHeader("Cache-Control", "private, no-store");
  return response.json(order);
}

export function parseItemReference(item, index) {
  const selectedOptions = cleanText(item?.selectedOptions, 300);
  const quantity = Number(item?.quantity);
  const productId = cleanText(item?.productId, 200) || null;
  const externalProductId = cleanText(item?.externalProductId, 200) || null;
  const variantId = cleanText(item?.variantId, 200) || null;
  const sku = cleanText(item?.sku, 120) || null;
  const slug = cleanText(item?.slug, 200) || null;

  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 10000) {
    return { error: `Item ${index + 1} quantity must be a positive whole number.` };
  }
  if (!productId && !externalProductId && !sku && !slug) {
    return { error: `Item ${index + 1} must include a product ID, external product ID, SKU, or slug.` };
  }

  return {
    value: {
      productId,
      externalProductId,
      variantId,
      sku,
      slug,
      selectedOptions,
      quantity,
    },
  };
}

export async function calculateAuthoritativeTotals(database, input) {
  return calculateAuthoritativePricing(database, input);
}

function serializeValidatedPromotionCode(code) {
  return code
    ? {
        code: code.code,
        titleEn: code.titleEn,
        titleAr: code.titleAr,
        discountType: code.discountType,
        value: code.value,
        minimumOrderAmount: code.minimumOrderAmount,
      }
    : null;
}

export async function previewPublicCoupon(request, response) {
  const rawItems = Array.isArray(request.body?.items) ? request.body.items : [];
  if (!rawItems.length || rawItems.length > 100) {
    return response.status(400).json({ message: "Between 1 and 100 cart items are required." });
  }
  const parsedItems = rawItems.map(parseItemReference);
  const itemError = parsedItems.find((result) => result.error)?.error;
  if (itemError) return response.status(400).json({ message: itemError });
  const promoCode = cleanText(request.body?.promoCode, 100);
  if (!promoCode) return response.status(400).json({ message: "Enter a coupon code." });

  try {
    const pricing = await prisma.$transaction((database) =>
      calculateAuthoritativeTotals(database, {
        userId: request.user?.role === "customer" ? request.user.id : null,
        itemReferences: parsedItems.map((result) => result.value),
        deliveryMethod: "standard",
        promoCode,
        clinicLocationId: null,
      })
    );
    if (!pricing.validatedCode) {
      return response.status(400).json({ message: "This coupon is unavailable." });
    }
    return response.json({
      coupon: serializeValidatedPromotionCode(pricing.validatedCode),
      totals: serializePricingTotals(pricing),
    });
  } catch (error) {
    if (error instanceof OrderPricingError) {
      return response.status(error.statusCode).json(safeOrderErrorPayload(error));
    }
    throw error;
  }
}

export async function previewOrderTotals(request, response) {
  const deliveryMethod = cleanText(request.body?.deliveryMethod, 50).toLowerCase();
  if (!(deliveryMethod in SHIPPING_METHODS)) {
    return response.status(400).json({ message: "Delivery method is invalid." });
  }
  const rawItems = Array.isArray(request.body?.items) ? request.body.items : [];
  if (!rawItems.length || rawItems.length > 100) {
    return response.status(400).json({ message: "Between 1 and 100 cart items are required." });
  }
  const parsedItems = rawItems.map(parseItemReference);
  const itemError = parsedItems.find((result) => result.error)?.error;
  if (itemError) return response.status(400).json({ message: itemError });

  const itemReferences = parsedItems.map((result) => result.value);
  const promoCode = cleanText(request.body?.promoCode, 100).toUpperCase();
  const clinicLocationId = cleanText(request.body?.clinicLocationId, 200) || null;
  const requestedPoints = request.body?.requestedPoints ?? 0;
  const requestedWalletAmount = request.body?.requestedWalletAmount ?? 0;

  try {
    const pricing = await prisma.$transaction(async (database) => {
      const authoritativePricing = await calculateAuthoritativeTotals(database, {
        userId: request.user.id,
        itemReferences,
        deliveryMethod,
        promoCode,
        clinicLocationId,
      });
      return applyLoyaltyPricing(database, {
        userId: request.user.id,
        pricing: authoritativePricing,
        requestedPoints,
        requestedWalletAmount,
      });
    });
    const pricingInputFingerprint = createPricingInputFingerprint({
      itemReferences,
      deliveryMethod,
      promoCode,
      clinicLocationId,
      requestedPoints,
      requestedWalletAmount,
    });
    const pricingQuoteToken = createPricingQuoteToken({
      userId: request.user.id,
      inputFingerprint: pricingInputFingerprint,
      reviewedTotalCents: pricing.totalCents,
    });
    return response.json({
      totals: {
        ...serializePricingTotals(pricing, pricingQuoteToken),
        ...serializeLoyaltyPricing(pricing),
      },
    });
  } catch (error) {
    if (
      error instanceof OrderPricingError
      || error instanceof PricingQuoteError
      || error instanceof LoyaltyError
    ) {
      return response.status(error.statusCode).json(safeOrderErrorPayload(error));
    }
    throw error;
  }
}

export async function createOrder(request, response) {
  const rawIdempotencyKey = request.get("Idempotency-Key");
  if (!rawIdempotencyKey) {
    return response.status(400).json({
      message: "A checkout request key is required. Please refresh checkout and try again.",
      code: "IDEMPOTENCY_KEY_REQUIRED",
    });
  }
  const idempotencyKey = normalizeOrderIdempotencyKey(rawIdempotencyKey);
  if (!idempotencyKey) {
    return response.status(400).json({
      message: "The checkout request key is invalid. Please refresh checkout and try again.",
      code: "INVALID_IDEMPOTENCY_KEY",
    });
  }

  const customerName = readRequiredText(request.body, ["customerName"], "Customer name");
  const customerEmail = readRequiredText(request.body, ["customerEmail"], "Customer email", 320);
  const customerPhone = readRequiredText(request.body, ["customerPhone"], "Customer phone", 80);
  const governorate = readRequiredText(request.body, ["governorate"], "Governorate");
  const cityArea = readRequiredText(request.body, ["cityArea", "city"], "City / area");
  const street = readRequiredText(request.body, ["streetAddress", "street"], "Street");
  const building = readRequiredText(request.body, ["buildingNumber", "building"], "Building");

  const firstError = [customerName, customerEmail, customerPhone, governorate, cityArea, street, building]
    .find((result) => result.error)?.error;
  if (firstError) return response.status(400).json({ message: firstError });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.value)) {
    return response.status(400).json({ message: "Customer email is invalid." });
  }

  const deliveryMethod = cleanText(request.body?.deliveryMethod, 50).toLowerCase();
  const paymentMethod = cleanText(request.body?.paymentMethod, 50).toLowerCase();
  if (!(deliveryMethod in SHIPPING_METHODS)) {
    return response.status(400).json({ message: "Delivery method is invalid." });
  }
  if (paymentMethod !== PAYMENT_METHOD) {
    return response.status(400).json({
      message: "Only Cash on Delivery is supported for this launch.",
    });
  }

  const rawItems = Array.isArray(request.body?.items) ? request.body.items : [];
  if (rawItems.length === 0) {
    return response.status(400).json({ message: "At least one cart item is required." });
  }
  if (rawItems.length > 100) {
    return response.status(400).json({ message: "An order cannot contain more than 100 items." });
  }

  const parsedItems = rawItems.map(parseItemReference);
  const itemError = parsedItems.find((result) => result.error)?.error;
  if (itemError) return response.status(400).json({ message: itemError });
  const itemReferences = parsedItems.map((result) => result.value);
  const promoCode = cleanText(request.body?.promoCode, 100).toUpperCase();
  const clinicLocationId = cleanText(request.body?.clinicLocationId, 200) || null;
  const requestedPoints = request.body?.requestedPoints ?? 0;
  const requestedWalletAmount = request.body?.requestedWalletAmount ?? 0;
  const pricingQuoteToken = cleanText(request.body?.pricingQuoteToken, 4096);
  const shippingAddressSnapshot = {
    country: cleanText(request.body?.country, 120) || "Egypt",
    governorate: governorate.value,
    cityArea: cityArea.value,
    street: street.value,
    building: building.value,
    apartmentFloor: cleanText(request.body?.apartmentFloor, 120),
    postalCode: cleanText(request.body?.postalCode, 40),
    deliveryNotes: cleanText(request.body?.deliveryNotes, 2000),
    clinicName: cleanText(request.body?.clinicName, 300),
    clinicBranch: cleanText(request.body?.clinicBranch, 300),
    orderNotes: cleanText(request.body?.orderNotes, 3000),
    deliveryMethod,
    clinicLocationId,
  };
  const shippingAddress = JSON.stringify(shippingAddressSnapshot);
  const requestFingerprint = createOrderRequestFingerprint({
    contact: {
      name: customerName.value,
      email: customerEmail.value.toLowerCase(),
      phone: customerPhone.value,
    },
    deliveryMethod,
    paymentMethod,
    promoCode,
    requestedPoints,
    requestedWalletAmount,
    clinicLocationId,
    items: itemReferences,
    shippingAddress: shippingAddressSnapshot,
  });

  try {
    const result = await executeIdempotentOrderCreation({
      database: prisma,
      userId: request.user.id,
      idempotencyKey,
      requestFingerprint,
      include: orderInclude,
      create: async (database) => {
        const pricingInputFingerprint = createPricingInputFingerprint({
          itemReferences,
          deliveryMethod,
          promoCode,
          clinicLocationId,
          requestedPoints,
          requestedWalletAmount,
        });
        const reviewedQuote = verifyPricingQuoteToken(pricingQuoteToken, {
          userId: request.user.id,
          inputFingerprint: pricingInputFingerprint,
        });
        const authoritativePricing = await calculateAuthoritativeTotals(database, {
          userId: request.user.id,
          itemReferences,
          deliveryMethod,
          promoCode,
          clinicLocationId,
        });
        const pricing = await applyLoyaltyPricing(database, {
          userId: request.user.id,
          pricing: authoritativePricing,
          requestedPoints,
          requestedWalletAmount,
        });
        if (requiresPriceReview(pricing.totalCents, reviewedQuote.total)) {
          const refreshedQuoteToken = createPricingQuoteToken({
            userId: request.user.id,
            inputFingerprint: pricingInputFingerprint,
            reviewedTotalCents: pricing.totalCents,
          });
          throw new PriceReviewRequiredError(
            {
              ...serializePricingTotals(pricing, refreshedQuoteToken),
              ...serializeLoyaltyPricing(pricing),
            }
          );
        }
        const {
          items,
          subtotalCents,
          shippingCents,
          monetaryDiscountCents,
          totalCents,
        } = pricing;
        const createdOrder = await database.order.create({
          data: {
            userId: request.user.id,
            orderNumber: nextPublicNumber("ORD"),
            idempotencyKey,
            requestFingerprint,
            status: "PENDING_REVIEW",
            paymentStatus:
              pricing.remainingCodCents === 0 ? "PAID" : "PENDING_COLLECTION",
            subtotal: subtotalCents / 100,
            shipping: shippingCents / 100,
            discount: monetaryDiscountCents / 100,
            total: totalCents / 100,
            shippingBeforeDiscount: pricing.shippingBeforeDiscountCents / 100,
            shippingDiscount: pricing.shippingDiscountCents / 100,
            productPromotionSavings: pricing.productPromotionSavingsCents / 100,
            scheduledPromotionDiscount: pricing.scheduledPromotionDiscountCents / 100,
            couponDiscount: pricing.couponDiscountCents / 100,
            vipDiscount: pricing.vipDiscountCents / 100,
            pointsRedeemed: pricing.pointsRedeemed,
            pointsRedemptionValue: pricing.pointsRedemptionValueCents / 100,
            walletCreditUsed: pricing.walletCreditUsedCents / 100,
            remainingCodAmount: pricing.remainingCodCents / 100,
            pricingBreakdown: {
              ...pricing.pricingBreakdown,
              totalSavings: pricing.totalDiscountCents / 100,
            },
            customerName: customerName.value,
            customerEmail: customerEmail.value.toLowerCase(),
            customerPhone: customerPhone.value,
            shippingAddress,
            paymentMethod,
            syncStatus: "PENDING",
            items: {
              create: items.map((item) => ({
                productId: item.productId,
                externalProductId: item.externalProductId,
                variantId: item.variantId,
                externalVariantId: item.externalVariantId,
                productName: item.productName,
                sku: item.sku,
                variantSku: item.variantSku,
                variantBarcode: item.variantBarcode,
                selectedOptions: item.selectedOptions,
                quantity: item.quantity,
                unitPrice: item.unitPriceCents / 100,
                variantUnitPrice: item.variantUnitPriceCents === null ? null : item.variantUnitPriceCents / 100,
                total: item.totalCents / 100,
                originalUnitPrice: item.originalUnitPriceCents / 100,
                promotionDiscount: item.promotionDiscountCents / 100,
                promotionSourceType: item.promotionSourceType,
                promotionSourceId: item.promotionSourceId,
                promotionTitleEn: item.promotionTitleEn,
                promotionTitleAr: item.promotionTitleAr,
              })),
            },
          },
          include: orderInclude,
        });

        const loyaltyNotifications = await debitOrderLoyalty(
          database,
          createdOrder,
          pricing
        );

        await database.syncLog.create({
          data: {
            entityType: "Order",
            entityId: createdOrder.id,
            direction: "WEBSITE_TO_OWNER",
            status: "PENDING",
            message: "Order is waiting for a future owner-system export adapter.",
          },
        });
        await database.cartItem.deleteMany({
          where: { userId: request.user.id },
        });
        // TODO: Later: export confirmed/pending orders to owner system through integration adapter.
        return { ...createdOrder, loyaltyNotifications };
      },
    });

    if (result.idempotentReplay) {
      response.setHeader("Idempotency-Replayed", "true");
    }
    if (result.created) {
      await Promise.all(
        (result.order.loyaltyNotifications ?? []).map((notification) =>
          deliverNotificationPush(notification)
        )
      );
    }
    return response
      .status(result.created ? 201 : 200)
      .json({
        order: serializeOrder(result.order),
        idempotentReplay: result.idempotentReplay,
      });
  } catch (error) {
    if (error instanceof OrderIdempotencyError) {
      return response.status(error.statusCode).json({
        message: error.message,
        code: error.code,
      });
    }
    if (error instanceof OrderRequestError) {
      return response.status(error.statusCode).json({ message: error.message });
    }
    if (
      error instanceof OrderPricingError
      || error instanceof PricingQuoteError
      || error instanceof LoyaltyError
    ) {
      return response.status(error.statusCode).json(safeOrderErrorPayload(error));
    }
    if (error instanceof PriceReviewRequiredError) {
      return response.status(error.statusCode).json({
        message: error.message,
        code: error.code,
        totals: error.totals,
      });
    }
    throw error;
  }
}

export async function getMyOrders(request, response) {
  const orders = await prisma.order.findMany({
    where: { userId: request.user.id },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
  });
  return response.json({ orders: orders.map(serializeOrder) });
}

export async function getMyOrder(request, response) {
  if (!isValidId(request.params.id)) {
    return response.status(404).json({ message: "Order not found." });
  }
  const order = await prisma.order.findFirst({
    where: { id: request.params.id, userId: request.user.id },
    include: orderInclude,
  });
  if (!order) return response.status(404).json({ message: "Order not found." });
  return response.json({ order: serializeOrder(order) });
}

export async function getAdminOrders(request, response) {
  const status = cleanText(request.query?.status, 50).toUpperCase();
  const search = cleanText(request.query?.search, 160);

  if (status && !ORDER_STATUSES.has(status)) {
    return response.status(400).json({ message: "Order status filter is invalid." });
  }

  const orders = await prisma.order.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { orderNumber: { contains: search, mode: "insensitive" } },
              { customerName: { contains: search, mode: "insensitive" } },
              { customerEmail: { contains: search, mode: "insensitive" } },
              { customerPhone: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
  });

  return response.json({ orders: orders.map(serializeOrder) });
}

export async function getAdminOrder(request, response) {
  if (!isValidId(request.params.id)) {
    return response.status(404).json({ message: "Order not found." });
  }

  const order = await prisma.order.findUnique({
    where: { id: request.params.id },
    include: orderInclude,
  });
  if (!order) return response.status(404).json({ message: "Order not found." });

  return response.json({ order: serializeOrder(order) });
}

export async function updateAdminOrderStatus(request, response) {
  if (!isValidId(request.params.id)) {
    return response.status(404).json({ message: "Order not found." });
  }

  const status = cleanText(request.body?.status, 50).toUpperCase();
  if (!ORDER_STATUSES.has(status)) {
    return response.status(400).json({
      message: "Order status is invalid.",
    });
  }

  try {
    const result = await prisma.$transaction(async (database) => {
      const currentOrder = await database.order.findUnique({
        where: { id: request.params.id },
        include: orderInclude,
      });
      if (!currentOrder) return null;
      if (currentOrder.status === status) {
        return { order: currentOrder, statusChanged: false };
      }
      if (!ORDER_STATUS_TRANSITIONS[currentOrder.status]?.has(status)) {
        throw new OrderRequestError(
          409,
          `Order cannot move from ${currentOrder.status} to ${status}.`
        );
      }

      const { won } = await commitOrderStatusTransition(database, currentOrder, status);
      if (!won) {
        const latestOrder = await database.order.findUnique({
          where: { id: currentOrder.id },
          include: orderInclude,
        });
        if (latestOrder?.status === status) {
          return { order: latestOrder, statusChanged: false };
        }
        throw new OrderRequestError(409, "Order status changed in another request. Refresh and try again.");
      }

      let loyaltyNotifications = [];
      if (status === "CANCELED" || status === "REJECTED") {
        loyaltyNotifications = await restoreOrderLoyalty(database, currentOrder);
      } else if (status === "DELIVERED") {
        loyaltyNotifications = await awardDeliveredOrderLoyalty(
          database,
          { ...currentOrder, status }
        );
      }

      const order = await database.order.findUnique({
        where: { id: currentOrder.id },
        include: orderInclude,
      });
      const notificationCopy = STATUS_NOTIFICATION_COPY[status];
      let notification = null;
      if (notificationCopy) {
        notification = await createNotification(
          {
            userId: currentOrder.userId,
            type: "ORDER_UPDATE",
            title: notificationCopy.title,
            body: notificationCopy.body,
            link: `/account/orders/${currentOrder.id}`,
            metadata: {
              orderId: currentOrder.id,
              orderNumber: currentOrder.orderNumber,
              previousStatus: currentOrder.status,
              status,
            },
          },
          database
        );
      }

      // TODO: Later: export confirmed orders to owner system integration adapter.
      return {
        order,
        statusChanged: true,
        notification,
        loyaltyNotifications,
      };
    });

    if (!result) return response.status(404).json({ message: "Order not found." });
    await Promise.all([
      deliverNotificationPush(result.notification),
      ...(result.loyaltyNotifications ?? []).map((notification) =>
        deliverNotificationPush(notification)
      ),
    ]);
    return response.json({
      order: serializeOrder(result.order),
      statusChanged: result.statusChanged,
    });
  } catch (error) {
    if (
      error instanceof OrderRequestError
      || error instanceof OrderPricingError
      || error instanceof LoyaltyError
    ) {
      return response.status(error.statusCode).json(safeOrderErrorPayload(error));
    }
    throw error;
  }
}

export async function updateAdminOrderPaymentStatus(request, response) {
  if (!isValidId(request.params.id)) {
    return response.status(404).json({ message: "Order not found." });
  }

  const paymentStatus = cleanText(request.body?.paymentStatus, 50).toUpperCase();
  if (!PAYMENT_STATUSES.has(paymentStatus)) {
    return response.status(400).json({
      message: "Payment status must be PENDING_COLLECTION or PAID.",
    });
  }

  try {
    const result = await prisma.$transaction(async (database) => {
      const currentOrder = await database.order.findUnique({
        where: { id: request.params.id },
        include: orderInclude,
      });
      if (!currentOrder) return null;
      if (currentOrder.paymentStatus === paymentStatus) {
        return { order: currentOrder, paymentStatusChanged: false };
      }
      if (currentOrder.paymentMethod !== PAYMENT_METHOD) {
        throw new OrderRequestError(409, "Cash collection can only be recorded for Cash on Delivery orders.");
      }
      if (currentOrder.paymentStatus !== "PENDING_COLLECTION" || paymentStatus !== "PAID") {
        throw new OrderRequestError(409, "Payment status can only move from pending collection to paid.");
      }
      if (currentOrder.status === "REJECTED" || currentOrder.status === "CANCELED") {
        throw new OrderRequestError(409, "Cash cannot be collected for a rejected or canceled order.");
      }

      const transition = await database.order.updateMany({
        where: {
          id: currentOrder.id,
          paymentStatus: currentOrder.paymentStatus,
        },
        data: { paymentStatus },
      });
      if (transition.count !== 1) {
        const latestOrder = await database.order.findUnique({
          where: { id: currentOrder.id },
          include: orderInclude,
        });
        if (latestOrder?.paymentStatus === paymentStatus) {
          return { order: latestOrder, paymentStatusChanged: false };
        }
        throw new OrderRequestError(409, "Payment status changed in another request. Refresh and try again.");
      }

      const order = await database.order.findUnique({
        where: { id: currentOrder.id },
        include: orderInclude,
      });
      const notification = await createNotification(
        {
          userId: currentOrder.userId,
          type: "ORDER_UPDATE",
          title: "Cash payment received",
          body: "Your Cash on Delivery payment has been marked as paid.",
          link: `/account/orders/${currentOrder.id}`,
          metadata: {
            orderId: currentOrder.id,
            orderNumber: currentOrder.orderNumber,
            previousPaymentStatus: currentOrder.paymentStatus,
            paymentStatus,
          },
        },
        database
      );

      return { order, paymentStatusChanged: true, notification };
    });

    if (!result) return response.status(404).json({ message: "Order not found." });
    await deliverNotificationPush(result.notification);
    return response.json({
      order: serializeOrder(result.order),
      paymentStatusChanged: result.paymentStatusChanged,
    });
  } catch (error) {
    if (error instanceof OrderRequestError) {
      return response.status(error.statusCode).json({ message: error.message });
    }
    throw error;
  }
}
