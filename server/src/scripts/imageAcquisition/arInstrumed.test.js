import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSku, selectLargestSrcsetUrl, extractSkuCandidate, matchSkuToCard } from "./lib/arInstrumed.js";

test("normalizeSku trims and uppercases for comparison", () => {
  assert.equal(normalizeSku(" 105-056 "), "105-056");
  assert.equal(normalizeSku("105-056b"), "105-056B");
});

test("selectLargestSrcsetUrl picks the widest real candidate from a real WooCommerce srcset, never a synthesized one", () => {
  const srcset =
    "https://ar-instrumed.de/wp-content/uploads/2025/09/105-056B-430x556.jpg 430w, " +
    "https://ar-instrumed.de/wp-content/uploads/2025/09/105-056B-232x300.jpg 232w, " +
    "https://ar-instrumed.de/wp-content/uploads/2025/09/105-056B.jpg 928w";
  assert.equal(selectLargestSrcsetUrl(srcset), "https://ar-instrumed.de/wp-content/uploads/2025/09/105-056B.jpg");
});

test("extractSkuCandidate recognizes AR Instrumed's dash-separated article-number shape", () => {
  assert.equal(extractSkuCandidate("Torquing Set Plier 105-149-1S"), "105-149-1S");
  assert.equal(extractSkuCandidate("Pin And Ligature Soft Wire Cutter In Tungsten-Carbide 105-159-1"), "105-159-1");
});

test("extractSkuCandidate returns null for names without that shape, rather than guessing", () => {
  assert.equal(extractSkuCandidate("Non-Aspirating Syringe Long Handle"), null);
  assert.equal(extractSkuCandidate("Freer Mucoperiosteal Elevator"), null);
});

test("matchSkuToCard matches an exact SKU, and a candidate that's a prefix of exactly one card's gallery-variant SKU", () => {
  const cards = [
    { sku: "105-092", name: "x", imageUrl: "https://example.com/a.jpg" },
    { sku: "105-092-3B", name: "y", imageUrl: "https://example.com/b.jpg" },
  ];
  assert.equal(matchSkuToCard("105-092", cards).card.sku, "105-092");
  assert.equal(matchSkuToCard("105-092-3", cards).card.sku, "105-092-3B");
});

test("matchSkuToCard refuses to guess when the candidate is ambiguous across multiple cards", () => {
  const cards = [
    { sku: "105-092-3A", name: "x", imageUrl: "https://example.com/a.jpg" },
    { sku: "105-092-3B", name: "y", imageUrl: "https://example.com/b.jpg" },
  ];
  assert.equal(matchSkuToCard("105-092-3", cards), null);
});

test("matchSkuToCard returns null when nothing matches", () => {
  assert.equal(matchSkuToCard("999-999", [{ sku: "105-092", name: "x", imageUrl: "https://example.com/a.jpg" }]), null);
});
