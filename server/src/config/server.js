const NODE_ENVIRONMENTS = new Set(["development", "test", "production"]);
const COOKIE_SAME_SITE_VALUES = new Set(["lax", "strict", "none"]);
const DEVELOPMENT_CLIENT_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
];

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isLocalHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "::1" ||
    normalized === "0.0.0.0"
  ) {
    return true;
  }

  const ipv4Parts = normalized.split(".").map(Number);
  return (
    ipv4Parts.length === 4 &&
    ipv4Parts.every(
      (part) => Number.isInteger(part) && part >= 0 && part <= 255
    ) &&
    ipv4Parts[0] === 127
  );
}

function parsePort(value) {
  const configured = clean(value);
  if (!configured) return 5000;
  if (!/^\d+$/.test(configured)) {
    throw new Error("PORT must be a whole number between 1 and 65535.");
  }

  const port = Number(configured);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a whole number between 1 and 65535.");
  }
  return port;
}

function parseClientOrigin(value, production) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("CLIENT_URL must contain valid absolute frontend origins.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("CLIENT_URL origins must use HTTP or HTTPS.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("CLIENT_URL origins must not contain embedded credentials.");
  }
  if (
    (parsed.pathname && parsed.pathname !== "/") ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("CLIENT_URL must contain origins only, without paths, queries, or fragments.");
  }
  if (production && parsed.protocol !== "https:") {
    throw new Error("CLIENT_URL origins must use HTTPS in production.");
  }
  if (production && isLocalHostname(parsed.hostname)) {
    throw new Error("CLIENT_URL must not point to localhost in production.");
  }

  return parsed.origin;
}

export function getClientOrigins(environment = process.env) {
  const nodeEnvironment = clean(environment.NODE_ENV).toLowerCase();
  const production = nodeEnvironment === "production";
  const configured = clean(environment.CLIENT_URL);

  if (!configured) {
    if (production) {
      throw new Error("CLIENT_URL is required in production.");
    }
    return [...DEVELOPMENT_CLIENT_ORIGINS];
  }

  const rawOrigins = configured
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (rawOrigins.length === 0) {
    throw new Error("CLIENT_URL must contain at least one frontend origin.");
  }

  return [
    ...new Set(rawOrigins.map((origin) => parseClientOrigin(origin, production))),
  ];
}

export function readServerConfiguration(environment = process.env) {
  const nodeEnvironment = clean(environment.NODE_ENV).toLowerCase();
  if (!NODE_ENVIRONMENTS.has(nodeEnvironment)) {
    throw new Error(
      "NODE_ENV must be explicitly set to development, test, or production."
    );
  }

  if (!clean(environment.DATABASE_URL)) {
    throw new Error("DATABASE_URL is required.");
  }

  const jwtSecret = clean(environment.JWT_SECRET);
  if (jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 non-whitespace characters.");
  }

  const configuredSameSite = clean(environment.COOKIE_SAME_SITE).toLowerCase();
  if (
    configuredSameSite &&
    !COOKIE_SAME_SITE_VALUES.has(configuredSameSite)
  ) {
    throw new Error("COOKIE_SAME_SITE must be lax, strict, or none.");
  }

  return {
    nodeEnvironment,
    production: nodeEnvironment === "production",
    port: parsePort(environment.PORT),
    clientOrigins: getClientOrigins(environment),
    cookieSameSite: configuredSameSite || "lax",
  };
}
