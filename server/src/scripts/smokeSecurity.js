import { once } from "node:events";

process.env.NODE_ENV = "test";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.RATE_LIMIT_LOGIN_MAX = "3";

const { createApp } = await import("../app.js");
const { getAuthCookieOptions } = await import("../utils/createToken.js");

function requireValue(value, message) {
  if (!value) throw new Error(message);
}

const server = createApp().listen(0, "127.0.0.1");

try {
  process.env.NODE_ENV = "production";
  process.env.COOKIE_SAME_SITE = "";
  const productionCookie = getAuthCookieOptions();
  requireValue(
    productionCookie.httpOnly && productionCookie.secure && productionCookie.sameSite === "lax",
    "Production auth cookie defaults are not secure."
  );
  process.env.NODE_ENV = "test";

  await once(server, "listening");
  const address = server.address();
  requireValue(address && typeof address === "object", "Security smoke server did not start.");
  const apiUrl = `http://127.0.0.1:${address.port}/api`;

  const privateResponse = await fetch(`${apiUrl}/auth/me`, {
    headers: { Origin: "http://localhost:5173" },
  });
  requireValue(
    privateResponse.headers.get("access-control-allow-origin") === "http://localhost:5173" &&
      privateResponse.headers.get("access-control-allow-credentials") === "true",
    "Trusted CLIENT_URL CORS credentials were not enabled."
  );
  requireValue(
    privateResponse.headers.get("cache-control")?.includes("no-store"),
    "Private auth response did not include a no-store policy."
  );
  requireValue(
    privateResponse.headers.get("x-content-type-options") === "nosniff" &&
      privateResponse.headers.get("content-security-policy")?.includes("default-src 'none'") &&
      privateResponse.headers.has("x-request-id"),
    "Security headers or request ID were not present."
  );

  const deniedResponse = await fetch(`${apiUrl}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://untrusted.example",
    },
    body: JSON.stringify({ email: "nobody@example.com", password: "invalid-password" }),
  });
  requireValue(deniedResponse.status === 403, "Untrusted CORS origin was not rejected.");

  let limitedResponse;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    limitedResponse = await fetch(`${apiUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nobody@example.com", password: "invalid-password" }),
    });
    if (attempt <= 3) {
      requireValue(limitedResponse.status !== 429, `Login was rate limited on attempt ${attempt}.`);
    }
  }

  const limitedPayload = await limitedResponse.json();
  requireValue(
    limitedResponse.status === 429 &&
      limitedPayload.code === "RATE_LIMITED" &&
      limitedResponse.headers.has("retry-after"),
    "Repeated login attempts did not return the expected 429 response."
  );

  console.log("Security headers, cookie defaults, trusted CORS, private no-store, request ID, and login rate limit passed.");
} catch (error) {
  console.error(`Security smoke failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  process.exitCode = 1;
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
