// Category slugs are backend-driven: the Category table (owner tree) is the
// source of truth and pages validate slugs against the fetched catalog.
// This module only provides slug normalization, redirects for legacy slugs
// that existed before the category tree, and i18n key lookup.

/** Slugify a category name/slug the same way the backend does. */
function slugifyCategory(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

/** Old hardcoded slugs -> current category-tree slugs (bookmarks keep working). */
const LEGACY_CATEGORY_ALIASES: Record<string, string> = {
  "all-products": "all",
  "composites-bonding": "restorative",
  "restorative-materials": "restorative",
  "hand-instruments": "instruments",
  "dental-instruments": "instruments",
  "sterilization-disposables": "consumables",
  "disposable-material": "consumables",
  disposables: "consumables",
  "clinic-essentials": "consumables",
  "infection-control": "disinfection-steralization",
  "sterilization-material": "disinfection-steralization",
  equipment: "equipments",
  machines: "equipments",
  "radiology-imaging": "equipments",
  radiology: "equipments",
  whitening: "bleaching",
  implantology: "implant",
  laboratories: "dental-lab",
  "lab-supplies": "dental-lab",
  burs: "burs-stones",
  "burs-rotary": "burs-stones",
  "dental-burs": "burs-stones",
  periodontics: "perio-surgery",
  surgery: "perio-surgery",
  "impression-materials": "impression-material",
  "preventive-care": "oral-care-system",
};

/**
 * Normalizes a category name or slug to its canonical tree slug. Unknown
 * values pass through slugified; consumers validate against backend data.
 */
export function normalizeCategorySlug(category: string | null | undefined) {
  const slug = slugifyCategory(category ?? "");
  return LEGACY_CATEGORY_ALIASES[slug] ?? slug;
}

export function getCategorySlugFromSearch(search: string) {
  const params = new URLSearchParams(search);
  return normalizeCategorySlug(params.get("category") || "all") || "all";
}

export function getSubcategorySlugFromSearch(search: string) {
  const params = new URLSearchParams(search);
  const value = params.get("subcategory");
  return value ? normalizeCategorySlug(value) : "";
}

// Legacy i18n keys keep older product/category strings localized. Backend tree
// records now prefer their slug-bound `nameAr` field through the helper below.
const categoryNameToSlug: Record<string, string> = {
  endodontics: "endodontics",
  restorative: "restorative",
  orthodontics: "orthodontics",
  instruments: "instruments",
  consumables: "consumables",
  prosthodontics: "prosthodontics",
  "perio & surgery": "perio-surgery",
  equipments: "equipments",
  "burs & stones": "burs-stones",
  bleaching: "bleaching",
  "dental lab": "dental-lab",
  implant: "implant",
  "oral care system": "oral-care-system",
  pedodontics: "pedodontics",
  anesthesia: "anesthesia",
  whitening: "whitening",
  surgery: "surgery",
  implantology: "implantology",
  equipment: "equipment",
  "infection control": "infection-control",
  "clinic essentials": "clinic-essentials",
  "composites & bonding": "composites-bonding",
  "restorative materials": "restorative",
  "hand instruments": "hand-instruments",
  "dental instruments": "instruments",
  "impression materials": "impression-materials",
  "preventive care": "preventive-care",
  "sterilization & disposables": "sterilization-disposables",
  "dental burs": "dental-burs",
  prophylaxis: "prophylaxis",
  "lab supplies": "lab-supplies",
  radiology: "radiology",
  disposables: "disposables",
};

export function getCategoryTranslationKey(category: string) {
  const slug = categoryNameToSlug[category.trim().toLowerCase()] ?? category;
  return `categories.items.${slug}`;
}

type LocalizedCategory = {
  name: string;
  nameAr?: string | null;
  slug: string;
};

type CategoryTranslator = (
  key: string,
  options?: { fallback?: string }
) => string;

/**
 * Resolves customer-facing category text without using translated labels as
 * identifiers. The API record is selected by id/slug; Arabic prefers its
 * stored localization, while the legacy dictionary remains a compatibility
 * fallback for records that have not been translated in the database yet.
 */
export function getLocalizedCategoryName(
  category: LocalizedCategory,
  language: "en" | "ar",
  translate: CategoryTranslator
) {
  if (language === "ar") {
    const arabicName = category.nameAr?.trim();
    if (arabicName && arabicName !== category.name.trim()) return arabicName;
  }

  return translate(getCategoryTranslationKey(category.name), {
    fallback: category.name,
  });
}

type LocalizedProduct = {
  id: string;
  name: string;
  nameAr?: string | null;
};

/**
 * Resolves a customer-facing product name. Arabic mode prefers the product's
 * own stored nameAr (real, database-driven for any product including
 * imported ones) over the legacy per-id i18n dictionary that only covers a
 * fixed set of demo products, and both fall back to the English name.
 */
export function getLocalizedProductName(
  product: LocalizedProduct,
  language: "en" | "ar",
  translate: CategoryTranslator
) {
  if (language === "ar") {
    const arabicName = product.nameAr?.trim();
    if (arabicName) return arabicName;
  }
  return translate(`products.items.${product.id}.name`, { fallback: product.name });
}

type LocalizedProductDescription = {
  id: string;
  description?: string | null;
  descriptionAr?: string | null;
  shortDescription?: string | null;
  shortDescriptionAr?: string | null;
};

/**
 * Resolves a customer-facing product description. Prefers the short
 * description for the requested language when present (falling back to the
 * long description, then the legacy i18n dictionary), so callers get the
 * best available text without needing to know which fields are populated.
 */
export function getLocalizedProductDescription(
  product: LocalizedProductDescription,
  language: "en" | "ar",
  translate: CategoryTranslator,
  fallback?: string
) {
  if (language === "ar") {
    const text = product.shortDescriptionAr?.trim() || product.descriptionAr?.trim();
    if (text) return text;
  } else {
    const text = product.shortDescription?.trim() || product.description?.trim();
    if (text) return text;
  }
  return translate(`products.items.${product.id}.description`, {
    fallback: product.description ?? fallback ?? "",
  });
}
