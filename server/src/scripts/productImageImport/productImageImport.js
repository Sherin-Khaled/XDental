import path from "node:path";

export const EXPECTED_CATALOGUE_TOTAL = 12_942;
export const EXPECTED_IMAGE_TOTAL = 12_940;
export const EXPECTED_FALLBACK_SKUS = Object.freeze([
  "XD-TP-204125",
  "XD-TP-205953",
]);

const IMAGE_FILENAME_PATTERN = /^(XD-TP-\d+)__main\.webp$/;

export function deriveSkuFromFilename(filePath) {
  return path.basename(filePath).match(IMAGE_FILENAME_PATTERN)?.[1] ?? null;
}

export function objectKeyForSku(sku) {
  return `product-images/catalog/${sku}/main.webp`;
}

export function publicUrlForObject(publicBaseUrl, objectKey) {
  return `${String(publicBaseUrl).replace(/\/+$/, "")}/${objectKey}`;
}

export function validateExternalImageUrl(value) {
  try {
    const parsed = new URL(String(value).trim());
    return parsed.protocol === "https:" && !parsed.username && !parsed.password
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

export function buildAuditPlan(candidates, products) {
  const productsBySku = new Map(products.map((product) => [product.sku, product]));
  const countBySku = new Map();
  for (const candidate of candidates) {
    if (candidate.sku) countBySku.set(candidate.sku, (countBySku.get(candidate.sku) ?? 0) + 1);
  }

  return candidates.map((candidate) => {
    const base = {
      SKU: candidate.sku ?? "",
      source_file: candidate.sourceFile ?? "",
      object_key: candidate.objectKey ?? "",
      public_url: candidate.publicUrl ?? "",
      previous_image_url: "",
      new_image_url: candidate.publicUrl ?? "",
      status: "",
      error: "",
    };
    if (candidate.error) return { ...base, status: candidate.status ?? "ERROR", error: candidate.error };
    if (!candidate.sku) return { ...base, status: "ERROR_INVALID_FILENAME", error: "Filename must match XD-TP-[ID]__main.webp exactly." };
    if ((countBySku.get(candidate.sku) ?? 0) > 1) return { ...base, status: "ERROR_DUPLICATE_SKU", error: "More than one input claims this exact SKU." };
    const product = productsBySku.get(candidate.sku);
    if (!product) return { ...base, status: "ERROR_UNKNOWN_SKU", error: "No Product has this exact SKU." };
    const previous = product.imageUrl ?? "";
    if (previous === candidate.publicUrl) {
      return { ...base, previous_image_url: previous, status: "SKIPPED_ALREADY_CORRECT" };
    }
    return {
      ...base,
      previous_image_url: previous,
      status: candidate.mode === "external" ? "PLANNED_EXTERNAL_UPDATE" : "PLANNED_UPLOAD_UPDATE",
      productId: product.id,
    };
  });
}

export async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

export function verifyCoverageSummary({ total, withImages, missingSkus }) {
  const normalizedMissing = [...missingSkus].sort();
  const expectedMissing = [...EXPECTED_FALLBACK_SKUS].sort();
  return {
    total,
    withImages,
    missingSkus: normalizedMissing,
    ok:
      total === EXPECTED_CATALOGUE_TOTAL
      && withImages === EXPECTED_IMAGE_TOTAL
      && JSON.stringify(normalizedMissing) === JSON.stringify(expectedMissing),
  };
}
