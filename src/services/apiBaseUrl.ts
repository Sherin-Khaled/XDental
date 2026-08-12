export const DEVELOPMENT_API_BASE_URL = "http://localhost:5000/api";

const CONFIGURATION_ERROR_PREFIX =
  "Frontend API configuration error: VITE_API_URL";

function isLocalHostname(hostname: string) {
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
    ipv4Parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) &&
    ipv4Parts[0] === 127
  );
}

function configurationError(message: string) {
  return new Error(`${CONFIGURATION_ERROR_PREFIX} ${message}`);
}

export function resolveApiBaseUrl(
  configuredValue: string | undefined,
  isDevelopment: boolean
) {
  const configuredUrl = configuredValue?.trim();
  if (!configuredUrl) {
    if (isDevelopment) return DEVELOPMENT_API_BASE_URL;
    throw configurationError(
      "is required for production builds and must be an absolute HTTPS URL."
    );
  }

  if (
    isDevelopment &&
    configuredUrl.startsWith("/") &&
    !configuredUrl.startsWith("//")
  ) {
    if (configuredUrl.includes("\\") || /[?#]/.test(configuredUrl)) {
      throw configurationError(
        "must be a safe root-relative path or an absolute HTTP(S) URL in development."
      );
    }
    return configuredUrl.replace(/\/+$/, "") || "/";
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(configuredUrl);
  } catch {
    throw configurationError("must be a valid absolute URL.");
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw configurationError("must not contain embedded credentials.");
  }
  if (parsedUrl.search || parsedUrl.hash) {
    throw configurationError("must not contain a query string or fragment.");
  }

  if (isDevelopment) {
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw configurationError("must use HTTP or HTTPS in development.");
    }
  } else {
    if (parsedUrl.protocol !== "https:") {
      throw configurationError("must use HTTPS in production.");
    }
    if (isLocalHostname(parsedUrl.hostname)) {
      throw configurationError("must not point to localhost in production.");
    }
  }

  return parsedUrl.toString().replace(/\/+$/, "");
}
