import assert from "node:assert/strict";
import test from "node:test";
import { notifyStaff } from "./notification.service.js";

test("account-request staff notifications target admins and only permitted support users", async () => {
  let staffQuery;
  let createdRows;
  let createManyOptions;
  const database = {
    user: {
      findMany: async (input) => {
        staffQuery = input;
        return [
          { id: "admin-a" },
          { id: "support-permitted" },
          { id: "support-permitted" },
        ];
      },
    },
    notification: {
      findMany: async () => [],
      createMany: async (input) => {
        createManyOptions = input;
        const { data } = input;
        createdRows = data;
        return { count: data.length };
      },
    },
  };

  const recipients = await notifyStaff(
    {
      permissionKey: "ACCOUNT_REQUESTS_VIEW",
      dedupeKey: "account-action:request-a:SUBMITTED",
      type: "ACCOUNT",
      title: "New account request",
      body: "A safe staff summary.",
      link: "/admin/account-requests?request=request-a",
      metadata: { requestId: "request-a" },
    },
    database
  );

  assert.deepEqual(staffQuery.where, {
    OR: [
      { role: "ADMIN" },
      {
        role: "SUPPORT",
        permissions: {
          some: { permission: { key: "ACCOUNT_REQUESTS_VIEW" } },
        },
      },
    ],
  });
  assert.deepEqual(recipients, ["admin-a", "support-permitted"]);
  assert.deepEqual(
    createdRows.map(({ userId }) => userId),
    ["admin-a", "support-permitted"]
  );
  assert.equal(
    createdRows[0].metadata.dedupeKey,
    "account-action:request-a:SUBMITTED"
  );
  assert.equal(createManyOptions.skipDuplicates, true);
  assert.match(createdRows[0].id, /^staff_[a-f0-9]{48}$/);
  assert.notEqual(createdRows[0].id, createdRows[1].id);
});

test("staff notification dedupe skips recipients that already received the event", async () => {
  let dedupeQuery;
  let createdRows;
  let createManyOptions;
  const database = {
    user: {
      findMany: async () => [{ id: "admin-a" }, { id: "support-a" }],
    },
    notification: {
      findMany: async (input) => {
        dedupeQuery = input;
        return [{ userId: "admin-a" }];
      },
      createMany: async (input) => {
        createManyOptions = input;
        const { data } = input;
        createdRows = data;
        return { count: data.length };
      },
    },
  };

  const recipients = await notifyStaff(
    {
      permissionKey: "ACCOUNT_REQUESTS_VIEW",
      dedupeKey: "account-action:request-a:CANCELED",
      type: "ACCOUNT",
      title: "Account request canceled",
      body: "A safe cancellation summary.",
    },
    database
  );

  assert.deepEqual(dedupeQuery.where.userId.in, ["admin-a", "support-a"]);
  assert.deepEqual(dedupeQuery.where.metadata, {
    path: ["dedupeKey"],
    equals: "account-action:request-a:CANCELED",
  });
  assert.deepEqual(recipients, ["support-a"]);
  assert.deepEqual(createdRows.map(({ userId }) => userId), ["support-a"]);
  assert.equal(createManyOptions.skipDuplicates, true);
});

test("existing staff notification callers retain the admin and support recipient rule", async () => {
  let staffWhere;
  const database = {
    user: {
      findMany: async ({ where }) => {
        staffWhere = where;
        return [];
      },
    },
  };

  const recipients = await notifyStaff(
    {
      type: "SUPPORT",
      title: "Support update",
      body: "A support event.",
    },
    database
  );

  assert.deepEqual(staffWhere, { role: { in: ["ADMIN", "SUPPORT"] } });
  assert.deepEqual(recipients, []);
});
