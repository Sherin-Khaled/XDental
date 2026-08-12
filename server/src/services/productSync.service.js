// TODO(owner-integration): implement an adapter that imports products, stock,
// prices, and availability from an approved owner-system API or export.
// The owner system owns SKU/external ID, name, price, stock, and availability;
// the website owns brands, categories, slugs, images, descriptions, and display
// fields. Import brand/category text is a mapping hint to existing website
// records only. Do not connect this website directly to an owner desktop database.
export { importProductsFromCsv, importProductsFromRows } from "./integrations/csvCatalog.adapter.js";

export async function importProductsFromOwnerSystem() {
  throw new Error("Owner-system product import is not configured.");
}
