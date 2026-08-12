import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { parseManifestCsv } from "./lib/manifest.js";
import { resolveOutputFilename } from "./lib/filename.js";
import { convertToVerifiedWebp, isDefinitelyNotImageContentType, isImageContentType } from "./lib/imagePipeline.js";
import { DOWNLOAD_STATUS, annotateSharedAssets, buildResultRow } from "./lib/resultRow.js";

// --- manifest parsing -------------------------------------------------------

test("parseManifestCsv accepts the documented headers and normalizes rows", () => {
  const csv = [
    "source_product_id,product_id,SKU,product_name,brand,official product/model code,official product page URL,direct image asset URL,exact_match_basis,rights_basis,proposed filename",
    "KOMET-1,xd-tp-113053,SKU-1,\"Forceps, Upper Roots\",Komet,H162,https://komet.example/p/h162,https://komet.example/img/h162.jpg,exact-model-match,manufacturer-official-asset,XD-TP-113053__main.webp",
  ].join("\n");

  const { rows, missingFields } = parseManifestCsv(csv);
  assert.deepEqual(missingFields, []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sourceProductId, "KOMET-1");
  assert.equal(rows[0].productId, "xd-tp-113053");
  assert.equal(rows[0].sku, "SKU-1");
  assert.equal(rows[0].productName, "Forceps, Upper Roots");
  assert.equal(rows[0].modelCode, "H162");
  assert.equal(rows[0].imageUrl, "https://komet.example/img/h162.jpg");
  assert.equal(rows[0].proposedFilename, "XD-TP-113053__main.webp");
});

test("parseManifestCsv tolerates alternate header spellings for the same logical fields", () => {
  const csv = ["ProductID,Image_URL", "113053,https://komet.example/img/h162.jpg"].join("\n");
  const { rows, missingFields } = parseManifestCsv(csv);
  assert.deepEqual(missingFields, []);
  assert.equal(rows[0].productId, "113053");
  assert.equal(rows[0].imageUrl, "https://komet.example/img/h162.jpg");
});

test("parseManifestCsv reports a missing image-url column instead of silently proceeding", () => {
  const csv = ["product_id,brand", "113053,Komet"].join("\n");
  const { missingFields } = parseManifestCsv(csv);
  assert.deepEqual(missingFields, ["imageUrl"]);
});

test("parseManifestCsv drops fully blank rows", () => {
  const csv = ["product_id,image_url", "113053,https://komet.example/img.jpg", ",,"].join("\n");
  const { rows } = parseManifestCsv(csv);
  assert.equal(rows.length, 1);
});

// --- filename resolution -----------------------------------------------------

test("resolveOutputFilename prefers an already-conventional proposed_filename", () => {
  const result = resolveOutputFilename({ proposedFilename: "XD-TP-113053__main.webp", productId: "999" });
  assert.equal(result.filename, "XD-TP-113053__main.webp");
  assert.equal(result.toothpickId, "113053");
  assert.equal(result.source, "proposed_filename");
});

test("resolveOutputFilename derives the id from product_id when proposed_filename is absent or non-conventional", () => {
  const result = resolveOutputFilename({ proposedFilename: "h162-main.jpg", productId: "xd-tp-113053" });
  assert.equal(result.filename, "XD-TP-113053__main.webp");
  assert.equal(result.source, "product_id");
});

test("resolveOutputFilename falls back to source_product_id when product_id has no digits", () => {
  const result = resolveOutputFilename({ productId: "", sourceProductId: "KOMET-220148" });
  assert.equal(result.filename, "XD-TP-220148__main.webp");
  assert.equal(result.source, "source_product_id");
});

test("resolveOutputFilename throws rather than guessing when no field yields an id", () => {
  assert.throws(() => resolveOutputFilename({ productId: "", sourceProductId: "" }));
});

// --- content-type / WebP pipeline --------------------------------------------

test("isImageContentType accepts image/* and rejects everything else, including with charset suffixes", () => {
  assert.equal(isImageContentType("image/jpeg"), true);
  assert.equal(isImageContentType("image/webp; charset=binary"), true);
  assert.equal(isImageContentType("text/html; charset=utf-8"), false);
  assert.equal(isImageContentType(""), false);
  assert.equal(isImageContentType(null), false);
});

test("isDefinitelyNotImageContentType rejects HTML/JSON/XML error bodies but lets ambiguous types (octet-stream, missing) through to the real decoder", () => {
  // Observed live against cdn.kometstore.de: real official PNG assets served as
  // application/octet-stream. Rejecting on Content-Type alone would have thrown
  // away 13 of 31 genuinely valid, official images.
  assert.equal(isDefinitelyNotImageContentType("application/octet-stream"), false);
  assert.equal(isDefinitelyNotImageContentType(""), false);
  assert.equal(isDefinitelyNotImageContentType(null), false);
  assert.equal(isDefinitelyNotImageContentType("image/png"), false);
  assert.equal(isDefinitelyNotImageContentType("text/html; charset=utf-8"), true);
  assert.equal(isDefinitelyNotImageContentType("application/json"), true);
  assert.equal(isDefinitelyNotImageContentType("application/xml"), true);
});

test("convertToVerifiedWebp converts a real JPEG to a verified WebP at the same pixel dimensions", async () => {
  const jpeg = await sharp({
    create: { width: 40, height: 20, channels: 3, background: { r: 10, g: 120, b: 200 } },
  })
    .jpeg()
    .toBuffer();

  const result = await convertToVerifiedWebp(jpeg);
  assert.equal(result.ok, true);
  assert.equal(result.originalDimensions, "40x20");
  assert.equal(result.outputDimensions, "40x20", "conversion must never resize/stretch/upscale");
  assert.equal(result.originalFormat, "jpeg");

  const reopened = await sharp(result.webpBuffer).metadata();
  assert.equal(reopened.format, "webp");
});

test("convertToVerifiedWebp passes an already-WebP source through unchanged instead of re-encoding it", async () => {
  const webp = await sharp({
    create: { width: 12, height: 12, channels: 3, background: { r: 1, g: 2, b: 3 } },
  })
    .webp()
    .toBuffer();

  const result = await convertToVerifiedWebp(webp);
  assert.equal(result.ok, true);
  assert.ok(result.webpBuffer.equals(webp), "already-WebP input must be passed through byte-for-byte");
});

test("convertToVerifiedWebp rejects corrupt/non-image bytes as INVALID_IMAGE instead of throwing", async () => {
  const htmlErrorPage = Buffer.from("<html><body>404 Not Found</body></html>");
  const result = await convertToVerifiedWebp(htmlErrorPage);
  assert.equal(result.ok, false);
  assert.match(result.reason, /decoded/i);
});

// --- result rows / duplicate detection ---------------------------------------

test("buildResultRow maps a successful outcome onto every documented output column", () => {
  const row = buildResultRow(
    { sourceProductId: "KOMET-1", productId: "113053", sku: "SKU-1", imageUrl: "https://komet.example/img.jpg" },
    {
      downloadStatus: DOWNLOAD_STATUS.READY,
      httpStatus: 200,
      contentType: "image/jpeg",
      originalDimensions: "40x20",
      outputDimensions: "40x20",
      outputFilename: "XD-TP-113053__main.webp",
      outputPath: "/tmp/out/XD-TP-113053__main.webp",
      sha256: "abc123",
    }
  );
  assert.equal(row.download_status, "IMAGE_READY_LOCAL");
  assert.equal(row.output_filename, "XD-TP-113053__main.webp");
  assert.equal(row.sha256, "abc123");
});

test("annotateSharedAssets records shared_asset_hash/count for identical bytes without discarding any row", () => {
  const rows = [
    buildResultRow({ productId: "1" }, { downloadStatus: DOWNLOAD_STATUS.READY, sha256: "same-hash" }),
    buildResultRow({ productId: "2" }, { downloadStatus: DOWNLOAD_STATUS.READY, sha256: "same-hash" }),
    buildResultRow({ productId: "3" }, { downloadStatus: DOWNLOAD_STATUS.READY, sha256: "unique-hash" }),
  ];

  const annotated = annotateSharedAssets(rows);
  assert.equal(annotated.length, 3, "duplicates are recorded, never dropped");
  assert.equal(annotated[0].shared_asset_hash, "same-hash");
  assert.equal(annotated[0].shared_asset_count, 2);
  assert.equal(annotated[1].shared_asset_hash, "same-hash");
  assert.equal(annotated[1].shared_asset_count, 2);
  assert.equal(annotated[2].shared_asset_hash, "", "a unique asset is not flagged as shared");
  assert.equal(annotated[2].shared_asset_count, 1);
});

test("annotateSharedAssets leaves failed rows (no sha256) alone", () => {
  const rows = [buildResultRow({ productId: "1" }, { downloadStatus: DOWNLOAD_STATUS.FAILED_DOWNLOAD, error: "HTTP 404" })];
  const annotated = annotateSharedAssets(rows);
  assert.equal(annotated[0].shared_asset_hash, "");
  assert.equal(annotated[0].shared_asset_count, "");
});
