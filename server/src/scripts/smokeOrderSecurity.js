import "dotenv/config";

import { prisma } from "../config/db.js";
import { deleteUsersAndOwnedData } from "../services/testDataCleanup.service.js";
import { AUTH_COOKIE_NAME, createToken } from "../utils/createToken.js";

const API_BASE_URL = process.env.API_BASE_URL?.trim() || "http://localhost:5001/api";
const TEST_PASSWORD = "OrderSecurity123456!";
const createdProductIds = [];
const generatedEmails = new Set();
let registeredUserId = null;

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, { method = "GET", body, cookie, idempotencyKey } = {}) {
  const checkoutRequestKey =
    method === "POST" && path === "/orders"
      ? idempotencyKey ?? crypto.randomUUID()
      : null;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    signal: AbortSignal.timeout(10000),
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(checkoutRequestKey ? { "Idempotency-Key": checkoutRequestKey } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

function requireOk(step, result) {
  if (!result.response.ok) {
    throw new Error(`${step} failed with HTTP ${result.response.status}: ${result.payload?.message ?? "Unknown error"}`);
  }
  return result.payload;
}

function getAuthCookie(headers) {
  const setCookies = typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : [headers.get("set-cookie")].filter(Boolean);
  return setCookies.find((value) => value.startsWith(`${AUTH_COOKIE_NAME}=`))?.split(";", 1)[0] ?? null;
}

function orderBody(product, quantity) {
  return {
    customerName: "Order Security Customer",
    customerEmail: [...generatedEmails][0],
    customerPhone: "+201000000000",
    country: "Egypt",
    governorate: "Cairo",
    cityArea: "Nasr City",
    streetAddress: "Test Street",
    buildingNumber: "1",
    deliveryMethod: "standard",
    paymentMethod: "cash",
    subtotal: 0,
    shipping: 0,
    discount: 999999,
    total: 0,
    items: [{
      productId: product.id,
      sku: product.sku,
      slug: product.slug,
      productName: "Tampered display name",
      quantity,
      unitPrice: 0,
    }],
  };
}

async function reviewedOrderBody(cookie, product, quantity) {
  const body = orderBody(product, quantity);
  const preview = requireOk(
    "Order price preview",
    await request("/orders/preview", { method: "POST", cookie, body })
  );
  requireValue(preview.totals?.pricingQuoteToken, "Order preview did not return a pricing quote token.");
  return {
    body: { ...body, pricingQuoteToken: preview.totals.pricingQuoteToken },
    totals: preview.totals,
  };
}

async function createTestProduct(suffix, data) {
  const product = await prisma.product.create({
    data: {
      name: `Order Security Product ${suffix}`,
      slug: `order-security-${suffix}`,
      sku: `ORDER-SEC-${suffix}`,
      price: data.price,
      stockQuantity: data.stock,
      status: data.stock > 0 ? "ACTIVE" : "OUT_OF_STOCK",
      isAvailable: data.stock > 0,
      sourceSystem: "SMOKE_TEST",
    },
  });
  createdProductIds.push(product.id);
  return product;
}

async function run() {
  const health = requireOk("Health", await request("/health"));
  requireValue(health.database?.status === "connected", "PostgreSQL is not ready.");

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  requireValue(admin?.id, "An admin user is required for order confirmation tests.");
  const adminCookie = `${AUTH_COOKIE_NAME}=${createToken(admin.id)}`;
  const deliveryZone = await prisma.deliveryZone.findFirst({
    where: { isActive: true },
    orderBy: [{ displayOrder: "asc" }, { nameEn: "asc" }],
    select: { id: true },
  });
  requireValue(deliveryZone?.id, "An active delivery zone is required for order security tests.");

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const email = `order.security+${suffix}@xdental.local`;
  generatedEmails.add(email);
  const registration = await request("/auth/register", {
    method: "POST",
    body: {
      name: "Order Security Customer",
      email,
      password: TEST_PASSWORD,
      clinicSpecialty: "General Dentistry",
      clinicLocations: [{ deliveryZoneId: deliveryZone.id }],
    },
  });
  const registered = requireOk("Register", registration).user;
  registeredUserId = registered.id;
  const customerCookie = getAuthCookie(registration.response.headers);
  requireValue(customerCookie, "Registration did not return an authentication cookie.");

  const pricedProduct = await createTestProduct(`${suffix}-priced`, { price: 321.45, stock: 5 });
  const pricedOrderReview = await reviewedOrderBody(customerCookie, pricedProduct, 2);
  const pricedOrderBody = pricedOrderReview.body;
  const checkoutRequestKey = crypto.randomUUID();
  const createdOrderResult = await request("/orders", {
    method: "POST",
    cookie: customerCookie,
    idempotencyKey: checkoutRequestKey,
    body: pricedOrderBody,
  });
  const order = requireOk("Tampered-price order", createdOrderResult).order;
  requireValue(order.status === "PENDING_REVIEW", "New order did not start in pending review.");
  requireValue(order.paymentMethod === "cash", "New order was not saved as Cash on Delivery.");
  requireValue(order.paymentStatus === "PENDING_COLLECTION", "New order did not start pending cash collection.");
  requireValue(order.subtotal === pricedOrderReview.totals.subtotal, "Order subtotal differed from the reviewed authoritative subtotal.");
  requireValue(order.total === pricedOrderReview.totals.total, "Order total differed from the reviewed authoritative total.");
  requireValue(order.items[0]?.unitPrice === 321.45, "Client unitPrice was not ignored.");
  requireValue(order.items[0]?.productName === pricedProduct.name, "Authoritative product snapshot was not used.");
  requireValue((await prisma.product.findUnique({ where: { id: pricedProduct.id } })).stockQuantity === 5, "Pending order decremented stock.");
  console.log("Price tampering ignored; pending stock unchanged.");

  const replayedOrderResult = await request("/orders", {
    method: "POST",
    cookie: customerCookie,
    idempotencyKey: checkoutRequestKey,
    body: pricedOrderBody,
  });
  const replayedOrder = requireOk("Repeated checkout request", replayedOrderResult).order;
  requireValue(replayedOrderResult.response.status === 200, "Repeated checkout did not return HTTP 200.");
  requireValue(replayedOrder.id === order.id, "Repeated checkout created a different order.");
  requireValue(
    await prisma.order.count({
      where: { userId: registeredUserId, idempotencyKey: checkoutRequestKey },
    }) === 1,
    "Repeated checkout created more than one order."
  );
  console.log("Repeated checkout returned the original order without creating a duplicate.");

  const concurrentCheckoutKey = crypto.randomUUID();
  const concurrentOrderBody = (await reviewedOrderBody(customerCookie, pricedProduct, 1)).body;
  const concurrentRequests = await Promise.all([
    request("/orders", {
      method: "POST",
      cookie: customerCookie,
      idempotencyKey: concurrentCheckoutKey,
      body: concurrentOrderBody,
    }),
    request("/orders", {
      method: "POST",
      cookie: customerCookie,
      idempotencyKey: concurrentCheckoutKey,
      body: concurrentOrderBody,
    }),
  ]);
  const concurrentOrders = concurrentRequests.map((result, index) =>
    requireOk(`Concurrent checkout request ${index + 1}`, result).order
  );
  requireValue(
    concurrentOrders[0].id === concurrentOrders[1].id,
    "Simultaneous checkout requests returned different orders."
  );
  requireValue(
    await prisma.order.count({
      where: { userId: registeredUserId, idempotencyKey: concurrentCheckoutKey },
    }) === 1,
    "Simultaneous checkout requests created more than one order."
  );
  console.log("Simultaneous identical checkout requests created exactly one order.");

  const unsupportedPayment = await request("/orders", {
    method: "POST",
    cookie: customerCookie,
    body: { ...concurrentOrderBody, paymentMethod: "card" },
  });
  requireValue(unsupportedPayment.response.status === 400, "Unsupported payment method was not rejected.");
  console.log("Unsupported payment method rejected.");

  const firstConfirmation = requireOk(
    "First confirmation",
    await request(`/admin/orders/${order.id}/status`, {
      method: "PATCH",
      cookie: adminCookie,
      body: { status: "CONFIRMED" },
    })
  );
  requireValue(firstConfirmation.statusChanged === true, "First confirmation did not change status.");
  requireValue((await prisma.product.findUnique({ where: { id: pricedProduct.id } })).stockQuantity === 3, "Confirmation did not decrement stock once.");

  const secondConfirmation = requireOk(
    "Second confirmation",
    await request(`/admin/orders/${order.id}/status`, {
      method: "PATCH",
      cookie: adminCookie,
      body: { status: "CONFIRMED" },
    })
  );
  requireValue(secondConfirmation.statusChanged === false, "Double confirmation was not idempotent.");
  requireValue((await prisma.product.findUnique({ where: { id: pricedProduct.id } })).stockQuantity === 3, "Double confirmation decremented stock twice.");
  const notifications = await prisma.notification.findMany({ where: { userId: registeredUserId, type: "ORDER_UPDATE" } });
  requireValue(notifications.filter((item) => item.title === "Order confirmed").length === 1, "Confirmation notification was not created exactly once.");
  console.log("Confirmation decremented stock once and remained idempotent.");

  const invalidDeliveryTransition = await request(`/admin/orders/${order.id}/status`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { status: "DELIVERED" },
  });
  requireValue(invalidDeliveryTransition.response.status === 409, "Invalid delivery transition was not rejected.");

  for (const status of ["PREPARING", "OUT_FOR_DELIVERY"]) {
    const transition = requireOk(
      `Move order to ${status}`,
      await request(`/admin/orders/${order.id}/status`, {
        method: "PATCH",
        cookie: adminCookie,
        body: { status },
      })
    );
    requireValue(transition.order.status === status, `Order did not move to ${status}.`);
  }
  const paid = requireOk(
    "Mark cash collected",
    await request(`/admin/orders/${order.id}/payment-status`, {
      method: "PATCH",
      cookie: adminCookie,
      body: { paymentStatus: "PAID" },
    })
  );
  requireValue(paid.order.paymentStatus === "PAID", "Cash payment was not marked paid.");
  const delivered = requireOk(
    "Mark delivered",
    await request(`/admin/orders/${order.id}/status`, {
      method: "PATCH",
      cookie: adminCookie,
      body: { status: "DELIVERED" },
    })
  );
  requireValue(delivered.order.status === "DELIVERED", "Order was not marked delivered.");
  console.log("Internal delivery workflow and cash collection completed.");

  const orderHistory = requireOk(
    "Customer order history",
    await request("/orders/my", { cookie: customerCookie })
  ).orders;
  requireValue(orderHistory.some((item) => item.id === order.id), "Placed order was absent from customer history.");
  const orderDetail = requireOk(
    "Customer order detail",
    await request(`/orders/my/${order.id}`, { cookie: customerCookie })
  ).order;
  requireValue(orderDetail.status === "DELIVERED", "Customer order detail did not expose the latest status.");
  const publicTracking = requireOk(
    "Public order tracking",
    await request("/orders/track", {
      method: "POST",
      body: { orderNumber: order.orderNumber, phone: "+201000000000" },
    })
  );
  requireValue(publicTracking.status === "DELIVERED", "Public tracking did not expose the latest order status.");
  const incorrectTracking = await request("/orders/track", {
    method: "POST",
    body: { orderNumber: order.orderNumber, phone: "+201999999999" },
  });
  requireValue(incorrectTracking.response.status === 404, "Public tracking accepted an incorrect phone number.");
  console.log("Customer history, order detail, and privacy-checked public tracking passed.");

  const cancelProduct = await createTestProduct(`${suffix}-cancel`, { price: 90, stock: 4 });
  const cancelOrderBody = (await reviewedOrderBody(customerCookie, cancelProduct, 2)).body;
  const cancelOrder = requireOk(
    "Cancellation restoration order",
    await request("/orders", {
      method: "POST",
      cookie: customerCookie,
      body: cancelOrderBody,
    })
  ).order;
  requireOk(
    "Confirm cancellation order",
    await request(`/admin/orders/${cancelOrder.id}/status`, {
      method: "PATCH",
      cookie: adminCookie,
      body: { status: "CONFIRMED" },
    })
  );
  requireValue((await prisma.product.findUnique({ where: { id: cancelProduct.id } })).stockQuantity === 2, "Cancellation test confirmation did not decrement stock.");
  requireOk(
    "Cancel confirmed order",
    await request(`/admin/orders/${cancelOrder.id}/status`, {
      method: "PATCH",
      cookie: adminCookie,
      body: { status: "CANCELED" },
    })
  );
  requireValue((await prisma.product.findUnique({ where: { id: cancelProduct.id } })).stockQuantity === 4, "Cancel did not restore stock once.");
  const repeatedCancel = requireOk(
    "Repeat cancellation",
    await request(`/admin/orders/${cancelOrder.id}/status`, {
      method: "PATCH",
      cookie: adminCookie,
      body: { status: "CANCELED" },
    })
  );
  requireValue(repeatedCancel.statusChanged === false, "Repeated cancellation was not idempotent.");
  requireValue((await prisma.product.findUnique({ where: { id: cancelProduct.id } })).stockQuantity === 4, "Repeated cancellation restored stock twice.");
  console.log("Cancellation restored confirmed stock once.");

  const outOfStockProduct = await createTestProduct(`${suffix}-empty`, { price: 75, stock: 0 });
  const outOfStockOrder = await request("/orders", {
    method: "POST",
    cookie: customerCookie,
    body: orderBody(outOfStockProduct, 1),
  });
  requireValue(outOfStockOrder.response.status === 409, "Out-of-stock order was not rejected.");
  console.log("Out-of-stock order rejected.");

  const confirmationProduct = await createTestProduct(`${suffix}-confirm`, { price: 50, stock: 2 });
  const confirmationOrderBody = (await reviewedOrderBody(customerCookie, confirmationProduct, 2)).body;
  const pendingOrder = requireOk(
    "Pending confirmation order",
    await request("/orders", {
      method: "POST",
      cookie: customerCookie,
      body: confirmationOrderBody,
    })
  ).order;
  await prisma.product.update({
    where: { id: confirmationProduct.id },
    data: { stockQuantity: 1, status: "LOW_STOCK", isAvailable: true },
  });
  const insufficientConfirmation = await request(`/admin/orders/${pendingOrder.id}/status`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { status: "CONFIRMED" },
  });
  requireValue(insufficientConfirmation.response.status === 409, "Insufficient-stock confirmation was not rejected.");
  const unchangedOrder = await prisma.order.findUnique({ where: { id: pendingOrder.id } });
  const unchangedProduct = await prisma.product.findUnique({ where: { id: confirmationProduct.id } });
  requireValue(unchangedOrder.status === "PENDING_REVIEW", "Failed confirmation changed the order status.");
  requireValue(unchangedProduct.stockQuantity === 1, "Failed confirmation changed stock.");
  console.log("Insufficient-stock confirmation rolled back safely.");
}

let failure = null;
try {
  await run();
} catch (error) {
  failure = error;
} finally {
  try {
    const generatedUsers = await prisma.user.findMany({
      where: {
        OR: [
          ...(registeredUserId ? [{ id: registeredUserId }] : []),
          ...(generatedEmails.size ? [{ email: { in: [...generatedEmails] } }] : []),
        ],
      },
      select: { id: true },
    });
    await deleteUsersAndOwnedData(prisma, generatedUsers.map(({ id }) => id));
    await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
  } catch (cleanupError) {
    failure ??= cleanupError;
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

if (failure) {
  console.error(`Order security smoke failed: ${failure instanceof Error ? failure.message : "Unknown error"}`);
  process.exitCode = 1;
} else {
  console.log("Order security smoke passed; mutable test data removed and immutable ledger-backed records anonymized.");
}
