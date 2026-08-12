import { createHash } from "node:crypto";
import { prisma } from "../config/db.js";

const MAX_ENDPOINT_LENGTH = 4_096;
const BASE64_URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export class PushSubscriptionInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "PushSubscriptionInputError";
    this.code = "INVALID_PUSH_SUBSCRIPTION";
  }
}

function readBase64UrlKey(value, name, expectedBytes) {
  const key = typeof value === "string" ? value.trim() : "";
  if (!key || !BASE64_URL_PATTERN.test(key)) {
    throw new PushSubscriptionInputError(`${name} is invalid.`);
  }

  const decoded = Buffer.from(key, "base64url");
  if (
    decoded.length !== expectedBytes ||
    decoded.toString("base64url") !== key
  ) {
    throw new PushSubscriptionInputError(`${name} is invalid.`);
  }
  return key;
}

export function hashPushEndpoint(endpoint) {
  return createHash("sha256").update(endpoint, "utf8").digest("hex");
}

export function normalizePushSubscription(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PushSubscriptionInputError("Push subscription details are required.");
  }

  const endpoint = typeof value.endpoint === "string" ? value.endpoint.trim() : "";
  if (!endpoint || endpoint.length > MAX_ENDPOINT_LENGTH) {
    throw new PushSubscriptionInputError("Push subscription endpoint is invalid.");
  }

  let parsedEndpoint;
  try {
    parsedEndpoint = new URL(endpoint);
  } catch {
    throw new PushSubscriptionInputError("Push subscription endpoint is invalid.");
  }
  if (
    parsedEndpoint.protocol !== "https:" ||
    parsedEndpoint.username ||
    parsedEndpoint.password ||
    parsedEndpoint.hash
  ) {
    throw new PushSubscriptionInputError("Push subscription endpoint is invalid.");
  }

  const p256dh = readBase64UrlKey(value.keys?.p256dh, "Push subscription p256dh key", 65);
  const auth = readBase64UrlKey(value.keys?.auth, "Push subscription auth key", 16);

  return {
    endpoint,
    endpointHash: hashPushEndpoint(endpoint),
    p256dh,
    auth,
  };
}

export async function savePushSubscription(
  { userId, subscription },
  database = prisma
) {
  const normalized = normalizePushSubscription(subscription);
  return database.pushSubscription.upsert({
    where: { endpointHash: normalized.endpointHash },
    create: {
      userId,
      ...normalized,
    },
    update: {
      userId,
      endpoint: normalized.endpoint,
      p256dh: normalized.p256dh,
      auth: normalized.auth,
    },
  });
}

export async function removePushSubscription(
  { userId, endpoint },
  database = prisma
) {
  const normalizedEndpoint = typeof endpoint === "string" ? endpoint.trim() : "";
  if (!normalizedEndpoint || normalizedEndpoint.length > MAX_ENDPOINT_LENGTH) {
    throw new PushSubscriptionInputError("Push subscription endpoint is invalid.");
  }

  return database.pushSubscription.deleteMany({
    where: {
      userId,
      endpointHash: hashPushEndpoint(normalizedEndpoint),
    },
  });
}
