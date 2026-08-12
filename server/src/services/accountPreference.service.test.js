import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_ACCOUNT_PREFERENCES,
  getAccountPreferences,
  PreferenceValidationError,
  updateAccountPreferences,
  validatePreferencePatch,
} from "./accountPreference.service.js";

test("preferences return conservative defaults without creating a record", async () => {
  let createCalled = false;
  const database = {
    accountPreference: {
      findUnique: async ({ where }) => {
        assert.deepEqual(where, { userId: "customer-a" });
        return null;
      },
      create: async () => {
        createCalled = true;
      },
    },
  };

  const result = await getAccountPreferences("customer-a", database);
  assert.equal(result.persisted, false);
  assert.deepEqual(result.preferences, DEFAULT_ACCOUNT_PREFERENCES);
  assert.equal(createCalled, false);
});

test("preference patches reject unknown fields and unsupported regional values", () => {
  assert.throws(
    () => validatePreferencePatch({ userId: "customer-b" }),
    PreferenceValidationError
  );
  assert.throws(
    () => validatePreferencePatch({ currency: "USD" }),
    /Only EGP/
  );
  assert.throws(
    () => validatePreferencePatch({ country: "France" }),
    /Only Egypt/
  );
});

test("preference update is scoped to the authenticated user and changes supplied fields only", async () => {
  let operation;
  const database = {
    accountPreference: {
      upsert: async (input) => {
        operation = input;
        return {
          ...DEFAULT_ACCOUNT_PREFERENCES,
          ...input.update,
          language: "EN",
          country: "EGYPT",
          currency: "EGP",
        };
      },
    },
  };

  const result = await updateAccountPreferences(
    {
      userId: "customer-a",
      patch: { orderUpdates: false },
    },
    database
  );

  assert.deepEqual(operation.where, { userId: "customer-a" });
  assert.deepEqual(operation.update, { orderUpdates: false });
  assert.equal(operation.create.userId, "customer-a");
  assert.equal(result.orderUpdates, false);
  assert.equal(result.quoteUpdates, true);
});

test("marketing preferences require explicit opt-in and synchronize newsletter consent", async () => {
  let subscriberOperation;
  const database = {
    accountPreference: {
      upsert: async ({ create }) => ({
        ...create,
        language: "EN",
        country: "EGYPT",
        currency: "EGP",
      }),
    },
    newsletterSubscriber: {
      findUnique: async () => null,
      upsert: async (input) => {
        subscriberOperation = input;
        return {};
      },
    },
  };

  await updateAccountPreferences(
    {
      userId: "customer-a",
      email: "customer@example.test",
      patch: { weeklyOffers: true },
    },
    database
  );

  assert.equal(subscriberOperation.create.status, "SUBSCRIBED");
  assert.equal(subscriberOperation.create.source, "account_preferences");
  assert.equal(subscriberOperation.create.email, "customer@example.test");
});
