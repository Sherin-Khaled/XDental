/**
 * Komet-specific discovery helpers, built from
 * X_Dental_Brand_Acquisition_Rules_Komet_AR_Coltene_Microdont_Solventum.csv:
 *
 *   "VERIFIED_PATTERN: Komet Store family pages observed as
 *    https://www.kometstore.de/de-de/p/{family_slug}... Accept only after
 *    returned page displays the target REF/specs."
 *   "do NOT construct an image URL from the REF; prefixes/suffixes vary.
 *    Parse href/src/srcset from official pages."
 *
 * So: the family-page URL is *guessed* from the REF (that part is an
 * inferred pattern the rules doc explicitly allows attempting), but the
 * guess is only trusted once the fetched page's own text confirms the exact
 * REF, and the image URL is always the one actually parsed out of that
 * page's HTML — never templated from the REF.
 */

// Matches the dot-separated REF family this catalogue mostly uses, e.g.
// "8856.314.018", "H141.104.018", "846KREF.314.016", "9525UF.204.085".
// Deliberately narrow: only the pattern the rules doc calls VERY_HIGH
// confidence. Anything else (dash codes, bare numeric kit codes, sonic-tip
// codes, descriptive-only names) is not attempted — see extractRef.
const DOTTED_REF_PATTERN = /\b([A-Za-z0-9]+(?:\.\d{2,3}){1,2})\s*$/;

/** Extracts a high-confidence dotted REF from a product name, or null if the name doesn't match that pattern. */
export function extractRef(productName) {
  const match = (productName ?? "").trim().match(DOTTED_REF_PATTERN);
  return match ? match[1] : null;
}

/** The family token (REF's first dot-segment), lowercased — the Komet Store family-page slug candidate. */
export function deriveFamilySlug(ref) {
  return ref.split(".")[0].toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True when the fetched family page's own text displays the exact REF (not just a plausible URL guess). */
export function pageConfirmsRef(html, ref) {
  const pattern = new RegExp(escapeRegExp(ref), "i");
  return pattern.test(html);
}

/** Every cdn.kometstore.de (or kometdental.com) image asset URL actually present in the page HTML — never synthesized. */
export function extractImageCandidates(html) {
  const pattern = /https?:\/\/(?:cdn\.kometstore\.de|www\.kometdental\.com)\/[^\s"'<>)]+?\.(?:png|jpe?g|webp)/gi;
  return [...new Set(html.match(pattern) ?? [])];
}

/**
 * Picks the one candidate image URL that's actually tied to this REF,
 * preferring a filename that embeds the REF's own numeric/letter segments
 * (observed convention: "8856.314.018" -> "..._8856_314_018_450.png").
 * Returns null (never a guess) when nothing on the page ties an image to
 * this specific REF and more than one candidate is present.
 */
export function selectConfirmedImageUrl(candidates, ref) {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const refToken = ref.replace(/\./g, "_");
  const embedded = candidates.find((url) => url.toLowerCase().includes(refToken.toLowerCase()));
  return embedded ?? null;
}
