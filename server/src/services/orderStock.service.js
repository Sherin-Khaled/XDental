import {
  aggregateProductQuantities,
  resolveCatalogItems,
  validateOrderableProduct,
} from "./orderPricing.service.js";

const ORDERABLE_PRODUCT_STATUSES = new Set(["ACTIVE", "LOW_STOCK"]);
export const STOCK_COMMITTED_ORDER_STATUSES = new Set(["CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY"]);

export class OrderRequestError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "OrderRequestError";
    this.statusCode = statusCode;
  }
}

/**
 * Simple products decrement Product.stockQuantity; variant products
 * decrement only the selected ProductVariant.stockQuantity — never both for
 * the same order item. Each update is a conditional `updateMany` guarded by
 * `stockQuantity: { gte: quantity }`, so concurrent confirmations can never
 * push stock negative and a short-count always fails closed with a 409.
 */
export async function decrementOrderStock(database, order) {
  const variantRequirements = new Map();
  for (const item of order.items.filter((item) => item.variantId)) {
    const current = variantRequirements.get(item.variantId);
    variantRequirements.set(item.variantId, { item, quantity: (current?.quantity ?? 0) + item.quantity });
  }
  for (const { item, quantity } of variantRequirements.values()) {
    const decremented = await database.productVariant.updateMany({
      where: {
        id: item.variantId,
        productId: item.productId ?? undefined,
        status: { in: [...ORDERABLE_PRODUCT_STATUSES] },
        isAvailable: true,
        stockQuantity: { gte: quantity },
      },
      data: { stockQuantity: { decrement: quantity } },
    });
    if (decremented.count !== 1) {
      throw new OrderRequestError(409, `${item.productName} no longer has enough stock to confirm this order.`);
    }
    const variant = await database.productVariant.findUnique({ where: { id: item.variantId }, select: { stockQuantity: true, lowStockThreshold: true } });
    if (variant) await database.productVariant.update({
      where: { id: item.variantId },
      data: {
        status: variant.stockQuantity === 0 ? "OUT_OF_STOCK" : variant.stockQuantity <= variant.lowStockThreshold ? "LOW_STOCK" : "ACTIVE",
        isAvailable: variant.stockQuantity > 0,
      },
    });
  }
  const resolvedItems = await resolveCatalogItems(
    database,
    order.items.filter((item) => !item.variantId).map((item) => ({
      productId: item.productId,
      externalProductId: item.externalProductId,
      sku: item.sku,
      slug: null,
      quantity: item.quantity,
    }))
  );

  for (const { product, quantity } of aggregateProductQuantities(resolvedItems)) {
    validateOrderableProduct(product, quantity, { requirePrice: false });
    if (product.stockQuantity === null) continue;

    const decremented = await database.product.updateMany({
      where: {
        id: product.id,
        status: { in: [...ORDERABLE_PRODUCT_STATUSES] },
        isAvailable: true,
        stockQuantity: { gte: quantity },
      },
      data: { stockQuantity: { decrement: quantity } },
    });
    if (decremented.count !== 1) {
      throw new OrderRequestError(409, `${product.name} no longer has enough stock to confirm this order.`);
    }

    const updatedProduct = await database.product.findUnique({
      where: { id: product.id },
      select: { stockQuantity: true },
    });
    const remainingStock = updatedProduct?.stockQuantity;
    if (remainingStock !== null && remainingStock !== undefined) {
      await database.product.update({
        where: { id: product.id },
        data: {
          status: remainingStock === 0 ? "OUT_OF_STOCK" : remainingStock <= 5 ? "LOW_STOCK" : "ACTIVE",
          isAvailable: remainingStock > 0,
        },
      });
    }
  }
}

/** Restores exactly the stock source `decrementOrderStock` previously decremented for this order. */
export async function restoreOrderStock(database, order) {
  const variantRequirements = new Map();
  for (const item of order.items.filter((item) => item.variantId)) {
    const current = variantRequirements.get(item.variantId);
    variantRequirements.set(item.variantId, { item, quantity: (current?.quantity ?? 0) + item.quantity });
  }
  for (const { item, quantity } of variantRequirements.values()) {
    const variant = await database.productVariant.update({
      where: { id: item.variantId },
      data: { stockQuantity: { increment: quantity } },
      select: { stockQuantity: true, lowStockThreshold: true, status: true },
    });
    if (["ACTIVE", "LOW_STOCK", "OUT_OF_STOCK"].includes(variant.status)) {
      await database.productVariant.update({
        where: { id: item.variantId },
        data: {
          status: variant.stockQuantity <= variant.lowStockThreshold ? "LOW_STOCK" : "ACTIVE",
          isAvailable: true,
        },
      });
    }
  }
  const resolvedItems = await resolveCatalogItems(
    database,
    order.items.filter((item) => !item.variantId).map((item) => ({
      productId: item.productId,
      externalProductId: item.externalProductId,
      sku: item.sku,
      slug: null,
      quantity: item.quantity,
    }))
  );

  for (const { product, quantity } of aggregateProductQuantities(resolvedItems)) {
    if (product.stockQuantity === null) continue;

    await database.product.update({
      where: { id: product.id },
      data: { stockQuantity: { increment: quantity } },
    });

    const restoredProduct = await database.product.findUnique({
      where: { id: product.id },
      select: { stockQuantity: true, status: true },
    });
    const restoredStock = restoredProduct?.stockQuantity;
    if (
      restoredStock !== null &&
      restoredStock !== undefined &&
      ["ACTIVE", "LOW_STOCK", "OUT_OF_STOCK"].includes(restoredProduct.status)
    ) {
      await database.product.update({
        where: { id: product.id },
        data: {
          status: restoredStock <= 5 ? "LOW_STOCK" : "ACTIVE",
          isAvailable: true,
        },
      });
    }
  }
}

/**
 * Attempts the compare-and-swap status transition (`order.status` must still
 * equal the status this call read) and, only when this call is the one that
 * actually wins that swap, applies the matching stock side effect exactly
 * once: commit on a transition into CONFIRMED, restore on a transition into
 * CANCELED from a stock-committed status. Returns `{ won: false }` when the
 * order's status already changed before this call — including a replay of
 * the exact same request — so the caller never decrements or restores stock
 * a second time for the same transition. The caller (not this function)
 * decides what a lost race means: a harmless replay of a transition someone
 * else already made, or a genuine conflict to reject.
 */
export async function commitOrderStatusTransition(database, order, nextStatus) {
  const transition = await database.order.updateMany({
    where: { id: order.id, status: order.status },
    data: { status: nextStatus },
  });
  if (transition.count !== 1) return { won: false };

  if (nextStatus === "CONFIRMED") {
    await decrementOrderStock(database, order);
  }
  if (nextStatus === "CANCELED" && STOCK_COMMITTED_ORDER_STATUSES.has(order.status)) {
    await restoreOrderStock(database, order);
  }
  return { won: true };
}
