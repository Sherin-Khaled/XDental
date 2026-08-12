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
| `postinstall` behavior | Runs `prisma generate` automatically after `npm install`/`npm ci` — verified in this session's clean-checkout test (fresh install → Prisma Client generated with no manual step) |
| Prisma migration command | `DATABASE_URL=<DATABASE_URL> npx prisma migrate deploy` — applies all 32 committed migrations to a fresh database |
| `/api/health` behavior | Real check, not a bare 200 — runs `SELECT 1` against the DB via Prisma; returns `200` with `{"server":{"status":"ok"},"database":{"status":"connected",...}}` when healthy, `503` if the DB is unreachable. Verified live against the local DB in this session. |

## Database

| Env var | Placeholder | Notes |
|---|---|---|
| `DATABASE_URL` | `<DATABASE_URL>` | If Supabase's connection pooler (PgBouncer, typically port 6543) is used for the app's runtime queries, Prisma migrations generally need a **separate direct connection** (port 5432, non-pooled) |
| `DIRECT_URL` | `<DIRECT_URL_IF_REQUIRED>` | **Not currently wired into `schema.prisma`** — the datasource block only declares `url = env("DATABASE_URL")`, no `directUrl`. If Supabase pooling requires it, add `directUrl = env("DIRECT_URL")` to the `datasource db {}` block in `server/prisma/schema.prisma` before running migrations against Supabase. Flagged here so it isn't discovered as a surprise mid-migration. |

## Storage (S3-compatible, required in production)

| Env var | Placeholder |
|---|---|
| `UPLOAD_STORAGE_DRIVER` | `s3` (required — confirmed the app refuses to boot with `local` when `NODE_ENV=production`) |
| `UPLOAD_S3_ENDPOINT` | `<STORAGE_ENDPOINT>` |
| `UPLOAD_S3_BUCKET` | `<STORAGE_BUCKET>` |
| `UPLOAD_S3_PUBLIC_BASE_URL` | `<STORAGE_PUBLIC_URL>` |
| `UPLOAD_S3_REGION`, `UPLOAD_S3_ACCESS_KEY_ID`, `UPLOAD_S3_SECRET_ACCESS_KEY` | Supabase Storage (or other S3-compatible provider) credentials |

## CORS / cookies / domain

| Item | Requirement |
|---|---|
| Architecture | Frontend `https://<DOMAIN>`, backend `https://<API_DOMAIN>` — same registrable domain, different subdomains |
| `CLIENT_URL` | Must be set to the exact frontend origin(s) — comma-separated if more than one. The backend hard-fails at startup in production if unset (verified in the Phase 1 backend audit); CORS uses this as an exact allowlist via a dynamic origin callback, never a wildcard |
| Cookies | `httpOnly` always on; `secure` auto-true when `NODE_ENV=production`; `SameSite=Lax` by default (works for the same-registrable-domain subdomain split); no `domain` attribute set (host-only cookie) — all verified in the Phase 1 backend audit, no code change needed |
| `NODE_ENV` | Must be `production` — gates secure cookies, CORS strictness, HSTS, the upload-storage driver check, and error-response sanitization |

## Other required production env vars

| Env var | Purpose |
|---|---|
| `JWT_SECRET` | ≥32 characters; signs session tokens |
| `PORT` | Backend listen port (Hostinger may assign this) |
| `SEED_ADMIN_NAME` / `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Only needed once, to run `npm run seed:admin` and create the first real admin account — not read by the running server |

## Optional (degrade gracefully if unset — verified in the Phase 1 backend audit)

- `MAIL_ENABLED` / `SMTP_*` — email sending no-ops safely when disabled; no primary user action (signup, order, contact) depends on it succeeding
- `WEB_PUSH_ENABLED` / `WEB_PUSH_VAPID_*` — push notifications; missing config doesn't crash startup or break the frontend prompt

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

1. Create Supabase project → get `DATABASE_URL` (+ `DIRECT_URL` if pooled)
2. Create Supabase Storage bucket → get S3-compatible credentials
3. `prisma migrate deploy` against the fresh database
4. `npm run seed:permissions`, `npm run seed:taxonomy`
5. `npm run seed:admin` with real credentials
6. Migrate `Product`/`Brand`/`Category` per `docs/production-database-migration-plan.md`
7. Deploy backend to Hostinger with all env vars above set
8. Confirm `/api/health` returns 200 from the real production URL
9. Deploy frontend build (built with the real `VITE_API_URL`) to Hostinger static hosting
10. Confirm `.htaccess` is live (test a hard refresh on a deep route)

None of the above has been executed.
