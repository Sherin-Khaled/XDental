import { parse } from "csv-parse/sync";

/** Logical manifest fields, each with the header spellings we accept (normalized: trimmed, lowercased, non-alphanumerics collapsed to "_"). */
const FIELD_ALIASES = {
  processingStatus: ["processing_status", "status"],
  sourceProductId: ["source_product_id", "sourceproductid"],
  productId: ["product_id", "productid", "toothpick_id", "toothpickid", "xd_product_id"],
  sku: ["sku"],
  productName: ["product_name", "productname", "name"],
  brand: ["brand"],
  modelCode: [
    "official_product_model_code",
    "official_product_or_model_code",
    "model_code",
    "modelcode",
    "ref",
    "reference",
  ],
  productPageUrl: ["official_product_page_url", "product_page_url", "productpageurl", "source_page_url"],
  imageUrl: [
    "direct_image_asset_url",
    "direct_original_image_asset_url",
    "image_url",
    "imageurl",
    "source_url",
    "asset_url",
  ],
  exactMatchBasis: ["exact_match_basis", "exactmatchbasis"],
  rightsBasis: ["rights_basis", "rightsbasis"],
  proposedFilename: ["proposed_filename", "proposedfilename"],
};

function normalizeHeader(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Builds a normalizedHeader -> logicalField lookup, so manifests with slightly different column names still parse. */
function buildHeaderIndex(headers) {
  const normalizedToLogical = new Map();
  for (const [logicalField, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) normalizedToLogical.set(alias, logicalField);
  }

  const index = {};
  headers.forEach((header, columnIndex) => {
    const logicalField = normalizedToLogical.get(normalizeHeader(header));
    if (logicalField) index[logicalField] = columnIndex;
  });
  return index;
}

/**
 * Parses a manifest CSV (as text) into normalized row objects keyed by the
 * logical field names in FIELD_ALIASES. Rows missing both an image URL and a
 * product/source id are dropped as blank/malformed rather than passed through.
 */
export function parseManifestCsv(csvText) {
  const records = parse(csvText, {
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });
  if (records.length === 0) return { rows: [], missingFields: [] };

  const [headerRow, ...dataRows] = records;
  const headerIndex = buildHeaderIndex(headerRow);

  const requiredFields = ["imageUrl"];
  const missingFields = requiredFields.filter((field) => !(field in headerIndex));

  const rows = dataRows
    .map((cells) => {
      const row = {};
      for (const field of Object.keys(FIELD_ALIASES)) {
        const columnIndex = headerIndex[field];
        row[field] = columnIndex === undefined ? "" : (cells[columnIndex] ?? "").trim();
      }
      return row;
    })
    .filter((row) => row.imageUrl || row.productId || row.sourceProductId);

  return { rows, missingFields };
}
