import { prisma } from "../config/db.js";
import {
  createSubmissionEmailDelivery,
  getEmailDeliveryMap,
} from "../services/email.service.js";
import {
  createNotification,
  deliverNotificationPush,
  notifyStaff,
} from "../services/notification.service.js";
import { createFirstMessageAcknowledgement } from "../services/supportAcknowledgement.service.js";
import { cleanText, isValidId, nextPublicNumber, safeUser } from "../utils/records.js";

const QUOTE_STATUSES = [
  "PENDING",
  "SUPPLIER_REVIEW",
  "DRAFT_RESPONSE",
  "SENT",
  "ACCEPTED",
  "REJECTED",
  "CANCELED",
];
const RESPONSE_STATUSES = new Set(["DRAFT_RESPONSE", "SENT"]);

const quoteInclude = {
  user: { select: { id: true, name: true, email: true, phone: true, role: true } },
  items: { orderBy: { createdAt: "asc" } },
  supportThread: {
    select: { id: true, ticketNumber: true, status: true, assignedToId: true, createdAt: true },
  },
};

function parseMoney(value) {
  if (value === undefined || value === null || value === "") return { value: null };
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100000000) {
    return { error: "Price must be a valid non-negative number." };
  }
  return { value: number };
}

function parseItems(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) {
    return { error: "Add between 1 and 50 quote items." };
  }

  const items = [];
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    const productName = cleanText(item?.productName, 300);
    const quantity = Number(item?.quantity);
    const requestedPrice = parseMoney(item?.requestedPrice);
    if (!productName) return { error: `Item ${index + 1} product name is required.` };
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) {
      return { error: `Item ${index + 1} quantity must be a positive whole number.` };
    }
    if (requestedPrice.error) return { error: `Item ${index + 1}: ${requestedPrice.error}` };

    items.push({
      productId: cleanText(item?.productId, 200) || null,
      productName,
      brand: cleanText(item?.brand, 200) || null,
      sku: cleanText(item?.sku, 120) || null,
      quantity,
      selectedOptions: cleanText(item?.selectedOptions, 500) || null,
      requestedPrice: requestedPrice.value,
    });
  }
  return { items };
}

function serializeItem(item) {
  return {
    id: item.id,
    productId: item.productId ?? null,
    productName: item.productName,
    brand: item.brand ?? null,
    sku: item.sku ?? null,
    quantity: item.quantity,
    selectedOptions: item.selectedOptions ?? null,
    requestedPrice: item.requestedPrice === null ? null : Number(item.requestedPrice),
    quotedPrice: item.quotedPrice === null ? null : Number(item.quotedPrice),
  };
}

function serializeQuote(quote, { forCustomer = false } = {}) {
  const hasCustomerResponse = !forCustomer || quote.status !== "DRAFT_RESPONSE";
  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    status: forCustomer && quote.status === "DRAFT_RESPONSE" ? "PENDING" : quote.status,
    customer: {
      id: quote.userId,
      name: quote.customerName,
      email: quote.customerEmail,
      phone: quote.customerPhone ?? null,
      ...(quote.user ? { account: safeUser(quote.user) } : {}),
    },
    notes: quote.notes ?? "",
    adminResponse: hasCustomerResponse ? quote.adminResponse ?? "" : "",
    quotedPrice: hasCustomerResponse && quote.quotedPrice !== null ? Number(quote.quotedPrice) : null,
    supportThreadId: quote.supportThreadId ?? null,
    supportThread: quote.supportThread
      ? {
          id: quote.supportThread.id,
          ticketNumber: quote.supportThread.ticketNumber,
          status: quote.supportThread.status,
          createdAt: quote.supportThread.createdAt,
        }
      : null,
    items: (quote.items ?? []).map(serializeItem),
    itemCount: quote.items?.length ?? 0,
    totalQuantity: (quote.items ?? []).reduce((total, item) => total + item.quantity, 0),
    respondedAt: hasCustomerResponse ? quote.respondedAt ?? null : null,
    emailDelivery: quote.emailDelivery ?? null,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
  };
}

function statusLabel(status) {
  return status.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function findAdminQuote(id, database = prisma) {
  if (!isValidId(id)) return null;
  return database.quote.findUnique({ where: { id }, include: quoteInclude });
}

export async function createQuote(request, response) {
  const parsedItems = parseItems(request.body?.items);
  if (parsedItems.error) return response.status(400).json({ message: parsedItems.error });
  const notes = cleanText(request.body?.notes ?? request.body?.message, 4000);
  const quoteNumber = nextPublicNumber("QT");

  const result = await prisma.$transaction(async (database) => {
    const initialQuote = await database.quote.create({
      data: {
        quoteNumber,
        userId: request.user.id,
        customerName: request.user.name,
        customerEmail: request.user.email,
        customerPhone: request.user.phone ?? null,
        notes: notes || null,
        items: { create: parsedItems.items },
      },
    });
    const thread = await database.supportThread.create({
      data: {
        ticketNumber: nextPublicNumber("ST"),
        userId: request.user.id,
        subject: `Quote request ${quoteNumber}`,
        type: "QUOTE",
        related: quoteNumber,
        status: "WAITING_FOR_SUPPORT",
        priority: "NORMAL",
        lastMessageAt: new Date(),
      },
    });
    const customerMessage = notes || `Quote request for ${parsedItems.items.map((item) => item.productName).join(", ")}.`;
    await database.supportMessage.create({
      data: {
        threadId: thread.id,
        senderId: request.user.id,
        senderRole: "CUSTOMER",
        body: customerMessage,
      },
    });
    await createFirstMessageAcknowledgement(database, thread.id);
    const quote = await database.quote.update({
      where: { id: initialQuote.id },
      data: { supportThreadId: thread.id },
      include: quoteInclude,
    });

    const notification = await createNotification(
      {
        userId: request.user.id,
        type: "QUOTE_UPDATE",
        title: "Quote request submitted",
        body: `${quoteNumber} is pending review.`,
        link: `/account/quotes/${quote.id}`,
        metadata: { quoteId: quote.id, quoteNumber, threadId: thread.id, status: quote.status },
      },
      database
    );
    await notifyStaff(
      {
        type: "QUOTE_UPDATE",
        title: "New quote request",
        body: `${request.user.name} submitted ${quoteNumber}.`,
        link: `/admin/quotes?quote=${quote.id}`,
        metadata: { quoteId: quote.id, quoteNumber, threadId: thread.id, status: quote.status },
      },
      database
    );

    return { quote, notification };
  });

  await deliverNotificationPush(result.notification);
  const quote = result.quote;
  const emailResult = await createSubmissionEmailDelivery({
    category: "QUOTE",
    entityId: quote.id,
    replyTo: quote.customerEmail,
    payload: {
      reference: quote.quoteNumber,
      name: quote.customerName,
      email: quote.customerEmail,
      phone: quote.customerPhone,
      subject: `Quote request ${quote.quoteNumber}`,
      message: quote.notes,
      productName: quote.items.map((item) => `${item.productName} × ${item.quantity}`).join(", "),
      adminPath: `/admin/quotes?quote=${quote.id}`,
    },
  });

  return response.status(201).json({
    quote: serializeQuote(
      { ...quote, emailDelivery: emailResult.delivery },
      { forCustomer: true }
    ),
  });
}

export async function getMyQuotes(request, response) {
  const quotes = await prisma.quote.findMany({
    where: { userId: request.user.id },
    include: quoteInclude,
    orderBy: { createdAt: "desc" },
  });
  return response.json({ quotes: quotes.map((quote) => serializeQuote(quote, { forCustomer: true })) });
}

export async function getMyQuote(request, response) {
  if (!isValidId(request.params.id)) return response.status(404).json({ message: "Quote not found." });
  const quote = await prisma.quote.findFirst({
    where: { id: request.params.id, userId: request.user.id },
    include: quoteInclude,
  });
  if (!quote) return response.status(404).json({ message: "Quote not found." });
  return response.json({ quote: serializeQuote(quote, { forCustomer: true }) });
}

export async function getAdminQuotes(request, response) {
  const search = cleanText(request.query?.search, 100);
  const status = cleanText(request.query?.status, 50).toUpperCase();
  if (status && !QUOTE_STATUSES.includes(status)) {
    return response.status(400).json({ message: "Invalid quote status." });
  }
  const quotes = await prisma.quote.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { quoteNumber: { contains: search, mode: "insensitive" } },
              { customerName: { contains: search, mode: "insensitive" } },
              { customerEmail: { contains: search, mode: "insensitive" } },
              { items: { some: { productName: { contains: search, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    include: quoteInclude,
    orderBy: { createdAt: "desc" },
  });
  const deliveries = await getEmailDeliveryMap("QUOTE", quotes.map((quote) => quote.id));
  return response.json({
    quotes: quotes.map((quote) =>
      serializeQuote({ ...quote, emailDelivery: deliveries.get(quote.id) ?? null })
    ),
  });
}

export async function getAdminQuote(request, response) {
  const quote = await findAdminQuote(request.params.id);
  if (!quote) return response.status(404).json({ message: "Quote not found." });
  const deliveries = await getEmailDeliveryMap("QUOTE", [quote.id]);
  return response.json({
    quote: serializeQuote({ ...quote, emailDelivery: deliveries.get(quote.id) ?? null }),
  });
}

export async function updateAdminQuoteStatus(request, response) {
  const status = cleanText(request.body?.status, 50).toUpperCase();
  if (!QUOTE_STATUSES.includes(status)) {
    return response.status(400).json({ message: "Invalid quote status." });
  }
  const existing = await findAdminQuote(request.params.id);
  if (!existing) return response.status(404).json({ message: "Quote not found." });
  if (status === "SENT" && !existing.adminResponse) {
    return response.status(400).json({ message: "Add an admin response before marking the quote as sent." });
  }
  if (existing.status === status) return response.json({ quote: serializeQuote(existing) });

  const updated = await prisma.$transaction(async (database) => {
    const quote = await database.quote.update({
      where: { id: existing.id },
      data: { status, ...(status === "SENT" ? { respondedAt: new Date() } : {}) },
      include: quoteInclude,
    });
    let notification = null;
    if (status !== "DRAFT_RESPONSE") {
      notification = await createNotification(
        {
          userId: quote.userId,
          type: "QUOTE_UPDATE",
          title: "Quote status updated",
          body: `${quote.quoteNumber} is now ${statusLabel(status)}.`,
          link: `/account/quotes/${quote.id}`,
          metadata: { quoteId: quote.id, quoteNumber: quote.quoteNumber, threadId: quote.supportThreadId, status },
        },
        database
      );
    }
    return { quote, notification };
  });
  await deliverNotificationPush(updated.notification);
  return response.json({ quote: serializeQuote(updated.quote) });
}

export async function respondToAdminQuote(request, response) {
  const adminResponse = cleanText(request.body?.adminResponse ?? request.body?.response, 4000);
  const status = cleanText(request.body?.status, 50).toUpperCase() || "SENT";
  const quotedPrice = parseMoney(request.body?.quotedPrice);
  if (!adminResponse) return response.status(400).json({ message: "Admin response is required." });
  if (!RESPONSE_STATUSES.has(status)) {
    return response.status(400).json({ message: "Response status must be DRAFT_RESPONSE or SENT." });
  }
  if (quotedPrice.error) return response.status(400).json({ message: quotedPrice.error });

  const existing = await findAdminQuote(request.params.id);
  if (!existing) return response.status(404).json({ message: "Quote not found." });

  const updated = await prisma.$transaction(async (database) => {
    const quote = await database.quote.update({
      where: { id: existing.id },
      data: {
        adminResponse,
        quotedPrice: quotedPrice.value,
        status,
        ...(status === "SENT" ? { respondedAt: new Date() } : {}),
      },
      include: quoteInclude,
    });

    let notification = null;
    if (status === "SENT") {
      const priceLine = quotedPrice.value === null ? "" : `\nQuoted price: EGP ${quotedPrice.value.toFixed(2)}`;
      if (quote.supportThreadId) {
        await database.supportMessage.create({
          data: {
            threadId: quote.supportThreadId,
            senderId: request.user.id,
            senderRole: request.user.role === "admin" ? "ADMIN" : "SUPPORT",
            body: `Quote response for ${quote.quoteNumber}:\n${adminResponse}${priceLine}`,
          },
        });
        await database.supportThread.update({
          where: { id: quote.supportThreadId },
          data: {
            status: "WAITING_FOR_CUSTOMER",
            lastMessageAt: new Date(),
            assignedToId: existing.supportThread?.assignedToId ?? request.user.id,
          },
        });
      }
      notification = await createNotification(
        {
          userId: quote.userId,
          type: "QUOTE_UPDATE",
          title: "Quote response sent",
          body: `Your response for ${quote.quoteNumber} is ready.`,
          link: `/account/quotes/${quote.id}`,
          metadata: { quoteId: quote.id, quoteNumber: quote.quoteNumber, threadId: quote.supportThreadId, status },
        },
        database
      );
    }
    return { quote, notification };
  });

  await deliverNotificationPush(updated.notification);
  const refreshed = await findAdminQuote(updated.quote.id);
  return response.json({ quote: serializeQuote(refreshed) });
}
