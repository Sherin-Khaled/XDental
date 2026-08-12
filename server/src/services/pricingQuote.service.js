import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const PRICING_VERSION = "phase6-v1";
export const PRICING_QUOTE_TTL_MS = 10 * 60 * 1000;

export function requiresPriceReview(currentTotalCents, reviewedTotalCents) {
  return !Number.isSafeInteger(currentTotalCents)
    || !Number.isSafeInteger(reviewedTotalCents)
    || currentTotalCents > reviewedTotalCents;
}

export class PricingQuoteError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PricingQuoteError";
    this.statusCode = 409;
    this.code = code;
  }
}

function normalizeText(value, { lowercase = false } = {}) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return lowercase ? normalized.toLowerCase() : normalized;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
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
    externalProductId: normalizeText(item.externalProductId),
    productId: normalizeText(item.productId),
    quantity: Number(item.quantity),
    selectedOptions: normalizeText(item.selectedOptions),
    sku: normalizeText(item.sku, { lowercase: true }),
    slug: normalizeText(item.slug, { lowercase: true }),
    variantId: normalizeText(item.variantId),
  };
}

function itemSortKey(item) {
  return Object.values(item).join("\u001f");
}

/** Hashes only inputs that can change authoritative pricing. */
export function createPricingInputFingerprint({
  itemReferences,
  deliveryMethod,
  promoCode,
  clinicLocationId,
  requestedPoints = 0,
  requestedWalletAmount = 0,
}) {
  const canonical = {
    clinicLocationId: normalizeText(clinicLocationId),
    deliveryMethod: normalizeText(deliveryMethod, { lowercase: true }),
    items: (Array.isArray(itemReferences) ? itemReferences : [])
      .map(canonicalItem)
      .sort((left, right) => itemSortKey(left).localeCompare(itemSortKey(right))),
    promoCode: normalizeText(promoCode).toUpperCase(),
    requestedPoints: Number(requestedPoints),
    requestedWalletAmount: normalizeText(String(requestedWalletAmount)),
  };
  return createHash("sha256").update(stableJson(canonical), "utf8").digest("hex");
}

function secretValue(secret) {
  if (typeof secret !== "string" || secret.trim().length < 32) {
    throw new PricingQuoteError(
      "PRICING_QUOTE_UNAVAILABLE",
      "Secure pricing confirmation is currently unavailable."
    );
  }
  return secret;
}

function userHash(userId, secret) {
  return createHmac("sha256", secret).update(`pricing-user:${userId}`, "utf8").digest("base64url");
}

function signature(encodedPayload, secret) {
  return createHmac("sha256", secret).update(encodedPayload, "utf8").digest("base64url");
}

export function createPricingQuoteToken({
  userId,
  inputFingerprint,
  reviewedTotalCents,
  now = new Date(),
  secret = process.env.JWT_SECRET,
}) {
  const signingSecret = secretValue(secret);
  const issuedAt = now.getTime();
  const payload = {
    v: 1,
    pricingVersion: PRICING_VERSION,
    user: userHash(userId, signingSecret),
    input: inputFingerprint,
    total: reviewedTotalCents,
    issuedAt,
    expiresAt: issuedAt + PRICING_QUOTE_TTL_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${signature(encodedPayload, signingSecret)}`;
}

export function verifyPricingQuoteToken(
  token,
  {
    userId,
    inputFingerprint,
    now = new Date(),
    secret = process.env.JWT_SECRET,
  }
) {
  const signingSecret = secretValue(secret);
  if (typeof token !== "string" || token.length < 40 || token.length > 4096) {
    throw new PricingQuoteError(
      "PRICING_QUOTE_REQUIRED",
      "Review the latest order total before placing your order."
    );
  }
  const [encodedPayload, suppliedSignature, extra] = token.split(".");
  if (!encodedPayload || !suppliedSignature || extra) {
    throw new PricingQuoteError(
      "INVALID_PRICING_QUOTE",
      "The pricing confirmation is invalid. Review the latest total and try again."
    );
  }
  const expectedSignature = signature(encodedPayload, signingSecret);
  const supplied = Buffer.from(suppliedSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new PricingQuoteError(
      "INVALID_PRICING_QUOTE",
      "The pricing confirmation is invalid. Review the latest total and try again."
    );
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    throw new PricingQuoteError(
      "INVALID_PRICING_QUOTE",
      "The pricing confirmation is invalid. Review the latest total and try again."
    );
  }

  if (
    payload?.v !== 1
    || payload.pricingVersion !== PRICING_VERSION
    || payload.user !== userHash(userId, signingSecret)
    || payload.input !== inputFingerprint
    || !Number.isSafeInteger(payload.total)
    || !Number.isSafeInteger(payload.issuedAt)
    || !Number.isSafeInteger(payload.expiresAt)
  ) {
    throw new PricingQuoteError(
      "INVALID_PRICING_QUOTE",
      "Checkout details changed. Review the latest total and try again."
    );
  }
  if (now.getTime() >= payload.expiresAt || payload.issuedAt > now.getTime() + 60_000) {
    throw new PricingQuoteError(
      "EXPIRED_PRICING_QUOTE",
      "The pricing confirmation expired. Review the latest total and try again."
    );
  }
  return payload;
}
