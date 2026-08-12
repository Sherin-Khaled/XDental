import { cleanText, isValidId } from "../utils/records.js";
import { evaluateStockAvailability } from "./stockAvailability.service.js";
import {
  findProductVariant,
  hasProductVariants,
  isVariantSellable,
  safeVariantId,
  selectedOptionsSnapshot,
} from "./variantCatalog.service.js";

export const MAX_CART_ITEMS = 100;
export const MAX_CART_QUANTITY = 999;
export const MAX_SELECTED_OPTIONS_LENGTH = 300;

export class CartRequestError extends Error {
  constructor(statusCode, message, details = {}) {
    super(message);
    this.name = "CartRequestError";
    this.statusCode = statusCode;
    Object.assign(this, details);
  }
}

export function normalizeSelectedOptions(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string" || value.length > MAX_SELECTED_OPTIONS_LENGTH) {
    throw new CartRequestError(400, "Selected product options are invalid.");
  }
  return cleanText(value, MAX_SELECTED_OPTIONS_LENGTH);
}

export function parseCartItemInput(input) {
  const productId = typeof input?.productId === "string" ? input.productId.trim() : "";
  if (!isValidId(productId)) {
    throw new CartRequestError(400, "A valid product is required.");
  }

  const quantity = input?.quantity;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_CART_QUANTITY) {
    throw new CartRequestError(
      400,
      `Quantity must be a whole number between 1 and ${MAX_CART_QUANTITY}.`,
      {
        code: "INVALID_CART_QUANTITY",
        requestedQuantity: quantity,
        availableQuantity: null,
      }
    );
  }

  const parsed = {
    productId,
    quantity,
    selectedOptions: normalizeSelectedOptions(input?.selectedOptions),
  };
  const variantId = safeVariantId(input?.variantId);
  if (variantId) parsed.variantId = variantId;
  return parsed;
}

function cartKey(productId, selectedOptions) {
  return `${productId}\u0000${selectedOptions}`;
}

function assertCartProductAvailable(product, quantity) {
  const stockIssue = evaluateStockAvailability(product, quantity);
  if (stockIssue) {
    throw new CartRequestError(
      stockIssue.statusCode,
      stockIssue.message,
      stockIssue
    );
  }
  if (!(Number(product.price) > 0)) {
    throw new CartRequestError(409, `${product.name} is not currently available.`, {
      code: "PRODUCT_UNAVAILABLE",
      requestedQuantity: quantity,
      availableQuantity: 0,
      productId: product.id,
      productName: product.name,
    });
  }
}

function assertCartVariantAvailable(product, variant, quantity) {
  if (!variant || !isVariantSellable(variant)) {
    throw new CartRequestError(409, `${product.name} variant is not currently available.`, {
      code: "VARIANT_UNAVAILABLE",
      requestedQuantity: quantity,
      availableQuantity: 0,
      productId: product.id,
      productName: product.name,
    });
  }
  if (quantity > Number(variant.stockQuantity)) {
    throw new CartRequestError(409, `${product.name} does not have enough stock for this variant.`, {
      code: "INSUFFICIENT_STOCK",
      requestedQuantity: quantity,
      availableQuantity: Number(variant.stockQuantity),
      productId: product.id,
      productName: product.name,
    });
  }
}

const cartProductSelect = {
  id: true,
  name: true,
  price: true,
  stockQuantity: true,
  status: true,
  isAvailable: true,
  variants: { include: { selections: { include: { option: true, optionValue: true } } } },
};

function resolveCartSelection(product, item) {
  if (!hasProductVariants(product)) {
    if (item.variantId) throw new CartRequestError(400, "This product does not have variants.");
    return { ...item, variant: null };
  }
  if (!item.variantId) throw new CartRequestError(400, "A variant is required for this product.", { code: "VARIANT_REQUIRED" });
  const variant = findProductVariant(product, item.variantId);
  if (!variant) throw new CartRequestError(400, "The selected variant does not belong to this product.", { code: "INVALID_VARIANT" });
  return { ...item, variant, selectedOptions: selectedOptionsSnapshot(variant) };
}

export async function getUserCart(database, userId) {
  return database.cartItem.findMany({
    where: { userId },
    include: { product: true },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "asc" }],
  });
}

export async function addUserCartItem(database, userId, input) {
  const item = parseCartItemInput(input);

  await database.$transaction(async (transaction) => {
    const [product, productCartItems] = await Promise.all([
      transaction.product.findUnique({
        where: { id: item.productId },
        select: cartProductSelect,
      }),
      transaction.cartItem.findMany({
        where: { userId, productId: item.productId },
      }),
    ]);
    const selected = resolveCartSelection(product, item);
    const existing = productCartItems.find((cartItem) => selected.variantId
      ? cartItem.variantId === selected.variantId
      : !cartItem.variantId && cartItem.selectedOptions === selected.selectedOptions);
    const nextLineQuantity = (existing?.quantity ?? 0) + item.quantity;
    const nextProductQuantity = selected.variantId
      ? nextLineQuantity
      : productCartItems.reduce((total, cartItem) => total + cartItem.quantity, item.quantity);
    if (selected.variant) assertCartVariantAvailable(product, selected.variant, nextLineQuantity);
    else assertCartProductAvailable(product, nextProductQuantity);

    if (!existing) {
      const itemCount = await transaction.cartItem.count({ where: { userId } });
      if (itemCount >= MAX_CART_ITEMS) {
        throw new CartRequestError(
          409,
          `A cart cannot contain more than ${MAX_CART_ITEMS} different items.`
        );
      }
    }

    if (!selected.variant) {
      await transaction.cartItem.upsert({
        where: { userId_productId_selectedOptions: { userId, productId: selected.productId, selectedOptions: selected.selectedOptions } },
        create: { userId, productId: selected.productId, selectedOptions: selected.selectedOptions, quantity: selected.quantity },
        update: { quantity: nextLineQuantity },
      });
    } else if (existing) {
      await transaction.cartItem.update({ where: { id: existing.id }, data: { quantity: nextLineQuantity } });
    } else {
      await transaction.cartItem.create({
        data: { userId, productId: selected.productId, variantId: selected.variantId, selectedOptions: selected.selectedOptions, quantity: selected.quantity },
      });
    }
  });
}

export async function setUserCartItemQuantity(database, userId, input) {
  const item = parseCartItemInput(input);

  await database.$transaction(async (transaction) => {
    const [product, productCartItems] = await Promise.all([
      transaction.product.findUnique({
        where: { id: item.productId },
        select: cartProductSelect,
      }),
      transaction.cartItem.findMany({
        where: { userId, productId: item.productId },
      }),
    ]);
    const selected = resolveCartSelection(product, item);
    const existing = productCartItems.find((cartItem) => selected.variantId
      ? cartItem.variantId === selected.variantId
      : !cartItem.variantId && cartItem.selectedOptions === selected.selectedOptions);
    if (!existing) throw new CartRequestError(404, "Cart item not found.");
    const nextProductQuantity = selected.variantId ? item.quantity : productCartItems.reduce(
      (total, cartItem) =>
        total + (cartItem.id === existing.id ? item.quantity : cartItem.quantity),
      0
    );
    if (selected.variant) assertCartVariantAvailable(product, selected.variant, item.quantity);
    else assertCartProductAvailable(product, nextProductQuantity);

    await transaction.cartItem.update({
      where: { id: existing.id },
      data: { quantity: item.quantity },
    });
  });
}

export async function removeUserCartItem(database, userId, input) {
  const productId = typeof input?.productId === "string" ? input.productId.trim() : "";
  if (!isValidId(productId)) {
    throw new CartRequestError(400, "A valid product is required.");
  }
  const selectedOptions = normalizeSelectedOptions(input?.selectedOptions);
  const variantId = safeVariantId(input?.variantId);
  await database.cartItem.deleteMany({
    where: variantId ? { userId, productId, variantId } : { userId, productId, selectedOptions, variantId: null },
  });
}

export async function clearUserCart(database, userId) {
  await database.cartItem.deleteMany({ where: { userId } });
}

export async function mergeUserCart(database, userId, inputs) {
  if (!Array.isArray(inputs) || inputs.length > MAX_CART_ITEMS) {
    throw new CartRequestError(
      400,
      `A cart merge must contain between 0 and ${MAX_CART_ITEMS} items.`
    );
  }

  const mergedInputs = new Map();
  for (const input of inputs) {
    const item = parseCartItemInput(input);
    const key = cartKey(item.productId, item.selectedOptions);
    const quantity = (mergedInputs.get(key)?.quantity ?? 0) + item.quantity;
    if (quantity > MAX_CART_QUANTITY) {
      throw new CartRequestError(
        400,
        `Quantity must be a whole number between 1 and ${MAX_CART_QUANTITY}.`
      );
    }
    mergedInputs.set(key, { ...item, quantity });
  }
  if (mergedInputs.size === 0) return;

  await database.$transaction(async (transaction) => {
    const items = [...mergedInputs.values()];
    const [products, existingItems] = await Promise.all([
      transaction.product.findMany({
        where: { id: { in: [...new Set(items.map((item) => item.productId))] } },
        select: cartProductSelect,
      }),
      transaction.cartItem.findMany({ where: { userId } }),
    ]);
    const productById = new Map(products.map((product) => [product.id, product]));
    const existingByKey = new Map(
      existingItems.map((item) => [
        cartKey(item.productId, item.selectedOptions),
        item,
      ])
    );
    const newItemCount = items.filter(
      (item) => !existingByKey.has(cartKey(item.productId, item.selectedOptions))
    ).length;
    if (existingItems.length + newItemCount > MAX_CART_ITEMS) {
      throw new CartRequestError(
        409,
        `A cart cannot contain more than ${MAX_CART_ITEMS} different items.`
      );
    }

    const nextQuantityByKey = new Map(
      existingItems.map((existingItem) => [
        cartKey(existingItem.productId, existingItem.selectedOptions),
        existingItem.quantity,
      ])
    );
    for (const item of items) {
      const key = cartKey(item.productId, item.selectedOptions);
      const nextQuantity = (nextQuantityByKey.get(key) ?? 0) + item.quantity;
      if (nextQuantity > MAX_CART_QUANTITY) {
        throw new CartRequestError(
          409,
          `A product quantity cannot exceed ${MAX_CART_QUANTITY}.`
        );
      }
      nextQuantityByKey.set(key, nextQuantity);
    }

    const productTotals = new Map();
    const touchedProductIds = new Set(items.map((item) => item.productId));
    for (const existingItem of existingItems) {
      if (!touchedProductIds.has(existingItem.productId)) continue;
      productTotals.set(
        existingItem.productId,
        (productTotals.get(existingItem.productId) ?? 0) + existingItem.quantity
      );
    }
    for (const item of items) {
      productTotals.set(
        item.productId,
        (productTotals.get(item.productId) ?? 0) + item.quantity
      );
    }
    for (const [productId, quantity] of productTotals) {
      assertCartProductAvailable(productById.get(productId), quantity);
    }

    for (const item of items) {
      const key = cartKey(item.productId, item.selectedOptions);
      const nextQuantity = nextQuantityByKey.get(key);
      await transaction.cartItem.upsert({
        where: {
          userId_productId_selectedOptions: {
            userId,
            productId: item.productId,
            selectedOptions: item.selectedOptions,
          },
        },
        create: { userId, ...item },
        update: { quantity: nextQuantity },
      });
    }
  });
}
