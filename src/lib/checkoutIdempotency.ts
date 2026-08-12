import type { CreateOrderInput } from "@/services/orders";

const CHECKOUT_ATTEMPT_PREFIX = "xdental:checkout-attempt:v1:";
const IDEMPOTENCY_KEY_MIN_LENGTH = 16;
const IDEMPOTENCY_KEY_MAX_LENGTH = 128;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

type CryptoSource = Pick<Crypto, "getRandomValues"> & Partial<Pick<Crypto, "randomUUID">>;

type CheckoutAttemptRecord = {
  version: 1;
  userId: string;
  fingerprint: string;
  idempotencyKey: string;
};

export type CheckoutAttempt = {
  idempotencyKey: string;
  reused: boolean;
};

function normalizeText(value: unknown, lowercase = false) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return lowercase ? normalized.toLowerCase() : normalized;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashForStorage(value: string) {
  // This non-cryptographic digest keeps customer details out of sessionStorage.
  // Server-side SHA-256 remains the security boundary for request comparison.
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const character = value.charCodeAt(index);
    first = Math.imul(first ^ character, 0x01000193);
    second = Math.imul(second ^ character, 0x85ebca6b);
  }
  return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
}

function itemSortKey(item: Record<string, string | number>) {
  return Object.values(item).join("\u001f");
}

export function fingerprintCheckoutAttempt(input: CreateOrderInput) {
  const items = input.items
    .map((item) => ({
      externalProductId: normalizeText(item.externalProductId),
      productId: normalizeText(item.productId),
      quantity: Number(item.quantity),
      selectedOptions: normalizeText(item.selectedOptions),
      sku: normalizeText(item.sku, true),
      slug: normalizeText(item.slug, true),
    }))
    .sort((left, right) => itemSortKey(left).localeCompare(itemSortKey(right)));
  const canonical = {
    clinicLocationId: normalizeText(input.clinicLocationId),
    contact: {
      email: normalizeText(input.customerEmail, true),
      name: normalizeText(input.customerName),
      phone: normalizeText(input.customerPhone),
    },
    deliveryMethod: normalizeText(input.deliveryMethod, true),
    items,
    paymentMethod: normalizeText(input.paymentMethod, true),
    promoCode: normalizeText(input.promoCode).toUpperCase(),
    requestedPoints: Number(input.requestedPoints ?? 0),
    requestedWalletAmount: normalizeText(
      String(input.requestedWalletAmount ?? "0")
    ),
    shippingAddress: {
      apartmentFloor: normalizeText(input.apartmentFloor),
      building: normalizeText(input.buildingNumber),
      cityArea: normalizeText(input.cityArea),
      clinicBranch: normalizeText(input.clinicBranch),
      clinicName: normalizeText(input.clinicName),
      country: normalizeText(input.country),
      deliveryNotes: normalizeText(input.deliveryNotes),
      governorate: normalizeText(input.governorate),
      orderNotes: normalizeText(input.orderNotes),
      postalCode: normalizeText(input.postalCode),
      street: normalizeText(input.streetAddress),
    },
  };
  return hashForStorage(stableJson(canonical));
}

function isValidIdempotencyKey(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= IDEMPOTENCY_KEY_MIN_LENGTH &&
    value.length <= IDEMPOTENCY_KEY_MAX_LENGTH &&
    IDEMPOTENCY_KEY_PATTERN.test(value)
  );
}

function storageKey(userId: string) {
  return `${CHECKOUT_ATTEMPT_PREFIX}${encodeURIComponent(userId)}`;
}

function readAttempt(storage: Storage, userId: string): CheckoutAttemptRecord | null {
  try {
    const raw = storage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CheckoutAttemptRecord>;
    if (
      parsed.version !== 1 ||
      parsed.userId !== userId ||
      typeof parsed.fingerprint !== "string" ||
      !isValidIdempotencyKey(parsed.idempotencyKey)
    ) {
      storage.removeItem(storageKey(userId));
      return null;
    }
    return parsed as CheckoutAttemptRecord;
  } catch {
    storage.removeItem(storageKey(userId));
    return null;
  }
}

export function generateCheckoutIdempotencyKey(
  cryptoSource: CryptoSource = globalThis.crypto
) {
  if (typeof cryptoSource?.randomUUID === "function") {
    return cryptoSource.randomUUID();
  }
  if (typeof cryptoSource?.getRandomValues !== "function") {
    throw new Error("Secure browser randomness is unavailable.");
  }
  const bytes = new Uint8Array(16);
  cryptoSource.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function resolveCheckoutAttempt(
  storage: Storage,
  userId: string,
  fingerprint: string,
  cryptoSource: CryptoSource = globalThis.crypto
): CheckoutAttempt {
  const current = readAttempt(storage, userId);
  if (current?.fingerprint === fingerprint) {
    return { idempotencyKey: current.idempotencyKey, reused: true };
  }

  const idempotencyKey = generateCheckoutIdempotencyKey(cryptoSource);
  storage.setItem(
    storageKey(userId),
    JSON.stringify({
      version: 1,
      userId,
      fingerprint,
      idempotencyKey,
    } satisfies CheckoutAttemptRecord)
  );
  return { idempotencyKey, reused: false };
}

export function invalidateChangedCheckoutAttempt(
  storage: Storage,
  userId: string,
  fingerprint: string
) {
  const current = readAttempt(storage, userId);
  if (current && current.fingerprint !== fingerprint) {
    storage.removeItem(storageKey(userId));
    return true;
  }
  return false;
}

export function clearCheckoutAttempt(
  storage: Storage,
  userId: string,
  idempotencyKey?: string
) {
  const current = readAttempt(storage, userId);
  if (!current || (idempotencyKey && current.idempotencyKey !== idempotencyKey)) {
    return false;
  }
  storage.removeItem(storageKey(userId));
  return true;
}

export function runSingleCheckoutSubmission<T>(
  activeSubmission: { current: Promise<T> | null },
  submit: () => Promise<T>
) {
  if (activeSubmission.current) return activeSubmission.current;
  const pending = submit().finally(() => {
    if (activeSubmission.current === pending) activeSubmission.current = null;
  });
  activeSubmission.current = pending;
  return pending;
}

export function completeCheckoutAttemptOnce(
  completed: { current: boolean },
  complete: () => void
) {
  if (completed.current) return false;
  completed.current = true;
  complete();
  return true;
}
