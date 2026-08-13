import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Clinic Locations and Address Book use one persisted manager", async () => {
  const [sidebar, searchIndex, clinicPage, addressPage, manager] = await Promise.all([
    source("../components/dental/AccountSidebar.tsx"),
    source("./searchIndex.ts"),
    source("../pages/account-clinic-branches.tsx"),
    source("../pages/account-address.tsx"),
    source("../components/dental/SavedClinicLocationsManager.tsx"),
  ]);

  assert.match(sidebar, /href: "\/account\/clinic-branches"/);
  assert.match(searchIndex, /href: "\/account\/clinic-branches"/);
  assert.match(clinicPage, /<SavedClinicLocationsManager \/>/);
  assert.match(addressPage, /<SavedClinicLocationsManager addressBook \/>/);
  assert.doesNotMatch(clinicPage + addressPage, /Redirect|coming soon/i);
  assert.match(manager, /getMyClinicLocations/);
  assert.match(manager, /createMyClinicLocation/);
  assert.match(manager, /updateMyClinicLocation/);
  assert.match(manager, /deleteMyClinicLocation/);
  for (const field of ["label", "addressLine", "governorate", "cityArea", "buildingNumber", "apartmentFloor", "postalCode", "isDefault"]) {
    assert.match(manager, new RegExp(`form\\.${field}`));
  }
});

test("signup, Profile, CRUD routes, and Checkout share UserClinicLocation", async () => {
  const [profile, authController, deliveryRoutes, deliveryController, checkout] = await Promise.all([
    source("../pages/account.tsx"),
    source("../../server/src/controllers/auth.controller.js"),
    source("../../server/src/routes/delivery.routes.js"),
    source("../../server/src/controllers/delivery.controller.js"),
    source("../pages/checkout.tsx"),
  ]);

  assert.match(profile, /<DeliveryZoneMultiSelect/);
  assert.match(profile, /id="clinic-locations"/);
  assert.match(profile, /clinicLocations: draftProfile\.clinicLocations\.map/);
  assert.match(authController, /clinicLocations:\s*\{\s*create:/);
  assert.match(deliveryRoutes, /router\.get\("\/delivery-zones\/my"/);
  assert.match(deliveryRoutes, /router\.put\("\/delivery-zones\/my"/);
  assert.match(deliveryRoutes, /router\.post\("\/delivery-zones\/my"/);
  assert.match(deliveryRoutes, /router\.patch\("\/delivery-zones\/my\/:locationId"/);
  assert.match(deliveryRoutes, /router\.delete\("\/delivery-zones\/my\/:locationId"/);
  assert.match(deliveryController, /userId: request\.user\.id/);
  assert.match(checkout, /selectSavedClinicLocation/);
  assert.match(checkout, /location\.addressLine/);
  assert.match(checkout, /location\.buildingNumber/);
  assert.match(checkout, /location\.apartmentFloor/);
  assert.match(checkout, /location\.isDefault/);
  assert.match(checkout, /clinicLocationId: selectedClinicLocationId \|\| null/);
});

test("saved-location model migration is additive and preserves existing rows", async () => {
  const [schema, migration, service] = await Promise.all([
    source("../../server/prisma/schema.prisma"),
    source("../../server/prisma/migrations/20260813173000_extend_saved_clinic_locations/migration.sql"),
    source("../../server/src/services/deliveryOffer.service.js"),
  ]);

  assert.match(schema, /model UserClinicLocation[\s\S]*addressLine\s+String\?/);
  assert.match(schema, /model UserClinicLocation[\s\S]*isDefault\s+Boolean\s+@default\(false\)/);
  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM/);
  assert.match(migration, /ADD COLUMN "addressLine" TEXT/);
  assert.match(service, /const current = existing\.find/);
  assert.match(service, /where: \{ id: current\.id \}/);
});
