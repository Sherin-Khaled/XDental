import assert from "node:assert/strict";
import test from "node:test";
import {
  replaceUserClinicLocations,
  validateClinicLocationInput,
  validateSavedClinicLocationInput,
} from "./deliveryOffer.service.js";

const zone = (id, slug = id) => ({ id, slug, isActive: true });

function validationDatabase(zones) {
  return {
    deliveryZone: {
      findMany: async ({ where }) => zones.filter((item) => where.id.in.includes(item.id) && item.isActive),
    },
  };
}

test("signup/Profile location validation remains compatible with zone-only records", async () => {
  const database = validationDatabase([zone("cairo")]);
  const result = await validateClinicLocationInput(
    [{ deliveryZoneId: "cairo", customArea: null }],
    { database }
  );
  assert.deepEqual(result, { value: [{ deliveryZoneId: "cairo", customArea: null }] });
});

test("saved-location CRUD requires complete reusable checkout details", async () => {
  const database = validationDatabase([zone("cairo")]);
  const missing = await validateSavedClinicLocationInput(
    { deliveryZoneId: "cairo", label: "Main Clinic", addressLine: "18 Street" },
    { database }
  );
  assert.equal(missing.error?.field, "addressLine");

  const complete = await validateSavedClinicLocationInput(
    {
      deliveryZoneId: "cairo",
      label: "Main Clinic",
      addressLine: "18 Gheet Al Eda Street",
      governorate: "Cairo",
      cityArea: "Abdeen",
      buildingNumber: "18",
      apartmentFloor: "2",
      postalCode: "11613",
      isDefault: true,
    },
    { database }
  );
  assert.equal(complete.error, undefined);
  assert.equal(complete.value.isDefault, true);
});

test("Profile zone synchronization preserves stable IDs and saved address metadata", async () => {
  const rows = [{
    id: "location-1",
    userId: "user-1",
    deliveryZoneId: "cairo",
    customArea: null,
    label: "Main Clinic",
    addressLine: "18 Gheet Al Eda Street",
    governorate: "Cairo",
    cityArea: "Abdeen",
    buildingNumber: "18",
    apartmentFloor: "2",
    postalCode: null,
    isDefault: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
  }];
  const database = {
    userClinicLocation: {
      findMany: async () => rows.map((row) => ({ ...row })),
      deleteMany: async ({ where }) => {
        const keep = new Set(where.deliveryZoneId.notIn);
        for (let index = rows.length - 1; index >= 0; index -= 1) {
          if (!keep.has(rows[index].deliveryZoneId)) rows.splice(index, 1);
        }
      },
      updateMany: async () => ({ count: 0 }),
      update: async ({ where, data }) => {
        const row = rows.find((item) => item.id === where.id);
        Object.assign(row, data);
        return row;
      },
      create: async ({ data }) => rows.push({ id: `location-${rows.length + 1}`, createdAt: new Date(), ...data }),
      count: async ({ where }) => rows.filter((row) => row.userId === where.userId && (!where.isDefault || row.isDefault)).length,
      findFirst: async () => rows[0] ?? null,
    },
  };

  await replaceUserClinicLocations(database, "user-1", [{ deliveryZoneId: "cairo", customArea: null }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "location-1");
  assert.equal(rows[0].label, "Main Clinic");
  assert.equal(rows[0].addressLine, "18 Gheet Al Eda Street");
  assert.equal(rows[0].isDefault, true);
});

test("multiple requested defaults normalize to one canonical default", async () => {
  const updates = [];
  const existing = [
    { id: "one", userId: "user-1", deliveryZoneId: "cairo", isDefault: true, createdAt: new Date(1) },
    { id: "two", userId: "user-1", deliveryZoneId: "giza", isDefault: false, createdAt: new Date(2) },
  ];
  const database = {
    userClinicLocation: {
      findMany: async () => existing,
      deleteMany: async () => ({}),
      updateMany: async ({ data }) => { if (data.isDefault === false) existing.forEach((row) => { row.isDefault = false; }); },
      update: async ({ where, data }) => { const row = existing.find((item) => item.id === where.id); Object.assign(row, data); updates.push({ id: where.id, ...data }); return row; },
      create: async () => { throw new Error("unexpected create"); },
      count: async () => existing.filter((row) => row.isDefault).length,
      findFirst: async () => existing[0],
    },
  };
  await replaceUserClinicLocations(database, "user-1", [
    { deliveryZoneId: "cairo", customArea: null, isDefault: true },
    { deliveryZoneId: "giza", customArea: null, isDefault: true },
  ]);
  assert.equal(existing.filter((row) => row.isDefault).length, 1);
  assert.equal(existing[0].isDefault, true);
  assert.ok(updates.length >= 2);
});
