import test from "node:test";
import assert from "node:assert/strict";
import {
  extractRef,
  deriveFamilySlug,
  pageConfirmsRef,
  extractImageCandidates,
  selectConfirmedImageUrl,
} from "./lib/komet.js";

test("extractRef finds the dotted REF at the end of real Komet product names", () => {
  assert.equal(extractRef("8 mm Tapered Round Top Diamond Bur Red 1.8 mm 8856.314.018"), "8856.314.018");
  assert.equal(extractRef("4 mm Tapered Shoulder Flat Ended Rounded Corner Diamond Bur 2.5 mm 8845KR.314.025"), "8845KR.314.025");
  assert.equal(extractRef("Carbide Bur H141.104.018"), "H141.104.018");
  assert.equal(extractRef("8.5 mm Polishing Cup 8 mm Length 9525UF.204.085"), "9525UF.204.085");
});

test("extractRef returns null for names that don't match the high-confidence dotted-REF pattern, rather than guessing", () => {
  assert.equal(extractRef("205 Elbow Long 006 H1SML"), null);
  assert.equal(extractRef("Diamond Bur 801-314-008"), null, "dash-separated, not dot-separated");
  assert.equal(extractRef("Komet PEEK Tips"), null);
  assert.equal(extractRef("Diamond Bur Composite Finisher 4092"), null, "bare numeric kit code, no dots");
});

// Ground truth: verified against the 31-row research manifest's own
// official_product_page_url column, e.g. REF 8856.314.018 is confirmed to
// resolve to https://www.kometstore.de/de-de/p/8856.
test("deriveFamilySlug matches the researched Komet Store family-page slugs", () => {
  assert.equal(deriveFamilySlug("8856.314.018"), "8856");
  assert.equal(deriveFamilySlug("6830L.314.012"), "6830l");
  assert.equal(deriveFamilySlug("846KREF.314.016"), "846kref");
});

test("pageConfirmsRef requires the exact REF text on the page, case-insensitively", () => {
  const html = "<html><body>REF 8856.314.018 — Diamant, FG, shank 314</body></html>";
  assert.equal(pageConfirmsRef(html, "8856.314.018"), true);
  assert.equal(pageConfirmsRef(html, "8856.314.019"), false, "a different size must not match");
});

test("extractImageCandidates only returns URLs actually present in the HTML, never a synthesized one", () => {
  const html = `
    <img src="https://cdn.kometstore.de/mam/CXP_ASSETS_CT_WEBSHOP_DETAIL/03di_8856_314_018_450.png" />
    <img src="https://cdn.kometstore.de/mam/CXP_ASSETS_CT_WEBSHOP_DETAIL/03di_8856_000_000_200.png" />
    <img src="https://cdn.kometstore.de/icons/cart.svg" />
  `;
  const candidates = extractImageCandidates(html);
  assert.deepEqual(candidates, [
    "https://cdn.kometstore.de/mam/CXP_ASSETS_CT_WEBSHOP_DETAIL/03di_8856_314_018_450.png",
    "https://cdn.kometstore.de/mam/CXP_ASSETS_CT_WEBSHOP_DETAIL/03di_8856_000_000_200.png",
  ]);
});

test("selectConfirmedImageUrl prefers the candidate whose filename embeds the REF, never picks blindly among unrelated candidates", () => {
  const candidates = [
    "https://cdn.kometstore.de/mam/.../03di_8856_000_000_200.png",
    "https://cdn.kometstore.de/mam/.../03di_8856_314_018_450.png",
  ];
  assert.equal(
    selectConfirmedImageUrl(candidates, "8856.314.018"),
    "https://cdn.kometstore.de/mam/.../03di_8856_314_018_450.png"
  );
});

test("selectConfirmedImageUrl accepts a single unambiguous candidate even without an embedded REF match", () => {
  const candidates = ["https://www.kometdental.com/uploads/01tc_h390q_314_018_100-e1721288411993.png"];
  assert.equal(selectConfirmedImageUrl(candidates, "H390Q.314.018"), candidates[0]);
});

test("selectConfirmedImageUrl refuses to guess when multiple candidates exist and none embeds the REF", () => {
  const candidates = [
    "https://cdn.kometstore.de/mam/.../unrelated-a.png",
    "https://cdn.kometstore.de/mam/.../unrelated-b.png",
  ];
  assert.equal(selectConfirmedImageUrl(candidates, "8856.314.018"), null);
});

test("selectConfirmedImageUrl returns null for zero candidates", () => {
  assert.equal(selectConfirmedImageUrl([], "8856.314.018"), null);
});
