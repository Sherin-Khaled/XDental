const API_BASE_URL = "http://localhost:5000/api";
const TEST_PASSWORD = "SmokeTest123456!";

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, { method = "GET", body, cookie } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      signal: AbortSignal.timeout(10000),
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error(`Request to ${path} failed. Confirm the backend is running on port 5000.`);
  }

  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

function requireOk(step, result) {
  if (!result.response.ok) {
    const message = typeof result.payload?.message === "string" ? `: ${result.payload.message}` : "";
    throw new Error(`${step} failed with HTTP ${result.response.status}${message}`);
  }
  return result.payload;
}

function getAuthCookie(headers) {
  const setCookies =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : [headers.get("set-cookie")].filter(Boolean);
  const authCookie = setCookies.find((value) => value.startsWith("x_dental_auth="));
  return authCookie?.split(";", 1)[0] ?? null;
}

try {
  const health = requireOk("Health", await request("/health"));
  requireValue(
    health.server?.status === "ok" && health.database?.status === "connected",
    "Health failed because the server or PostgreSQL is not ready."
  );
  console.log("✅ Health OK");

  let email;
  let registeredUser;
  for (let attempt = 0; attempt < 3 && !registeredUser; attempt += 1) {
    email = `smoke.customer+${Date.now()}-${attempt}@xdental.local`;
    const registration = await request("/auth/register", {
      method: "POST",
      body: { name: "Smoke Test Customer", email, password: TEST_PASSWORD },
    });
    if (registration.response.status === 409) continue;
    registeredUser = requireOk("Register", registration).user;
  }
  requireValue(registeredUser?.id, "Register failed after retrying with unique test customers.");
  console.log(`✅ Register OK (${registeredUser.id})`);

  const loginResult = await request("/auth/login", {
    method: "POST",
    body: { email, password: TEST_PASSWORD },
  });
  const login = requireOk("Login", loginResult);
  const cookie = getAuthCookie(loginResult.response.headers);
  requireValue(login.user?.id === registeredUser.id && cookie, "Login did not return the expected session.");
  console.log("✅ Login OK");

  const me = requireOk("Auth me", await request("/auth/me", { cookie }));
  requireValue(me.user?.id === registeredUser.id, "Auth me returned a different user.");
  console.log("✅ Auth me OK");

  const created = requireOk(
    "Product request",
    await request("/product-requests", {
      method: "POST",
      cookie,
      body: {
        productName: "Smoke Test Dental Product",
        brand: "Smoke Brand",
        sku: "SMOKE-SKU",
        quantity: 1,
        message: "Smoke test request",
      },
    })
  );
  const productRequestId = created.productRequest?.id;
  const threadId = created.supportThread?.id ?? created.productRequest?.chatThread?.id;
  requireValue(productRequestId && threadId, "Product request did not create a linked support thread.");

  const productRequests = requireOk(
    "Fetch product requests",
    await request("/product-requests/my", { cookie })
  ).productRequests;
  requireValue(
    Array.isArray(productRequests) && productRequests.some((item) => item.id === productRequestId),
    "Created product request was not returned by the customer endpoint."
  );
  console.log(`✅ Product request OK (${productRequestId})`);

  const supportThreads = requireOk(
    "Fetch support threads",
    await request("/support/threads/my", { cookie })
  ).supportThreads;
  requireValue(
    Array.isArray(supportThreads) && supportThreads.some((item) => item.id === threadId),
    "Linked support thread was not returned by the customer endpoint."
  );
  console.log(`✅ Support thread OK (${threadId})`);

  const sentMessage = requireOk(
    "Support message",
    await request(`/support/threads/${threadId}/messages`, {
      method: "POST",
      cookie,
      body: { body: "Smoke test support message" },
    })
  ).message;
  requireValue(sentMessage?.id, "Support message did not return a message ID.");
  console.log(`✅ Support message OK (${sentMessage.id})`);

  const notifications = requireOk(
    "Notifications",
    await request("/notifications/my", { cookie })
  ).notifications;
  requireValue(Array.isArray(notifications), "Notifications response is invalid.");
  requireValue(
    notifications.some((item) => item.metadata?.productRequestId === productRequestId),
    "Product request notification was not found."
  );
  console.log(`✅ Notifications OK (${notifications.length})`);
} catch (error) {
  console.error(`❌ ${error instanceof Error ? error.message : "Smoke test failed."}`);
  process.exitCode = 1;
}
