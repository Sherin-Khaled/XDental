# Production deployment checklist (Hostinger)

**Status: preparation only. Nothing in this document has been deployed.**
All values below are placeholders — no real domain, database, or storage
credentials exist yet. Do not fill in real values in this file; set them
directly in Hostinger's environment configuration instead.

## Frontend

| Item | Value |
|---|---|
| Production build command | `npm run build` (root) — runs `vite build --config vite.config.ts` |
| Required build-time env var | `VITE_API_URL=https://<API_DOMAIN>/api` — **must** be HTTPS and non-localhost; the build hard-fails otherwise (verified: `src/services/apiBaseUrl.ts`) |
| Build output | `dist/` — confirmed in this session to contain `index.html`, `.htaccess` (SPA rewrite rule), `toothtools.webp`, and all 356 `brand-logos/*.webp` files via a clean-checkout reproducibility test |
| Static hosting requirement | The committed `public/.htaccess` must reach `dist/.htaccess` and be honored by the host (Apache/LiteSpeed `mod_rewrite`) — without it, any hard refresh or direct link to a non-root route 404s |
| Node version | Not required at request-time (static files only), but the **build** step needs Node `>=22.0.0 <23.0.0` (root `package.json engines`) |

## Backend

| Item | Value |
|---|---|
| Production start command | `npm start` (server/) → `node src/server.js` — no `--watch`, confirmed dev-only in `npm run dev` |
| Node version | `>=22.0.0 <23.0.0` (`server/package.json engines`) |
| `postinstall` behavior | Runs `prisma generate` automatically after `npm install`/`npm ci`. The deployment environment must be able to verify and download Prisma's engine artifacts; the current workstation cannot because of its certificate-chain issue. |
| Prisma migration command | Set `DATABASE_URL` temporarily to the Supabase direct connection (preferred when the runner has IPv6, or the project has the IPv4 add-on) and run `npx prisma migrate deploy` from `server/`. If the migration runner is IPv4-only, Supabase documents its Supavisor **session** pooler on port 5432 as the fallback. Never use transaction mode (port 6543) for migrations. This applies all 33 committed migrations to a fresh database. |
| `/api/health` behavior | Real check, not a bare 200 — runs `SELECT 1` against the DB via Prisma; returns `200` with `{"server":{"status":"ok"},"database":{"status":"connected",...}}` when healthy, `503` if the DB is unreachable. Verified live against the local DB in this session. |

## Database

| Env var | Placeholder | Notes |
|---|---|---|
| `DATABASE_URL` | `<DATABASE_URL>` | The only DB variable currently consumed. For a persistent Hostinger process, use the direct connection when Hostinger can reach Supabase over IPv6 (or the project has the IPv4 add-on); otherwise use Supavisor session mode on port 5432. Reserve transaction mode on port 6543 for serverless/short-lived runtimes. |
| `DIRECT_URL` | Not used | `schema.prisma` has no `directUrl`. No code change is required: supply the migration connection as `DATABASE_URL` only for the controlled CLI step, then keep the runtime `DATABASE_URL` in Hostinger. |

## Storage (S3-compatible, required in production)

| Env var | Placeholder |
|---|---|
| `UPLOAD_STORAGE_DRIVER` | `s3` (optional to declare because production defaults to `s3`, but set it explicitly; `local` is rejected) |
| `UPLOAD_S3_ENDPOINT` | `<STORAGE_ENDPOINT>` |
| `UPLOAD_S3_BUCKET` | `<STORAGE_BUCKET>` |
| `UPLOAD_S3_PUBLIC_BASE_URL` | `<STORAGE_PUBLIC_URL>` |
| `UPLOAD_S3_REGION`, `UPLOAD_S3_ACCESS_KEY_ID`, `UPLOAD_S3_SECRET_ACCESS_KEY` | Supabase Storage (or other S3-compatible provider) credentials |
| `UPLOAD_S3_FORCE_PATH_STYLE` | Optional Boolean; defaults to `false` |

## CORS / cookies / domain

| Item | Requirement |
|---|---|
| Architecture | Frontend `https://<DOMAIN>`, backend `https://<API_DOMAIN>` — same registrable domain, different subdomains |
| `CLIENT_URL` | Must be set to the exact frontend origin(s) — comma-separated if more than one. The backend hard-fails at startup in production if unset (verified in the Phase 1 backend audit); CORS uses this as an exact allowlist via a dynamic origin callback, never a wildcard |
| Cookies | `httpOnly` always on; `secure` auto-true when `NODE_ENV=production`; `SameSite=Lax` by default (works for the same-registrable-domain subdomain split); no `domain` attribute set (host-only cookie) — all verified in the Phase 1 backend audit, no code change needed |
| `NODE_ENV` | Must be `production` — gates secure cookies, CORS strictness, HSTS, the upload-storage driver check, and error-response sanitization |

## Authoritative production environment contract

Required for the frontend build: `VITE_API_URL`.

Required for backend startup: `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`,
`CLIENT_URL`, and all six `UPLOAD_S3_*` values listed above. Production
startup validates these before listening and fails with a specific error when
one is missing or invalid.

Optional for backend startup: `PORT` (defaults to `5000`),
`COOKIE_SAME_SITE` (defaults to `lax`), `UPLOAD_STORAGE_DRIVER` (production
defaults to `s3`), `UPLOAD_S3_FORCE_PATH_STYLE`, all `RATE_LIMIT_*` overrides,
and the mail/push groups below.

Admin-creation only, not runtime variables: `SEED_ADMIN_NAME`,
`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, and optional `SEED_ADMIN_ROLE`
(defaults to `ADMIN`). The production seed command refuses missing name,
email, or password.

## Optional (degrade gracefully if unset — verified in the Phase 1 backend audit)

- Mail is disabled when `MAIL_ENABLED` is absent/false. If enabled, startup requires `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM_EMAIL`, `COMPANY_NOTIFICATION_EMAIL`, and `APP_BASE_URL`; `MAIL_FROM_NAME` and category-specific recipient variables are optional.
- Push is disabled when `WEB_PUSH_ENABLED` is absent/false. If enabled, startup requires `WEB_PUSH_VAPID_SUBJECT`, `WEB_PUSH_VAPID_PUBLIC_KEY`, and `WEB_PUSH_VAPID_PRIVATE_KEY`.

## Known accepted security findings

**`uuid` (moderate, via `exceljs@4.4.0 → uuid@8.3.2`)** — `GHSA-w5hq-g745-h8pq`,
a missing buffer-bounds check in `uuid`'s `v3`/`v5`/`v6` functions when a
`buf` argument is explicitly passed. Accepted as non-exploitable in this
codebase: traced every `uuid` call site inside `exceljs` (the only
consumer of `uuid` here, used by the production admin catalog-import
Excel-upload feature) — exactly one file
(`cf-rule-ext-xform.js`) imports `uuid`, and it calls only `uuidv4()` with
zero arguments. `v4` is not the affected function, and the affected
functions are never called with a `buf` argument anywhere in this
dependency tree. `exceljs@4.4.0` is the latest published 4.x release and
still depends on the vulnerable `uuid@^8.3.0`; the only fix `npm audit`
offers is downgrading to `exceljs@3.4.0` (`isSemVerMajor: true`), which is
a breaking regression, not a fix — not applied. Revisit if `exceljs`
publishes a release that bumps its own `uuid` dependency, or if a future
feature adds a new `uuid` v3/v5/v6 call site with an explicit `buf`
argument (search codebase for this before adding one).

## Pre-flight order (for when this actually runs — not done yet)

1. Create Supabase project → obtain the direct and Supavisor session connection strings; select the runtime URL based on Hostinger's IPv6 reachability
2. Create Supabase Storage bucket → get S3-compatible credentials
3. `prisma migrate deploy` against the fresh database
4. Generate a fresh approved bundle from the local source DB with `node src/scripts/productionMigration/exportProductionSeed.mjs`
5. Point `DATABASE_URL` to the empty migrated production DB and dry-run `node src/scripts/productionMigration/applyProductionSeed.mjs`
6. Apply the verified bundle with `node src/scripts/productionMigration/applyProductionSeed.mjs --confirm-apply`; this bundle already contains Permission, Product, Brand, Category, DeliveryZone, HeroSlide, and disabled LoyaltyProgramSettings rows, so do **not** run `seed:permissions`, `seed:taxonomy`, or `seed:hero-slides` first
7. `npm run seed:admin` with real credentials only after the production bundle succeeds
8. Deploy backend to Hostinger with all env vars above set
9. Confirm `/api/health` returns 200 from the real production URL
10. Deploy frontend build (built with the real `VITE_API_URL`) to Hostinger static hosting
11. Confirm `.htaccess` is live (test a hard refresh on a deep route)

None of the above has been executed.
