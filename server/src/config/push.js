const TRUE_VALUES = new Set(["true", "1", "yes", "on"]);
const FALSE_VALUES = new Set(["false", "0", "no", "off", ""]);
const BASE64_URL_PATTERN = /^[A-Za-z0-9_-]+$/;

// A deployed environment must keep one stable VAPID key pair; rotating it
// invalidates existing browser subscriptions and requires customers to opt in again.
function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseEnabled(value) {
  const normalized = clean(value).toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  throw new Error("WEB_PUSH_ENABLED must be true or false.");
}

function parseSubject(value) {
  const subject = clean(value);
  if (!subject) {
    throw new Error("WEB_PUSH_VAPID_SUBJECT is required when browser push is enabled.");
  }

  if (subject.startsWith("mailto:")) {
    const email = subject.slice("mailto:".length);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("WEB_PUSH_VAPID_SUBJECT must contain a valid mailto address or HTTPS URL.");
    }
    return subject;
  }

  let parsed;
  try {
    parsed = new URL(subject);
  } catch {
    throw new Error("WEB_PUSH_VAPID_SUBJECT must contain a valid mailto address or HTTPS URL.");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new Error("WEB_PUSH_VAPID_SUBJECT must contain a valid mailto address or HTTPS URL.");
  }
  return parsed.toString();
}

function parseVapidKey(value, name, expectedBytes, requiredFirstByte) {
  const key = clean(value);
  if (!key || !BASE64_URL_PATTERN.test(key)) {
    throw new Error(`${name} must contain a valid URL-safe Base64 VAPID key.`);
  }

  const decoded = Buffer.from(key, "base64url");
  if (
    decoded.length !== expectedBytes ||
    decoded.toString("base64url") !== key ||
    (requiredFirstByte !== undefined && decoded[0] !== requiredFirstByte)
  ) {
    throw new Error(`${name} must contain a valid URL-safe Base64 VAPID key.`);
  }
  return key;
}

export function readPushConfiguration(environment = process.env) {
  const enabled = parseEnabled(environment.WEB_PUSH_ENABLED);
  if (!enabled) {
    return {
      enabled: false,
      subject: null,
      publicKey: null,
      privateKey: null,
    };
  }

  return {
    enabled: true,
    subject: parseSubject(environment.WEB_PUSH_VAPID_SUBJECT),
    publicKey: parseVapidKey(
      environment.WEB_PUSH_VAPID_PUBLIC_KEY,
      "WEB_PUSH_VAPID_PUBLIC_KEY",
      65,
      4
    ),
    privateKey: parseVapidKey(
      environment.WEB_PUSH_VAPID_PRIVATE_KEY,
      "WEB_PUSH_VAPID_PRIVATE_KEY",
      32
    ),
  };
}

export function getPublicPushConfiguration(configuration) {
  return {
    enabled: configuration.enabled,
    publicKey: configuration.enabled ? configuration.publicKey : null,
  };
}

export const validatePushConfiguration = readPushConfiguration;
