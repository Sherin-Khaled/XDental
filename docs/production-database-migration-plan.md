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

## 2. Data classification

### SCHEMA
All 43 Prisma models, created by `migrate deploy` — no data, just
structure. Nothing to decide here; this happens identically every time.

### PRODUCTION_REQUIRED_DATA

| Table | Rows | Notes |
|---|---|---|
| `Product` | **12,942** (filtered) | `WHERE sourceSystem = 'TOOTHPICK_EG'` — see §4 |
| `Brand` | 607 | Referenced by `Product.brandId`; includes the 353 with local `/brand-logos/*.webp` logos |
| `Category` | 218 | Referenced by `Product.categoryId` |
| `Permission` | 21 | Role/permission definitions the app's own RBAC depends on |
| `ProductOption`/`ProductOptionValue`/`ProductVariant`/`ProductVariantOptionValue`/`ProductImage` | 0 each | Currently empty — the 12,942 launch products are all simple products with no variants or gallery images yet. Nothing to migrate today; re-check counts before the real migration in case admin work adds any before then |

**Needs your confirmation before migrating** (small enough to be real
business config, but I can't distinguish "real" from "test" by row content
alone the way I could for `User`):

| Table | Rows |
|---|---|
| `DeliveryZone` | 10 |
| `DeliveryOffer` | 1 |
| `HeroSlide` | 3 |
| `FlashSale` | 3 |
| `ScheduledPromotion` | 4 |
| `LoyaltyProgramSettings` | (singleton config) |

### OPTIONAL_AUDIT_HISTORY
Not required for the live site to function. Recommend excluding from the
first production migration; can be migrated later if you want the history.

| Table | Rows | Size |
|---|---|---|
| `CatalogImportRow` | 13,471 | ~24 MB (largest table in the DB) |
| `CatalogImportBatch` | 8 | small |
| `SyncLog` | 52 | small |

### LOCAL_ONLY_DATA / TEST_DEMO_DATA
Must **not** migrate — all tied to local development/QA activity, not real
customers or real launch content.

| Table | Rows | Why |
|---|---|---|
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
| `Product` (non-launch subset) | 8 | 1 `LOCAL_CATALOG` + 3 `EXCEL_IMPORT` + 4 `sourceSystem: null` rows (names like "sss", "sssd") — all already `INACTIVE`/unavailable, confirmed in the Phase 1 audit |
| `PushSubscription`, `SupplyList`, `NewsletterSubscriber`, `ContactMessage` | 0 each | Empty; nothing to decide |

Production starts these tables empty. Real customers, orders, and support
threads accumulate naturally after launch.

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
- Record exact counts per table in §2's PRODUCTION_REQUIRED_DATA list.
- Record the SHA-256 or row-count checksum of the `Product` export filtered
  to `sourceSystem = 'TOOTHPICK_EG'`.

**After migrating**, on the production DB:
- `SELECT COUNT(*) FROM "Product" WHERE "sourceSystem" = 'TOOTHPICK_EG'` must equal 12,942.
- Re-run the same integrity checks used throughout this project (0 null
  price, 0 duplicate SKU, 0 duplicate externalProductId, 0 unresolved
  brand/category, 0 negative/null stock, 100% ACTIVE, `imageUrl` still 0).
- `Brand`/`Category` counts must equal 607/218.
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
document or any file this plan produces. The actual migration (whenever
run) should move data via a direct authenticated `pg_dump`/`pg_restore` or
equivalent Prisma-scripted copy between the two databases — not through an
intermediate plaintext export file that could be accidentally committed or
shared.
