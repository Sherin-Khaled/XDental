import ExcelJS from "exceljs";
import { previewCatalogImport } from "./catalogImport.service.js";

// ---------------------------------------------------------------------------
// Excel workbook catalogue import (Phase 7C).
//
// This module never talks to Product/Brand/Category/Variant tables directly.
// It only (a) reads and validates the uploaded .xlsx workbook, (b) maps its
// rows onto the exact same `entities` shape the technical JSON importer
// already accepts, and (c) calls the existing, unmodified `previewCatalogImport`
// for the real create/update/skip/error classification. A small enrichment
// pass afterward adds Excel-only, non-authoritative findings (duplicate IDs/
// SKUs within the workbook, missing-image and provisional-data notices) by
// updating the already-persisted CatalogImportRow/CatalogImportBatch records
// through the same Prisma models integration.controller.js already reads
// directly for the import history endpoints.
// ---------------------------------------------------------------------------

export const EXCEL_IMPORT_MAX_BYTES = 15 * 1024 * 1024;
export const SUPPORTED_TEMPLATE_VERSIONS = ["1.0.0"];

const HEADER_ROW = 2;
const FIRST_DATA_ROW = 3;
const TEMPLATE_VERSION_SHEET = "Instructions";
const TEMPLATE_VERSION_CELL = "B54";

const ACTIONS_WITH_FAILURES = new Set(["CONFLICT", "ERROR"]);

// Workbook column header (normalized, trailing " *" stripped) -> canonical
// catalogImport.contract.js field name, restricted to fields the current
// backend contract actually implements. Columns with no entry here are
// FUTURE_RESERVED / NOT_IMPORTED / not yet backed by a real field, per the
// workbook's own ImportMapping sheet, and are intentionally left out of the
// imported payload rather than guessed at.
const SHEET_SPECS = {
  Brands: {
    entityType: "BRANDS",
    requiredHeaders: ["brand_id", "brand_name_en", "brand_name_ar", "image_rights_confirmed", "status", "import_action"],
  },
  Categories: {
    entityType: "CATEGORIES",
    requiredHeaders: ["category_id", "category_level", "category_name_en", "category_name_ar", "show_in_menu", "status", "import_action"],
  },
  Products: {
    entityType: "PRODUCTS",
    requiredHeaders: [
      "product_id", "product_sku", "product_type", "product_name_en", "product_name_ar",
      "brand_id", "category_id", "unit_of_measure", "base_price", "currency",
      "availability", "image_rights_confirmed", "status", "import_action",
    ],
  },
  ProductOptions: {
    entityType: "PRODUCT_OPTIONS",
    requiredHeaders: ["option_id", "product_id", "option_code", "option_name_en", "option_name_ar", "display_type", "is_required_at_checkout", "import_action"],
  },
  OptionValues: {
    entityType: "OPTION_VALUES",
    requiredHeaders: ["value_id", "option_id", "value_code", "value_en", "value_ar", "status", "import_action"],
  },
  Variants: {
    entityType: "VARIANTS",
    requiredHeaders: ["variant_id", "product_id", "variant_sku", "price", "availability", "is_default_variant", "status", "import_action"],
  },
  VariantOptionValues: {
    entityType: "VARIANT_OPTION_VALUES",
    requiredHeaders: ["link_id", "variant_id", "option_id", "value_id", "import_action"],
  },
  Images: {
    entityType: "IMAGES",
    requiredHeaders: ["image_id", "owner_type", "owner_id", "image_type", "is_primary", "image_rights_confirmed", "import_action"],
  },
  Inventory: {
    entityType: "INVENTORY",
    requiredHeaders: ["inventory_id", "stock_quantity", "import_action"],
  },
};

export const EXCEL_IMPORTABLE_SHEETS = Object.keys(SHEET_SPECS);
export const EXCEL_EXCLUDED_SHEETS = ["Instructions", "ValidationLists", "ImportMapping", "ImageAcquisition"];

const DROPDOWN_VALUES = {
  productType: new Set(["simple", "variable"]),
  availability: new Set(["in_stock", "out_of_stock", "preorder", "backorder", "discontinued"]),
};

const PROVISIONAL_PRICE_PATTERN = /x dental (?:store )?review is required|reference price/i;
const PROVISIONAL_STOCK_PATTERN = /provisional/i;
const MANUFACTURER_INCOMPLETE_PATTERN = /not verified by manufacturer|no independent manufacturer|no official manufacturer|none by manufacturer|no manufacturer|not manufacturer-verified/i;

function normalizeHeaderName(value) {
  return String(value ?? "").replace(/\s*\*\s*$/, "").trim();
}

function cellText(cell) {
  const raw = cell?.value;
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "object") {
    if (Array.isArray(raw.richText)) return raw.richText.map((run) => run.text).join("");
    if (raw instanceof Date) return raw.toISOString();
    if ("text" in raw) return String(raw.text ?? "");
    if ("result" in raw) return String(raw.result ?? "");
    return "";
  }
  return String(raw).trim();
}

function readHeaderMap(worksheet) {
  const headerRow = worksheet.getRow(HEADER_ROW);
  const map = new Map();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const name = normalizeHeaderName(cell.value);
    if (name) map.set(name, colNumber);
  });
  return map;
}

function readSheetRows(worksheet, headerMap) {
  const rows = [];
  const lastRow = worksheet.lastRow ? worksheet.lastRow.number : FIRST_DATA_ROW - 1;
  for (let rowNumber = FIRST_DATA_ROW; rowNumber <= lastRow; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const values = {};
    let hasAnyValue = false;
    for (const [headerName, colNumber] of headerMap) {
      const text = cellText(row.getCell(colNumber));
      values[headerName] = text;
      if (text) hasAnyValue = true;
    }
    if (!hasAnyValue) continue;
    rows.push({ excelRow: rowNumber, values });
  }
  return rows;
}

/**
 * Structural, workbook-level validation: file readable as .xlsx, TemplateVersion
 * present and supported, every required sheet present, every required header
 * present on each sheet. Returns `{ problems }` (non-empty means reject the
 * whole upload before any preview batch is created) or `{ problems: [], sheets }`.
 */
export async function parseCatalogImportWorkbook(buffer) {
  let workbook;
  try {
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
  } catch (error) {
    return { problems: [`The uploaded file could not be read as an Excel (.xlsx) workbook: ${error.message}`] };
  }

  const problems = [];
  const instructionsSheet = workbook.getWorksheet(TEMPLATE_VERSION_SHEET);
  const templateVersion = instructionsSheet ? cellText(instructionsSheet.getCell(TEMPLATE_VERSION_CELL)) : "";
  if (!instructionsSheet) {
    problems.push(`Required sheet "${TEMPLATE_VERSION_SHEET}" was not found, so TemplateVersion could not be read.`);
  } else if (!templateVersion) {
    problems.push(`TemplateVersion was not found (${TEMPLATE_VERSION_SHEET}!${TEMPLATE_VERSION_CELL} is empty).`);
  } else if (!SUPPORTED_TEMPLATE_VERSIONS.includes(templateVersion)) {
    problems.push(`Unsupported TemplateVersion "${templateVersion}". Supported versions: ${SUPPORTED_TEMPLATE_VERSIONS.join(", ")}.`);
  }

  const sheets = {};
  for (const sheetName of EXCEL_IMPORTABLE_SHEETS) {
    const worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) {
      problems.push(`Required sheet "${sheetName}" was not found in the workbook.`);
      continue;
    }
    const headerMap = readHeaderMap(worksheet);
    const missingHeaders = SHEET_SPECS[sheetName].requiredHeaders.filter((header) => !headerMap.has(header));
    if (missingHeaders.length) {
      problems.push(`Sheet "${sheetName}" is missing required header(s): ${missingHeaders.join(", ")}.`);
      continue;
    }
    sheets[sheetName] = { rows: readSheetRows(worksheet, headerMap) };
  }

  if (problems.length) return { problems, templateVersion };
  return { problems: [], templateVersion, sheets };
}

function boolFromYesNo(value) {
  return String(value ?? "").trim().toLowerCase() === "yes";
}

function withProvenance(rows, entityType, excelRowIndex, mapFn) {
  const indexMap = new Map();
  const list = rows.map((row, index) => {
    indexMap.set(row.excelRow, index);
    return mapFn(row);
  });
  excelRowIndex[entityType] = indexMap;
  return list;
}

/**
 * Maps parsed workbook rows onto the same `entities` shape previewCatalogImport
 * already accepts from the JSON importer. Products and Variants rows default
 * stockQuantity to the record's *current* database stock (0 for a brand-new
 * record) rather than requiring a stock column on those sheets, because in
 * this workbook stock is exclusively owned by the Inventory sheet — Inventory
 * is applied last and always has final say, so this default only exists to
 * satisfy the shared contract's required stockQuantity field without
 * misclassifying an unrelated re-import as a stock change.
 */
async function buildEntitiesFromParsedWorkbook(database, sourceSystem, sheets) {
  const excelRowIndex = {};
  const entities = {};

  entities.BRANDS = withProvenance(sheets.Brands.rows, "BRANDS", excelRowIndex, (r) => ({
    externalBrandId: r.values.brand_id,
    name: r.values.brand_name_en,
    slug: r.values.brand_slug || undefined,
    country: r.values.country_of_origin || undefined,
  }));

  entities.CATEGORIES = withProvenance(sheets.Categories.rows, "CATEGORIES", excelRowIndex, (r) => ({
    externalCategoryId: r.values.category_id,
    name: r.values.category_name_en,
    nameAr: r.values.category_name_ar || undefined,
    description: r.values.description_en || undefined,
    parentExternalCategoryId: r.values.parent_category_id || undefined,
  }));

  const existingProductStock = new Map();
  for (const r of sheets.Products.rows) {
    if (!r.values.product_id) continue;
    const existing = await database.product.findFirst({
      where: { sourceSystem, externalProductId: r.values.product_id },
      select: { stockQuantity: true },
    });
    existingProductStock.set(r.values.product_id, existing?.stockQuantity ?? 0);
  }
  entities.PRODUCTS = withProvenance(sheets.Products.rows, "PRODUCTS", excelRowIndex, (r) => ({
    externalProductId: r.values.product_id,
    sku: r.values.product_sku,
    name: r.values.product_name_en,
    nameAr: r.values.product_name_ar || undefined,
    price: r.values.base_price,
    ...(r.values.sale_price === undefined || r.values.sale_price === null || r.values.sale_price === ""
      ? {}
      : { salePrice: r.values.sale_price }),
    stockQuantity: existingProductStock.get(r.values.product_id) ?? 0,
    description: r.values.long_description_en || undefined,
    descriptionAr: r.values.long_description_ar || undefined,
    shortDescription: r.values.short_description_en || undefined,
    shortDescriptionAr: r.values.short_description_ar || undefined,
    brandExternalId: r.values.brand_id || undefined,
    categoryExternalId: r.values.category_id || undefined,
    status: r.values.status || undefined,
  }));

  const optionLookup = new Map();
  for (const r of sheets.ProductOptions.rows) {
    optionLookup.set(r.values.option_id, { productExternalId: r.values.product_id, code: r.values.option_code });
  }
  entities.PRODUCT_OPTIONS = withProvenance(sheets.ProductOptions.rows, "PRODUCT_OPTIONS", excelRowIndex, (r) => ({
    productExternalId: r.values.product_id,
    code: r.values.option_code,
    nameEn: r.values.option_name_en,
    nameAr: r.values.option_name_ar || undefined,
    sortOrder: r.values.sort_order ? Number(r.values.sort_order) : undefined,
  }));

  const valueLookup = new Map();
  for (const r of sheets.OptionValues.rows) {
    const option = optionLookup.get(r.values.option_id);
    valueLookup.set(r.values.value_id, { optionCode: option?.code ?? null, code: r.values.value_code });
  }
  entities.OPTION_VALUES = withProvenance(sheets.OptionValues.rows, "OPTION_VALUES", excelRowIndex, (r) => {
    const option = optionLookup.get(r.values.option_id);
    return {
      productExternalId: option?.productExternalId ?? null,
      optionCode: option?.code ?? null,
      code: r.values.value_code,
      valueEn: r.values.value_en,
      valueAr: r.values.value_ar || undefined,
      displayHex: r.values.swatch_hex || undefined,
      sortOrder: r.values.sort_order ? Number(r.values.sort_order) : undefined,
    };
  });

  const existingVariantStock = new Map();
  const variantProductLookup = new Map();
  for (const r of sheets.Variants.rows) {
    if (r.values.variant_id) variantProductLookup.set(r.values.variant_id, r.values.product_id);
    if (!r.values.variant_id) continue;
    const existing = await database.productVariant.findFirst({
      where: { sourceSystem, externalVariantId: r.values.variant_id },
      select: { stockQuantity: true },
    });
    existingVariantStock.set(r.values.variant_id, existing?.stockQuantity ?? 0);
  }
  entities.VARIANTS = withProvenance(sheets.Variants.rows, "VARIANTS", excelRowIndex, (r) => ({
    externalVariantId: r.values.variant_id,
    productExternalId: r.values.product_id,
    sku: r.values.variant_sku,
    barcode: r.values.barcode || undefined,
    nameEn: r.values.variant_name_en || undefined,
    nameAr: r.values.variant_name_ar || undefined,
    priceOverride: r.values.price || undefined,
    status: r.values.status || undefined,
    stockQuantity: existingVariantStock.get(r.values.variant_id) ?? 0,
  }));

  entities.VARIANT_OPTION_VALUES = withProvenance(sheets.VariantOptionValues.rows, "VARIANT_OPTION_VALUES", excelRowIndex, (r) => {
    const value = valueLookup.get(r.values.value_id);
    return {
      externalVariantId: r.values.variant_id,
      optionCode: value?.optionCode ?? null,
      valueCode: value?.code ?? null,
    };
  });

  entities.IMAGES = withProvenance(sheets.Images.rows, "IMAGES", excelRowIndex, (r) => {
    const isVariantOwned = String(r.values.owner_type ?? "").trim().toLowerCase() === "variant";
    return {
      productExternalId: isVariantOwned ? (variantProductLookup.get(r.values.owner_id) ?? null) : r.values.owner_id,
      externalVariantId: isVariantOwned ? r.values.owner_id : undefined,
      url: r.values.image_url || undefined,
      rightsConfirmed: boolFromYesNo(r.values.image_rights_confirmed),
      isPrimary: boolFromYesNo(r.values.is_primary),
      sortOrder: r.values.sort_order ? Number(r.values.sort_order) : undefined,
    };
  });

  entities.INVENTORY = withProvenance(sheets.Inventory.rows, "INVENTORY", excelRowIndex, (r) => ({
    productExternalId: r.values.external_product_id || undefined,
    externalVariantId: r.values.external_variant_id || undefined,
    stockQuantity: r.values.stock_quantity,
  }));

  return { entities, excelRowIndex };
}

/** Duplicate identifiers/SKUs within the same workbook — the shared preview classifier only checks the database, so two brand-new rows sharing an id/SKU would otherwise both silently resolve to CREATE and collide at commit time. */
function detectWorkbookDuplicates(sheets) {
  const issues = [];
  function checkSheet(sheetName, entityType, idField, skuField) {
    const seenIds = new Map();
    const seenSkus = new Map();
    for (const r of sheets[sheetName].rows) {
      const id = r.values[idField];
      if (id) {
        if (seenIds.has(id)) {
          issues.push({ entityType, excelRow: r.excelRow, downgrade: true, message: `Duplicate ${idField} "${id}" within the ${sheetName} sheet (first seen at row ${seenIds.get(id)}).` });
        } else seenIds.set(id, r.excelRow);
      }
      if (skuField && r.values[skuField]) {
        const sku = r.values[skuField];
        const key = sku.toUpperCase();
        if (seenSkus.has(key)) {
          issues.push({ entityType, excelRow: r.excelRow, downgrade: true, message: `Duplicate ${skuField} "${sku}" within the ${sheetName} sheet (first seen at row ${seenSkus.get(key)}).` });
        } else seenSkus.set(key, r.excelRow);
      }
    }
  }
  checkSheet("Brands", "BRANDS", "brand_id", null);
  checkSheet("Categories", "CATEGORIES", "category_id", null);
  checkSheet("Products", "PRODUCTS", "product_id", "product_sku");
  checkSheet("Variants", "VARIANTS", "variant_id", "variant_sku");
  checkSheet("Inventory", "INVENTORY", "inventory_id", null);

  // The workbook's own ImportMapping documents product_sku and variant_sku as one shared uniqueness domain.
  const productSkus = new Map();
  for (const r of sheets.Products.rows) if (r.values.product_sku) productSkus.set(r.values.product_sku.toUpperCase(), r.excelRow);
  for (const r of sheets.Variants.rows) {
    const sku = r.values.variant_sku;
    if (sku && productSkus.has(sku.toUpperCase())) {
      issues.push({
        entityType: "VARIANTS",
        excelRow: r.excelRow,
        downgrade: true,
        message: `variant_sku "${sku}" collides with a Products.product_sku value elsewhere in this workbook (row ${productSkus.get(sku.toUpperCase())}); SKUs must be unique across Products and Variants.`,
      });
    }
  }
  return issues;
}

/** Invalid dropdown values on columns not currently imported are informational only — a value the backend never reads must not block a technical import test. */
function detectInvalidDropdownValues(sheets) {
  const issues = [];
  for (const r of sheets.Products.rows) {
    if (r.values.product_type && !DROPDOWN_VALUES.productType.has(r.values.product_type.toLowerCase())) {
      issues.push({ entityType: "PRODUCTS", excelRow: r.excelRow, downgrade: false, message: `product_type "${r.values.product_type}" is not a listed dropdown value (expected simple or variable).` });
    }
    if (r.values.availability && !DROPDOWN_VALUES.availability.has(r.values.availability.toLowerCase())) {
      issues.push({
        entityType: "PRODUCTS",
        excelRow: r.excelRow,
        downgrade: false,
        message: `availability "${r.values.availability}" is not a listed dropdown value (expected one of: in_stock, out_of_stock, preorder, backorder, discontinued). Note: availability is not yet imported by the backend contract — use status to control published state.`,
      });
    }
  }
  return issues;
}

/** The three required provisional-data notices, detected from internal_notes text — non-blocking per the task contract. */
function detectProvisionalDataWarnings(sheets) {
  const issues = [];
  for (const r of sheets.Products.rows) {
    const notes = r.values.internal_notes || "";
    if (PROVISIONAL_PRICE_PATTERN.test(notes)) issues.push({ entityType: "PRODUCTS", excelRow: r.excelRow, downgrade: false, message: "Reference price is provisional and requires X Dental review before publication." });
    if (PROVISIONAL_STOCK_PATTERN.test(notes)) issues.push({ entityType: "PRODUCTS", excelRow: r.excelRow, downgrade: false, message: "Stock quantity is a provisional staging value, not confirmed physical stock." });
    if (MANUFACTURER_INCOMPLETE_PATTERN.test(notes)) issues.push({ entityType: "PRODUCTS", excelRow: r.excelRow, downgrade: false, message: "Manufacturer verification is incomplete for this product." });
  }
  for (const r of sheets.Inventory.rows) {
    const notes = r.values.internal_notes || "";
    if (PROVISIONAL_STOCK_PATTERN.test(notes)) issues.push({ entityType: "INVENTORY", excelRow: r.excelRow, downgrade: false, message: "Stock quantity is a provisional staging value, not confirmed physical stock." });
  }
  return issues;
}

/** A product with no Images sheet rows will render with the storefront's existing safe placeholder image; this makes that outcome visible in the preview instead of a silent gap. */
function detectMissingImageWarnings(sheets) {
  const referenced = new Set(sheets.Images.rows.map((r) => r.values.owner_id).filter(Boolean));
  return sheets.Products.rows
    .filter((r) => !referenced.has(r.values.product_id))
    .map((r) => ({
      entityType: "PRODUCTS",
      excelRow: r.excelRow,
      downgrade: false,
      message: "No image supplied for this product in the workbook; the storefront's safe placeholder image will be used until an authorized image is added.",
    }));
}

/** Patches the already-persisted preview batch/rows in place with Excel-only findings, downgrading true duplicate-identifier rows to CONFLICT and attaching non-blocking notices everywhere else. */
async function applyExcelRowEnrichments(database, batch, excelRowIndex, issues) {
  if (!issues.length) return;
  const patches = new Map();
  for (const issue of issues) {
    const index = excelRowIndex[issue.entityType]?.get(issue.excelRow);
    if (index === undefined) continue;
    const rowNumber = index + 2; // mirrors previewCatalogImport's own rowNumber = arrayIndex + 2
    const row = batch.rows.find((candidate) => candidate.entityType === issue.entityType && candidate.rowNumber === rowNumber);
    if (!row) continue;
    if (!patches.has(row.id)) patches.set(row.id, { row, messages: [...row.validationMessages], downgrade: false });
    const patch = patches.get(row.id);
    if (!patch.messages.includes(issue.message)) patch.messages.push(issue.message);
    if (issue.downgrade) patch.downgrade = true;
  }
  if (patches.size === 0) return;

  for (const { row, messages, downgrade } of patches.values()) {
    const nextAction = downgrade && !ACTIONS_WITH_FAILURES.has(row.action) ? "CONFLICT" : row.action;
    await database.catalogImportRow.update({ where: { id: row.id }, data: { action: nextAction, validationMessages: messages } });
    row.action = nextAction;
    row.validationMessages = messages;
  }

  const errorRows = batch.rows.filter((row) => ACTIONS_WITH_FAILURES.has(row.action)).length;
  const warningRows = batch.rows.filter((row) => row.validationMessages.length > 0 && !ACTIONS_WITH_FAILURES.has(row.action)).length;
  const validRows = batch.rows.filter((row) => !ACTIONS_WITH_FAILURES.has(row.action)).length;
  await database.catalogImportBatch.update({ where: { id: batch.id }, data: { errorRows, warningRows, validRows } });
}

/**
 * End-to-end preview-first Excel import: parse + validate the workbook
 * structurally, map it onto the shared entities contract, run it through the
 * unmodified previewCatalogImport, then enrich the resulting audit rows with
 * Excel-only findings. Throws (no batch created) on structural problems;
 * otherwise always returns a persisted, dry-run CatalogImportBatch — exactly
 * like the JSON importer, apply is a separate, explicitly confirmed step.
 */
export async function previewCatalogImportFromExcel(database, { workbookBuffer, sourceSystem, filename = null, createdById = null }) {
  const source = String(sourceSystem ?? "").trim();
  if (!source) throw Object.assign(new Error("sourceSystem is required."), { statusCode: 400 });
  if (!Buffer.isBuffer(workbookBuffer) || workbookBuffer.length === 0) {
    throw Object.assign(new Error("An .xlsx workbook file is required."), { statusCode: 400 });
  }

  const parsed = await parseCatalogImportWorkbook(workbookBuffer);
  if (parsed.problems.length > 0) {
    throw Object.assign(new Error(parsed.problems.join(" ")), { statusCode: 422, workbookProblems: parsed.problems });
  }

  const { entities, excelRowIndex } = await buildEntitiesFromParsedWorkbook(database, source, parsed.sheets);
  const preview = await previewCatalogImport(database, { sourceSystem: source, filename, entities, createdById });

  const issues = [
    ...detectWorkbookDuplicates(parsed.sheets),
    ...detectInvalidDropdownValues(parsed.sheets),
    ...detectProvisionalDataWarnings(parsed.sheets),
    ...detectMissingImageWarnings(parsed.sheets),
  ];
  await applyExcelRowEnrichments(database, preview.batch, excelRowIndex, issues);

  const refreshed = await database.catalogImportBatch.findUnique({
    where: { id: preview.batch.id },
    include: { rows: { orderBy: [{ entityType: "asc" }, { rowNumber: "asc" }] }, createdBy: { select: { id: true, name: true } } },
  });

  const summary = {
    totalRows: refreshed.totalRows,
    validRows: refreshed.validRows,
    warningRows: refreshed.warningRows,
    errorRows: refreshed.errorRows,
  };
  return { batch: refreshed, summary, templateVersion: parsed.templateVersion };
}
