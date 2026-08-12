import assert from "node:assert/strict";
import test from "node:test";
import {
  getPublicPushConfiguration,
  readPushConfiguration,
} from "../config/push.js";
import { getPushConfiguration } from "../controllers/notification.controller.js";
import {
  normalizePushSubscription,
  removePushSubscription,
  savePushSubscription,
} from "./pushSubscription.service.js";
import {
  createPushPayload,
  sendPushNotificationToUser,
} from "./pushNotification.service.js";
import { deliverNotificationPush } from "./notification.service.js";

function key(byteLength, firstByte) {
  const bytes = Buffer.alloc(byteLength, 7);
  if (firstByte !== undefined) bytes[0] = firstByte;
  return bytes.toString("base64url");
}

function browserSubscription(overrides = {}) {
  return {
    endpoint: "https://push.example.test/subscriptions/device-1?token=safe",
    keys: {
      p256dh: key(65, 4),
      auth: key(16),
    },
    ...overrides,
  };
}

function enabledConfiguration() {
  return {
    enabled: true,
    subject: "mailto:notifications@example.com",
    publicKey: key(65, 4),
    privateKey: key(32),
  };
}

test("browser push defaults to disabled without exposing or requiring keys", () => {
  assert.deepEqual(readPushConfiguration({}), {
    enabled: false,
    subject: null,
    publicKey: null,
    privateKey: null,
  });
});

test("enabled browser push requires a contact subject and valid VAPID keys", () => {
  assert.throws(
    () => readPushConfiguration({ WEB_PUSH_ENABLED: "true" }),
    /WEB_PUSH_VAPID_SUBJECT/
  );

  const configuration = readPushConfiguration({
    WEB_PUSH_ENABLED: "true",
    WEB_PUSH_VAPID_SUBJECT: "mailto:notifications@example.com",
    WEB_PUSH_VAPID_PUBLIC_KEY: key(65, 4),
    WEB_PUSH_VAPID_PRIVATE_KEY: key(32),
  });
  assert.equal(configuration.enabled, true);
  assert.equal(configuration.publicKey, key(65, 4));
  const publicConfiguration = getPublicPushConfiguration(configuration);
  assert.deepEqual(publicConfiguration, {
    enabled: true,
    publicKey: key(65, 4),
  });
  assert.equal("privateKey" in publicConfiguration, false);
});

test("push configuration endpoint rejects non-customer accounts before reading configuration", () => {
  const response = {
    statusCode: 200,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return body;
    },
  };

  getPushConfiguration({ user: { role: "admin" } }, response);
  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.body, { message: "Customer account required." });
});

test("subscription validation rejects insecure endpoints and malformed encryption keys", () => {
  assert.throws(
    () => normalizePushSubscription(browserSubscription({ endpoint: "http://push.example.test/device" })),
    /endpoint is invalid/
  );
  assert.throws(
    () =>
      normalizePushSubscription(
        browserSubscription({ keys: { p256dh: "bad", auth: key(16) } })
      ),
    /p256dh key is invalid/
  );
});

test("saving a subscription upserts one browser endpoint for the authenticated user", async () => {
  let operation;
  const database = {
    pushSubscription: {
      upsert: async (input) => {
        operation = input;
        return { id: "subscription-1" };
      },
    },
  };

  await savePushSubscription(
    { userId: "customer-2", subscription: browserSubscription() },
    database
  );

  assert.equal(operation.create.userId, "customer-2");
  assert.equal(operation.update.userId, "customer-2");
  assert.equal(operation.where.endpointHash, operation.create.endpointHash);
  assert.equal("endpointHash" in operation.update, false);
});

test("removing a subscription is always scoped to its authenticated user", async () => {
  let operation;
  const database = {
    pushSubscription: {
      deleteMany: async (input) => {
        operation = input;
        return { count: 1 };
      },
    },
  };

  await removePushSubscription(
    {
      userId: "customer-1",
      endpoint: browserSubscription().endpoint,
    },
    database
  );

  assert.equal(operation.where.userId, "customer-1");
  assert.equal(typeof operation.where.endpointHash, "string");
  assert.equal(operation.where.endpointHash.length, 64);
});

test("push payloads discard external links and limit lock-screen text", () => {
  const payload = JSON.parse(
    createPushPayload({
      title: "T".repeat(200),
      body: "B".repeat(400),
      link: "https://malicious.example/path",
    })
  );
  assert.equal(payload.title.length, 120);
  assert.equal(payload.body.length, 240);
  assert.equal(payload.link, "/");
});

test("push delivery removes expired endpoints without failing other devices", async () => {
  let removedWhere;
  const database = {
    pushSubscription: {
      findMany: async () => [
        { id: "active", endpoint: "https://push.example.test/active", p256dh: key(65, 4), auth: key(16) },
        { id: "expired", endpoint: "https://push.example.test/expired", p256dh: key(65, 4), auth: key(16) },
      ],
      deleteMany: async ({ where }) => {
        removedWhere = where;
        return { count: 1 };
      },
    },
  };

  const result = await sendPushNotificationToUser(
    {
      userId: "customer-1",
      title: "Order status updated",
      body: "Your order has a new status.",
      link: "/account/orders/order-1",
    },
    {
      database,
      configuration: enabledConfiguration(),
      sendNotification: async ({ endpoint }) => {
        if (endpoint.endsWith("/expired")) {
          const error = new Error("Expired");
          error.statusCode = 410;
          throw error;
        }
      },
    }
  );

  assert.deepEqual(result, {
    enabled: true,
    sentCount: 1,
    failedCount: 1,
    removedCount: 1,
  });
  assert.equal(removedWhere.userId, "customer-1");
  assert.deepEqual(removedWhere.id.in, ["expired"]);
});

test("post-commit push delivery cannot fail the completed database action", async () => {
  const result = await deliverNotificationPush(
    {
      id: "notification-1",
      userId: "customer-1",
      title: "Order updated",
      body: "Your order is confirmed.",
      link: "/account/orders/order-1",
    },
    async () => {
      throw new Error("Push provider unavailable");
    }
  );

  assert.deepEqual(result, {
    enabled: true,
    sentCount: 0,
    failedCount: 1,
    removedCount: 0,
  });
});
