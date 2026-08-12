import type { AdminProductCatalog } from "@/services/adminProductCatalog";
import { combinationDisplayLabel } from "./adminVariantCombinations";

/** Pure "Review" summary computed from the full product+options+variants+images catalog — used by the Product Editor's persistent summary strip. */

export type ProductEditorSummary = {
  hasVariants: boolean;
  optionDimensionCount: number;
  variantCount: number;
  activeVariantCount: number;
  priceMin: number | null;
  priceMax: number | null;
  totalStock: number;
  missingImageVariantLabels: string[];
  incompleteIdentifierVariantLabels: string[];
  hasProductImage: boolean;
  warnings: string[];
};

export function summarizeProductCatalog(catalog: AdminProductCatalog): ProductEditorSummary {
  const hasVariants = catalog.variants.length > 0;
  const sellable = catalog.variants.filter((variant) => variant.isAvailable && variant.status !== "INACTIVE" && variant.stockQuantity > 0);
  const prices = sellable.map((variant) => variant.priceOverride ?? catalog.price ?? 0);
  const productHasImage = Boolean(catalog.imageUrl) || catalog.images.some((image) => !image.variantId && image.rightsConfirmed);

  const missingImageVariantLabels: string[] = [];
  const incompleteIdentifierVariantLabels: string[] = [];
  for (const variant of catalog.variants) {
    const label = combinationDisplayLabel(
      variant.selections.map((selection) => ({ optionNameEn: selection.option.nameEn, valueEn: selection.optionValue.valueEn }))
    ) || variant.sku || variant.id;
    const hasOwnImage = catalog.images.some((image) => image.variantId === variant.id && image.rightsConfirmed);
    if (!hasOwnImage && !productHasImage) missingImageVariantLabels.push(label);
    if (!variant.sku && !variant.barcode && !variant.externalVariantId) incompleteIdentifierVariantLabels.push(label);
  }

  const warnings: string[] = [];
  if (hasVariants && sellable.length === 0) warnings.push("noSellableVariants");
  if (!hasVariants && !catalog.price) warnings.push("missingBasePrice");
  if (!hasVariants && !productHasImage) warnings.push("missingProductImage");
  if (catalog.images.some((image) => !image.rightsConfirmed)) warnings.push("hasUnconfirmedRightsImages");

  return {
    hasVariants,
    optionDimensionCount: catalog.options.length,
    variantCount: catalog.variants.length,
    activeVariantCount: sellable.length,
    priceMin: prices.length ? Math.min(...prices) : hasVariants ? null : catalog.price,
    priceMax: prices.length ? Math.max(...prices) : hasVariants ? null : catalog.price,
    totalStock: hasVariants ? sellable.reduce((sum, variant) => sum + variant.stockQuantity, 0) : catalog.stockQuantity ?? 0,
    missingImageVariantLabels,
    incompleteIdentifierVariantLabels,
    hasProductImage: productHasImage,
    warnings,
  };
}
