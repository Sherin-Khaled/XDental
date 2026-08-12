import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEVELOPMENT_API_BASE_URL,
  resolveApiBaseUrl,
} from "./apiBaseUrl.ts";

test("development without VITE_API_URL uses the existing localhost fallback", () => {
  assert.equal(resolveApiBaseUrl(undefined, true), DEVELOPMENT_API_BASE_URL);
  assert.equal(resolveApiBaseUrl("   ", true), DEVELOPMENT_API_BASE_URL);
});

test("development accepts the existing Vite proxy API path", () => {
  assert.equal(resolveApiBaseUrl("/api", true), "/api");
  assert.equal(resolveApiBaseUrl(" /api/// ", true), "/api");
});

test("production without VITE_API_URL fails clearly", () => {
  assert.throws(
    () => resolveApiBaseUrl(undefined, false),
    /VITE_API_URL is required for production builds/
  );
});

test("production rejects localhost and loopback API URLs", () => {
  for (const value of [
    "http://localhost:5000/api",
    "https://localhost/api",
    "http://127.0.0.1:5000/api",
    "https://127.0.0.2/api",
  ]) {
    assert.throws(() => resolveApiBaseUrl(value, false), /VITE_API_URL/);
  }
});

test("production rejects malformed and non-HTTPS API URLs", () => {
  assert.throws(
    () => resolveApiBaseUrl("not a URL", false),
    /must be a valid absolute URL/
  );
  assert.throws(
    () => resolveApiBaseUrl("http://api.example.com/api", false),
    /must use HTTPS in production/
  );
});

test("production accepts HTTPS and removes trailing slashes", () => {
  assert.equal(
    resolveApiBaseUrl("  https://api.example.com/api///  ", false),
    "https://api.example.com/api"
  );
});

test("both frontend clients share API_BASE_URL and preserve cookie credentials", async () => {
  const [httpSource, authSource] = await Promise.all([
    readFile(new URL("./http.ts", import.meta.url), "utf8"),
    readFile(new URL("./auth.ts", import.meta.url), "utf8"),
  ]);

  for (const source of [httpSource, authSource]) {
    assert.match(source, /import \{ API_BASE_URL \} from "\.\/apiConfig";/);
    assert.match(source, /credentials: "include"/);
    assert.doesNotMatch(source, /localhost:5000\/api/);
  }
});
