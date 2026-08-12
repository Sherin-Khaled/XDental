import { prisma } from "../config/db.js";
import {
  createSubmissionEmailDelivery,
  getEmailDeliveryMap,
} from "../services/email.service.js";
import {
  createNotification,
  deliverNotificationPush,
} from "../services/notification.service.js";
import { createFirstMessageAcknowledgement } from "../services/supportAcknowledgement.service.js";
import { cleanText, isValidId, nextPublicNumber, safeUser } from "../utils/records.js";

const STATUS_TO_DATABASE = {
  "Under Review": "UNDER_REVIEW",
  Available: "AVAILABLE",
  "Searching Supplier": "SEARCHING_SUPPLIER",
  "Not Available": "NOT_AVAILABLE",
  Canceled: "CANCELED",
};
const STATUS_TO_API = Object.fromEntries(
  Object.entries(STATUS_TO_DATABASE).map(([apiStatus, databaseStatus]) => [databaseStatus, apiStatus])
);
const THREAD_STATUS_TO_API = {
  OPEN: "Open",
  WAITING_FOR_SUPPORT: "Waiting for Support",
  WAITING_FOR_CUSTOMER: "Waiting for Customer",
  RESOLVED: "Resolved",
};
const PRIORITY_TO_API = { NORMAL: "Normal", URGENT: "Urgent" };
const SOURCES = ["PRODUCT_PAGE", "ACCOUNT_PAGE", "CHAT"];
const TERMINAL_STATUSES = new Set(["AVAILABLE", "NOT_AVAILABLE", "CANCELED"]);

const requestInclude = { supportThread: true };
const adminRequestInclude = { user: true, supportThread: true };

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function threadSummary(thread) {
  if (!thread) return null;
  return {
    id: thread.id,
    ticketNumber: thread.ticketNumber,
    subject: thread.subject,
    status: THREAD_STATUS_TO_API[thread.status] ?? thread.status,
    priority: PRIORITY_TO_API[thread.priority] ?? thread.priority,
    lastMessageAt: thread.lastMessageAt,
  };
}

function serializeRequest(productRequest) {
  return {
    id: productRequest.id,
    requestNumber: productRequest.requestNumber,
    user: productRequest.user?.name ? safeUser(productRequest.user) : undefined,
    productId: productRequest.productId ?? null,
    externalProductId: productRequest.externalProductId ?? null,
    productName: productRequest.productName,
    brand: productRequest.brand ?? "",
    sku: productRequest.sku ?? "",
    category: productRequest.category ?? "",
    quantity: productRequest.quantity ?? null,
    branch: productRequest.branch ?? "",
    message: productRequest.message ?? "",
    notes: productRequest.notes ?? "",
    status: STATUS_TO_API[productRequest.status] ?? productRequest.status,
    source: productRequest.source,
    chatThread: threadSummary(productRequest.supportThread),
    teamUpdates: asArray(productRequest.teamUpdates),
    attachments: asArray(productRequest.attachments),
    sourceSystem: productRequest.sourceSystem ?? null,
    externalSystemName: productRequest.sourceSystem ?? null,
    externalStatus: productRequest.externalStatus ?? null,
    syncStatus: productRequest.syncStatus ?? null,
    lastSyncedAt: productRequest.lastSyncedAt ?? null,
    resolvedAt: productRequest.resolvedAt ?? null,
    emailDelivery: productRequest.emailDelivery ?? null,
    createdAt: productRequest.createdAt,
    updatedAt: productRequest.updatedAt,
  };
}

function parseQuantity(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity > 0 ? quantity : null;
}

export async function createProductRequest(request, response) {
  const productName = cleanText(request.body?.productName, 300);
  const quantity = parseQuantity(request.body?.quantity);
  const source = SOURCES.includes(request.body?.source) ? request.body.source : "ACCOUNT_PAGE";

  if (!productName) return response.status(400).json({ message: "Product name is required." });
  if (quantity === null) {
    return response.status(400).json({ message: "Quantity must be a positive whole number." });
  }

  const customerMessage = cleanText(request.body?.message, 2000);
  const result = await prisma.$transaction(async (database) => {
    const initialRequest = await database.productRequest.create({
      data: {
        requestNumber: nextPublicNumber("PR"),
        userId: request.user.id,
        productId: cleanText(request.body?.productId, 200) || null,
        externalProductId: cleanText(request.body?.externalProductId, 200) || null,
        productName,
        brand: cleanText(request.body?.brand, 200) || null,
        sku: cleanText(request.body?.sku, 120) || null,
        category: cleanText(request.body?.category, 200) || null,
        quantity: quantity ?? null,
        branch: cleanText(request.body?.branch, 200) || null,
        message: customerMessage || null,
        notes: cleanText(request.body?.notes, 4000) || null,
        source,
        teamUpdates: [{ title: "Request submitted", date: new Date().toISOString() }],
      },
    });

    const thread = await database.supportThread.create({
      data: {
        ticketNumber: nextPublicNumber("ST"),
        userId: request.user.id,
        productRequestId: initialRequest.id,
        subject: `Product request: ${productName}`,
        type: "PRODUCT_REQUEST",
        status: "WAITING_FOR_SUPPORT",
        priority: "NORMAL",
        lastMessageAt: new Date(),
      },
    });

    const productRequest = await database.productRequest.update({
      where: { id: initialRequest.id },
      data: { supportThreadId: thread.id },
      include: requestInclude,
    });

    await database.supportMessage.create({
      data: {
        threadId: thread.id,
        senderRole: "SYSTEM",
        body: `Your product request for ${productName} was sent to support.`,
      },
    });
    if (customerMessage) {
      await database.supportMessage.create({
        data: {
          threadId: thread.id,
          senderId: request.user.id,
          senderRole: "CUSTOMER",
          body: customerMessage,
        },
      });
      await createFirstMessageAcknowledgement(database, thread.id);
    }

    const notification = await createNotification(
      {
        userId: request.user.id,
        type: "PRODUCT_REQUEST",
        title: "Product request sent",
        body: `Your request for ${productName} is under review.`,
        link: `/account/product-requests/${productRequest.id}`,
        metadata: { productRequestId: productRequest.id, threadId: thread.id },
      },
      database
    );

    return { productRequest, thread, notification };
  });

  await deliverNotificationPush(result.notification);
  const isMachineInquiry = /\b(machine|equipment|device)\b/i.test(
    `${productName} ${request.body?.category ?? ""}`
  );
  const emailResult = await createSubmissionEmailDelivery({
    category: isMachineInquiry ? "MACHINE_INQUIRY" : "PRODUCT_REQUEST",
    entityId: result.productRequest.id,
    replyTo: request.user.email,
    payload: {
      reference: result.productRequest.requestNumber,
      name: request.user.name,
      email: request.user.email,
      phone: request.user.phone,
      subject: isMachineInquiry ? "Machine inquiry" : "Product request",
      productName,
      quantity: quantity ?? null,
      message: customerMessage,
      adminPath: `/admin/product-requests?search=${encodeURIComponent(result.productRequest.requestNumber)}`,
    },
  });

  return response.status(201).json({
    productRequest: serializeRequest({
      ...result.productRequest,
      emailDelivery: emailResult.delivery,
    }),
    supportThread: threadSummary(result.thread),
  });
}

export async function getMyProductRequests(request, response) {
  const requests = await prisma.productRequest.findMany({
    where: { userId: request.user.id },
    include: requestInclude,
    orderBy: { createdAt: "desc" },
  });
  return response.json({ productRequests: requests.map(serializeRequest) });
}

export async function getMyProductRequest(request, response) {
  if (!isValidId(request.params.id)) {
    return response.status(404).json({ message: "Product request not found." });
  }
  const productRequest = await prisma.productRequest.findFirst({
    where: { id: request.params.id, userId: request.user.id },
    include: requestInclude,
  });
  if (!productRequest) return response.status(404).json({ message: "Product request not found." });
  return response.json({ productRequest: serializeRequest(productRequest) });
}

export async function cancelMyProductRequest(request, response) {
  if (!isValidId(request.params.id)) {
    return response.status(404).json({ message: "Product request not found." });
  }
  const productRequest = await prisma.productRequest.findFirst({
    where: { id: request.params.id, userId: request.user.id },
    include: requestInclude,
  });
  if (!productRequest) return response.status(404).json({ message: "Product request not found." });
  if (TERMINAL_STATUSES.has(productRequest.status) || productRequest.resolvedAt) {
    return response.status(409).json({ message: "This product request can no longer be canceled." });
  }

  const updated = await prisma.productRequest.update({
    where: { id: productRequest.id },
    data: {
      status: "CANCELED",
      resolvedAt: new Date(),
      teamUpdates: [
        ...asArray(productRequest.teamUpdates),
        { title: "Request canceled", date: new Date().toISOString() },
      ],
    },
    include: requestInclude,
  });
  return response.json({ productRequest: serializeRequest(updated) });
}

export async function updateMyProductRequestDetails(request, response) {
  if (!isValidId(request.params.id)) {
    return response.status(404).json({ message: "Product request not found." });
  }
  const productRequest = await prisma.productRequest.findFirst({
    where: { id: request.params.id, userId: request.user.id },
    include: requestInclude,
  });
  if (!productRequest) return response.status(404).json({ message: "Product request not found." });
  if (productRequest.status === "CANCELED") {
    return response.status(409).json({ message: "Canceled requests cannot be updated." });
  }

  const note = cleanText(request.body?.note, 2000);
  const attachments = Array.isArray(request.body?.attachments)
    ? request.body.attachments
        .slice(0, 10)
        .map((item) => {
          const name = cleanText(item?.name, 255);
          const mimeType = cleanText(item?.mimeType, 120);
          const hasSize = Number.isFinite(Number(item?.size));
          return {
            name,
            ...(mimeType ? { mimeType } : {}),
            ...(hasSize ? { size: Math.max(0, Number(item.size)) } : {}),
          };
        })
        .filter((item) => item.name)
    : [];
  if (!note && attachments.length === 0) {
    return response.status(400).json({ message: "Add a note or attachment metadata." });
  }

  const updated = await prisma.productRequest.update({
    where: { id: productRequest.id },
    data: {
      notes: note ? [productRequest.notes, note].filter(Boolean).join("\n") : productRequest.notes,
      attachments: [...asArray(productRequest.attachments), ...attachments],
      teamUpdates: [
        ...asArray(productRequest.teamUpdates),
        {
          title: note ? "Customer added request details" : "Customer added attachment metadata",
          date: new Date().toISOString(),
        },
      ],
    },
    include: requestInclude,
  });
  return response.json({ productRequest: serializeRequest(updated) });
}

export async function getAdminProductRequests(_request, response) {
  const requests = await prisma.productRequest.findMany({
    include: adminRequestInclude,
    orderBy: { createdAt: "desc" },
  });
  const ids = requests.map((item) => item.id);
  const [productDeliveries, machineDeliveries] = await Promise.all([
    getEmailDeliveryMap("PRODUCT_REQUEST", ids),
    getEmailDeliveryMap("MACHINE_INQUIRY", ids),
  ]);
  return response.json({
    productRequests: requests.map((item) =>
      serializeRequest({
        ...item,
        emailDelivery:
          productDeliveries.get(item.id) ?? machineDeliveries.get(item.id) ?? null,
      })
    ),
  });
}

export async function getAdminProductRequest(request, response) {
  if (!isValidId(request.params.id)) {
    return response.status(404).json({ message: "Product request not found." });
  }
  const productRequest = await prisma.productRequest.findUnique({
    where: { id: request.params.id },
    include: adminRequestInclude,
  });
  if (!productRequest) return response.status(404).json({ message: "Product request not found." });
  const [productDeliveries, machineDeliveries] = await Promise.all([
    getEmailDeliveryMap("PRODUCT_REQUEST", [productRequest.id]),
    getEmailDeliveryMap("MACHINE_INQUIRY", [productRequest.id]),
  ]);
  return response.json({
    productRequest: serializeRequest({
      ...productRequest,
      emailDelivery:
        productDeliveries.get(productRequest.id) ??
        machineDeliveries.get(productRequest.id) ??
        null,
    }),
  });
}

export async function updateAdminProductRequestStatus(request, response) {
  const databaseStatus = STATUS_TO_DATABASE[request.body?.status];
  if (!databaseStatus) return response.status(400).json({ message: "Invalid product request status." });
  if (!isValidId(request.params.id)) {
    return response.status(404).json({ message: "Product request not found." });
  }

  const productRequest = await prisma.productRequest.findUnique({
    where: { id: request.params.id },
    include: adminRequestInclude,
  });
  if (!productRequest) return response.status(404).json({ message: "Product request not found." });

  if (productRequest.status === databaseStatus) {
    return response.json({ productRequest: serializeRequest(productRequest) });
  }

  const status = request.body.status;
  const isAvailable = databaseStatus === "AVAILABLE";
  const updated = await prisma.$transaction(async (database) => {
    const nextRequest = await database.productRequest.update({
      where: { id: productRequest.id },
      data: {
        status: databaseStatus,
        resolvedAt: TERMINAL_STATUSES.has(databaseStatus) ? new Date() : null,
        teamUpdates: [
          ...asArray(productRequest.teamUpdates),
          { title: `Status changed to ${status}`, date: new Date().toISOString() },
        ],
      },
      include: adminRequestInclude,
    });

    const notification = await createNotification(
      {
        userId: productRequest.userId,
        type: isAvailable ? "PRODUCT_AVAILABLE" : "PRODUCT_REQUEST",
        title: isAvailable ? "Product available" : "Product request updated",
        body: isAvailable
          ? `${productRequest.productName} is now available.`
          : `Your product request status is now ${status}.`,
        link: `/account/product-requests/${productRequest.id}`,
        metadata: {
          productRequestId: productRequest.id,
          threadId: productRequest.supportThread?.id ?? null,
        },
      },
      database
    );

    if (isAvailable && productRequest.supportThread) {
      await database.supportMessage.create({
        data: {
          threadId: productRequest.supportThread.id,
          senderRole: "SYSTEM",
          body: `${productRequest.productName} is now available. Support can help you complete the order.`,
        },
      });
      nextRequest.supportThread = await database.supportThread.update({
        where: { id: productRequest.supportThread.id },
        data: { lastMessageAt: new Date(), status: "WAITING_FOR_CUSTOMER" },
      });
    }

    return { productRequest: nextRequest, notification };
  });

  await deliverNotificationPush(updated.notification);
  return response.json({
    productRequest: serializeRequest(updated.productRequest),
  });
}
