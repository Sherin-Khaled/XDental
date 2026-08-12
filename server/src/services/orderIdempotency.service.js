import { createHash } from "node:crypto";

export const ORDER_IDEMPOTENCY_KEY_MIN_LENGTH = 16;
export const ORDER_IDEMPOTENCY_KEY_MAX_LENGTH = 128;

const ORDER_IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const IDEMPOTENCY_REUSE_MESSAGE =
  "This checkout attempt has changed. Review your order and submit it again.";

export class OrderIdempotencyError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = "OrderIdempotencyError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function normalizeOrderIdempotencyKey(value) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  if (
    normalized.length < ORDER_IDEMPOTENCY_KEY_MIN_LENGTH ||
    normalized.length > ORDER_IDEMPOTENCY_KEY_MAX_LENGTH ||
    !ORDER_IDEMPOTENCY_KEY_PATTERN.test(normalized)
  ) {
    return "";
  }
  return normalized;
}

export function isOrderIdempotencyConflict(error) {
  if (error?.code !== "P2002") return false;
  const target = Array.isArray(error?.meta?.target)
    ? error.meta.target.map(String).join(",")
    : String(error?.meta?.target ?? "");
  return target.includes("userId") && target.includes("idempotencyKey");
}

function normalizeFingerprintString(value, { lowercase = false } = {}) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return lowercase ? normalized.toLowerCase() : normalized;
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function canonicalItem(item) {
  return {
    externalProductId: normalizeFingerprintString(item.externalProductId),
    productId: normalizeFingerprintString(item.productId),
    quantity: Number(item.quantity),
    selectedOptions: normalizeFingerprintString(item.selectedOptions),
    sku: normalizeFingerprintString(item.sku, { lowercase: true }),
    slug: normalizeFingerprintString(item.slug, { lowercase: true }),
    variantId: normalizeFingerprintString(item.variantId),
  };
}

function itemSortKey(item) {
  return [
    item.productId,
    item.externalProductId,
    item.sku,
    item.slug,
    item.selectedOptions,
    item.variantId,
    String(item.quantity),
  ].join("\u001F");
}

/**
 * Hashes only normalized customer-supplied order inputs. Server-computed
 * prices, totals, order numbers, timestamps, and generated database IDs are
 * intentionally excluded.
 */
export function createOrderRequestFingerprint(input) {
  const items = (Array.isArray(input?.items) ? input.items : [])
    .map(canonicalItem)
    .sort((left, right) => itemSortKey(left).localeCompare(itemSortKey(right)));
  const canonical = {
    clinicLocationId: normalizeFingerprintString(input?.clinicLocationId),
    contact: {
      email: normalizeFingerprintString(input?.contact?.email, { lowercase: true }),
      name: normalizeFingerprintString(input?.contact?.name),
      phone: normalizeFingerprintString(input?.contact?.phone),
    },
    deliveryMethod: normalizeFingerprintString(input?.deliveryMethod, { lowercase: true }),
    items,
    paymentMethod: normalizeFingerprintString(input?.paymentMethod, { lowercase: true }),
    promoCode: normalizeFingerprintString(input?.promoCode).toUpperCase(),
    requestedPoints: Number(input?.requestedPoints ?? 0),
    requestedWalletAmount: normalizeFingerprintString(
      String(input?.requestedWalletAmount ?? "0")
    ),
    shippingAddress: {
      apartmentFloor: normalizeFingerprintString(input?.shippingAddress?.apartmentFloor),
      building: normalizeFingerprintString(input?.shippingAddress?.building),
      cityArea: normalizeFingerprintString(input?.shippingAddress?.cityArea),
      clinicBranch: normalizeFingerprintString(input?.shippingAddress?.clinicBranch),
      clinicName: normalizeFingerprintString(input?.shippingAddress?.clinicName),
      country: normalizeFingerprintString(input?.shippingAddress?.country),
      deliveryNotes: normalizeFingerprintString(input?.shippingAddress?.deliveryNotes),
      governorate: normalizeFingerprintString(input?.shippingAddress?.governorate),
      orderNotes: normalizeFingerprintString(input?.shippingAddress?.orderNotes),
      postalCode: normalizeFingerprintString(input?.shippingAddress?.postalCode),
      street: normalizeFingerprintString(input?.shippingAddress?.street),
    },
  };
  return createHash("sha256").update(stableJson(canonical), "utf8").digest("hex");
}

function replayResult(order, requestFingerprint) {
  if (!order.requestFingerprint || order.requestFingerprint !== requestFingerprint) {
    throw new OrderIdempotencyError(
      409,
      "IDEMPOTENCY_KEY_REUSED",
      IDEMPOTENCY_REUSE_MESSAGE
    );
  }
  return { order, created: false, idempotentReplay: true };
}

function orderLookup(userId, idempotencyKey, include) {
  return {
    where: {
      userId_idempotencyKey: {
        userId,
        idempotencyKey,
      },
    },
    ...(include ? { include } : {}),
  };
}

/**
 * The unique (userId, idempotencyKey) constraint remains the final race
 * barrier. Only the transaction that inserts the Order can commit its
 * transaction-local side effects.
 */
export async function executeIdempotentOrderCreation({
  database,
  userId,
  idempotencyKey,
  requestFingerprint,
  include,
  create,
}) {
  const lookup = orderLookup(userId, idempotencyKey, include);
  const existingOrder = await database.order.findUnique(lookup);
  if (existingOrder) return replayResult(existingOrder, requestFingerprint);

  try {
    const order = await database.$transaction((transaction) => create(transaction));
    return { order, created: true, idempotentReplay: false };
  } catch (error) {
    if (!isOrderIdempotencyConflict(error)) throw error;
    const racedOrder = await database.order.findUnique(lookup);
    if (!racedOrder) throw error;
    return replayResult(racedOrder, requestFingerprint);
  }
}
