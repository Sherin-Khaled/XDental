import { normalizeCategorySlug } from "@/lib/catalogTranslations";
import type { CatalogCategoryNode } from "@/services/catalog";
import type { Product } from "@/types/product";

export const DEFAULT_CLINIC_SPECIALTY = "General Dentistry";

export const CLINIC_SPECIALTIES = [
  DEFAULT_CLINIC_SPECIALTY,
  "Orthodontics",
  "Endodontics",
  "Implantology",
  "Prosthodontics",
  "Oral Surgery",
  "Periodontics",
  "Pediatric Dentistry",
  "Dental Laboratory",
  "Other",
] as const;

export type ClinicSpecialty = (typeof CLINIC_SPECIALTIES)[number];

type ProductMatcher = {
  categories: string[];
  keywords: string[];
};

const CLINIC_SPECIALTY_SET = new Set<string>(CLINIC_SPECIALTIES);

export const SPECIALTY_MAIN_CATEGORY_SLUGS: Record<ClinicSpecialty, string[]> = {
  "General Dentistry": [
    "restorative",
    "endodontics",
    "consumables",
    "instruments",
    "oral-care-system",
  ],
  Orthodontics: ["orthodontics"],
  Endodontics: ["endodontics"],
  Implantology: ["implant"],
  Prosthodontics: ["prosthodontics"],
  "Oral Surgery": ["perio-surgery"],
  Periodontics: ["perio-surgery"],
  "Pediatric Dentistry": ["pedodontics"],
  "Dental Laboratory": ["dental-lab"],
  Other: [
    "restorative",
    "endodontics",
    "consumables",
    "instruments",
    "oral-care-system",
  ],
};

export const SPECIALTY_PRODUCT_MATCHERS: Record<ClinicSpecialty, ProductMatcher> = {
  "General Dentistry": {
    categories: [
      "restorative",
      "endodontics",
      "consumables",
      "instruments",
      "oral-care-system",
      "anesthesia",
    ],
    keywords: [
      "disposable material",
      "general supplies",
      "restorative",
      "composite",
      "bonding",
      "anesthesia",
      "clinic essentials",
      "gloves",
      "mask",
      "syringe",
    ],
  },
  Orthodontics: {
    categories: ["orthodontics"],
    keywords: [
      "orthodontic",
      "bracket",
      "brackets",
      "wire",
      "wires",
      "archwire",
      "elastics",
      "elastic",
      "ortho",
    ],
  },
  Endodontics: {
    categories: ["endodontics"],
    keywords: [
      "endodontic",
      "endo",
      "root canal",
      "files",
      "file",
      "obturation",
      "irrigation",
      "gutta",
    ],
  },
  Implantology: {
    categories: ["implant"],
    keywords: [
      "implant",
      "implants",
      "surgical kit",
      "surgical kits",
      "implant tools",
      "abutment",
      "fixture",
    ],
  },
  Prosthodontics: {
    categories: ["prosthodontics"],
    keywords: [
      "impression",
      "cement",
      "crown",
      "bridge",
      "prosthetic",
      "prosthodontic",
      "temporary",
    ],
  },
  "Oral Surgery": {
    categories: ["perio-surgery"],
    keywords: [
      "surgery",
      "surgical",
      "suture",
      "sutures",
      "anesthesia",
      "forceps",
      "elevator",
      "scalpel",
    ],
  },
  Periodontics: {
    categories: ["perio-surgery"],
    keywords: [
      "periodontal",
      "periodontic",
      "scaling",
      "scaler",
      "curette",
      "curettes",
      "surgical",
      "perio",
    ],
  },
  "Pediatric Dentistry": {
    categories: ["pedodontics"],
    keywords: [
      "pediatric",
      "paediatric",
      "child",
      "children",
      "preventive",
      "fluoride",
      "disposable material",
      "sealant",
    ],
  },
  "Dental Laboratory": {
    categories: ["dental-lab"],
    keywords: [
      "laboratory",
      "laboratories",
      "lab materials",
      "lab supplies",
      "machine",
      "machines",
      "equipment",
      "scanner",
    ],
  },
  Other: {
    categories: [],
    keywords: [],
  },
};

export function normalizeClinicSpecialty(value?: string | null): ClinicSpecialty {
  const trimmed = value?.trim();
  return trimmed && CLINIC_SPECIALTY_SET.has(trimmed)
    ? (trimmed as ClinicSpecialty)
    : DEFAULT_CLINIC_SPECIALTY;
}

function normalizeSearchText(value?: string | null) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function getMatcher(specialty: ClinicSpecialty) {
  if (specialty === "Other") return SPECIALTY_PRODUCT_MATCHERS[DEFAULT_CLINIC_SPECIALTY];
  return SPECIALTY_PRODUCT_MATCHERS[specialty];
}

function productMatchesSpecialty(product: Product, specialty: ClinicSpecialty) {
  const matcher = getMatcher(specialty);
  const productCategory = normalizeCategorySlug(product.category);
  const normalizedProductCategory = normalizeSearchText(product.category);
  const normalizedProductCategorySlug = normalizeSearchText(productCategory);
  const searchable = normalizeSearchText([
    product.name,
    product.brand,
    product.category,
    product.description,
    product.sku,
    product.slug,
  ].filter(Boolean).join(" "));

  const categoryMatch = matcher.categories.some((category) => {
    const matcherCategory = normalizeCategorySlug(category);
    const normalizedMatcherCategory = normalizeSearchText(category);
    const normalizedMatcherCategorySlug = normalizeSearchText(matcherCategory);

    return (
      productCategory === matcherCategory ||
      normalizedProductCategory === normalizedMatcherCategory ||
      normalizedProductCategorySlug === normalizedMatcherCategorySlug ||
      searchable.includes(normalizedMatcherCategory) ||
      searchable.includes(normalizedMatcherCategorySlug)
    );
  });

  if (categoryMatch) return true;

  return matcher.keywords.some((keyword) => {
    const normalizedKeyword = normalizeSearchText(keyword);
    return normalizedKeyword.length > 0 && searchable.includes(normalizedKeyword);
  });
}

function getSpecialtyMatches(products: Product[], specialty: ClinicSpecialty) {
  return products.filter((product) => productMatchesSpecialty(product, specialty));
}

function collectCategoryNames(node: CatalogCategoryNode, names: Set<string>) {
  names.add(node.name.trim().toLowerCase());
  node.children.forEach((child) => collectCategoryNames(child, names));
}

export function getClinicEssentialsCategoryNames(
  categoryTree: CatalogCategoryNode[],
  specialty?: string | null
) {
  const normalizedSpecialty = normalizeClinicSpecialty(specialty);
  const mainSlugs = new Set(SPECIALTY_MAIN_CATEGORY_SLUGS[normalizedSpecialty]);
  const names = new Set<string>();

  categoryTree
    .filter((node) => mainSlugs.has(node.slug))
    .forEach((node) => collectCategoryNames(node, names));

  return names;
}

export function getPersonalizedClinicEssentials(
  products: Product[],
  specialty?: string | null,
  limit = 12,
  categoryTree: CatalogCategoryNode[] = []
) {
  const availableProducts = products.filter((product) => product.available !== false);
  const normalizedSpecialty = normalizeClinicSpecialty(specialty);

  if (categoryTree.length > 0) {
    const categoryNames = getClinicEssentialsCategoryNames(categoryTree, normalizedSpecialty);
    return availableProducts
      .filter((product) => categoryNames.has(product.category.trim().toLowerCase()))
      .slice(0, limit);
  }

  return getSpecialtyMatches(availableProducts, normalizedSpecialty).slice(0, limit);
}
