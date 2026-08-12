import test from "node:test";
import assert from "node:assert/strict";
import { requirePermission } from "./permission.middleware.js";
import { PERMISSION_KEYS, PERMISSION_PRESETS } from "../services/permission.service.js";

function invoke(user, requiredPermission) {
  const result = { status: null, body: null, next: false };
  const response = {
    status(code) { result.status = code; return this; },
    json(body) { result.body = body; return body; },
  };
  requirePermission(requiredPermission)({ user }, response, () => { result.next = true; });
  return result;
}

test("admin bypasses granular permission checks", () => {
  assert.equal(invoke({ role: "admin", permissions: [] }, "ORDERS_UPDATE_STATUS").next, true);
});

test("support viewer can view orders but cannot update them", () => {
  const user = { role: "support", permissions: PERMISSION_PRESETS.SUPPORT_VIEWER };
  assert.equal(invoke(user, "ORDERS_VIEW").next, true);
  assert.equal(invoke(user, "ORDERS_UPDATE_STATUS").status, 403);
});

test("support agent can reply where explicitly granted", () => {
  const user = { role: "support", permissions: PERMISSION_PRESETS.SUPPORT_AGENT };
  assert.equal(invoke(user, "SUPPORT_INBOX_REPLY").next, true);
});

test("support accounts cannot view or process sensitive account requests unless explicitly granted", () => {
  const ordinarySupport = {
    role: "support",
    permissions: PERMISSION_PRESETS.SUPPORT_AGENT,
  };
  assert.equal(
    invoke(ordinarySupport, "ACCOUNT_REQUESTS_VIEW").status,
    403
  );
  assert.equal(
    invoke(ordinarySupport, "ACCOUNT_REQUESTS_MANAGE").status,
    403
  );

  const explicitlyGranted = {
    role: "support",
    permissions: ["ACCOUNT_REQUESTS_VIEW", "ACCOUNT_REQUESTS_MANAGE"],
  };
  assert.equal(
    invoke(explicitlyGranted, "ACCOUNT_REQUESTS_VIEW").next,
    true
  );
  assert.equal(
    invoke(explicitlyGranted, "ACCOUNT_REQUESTS_MANAGE").next,
    true
  );
});

test("missing permission produces a 403 with the stable required key", () => {
  const result = invoke({ role: "support", permissions: [] }, "USERS_VIEW");
  assert.equal(result.status, 403);
  assert.equal(result.body.requiredPermission, "USERS_VIEW");
});

test("permission seed keys are unique and presets only contain supported keys", () => {
  assert.equal(new Set(PERMISSION_KEYS).size, PERMISSION_KEYS.length);
  for (const keys of Object.values(PERMISSION_PRESETS)) {
    assert.equal(keys.every((key) => PERMISSION_KEYS.includes(key)), true);
  }
});
