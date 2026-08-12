import sharp from "sharp";

const WEBP_QUALITY = 90;

/** True when the response Content-Type header explicitly names an image type (ignoring any charset/boundary suffix). */
export function isImageContentType(contentType) {
  if (!contentType) return false;
  return /^image\//i.test(String(contentType).split(";")[0].trim());
}

// Some official CDN/DAM systems (observed: cdn.kometstore.de) correctly serve
// real image bytes under a generic "application/octet-stream" Content-Type
// instead of "image/*". Rejecting those outright would throw away legitimate
// official assets. So this is a denylist, not an allowlist: only reject
// Content-Types that positively indicate a non-image body (HTML/JSON/XML
// error pages) — everything else, including octet-stream and missing
// headers, is let through to the real decoder, which is the actual
// authority on whether the bytes are a usable image.
const DEFINITELY_NOT_IMAGE_PREFIXES = ["text/", "application/json", "application/xml", "application/problem+json"];

/** True when the Content-Type positively rules out an image body (e.g. an HTML/JSON error page). Ambiguous types like application/octet-stream are NOT flagged here — the decoder settles those. */
export function isDefinitelyNotImageContentType(contentType) {
  if (!contentType) return false;
  const normalized = String(contentType).split(";")[0].trim().toLowerCase();
  return DEFINITELY_NOT_IMAGE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function formatDimensions(width, height) {
  return width && height ? `${width}x${height}` : "";
}

/**
 * Decodes an image buffer, converts it to WebP without resizing (so aspect
 * ratio and pixel dimensions are always preserved — never stretched, never
 * upscaled), and re-opens the result to confirm it decodes cleanly.
 *
 * Already-valid WebP input is passed through untouched rather than
 * re-encoded, avoiding an unnecessary quality-loss round trip.
 *
 * Resolves { ok: true, webpBuffer, originalDimensions, outputDimensions,
 * originalFormat } or { ok: false, reason }.
 */
export async function convertToVerifiedWebp(buffer) {
  let metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    return { ok: false, reason: "Image data could not be decoded (corrupt or unrecognized format)." };
  }

  if (!metadata.width || !metadata.height) {
    return { ok: false, reason: "Decoded image is missing pixel dimensions." };
  }

  const originalDimensions = formatDimensions(metadata.width, metadata.height);

  let webpBuffer;
  try {
    webpBuffer =
      metadata.format === "webp" ? buffer : await sharp(buffer).webp({ quality: WEBP_QUALITY }).toBuffer();
  } catch {
    return { ok: false, reason: "WebP conversion failed." };
  }

  let verifyMetadata;
  try {
    verifyMetadata = await sharp(webpBuffer).metadata();
  } catch {
    return { ok: false, reason: "Converted WebP output failed to re-open for verification." };
  }

  if (verifyMetadata.format !== "webp" || !verifyMetadata.width || !verifyMetadata.height) {
    return { ok: false, reason: "Converted WebP output failed verification." };
  }

  return {
    ok: true,
    webpBuffer,
    originalDimensions,
    outputDimensions: formatDimensions(verifyMetadata.width, verifyMetadata.height),
    originalFormat: metadata.format ?? "",
  };
}
