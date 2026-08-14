# Dentorax

Production company-email activation is documented in
[`docs/production-email-setup.md`](docs/production-email-setup.md). The backend
is designed to run with `MAIL_ENABLED=false` until the production mailbox
exists; enabling SMTP later requires environment-variable changes and a backend
restart only.

Premium dental supplies e-commerce frontend — React + Vite + Tailwind CSS v4.

## Quick start

```bash
cd artifacts/x-dental-store   # or wherever you cloned the project
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Requirements

- Node.js 22.x (`>=22.0.0 <23.0.0`, matching both package manifests)
- npm 9 or later

## Available scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server with hot-module replacement |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run check` | Run TypeScript type checking without building |

## Environment variables

Copy `.env.example` to `.env` and adjust if needed:

```bash
cp .env.example .env
```

The product catalog still uses local frontend data. Authentication, product requests,
support, and notifications require the Express/PostgreSQL backend.

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | _(none)_ | Backend API base URL (e.g. `http://localhost:5000/api`) |
| `PORT` | `5173` | Dev server port |
| `BASE_PATH` | `/` | URL base path (set by the proxy on Replit) |

Production builds require an absolute HTTPS API URL and fail before bundling if
it is missing, malformed, non-HTTPS, or points to localhost:

```env
VITE_API_URL=https://api.example.com/api
```

## Project structure

```
src/
  components/
    dental/       # Dentorax design-system components (Navbar, ProductCard, Button, …)
    ui/           # shadcn/ui primitives
    layout.tsx    # App shell (Navbar + Footer wrapper)
  context/
    StoreContext.tsx   # Cart + wishlist state
  data/
    products.ts        # Mock product data — replace with API calls when ready
  pages/               # One file per route (lazy-loaded)
  services/
    api.ts             # API service layer — swap mock data for real fetch calls here
  types/
    product.ts         # Shared TypeScript types (Product, CartItem)
  utils.ts             # formatCurrency, calculateDiscount helpers
  index.css            # Design tokens (--xd-* CSS variables) + Tailwind base
```

## Connecting the product catalog

Product catalog fetching is isolated in `src/services/api.ts`. Authentication,
product requests, support, and notifications already use their dedicated HTTP
service modules in `src/services/`.

```ts
// src/services/api.ts  (example swap)
export async function fetchProducts(params?) {
  const qs  = new URLSearchParams(params as Record<string, string>);
  const res = await fetch(`${import.meta.env.VITE_API_URL}/products?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
}
```

## PostgreSQL backend

The Express API lives in `server/` and uses Prisma with PostgreSQL. Copy
`server/.env.example` to `server/.env`, replace the database password and JWT
secret, then create the local database.

With Docker installed:

```bash
docker run --name xdental-postgres -e POSTGRES_USER=xdental_user -e POSTGRES_PASSWORD=YOUR_PASSWORD -e POSTGRES_DB=xdental_store -p 5432:5432 -d postgres:16
```

With a native PostgreSQL installation, run the equivalent commands as a
PostgreSQL administrator:

```sql
CREATE USER xdental_user WITH PASSWORD 'YOUR_PASSWORD';
CREATE DATABASE xdental_store OWNER xdental_user;
```

Install dependencies, generate the client, apply the committed migration, and
start both applications:

```bash
npm --prefix server install
npm --prefix server run prisma:generate
npm --prefix server run prisma:deploy
npm --prefix server run seed:admin
npm --prefix server run doctor
npm run dev:server
npm run dev
```

Run the final two development commands in separate terminals. Then check
`http://localhost:5000/api/health` before testing signup or login.

For a local MVP smoke test, start the backend and run the test in another terminal:

```bash
npm run dev:server
npm --prefix server run smoke:mvp
```

The smoke test creates a uniquely named local customer and related records, then removes
all records created by that run in a `finally` cleanup. It keeps the session cookie in
memory and does not print credentials.

Use `npm --prefix server run prisma:migrate -- --name <change-name>` when making
a new schema change. Use `prisma:deploy` to apply committed migrations without
creating a new one.

Customer accounts can be created through `/signup`. Registration always creates
a `CUSTOMER`. For local admin/support testing, open Prisma Studio and change a
test user's `role` to `ADMIN` or `SUPPORT`, then sign in with that test account:

```bash
npm --prefix server run prisma:studio
```

### Production security

Configure these backend variables in the deployment secret manager. Never commit
`server/.env`; it is for local development only and is ignored by Git.

| Variable | Required | Production behavior |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection URL used by Prisma. Treat it as a secret. |
| `JWT_SECRET` | Yes | Random signing secret of at least 32 characters. Do not reuse the example value. |
| `CLIENT_URL` | Yes | Exact trusted frontend origin, such as `https://shop.example.com`. Separate multiple trusted origins with commas. |
| `NODE_ENV` | Yes | Set to `production` to enable secure cookies, HSTS, sanitized logging, and production rate-limit defaults. |
| `COOKIE_SAME_SITE` | No | Defaults to `lax`. Set to `none` only when frontend and API are genuinely cross-site and both use HTTPS; `strict` is also accepted. |
| `UPLOAD_STORAGE_DRIVER` | Yes | Development defaults to `local`. Production must use `s3`. |
| `UPLOAD_S3_ENDPOINT` | Production | HTTPS S3-compatible API endpoint. |
| `UPLOAD_S3_REGION` | Production | Storage region; Cloudflare R2 uses `auto`. |
| `UPLOAD_S3_BUCKET` | Production | Dedicated lowercase production bucket name. |
| `UPLOAD_S3_ACCESS_KEY_ID` | Production | Backend-only bucket access key ID. |
| `UPLOAD_S3_SECRET_ACCESS_KEY` | Production | Backend-only bucket secret; never expose it to Vite. |
| `UPLOAD_S3_PUBLIC_BASE_URL` | Production | HTTPS public media domain, such as `https://media.example.com`. |
| `UPLOAD_S3_FORCE_PATH_STYLE` | No | Defaults to `false`; enable only when the selected provider requires it. |

Authentication cookies are HTTP-only and host-only. They are marked `Secure` in
production and use `SameSite=Lax` unless explicitly configured otherwise. CORS
allows credentialed browser requests only when the request origin exactly matches
one of the `CLIENT_URL` origins; the development default remains
`http://localhost:5173,http://localhost:5174` (the common Vite dev ports).

The backend validates its core environment, mail, and upload-storage configuration
before opening the HTTP port. It also connects to PostgreSQL first. Missing or
invalid production settings, an unavailable database, or an unavailable port cause
a clear startup failure instead of leaving a partially working API online.

The API accepts JSON bodies up to 20 KB. The admin CSV catalog import separately
accepts `text/csv` or `text/plain` up to 2 MB. Authenticated API areas send
`Cache-Control: private, no-store`, and unexpected production errors return a
generic message plus a request ID without a stack trace.

Profile, product, and Hero images are stored locally under `server/uploads`
during development and served through `/api/uploads`. They accept JPEG, PNG, or
WebP files up to 5 MB. Production refuses local upload storage and requires
durable S3-compatible object storage with an HTTPS public media URL. Existing
local development URLs remain supported. See
[`docs/production-image-storage.md`](docs/production-image-storage.md) for the
deployment checklist.

Production rate limits are per process and use the client IP for login/register,
then the authenticated user ID for protected creation endpoints:

| Action | Production default | Development default |
|---|---:|---:|
| Login | 10 / 15 minutes | 50 / 15 minutes |
| Register | 5 / hour | 25 / hour |
| Admin password-sensitive user creation | 10 / hour | 50 / hour |
| Support message creation | 30 / 15 minutes | 120 / 15 minutes |
| Quote creation | 10 / hour | 50 / hour |
| Product request creation | 10 / hour | 50 / hour |
| Order creation | 20 / 15 minutes | 100 / 15 minutes |
| Supply-list mutations | 200 / 15 minutes | 1000 / 15 minutes |

The corresponding optional overrides are `RATE_LIMIT_LOGIN_MAX`,
`RATE_LIMIT_REGISTER_MAX`, `RATE_LIMIT_PASSWORD_MAX`, `RATE_LIMIT_SUPPORT_MAX`,
`RATE_LIMIT_QUOTE_MAX`, `RATE_LIMIT_PRODUCT_REQUEST_MAX`, and
`RATE_LIMIT_ORDER_MAX`, and `RATE_LIMIT_SUPPLY_LIST_MAX`. Multi-instance
deployments should also enforce a shared rate limit at the load balancer/API
gateway because the application limiter is intentionally in-memory.

Run the focused middleware smoke without a live database:

```bash
npm --prefix server run smoke:security
```

### Owner-system integration

The current integration is a manual CSV boundary. It does not run on a schedule
and does not connect to NewAcc, SQL Server, an `.mdf` file, or another external
system. Never expose or connect the public website directly to the owner's local
desktop database. A future API/agent adapter must be deployed through an approved,
authenticated private integration architecture.

Current manual flow:

1. An admin downloads the product template and exports catalog data from the owner system.
2. An admin posts that CSV to the product import endpoint. PostgreSQL Product rows become
   authoritative for website checkout price, stock, and availability.
3. Checkout validates the imported stock. Confirming an order decrements website stock once
   in the same transaction as the status change.
4. An admin exports confirmed orders as CSV for import into the owner system.
5. A later owner-system stock snapshot can be imported to reconcile website stock.

The integration adapter boundary is under `server/src/services/integrations/`.
When client documentation is available, add a NewAcc/API adapter behind that boundary.
Only add a SQL Server adapter after the deployment and network security model is approved.

#### Admin integration endpoints

| Endpoint | Roles | Behavior |
|---|---|---|
| `GET /api/admin/integrations/status` | Admin, Support | Returns the latest product import and order export status. |
| `GET /api/admin/integrations/sync-logs` | Admin, Support | Returns recent sync logs; accepts `limit` and `entityType`. |
| `GET /api/admin/integrations/products/import-template` | Admin | Downloads the CSV template. |
| `POST /api/admin/integrations/products/import-csv` | Admin | Imports CSV sent as `text/csv`, or as `{ "csv": "..." }` JSON for small payloads. |
| `GET /api/admin/integrations/orders/export?status=CONFIRMED` | Admin | Downloads confirmed orders as CSV without marking them exported. |

For product import, optional query/body options are `sourceSystem`,
`createMissingLookups=true`, and `markMissingInactive=true`.
`markMissingInactive` is off by default, requires an explicit `sourceSystem`, and
is skipped when any import row fails.

#### Product data ownership

The owner system is the source of truth only for the product SKU/external ID,
product name (when provided), price, stock quantity, and availability/out-of-stock
status. The website admin dashboard is the source of truth for brands, categories,
product images (when not supplied), slugs/SEO fields, descriptions/marketing copy,
featured status, and homepage/display sections and ordering.

The `brand` and `category` CSV columns are optional mapping hints only:

- If the text matches an existing website Brand/Category by name (case-insensitive)
  or slug, the product is linked to that existing record.
- If there is no match, the product still imports, no brand/category record is
  created, and the row returns a warning such as
  `Brand "X" not found; product imported without brand mapping.` or
  `Category "Y" not found; product imported without category mapping.`
- Auto-creating missing brands/categories is disabled by default and only happens
  when an admin explicitly passes `createMissingLookups=true`.
- Imports never overwrite or delete existing Brand/Category records, and an
  unmatched hint never clears a brand/category mapping already on the product.

Admins create and edit brands/categories from the dashboard and can assign
imported products to them at any time; owner-system imports cannot pollute the
website taxonomy with accounting-system names.

#### Seeding the website taxonomy

An initial set of website-managed brands and categories can be seeded with:

```bash
npm --prefix server run seed:taxonomy
```

The data lives in `server/prisma/taxonomySeedData.js` and was compiled using the
public brand/category index of `eg.toothpick.com` as a reference for names and
slugs only — no layout, images, logos, or marketing copy were copied, and
optional fields (country, logo, description) are left blank rather than invented.
The seed is create-only and safe to re-run: entries whose name (case-insensitive)
or slug already exists are skipped, so admin-edited records are never overwritten.
The Category schema is flat, so only top-level categories are seeded
(subcategories are a schema TODO), and promotional pseudo-categories such as
deals/offers were excluded. These are website-managed taxonomy records — the
owner system never creates, edits, or deletes them.

#### Product import CSV

The template is `server/templates/product-import-template.csv`. It uses these columns:

| Column | Purpose |
|---|---|
| `sku` | Required owner product code; products are upserted by SKU first. |
| `name` | Required product name. |
| `slug` | Optional; generated safely from the name/SKU when omitted. |
| `brand` | Optional mapping hint; linked to an existing website Brand by name or slug, otherwise a warning is returned. |
| `category` | Optional mapping hint; linked to an existing website Category by name or slug, otherwise a warning is returned. |
| `price` | Required non-negative numeric website price. |
| `stockQuantity` or `stock` | Required non-negative whole-number stock level. |
| `status` | Optional: `ACTIVE`, `LOW_STOCK`, `OUT_OF_STOCK`, `DRAFT`, or `INACTIVE`. |
| `isAvailable` | Optional boolean availability flag. |
| `outOfStock` | Optional boolean out-of-stock flag. |
| `imageUrl` | Optional image URL; leave empty while images are not ready. |
| `description` | Optional product description. |
| `externalProductId` | Optional owner-system product ID. |
| `sourceSystem` | Optional import source, such as `NEWACC` or `EXCEL_IMPORT`. |

Stock `0`, `OUT_OF_STOCK`, `isAvailable=false`, or `outOfStock=true` forces the
website product to `OUT_OF_STOCK` and unavailable. Products missing from a file
are never deleted and are only marked inactive through the explicit, source-scoped option.
Each row reports validation/import errors. Each import creates a SyncLog containing
start/completion timestamps and created, updated, failed, and inactive counts.

Validate the template, or pass another CSV path, without writing to PostgreSQL:

```bash
npm --prefix server run validate:products
npm --prefix server run validate:products -- path/to/products.csv
npm --prefix server run smoke:owner-integration
```

#### Confirmed order export CSV

The export contains one row per order item and repeats the order header. It includes
order number/ID, customer contact details, structured delivery-address fields,
delivery/payment methods, status, timestamps, order total, SKU, product snapshot,
quantity, unit price, and line total. Existing selected option text remains in the
product-name snapshot because OrderItem does not currently store it separately.
Generating a CSV records a SyncLog but does not change `Order.syncStatus`; a future
adapter should call `markOrderExported` only after the owner system acknowledges receipt.

No admin integration page is included yet. The protected API is ready for a minimal
settings card after the final owner-system workflow and file format are approved.

## Design tokens

All brand colors, spacing scales, and shadow values live as CSS custom
properties in `src/index.css` under the `--xd-*` namespace:

```css
--xd-gold:       #EFBF04   /* primary action color  */
--xd-gold-warm:  #D4A72C   /* logo + stat accents   */
--xd-bg:         #F8F7F2   /* cream page background */
--xd-text:       #050505   /* near-black body text  */
/* … see index.css for the full list */
```

Use these variables in every component instead of hardcoded hex values.

## Tech stack

| Layer | Library |
|---|---|
| Framework | React 19 |
| Build | Vite 7 |
| Styling | Tailwind CSS v4 + CSS custom properties |
| Routing | wouter |
| Server state | TanStack Query v5 |
| Animations | Framer Motion |
| UI primitives | shadcn/ui (Radix UI) |
| Icons | Lucide React |
| Forms | React Hook Form + Zod |
| Type checking | TypeScript 5 |
