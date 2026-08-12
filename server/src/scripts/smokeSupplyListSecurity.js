import "dotenv/config";

import { prisma } from "../config/db.js";
import { deleteUsersAndOwnedData } from "../services/testDataCleanup.service.js";
import { AUTH_COOKIE_NAME, createToken } from "../utils/createToken.js";

const API_BASE_URL = process.env.API_BASE_URL?.trim() || "http://localhost:5001/api";
const generatedUserIds = [];
const generatedQuoteIds = [];

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, { method = "GET", body, cookie } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    signal: AbortSignal.timeout(10000),
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

function requireOk(step, result) {
  if (!result.response.ok) {
    throw new Error(
      `${step} failed with HTTP ${result.response.status}: ${result.payload?.message ?? "Unknown error"}`
    );
  }
  return result.payload;
}

async function createTestUser(label, suffix) {
  const user = await prisma.user.create({
    data: {
      name: `Supply List Smoke ${label}`,
      email: `supply-list.${label.toLowerCase()}+${suffix}@xdental.local`,
      passwordHash: "not-used-by-token-smoke",
    },
    select: { id: true },
  });
  generatedUserIds.push(user.id);
  return user;
}

async function run() {
  const health = requireOk("Health", await request("/health"));
  requireValue(health.database?.status === "connected", "PostgreSQL is not ready.");

  const unauthenticated = await request("/supply-lists");
  requireValue(
    unauthenticated.response.status === 401,
    "Supply-list reads are not protected by authentication."
  );

  const product = await prisma.product.findFirst({
    where: {
      status: { in: ["ACTIVE", "LOW_STOCK", "OUT_OF_STOCK"] },
      price: { gt: 0 },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true },
  });
  requireValue(product?.id, "A priced catalog product is required for this smoke test.");
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    select: { id: true },
  });
  requireValue(admin?.id, "An active admin account is required for the dashboard quote check.");

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const [accountA, accountB] = await Promise.all([
    createTestUser("A", suffix),
    createTestUser("B", suffix),
  ]);
  const accountACookie = `${AUTH_COOKIE_NAME}=${createToken(accountA.id)}`;
  const accountBCookie = `${AUTH_COOKIE_NAME}=${createToken(accountB.id)}`;
  const adminCookie = `${AUTH_COOKIE_NAME}=${createToken(admin.id)}`;

  const createdResult = await request("/supply-lists", {
    method: "POST",
    cookie: accountACookie,
    body: {
      name: "Account A Supply List",
      branch: "Main Clinic",
      userId: accountB.id,
      unitPrice: 0.01,
      items: [{
        productId: product.id,
        quantity: 2,
        selectedOptions: "Shade A2",
        productName: "Browser-Tampered Product",
        unitPrice: 0.01,
      }],
    },
  });
  const created = requireOk("Account A create", createdResult).supplyList;
  requireValue(createdResult.response.status === 201, "Supply-list creation did not return HTTP 201.");
  requireValue(created.items?.[0]?.product?.name === product.name, "The API trusted a browser product name.");
  requireValue(Number(created.items?.[0]?.product?.price) > 0, "The API trusted an invalid browser price.");

  const stored = await prisma.supplyList.findUnique({
    where: { id: created.id },
    include: { items: true },
  });
  requireValue(stored?.userId === accountA.id, "The API trusted browser-supplied list ownership.");
  requireValue(stored?.items?.[0]?.quantity === 2, "The stored list item quantity is incorrect.");

  const accountBRead = await request(`/supply-lists/${created.id}`, {
    cookie: accountBCookie,
  });
  requireValue(accountBRead.response.status === 404, "Account B could read Account A's list.");

  const accountBEdit = await request(`/supply-lists/${created.id}/items`, {
    method: "PUT",
    cookie: accountBCookie,
    body: { items: [] },
  });
  requireValue(accountBEdit.response.status === 404, "Account B could edit Account A's list.");

  const accountBDelete = await request(`/supply-lists/${created.id}`, {
    method: "DELETE",
    cookie: accountBCookie,
  });
  requireValue(accountBDelete.response.status === 404, "Account B could delete Account A's list.");

  const afterDeniedMutations = await prisma.supplyList.findUnique({
    where: { id: created.id },
    include: { items: true },
  });
  requireValue(
    afterDeniedMutations?.items?.[0]?.quantity === 2,
    "A denied cross-account request changed Account A's list."
  );

  const accountBLists = requireOk(
    "Account B list index",
    await request("/supply-lists", { cookie: accountBCookie })
  ).supplyLists;
  requireValue(
    !accountBLists.some((list) => list.id === created.id),
    "Account A's list appeared in Account B's list index."
  );

  const emptyListResult = await request("/supply-lists", {
    method: "POST",
    cookie: accountBCookie,
    body: {
      name: "Account B Empty Supply List",
      branch: "Second Clinic",
    },
  });
  const emptyList = requireOk("Account B empty-list create", emptyListResult).supplyList;
  requireValue(
    emptyListResult.response.status === 201 && emptyList.items.length === 0,
    "The account-page empty supply-list flow did not persist correctly."
  );
  const emptyListDelete = await request(`/supply-lists/${emptyList.id}`, {
    method: "DELETE",
    cookie: accountBCookie,
  });
  requireValue(
    emptyListDelete.response.status === 204,
    "Account B could not remove its empty supply list."
  );

  const accountAFetch = requireOk(
    "Account A read",
    await request(`/supply-lists/${created.id}`, { cookie: accountACookie })
  ).supplyList;
  requireValue(accountAFetch.id === created.id, "Account A could not read its own supply list.");

  const merged = requireOk(
    "Account A merge",
    await request(`/supply-lists/${created.id}/items/merge`, {
      method: "POST",
      cookie: accountACookie,
      body: {
        items: [{
          productId: product.id,
          quantity: 1,
          selectedOptions: "Shade A2",
          productName: "Another Browser Name",
          unitPrice: 0.01,
        }],
      },
    })
  ).supplyList;
  requireValue(merged.items?.[0]?.quantity === 3, "Account A's item merge was not persisted.");
  requireValue(
    merged.items?.[0]?.product?.name === product.name,
    "The merge response did not use current server product data."
  );

  const quoteResult = await request("/quotes", {
    method: "POST",
    cookie: accountACookie,
    body: {
      notes: `Supply list: ${created.name}\nClinic branch: ${created.branch}`,
      items: [{
        productId: product.id,
        productName: product.name,
        quantity: 3,
        selectedOptions: "Shade A2",
      }],
    },
  });
  const quote = requireOk("Supply-list quote create", quoteResult).quote;
  generatedQuoteIds.push(quote.id);
  requireValue(quoteResult.response.status === 201, "Quote creation did not return HTTP 201.");
  requireValue(
    quote.status === "PENDING" &&
      quote.items?.[0]?.quantity === 3 &&
      quote.items?.[0]?.selectedOptions === "Shade A2",
    "The supply-list quote snapshot was not persisted correctly."
  );
  requireValue(
    quote.supportThreadId && quote.supportThread?.id === quote.supportThreadId,
    "The real quote workflow did not create its linked support conversation."
  );

  const accountAQuote = requireOk(
    "Account A quote read",
    await request(`/quotes/my/${quote.id}`, { cookie: accountACookie })
  ).quote;
  requireValue(accountAQuote.id === quote.id, "Account A could not read its created quote.");

  const accountBQuote = await request(`/quotes/my/${quote.id}`, {
    cookie: accountBCookie,
  });
  requireValue(accountBQuote.response.status === 404, "Account B could read Account A's quote.");

  const adminQuote = requireOk(
    "Admin dashboard quote read",
    await request(`/admin/quotes/${quote.id}`, { cookie: adminCookie })
  ).quote;
  requireValue(
    adminQuote.id === quote.id && adminQuote.customer.id === accountA.id,
    "The created quote was not visible correctly through the admin dashboard API."
  );

  const deleted = await request(`/supply-lists/${created.id}`, {
    method: "DELETE",
    cookie: accountACookie,
  });
  requireValue(deleted.response.status === 204, "Account A could not delete its own list.");
  requireValue(
    await prisma.supplyList.count({ where: { id: created.id } }) === 0,
    "The deleted supply list still exists."
  );
}

let failure = null;
try {
  await run();
} catch (error) {
  failure = error;
} finally {
  try {
    const ownedQuotes = await prisma.quote.findMany({
      where: { userId: { in: generatedUserIds } },
      select: { id: true },
    });
    const quoteIds = [
      ...new Set([
        ...generatedQuoteIds,
        ...ownedQuotes.map(({ id }) => id),
      ]),
    ];
    await prisma.emailDelivery.deleteMany({
      where: { category: "QUOTE", entityId: { in: quoteIds } },
    });
    await deleteUsersAndOwnedData(prisma, generatedUserIds);
    const remainingUsers = await prisma.user.count({
      where: { id: { in: generatedUserIds } },
    });
    const remainingLists = await prisma.supplyList.count({
      where: { userId: { in: generatedUserIds } },
    });
    const remainingQuotes = await prisma.quote.count({
      where: { id: { in: quoteIds } },
    });
    const remainingDeliveries = await prisma.emailDelivery.count({
      where: { category: "QUOTE", entityId: { in: quoteIds } },
    });
    requireValue(
      remainingUsers === 0 &&
        remainingLists === 0 &&
        remainingQuotes === 0 &&
        remainingDeliveries === 0,
      "Generated supply-list and quote smoke data was not fully removed."
    );
  } catch (cleanupError) {
    failure ??= cleanupError;
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

if (failure) {
  console.error(
    `Supply-list security smoke failed: ${failure instanceof Error ? failure.message : "Unknown error"}`
  );
  process.exitCode = 1;
} else {
  console.log(
    "Supply-list security smoke passed: account isolation, persistence, real quote workflow, admin visibility, and cleanup verified."
  );
}
