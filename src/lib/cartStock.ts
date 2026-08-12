import type { CartItem, Product } from "@/types/product";

export type CartStockIssueCode =
  | "INVALID_CART_QUANTITY"
  | "PRODUCT_UNAVAILABLE"
  | "INSUFFICIENT_STOCK";

export type CartStockIssue = {
  code: CartStockIssueCode;
  productId: string;
  productName: string;
  requestedQuantity: number;
  availableQuantity: number | null;
};

export type CartQuantityGuardResult =
  | {
      ok: true;
      requestedQuantity: number;
      availableQuantity: number | null;
    }
  | ({ ok: false } & CartStockIssue);

export function getProductStockLimit(product: Product) {
  return Number.isInteger(product.stockQuantity) && Number(product.stockQuantity) >= 0
    ? Number(product.stockQuantity)
    : null;
}

export function isProductPurchasable(product: Product) {
  const stockLimit = getProductStockLimit(product);
  return (
    product.available !== false &&
    product.status !== "OUT_OF_STOCK" &&
    product.stockStatus !== "Out of Stock" &&
    stockLimit !== 0
  );
}

export function guardProductQuantity(
  product: Product,
  requestedQuantity: number
): CartQuantityGuardResult {
  const availableQuantity = getProductStockLimit(product);

  if (!Number.isInteger(requestedQuantity) || requestedQuantity <= 0) {
    return {
      ok: false,
      code: "INVALID_CART_QUANTITY",
      productId: product.id,
      productName: product.name,
      requestedQuantity,
      availableQuantity,
    };
  }

  if (!isProductPurchasable(product)) {
    return {
      ok: false,
      code: "PRODUCT_UNAVAILABLE",
      productId: product.id,
      productName: product.name,
      requestedQuantity,
      availableQuantity: availableQuantity ?? 0,
    };
  }

  if (availableQuantity !== null && requestedQuantity > availableQuantity) {
    return {
      ok: false,
      code: "INSUFFICIENT_STOCK",
      productId: product.id,
      productName: product.name,
      requestedQuantity,
      availableQuantity,
    };
  }

  return { ok: true, requestedQuantity, availableQuantity };
}

export function cartProductQuantity(cart: CartItem[], productId: string) {
  return cart
    .filter((item) => item.product.id === productId)
    .reduce((total, item) => total + item.quantity, 0);
}

export function getCartStockIssues(cart: CartItem[]) {
  const products = new Map<string, Product>();
  for (const item of cart) products.set(item.product.id, item.product);

  const issues: CartStockIssue[] = [];
  for (const [productId, product] of products) {
    const requestedQuantity = cartProductQuantity(cart, productId);
    const result = guardProductQuantity(product, requestedQuantity);
    if (!result.ok) issues.push(result);
  }
  return issues;
}

export function getCartStockIssueForProduct(
  cart: CartItem[],
  productId: string
) {
  return getCartStockIssues(cart).find((issue) => issue.productId === productId) ?? null;
}

export function canIncreaseCartProduct(cart: CartItem[], product: Product) {
  return guardProductQuantity(
    product,
    cartProductQuantity(cart, product.id) + 1
  ).ok;
}

export function quantityAfterLineUpdate(
  cart: CartItem[],
  productId: string,
  currentLineQuantity: number,
  nextLineQuantity: number
) {
  return cartProductQuantity(cart, productId) - currentLineQuantity + nextLineQuantity;
}
