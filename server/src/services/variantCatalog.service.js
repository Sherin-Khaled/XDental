import { cleanText } from "../utils/records.js";

export const SELLABLE_VARIANT_STATUSES = new Set(["ACTIVE", "LOW_STOCK"]);

export function hasProductVariants(product) {
  return Array.isArray(product?.variants) && product.variants.length > 0;
}

export function isVariantSellable(variant) {
  return Boolean(
    variant
    && variant.isAvailable
    && SELLABLE_VARIANT_STATUSES.has(variant.status)
    && Number(variant.stockQuantity) > 0
  );
}

export function variantAvailabilitySummary(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const sellable = variants.filter(isVariantSellable);
  const stockQuantity = sellable.reduce((total, variant) => total + Number(variant.stockQuantity || 0), 0);
  return {
    hasVariants: variants.length > 0,
    sellableVariants: sellable,
    stockQuantity,
    available: sellable.length > 0,
    status: sellable.length === 0
      ? "OUT_OF_STOCK"
      : sellable.some((variant) => Number(variant.stockQuantity) <= Number(variant.lowStockThreshold ?? 5))
        ? "LOW_STOCK"
        : "ACTIVE",
  };
}

export function getVariantSelectedOptions(variant) {
  const selections = [...(variant?.selections ?? [])]
    .sort((left, right) => Number(left.option?.sortOrder ?? 0) - Number(right.option?.sortOrder ?? 0));
  return selections
    .map((selection) => {
      const option = selection.option;
      const value = selection.optionValue;
      if (!option || !value) return null;
      return {
        code: option.code,
        nameEn: option.nameEn,
        nameAr: option.nameAr ?? null,
        valueCode: value.code,
        valueEn: value.valueEn,
        valueAr: value.valueAr ?? null,
      };
    })
    .filter(Boolean);
}

export function selectedOptionsSnapshot(variant) {
  return getVariantSelectedOptions(variant)
    .map((selection) => `${selection.nameEn}: ${selection.valueEn}`)
    .join(", ");
}

export function normalizedVariantPrice(product, variant, parentEffectivePrice = null) {
  const override = variant?.priceOverride === null || variant?.priceOverride === undefined
    ? null
    : Number(variant.priceOverride);
  if (Number.isFinite(override) && override > 0) return override;
  return Number(parentEffectivePrice ?? product?.price ?? 0);
}

export function visibleGallery(product, variantId = null) {
  const all = Array.isArray(product?.images) ? product.images : [];
  const publicImages = all.filter((image) => image.rightsConfirmed === true);
  const variantImages = variantId
    ? publicImages.filter((image) => image.variantId === variantId)
    : [];
  const sharedImages = publicImages.filter((image) => !image.variantId);
  const ordered = [...variantImages, ...sharedImages]
    .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary)
      || Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0));
  const seen = new Set();
  const images = ordered.filter((image) => {
    if (!image.url || seen.has(image.url)) return false;
    seen.add(image.url);
    return true;
  }).map((image) => ({
    url: image.url,
    altEn: image.altEn ?? null,
    altAr: image.altAr ?? null,
    sortOrder: image.sortOrder ?? 0,
    isPrimary: Boolean(image.isPrimary),
    variantId: image.variantId ?? null,
  }));
  if (images.length === 0 && product?.imageUrl) {
    images.push({ url: product.imageUrl, altEn: null, altAr: null, sortOrder: 0, isPrimary: true, variantId: null });
  }
  return images;
}

export function findProductVariant(product, variantId) {
  if (!variantId || !Array.isArray(product?.variants)) return null;
  return product.variants.find((variant) => variant.id === variantId) ?? null;
}

export function safeVariantId(value) {
  return cleanText(value, 200) || null;
}

/**
 * Canonical, order-independent identity for a complete variant option
 * combination, built from stable option/value codes rather than internal
 * database IDs — so it is safe to show to an admin (no leaked IDs) and can be
 * computed identically whether the option/value rows already exist in the
 * database or only exist as pending rows in an import preview.
 *
 * `pairs` is an array of `{ optionCode, valueCode }`. Two combinations with
 * the same pairs in any order produce the same signature; this string also
 * doubles as the safe human-readable message ("SHADE=A1, SIZE=MEDIUM").
 */
export function combinationSignature(pairs) {
  return [...(pairs ?? [])]
    .filter((pair) => pair?.optionCode && pair?.valueCode)
    .map((pair) => `${String(pair.optionCode).toUpperCase()}=${String(pair.valueCode).toUpperCase()}`)
    .sort()
    .join(", ");
}

/** Builds `{ optionCode, valueCode }` pairs from a variant's selections relation (or `.selections`-shaped input). */
export function variantCombinationPairs(variant) {
  return (variant?.selections ?? [])
    .filter((selection) => selection?.option?.code && selection?.optionValue?.code)
    .map((selection) => ({ optionCode: selection.option.code, valueCode: selection.optionValue.code }));
}

export function variantCombinationSignature(variant) {
  return combinationSignature(variantCombinationPairs(variant));
}
