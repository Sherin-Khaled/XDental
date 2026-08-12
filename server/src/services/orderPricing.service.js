import { evaluatePublicCoupon, normalizeCouponCode } from "./coupon.service.js";
import { evaluateCustomerBenefits } from "./customerBenefit.service.js";
import {
  DeliveryOfferEligibilityError,
  evaluateDeliveryOfferPricing,
} from "./deliveryOffer.service.js";
import { resolveEffectiveProductPrices } from "./flashSalePricing.service.js";
import { PRICING_VERSION } from "./pricingQuote.service.js";
import { getEligibleScheduledPromotionPricing } from "./scheduledPromotion.service.js";
import { evaluateStockAvailability } from "./stockAvailability.service.js";
import {
  findProductVariant,
  hasProductVariants,
  isVariantSellable,
  normalizedVariantPrice,
  selectedOptionsSnapshot,
} from "./variantCatalog.service.js";

export const SHIPPING_METHODS = {
  standard: 50,
  fast: 80,
  pickup: 0,
};

const SOURCE_RANK = {
  SCHEDULED_PROMOTION: 1,
  DELIVERY_OFFER: 1,
  VIP_BENEFIT: 2,
  VIP_STANDARD_FREE_SHIPPING: 2,
  VIP_FAST_UPGRADE_ONLY: 2,
  COUPON: 3,
};

export async function evaluateVipTierShipping(
  database,
  { userId, deliveryMethod, shippingCents }
) {
  if (!userId) return { shippingCents, source: null };
  const user = await database.user.findUnique({
    where: { id: userId },
    select: { role: true, customerTier: true, isActive: true },
  });
  if (
    !user
    || user.role !== "CUSTOMER"
    || user.customerTier !== "VIP"
    || !user.isActive
  ) {
    return { shippingCents, source: null };
  }

  const normalStandardCents = SHIPPING_METHODS.standard * 100;
  const vipShippingCents = deliveryMethod === "fast"
    ? Math.max(0, shippingCents - normalStandardCents)
    : 0;
  const sourceType = deliveryMethod === "fast"
    ? "VIP_FAST_UPGRADE_ONLY"
    : "VIP_STANDARD_FREE_SHIPPING";
  return {
    shippingCents: Math.min(shippingCents, vipShippingCents),
    source: {
      sourceType,
      sourceId: sourceType,
      titleEn: deliveryMethod === "fast"
        ? "VIP fast-delivery upgrade only"
        : "VIP standard delivery",
      titleAr: deliveryMethod === "fast"
        ? "ترقية التوصيل السريع لعملاء VIP"
        : "التوصيل القياسي لعملاء VIP",
      createdAt: new Date(0),
    },
  };
}

export class OrderPricingError extends Error {
  constructor(statusCode, message, code = undefined, details = {}) {
    super(message);
    this.name = "OrderPricingError";
    this.statusCode = statusCode;
    this.code = code;
    Object.assign(this, details);
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export async function resolveCatalogItems(database, items) {
  const productIds = unique(items.map((item) => item.productId));
  const externalProductIds = unique(items.map((item) => item.externalProductId));
  const skus = unique(items.map((item) => item.sku));
  const slugs = unique(items.map((item) => item.slug));
  const conditions = [
    ...(productIds.length ? [{ id: { in: productIds } }] : []),
    ...(externalProductIds.length ? [{ externalProductId: { in: externalProductIds } }] : []),
    ...skus.map((sku) => ({ sku: { equals: sku, mode: "insensitive" } })),
    ...slugs.map((slug) => ({ slug: { equals: slug, mode: "insensitive" } })),
  ];
  const products = await database.product.findMany({
    where: { OR: conditions },
    include: { variants: { include: { selections: { include: { option: true, optionValue: true } } } } },
  });
  const byId = new Map(products.map((product) => [product.id, product]));
  const byExternalId = new Map(
    products.filter((product) => product.externalProductId)
      .map((product) => [product.externalProductId, product])
  );
  const bySku = new Map(
    products.filter((product) => product.sku)
      .map((product) => [product.sku.toLowerCase(), product])
  );
  const bySlug = new Map(products.map((product) => [product.slug.toLowerCase(), product]));

  return items.map((item, index) => {
    const product =
      (item.productId ? byId.get(item.productId) : null)
      ?? (item.externalProductId ? byExternalId.get(item.externalProductId) : null)
      ?? (item.sku ? bySku.get(item.sku.toLowerCase()) : null)
      ?? (item.slug ? bySlug.get(item.slug.toLowerCase()) : null);
    if (!product) {
      throw new OrderPricingError(
        409,
        `Cart item ${index + 1} could not be matched to a backend catalog product. Refresh your cart or contact support.`,
        "CATALOG_PRODUCT_NOT_FOUND"
      );
    }
    if (hasProductVariants(product) && !item.variantId) {
      throw new OrderPricingError(409, `${product.name} requires a variant selection.`, "VARIANT_REQUIRED");
    }
    if (!hasProductVariants(product) && item.variantId) {
      throw new OrderPricingError(409, `${product.name} does not have variants.`, "INVALID_VARIANT");
    }
    const variant = item.variantId ? findProductVariant(product, item.variantId) : null;
    if (item.variantId && !variant) {
      throw new OrderPricingError(409, `${product.name} variant is invalid.`, "INVALID_VARIANT");
    }
    return { item, product, variant };
  });
}

export function aggregateProductQuantities(resolvedItems) {
  const requirements = new Map();
  for (const { item, product } of resolvedItems) {
    const current = requirements.get(product.id);
    requirements.set(product.id, {
      product,
      quantity: (current?.quantity ?? 0) + item.quantity,
    });
  }
  return [...requirements.values()];
}

export function validateOrderableProduct(product, quantity, { requirePrice }) {
  const stockIssue = evaluateStockAvailability(product, quantity);
  if (stockIssue) {
    throw new OrderPricingError(
      stockIssue.statusCode,
      stockIssue.message,
      stockIssue.code,
      stockIssue
    );
  }
  if (requirePrice) {
    const price = Number(product.price);
    if (!Number.isFinite(price) || !(price > 0)) {
      throw new OrderPricingError(
        409,
        `${product.name} does not have a valid positive catalog price.`,
        "INVALID_PRODUCT_PRICE"
      );
    }
  }
}

export function validateOrderableVariant(product, variant, quantity, { requirePrice }) {
  if (!variant || !isVariantSellable(variant)) {
    throw new OrderPricingError(409, `${product.name} variant is not currently available.`, "VARIANT_UNAVAILABLE", {
      requestedQuantity: quantity,
      availableQuantity: 0,
      productId: product.id,
      productName: product.name,
    });
  }
  if (quantity > Number(variant.stockQuantity)) {
    throw new OrderPricingError(409, `${product.name} does not have enough stock for this variant.`, "INSUFFICIENT_STOCK", {
      requestedQuantity: quantity,
      availableQuantity: Number(variant.stockQuantity),
      productId: product.id,
      productName: product.name,
    });
  }
  if (requirePrice && !(normalizedVariantPrice(product, variant) > 0)) {
    throw new OrderPricingError(409, `${product.name} variant does not have a valid positive price.`, "INVALID_PRODUCT_PRICE");
  }
}

async function buildAuthoritativeOrderItems(database, itemReferences, now) {
  const resolvedItems = await resolveCatalogItems(database, itemReferences);
  for (const { product, quantity } of aggregateProductQuantities(resolvedItems.filter(({ variant }) => !variant))) {
    validateOrderableProduct(product, quantity, { requirePrice: true });
  }
  const variantRequirements = new Map();
  for (const resolved of resolvedItems.filter(({ variant }) => variant)) {
    const current = variantRequirements.get(resolved.variant.id);
    variantRequirements.set(resolved.variant.id, { ...resolved, quantity: (current?.quantity ?? 0) + resolved.item.quantity });
  }
  for (const { product, variant, quantity } of variantRequirements.values()) {
    validateOrderableVariant(product, variant, quantity, { requirePrice: true });
  }

  const pricingByProductId = await resolveEffectiveProductPrices(
    database,
    resolvedItems.map(({ product }) => product),
    { now }
  );

  return resolvedItems.map(({ item, product, variant }) => {
    const resolved = pricingByProductId.get(product.id);
    const originalUnitPrice = variant
      ? normalizedVariantPrice(product, variant, Number(product.price))
      : Number(product.price);
    const effectivePrice = variant?.priceOverride !== null && variant?.priceOverride !== undefined
      ? normalizedVariantPrice(product, variant, Number(resolved?.price ?? product.price))
      : Number(resolved?.price);
    const originalUnitPriceCents = Math.round(originalUnitPrice * 100);
    const unitPriceCents = Math.round(effectivePrice * 100);
    if (!Number.isSafeInteger(unitPriceCents) || !(unitPriceCents > 0)) {
      throw new OrderPricingError(
        409,
        `${product.name} does not have a valid positive selling price.`,
        "INVALID_PRODUCT_PRICE"
      );
    }
    const flashSale = resolved?.flashSale ?? null;
    const catalogSale = !flashSale && resolved?.salePrice !== null && resolved?.salePrice !== undefined
      && unitPriceCents < originalUnitPriceCents;
    const promotionDiscountCents = flashSale || catalogSale
      ? Math.max(0, originalUnitPriceCents - unitPriceCents)
      : 0;
    return {
      productId: product.id,
      externalProductId: product.externalProductId,
      variantId: variant?.id ?? null,
      externalVariantId: variant?.externalVariantId ?? null,
      variantSku: variant?.sku ?? null,
      variantBarcode: variant?.barcode ?? null,
      selectedOptions: variant ? selectedOptionsSnapshot(variant) : item.selectedOptions || null,
      variantUnitPriceCents: variant ? unitPriceCents : null,
      productName: variant ? `${product.name} (${selectedOptionsSnapshot(variant)})` : item.selectedOptions ? `${product.name} (${item.selectedOptions})` : product.name,
      sku: product.sku,
      quantity: item.quantity,
      originalUnitPriceCents,
      unitPriceCents,
      promotionDiscountCents,
      promotionSourceType: flashSale ? "FLASH_SALE" : catalogSale ? "CATALOG_SALE_PRICE" : null,
      promotionSourceId: flashSale?.id ?? (catalogSale ? product.id : null),
      promotionTitleEn: flashSale ? `Flash Sale — ${product.name}` : catalogSale ? `Sale price — ${product.name}` : null,
      promotionTitleAr: flashSale ? `عرض فلاش — ${product.name}` : catalogSale ? `سعر التخفيض — ${product.name}` : null,
      totalCents: unitPriceCents * item.quantity,
      originalTotalCents: originalUnitPriceCents * item.quantity,
    };
  });
}

function compareMonetaryCandidates(left, right) {
  const discountDifference = right.discountCents - left.discountCents;
  if (discountDifference !== 0) return discountDifference;
  const sourceDifference = (SOURCE_RANK[right.sourceType] ?? 0) - (SOURCE_RANK[left.sourceType] ?? 0);
  if (sourceDifference !== 0) return sourceDifference;
  if (left.sourceType === "SCHEDULED_PROMOTION" && right.sourceType === "SCHEDULED_PROMOTION") {
    const priorityDifference = Number(right.priority ?? 0) - Number(left.priority ?? 0);
    if (priorityDifference !== 0) return priorityDifference;
    const createdDifference = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    if (createdDifference !== 0) return createdDifference;
  }
  if (left.sourceType === "VIP_BENEFIT" && right.sourceType === "VIP_BENEFIT") {
    const createdDifference = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    if (createdDifference !== 0) return createdDifference;
  }
  return String(left.sourceId).localeCompare(String(right.sourceId));
}

function safeSource(source) {
  if (!source) return null;
  return {
    type: source.sourceType,
    id: source.sourceId,
    titleEn: source.titleEn,
    titleAr: source.titleAr,
  };
}

function publicSource(source) {
  const safe = safeSource(source);
  if (!safe) return null;
  return {
    type: safe.type,
    titleEn: safe.titleEn,
    titleAr: safe.titleAr,
  };
}

function uniqueSources(sources) {
  const byKey = new Map();
  for (const source of sources.filter(Boolean)) {
    byKey.set(`${source.sourceType}:${source.sourceId}`, source);
  }
  return [...byKey.values()];
}

function selectPrimaryFreeShippingSource(sources) {
  return [...sources].sort((left, right) =>
    (SOURCE_RANK[right.sourceType] ?? 0) - (SOURCE_RANK[left.sourceType] ?? 0)
    || new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime()
    || String(left.sourceId).localeCompare(String(right.sourceId))
  )[0] ?? null;
}

function personalCodeSummary(candidate, promoCode) {
  if (candidate?.benefit?.type !== "PROMO_CODE") return null;
  const percent = Number(candidate.benefit.discountPercent ?? 0);
  return {
    id: "personal-vip-benefit",
    code: normalizeCouponCode(promoCode),
    titleEn: candidate.titleEn,
    titleAr: candidate.titleAr,
    discountType: percent > 0 ? "PERCENTAGE" : "FIXED",
    value: percent > 0 ? percent : Number(candidate.benefit.discountAmount ?? 0),
    minimumOrderAmount: Number(candidate.benefit.minimumOrderAmount ?? 0),
  };
}

export async function calculateAuthoritativePricing(
  database,
  {
    userId,
    itemReferences,
    deliveryMethod,
    promoCode = "",
    clinicLocationId = null,
    now = new Date(),
  }
) {
  if (!(deliveryMethod in SHIPPING_METHODS)) {
    throw new OrderPricingError(400, "Delivery method is invalid.");
  }

  const items = await buildAuthoritativeOrderItems(database, itemReferences, now);
  const subtotalCents = items.reduce((sum, item) => sum + item.totalCents, 0);
  const originalSubtotalCents = items.reduce((sum, item) => sum + item.originalTotalCents, 0);
  const productPromotionSavingsCents = Math.max(0, originalSubtotalCents - subtotalCents);
  const shippingBeforeDiscountCents = SHIPPING_METHODS[deliveryMethod] * 100;

  let deliveryPricing;
  try {
    deliveryPricing = await evaluateDeliveryOfferPricing(database, {
      userId,
      clinicLocationId,
      deliveryMethod,
      subtotalCents,
      shippingCents: shippingBeforeDiscountCents,
      now,
    });
  } catch (error) {
    if (error instanceof DeliveryOfferEligibilityError) {
      throw new OrderPricingError(error.statusCode, error.message, error.code);
    }
    throw error;
  }

  const [scheduled, benefits, coupon, vipShipping] = await Promise.all([
    getEligibleScheduledPromotionPricing(database, { subtotalCents, now }),
    evaluateCustomerBenefits(database, {
      userId,
      subtotalCents,
      shippingCents: shippingBeforeDiscountCents,
      promoCode,
      now,
    }),
    evaluatePublicCoupon(database, {
      promoCode,
      subtotalCents,
      shippingCents: shippingBeforeDiscountCents,
      now,
    }),
    evaluateVipTierShipping(database, {
      userId,
      deliveryMethod,
      shippingCents: shippingBeforeDiscountCents,
    }),
  ]);

  const couponCandidate = coupon.status === "valid" && coupon.discountCents > 0
    ? {
        sourceType: "COUPON",
        sourceId: coupon.sourceId,
        titleEn: coupon.titleEn,
        titleAr: coupon.titleAr,
        discountCents: coupon.discountCents,
        coupon: coupon.coupon,
      }
    : null;
  const monetaryCandidates = [
    ...scheduled.monetaryCandidates,
    ...benefits.monetaryCandidates,
    ...(couponCandidate ? [couponCandidate] : []),
  ].filter((candidate) => candidate.discountCents > 0);
  monetaryCandidates.sort(compareMonetaryCandidates);
  const winningMonetaryDiscount = monetaryCandidates[0] ?? null;
  const personalPromoCandidate = benefits.monetaryCandidates.find(
    (candidate) => candidate.benefit?.type === "PROMO_CODE"
  );
  if (promoCode && coupon.status === "invalid" && !personalPromoCandidate) {
    throw new OrderPricingError(400, coupon.message, "INVALID_PROMO_CODE");
  }

  const couponFreeShipping =
    coupon.status === "valid" && coupon.shippingCents < shippingBeforeDiscountCents
      ? [{
          sourceType: "COUPON",
          sourceId: coupon.sourceId,
          titleEn: coupon.titleEn,
          titleAr: coupon.titleAr,
          createdAt: coupon.coupon.createdAt,
          coupon: coupon.coupon,
        }]
      : [];
  const freeShippingSources = shippingBeforeDiscountCents > 0
    ? uniqueSources([
        ...scheduled.freeShippingSources,
        ...benefits.freeShippingSources,
        ...couponFreeShipping,
        ...deliveryPricing.freeShippingSources,
        ...(vipShipping.source && vipShipping.shippingCents === 0
          ? [vipShipping.source]
          : []),
      ])
    : [];
  const primaryFreeShippingSource = selectPrimaryFreeShippingSource(freeShippingSources);
  const shippingAfterVipCents = Math.min(
    deliveryPricing.shippingCents,
    vipShipping.shippingCents
  );
  const finalShippingCents = primaryFreeShippingSource
    ? 0
    : shippingAfterVipCents;
  const deliveryOfferDiscountCents = deliveryPricing.shippingDiscountCents;
  const vipShippingDiscountCents = Math.max(
    0,
    deliveryPricing.shippingCents - shippingAfterVipCents
  );
  const shippingDiscountCents = Math.max(0, shippingBeforeDiscountCents - finalShippingCents);
  const monetaryDiscountCents = Math.min(
    subtotalCents,
    winningMonetaryDiscount?.discountCents ?? 0
  );
  const totalCents = Math.max(0, subtotalCents + finalShippingCents - monetaryDiscountCents);
  const scheduledPromotionDiscountCents =
    winningMonetaryDiscount?.sourceType === "SCHEDULED_PROMOTION" ? monetaryDiscountCents : 0;
  const couponDiscountCents =
    winningMonetaryDiscount?.sourceType === "COUPON" ? monetaryDiscountCents : 0;
  const vipDiscountCents =
    winningMonetaryDiscount?.sourceType === "VIP_BENEFIT" ? monetaryDiscountCents : 0;
  const appliedCoupon =
    winningMonetaryDiscount?.sourceType === "COUPON" || couponFreeShipping.length > 0
      ? coupon.coupon
      : null;
  const appliedPersonalPromoCode =
    winningMonetaryDiscount?.sourceType === "VIP_BENEFIT"
    && winningMonetaryDiscount.benefit?.type === "PROMO_CODE";
  const validatedCode = coupon.status === "valid"
    ? coupon.coupon
    : personalCodeSummary(personalPromoCandidate, promoCode);
  const appliedBenefits = uniqueSources([
    ...(winningMonetaryDiscount?.sourceType === "VIP_BENEFIT"
      ? [winningMonetaryDiscount]
      : []),
    ...benefits.freeShippingSources,
  ]).map((source) => source.benefit).filter(Boolean);
  const appliedPromotions = uniqueSources([
    ...items.filter((item) => item.promotionSourceId).map((item) => ({
      sourceType: item.promotionSourceType,
      sourceId: item.promotionSourceId,
      titleEn: item.promotionTitleEn,
      titleAr: item.promotionTitleAr,
    })),
    winningMonetaryDiscount,
    primaryFreeShippingSource,
    deliveryPricing.appliedOffer,
    vipShippingDiscountCents > 0 ? vipShipping.source : null,
  ]).map(safeSource);
  const calculationTimestamp = now.toISOString();
  const pricingBreakdown = {
    pricingVersion: PRICING_VERSION,
    calculationTimestamp,
    originalSubtotal: originalSubtotalCents / 100,
    effectiveSubtotal: subtotalCents / 100,
    productPromotionSavings: productPromotionSavingsCents / 100,
    originalShipping: shippingBeforeDiscountCents / 100,
    deliveryOfferDiscount: deliveryOfferDiscountCents / 100,
    vipShippingDiscount: vipShippingDiscountCents / 100,
    vipShippingSource: safeSource(
      vipShippingDiscountCents > 0 ? vipShipping.source : null
    ),
    finalShipping: finalShippingCents / 100,
    shippingDiscount: shippingDiscountCents / 100,
    monetaryDiscount: monetaryDiscountCents / 100,
    winningMonetarySource: safeSource(winningMonetaryDiscount),
    freeShippingSource: safeSource(primaryFreeShippingSource),
    deliveryOffer: safeSource(deliveryPricing.appliedOffer),
    enteredCouponCode:
      appliedCoupon || appliedPersonalPromoCode ? normalizeCouponCode(promoCode) : null,
    appliedPromotions,
  };

  return {
    items,
    originalSubtotalCents,
    subtotalCents,
    productPromotionSavingsCents,
    monetaryCandidates,
    winningMonetaryDiscount,
    monetaryDiscountCents,
    scheduledPromotionDiscountCents,
    couponDiscountCents,
    vipDiscountCents,
    shippingBeforeDiscountCents,
    deliveryOfferDiscountCents,
    vipShippingDiscountCents,
    shippingDiscountCents,
    shippingCents: finalShippingCents,
    totalDiscountCents:
      productPromotionSavingsCents + monetaryDiscountCents + shippingDiscountCents,
    totalCents,
    appliedBenefits,
    appliedCoupon,
    validatedCode,
    freeShippingSource: primaryFreeShippingSource,
    deliveryOffer: deliveryPricing.appliedOffer,
    vipShippingSource: vipShippingDiscountCents > 0 ? vipShipping.source : null,
    appliedPromotions,
    pricingBreakdown,
    combinationRule: "flash_then_highest_monetary_plus_free_shipping",
  };
}

export function serializePricingTotals(pricing, pricingQuoteToken = undefined) {
  return {
    originalSubtotal: pricing.originalSubtotalCents / 100,
    subtotal: pricing.subtotalCents / 100,
    productPromotionSavings: pricing.productPromotionSavingsCents / 100,
    monetaryDiscount: pricing.monetaryDiscountCents / 100,
    scheduledPromotionDiscount: pricing.scheduledPromotionDiscountCents / 100,
    couponDiscount: pricing.couponDiscountCents / 100,
    vipDiscount: pricing.vipDiscountCents / 100,
    shippingBeforeDiscount: pricing.shippingBeforeDiscountCents / 100,
    deliveryOfferDiscount: pricing.deliveryOfferDiscountCents / 100,
    vipShippingDiscount: pricing.vipShippingDiscountCents / 100,
    shippingDiscount: pricing.shippingDiscountCents / 100,
    shipping: pricing.shippingCents / 100,
    discount: pricing.monetaryDiscountCents / 100,
    totalSavings: pricing.totalDiscountCents / 100,
    total: pricing.totalCents / 100,
    winningMonetarySource: publicSource(pricing.winningMonetaryDiscount),
    freeShippingSource: publicSource(pricing.freeShippingSource),
    deliveryOffer: publicSource(pricing.deliveryOffer),
    vipShippingSource: publicSource(pricing.vipShippingSource),
    appliedBenefits: pricing.appliedBenefits.map((benefit) => ({
      type: benefit.type,
      titleEn: benefit.titleEn,
      titleAr: benefit.titleAr,
      lifecycle: benefit.lifecycle,
    })),
    appliedCoupon: pricing.appliedCoupon
      ? {
          code: pricing.appliedCoupon.code,
          titleEn: pricing.appliedCoupon.titleEn,
          titleAr: pricing.appliedCoupon.titleAr,
          discountType: pricing.appliedCoupon.discountType,
          value: pricing.appliedCoupon.value,
          minimumOrderAmount: pricing.appliedCoupon.minimumOrderAmount,
        }
      : null,
    combinationRule: pricing.combinationRule,
    pricingVersion: PRICING_VERSION,
    ...(pricingQuoteToken ? { pricingQuoteToken } : {}),
  };
}
