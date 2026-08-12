import assert from "node:assert/strict";
import test from "node:test";
import { createNotification } from "./notification.service.js";

function databaseWithPreference(preference) {
  let created = 0;
  return {
    database: {
      user: {
        findUnique: async () => ({
          role: "CUSTOMER",
          accountPreference: preference,
        }),
      },
      notification: {
        create: async ({ data }) => {
          created += 1;
          return { id: "notification-1", ...data };
        },
      },
    },
    created: () => created,
  };
}

test("optional customer notifications respect disabled preference categories", async () => {
  const fixture = databaseWithPreference({ orderUpdates: false });
  const result = await createNotification(
    {
      userId: "customer-a",
      type: "ORDER_UPDATE",
      title: "Order updated",
      body: "Your order changed.",
    },
    fixture.database
  );
  assert.equal(result, null);
  assert.equal(fixture.created(), 0);
});

test("optional customer notifications are created when the category is enabled", async () => {
  const fixture = databaseWithPreference({ supportReplyUpdates: true });
  const result = await createNotification(
    {
      userId: "customer-a",
      type: "SUPPORT_MESSAGE",
      title: "Support replied",
      body: "There is a new reply.",
    },
    fixture.database
  );
  assert.equal(result.id, "notification-1");
  assert.equal(fixture.created(), 1);
});

test("mandatory account-security notifications cannot be suppressed", async () => {
  let userLookup = 0;
  let created = 0;
  const database = {
    user: {
      findUnique: async () => {
        userLookup += 1;
        return null;
      },
    },
    notification: {
      create: async ({ data }) => {
        created += 1;
        return data;
      },
    },
  };

  await createNotification(
    {
      userId: "customer-a",
      type: "ACCOUNT",
      title: "Password changed",
      body: "Your password changed.",
      mandatory: true,
    },
    database
  );
  assert.equal(userLookup, 0);
  assert.equal(created, 1);
});
