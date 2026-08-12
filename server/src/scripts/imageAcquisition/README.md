# Local product-image acquisition tool

Downloads official, research-validated product images from a CSV manifest,
converts them to WebP, and writes them to a local, git-ignored staging
folder. It never touches `src/`, frontend `public/`, Git, or the product
database — its only job is to turn a manifest into verified local files plus
a result CSV for review.

## Usage

```bash
cd server
npm run images:acquire -- \
  --manifest /absolute/path/to/komet-batch01-ready.csv \
  --source komet \
  --batch batch01
```

Optional flags:

| Flag | Default | Purpose |
|---|---|---|
| `--output-root` | `<repo root>/image-acquisition-output` | Where the `<source>/<batch>/{ready,failed}` tree is written. Point it outside the repo entirely if you prefer. |
| `--concurrency` | `4` | Max simultaneous downloads. |

## Manifest CSV (input)

Column headers are matched case- and spacing-insensitively, so reasonable
variations of these names are accepted:

| Column | Required |
|---|---|
| `source_product_id` | |
| `product_id` | |
| `SKU` | |
| `product_name` | |
| `brand` | |
| `official product/model code` | |
| `official product page URL` | |
| `direct image asset URL` | **yes** |
| `exact_match_basis` | |
| `rights_basis` | |
| `proposed filename` | |

The manifest's own research (`exact_match_basis`, `rights_basis`) is trusted
as-is — this tool does not re-derive or second-guess product/image matching,
only downloads and validates the asset itself.

## Output filename

`XD-TP-[TOOTHPICK_ID]__main.webp`, where `TOOTHPICK_ID` comes from, in order:
1. `proposed_filename`, if it already matches the convention exactly.
2. Digits extracted from `product_id`.
3. Digits extracted from `source_product_id`.

A row that can't resolve an id from any of these fails closed
(`FAILED_DOWNLOAD`) rather than guessing a filename.

## What happens to every row

HTTP download → Content-Type must be `image/*` → decode → convert to WebP
**without resizing** (aspect ratio and pixel dimensions are always preserved
— never stretched, never upscaled) → re-open the WebP output to confirm it
decodes cleanly → SHA-256 the final bytes → write to `ready/`.

An image that's already valid WebP is written through unchanged instead of
being re-encoded, avoiding an unnecessary quality-loss round trip.

Any failure writes a debug artifact (the raw response body, when one was
received) into `failed/` for manual review, named after the same Toothpick id.

## Duplicate assets

Identical output bytes across rows are recorded (`shared_asset_hash`,
`shared_asset_count`) but **never rejected or skipped** — Komet legitimately
reuses one official asset across validated variants, and the manifest has
already made that call. Every row still gets its own output file.

## Result CSV (output)

Written next to the batch as `result-<timestamp>.csv`:

```
source_product_id, product_id, SKU, source_url, download_status, http_status,
content_type, original_dimensions, output_dimensions, output_filename,
output_path, sha256, shared_asset_hash, shared_asset_count, error
```

`download_status` is one of `IMAGE_READY_LOCAL`, `FAILED_DOWNLOAD`,
`INVALID_CONTENT`, `INVALID_IMAGE`.

## Tests

```bash
npm run test:image-acquisition
```

Pure-logic and real (synthetic, in-memory) image-conversion tests — no
network access, no real manifest.
