const TRUE_VALUES = new Set(["true", "1", "yes", "on"]);
const FALSE_VALUES = new Set(["false", "0", "no", "off", ""]);

const RECIPIENT_VARIABLES = {
  CONTACT: "CONTACT_NOTIFICATION_EMAIL",
  NEWSLETTER: "NEWSLETTER_NOTIFICATION_EMAIL",
  QUOTE: "QUOTE_NOTIFICATION_EMAIL",
  PRODUCT_REQUEST: "PRODUCT_REQUEST_NOTIFICATION_EMAIL",
  MACHINE_INQUIRY: "MACHINE_INQUIRY_NOTIFICATION_EMAIL",
  SUPPORT: "SUPPORT_NOTIFICATION_EMAIL",
};

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseBoolean(name, value, fallback = false) {
  const normalized = clean(value).toLowerCase();
  if (!normalized) return fallback;
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  throw new Error(`${name} must be true or false.`);
}

function parsePort(value) {
  const port = Number.parseInt(clean(value), 10);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : null;
}

export function readMailConfiguration(environment = process.env) {
  const enabled = parseBoolean("MAIL_ENABLED", environment.MAIL_ENABLED, false);
  const port = parsePort(environment.SMTP_PORT);
  const secure = parseBoolean("SMTP_SECURE", environment.SMTP_SECURE, port === 465);
  const companyRecipient = clean(environment.COMPANY_NOTIFICATION_EMAIL);

  return {
    enabled,
    smtp: {
      host: clean(environment.SMTP_HOST),
      port,
      secure,
      user: clean(environment.SMTP_USER),
      pass: clean(environment.SMTP_PASS),
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    },
    from: {
      name: clean(environment.MAIL_FROM_NAME) || "X Dental Store",
      email: clean(environment.MAIL_FROM_EMAIL),
    },
    companyRecipient,
    recipients: Object.fromEntries(
      Object.entries(RECIPIENT_VARIABLES).map(([category, variable]) => [
        category,
        clean(environment[variable]) || companyRecipient,
      ])
    ),
    appBaseUrl: clean(environment.APP_BASE_URL).replace(/\/+$/, ""),
  };
}

export function getMailConfigurationErrors(environment = process.env) {
  let configuration;
  try {
    configuration = readMailConfiguration(environment);
  } catch (error) {
    return [error instanceof Error ? error.message : "Mail configuration is invalid."];
  }

  if (!configuration.enabled) return [];

  const missing = [];
  if (!configuration.smtp.host) missing.push("SMTP_HOST");
  if (!configuration.smtp.port) missing.push("SMTP_PORT");
  if (!configuration.smtp.user) missing.push("SMTP_USER");
  if (!configuration.smtp.pass) missing.push("SMTP_PASS");
  if (!configuration.from.email) missing.push("MAIL_FROM_EMAIL");
  if (!configuration.companyRecipient) missing.push("COMPANY_NOTIFICATION_EMAIL");
  if (!configuration.appBaseUrl) missing.push("APP_BASE_URL");
  if (!clean(environment.SMTP_SECURE)) missing.push("SMTP_SECURE");
  return missing;
}

export function validateMailConfiguration(environment = process.env) {
  const errors = getMailConfigurationErrors(environment);
  if (errors.length === 0) return readMailConfiguration(environment);

  const variableErrors = errors.filter((error) => /^[A-Z0-9_]+$/.test(error));
  if (variableErrors.length === errors.length) {
    throw new Error(`Mail is enabled, but ${variableErrors.join(", ")} ${variableErrors.length === 1 ? "is" : "are"} missing or invalid.`);
  }
  throw new Error(errors.join(" "));
}

export function getNotificationRecipient(category, configuration = readMailConfiguration()) {
  return configuration.recipients[category] || configuration.companyRecipient || "";
}

