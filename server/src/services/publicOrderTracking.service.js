import { timingSafeEqual } from "node:crypto";

export const PUBLIC_ORDER_NUMBER_MAX_LENGTH = 80;
export const PUBLIC_PHONE_MAX_LENGTH = 80;

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const EGYPTIAN_MOBILE_PATTERN = /^201[0125]\d{8}$/;

function toLatinDigits(value) {
  return value
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)));
}

export function normalizePublicOrderNumber(value) {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toUpperCase();
  return normalized.length <= PUBLIC_ORDER_NUMBER_MAX_LENGTH ? normalized : "";
}

export function normalizeEgyptianPhone(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > PUBLIC_PHONE_MAX_LENGTH) return "";

  let digits = toLatinDigits(trimmed).replace(/\D/g, "");
  if (digits.startsWith("0020")) digits = `20${digits.slice(4)}`;
  if (/^01[0125]\d{8}$/.test(digits)) digits = `20${digits.slice(1)}`;

  return EGYPTIAN_MOBILE_PATTERN.test(digits) ? digits : "";
}

function securePhoneMatch(submittedPhone, storedPhone) {
  const submitted = Buffer.from(submittedPhone);
  const stored = Buffer.from(storedPhone);
  return submitted.length === stored.length && timingSafeEqual(submitted, stored);
}

export async function findPublicOrderTracking(database, { orderNumber, phone }) {
  const normalizedOrderNumber = normalizePublicOrderNumber(orderNumber);
  const normalizedPhone = normalizeEgyptianPhone(phone);
  if (!normalizedOrderNumber || !normalizedPhone) return null;

  const order = await database.order.findUnique({
    where: { orderNumber: normalizedOrderNumber },
    select: {
      orderNumber: true,
      customerPhone: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const storedPhone = normalizeEgyptianPhone(order?.customerPhone);
  if (!order || !storedPhone || !securePhoneMatch(normalizedPhone, storedPhone)) {
    return null;
  }

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}
