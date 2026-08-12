import "dotenv/config";

import { prisma } from "../config/db.js";
import { SUPPORT_AUTO_ACKNOWLEDGEMENT } from "../services/supportAcknowledgement.service.js";
import { deleteUsersAndOwnedData } from "../services/testDataCleanup.service.js";

const API_BASE_URL = "http://localhost:5000/api";
const TEST_PASSWORD = "SmokeTest123456!";
const generatedEmails = new Set();
let registeredUserId = null;

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
    generatedEmails.add(email);
    const registration = await request("/auth/register", {
      method: "POST",
      body: { name: "Smoke Test Customer", email, password: TEST_PASSWORD },
    });
    if (registration.response.status === 409) continue;
    registeredUser = requireOk("Register", registration).user;
  }
  requireValue(registeredUser?.id, "Register failed after retrying with unique test customers.");
  registeredUserId = registeredUser.id;
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

  const initialProductThreadMessages = requireOk(
    "Fetch initial product request messages",
    await request(`/support/threads/${threadId}/messages`, { cookie })
  ).messages;
  requireValue(
    initialProductThreadMessages.filter(
      (message) => message.senderRole === "SYSTEM" && message.body === SUPPORT_AUTO_ACKNOWLEDGEMENT
    ).length === 1,
    "The product request thread did not create exactly one automatic acknowledgement."
  );

  const sentMessageResult = requireOk(
    "Support message",
    await request(`/support/threads/${threadId}/messages`, {
      method: "POST",
      cookie,
      body: { body: "Smoke test support message" },
    })
  );
  const sentMessage = sentMessageResult.message;
  requireValue(sentMessage?.id, "Support message did not return a message ID.");
  requireValue(sentMessageResult.autoResponse === null, "The automatic acknowledgement repeated after a later customer message.");
  console.log(`✅ Support message OK (${sentMessage.id})`);

  const productThreadMessagesAfterReply = requireOk(
    "Refetch product request messages",
    await request(`/support/threads/${threadId}/messages`, { cookie })
  ).messages;
  requireValue(
    productThreadMessagesAfterReply.filter(
      (message) => message.senderRole === "SYSTEM" && message.body === SUPPORT_AUTO_ACKNOWLEDGEMENT
    ).length === 1,
    "The product request thread contains duplicate automatic acknowledgements."
  );

  const generalThread = requireOk(
    "General support thread",
    await request("/support/threads", {
      method: "POST",
      cookie,
      body: {
        subject: "Smoke Test General Support",
        type: "GENERAL_SUPPORT",
        priority: "Normal",
        message: "Smoke test first general support message",
      },
    })
  ).supportThread;
  requireValue(generalThread?.id, "General support thread did not return a thread ID.");

  const generalMessages = requireOk(
    "Fetch general support messages",
    await request(`/support/threads/${generalThread.id}/messages`, { cookie })
  ).messages;
  requireValue(
    generalMessages.filter(
      (message) => message.senderRole === "SYSTEM" && message.body === SUPPORT_AUTO_ACKNOWLEDGEMENT
    ).length === 1,
    "The general support thread did not create exactly one automatic acknowledgement."
  );

  const secondGeneralMessage = requireOk(
    "Second general support message",
    await request(`/support/threads/${generalThread.id}/messages`, {
      method: "POST",
      cookie,
      body: { body: "Smoke test second general support message" },
    })
  );
  requireValue(
    secondGeneralMessage.autoResponse === null,
    "The general support acknowledgement repeated after the second customer message."
  );
  const generalMessagesAfterReply = requireOk(
    "Refetch general support messages",
    await request(`/support/threads/${generalThread.id}/messages`, { cookie })
  ).messages;
  requireValue(
    generalMessagesAfterReply.filter(
      (message) => message.senderRole === "SYSTEM" && message.body === SUPPORT_AUTO_ACKNOWLEDGEMENT
    ).length === 1,
    "The general support thread contains duplicate automatic acknowledgements."
  );
  console.log("✅ Automatic support acknowledgement OK");

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
} finally {
  try {
    const exactFilters = [];
    if (registeredUserId) exactFilters.push({ id: registeredUserId });
    if (generatedEmails.size > 0) {
      exactFilters.push({ email: { in: [...generatedEmails] } });
    }

    const generatedUsers = exactFilters.length
      ? await prisma.user.findMany({
          where: { OR: exactFilters },
          select: { id: true },
        })
      : [];
    const deleted = await deleteUsersAndOwnedData(
      prisma,
      generatedUsers.map(({ id }) => id)
    );
    console.log(`Smoke cleanup OK (${deleted.users} generated user(s) removed)`);
  } catch (cleanupError) {
    console.error(
      `Smoke cleanup failed: ${
        cleanupError instanceof Error ? cleanupError.message : "Unknown cleanup error."
      }`
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}
