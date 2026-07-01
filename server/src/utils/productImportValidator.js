const TEXT_FIELDS = [
  "externalProductId",
  "name",
  "brand",
  "sku",
  "category",
  "description",
  "imageUrl",
  "sourceSystem",
];

function trimValue(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function optionalNumber(value, field, messages) {
  const text = trimValue(value);
  if (!text) return null;
  const number = Number(text);
  if (!Number.isFinite(number)) {
    messages.push(`${field} must be a number when provided.`);
    return null;
  }
  return number;
}

function optionalBoolean(value, messages) {
  if (value === undefined || value === null || trimValue(value) === "") return null;
  if (typeof value === "boolean") return value;

  const normalized = trimValue(value).toLowerCase();
  if (["true", "yes", "1"].includes(normalized)) return true;
  if (["false", "no", "0"].includes(normalized)) return false;

  messages.push("isAvailable must be true, false, yes, no, 1, or 0 when provided.");
  return null;
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

    if (!normalized.name) messages.push("name is required.");

    normalized.price = optionalNumber(row.price, "price", messages);
    normalized.stockQuantity = optionalNumber(row.stockQuantity, "stockQuantity", messages);
    normalized.isAvailable = optionalBoolean(row.isAvailable, messages);

    if (messages.length > 0) {
      errors.push({ rowNumber: index + 2, messages });
    } else {
      validRows.push(normalized);
    }
  });

  return { validRows, errors };
}
