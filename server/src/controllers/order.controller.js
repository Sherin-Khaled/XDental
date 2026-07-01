import { prisma } from "../config/db.js";
import { cleanText, isValidId, nextPublicNumber } from "../utils/records.js";

const SHIPPING_METHODS = {
  standard: 50,
  fast: 80,
  pickup: 0,
};

const PAYMENT_METHODS = new Set(["cash", "card", "fawry", "wallet", "instapay", "bank"]);

const orderInclude = {
  items: { orderBy: { createdAt: "asc" } },
};

function parseAddress(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function serializeOrder(order) {
  const address = parseAddress(order.shippingAddress);
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    subtotal: Number(order.subtotal ?? 0),
    shipping: Number(order.shipping ?? 0),
    discount: Number(order.discount ?? 0),
    total: Number(order.total ?? 0),
    customerName: order.customerName ?? "",
    customerEmail: order.customerEmail ?? "",
    customerPhone: order.customerPhone ?? "",
    shippingAddress: {
      name: order.customerName ?? "",
      line1: [address.building, address.street].filter(Boolean).join(" "),
      city: address.cityArea ?? "",
      governorate: address.governorate ?? "",
      country: address.country ?? "Egypt",
      phone: order.customerPhone ?? "",
      apartmentFloor: address.apartmentFloor ?? "",
      postalCode: address.postalCode ?? "",
      deliveryNotes: address.deliveryNotes ?? "",
      clinicName: address.clinicName ?? "",
      clinicBranch: address.clinicBranch ?? "",
    },
    deliveryMethod: address.deliveryMethod ?? "",
    orderNotes: address.orderNotes ?? "",
    paymentMethod: order.paymentMethod ?? "",
    syncStatus: order.syncStatus ?? null,
    itemCount: order.items.reduce((count, item) => count + item.quantity, 0),
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId ?? null,
      externalProductId: item.externalProductId ?? null,
      productName: item.productName,
      sku: item.sku ?? "",
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice ?? 0),
      total: Number(item.total ?? 0),
    })),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function readRequiredText(body, keys, label, maxLength = 300) {
  const value = keys.map((key) => cleanText(body?.[key], maxLength)).find(Boolean) ?? "";
  return value ? { value } : { error: `${label} is required.` };
}

function parseItem(item, index) {
  const productName = cleanText(item?.productName, 300);
  const selectedOptions = cleanText(item?.selectedOptions, 300);
  const quantity = Number(item?.quantity);
  const hasUnitPrice = item?.unitPrice !== undefined && item?.unitPrice !== null && item?.unitPrice !== "";
  const unitPrice = Number(item?.unitPrice);

  if (!productName) return { error: `Item ${index + 1} product name is required.` };
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 10000) {
    return { error: `Item ${index + 1} quantity must be a positive whole number.` };
  }
  if (!hasUnitPrice || !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 100000000) {
    return { error: `Item ${index + 1} price is invalid.` };
  }

  const unitPriceCents = Math.round(unitPrice * 100);
  return {
    value: {
      productId: cleanText(item?.productId, 200) || null,
      externalProductId: cleanText(item?.externalProductId, 200) || null,
      productName: selectedOptions ? `${productName} (${selectedOptions})` : productName,
      sku: cleanText(item?.sku, 120) || null,
      quantity,
      unitPriceCents,
      totalCents: unitPriceCents * quantity,
    },
  };
}

export async function createOrder(request, response) {
  const customerName = readRequiredText(request.body, ["customerName"], "Customer name");
  const customerEmail = readRequiredText(request.body, ["customerEmail"], "Customer email", 320);
  const customerPhone = readRequiredText(request.body, ["customerPhone"], "Customer phone", 80);
  const governorate = readRequiredText(request.body, ["governorate"], "Governorate");
  const cityArea = readRequiredText(request.body, ["cityArea", "city"], "City / area");
  const street = readRequiredText(request.body, ["streetAddress", "street"], "Street");
  const building = readRequiredText(request.body, ["buildingNumber", "building"], "Building");

  const firstError = [customerName, customerEmail, customerPhone, governorate, cityArea, street, building]
    .find((result) => result.error)?.error;
  if (firstError) return response.status(400).json({ message: firstError });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.value)) {
    return response.status(400).json({ message: "Customer email is invalid." });
  }

  const deliveryMethod = cleanText(request.body?.deliveryMethod, 50).toLowerCase();
  const paymentMethod = cleanText(request.body?.paymentMethod, 50).toLowerCase();
  if (!(deliveryMethod in SHIPPING_METHODS)) {
    return response.status(400).json({ message: "Delivery method is invalid." });
  }
  if (!PAYMENT_METHODS.has(paymentMethod)) {
    return response.status(400).json({ message: "Payment method is invalid." });
  }

  const rawItems = Array.isArray(request.body?.items) ? request.body.items : [];
  if (rawItems.length === 0) {
    return response.status(400).json({ message: "At least one cart item is required." });
  }
  if (rawItems.length > 100) {
    return response.status(400).json({ message: "An order cannot contain more than 100 items." });
  }

  const parsedItems = rawItems.map(parseItem);
  const itemError = parsedItems.find((result) => result.error)?.error;
  if (itemError) return response.status(400).json({ message: itemError });
  const items = parsedItems.map((result) => result.value);

  const subtotalCents = items.reduce((sum, item) => sum + item.totalCents, 0);
  const shippingCents = SHIPPING_METHODS[deliveryMethod] * 100;
  const totalCents = subtotalCents + shippingCents;
  const shippingAddress = JSON.stringify({
    country: cleanText(request.body?.country, 120) || "Egypt",
    governorate: governorate.value,
    cityArea: cityArea.value,
    street: street.value,
    building: building.value,
    apartmentFloor: cleanText(request.body?.apartmentFloor, 120),
    postalCode: cleanText(request.body?.postalCode, 40),
    deliveryNotes: cleanText(request.body?.deliveryNotes, 2000),
    clinicName: cleanText(request.body?.clinicName, 300),
    clinicBranch: cleanText(request.body?.clinicBranch, 300),
    orderNotes: cleanText(request.body?.orderNotes, 3000),
    deliveryMethod,
  });

  const order = await prisma.$transaction(async (database) => {
    const createdOrder = await database.order.create({
      data: {
        userId: request.user.id,
        orderNumber: nextPublicNumber("ORD"),
        status: "PENDING",
        subtotal: subtotalCents / 100,
        shipping: shippingCents / 100,
        discount: 0,
        total: totalCents / 100,
        customerName: customerName.value,
        customerEmail: customerEmail.value.toLowerCase(),
        customerPhone: customerPhone.value,
        shippingAddress,
        paymentMethod,
        syncStatus: "PENDING",
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            externalProductId: item.externalProductId,
            productName: item.productName,
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: item.unitPriceCents / 100,
            total: item.totalCents / 100,
          })),
        },
      },
      include: orderInclude,
    });

    await database.syncLog.create({
      data: {
        entityType: "Order",
        entityId: createdOrder.id,
        direction: "WEBSITE_TO_OWNER",
        status: "PENDING",
        message: "Order is waiting for a future owner-system export adapter.",
      },
    });
    // TODO: Later: export confirmed/pending orders to owner system through integration adapter.
    return createdOrder;
  });

  return response.status(201).json({ order: serializeOrder(order) });
}

export async function getMyOrders(request, response) {
  const orders = await prisma.order.findMany({
    where: { userId: request.user.id },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
  });
  return response.json({ orders: orders.map(serializeOrder) });
}

export async function getMyOrder(request, response) {
  if (!isValidId(request.params.id)) {
    return response.status(404).json({ message: "Order not found." });
  }
  const order = await prisma.order.findFirst({
    where: { id: request.params.id, userId: request.user.id },
    include: orderInclude,
  });
  if (!order) return response.status(404).json({ message: "Order not found." });
  return response.json({ order: serializeOrder(order) });
}
