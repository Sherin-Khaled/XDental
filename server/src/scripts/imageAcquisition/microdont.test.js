import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRef, parseCategoryTables, matchProductToRow } from "./lib/microdont.js";

const SAMPLE_TABLE_HTML = `
<table id="tablepress-60">
<thead>
<tr class="row-1"><th class="column-1"><strong>L2</strong></th><th class="column-2"><strong>L1</strong></th><th class="column-3"><strong>Ø</strong></th><th class="column-4"><strong>ISO/FIG</strong></th><th class="column-5"><strong>REF</strong></th><th class="column-6"><strong>REF</strong></th></tr>
</thead>
<tbody>
<tr class="row-2">
<td class="column-1">25</td><td class="column-2">10.2</td><td class="column-3">016</td><td class="column-4">199</td><td class="column-5">41,071,002</td><td class="column-6"><img src="https://microdont.com.br/wp-content/uploads/2025/09/41.071.002.png" alt="BROCA CARBIDE ZEKRYA LONG" /></td>
</tr>
<tr class="row-3">
<td class="column-1">25</td><td class="column-2">9.0</td><td class="column-3">015</td><td class="column-4">290</td><td class="column-5">41,071,008</td><td class="column-6"><img src="https://microdont.com.br/wp-content/uploads/2025/09/4.071.008.png" alt="" /></td>
</tr>
</tbody>
</table>`;

test("normalizeRef makes comma/dot/space-separated REFs comparable", () => {
  assert.equal(normalizeRef("41,071,002"), normalizeRef("41.071.002"));
  assert.equal(normalizeRef("41,071,002"), "41071002");
});

test("parseCategoryTables extracts REF, ISO/FIG, and the row's own image URL — never a synthesized filename", () => {
  const rows = parseCategoryTables(SAMPLE_TABLE_HTML);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].ref, "41,071,002");
  assert.equal(rows[0].isoFig, "199");
  assert.equal(rows[0].imageUrl, "https://microdont.com.br/wp-content/uploads/2025/09/41.071.002.png");
});

test("parseCategoryTables reproduces the documented no-synthesis counterexample: REF 41,071,008 legitimately links to a differently-formatted filename", () => {
  const rows = parseCategoryTables(SAMPLE_TABLE_HTML);
  const row = rows.find((r) => normalizeRef(r.ref) === normalizeRef("41,071,008"));
  assert.equal(row.imageUrl, "https://microdont.com.br/wp-content/uploads/2025/09/4.071.008.png");
});

test("matchProductToRow matches when the exact REF appears in the product name", () => {
  const rows = parseCategoryTables(SAMPLE_TABLE_HTML);
  const result = matchProductToRow("Zekrya Long REF 41,071,002", rows);
  assert.equal(result.row.ref, "41,071,002");
});

test("matchProductToRow refuses to match on a generic shape number that isn't the manufacturer's REF, rather than guessing", () => {
  // This is the real, confirmed finding: X Dental's Microdont names carry
  // the universal ISO 806 shape code ("Fissure 56"), not Microdont's own
  // REF/ISO-FIG numbers — so a name like this must NOT match anything.
  const rows = parseCategoryTables(SAMPLE_TABLE_HTML);
  const result = matchProductToRow("Carbide Bur Fissure 56 RA", rows);
  assert.equal(result, null);
});

test("matchProductToRow returns null (not a guess) when no row's REF is present in the name", () => {
  const rows = parseCategoryTables(SAMPLE_TABLE_HTML);
  assert.equal(matchProductToRow("Amalgam Polishing Kit 8 Pcs", rows), null);
});
