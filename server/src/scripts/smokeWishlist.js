import "dotenv/config";

import { prisma } from "../config/db.js";
import { deleteUsersAndOwnedData } from "../services/testDataCleanup.service.js";

const API_BASE_URL = process.env.API_BASE_URL?.trim() || "http://localhost:5001/api";
const PASSWORD = "WishlistSmoke123!";
const userIds = [];

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, { method = "GET", body, cookie } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    signal: AbortSignal.timeout(10000),
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

function requireOk(label, result) {
  if (!result.response.ok) throw new Error(`${label}: HTTP ${result.response.status} ${result.payload?.message ?? ""}`.trim());
  return result.payload;
}

function cookieFrom(result) {
  const values = typeof result.response.headers.getSetCookie === "function"
    ? result.response.headers.getSetCookie()
    : [result.response.headers.get("set-cookie")].filter(Boolean);
  return values.find((value) => value.startsWith("x_dental_auth="))?.split(";", 1)[0];
}

async function register(email, zoneId, name) {
  const registration = await request("/auth/register", {
    method: "POST",
    body: { name, email, password: PASSWORD, clinicSpecialty: "General Dentistry", clinicLocations: [{ deliveryZoneId: zoneId }] },
  });
  const user = requireOk(`Register ${name}`, registration).user;
  userIds.push(user.id);
  const login = await request("/auth/login", { method: "POST", body: { email, password: PASSWORD } });
  requireOk(`Login ${name}`, login);
  return { user, email, cookie: cookieFrom(login) };
}

try {
  requireOk("Health", await request("/health"));
  const zones = requireOk("Delivery zones", await request("/delivery-zones")).deliveryZones;
  requireValue(zones[0]?.id, "An active delivery zone is required.");
  const product = await prisma.product.findFirst({
    where: { status: { in: ["ACTIVE", "LOW_STOCK", "OUT_OF_STOCK"] }, price: { not: null } },
    select: { id: true },
  });
  requireValue(product?.id, "A public product is required.");
  const stamp = Date.now();
  const first = await register(`wishlist.smoke+${stamp}-a@xdental.local`, zones[0].id, "Wishlist Smoke A");
  const second = await register(`wishlist.smoke+${stamp}-b@xdental.local`, zones[0].id, "Wishlist Smoke B");

  const initial = requireOk("Initial list", await request("/wishlist", { cookie: first.cookie })).wishlist.productIds;
  requireValue(initial.length === 0, "New account wishlist was not empty.");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const added = requireOk("Add product", await request("/wishlist/items", {
      method: "POST", cookie: first.cookie, body: { productId: product.id },
    })).wishlist.productIds;
    requireValue(added.length === 1 && added[0] === product.id, "Wishlist add was not idempotent.");
  }
  requireValue(
    await prisma.wishlistItem.count({ where: { userId: first.user.id, productId: product.id } }) === 1,
    "Database uniqueness failed."
  );

  const secondList = requireOk("Isolated second list", await request("/wishlist", { cookie: second.cookie })).wishlist.productIds;
  requireValue(secondList.length === 0, "Another customer could see the first customer's wishlist.");
  requireOk("Isolated second delete", await request(`/wishlist/items/${product.id}`, { method: "DELETE", cookie: second.cookie }));
  const firstAfterForeignDelete = requireOk("First list after foreign delete", await request("/wishlist", { cookie: first.cookie })).wishlist.productIds;
  requireValue(firstAfterForeignDelete.includes(product.id), "Another customer removed the first customer's wishlist item.");

  requireOk("Logout", await request("/auth/logout", { method: "POST", cookie: first.cookie }));
  const loginAgain = await request("/auth/login", { method: "POST", body: { email: first.email, password: PASSWORD } });
  requireOk("Login again", loginAgain);
  const persisted = requireOk("List after login", await request("/wishlist", { cookie: cookieFrom(loginAgain) })).wishlist.productIds;
  requireValue(persisted.includes(product.id), "Wishlist did not persist across logout/login.");

  const invalid = await request("/wishlist/items", {
    method: "POST", cookie: cookieFrom(loginAgain), body: { productId: "unknown-public-product" },
  });
  requireValue(invalid.response.status === 404, "Unknown product was accepted into Wishlist.");

  const removed = requireOk("Remove", await request(`/wishlist/items/${product.id}`, {
    method: "DELETE", cookie: cookieFrom(loginAgain),
  })).wishlist.productIds;
  requireValue(removed.length === 0, "Wishlist item was not removed.");
  const merged = requireOk("Guest merge", await request("/wishlist/merge", {
    method: "POST", cookie: cookieFrom(loginAgain), body: { productIds: [product.id, product.id] },
  })).wishlist.productIds;
  requireValue(merged.length === 1 && merged[0] === product.id, "Guest Wishlist merge did not de-duplicate.");
  const cleared = requireOk("Clear", await request("/wishlist", {
    method: "DELETE", cookie: cookieFrom(loginAgain),
  })).wishlist.productIds;
  requireValue(cleared.length === 0, "Wishlist was not cleared.");
  console.log("Wishlist smoke OK: add, duplicate guard, list, account isolation, logout/login persistence, invalid product, remove, guest merge, clear");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  try {
    await deleteUsersAndOwnedData(prisma, userIds);
    console.log(`Wishlist smoke cleanup OK (${userIds.length} generated users)`);
  } catch (error) {
    console.error(`Wishlist cleanup failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}
