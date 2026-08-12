const CONVENTION_PATTERN = /^XD-TP-(\d+)__main\.webp$/i;

function extractDigits(value) {
  if (!value) return null;
  const match = String(value).match(/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Resolves the local output filename for a manifest row, following the
 * `XD-TP-[TOOTHPICK_ID]__main.webp` convention.
 *
 * Preference order:
 *   1. `proposed_filename` if it already matches the convention exactly.
 *   2. A Toothpick id extracted from `product_id`.
 *   3. A Toothpick id extracted from `source_product_id`.
 *
 * Returns { filename, toothpickId, source } or throws when no row field
 * yields a usable id — callers must treat that as a per-row failure, never a
 * guess.
 */
export function resolveOutputFilename(row) {
  const proposed = (row.proposedFilename || "").trim();
  if (CONVENTION_PATTERN.test(proposed)) {
    const [, toothpickId] = proposed.match(CONVENTION_PATTERN);
    return { filename: `XD-TP-${toothpickId}__main.webp`, toothpickId, source: "proposed_filename" };
  }

  const fromProductId = extractDigits(row.productId);
  if (fromProductId) {
    return { filename: `XD-TP-${fromProductId}__main.webp`, toothpickId: fromProductId, source: "product_id" };
  }

  const fromSourceProductId = extractDigits(row.sourceProductId);
  if (fromSourceProductId) {
    return {
      filename: `XD-TP-${fromSourceProductId}__main.webp`,
      toothpickId: fromSourceProductId,
      source: "source_product_id",
    };
  }

  throw new Error(
    "Could not resolve a Toothpick id from proposed_filename, product_id, or source_product_id."
  );
}
