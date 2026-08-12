import { prisma } from "../config/db.js";
import { selectBestValidFlashSale } from "../services/flashSalePricing.service.js";
import { isPubliclyAvailable, publicLookups, serializePublicProduct } from "./catalog.controller.js";

/**
 * GET /api/flash-sale — up to two currently valid Home flash sales.
 * "Valid" means: isActive, now is within [startsAt, endsAt], the linked
 * product still exists, is publicly available, has a real price, and the
 * configured salePrice is still genuinely lower than that price (a later
 * price edit on the product must never surface a fake/inverted discount).
 * Returns an empty array rather than fabricating anything when no candidate
 * qualifies — the home page hides the section in that case. The singular
 * flashSale property is retained for backwards compatibility.
 */
export async function getPublicFlashSale(_request, response) {
  const now = new Date();
  const candidates = await prisma.flashSale.findMany({
    where: { isActive: true, startsAt: { lte: now }, endsAt: { gt: now } },
    orderBy: [{ displayOrder: "asc" }, { endsAt: "asc" }],
    include: { product: true },
  });

  const lookups = await publicLookups();
  const flashSales = [];
  const selectedProductIds = new Set();

  for (const candidate of candidates) {
    const { product } = candidate;
    if (!product || product.price === null) continue;
    if (selectedProductIds.has(product.id)) continue;
    if (!isPubliclyAvailable(product)) continue;
    const bestSale = selectBestValidFlashSale(product, candidates, now);
    if (!bestSale) continue;

    flashSales.push({
      id: bestSale.id,
      salePrice: Number(bestSale.salePrice),
      startsAt: bestSale.startsAt.toISOString(),
      endsAt: bestSale.endsAt.toISOString(),
      product: serializePublicProduct(product, lookups.brandByName, lookups.categoryByName),
    });
    selectedProductIds.add(product.id);

    if (flashSales.length === 2) break;
  }

  return response.json({
    flashSales,
    flashSale: flashSales[0] ?? null,
  });
}
