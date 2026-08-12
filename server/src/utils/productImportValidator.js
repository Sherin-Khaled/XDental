const TEXT_FIELDS = [
  "externalProductId",
  "name",
  "slug",
  "brand",
  "sku",
  "category",
  "subcategory",
  "description",
  "imageUrl",
  "sourceSystem",
];

const PRODUCT_STATUSES = new Set(["ACTIVE", "LOW_STOCK", "OUT_OF_STOCK", "DRAFT", "INACTIVE"]);

export const PRODUCT_IMPORT_COLUMNS = [
  "sku",
  "name",
  "slug",
  "brand",
  "category",
  "subcategory",
  "price",
  "stockQuantity",
  "status",
  "isAvailable",
  "outOfStock",
  "imageUrl",
  "description",
  "externalProductId",
  "sourceSystem",
];

function trimValue(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function requiredNumber(value, field, messages, { integer = false } = {}) {
  const text = trimValue(value);
  if (!text) {
    messages.push(`${field} is required.`);
    return null;
  }
  const number = Number(text);
  if (!Number.isFinite(number) || number < 0 || number > 100000000 || (integer && !Number.isInteger(number))) {
    messages.push(`${field} must be a non-negative${integer ? " whole" : ""} number.`);
    return null;
  }
  return integer ? number : Math.round(number * 100) / 100;
}

function optionalBoolean(value, field, messages) {
  if (value === undefined || value === null || trimValue(value) === "") return null;
  if (typeof value === "boolean") return value;

  const normalized = trimValue(value).toLowerCase();
  if (["true", "yes", "1"].includes(normalized)) return true;
  if (["false", "no", "0"].includes(normalized)) return false;

  messages.push(`${field} must be true, false, yes, no, 1, or 0 when provided.`);
  return null;
}

function normalizeStatus(value, messages) {
  const text = trimValue(value);
  if (!text) return null;
  const normalized = text.toUpperCase().replace(/[\s-]+/g, "_");
  const aliases = {
    AVAILABLE: "ACTIVE",
    IN_STOCK: "ACTIVE",
    UNAVAILABLE: "OUT_OF_STOCK",
    OUTOFSTOCK: "OUT_OF_STOCK",
  };
  const status = aliases[normalized] ?? normalized;
  if (!PRODUCT_STATUSES.has(status)) {
    messages.push("status must be ACTIVE, LOW_STOCK, OUT_OF_STOCK, DRAFT, or INACTIVE.");
    return null;
  }
  return status;
}

function validImageUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateProductRows(rows) {
  if (!Array.isArray(rows)) {
    return {
      validRows: [],
      errors: [{ rowNumber: null, messages: ["Product rows must be provided as an array."] }],
    };
  }

  const validRows = [];
  const errors = [];

  rows.forEach((input, index) => {
    const row = input && typeof input === "object" ? input : {};
    const messages = [];
    const normalized = Object.fromEntries(TEXT_FIELDS.map((field) => [field, trimValue(row[field])]));

    if (!normalized.sku) messages.push("sku is required.");
    if (!normalized.name) messages.push("name is required.");
    if (normalized.sku.length > 120) messages.push("sku cannot exceed 120 characters.");
    if (normalized.name.length > 200) messages.push("name cannot exceed 200 characters.");
    if (!validImageUrl(normalized.imageUrl)) messages.push("imageUrl must use http or https.");

    normalized.price = requiredNumber(row.price, "price", messages);
    normalized.stockQuantity = requiredNumber(
      trimValue(row.stockQuantity) || trimValue(row.stock),
      "stockQuantity",
      messages,
      { integer: true }
    );
    normalized.status = normalizeStatus(row.status, messages);
    normalized.isAvailable = optionalBoolean(row.isAvailable, "isAvailable", messages);
    normalized.outOfStock = optionalBoolean(row.outOfStock, "outOfStock", messages);

    if (normalized.stockQuantity === 0 || normalized.outOfStock === true || normalized.isAvailable === false) {
      normalized.status = "OUT_OF_STOCK";
      normalized.isAvailable = false;
    } else {
      normalized.status ??= "ACTIVE";
      normalized.isAvailable = ["ACTIVE", "LOW_STOCK"].includes(normalized.status);
    }
    normalized.rowNumber = index + 2;

    if (messages.length > 0) {
      errors.push({ rowNumber: index + 2, messages });
    } else {
      validRows.push(normalized);
    }
  });

  return { validRows, errors };
}
