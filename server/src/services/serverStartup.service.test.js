import assert from "node:assert/strict";
import test from "node:test";
import {
  getClientOrigins,
  readServerConfiguration,
} from "../config/server.js";
import {
  BackendStartupError,
  startBackend,
} from "../serverRuntime.js";

function developmentEnvironment(overrides = {}) {
  return {
    NODE_ENV: "development",
    DATABASE_URL: "postgresql://user:password@localhost:5432/xdental_store",
    JWT_SECRET: "development-test-secret-that-is-long-enough",
    ...overrides,
  };
}

function productionEnvironment(overrides = {}) {
  return {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://user:password@database.test:5432/xdental_store",
    JWT_SECRET: "production-test-secret-that-is-long-enough",
    CLIENT_URL: "https://shop.example.com",
    ...overrides,
  };
}

function runtimeDependencies(events, overrides = {}) {
  return {
    environment: developmentEnvironment(),
    connect: async () => {
      events.push("connect");
    },
    disconnect: async () => {
      events.push("disconnect");
    },
    buildApp: () => {
      events.push("build-app");
      return {};
    },
    listen: async (_app, port) => {
      events.push(`listen:${port}`);
      return { listening: true };
    },
    validateMail: () => ({ enabled: false }),
    validatePush: () => ({ enabled: false }),
    validateUploadStorage: () => ({ driver: "local" }),
    logger: { log() {} },
    ...overrides,
  };
}

test("development keeps the existing localhost client origins and port", () => {
  const configuration = readServerConfiguration(developmentEnvironment());

  assert.equal(configuration.production, false);
  assert.equal(configuration.port, 5000);
  assert.deepEqual(configuration.clientOrigins, [
    "http://localhost:5173",
    "http://localhost:5174",
  ]);
});

test("production requires an explicit trusted frontend origin", () => {
  assert.throws(
    () =>
      readServerConfiguration(
        productionEnvironment({ CLIENT_URL: "" })
      ),
    /CLIENT_URL is required in production/
  );
});

test("production rejects malformed, non-HTTPS, localhost, and path-based origins", () => {
  for (const clientUrl of [
    "malformed text",
    "http://shop.example.com",
    "https://localhost:5173",
    "https://127.0.0.1:5173",
    "https://shop.example.com/store",
  ]) {
    assert.throws(
      () =>
        readServerConfiguration(
          productionEnvironment({ CLIENT_URL: clientUrl })
        ),
      /CLIENT_URL/
    );
  }
});

test("valid production origins are normalized and deduplicated", () => {
  const origins = getClientOrigins(
    productionEnvironment({
      CLIENT_URL:
        "https://shop.example.com/, https://admin.example.com, https://shop.example.com",
    })
  );

  assert.deepEqual(origins, [
    "https://shop.example.com",
    "https://admin.example.com",
  ]);
});

test("critical core configuration fails clearly", () => {
  assert.throws(
    () =>
      readServerConfiguration(
        developmentEnvironment({ NODE_ENV: "" })
      ),
    /NODE_ENV must be explicitly set/
  );
  assert.throws(
    () =>
      readServerConfiguration(
        developmentEnvironment({ DATABASE_URL: "" })
      ),
    /DATABASE_URL is required/
  );
  assert.throws(
    () =>
      readServerConfiguration(
        developmentEnvironment({ JWT_SECRET: "too-short" })
      ),
    /JWT_SECRET must contain at least 32/
  );
  assert.throws(
    () =>
      readServerConfiguration(
        developmentEnvironment({ PORT: "not-a-port" })
      ),
    /PORT must be a whole number/
  );
  assert.throws(
    () =>
      readServerConfiguration(
        productionEnvironment({ COOKIE_SAME_SITE: "invalid" })
      ),
    /COOKIE_SAME_SITE must be lax, strict, or none/
  );
});

test("the backend connects to PostgreSQL before building or listening", async () => {
  const events = [];
  await startBackend(runtimeDependencies(events));

  assert.deepEqual(events, ["connect", "build-app", "listen:5000"]);
});

test("a database failure leaves the HTTP port closed and returns a safe error", async () => {
  const events = [];
  const dependencies = runtimeDependencies(events, {
    connect: async () => {
      events.push("connect");
      throw new Error(
        "secret database details that must never reach the startup message"
      );
    },
  });

  await assert.rejects(
    startBackend(dependencies),
    (error) => {
      assert.ok(error instanceof BackendStartupError);
      assert.match(error.message, /PostgreSQL connection failed/);
      assert.doesNotMatch(error.message, /secret database details/);
      return true;
    }
  );
  assert.deepEqual(events, ["connect", "disconnect"]);
});

test("a listener failure disconnects Prisma and fails clearly", async () => {
  const events = [];
  const dependencies = runtimeDependencies(events, {
    listen: async () => {
      events.push("listen");
      throw new BackendStartupError("Configured port is unavailable.");
    },
  });

  await assert.rejects(
    startBackend(dependencies),
    /Configured port is unavailable/
  );
  assert.deepEqual(events, [
    "connect",
    "build-app",
    "listen",
    "disconnect",
  ]);
});
