const STORAGE_DRIVERS = new Set(["local", "s3"]);
const TRUE_VALUES = new Set(["true", "1", "yes", "on"]);
const FALSE_VALUES = new Set(["false", "0", "no", "off", ""]);

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

function parseBoolean(name, value, fallback = false) {
  const normalized = clean(value).toLowerCase();
  if (!normalized) return fallback;
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  throw new Error(`${name} must be true or false.`);
}

function parseSecureUrl(name, value, production) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS.`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${name} must not contain embedded credentials.`);
  }
  if (parsed.search || parsed.hash) {
    throw new Error(`${name} must not contain a query string or fragment.`);
  }
  if (production && isLocalHostname(parsed.hostname)) {
    throw new Error(`${name} must not point to localhost in production.`);
  }

  return parsed.toString().replace(/\/+$/, "");
}

export function readUploadStorageConfiguration(environment = process.env) {
  const production = clean(environment.NODE_ENV).toLowerCase() === "production";
  const driver =
    clean(environment.UPLOAD_STORAGE_DRIVER).toLowerCase() ||
    (production ? "s3" : "local");

  if (!STORAGE_DRIVERS.has(driver)) {
    throw new Error('UPLOAD_STORAGE_DRIVER must be either "local" or "s3".');
  }
  if (production && driver === "local") {
    throw new Error(
      'UPLOAD_STORAGE_DRIVER cannot be "local" in production because deployed application files are not durable.'
    );
  }
  if (driver === "local") {
    return { driver, production };
  }

  const variableNames = [
    "UPLOAD_S3_ENDPOINT",
    "UPLOAD_S3_REGION",
    "UPLOAD_S3_BUCKET",
    "UPLOAD_S3_ACCESS_KEY_ID",
    "UPLOAD_S3_SECRET_ACCESS_KEY",
    "UPLOAD_S3_PUBLIC_BASE_URL",
  ];
  const missing = variableNames.filter((name) => !clean(environment[name]));
  if (missing.length > 0) {
    throw new Error(
      `S3 upload storage is selected, but ${missing.join(", ")} ${
        missing.length === 1 ? "is" : "are"
      } missing.`
    );
  }

  const bucket = clean(environment.UPLOAD_S3_BUCKET);
  if (
    bucket.length < 3 ||
    bucket.length > 63 ||
    !/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(bucket) ||
    bucket.includes("..")
  ) {
    throw new Error(
      "UPLOAD_S3_BUCKET must be a valid lowercase S3-compatible bucket name."
    );
  }

  return {
    driver,
    production,
    endpoint: parseSecureUrl(
      "UPLOAD_S3_ENDPOINT",
      clean(environment.UPLOAD_S3_ENDPOINT),
      production
    ),
    region: clean(environment.UPLOAD_S3_REGION),
    bucket,
    accessKeyId: clean(environment.UPLOAD_S3_ACCESS_KEY_ID),
    secretAccessKey: clean(environment.UPLOAD_S3_SECRET_ACCESS_KEY),
    publicBaseUrl: parseSecureUrl(
      "UPLOAD_S3_PUBLIC_BASE_URL",
      clean(environment.UPLOAD_S3_PUBLIC_BASE_URL),
      production
    ),
    forcePathStyle: parseBoolean(
      "UPLOAD_S3_FORCE_PATH_STYLE",
      environment.UPLOAD_S3_FORCE_PATH_STYLE,
      false
    ),
  };
}

export function validateUploadStorageConfiguration(environment = process.env) {
  return readUploadStorageConfiguration(environment);
}
