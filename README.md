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

All variables are optional for local development — the app runs entirely on mock data by default.

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

## Connecting a real backend

All data fetching is isolated in `src/services/api.ts`. Each function has a
`TODO` comment showing which endpoint it maps to. Replace the mock return
values with `fetch` calls and you're done — no other files need to change.

```ts
// src/services/api.ts  (example swap)
export async function fetchProducts(params?) {
  const qs  = new URLSearchParams(params as Record<string, string>);
  const res = await fetch(`${import.meta.env.VITE_API_URL}/products?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
}
```

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
