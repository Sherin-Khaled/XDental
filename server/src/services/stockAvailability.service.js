const ORDERABLE_PRODUCT_STATUSES = new Set(["ACTIVE", "LOW_STOCK"]);

function safeStockQuantity(product) {
  return Number.isInteger(product?.stockQuantity) && product.stockQuantity >= 0
    ? product.stockQuantity
    : null;
}

export function evaluateStockAvailability(product, requestedQuantity) {
  const safeRequestedQuantity = Number.isInteger(requestedQuantity)
    ? requestedQuantity
    : null;

  if (!product) {
    return {
      statusCode: 404,
      code: "PRODUCT_UNAVAILABLE",
      message: "This product is no longer available.",
      requestedQuantity: safeRequestedQuantity,
      availableQuantity: 0,
      productId: null,
      productName: null,
    };
  }

  const stockQuantity = safeStockQuantity(product);
  const details = {
    requestedQuantity: safeRequestedQuantity,
    availableQuantity: stockQuantity,
    productId: product.id,
    productName: product.name,
  };

  if (
    !ORDERABLE_PRODUCT_STATUSES.has(product.status) ||
    !product.isAvailable ||
    stockQuantity === 0
  ) {
    return {
      statusCode: 409,
      code: "PRODUCT_UNAVAILABLE",
      message: `${product.name} is not currently available.`,
      ...details,
      availableQuantity: 0,
    };
  }

  if (stockQuantity !== null && requestedQuantity > stockQuantity) {
    return {
      statusCode: 409,
      code: "INSUFFICIENT_STOCK",
      message: `Only ${stockQuantity} unit(s) of ${product.name} are currently available.`,
      ...details,
    };
  }

  return null;
}

export function publicStockIssue(issue) {
  if (!issue) return null;
  return {
    code: issue.code,
    requestedQuantity: issue.requestedQuantity,
    availableQuantity: issue.availableQuantity,
    productId: issue.productId,
    productName: issue.productName,
  };
}
