// Versioned, dependency-free contract used by the preview-first catalog importer.
// CSV/Excel adapters map their headers to these canonical fields before calling it.
export const CATALOG_IMPORT_CONTRACT_VERSION = 2;

export const CATALOG_IMPORT_ENTITY_SPECS = {
  PRODUCTS: {
    fields: {
      externalProductId: { aliases: ["external_product_id", "productId", "externalId"], type: "string", required: false, match: "sourceSystem+externalProductId" },
      sku: { aliases: ["SKU", "productSku"], type: "string", required: true, match: "exact normalized SKU" },
      slug: { aliases: ["urlSlug"], type: "string", required: false, match: "legacy fallback" },
      name: { aliases: ["nameEn", "productName"], type: "string", required: true },
      nameAr: { aliases: ["name_ar", "productNameAr"], type: "text_ar", required: false, match: "same naming convention as Brand.nameAr / Category.nameAr" },
      price: { aliases: ["basePrice", "priceEgp"], type: "decimal", required: true, minimum: 0 },
      stockQuantity: { aliases: ["stock", "availableStock"], type: "integer", required: true, minimum: 0 },
      description: { aliases: ["longDescription", "long_description_en"], type: "string", required: false },
      descriptionAr: { aliases: ["longDescriptionAr", "long_description_ar"], type: "text_ar", required: false },
      shortDescription: { aliases: ["shortDescriptionEn", "short_description_en"], type: "string", required: false },
      shortDescriptionAr: { aliases: ["short_description_ar"], type: "text_ar", required: false },
      imageUrl: { aliases: [], type: "url", required: false },
      brandExternalId: { aliases: ["brandId", "externalBrandId"], type: "string", required: false, match: "externalBrandId (sourceSystem-independent); ambiguous match is an error" },
      brandName: { aliases: ["brand"], type: "string", required: false, match: "exact normalized name fallback, used only when brandExternalId is absent" },
      categoryExternalId: { aliases: ["categoryId", "externalCategoryId"], type: "string", required: false, match: "externalCategoryId (sourceSystem-independent); ambiguous match is an error" },
      categoryName: { aliases: ["category"], type: "string", required: false, match: "exact normalized name fallback, used only when categoryExternalId is absent" },
      categorySlug: { aliases: [], type: "string", required: false, match: "exact slug fallback, used only when categoryExternalId is absent" },
      status: { aliases: ["recordStatus"], type: "string", required: false, match: "RECORD_STATUSES; explicit DRAFT/INACTIVE is preserved instead of being derived from stock" },
    },
  },
  BRANDS: {
    fields: {
      externalBrandId: { aliases: ["brandId", "externalId"], type: "string", required: true, match: "sourceSystem+externalBrandId" },
      name: { aliases: ["nameEn"], type: "string", required: true, match: "exact name fallback" },
      country: { aliases: [], type: "string", required: false },
      logoUrl: { aliases: [], type: "url", required: false },
      description: { aliases: [], type: "string", required: false },
    },
  },
  CATEGORIES: {
    fields: {
      externalCategoryId: { aliases: ["categoryId", "externalId"], type: "string", required: true, match: "sourceSystem+externalCategoryId" },
      name: { aliases: ["nameEn"], type: "string", required: true, match: "exact name fallback" },
      nameAr: { aliases: [], type: "string", required: false },
      description: { aliases: [], type: "string", required: false },
      parentExternalCategoryId: { aliases: ["parentCategoryId", "parent_category_id"], type: "string", required: false, match: "sourceSystem+externalCategoryId of another Categories row; blank means top-level. Unknown parent is a blocking error; a cycle (a category nested under its own descendant) is rejected." },
    },
  },
  PRODUCT_OPTIONS: {
    fields: {
      productExternalId: { aliases: ["externalProductId"], type: "string", required: true, match: "sourceSystem+externalProductId" },
      code: { aliases: ["optionCode"], type: "string", required: true, match: "productId+code" },
      nameEn: { aliases: ["name"], type: "string", required: true },
      nameAr: { aliases: [], type: "string", required: false },
      sortOrder: { aliases: [], type: "integer", required: false },
    },
  },
  OPTION_VALUES: {
    fields: {
      productExternalId: { aliases: ["externalProductId"], type: "string", required: true, match: "sourceSystem+externalProductId" },
      optionCode: { aliases: ["code"], type: "string", required: true, match: "productId+optionCode" },
      code: { aliases: ["valueCode"], type: "string", required: true, match: "optionId+code" },
      valueEn: { aliases: ["value", "name"], type: "string", required: true },
      valueAr: { aliases: [], type: "string", required: false },
      displayHex: { aliases: [], type: "string", required: false },
      sortOrder: { aliases: [], type: "integer", required: false },
    },
  },
  VARIANTS: {
    fields: {
      externalVariantId: { aliases: ["variantId", "externalId"], type: "string", required: false, match: "sourceSystem+externalVariantId" },
      sku: { aliases: ["variantSku"], type: "string", required: false, match: "exact variant SKU" },
      barcode: { aliases: ["ean", "upc"], type: "string", required: false, match: "exact barcode" },
      productExternalId: { aliases: ["externalProductId"], type: "string", required: true, match: "sourceSystem+externalProductId" },
      stockQuantity: { aliases: ["stock"], type: "integer", required: true, minimum: 0 },
      priceOverride: { aliases: ["price"], type: "decimal", required: false, minimum: 0 },
      nameEn: { aliases: [], type: "string", required: false },
      nameAr: { aliases: [], type: "string", required: false },
    },
  },
  VARIANT_OPTION_VALUES: {
    fields: {
      externalVariantId: { aliases: ["variantId"], type: "string", required: true, match: "sourceSystem+externalVariantId" },
      optionCode: { aliases: ["option"], type: "string", required: true, match: "variant's product option code" },
      valueCode: { aliases: ["value"], type: "string", required: true, match: "option's value code" },
    },
  },
  IMAGES: {
    fields: {
      productExternalId: { aliases: ["externalProductId"], type: "string", required: true, match: "sourceSystem+externalProductId" },
      externalVariantId: { aliases: ["variantId"], type: "string", required: false, match: "sourceSystem+externalVariantId" },
      url: { aliases: ["imageUrl"], type: "url", required: true, match: "exact URL within the same product+variant gallery" },
      rightsConfirmed: { aliases: ["rights"], type: "boolean", required: true },
      sourceUrl: { aliases: ["source"], type: "url", required: false },
      isPrimary: { aliases: [], type: "boolean", required: false },
      sortOrder: { aliases: [], type: "integer", required: false },
    },
  },
  INVENTORY: {
    fields: {
      productExternalId: { aliases: ["externalProductId"], type: "string", required: false, match: "sourceSystem+externalProductId" },
      externalVariantId: { aliases: ["variantId"], type: "string", required: false, match: "sourceSystem+externalVariantId (takes priority over productExternalId)" },
      stockQuantity: { aliases: ["stock", "available"], type: "integer", required: true, minimum: 0 },
    },
  },
};

export const CATALOG_IMPORT_ENTITY_TYPES = Object.freeze(Object.keys(CATALOG_IMPORT_ENTITY_SPECS));

// Apply always runs in this order so a row that references another entity
// (e.g. a Variant's productExternalId) resolves against records the same
// transaction already created, without ever needing a second import pass.
export const CATALOG_IMPORT_APPLY_ORDER = Object.freeze([
  "BRANDS",
  "CATEGORIES",
  "PRODUCTS",
  "PRODUCT_OPTIONS",
  "OPTION_VALUES",
  "VARIANTS",
  "VARIANT_OPTION_VALUES",
  "IMAGES",
  "INVENTORY",
]);
