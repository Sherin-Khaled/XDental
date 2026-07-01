# X Dental Store

Premium dental supplies e-commerce frontend — React + Vite + Tailwind CSS v4.

## Quick start

```bash
cd artifacts/x-dental-store   # or wherever you cloned the project
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Requirements

- Node.js 18 or later
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

## Project structure

```
src/
  components/
    dental/       # X Dental design-system components (Navbar, ProductCard, Button, …)
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

The smoke test creates local customer, product-request, support-message, and
notification records. It keeps the session cookie in memory and does not print credentials.

Use `npm --prefix server run prisma:migrate -- --name <change-name>` when making
a new schema change. Use `prisma:deploy` to apply committed migrations without
creating a new one.

Customer accounts can be created through `/signup`. Registration always creates
a `CUSTOMER`. For local admin/support testing, open Prisma Studio and change a
test user's `role` to `ADMIN` or `SUPPORT`, then sign in with that test account:

```bash
npm --prefix server run prisma:studio
```

The owner-system adapters in `server/src/services/productSync.service.js` and
`server/src/services/orderSync.service.js` are deliberate placeholders. They are
not scheduled and do not connect to an external system.

### Product import preparation

The dry-run template is `server/templates/product-import-template.csv`. It uses
these columns:

| Column | Purpose |
|---|---|
| `externalProductId` | Owner-system product ID when available. |
| `name` | Required product name. |
| `brand` | Product brand. |
| `sku` | Owner product code/SKU when available. |
| `category` | Website product category. |
| `description` | Product description. |
| `price` | Numeric product price. |
| `stockQuantity` | Numeric stock level; zero should be treated as unavailable. |
| `isAvailable` | Availability flag consistent with stock quantity. |
| `imageUrl` | Optional image URL; leave empty while images are not ready. |
| `sourceSystem` | Import source, such as `NEWACC` or `EXCEL_IMPORT`. |

Validate the template, or pass another CSV path, without writing to PostgreSQL:

```bash
npm --prefix server run validate:products
npm --prefix server run validate:products -- path/to/products.csv
```

This foundation performs validation only. It is not connected to Prisma, the
admin UI, image uploads, or an owner system.

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
