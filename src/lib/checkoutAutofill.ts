export type CheckoutContactField =
  | "firstName"
  | "lastName"
  | "phone"
  | "email";

export type CheckoutContactValues = Record<CheckoutContactField, string>;

export type CheckoutAutofillUser = {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

const CONTACT_FIELDS: CheckoutContactField[] = [
  "firstName",
  "lastName",
  "phone",
  "email",
];
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const EGYPTIAN_MOBILE_PATTERN = /^201[0125]\d{8}$/;

function cleanOptionalText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function toLatinDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)));
}

/**
 * Matches the name mapping already used by the account profile form:
 * the first word is the first name and the remaining words are the last name.
 */
export function splitCheckoutDisplayName(name: string | null | undefined) {
  const parts = cleanOptionalText(name).split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

export function buildCheckoutContactAutofill(
  user: CheckoutAutofillUser
): CheckoutContactValues {
  const explicitFirstName = cleanOptionalText(user.firstName);
  const explicitLastName = cleanOptionalText(user.lastName);
  const hasExplicitName = Boolean(explicitFirstName || explicitLastName);
  const splitName = splitCheckoutDisplayName(user.name);

  return {
    firstName: hasExplicitName ? explicitFirstName : splitName.firstName,
    lastName: hasExplicitName ? explicitLastName : splitName.lastName,
    phone: cleanOptionalText(user.phone),
    email: cleanOptionalText(user.email).toLowerCase(),
  };
}

export function applyEmptyCheckoutContactFields<
  FormValues extends CheckoutContactValues,
>(
  current: FormValues,
  autofill: CheckoutContactValues,
  editedFields: ReadonlySet<string>
): FormValues {
  let next = current;

  for (const field of CONTACT_FIELDS) {
    if (
      editedFields.has(field) ||
      current[field].trim() ||
      !autofill[field]
    ) {
      continue;
    }

    if (next === current) next = { ...current };
    next[field] = autofill[field];
  }

  return next;
}

export function shouldResetCheckoutForAccount(
  previousUserId: string | null | undefined,
  nextUserId: string | null
) {
  return previousUserId !== undefined && previousUserId !== nextUserId;
}

export function shouldApplyCheckoutContactAutofill(
  autofilledUserId: string | null,
  activeUserId: string | null,
  accountChanged: boolean
) {
  return Boolean(
    activeUserId &&
      (accountChanged || autofilledUserId !== activeUserId)
  );
}

export function normalizeEgyptianMobilePhone(value: string) {
  const localizedValue = toLatinDigits(value.trim());
  if (!localizedValue || !/^(?:\+|00)?[0-9\s().-]+$/.test(localizedValue)) {
    return "";
  }

  let digits = localizedValue.replace(/\D/g, "");
  if (digits.startsWith("0020")) digits = `20${digits.slice(4)}`;
  if (/^01[0125]\d{8}$/.test(digits)) digits = `20${digits.slice(1)}`;

  return EGYPTIAN_MOBILE_PATTERN.test(digits) ? digits : "";
}

export function isValidEgyptianMobilePhone(value: string) {
  return Boolean(normalizeEgyptianMobilePhone(value));
}
