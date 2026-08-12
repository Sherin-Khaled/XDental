import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createAuthSession,
  legacySessionIsAllowed,
  listActiveAuthSessions,
  resolveTrackedSession,
  revokeAuthSession,
  revokeOtherAuthSessions,
  summarizeUserAgent,
} from "./authSession.service.js";

test("login session creation stores a secure identifier and sanitized device summary", async () => {
  let created;
  const now = new Date("2026-07-30T10:00:00.000Z");
  const database = {
    authSession: {
      create: async ({ data }) => {
        created = data;
        return data;
      },
    },
  };
  const request = {
    get: () => "Mozilla/5.0 (Windows NT 10.0) Chrome/140.0",
    ip: "192.0.2.15",
  };

  await createAuthSession(
    {
      userId: "customer-a",
      request,
      now,
      environment: { JWT_SECRET: "test-secret" },
    },
    database
  );

  assert.equal(created.userId, "customer-a");
  assert.ok(created.id.length >= 40);
  assert.equal(created.deviceSummary, "Chrome on Windows");
  assert.equal(created.ipAddressHash.length, 64);
  assert.notEqual(created.ipAddressHash, request.ip);
  assert.equal(created.expiresAt.toISOString(), "2026-08-06T10:00:00.000Z");
});

test("session listing identifies only the current user's current session", async () => {
  const database = {
    authSession: {
      findMany: async ({ where }) => {
        assert.equal(where.userId, "customer-a");
        return [
          {
            id: "session-current",
            deviceSummary: "Chrome on Windows",
            createdAt: new Date(),
            lastSeenAt: new Date(),
            expiresAt: new Date(Date.now() + 1000),
          },
          {
            id: "session-other",
            deviceSummary: "Safari on iPhone or iPad",
            createdAt: new Date(),
            lastSeenAt: new Date(),
            expiresAt: new Date(Date.now() + 1000),
          },
        ];
      },
    },
  };

  const sessions = await listActiveAuthSessions(
    {
      userId: "customer-a",
      currentSessionId: "session-current",
    },
    database
  );
  assert.equal(sessions[0].isCurrent, true);
  assert.equal(sessions[1].isCurrent, false);
});

test("single-session revocation and logout-others are always account scoped", async () => {
  const operations = [];
  const database = {
    authSession: {
      updateMany: async (input) => {
        operations.push(input);
        return { count: 1 };
      },
    },
  };

  await revokeAuthSession(
    { userId: "customer-a", sessionId: "session-other" },
    database
  );
  await revokeOtherAuthSessions(
    { userId: "customer-a", currentSessionId: "session-current" },
    database
  );

  assert.equal(operations[0].where.userId, "customer-a");
  assert.equal(operations[0].where.id, "session-other");
  assert.equal(operations[1].where.userId, "customer-a");
  assert.deepEqual(operations[1].where.id, { not: "session-current" });
});

test("revoked or expired tracked sessions are rejected immediately", async () => {
  const database = {
    authSession: {
      findFirst: async ({ where }) => {
        assert.equal(where.revokedAt, null);
        assert.ok(where.expiresAt.gt instanceof Date);
        return null;
      },
    },
  };
  const resolved = await resolveTrackedSession(
    {
      payload: { sub: "customer-a", sid: "revoked-session" },
      environment: { NODE_ENV: "production" },
    },
    database
  );
  assert.equal(resolved, null);
});

test("legacy JWT compatibility is development-only", async () => {
  assert.equal(legacySessionIsAllowed({ NODE_ENV: "development" }), true);
  assert.equal(legacySessionIsAllowed({ NODE_ENV: "production" }), false);
  assert.equal(
    await resolveTrackedSession(
      {
        payload: { sub: "customer-a" },
        environment: { NODE_ENV: "production" },
      },
      {}
    ),
    null
  );
});

test("auth controller creates tracked login sessions and revokes others after password change", async () => {
  const source = await readFile(
    new URL("../controllers/auth.controller.js", import.meta.url),
    "utf8"
  );
  assert.match(source, /createAuthSession\(\{ userId: user\.id, request \}\)/);
  assert.match(source, /reason: "PASSWORD_CHANGED"/);
  assert.match(source, /currentSessionId: currentSession\.id/);
});

test("user-agent summaries never expose the raw user-agent string", () => {
  const raw = "Mozilla/5.0 (Linux; Android 14) Chrome/140.0 secret-extension";
  assert.equal(summarizeUserAgent(raw), "Chrome on Android");
});
