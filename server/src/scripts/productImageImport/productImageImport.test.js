import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAuditPlan,
  deriveSkuFromFilename,
  mapWithConcurrency,
  objectKeyForSku,
  publicUrlForObject,
  validateExternalImageUrl,
  verifyCoverageSummary,
} from "./productImageImport.js";

test("filename parsing derives only an exact SKU from the approved main WebP format", () => {
  assert.equal(deriveSkuFromFilename("nested/XD-TP-145650__main.webp"), "XD-TP-145650");
  for (const invalid of ["XD-TP-145650.webp", "xd-tp-145650__main.webp", "XD-TP-145650__main.jpg", "prefix-XD-TP-145650__main.webp"]) {
    assert.equal(deriveSkuFromFilename(invalid), null);
  }
});

test("deterministic storage mapping is idempotent and uses the configured public base URL", () => {
  const key = objectKeyForSku("XD-TP-145650");
  assert.equal(key, "product-images/catalog/XD-TP-145650/main.webp");
  assert.equal(publicUrlForObject("https://cdn.example.com/", key), `https://cdn.example.com/${key}`);
});

test("audit planning uses exact SKU matching, rejects unknowns and duplicates, and skips correct URLs", () => {
  const product = { id: "p1", sku: "XD-TP-1", imageUrl: "https://cdn.example.com/product-images/catalog/XD-TP-1/main.webp" };
  const rows = buildAuditPlan([
    { sku: "XD-TP-1", sourceFile: "a.webp", publicUrl: product.imageUrl, objectKey: "one", mode: "upload" },
    { sku: "XD-TP-2", sourceFile: "b.webp", publicUrl: "https://cdn.example.com/two", objectKey: "two", mode: "upload" },
    { sku: "XD-TP-3", sourceFile: "c.webp", publicUrl: "https://cdn.example.com/three", mode: "external" },
    { sku: "XD-TP-3", sourceFile: "d.webp", publicUrl: "https://cdn.example.com/four", mode: "external" },
  ], [product]);
  assert.deepEqual(rows.map((row) => row.status), ["SKIPPED_ALREADY_CORRECT", "ERROR_UNKNOWN_SKU", "ERROR_DUPLICATE_SKU", "ERROR_DUPLICATE_SKU"]);
});

test("external CSV URLs must be credential-free HTTPS URLs", () => {
  assert.equal(validateExternalImageUrl("https://cdn.example.com/a.webp"), "https://cdn.example.com/a.webp");
  assert.equal(validateExternalImageUrl("http://cdn.example.com/a.webp"), null);
  assert.equal(validateExternalImageUrl("https://user:pass@cdn.example.com/a.webp"), null);
});

test("bounded concurrency processes every item without exceeding the limit", async () => {
  let active = 0;
  let maximum = 0;
  const values = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
    active++;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active--;
    return value * 2;
  });
  assert.deepEqual(values, [2, 4, 6, 8, 10]);
  assert.equal(maximum, 2);
});

test("coverage verification accepts only 12,940 images plus the two approved fallback SKUs", () => {
  assert.equal(verifyCoverageSummary({ total: 12_942, withImages: 12_940, missingSkus: ["XD-TP-205953", "XD-TP-204125"] }).ok, true);
  assert.equal(verifyCoverageSummary({ total: 12_942, withImages: 12_941, missingSkus: ["XD-TP-204125"] }).ok, false);
});
