# Release manifest (Phase 2B — refreshed)

Produced by re-auditing the working tree from its **current** state (not
reused from the Phase 2A pass) ahead of the first real production commit.
This document is the reviewable plan for a deliberate, selective `git add`
— never `git add .` / `-A` / `--all`.

## Why this exists

Only 3 commits exist in this repository's history, the last of which
predates the vast majority of the application. As of this refreshed audit:

- **702** files are untracked-and-not-ignored (`git ls-files --others --exclude-standard`)
- **123** already-tracked files have uncommitted modifications
- Only **1 of 32** Prisma migration directories is tracked
  (`20260630150000_init_postgresql`); the other 31 are untracked
- `prisma/migration_lock.toml` **is** tracked, content `provider = "postgresql"`

## What changed since the Phase 2A manifest

- Added: `server/src/scripts/imageAcquisition/{buildCategoryComparison,buildClientCategoryComparison,buildExternalImageInput,buildImageBrandSummary}.mjs`
  and `docs/release-manifest.md` itself (+16 files net vs. the prior pass).
- **Three real gaps found and corrected in this refresh** that the Phase 2A
  pattern list missed entirely:
  - `vite.config.ts` (root) — modified, **not previously covered by any
    staging pattern**. Missing this would have broken every future build.
  - `server/templates/product-import-template.csv` — modified, already
    tracked; a real shipped application asset (the downloadable template
    for the admin catalog-import feature), not research output. Also not
    previously covered.
  - `server/prisma/schema.prisma` — modified, **caught only after the first
    `git add` was run**, by diffing `git status --short` post-staging
    against the plan and finding it still listed as ` M` (unstaged). This
    is the actual Prisma schema source; missing it would have made
    `prisma generate`/`migrate` operate against a stale schema. Staged
    immediately as a follow-up `git add server/prisma/schema.prisma` before
    any QA or commit.
  - All three are now included below.
- Root-level already-tracked config files (`package.json`, `README.md`,
  `index.html`, `.env.example`, `server/.env.example`,
  `server/package.json`, `server/package-lock.json`) were likewise not
  explicitly enumerated in the Phase 2A pattern list (only implied). They
  are now explicit.

This is exactly why a re-audit from current state — rather than trusting
the previous manifest — was worth doing.

## Verification performed

- `npx prisma migrate status` → **"Database schema is up to date!"**; 32/32
  migration folders on disk, each with `migration.sql`, correct
  chronological order, no duplicate timestamps.
- `npx prisma validate` → schema valid.
- Full exclusion sweep re-run (`git check-ignore`) against every required
  category: `.env`/`.env.local`, `server/backups/`, `server/exports/`,
  `image-acquisition-output/`, `komet-*.json`/`microdont-*.json`,
  `server/scripts-tmp/`, Office lock files (`~$*`), QA screenshots
  (`gold-*.png`/`theme-*.png`), all `*.log` patterns, `node_modules/`,
  `dist/`, `server/generated/`/`server/src/generated/`, and
  `server/uploads/{product-images,profile-images,hero-slides}/*` (with the
  `.gitkeep` negation intact) — all confirmed correctly ignored.
- `D:\Front-End\Work\XDental.website\Image_acquisition\` (the separate cloud
  research-input folder) is **outside this git repository entirely** —
  confirmed via `git rev-parse --is-inside-work-tree` failing at that path
  — so it is not even a gitignore concern, it's structurally unreachable by
  any `git add` run from this repo.
- Scanned the full untracked list for any screenshot/log/backup file not
  already covered by an ignore rule — none found.

## Selective staging plan

```
.env.example .gitignore README.md index.html package.json vite.config.ts
server/.env.example server/package.json server/package-lock.json
server/src/
src/
server/templates/product-import-template.csv
server/prisma/schema.prisma
server/prisma/migrations/ server/prisma/migration_lock.toml
server/prisma/seed.js server/prisma/seedTaxonomy.js server/prisma/taxonomySeedData.js
server/prisma/seedPermissions.js server/prisma/seedHeroSlides.js
server/prisma/heroSlideSeedData.js server/prisma/repairHeroSlideImages.js
public/
server/uploads/product-images/.gitkeep server/uploads/profile-images/.gitkeep
server/uploads/hero-slides/.gitkeep
docs/account-preferences.md docs/catalog-import-contract-v1.md
docs/production-email-setup.md docs/production-image-storage.md
docs/production-real-data-needed.md docs/release-manifest.md
```

| Category | Path(s) | Files | Classification |
|---|---|---|---|
| Root config | `.env.example`, `.gitignore`, `README.md`, `index.html`, `package.json`, `vite.config.ts`, `server/.env.example`, `server/package.json`, `server/package-lock.json` | 9 | STAGE_REQUIRED_CONFIG |
| Backend source | `server/src/*` | 171 | STAGE_REQUIRED_RUNTIME |
| Frontend source | `src/*` | 207 | STAGE_REQUIRED_RUNTIME |
| Shipped template asset | `server/templates/product-import-template.csv` | 1 | STAGE_REQUIRED_RUNTIME |
| Prisma schema source | `server/prisma/schema.prisma` | 1 | STAGE_REQUIRED_MIGRATION |
| Schema migrations | `server/prisma/migrations/*`, `migration_lock.toml` | 31 | STAGE_REQUIRED_MIGRATION |
| Seed/repair tooling | `server/prisma/{seed,seedTaxonomy,taxonomySeedData,seedPermissions,seedHeroSlides,heroSlideSeedData,repairHeroSlideImages}.js` | 6 | STAGE_REQUIRED_RUNTIME |
| Static assets | `public/*` | 381 | STAGE_REQUIRED_PUBLIC_ASSET |
| Upload-folder placeholders | `server/uploads/*/.gitkeep` | 3 | STAGE_REQUIRED_CONFIG |
| Engineering/deployment docs | `docs/{account-preferences,catalog-import-contract-v1,production-email-setup,production-image-storage,production-real-data-needed,release-manifest}.md` | 6 | STAGE_REQUIRED_DEPLOYMENT_DOC |
| **Total** | | **816** | |

Leak-checked clean: zero `catalogue-audit`, zero `reusable-snippets`, zero
`scripts-tmp`, zero `image-acquisition-output`, zero `node_modules`/`dist`/
`generated`, zero `komet-`/`microdont-` stray files, zero actual uploaded
test images (only the 3 intended `.gitkeep` placeholders).

## Explicitly excluded

| Path | Classification | Why |
|---|---|---|
| `docs/catalogue-audit/*` (2 JSON files, 14.9 MB + 31.9 MB, + 3 smaller files) | EXCLUDE_RESEARCH_OUTPUT | One-time import source data, already reflected in the live DB |
| `docs/X_Dental_Catalog_LIVE_Batch01/02.xlsx` | EXCLUDE_RESEARCH_OUTPUT | Raw source spreadsheets, already imported |
| `docs/reusable-snippets/*` | REVIEW_ONLY | Not referenced anywhere in `src/`; not proven runtime-required. **Not deleted, not gitignored — left exactly as-is pending your decision**, per instruction not to auto-clean it |
| `server/scripts-tmp/*`, `server/tmp-*.mjs` | EXCLUDE_TEMP | Ad hoc one-off scripts, gitignored |
| `komet-*.json`, `microdont-*.json` | EXCLUDE_TEMP | Stray scratch files from image discovery, gitignored |
| `/image-acquisition-output/` | EXCLUDE_RESEARCH_OUTPUT | Gitignored, unchanged |
| `server/uploads/{product-images,profile-images,hero-slides}/*` (actual files) | EXCLUDE_LOCAL_DATA | Local dev test uploads, gitignored |
| `gold-*.png`, `theme-*.png`, `*.log` | EXCLUDE_TEMP | Gitignored |
| `.env`, `.env.local` | EXCLUDE_SECRET | Gitignored; never tracked |
| `server/generated/`, `server/src/generated/` | EXCLUDE_GENERATED | Prisma-client output, regenerated by `postinstall` |
| `dist/`, `node_modules/` | EXCLUDE_GENERATED | Build output / dependencies |
| `D:\...\Image_acquisition\` (research CSVs for the cloud workflow) | EXCLUDE_RESEARCH_OUTPUT | Outside this git repository entirely |
| `public/hero section/brandsImg.psd` | REVIEW_ONLY | Unreferenced Photoshop source file; harmless either way, not required |
| 3 orphaned `public/brand-logos/*.webp` (no DB reference) | REVIEW_ONLY | Harmless, staged anyway as part of the `public/` blanket include since they're not distinguishable from required ones without per-file exclusion; flagged for awareness only |

## Next step (not taken until Phase 4)

This is a plan, not an action. Staging happens only in the explicitly
authorized selective-staging phase, using exactly the paths above.
