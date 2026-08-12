import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizedVariantPrice,
  selectedOptionsSnapshot,
  variantAvailabilitySummary,
  visibleGallery,
} from "./variantCatalog.service.js";

const option = { sortOrder: 0, code: "SHADE", nameEn: "Shade" };
const value = { code: "A1", valueEn: "A1" };
const sellableVariant = {
  id: "variant-a", status: "ACTIVE", isAvailable: true, stockQuantity: 3, lowStockThreshold: 5,
  priceOverride: 110, selections: [{ option, optionValue: value }],
};

test("variant availability uses sellable child stock without changing parent stock", () => {
  const summary = variantAvailabilitySummary({ variants: [sellableVariant, { ...sellableVariant, id: "variant-b", stockQuantity: 0, isAvailable: false }] });
  assert.deepEqual(summary, { hasVariants: true, sellableVariants: [sellableVariant], stockQuantity: 3, available: true, status: "LOW_STOCK" });
});

test("variant price override falls back to the parent price only when absent", () => {
  assert.equal(normalizedVariantPrice({ price: 100 }, sellableVariant), 110);
  assert.equal(normalizedVariantPrice({ price: 100 }, { ...sellableVariant, priceOverride: null }), 100);
});

test("variant option snapshots are server-derived human-readable values", () => {
  assert.equal(selectedOptionsSnapshot(sellableVariant), "Shade: A1");
});

test("public gallery excludes rights-unconfirmed and deduplicates URLs with imageUrl fallback", () => {
  const gallery = visibleGallery({ imageUrl: "https://legacy.example/image.jpg", images: [
    { url: "https://review.example/image.jpg", rightsConfirmed: false },
    { url: "https://public.example/one.jpg", rightsConfirmed: true, isPrimary: false, sortOrder: 2 },
    { url: "https://public.example/one.jpg", rightsConfirmed: true, isPrimary: true, sortOrder: 1 },
  ] });
  assert.deepEqual(gallery.map((image) => image.url), ["https://public.example/one.jpg"]);
  assert.equal(visibleGallery({ imageUrl: "https://legacy.example/image.jpg", images: [] })[0].url, "https://legacy.example/image.jpg");
});
