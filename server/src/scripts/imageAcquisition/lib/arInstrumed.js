/**
 * AR Instrumed discovery helpers, built from
 * X_Dental_Brand_Acquisition_Rules_Komet_AR_Coltene_Microdont_Solventum.csv
 * and confirmed against the live ar-instrumed.de category pages (WooCommerce):
 *
 *   "VERIFIED_PATTERN: product pages use https://ar-instrumed.de/product/
 *    {human-readable-slug}/; shop/category pages expose SKU beside each
 *    product. Slug is not deterministically derived from SKU."
 *   "VERIFIED_PATTERN: official images use
 *    https://ar-instrumed.de/wp-content/uploads/YYYY/MM/{filename}...
 *    Parse actual srcset/data-large-image/gallery href."
 *
 * So: crawl the category grid (never guess a product-page slug from a SKU),
 * read the "Artikle nr" field WooCommerce prints beside each card, and take
 * the largest real image URL from that card's own srcset — never a
 * synthesized filename.
 */

function stripTags(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/&#8211;/g, "-").replace(/\s+/g, " ").trim();
}

export function normalizeSku(value) {
  return String(value ?? "").trim().toUpperCase();
}

/** The largest image in a srcset attribute (by declared pixel width), never a constructed filename. */
export function selectLargestSrcsetUrl(srcset) {
  if (!srcset) return null;
  const candidates = srcset
    .split(",")
    .map((entry) => entry.trim().split(/\s+/))
    .filter(([url, width]) => url && width?.endsWith("w"))
    .map(([url, width]) => ({ url, width: Number.parseInt(width, 10) }))
    .filter((c) => Number.isFinite(c.width));
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => b.width - a.width)[0].url;
}

/** Parses every product card on one category/listing page into {sku, name, pageUrl, imageUrl}. */
export function parseProductGrid(html) {
  const cards = html.match(/<div class="wd-product wd-hover-quick[\s\S]*?(?=<div class="wd-product wd-hover-quick|<\/main|$)/g) ?? [];
  const products = [];

  for (const card of cards) {
    const nameMatch = card.match(/product-image-link"[^>]*aria-label="([^"]+)"/);
    const pageUrlMatch = card.match(/<a href="(https:\/\/ar-instrumed\.de\/product\/[^"]+)"/);
    const srcsetMatch = card.match(/srcset="([^"]+)"/);
    const srcMatch = card.match(/<img[^>]+src="([^"]+)"/);
    const skuMatch = card.match(/Artikle nr\s*<\/span>\s*<span>\s*([^<\s][^<]*?)\s*<\/span>/);

    if (!nameMatch || !skuMatch) continue;

    products.push({
      sku: skuMatch[1].trim(),
      name: stripTags(nameMatch[1]),
      pageUrl: pageUrlMatch?.[1] ?? "",
      imageUrl: selectLargestSrcsetUrl(srcsetMatch?.[1]) ?? srcMatch?.[1] ?? "",
    });
  }

  return products;
}

/** Highest page number in this listing page's pagination controls, or 1 if there's no pagination. */
export function detectLastPage(html) {
  const pageNumbers = [...html.matchAll(/page-numbers[^"]*"[^>]*href="[^"]*\/page\/(\d+)\/"/g)].map((m) =>
    Number.parseInt(m[1], 10)
  );
  const currentMatch = html.match(/page-numbers current">(\d+)</);
  const current = currentMatch ? Number.parseInt(currentMatch[1], 10) : 1;
  return Math.max(current, ...(pageNumbers.length ? pageNumbers : [1]));
}

// AR Instrumed article numbers look like "105-056", "105-092-3", sometimes
// with a trailing letter variant ("105-092-3B"). Deliberately narrow, same
// spirit as Komet's dotted-REF pattern: only the shape the rules doc
// verified, not attempting every possible trailing token.
const SKU_PATTERN = /\b(\d{3}-\d{3}(?:-\d+)?[A-Z]?)\b/;

/** Extracts a candidate AR Instrumed article number from an X Dental product name, or null. */
export function extractSkuCandidate(productName) {
  const match = (productName ?? "").match(SKU_PATTERN);
  return match ? match[1] : null;
}

/**
 * Matches an extracted SKU candidate against harvested product cards. A
 * card's own SKU sometimes carries a trailing variant letter (A/B) that the
 * X Dental name doesn't (e.g. card "105-056A" / "105-056B" for a name that
 * just says "105-056") — so this also accepts an unambiguous single card
 * whose SKU starts with the candidate. Returns null (no guess) whenever
 * more than one card could plausibly match.
 */
export function matchSkuToCard(skuCandidate, cards) {
  if (!skuCandidate) return null;
  const normalizedCandidate = normalizeSku(skuCandidate);

  const exact = cards.filter((card) => normalizeSku(card.sku) === normalizedCandidate);
  if (exact.length === 1) return { card: exact[0], matchBasis: "exact-sku" };
  if (exact.length > 1) return null;

  const prefixed = cards.filter((card) => normalizeSku(card.sku).startsWith(normalizedCandidate));
  if (prefixed.length === 1) return { card: prefixed[0], matchBasis: "sku-prefix" };

  return null;
}
