import { prisma } from "../config/db.js";
import {
  publicLookups,
  serializePublicProduct,
} from "./catalog.controller.js";
import { resolveEffectiveProductPrices } from "../services/flashSalePricing.service.js";
import {
  evaluateStockAvailability,
  publicStockIssue,
} from "../services/stockAvailability.service.js";
import {
  CartRequestError,
  addUserCartItem,
  clearUserCart,
  getUserCart,
  mergeUserCart,
  removeUserCartItem,
  setUserCartItemQuantity,
} from "../services/cart.service.js";
import { isVariantSellable, normalizedVariantPrice } from "../services/variantCatalog.service.js";

async function serializeCart(cartItems) {
  const products = cartItems.map((item) => item.product);
  const quantityByProductId = new Map();
  for (const item of cartItems) {
    quantityByProductId.set(
      item.productId,
      (quantityByProductId.get(item.productId) ?? 0) + item.quantity
    );
  }
  const [lookups, pricingByProductId] = await Promise.all([
    publicLookups(),
    resolveEffectiveProductPrices(prisma, products),
  ]);

  return {
    items: cartItems.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      selectedOptions: item.selectedOptions || null,
      variant: item.variant ? {
        id: item.variant.id,
        sku: item.variant.sku ?? null,
        price: normalizedVariantPrice(item.product, item.variant),
        stockQuantity: item.variant.stockQuantity,
        available: isVariantSellable(item.variant),
      } : null,
      stockIssue: publicStockIssue(
        evaluateStockAvailability(
          item.product,
          quantityByProductId.get(item.productId) ?? item.quantity
        )
      ),
      product: serializePublicProduct(
        item.product,
        lookups.brandByName,
        lookups.categoryByName,
        pricingByProductId
      ),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
  };
}

async function sendCurrentCart(response, userId) {
  const items = await getUserCart(prisma, userId);
  return response.json({ cart: await serializeCart(items) });
}

function cartError(response, error) {
  if (!(error instanceof CartRequestError)) return false;
  response.status(error.statusCode).json({
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
  });
  return true;
}

export async function getMyCart(request, response) {
  return sendCurrentCart(response, request.user.id);
}

export async function addMyCartItem(request, response) {
  try {
    await addUserCartItem(prisma, request.user.id, request.body);
    return sendCurrentCart(response, request.user.id);
  } catch (error) {
    if (cartError(response, error)) return;
    throw error;
  }
}

export async function updateMyCartItem(request, response) {
  try {
    await setUserCartItemQuantity(prisma, request.user.id, {
      ...request.body,
      productId: request.params.productId,
    });
    return sendCurrentCart(response, request.user.id);
  } catch (error) {
    if (cartError(response, error)) return;
    throw error;
  }
}

export async function removeMyCartItem(request, response) {
  try {
    await removeUserCartItem(prisma, request.user.id, {
      productId: request.params.productId,
      selectedOptions: request.query.selectedOptions,
      variantId: request.query.variantId,
    });
    return sendCurrentCart(response, request.user.id);
  } catch (error) {
    if (cartError(response, error)) return;
    throw error;
  }
}

export async function mergeMyCart(request, response) {
  try {
    await mergeUserCart(prisma, request.user.id, request.body?.items);
    return sendCurrentCart(response, request.user.id);
  } catch (error) {
    if (cartError(response, error)) return;
    throw error;
  }
}

export async function clearMyCart(request, response) {
  await clearUserCart(prisma, request.user.id);
  return response.json({ cart: { items: [] } });
}
