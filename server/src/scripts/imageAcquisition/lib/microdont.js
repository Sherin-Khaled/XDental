/**
 * Microdont-specific discovery helpers, built from
 * X_Dental_Brand_Acquisition_Rules_Komet_AR_Coltene_Microdont_Solventum.csv
 * and confirmed against the live carbide-burs/diamond-burs category pages:
 *
 *   "VERIFIED_PATTERN: category pages such as /en/carbide-burs/ and
 *    /en/diamond-burs/ contain structured REF + geometry/spec + linked-image
 *    rows... never generate filename from REF. Counterexample: REF
 *    41,071,008 links to 4.071.008.png. Parse exact row href."
 *
 * Each table row on those pages already pairs one official REF with one
 * official image URL directly (tablepress tables, one row per REF) — no
 * separate page-confirmation fetch is needed the way Komet's family pages
 * needed one; the association is already explicit in the row.
 */

function stripTags(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/&#8211;/g, "-").replace(/\s+/g, " ").trim();
}

/** Normalizes a REF for comparison: strips commas/dots/spaces, uppercases. Lets "41,071,002" == "41.071.002" == "41071002". */
export function normalizeRef(value) {
  return String(value ?? "").replace(/[.,\s]/g, "").toUpperCase();
}

/**
 * Parses every tablepress-style row out of a Microdont category page into
 * {ref, isoFig, diameter, l1, l2, imageUrl, altText, headingContext}. Column
 * meaning is read from each table's own <thead> rather than assumed, since
 * different families use different column sets.
 */
export function parseCategoryTables(html) {
  const rows = [];
  const tableBlocks = html.match(/<table[^>]*>[\s\S]*?<\/table>/g) ?? [];

  for (const table of tableBlocks) {
    const headHtml = table.match(/<thead[\s\S]*?<\/thead>/)?.[0] ?? "";
    const headerCells = (headHtml.match(/<th[^>]*>[\s\S]*?<\/th>/g) ?? []).map((cell) => stripTags(cell).toLowerCase());

    const bodyHtml = table.match(/<tbody[\s\S]*?<\/tbody>/)?.[0] ?? table;
    const trBlocks = bodyHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];

    for (const tr of trBlocks) {
      const cellBlocks = tr.match(/<td[^>]*>[\s\S]*?<\/td>/g) ?? [];
      if (cellBlocks.length === 0) continue;

      const cellTexts = cellBlocks.map(stripTags);
      const imageCellIndex = cellBlocks.findIndex((cell) => /<img[^>]+src="([^"]+)"/.test(cell));
      const imageMatch = imageCellIndex >= 0 ? cellBlocks[imageCellIndex].match(/<img[^>]+src="([^"]+)"/) : null;
      const altMatch = imageCellIndex >= 0 ? cellBlocks[imageCellIndex].match(/alt="([^"]*)"/) : null;

      // The REF cell is the last non-image cell — matches every table shape
      // observed (L2, L1, Ø, ISO/FIG, REF, image).
      const nonImageCells = cellTexts.filter((_, index) => index !== imageCellIndex);
      const ref = nonImageCells[nonImageCells.length - 1] ?? "";
      if (!ref || !/\d/.test(ref)) continue;

      const byHeader = {};
      headerCells.forEach((header, index) => {
        if (index < cellTexts.length && index !== imageCellIndex) byHeader[header] = cellTexts[index];
      });

      rows.push({
        ref,
        isoFig: byHeader["iso/fig"] ?? byHeader["isso/fig"] ?? "",
        diameter: byHeader["Ø"] ?? byHeader["ø"] ?? "",
        l1: byHeader["l1"] ?? "",
        l2: byHeader["l2"] ?? "",
        imageUrl: imageMatch?.[1] ?? "",
        altText: altMatch?.[1] ?? "",
      });
    }
  }

  return rows;
}

/**
 * Matches an X Dental product name against parsed Microdont rows using REF
 * as the primary signal (required) and ISO/FIG as a corroborating signal
 * when present in the name — never a bare substring match. Returns the
 * matched row only when exactly one candidate clears the bar; otherwise
 * null (caller routes to MANUAL_REVIEW/NO_EXACT_MATCH, never guesses).
 */
export function matchProductToRow(productName, rows) {
  const normalizedName = normalizeRef(productName);
  const nameTokens = productName.toUpperCase().match(/[A-Z0-9]+/g) ?? [];

  const refCandidates = rows.filter((row) => normalizedName.includes(normalizeRef(row.ref)));
  if (refCandidates.length === 1) {
    return { row: refCandidates[0], matchBasis: "ref" };
  }
  if (refCandidates.length > 1) {
    // Same REF token embedded ambiguously more than once (rare) — try to
    // disambiguate with ISO/FIG if the name also carries that number.
    const withIsoFig = refCandidates.filter((row) => row.isoFig && nameTokens.includes(row.isoFig));
    if (withIsoFig.length === 1) return { row: withIsoFig[0], matchBasis: "ref+isoFig" };
    return null;
  }

  return null;
}
