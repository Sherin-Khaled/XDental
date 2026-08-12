export const DOWNLOAD_STATUS = {
  READY: "IMAGE_READY_LOCAL",
  FAILED_DOWNLOAD: "FAILED_DOWNLOAD",
  INVALID_CONTENT: "INVALID_CONTENT",
  INVALID_IMAGE: "INVALID_IMAGE",
};

export const RESULT_COLUMNS = [
  "source_product_id",
  "product_id",
  "SKU",
  "source_url",
  "download_status",
  "http_status",
  "content_type",
  "original_dimensions",
  "output_dimensions",
  "output_filename",
  "output_path",
  "sha256",
  "shared_asset_hash",
  "shared_asset_count",
  "error",
];

/** Builds one output-CSV row from a manifest row and the pipeline outcome for it. */
export function buildResultRow(manifestRow, outcome) {
  return {
    source_product_id: manifestRow.sourceProductId ?? "",
    product_id: manifestRow.productId ?? "",
    SKU: manifestRow.sku ?? "",
    source_url: manifestRow.imageUrl ?? "",
    download_status: outcome.downloadStatus,
    http_status: outcome.httpStatus ?? "",
    content_type: outcome.contentType ?? "",
    original_dimensions: outcome.originalDimensions ?? "",
    output_dimensions: outcome.outputDimensions ?? "",
    output_filename: outcome.outputFilename ?? "",
    output_path: outcome.outputPath ?? "",
    sha256: outcome.sha256 ?? "",
    shared_asset_hash: "",
    shared_asset_count: outcome.sha256 ? 1 : "",
    error: outcome.error ?? "",
  };
}

/**
 * Annotates rows that share identical output-file bytes. Never removes or
 * skips a row — Komet legitimately reuses one official asset across several
 * validated variants, and the research manifest has already decided that's
 * acceptable; this only records the fact for review.
 */
export function annotateSharedAssets(rows) {
  const countByHash = new Map();
  for (const row of rows) {
    if (!row.sha256) continue;
    countByHash.set(row.sha256, (countByHash.get(row.sha256) ?? 0) + 1);
  }

  return rows.map((row) => {
    if (!row.sha256) return row;
    const count = countByHash.get(row.sha256) ?? 1;
    return {
      ...row,
      shared_asset_hash: count > 1 ? row.sha256 : "",
      shared_asset_count: count,
    };
  });
}
