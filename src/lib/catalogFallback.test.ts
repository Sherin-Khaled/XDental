import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const catalogSource = readFileSync(new URL("../services/catalog.ts", import.meta.url), "utf8");
const productCardSource = readFileSync(new URL("../components/dental/ProductCard.tsx", import.meta.url), "utf8");
const fallbackPath = new URL("../../public/toothtools.webp", import.meta.url);

test("null Product.imageUrl maps to the existing X Dental fallback asset", () => {
  assert.match(catalogSource, /product\.imageUrl \|\| product\.images\[0\]/);
  assert.match(catalogSource, /productImage \|\| CATALOG_FALLBACK_IMAGE/);
  assert.match(catalogSource, /toothtools\.webp/);
  assert.equal(existsSync(fallbackPath), true);
});

test("product cards replace a failed remote image with the same fallback", () => {
  assert.match(productCardSource, /useImageFallback\(product\.image, PRODUCT_CARD_IMAGE\)/);
  assert.match(productCardSource, /onError=\{cardImage\.onError\}/);
});
