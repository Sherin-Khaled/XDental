import { prisma } from "../config/db.js";

export const DEFAULT_ACCOUNT_PREFERENCES = Object.freeze({
  orderUpdates: true,
  quoteUpdates: true,
  productRequestUpdates: true,
  backInStockUpdates: true,
  supportReplyUpdates: true,
  personalizedRecommendations: false,
  saveBrowsingActivity: false,
  useOrderHistoryForSuggestions: false,
  weeklyOffers: false,
  newArrivals: false,
  clinicSupplyOffers: false,
  marketingBackInStock: false,
  language: "en",
  country: "Egypt",
  currency: "EGP",
});

const BOOLEAN_FIELDS = new Set([
  "orderUpdates",
  "quoteUpdates",
  "productRequestUpdates",
  "backInStockUpdates",
  "supportReplyUpdates",
  "personalizedRecommendations",
  "saveBrowsingActivity",
  "useOrderHistoryForSuggestions",
  "weeklyOffers",
  "newArrivals",
  "clinicSupplyOffers",
  "marketingBackInStock",
]);

const MARKETING_FIELDS = new Set([
  "weeklyOffers",
  "newArrivals",
  "clinicSupplyOffers",
  "marketingBackInStock",
]);

const ALLOWED_FIELDS = new Set([
  ...BOOLEAN_FIELDS,
  "language",
  "country",
  "currency",
]);

const LANGUAGE_TO_DATABASE = { en: "EN", ar: "AR" };
const LANGUAGE_TO_API = { EN: "en", AR: "ar" };

export class PreferenceValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "PreferenceValidationError";
    this.field = field;
  }
}

export function serializeAccountPreferences(preference) {
  if (!preference) return { ...DEFAULT_ACCOUNT_PREFERENCES };
  return {
    orderUpdates: preference.orderUpdates,
    quoteUpdates: preference.quoteUpdates,
    productRequestUpdates: preference.productRequestUpdates,
    backInStockUpdates: preference.backInStockUpdates,
    supportReplyUpdates: preference.supportReplyUpdates,
    personalizedRecommendations: preference.personalizedRecommendations,
    saveBrowsingActivity: preference.saveBrowsingActivity,
    useOrderHistoryForSuggestions: preference.useOrderHistoryForSuggestions,
    weeklyOffers: preference.weeklyOffers,
    newArrivals: preference.newArrivals,
    clinicSupplyOffers: preference.clinicSupplyOffers,
    marketingBackInStock: preference.marketingBackInStock,
    language: LANGUAGE_TO_API[preference.language] ?? "en",
    country: "Egypt",
    currency: "EGP",
  };
}

export function validatePreferencePatch(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new PreferenceValidationError("Preferences must be a JSON object.");
  }

  const keys = Object.keys(input);
  if (keys.length === 0) {
    throw new PreferenceValidationError("Supply at least one preference to update.");
  }

  const unknown = keys.find((key) => !ALLOWED_FIELDS.has(key));
  if (unknown) {
    throw new PreferenceValidationError(`Unknown preference field: ${unknown}.`, unknown);
  }

  const validated = {};
  for (const key of keys) {
    const value = input[key];
    if (BOOLEAN_FIELDS.has(key)) {
      if (typeof value !== "boolean") {
        throw new PreferenceValidationError(`${key} must be true or false.`, key);
      }
      validated[key] = value;
      continue;
    }

    if (key === "language") {
      if (!(value in LANGUAGE_TO_DATABASE)) {
        throw new PreferenceValidationError("Language must be en or ar.", key);
      }
      validated.language = value;
      continue;
    }

    if (key === "country" && value !== "Egypt") {
      throw new PreferenceValidationError("Only Egypt is currently supported.", key);
    }
    if (key === "currency" && value !== "EGP") {
      throw new PreferenceValidationError("Only EGP is currently supported.", key);
    }
    validated[key] = value;
  }
  return validated;
}

function toDatabaseInput(preferences) {
  return {
    ...preferences,
    ...(preferences.language
      ? { language: LANGUAGE_TO_DATABASE[preferences.language] }
      : {}),
    ...(preferences.country ? { country: "EGYPT" } : {}),
    ...(preferences.currency ? { currency: "EGP" } : {}),
  };
}

function defaultDatabaseInput() {
  return toDatabaseInput(DEFAULT_ACCOUNT_PREFERENCES);
}

function hasMarketingOptIn(preferences) {
  return [...MARKETING_FIELDS].some((field) => preferences[field]);
}

async function synchronizeNewsletterConsent({
  email,
  preferences,
  marketingTouched,
  database,
}) {
  if (!marketingTouched || !email) return;

  const existing = await database.newsletterSubscriber.findUnique({
    where: { email },
  });
  if (hasMarketingOptIn(preferences)) {
    await database.newsletterSubscriber.upsert({
      where: { email },
      create: {
        email,
        source: "account_preferences",
        locale: preferences.language,
        status: "SUBSCRIBED",
      },
      update: {
        status: "SUBSCRIBED",
        locale: preferences.language,
      },
    });
    return;
  }

  if (existing?.status === "SUBSCRIBED") {
    await database.newsletterSubscriber.update({
      where: { email },
      data: { status: "UNSUBSCRIBED", locale: preferences.language },
    });
  }
}

export async function getAccountPreferences(userId, database = prisma) {
  const preference = await database.accountPreference.findUnique({
    where: { userId },
  });
  return {
    preferences: serializeAccountPreferences(preference),
    persisted: Boolean(preference),
  };
}

export async function updateAccountPreferences(
  { userId, email, patch },
  database = prisma
) {
  const validated = validatePreferencePatch(patch);
  const databasePatch = toDatabaseInput(validated);
  const preference = await database.accountPreference.upsert({
    where: { userId },
    create: {
      userId,
      ...defaultDatabaseInput(),
      ...databasePatch,
    },
    update: databasePatch,
  });
  const preferences = serializeAccountPreferences(preference);

  await synchronizeNewsletterConsent({
    email,
    preferences,
    marketingTouched: Object.keys(validated).some((key) => MARKETING_FIELDS.has(key)),
    database,
  });

  return preferences;
}

export const NOTIFICATION_PREFERENCE_BY_TYPE = Object.freeze({
  ORDER_UPDATE: "orderUpdates",
  QUOTE_UPDATE: "quoteUpdates",
  PRODUCT_REQUEST: "productRequestUpdates",
  PRODUCT_AVAILABLE: "backInStockUpdates",
  SUPPORT_MESSAGE: "supportReplyUpdates",
});

export async function shouldCreateNotification(input, database = prisma) {
  if (input.mandatory || input.type === "ACCOUNT") return true;
  const preferenceField = NOTIFICATION_PREFERENCE_BY_TYPE[input.type];
  if (!preferenceField) return true;

  const recipient = await database.user.findUnique({
    where: { id: input.userId ?? input.user },
    select: {
      role: true,
      accountPreference: {
        select: { [preferenceField]: true },
      },
    },
  });
  if (!recipient) return false;
  if (recipient.role !== "CUSTOMER") return true;
  return recipient.accountPreference?.[preferenceField]
    ?? DEFAULT_ACCOUNT_PREFERENCES[preferenceField];
}
