import "dotenv/config";

import { prisma } from "../config/db.js";
import { deleteUsersAndOwnedData } from "../services/testDataCleanup.service.js";

const API_BASE_URL = process.env.API_BASE_URL?.trim() || "http://localhost:5001/api";
const PASSWORD = "ClinicLocationSmoke123!";
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

async function register(email, deliveryZoneId, name) {
  const result = await request("/auth/register", {
    method: "POST",
    body: {
      name,
      email,
      password: PASSWORD,
      clinicSpecialty: "General Dentistry",
      clinicLocations: [{ deliveryZoneId }],
    },
  });
  const user = requireOk(`Register ${name}`, result).user;
  userIds.push(user.id);
  const login = await request("/auth/login", { method: "POST", body: { email, password: PASSWORD } });
  requireOk(`Login ${name}`, login);
  return { user, cookie: cookieFrom(login), email };
}

try {
  const health = requireOk("Health", await request("/health"));
  requireValue(health.database?.status === "connected", "Database is not connected.");
  const zones = requireOk("Delivery zones", await request("/delivery-zones")).deliveryZones;
  requireValue(zones.length >= 2, "Two active delivery zones are required.");
  const stamp = Date.now();
  const first = await register(`clinic.location.smoke+${stamp}-a@xdental.local`, zones[0].id, "Clinic Location Smoke A");
  const second = await register(`clinic.location.smoke+${stamp}-b@xdental.local`, zones[1].id, "Clinic Location Smoke B");

  const signupLocations = requireOk("Signup locations", await request("/delivery-zones/my", { cookie: first.cookie })).clinicLocations;
  requireValue(signupLocations.length === 1 && signupLocations[0].isDefault, "Signup location was not persisted as default.");
  const signupLocationId = signupLocations[0].id;

  const created = requireOk("Create location", await request("/delivery-zones/my", {
    method: "POST",
    cookie: first.cookie,
    body: {
      deliveryZoneId: zones[1].id,
      label: "Second Clinic",
      addressLine: "22 Test Street, Second Clinic",
      governorate: "Cairo",
      cityArea: "Nasr City",
      buildingNumber: "22",
      apartmentFloor: "4",
      postalCode: "11765",
      isDefault: false,
    },
  })).clinicLocation;
  requireValue(created.id && created.label === "Second Clinic", "Created location response is incomplete.");

  const patched = requireOk("Edit/default location", await request(`/delivery-zones/my/${signupLocationId}`, {
    method: "PATCH",
    cookie: first.cookie,
    body: {
      deliveryZoneId: zones[0].id,
      label: "Main Clinic",
      addressLine: "18 Gheet Al Eda Street",
      governorate: "Cairo",
      cityArea: "Abdeen",
      buildingNumber: "18",
      apartmentFloor: "2",
      postalCode: "11613",
      isDefault: true,
    },
  })).clinicLocation;
  requireValue(patched.isDefault && patched.addressLine === "18 Gheet Al Eda Street", "Edit/default was not persisted.");

  for (const method of ["PATCH", "DELETE"]) {
    const foreign = await request(`/delivery-zones/my/${created.id}`, {
      method,
      cookie: second.cookie,
      ...(method === "PATCH" ? { body: {
        deliveryZoneId: zones[1].id,
        label: "Unauthorized",
        addressLine: "Unauthorized address",
        governorate: "Cairo",
        cityArea: "Cairo",
        buildingNumber: "1",
        apartmentFloor: "1",
      } } : {}),
    });
    requireValue(foreign.response.status === 404, `${method} disclosed or changed another user's location.`);
  }

  const profileSync = requireOk("Profile location sync", await request("/auth/me", {
    method: "PATCH",
    cookie: first.cookie,
    body: { clinicLocations: [
      { deliveryZoneId: zones[0].id, customArea: null },
      { deliveryZoneId: zones[1].id, customArea: null },
    ] },
  })).user.clinicLocations;
  requireValue(profileSync.some((item) => item.id === signupLocationId && item.addressLine === "18 Gheet Al Eda Street"), "Profile sync changed ID or address metadata.");
  requireValue(profileSync.some((item) => item.id === created.id && item.label === "Second Clinic"), "Profile sync lost the second saved location.");

  const loginAgain = await request("/auth/login", { method: "POST", body: { email: first.email, password: PASSWORD } });
  requireOk("Login reload", loginAgain);
  const reloadCookie = cookieFrom(loginAgain);
  const reloaded = requireOk("Reload locations", await request("/delivery-zones/my", { cookie: reloadCookie })).clinicLocations;
  requireValue(reloaded.length === 2 && reloaded.some((item) => item.id === created.id), "Locations did not persist across login/reload.");

  const product = await prisma.product.findFirst({
    where: { status: "ACTIVE", isAvailable: true, price: { not: null } },
    select: { id: true },
  });
  requireValue(product?.id, "An active priced product is required for checkout preview.");
  const preview = requireOk("Checkout preview", await request("/orders/preview", {
    method: "POST",
    cookie: reloadCookie,
    body: {
      deliveryMethod: "standard",
      clinicLocationId: signupLocationId,
      requestedPoints: 0,
      requestedWalletAmount: 0,
      items: [{ productId: product.id, quantity: 1 }],
    },
  }));
  requireValue(preview.totals?.pricingQuoteToken, "Checkout did not accept the owned saved location.");

  requireOk("Delete location", await request(`/delivery-zones/my/${created.id}`, { method: "DELETE", cookie: reloadCookie }));
  const afterDelete = requireOk("Reload after delete", await request("/delivery-zones/my", { cookie: reloadCookie })).clinicLocations;
  requireValue(afterDelete.length === 1 && afterDelete[0].id === signupLocationId && afterDelete[0].isDefault, "Delete/default invariant failed.");

  console.log("Clinic Locations smoke OK: signup, CRUD, ownership, Profile sync, login reload, Checkout, delete/default");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  try {
    await deleteUsersAndOwnedData(prisma, userIds);
    console.log(`Clinic Locations smoke cleanup OK (${userIds.length} generated users)`);
  } catch (error) {
    console.error(`Clinic Locations cleanup failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}
