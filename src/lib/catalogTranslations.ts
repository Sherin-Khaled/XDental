const categoryNameToSlug: Record<string, string> = {
  endodontics: "endodontics",
  "composites & bonding": "composites-bonding",
  anesthesia: "anesthesia",
  "impression materials": "impression-materials",
  "hand instruments": "hand-instruments",
  "dental instruments": "instruments",
  whitening: "whitening",
  orthodontics: "orthodontics",
  "preventive care": "preventive-care",
  "sterilization & disposables": "sterilization-disposables",
  "infection control": "infection-control",
  "clinic essentials": "clinic-essentials",
  "restorative materials": "restorative",
  restorative: "restorative",
  instruments: "instruments",
  consumables: "consumables",
  equipment: "equipment",
  surgery: "surgery",
  implantology: "implantology",
  "dental burs": "dental-burs",
  prophylaxis: "prophylaxis",
  "lab supplies": "lab-supplies",
  radiology: "radiology",
  disposables: "disposables",
};

const canonicalCategorySlugAliases: Record<string, string> = {
  all: "all",
  "all products": "all",
  endodontics: "endodontics",
  "composites & bonding": "composites-bonding",
  "composites-bonding": "composites-bonding",
  "restorative materials": "composites-bonding",
  restorative: "composites-bonding",
  anesthesia: "anesthesia",
  "impression materials": "impression-materials",
  "impression-materials": "impression-materials",
  "hand instruments": "hand-instruments",
  "dental instruments": "hand-instruments",
  "hand-instruments": "hand-instruments",
  instruments: "hand-instruments",
  whitening: "whitening",
  orthodontics: "orthodontics",
  "preventive care": "preventive-care",
  "preventive-care": "preventive-care",
  "sterilization & disposables": "sterilization-disposables",
  "sterilization-disposables": "sterilization-disposables",
  consumables: "sterilization-disposables",
  disposables: "sterilization-disposables",
  equipment: "equipment",
  surgery: "surgery",
  implantology: "implantology",
  "infection control": "infection-control",
  "infection-control": "infection-control",
  "clinic essentials": "clinic-essentials",
  "clinic-essentials": "clinic-essentials",
  "dental burs": "dental-burs",
  "dental-burs": "dental-burs",
  prophylaxis: "prophylaxis",
  "lab supplies": "lab-supplies",
  "lab-supplies": "lab-supplies",
  radiology: "radiology",
};

const knownCategorySlugs = new Set(Object.values(canonicalCategorySlugAliases));

export function normalizeCategorySlug(category: string | null | undefined) {
  const normalized = (category ?? "").trim().toLowerCase();
  return canonicalCategorySlugAliases[normalized] ?? normalized;
}

export function isKnownCategorySlug(category: string | null | undefined) {
  return knownCategorySlugs.has(normalizeCategorySlug(category));
}

export function getCategorySlugFromSearch(search: string) {
  const params = new URLSearchParams(search);
  const category = normalizeCategorySlug(params.get("category") || "all");
  return category === "all" || isKnownCategorySlug(category) ? category : "all";
}

export function getCategoryTranslationKey(category: string) {
  const slug = categoryNameToSlug[category.trim().toLowerCase()] ?? category;
  return `categories.items.${slug}`;
}
