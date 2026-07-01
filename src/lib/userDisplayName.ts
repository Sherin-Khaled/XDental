import type { Language } from "@/context/LanguageContext";

type DisplayNameUser = {
  name?: string | null;
  role?: string | null;
};

const EXISTING_HONORIFIC = /^(?:dr\.|dr(?=\s|$)|د\.)/i;

export function formatUserDisplayName(
  user: DisplayNameUser | null | undefined,
  language: Language
) {
  const name = user?.name?.trim() ?? "";
  const role = user?.role?.trim().toLowerCase();

  if (!name || role !== "customer" || EXISTING_HONORIFIC.test(name)) return name;
  return `${language === "ar" ? "د." : "Dr."} ${name}`;
}
