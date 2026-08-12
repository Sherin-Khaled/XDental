# Production database migration plan

**Status: planning only. Not executed. No Supabase project exists yet, no
migration has run against any production database.**

This document answers what needs to move from the current local PostgreSQL
database to a fresh production database, what must not, and how to verify
the result — before any of it is actually done.

## 1. How a fresh production database gets initialized

```
DATABASE_URL=<production-connection-string> npx prisma migrate deploy
```

Run from `server/`, using the production `DATABASE_URL`. This applies all
32 committed migrations in order against an empty database and creates the
`_prisma_migrations` history table Prisma uses to track what's applied.
Verified against a real fresh-checkout dependency install in this session
(`npx prisma generate` via `postinstall`, `npx prisma validate` both
succeeded against the committed schema with no local state). `migrate
deploy` itself has not been run against production because no production
database exists yet.

After migrating schema, `npm run seed:permissions` and `npm run
seed:taxonomy` populate the `Permission` and `Category` reference data (see
§2). `npm run seed:admin` creates the first real admin account — **only**
when `SEED_ADMIN_NAME`/`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` are set to
real values; the script refuses to run with its dev-only defaults when
`NODE_ENV=production` (confirmed in the Phase 1 backend audit).

## 2. Data classification — APPROVED 2026-08-12

### SCHEMA
All 43 Prisma models, created by `migrate deploy` — no data, just
structure. Nothing to decide here; this happens identically every time.

### PRODUCTION_REQUIRED_DATA (approved)

| Table | Rows | Notes |
|---|---|---|
| `Product` | **12,942** (filtered) | `WHERE sourceSystem = 'TOOTHPICK_EG'` — see §4 |
| `Brand` | **555** | Only brands actually referenced by an exported product's `brandId` — not all 607 in the local DB. See §4a. |
| `Category` | **147** | 143 directly referenced by an exported product's `categoryId`, plus 4 parent-only categories required for hierarchy integrity. See §4a. |
| `Permission` | 21 | Role/permission definitions the app's own RBAC depends on |
| `DeliveryZone` | **9** (exact slug allowlist) | `new-cairo`, `nasr-city`, `heliopolis`, `maadi`, `dokki`, `mohandessin`, `6th-of-october`, `sheikh-zayed`, `other` — excludes the `freedelivery` test row |
| `HeroSlide` | **3** | Only rows with `status = PUBLISHED` at export time |
| `ProductOption`/`ProductOptionValue`/`ProductVariant`/`ProductVariantOptionValue`/`ProductImage` | 0 each | Currently empty — the 12,942 launch products are all simple products with no variants or gallery images yet. Re-check counts before the real migration in case admin work adds any before then |

### EXCLUDE_FROM_PRODUCTION_MIGRATION (approved)

| Table | Rows | Why |
|---|---|---|
| `DeliveryZone` (partial) | 1 | The `freedelivery`-slug row — duplicate "New Cairo" name, mismatched slug, created 8 days after the other 9 on a different pattern |
| `DeliveryOffer` | 1 | Current "discounte delivery" *(sic)* row — draft/unreviewed |
| `FlashSale` | 3 | All 3 reference known local/test products, not real launch products |
| `ScheduledPromotion` | 4 | All 4 are placeholder/test rows (coupon codes like `SSSSSSSSSS`, zero-duration date ranges, a disabled placeholder-titled row, and one generic "10% discount" row not confirmed as real) |
| `User` | 12 | All 12 are dev/test accounts: personal gmail/hotmail addresses used for manual QA, `@example.test`, `@anonymized.invalid`, and the seeded `admin@xdental.local` dev account. **None are real customers or a real production admin.** |
| `AuthSession` | 44 | Tied to the above test users; stale tokens, meaningless in production |
| `UserPermission` | 4 | Role assignments for the same test users |
| `CartItem` | 3 | Test cart contents |
| `Order` / `OrderItem` | 13 / 18 | Test orders placed against test users during development |
| `Quote` | 1 | Test |
| `SupportThread` | 12 | Test support tickets |
| `ProductRequest` | 4 | Test |
| `Notification` | 47 | Test notifications tied to test users |
| `LoyaltyAccount` / `WalletTransaction` | 9 / 0 | Tied to test users |
| `EmailDelivery` | 3 | Test email delivery log entries |
| `Product` (non-launch subset) | 8 | 1 `LOCAL_CATALOG` + 3 `EXCEL_IMPORT` + 4 `sourceSystem: null` rows (names like "sss", "sssd") — all already `INACTIVE`/unavailable |
| `PushSubscription`, `SupplyList`, `NewsletterSubscriber`, `ContactMessage` | 0 each | Empty; nothing to decide |
| `LoyaltyProgramSettings` | — | Not carried in this pass; not referenced by any approved table's FK, revisit separately if the loyalty program needs config at launch |

Production starts the excluded tables empty. Real customers, orders, and
support threads accumulate naturally after launch.

**Real promotions/coupons are not migrated.** The current `DeliveryOffer`,
`FlashSale`, and `ScheduledPromotion` rows are all test/placeholder data
(see the classification above). Whatever real launch promotions, coupon
codes, and discount campaigns the business actually wants will be created
directly in the production admin panel after go-live — this document does
not invent or guess at what those should be.

### OPTIONAL_AUDIT_HISTORY — decided: EXCLUDE_FROM_INITIAL_PRODUCTION

| Table | Rows | Size |
|---|---|---|
| `CatalogImportRow` | 13,471 | ~24 MB (largest table in the DB) |
| `CatalogImportBatch` | 8 | small |
| `SyncLog` | 52 | small |

Verified (see §4b): neither `Product`, `Brand`, nor `Category` has any
foreign key pointing into `CatalogImportBatch`/`CatalogImportRow` — the
relationship only exists in the other direction (`CatalogImportBatch` has
an optional link to the `User` who ran the import; `CatalogImportRow`
carries plain `sku`/`externalId` string fields for its own audit display,
not real FK columns to `Product`). **Confirmed not required for referential
integrity or runtime functionality.** Not migrated, not deleted locally.

### SECRETS_NOT_TO_EXPORT
Never written into this document, any export file, or any report:
- `User.password` (bcrypt hashes) — moot here since `User` isn't migrating, but stated as a standing rule for any future migration that does move user rows
- `AuthSession` tokens, `PushSubscription` keys
- `DATABASE_URL`, `JWT_SECRET`, SMTP credentials, `UPLOAD_S3_*` credentials — these are environment configuration, never derived from or written into DB exports

## 3. How the 12,942 launch products are identified

Exact, already-proven filter, used consistently across every prior audit
this project:

```sql
SELECT * FROM "Product" WHERE "sourceSystem" = 'TOOTHPICK_EG';
```

Reconfirmed this session: exactly 12,942 rows, 0 null price, 0 duplicate
SKU/externalProductId, 0 unresolved brand/category, 100% `ACTIVE` +
available, `imageUrl` still 0 for all of them.

## 4. Required Brand/Category/inventory relationships

- Every migrated `Product.brandId` and `Product.categoryId` must resolve to
  a row in the migrated `Brand`/`Category` tables — migrate `Brand` and
  `Category` **before** `Product`, or wrap in a single transaction with FK
  checks deferred.
- "Inventory" is not a separate table — `Product.stockQuantity` is a direct
  field on `Product` itself, already migrates with the product row.

### 4a. Referential completeness — verified, not assumed

Computed directly against the live DB rather than guessed:

- **555** distinct `Brand` rows are referenced by the 12,942 approved
  products' `brandId` (of 607 total local `Brand` rows — the other 52 are
  not referenced by any approved product and are not exported).
- **143** distinct `Category` rows are directly referenced by
  `categoryId`. Walking the self-referential `Category.parentId` chain for
  all 143 surfaces **4 additional parent categories** that have no
  directly-assigned approved product but are structurally required —
  total **147**. Without these 4, importing the 143 leaf categories first
  would violate the `parentId` foreign key.
- `Category` is self-referential (`parentId → Category.id`), so insertion
  order matters: parents must exist before children. The export step
  (§10) topologically sorts the 147 rows parent-before-child; the apply
  step inserts them in that exact order (not via a single batched
  `createMany`, which does not guarantee row execution order).
- `HeroSlide.updatedById → User` (nullable, `onDelete: SetNull`). Since
  `User` is never migrated, this column is force-set to `null` in every
  exported `HeroSlide` row regardless of its current local value (all 3
  happen to already be `null`, but the export doesn't rely on that holding
  true forever).
- `DeliveryZone`, `Permission`, and `Brand` have no outgoing foreign keys
  of their own — nothing else needs to accompany them.
- No other table was found to be a required dependency of the approved
  set. `ProductOption`/`ProductVariant`/`ProductImage` are real
  dependents of `Product` but are currently empty (0 rows) — re-verify
  before the real migration in case that changes.

### 4b. CatalogImportBatch / CatalogImportRow — not a dependency

Checked directly in `schema.prisma`: `CatalogImportRow.batchId → CatalogImportBatch.id`
(required) and `CatalogImportBatch.createdById → User.id` (optional). Both
relations point *away* from `Product`/`Brand`/`Category`, not toward them —
neither table has a field that any approved table depends on. See §6.

## 5. Required application configuration/permissions/roles

- `Permission` (21 rows) must be seeded (`npm run seed:permissions`) so the
  app's role/permission checks (`requirePermission`, verified clean in the
  Phase 1 backend audit) have real data to check against.
- No admin/support `User` accounts migrate from local — create the first
  real admin via `npm run seed:admin` with real `SEED_ADMIN_*` env values
  supplied by you at migration time, then assign any additional staff
  accounts and their `UserPermission` rows fresh, through the app itself.

## 6. Is `catalog_import` audit/history data required in production?

**No.** `CatalogImportBatch`/`CatalogImportRow` exist so admins can review
what happened during a bulk import (create/update/skip/conflict counts per
row) via the Catalog Import History admin page. The live storefront and
checkout flow never read these tables. Recommend excluding them from the
first production migration — they're also, at 24 MB, effectively half the
current database's total size for zero storefront benefit. They can be
migrated later, or simply left to accumulate fresh in production once real
imports happen there.

## 7. Estimated clean production DB size

- Current total local DB size: **55 MB**.
- Excluding `CatalogImportRow`/`CatalogImportBatch`/`SyncLog` (optional
  audit history, §2): **~31 MB**.
- Excluding the local-only/test tables in §2 as well (small — `User`,
  `AuthSession`, `Order`, etc. are all tiny compared to `Product`'s 18 MB):
  realistically **~19–20 MB** of genuinely production-required data
  (`Product` + `Brand` + `Category` + `Permission` dominate).
- Either figure is comfortably inside Supabase Free's 500 MB quota (55 MB
  is ~11%; the clean estimate is ~4%).

## 8. Verification before/after (for when this actually runs)

**Before migrating data**, on the source (local) DB:
- `exportProductionSeed.mjs` (§10) already does this automatically — it
  hard-fails if `Product` isn't exactly 12,942, if `DeliveryZone` doesn't
  match all 9 approved slugs exactly, or if `HeroSlide` isn't exactly 3
  published rows, and it writes a per-table SHA-256 checksum into the
  bundle itself.

**After migrating**, on the production DB:
- `SELECT COUNT(*) FROM "Product" WHERE "sourceSystem" = 'TOOTHPICK_EG'` must equal 12,942.
- Re-run the same integrity checks used throughout this project (0 null
  price, 0 duplicate SKU, 0 duplicate externalProductId, 0 unresolved
  brand/category, 0 negative/null stock, 100% ACTIVE, `imageUrl` still 0).
- `Brand`/`Category` counts must equal **555/147** (the approved
  referenced-only subset — not the full local 607/218).
- `npx prisma migrate status` on the production `DATABASE_URL` must report
  "Database schema is up to date!" with all 32 migrations applied.

**Failure detection**: any count mismatch, any FK constraint violation
during import (which Postgres will reject outright — `Product` migration
would hard-fail before committing if `Brand`/`Category` weren't migrated
first), or `prisma migrate status` reporting a pending/failed migration.

**Rollback/recovery**: since this is a fresh database being populated for
the first time (not an in-place upgrade of a database with existing
production traffic), rollback is simply: stop, diagnose, and either fix
forward or drop and re-run against a fresh empty database. No production
traffic exists yet to be at risk during this specific migration.

## 9. Secrets handling

No `DATABASE_URL`, credentials, or password hashes are written into this
document or any file this plan produces. The export bundle (§10) is built
by an allowlisted query set that never selects `User`, `AuthSession`, or
any other credential/session-bearing table — not filtered out afterward,
simply never read — so no secret or customer PII can end up in it by
construction. The bundle itself lives in `/production-seed-export/`, which
is gitignored and must stay off any shared/committed location.

## 10. The migration mechanism (built, not yet executed)

Two scripts in `server/src/scripts/productionMigration/`:

- **`exportProductionSeed.mjs`** — reads the approved dataset (§2) from
  whatever `DATABASE_URL` currently points at (today: the local dev DB)
  and writes `production-seed-export/production-seed-bundle.json`. Purely
  additive/read-only against the source database. Already run against the
  local DB this session: **12,942 / 555 / 147 / 9 / 3 / 21** rows across
  `Product`/`Brand`/`Category`/`DeliveryZone`/`HeroSlide`/`Permission`,
  matching every expectation in §2 and §4a exactly.

- **`applyProductionSeed.mjs`** — reads the bundle, re-verifies its
  checksums, and inserts everything into whatever `DATABASE_URL` currently
  points at, in FK-safe order (Brand/Permission/DeliveryZone/HeroSlide →
  Category, parent-before-child → Product), inside one transaction. Runs
  in dry-run/validate-only mode unless given `--confirm-apply`. It also
  refuses outright if the target database already has rows in any of the
  six target tables — it seeds a freshly-migrated empty database, it does
  not merge into an existing one. Tested this session **in dry-run mode
  against the local DB on purpose** — as expected, it correctly detected
  the local DB is non-empty (it's the source, not a fresh target) and
  refused to proceed, proving the safety guard works before it's ever
  pointed at anything real.

When Supabase exists: run `exportProductionSeed.mjs` once more for a fresh
bundle (or reuse the existing one if nothing changed), point
`DATABASE_URL` at the new production database, run
`prisma migrate deploy`, then `applyProductionSeed.mjs --confirm-apply`.
Neither script has been run with real production credentials or
`--confirm-apply` against any target.
