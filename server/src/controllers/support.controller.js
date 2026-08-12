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

const THREAD_TYPES = ["PRODUCT_REQUEST", "GENERAL_SUPPORT", "ORDER", "QUOTE"];
const PRIORITY_TO_DATABASE = { Normal: "NORMAL", Urgent: "URGENT" };
const PRIORITY_TO_API = { NORMAL: "Normal", URGENT: "Urgent" };
const STATUS_TO_DATABASE = {
  Open: "OPEN",
  "Waiting for Support": "WAITING_FOR_SUPPORT",
  "Waiting for Customer": "WAITING_FOR_CUSTOMER",
  Resolved: "RESOLVED",
};
const STATUS_TO_API = Object.fromEntries(
  Object.entries(STATUS_TO_DATABASE).map(([apiStatus, databaseStatus]) => [databaseStatus, apiStatus])
);

function isStaff(user) {
  return user?.role === "admin" || user?.role === "support";
}

function serializeThread(thread, latestMessage) {
  const latest = latestMessage ?? thread.messages?.[0];
  return {
    id: thread.id,
    ticketNumber: thread.ticketNumber,
    user: thread.user?.name ? safeUser(thread.user) : undefined,
    productRequestId: thread.productRequestId ?? null,
    subject: thread.subject,
    type: thread.type,
    related: thread.related ?? "",
    status: STATUS_TO_API[thread.status] ?? thread.status,
    priority: PRIORITY_TO_API[thread.priority] ?? thread.priority,
    assignedTo: thread.assignedTo?.name ? safeUser(thread.assignedTo) : null,
    lastMessageAt: thread.lastMessageAt,
    latestMessage: latest?.body ?? "",
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    emailDelivery: thread.emailDelivery ?? null,
  };
}

function serializeMessage(message) {
  return {
    id: message.id,
    threadId: message.threadId,
    sender: message.sender?.name ? safeUser(message.sender) : null,
    senderRole: message.senderRole,
    body: message.body,
    readAt: message.readAt ?? null,
    createdAt: message.createdAt,
  };
}

async function findAuthorizedThread(threadId, user, database = prisma) {
  if (!isValidId(threadId)) return null;
  return database.supportThread.findFirst({
    where: {
      id: threadId,
      ...(isStaff(user) ? {} : { userId: user.id }),
    },
    include: { user: true, assignedTo: true },
  });
}

export async function createSupportThread(request, response) {
  const subject = cleanText(request.body?.subject, 300);
  const body = cleanText(request.body?.message, 2000);
  const type = THREAD_TYPES.includes(request.body?.type) ? request.body.type : "GENERAL_SUPPORT";
  const priority = PRIORITY_TO_DATABASE[request.body?.priority] ?? "NORMAL";
  if (!subject) return response.status(400).json({ message: "Subject is required." });
  if (!body) return response.status(400).json({ message: "Message is required." });

  const thread = await prisma.$transaction(async (database) => {
    const createdThread = await database.supportThread.create({
      data: {
        ticketNumber: nextPublicNumber("ST"),
        userId: request.user.id,
        subject,
        type,
        related: cleanText(request.body?.related, 300) || null,
        status: "WAITING_FOR_SUPPORT",
        priority,
        lastMessageAt: new Date(),
      },
    });
    await database.supportMessage.create({
      data: {
        threadId: createdThread.id,
        senderId: request.user.id,
        senderRole: "CUSTOMER",
        body,
      },
    });
    await createFirstMessageAcknowledgement(database, createdThread.id);
    await notifyStaff(
      {
        type: "SUPPORT_MESSAGE",
        title: "New support ticket",
        body: `A customer opened ${createdThread.ticketNumber}.`,
        link: `/admin/support?thread=${createdThread.id}`,
        metadata: { threadId: createdThread.id },
      },
      database
    );
    return createdThread;
  });

  await createSubmissionEmailDelivery({
    category: "SUPPORT",
    entityId: thread.id,
    replyTo: request.user.email,
    payload: {
      reference: thread.ticketNumber,
      name: request.user.name,
      email: request.user.email,
      phone: request.user.phone,
      subject,
      message: body,
      adminPath: `/admin/support?thread=${thread.id}`,
    },
  });

  return response.status(201).json({ supportThread: serializeThread(thread, { body }) });
}

export async function getMyThreads(request, response) {
  const threads = await prisma.supportThread.findMany({
    where: { userId: request.user.id },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true } },
    },
    orderBy: { lastMessageAt: "desc" },
  });
  return response.json({ supportThreads: threads.map((thread) => serializeThread(thread)) });
}

export async function getAdminThreads(_request, response) {
  const threads = await prisma.supportThread.findMany({
    include: {
      user: true,
      assignedTo: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true } },
    },
    orderBy: { lastMessageAt: "desc" },
  });
  const deliveries = await getEmailDeliveryMap("SUPPORT", threads.map((thread) => thread.id));
  return response.json({
    supportThreads: threads.map((thread) =>
      serializeThread({ ...thread, emailDelivery: deliveries.get(thread.id) ?? null })
    ),
  });
}

export async function getThreadMessages(request, response) {
  const thread = await findAuthorizedThread(request.params.threadId, request.user);
  if (!thread) return response.status(404).json({ message: "Support thread not found." });

  const unreadRoles = isStaff(request.user) ? ["CUSTOMER"] : ["SUPPORT", "ADMIN", "SYSTEM"];
  await prisma.supportMessage.updateMany({
    where: { threadId: thread.id, senderRole: { in: unreadRoles }, readAt: null },
    data: { readAt: new Date() },
  });
  const messages = await prisma.supportMessage.findMany({
    where: { threadId: thread.id },
    include: { sender: true },
    orderBy: { createdAt: "asc" },
  });
  return response.json({
    supportThread: serializeThread(thread),
    messages: messages.map(serializeMessage),
  });
}

export async function postThreadMessage(request, response) {
  const thread = await findAuthorizedThread(request.params.threadId, request.user);
  if (!thread) return response.status(404).json({ message: "Support thread not found." });
  const body = cleanText(request.body?.body, 2000);
  if (!body) return response.status(400).json({ message: "Message is required." });

  const staff = isStaff(request.user);
  const senderRole = request.user.role === "admin" ? "ADMIN" : request.user.role === "support" ? "SUPPORT" : "CUSTOMER";
  const result = await prisma.$transaction(async (database) => {
    const message = await database.supportMessage.create({
      data: {
        threadId: thread.id,
        senderId: request.user.id,
        senderRole,
        body,
      },
      include: { sender: true },
    });
    const autoResponse = staff
      ? null
      : await createFirstMessageAcknowledgement(database, thread.id);
    const updatedThread = await database.supportThread.update({
      where: { id: thread.id },
      data: {
        lastMessageAt: new Date(),
        status: staff ? "WAITING_FOR_CUSTOMER" : "WAITING_FOR_SUPPORT",
        assignedToId: staff && !thread.assignedToId ? request.user.id : thread.assignedToId,
      },
      include: { user: true, assignedTo: true },
    });

    let notification = null;
    if (staff) {
      notification = await createNotification(
        {
          userId: thread.userId,
          type: "SUPPORT_MESSAGE",
          title: "Support replied to your ticket",
          body: `There is a new reply in ${thread.ticketNumber}.`,
          link: `/account/support?thread=${thread.id}`,
          metadata: { threadId: thread.id },
        },
        database
      );
    } else {
      await notifyStaff(
        {
          type: "SUPPORT_MESSAGE",
          title: "Customer replied",
          body: `A customer replied in ${thread.ticketNumber}.`,
          link: `/admin/support?thread=${thread.id}`,
          metadata: { threadId: thread.id },
        },
        database
      );
    }

    return { message, autoResponse, thread: updatedThread, notification };
  });

  await deliverNotificationPush(result.notification);
  if (!staff) {
    await createSubmissionEmailDelivery({
      category: "SUPPORT",
      entityId: result.message.id,
      replyTo: thread.user?.email,
      payload: {
        reference: thread.ticketNumber,
        name: thread.user?.name,
        email: thread.user?.email,
        phone: thread.user?.phone,
        subject: thread.subject,
        message: body,
        adminPath: `/admin/support?thread=${thread.id}`,
      },
    });
  }
  return response.status(201).json({
    message: serializeMessage(result.message),
    autoResponse: result.autoResponse ? serializeMessage(result.autoResponse) : null,
    supportThread: serializeThread(result.thread, result.message),
  });
}

export async function updateAdminThreadStatus(request, response) {
  const databaseStatus = STATUS_TO_DATABASE[request.body?.status];
  if (!databaseStatus) {
    return response.status(400).json({ message: "Invalid support thread status." });
  }
  const thread = await findAuthorizedThread(request.params.threadId, request.user);
  if (!thread) return response.status(404).json({ message: "Support thread not found." });

  if (thread.status === databaseStatus) {
    return response.json({ supportThread: serializeThread(thread) });
  }

  const updated = await prisma.$transaction(async (database) => {
    const updatedThread = await database.supportThread.update({
      where: { id: thread.id },
      data: { status: databaseStatus },
      include: { user: true, assignedTo: true },
    });

    let notification = null;
    if (databaseStatus === "RESOLVED") {
      await database.supportMessage.create({
        data: {
          threadId: thread.id,
          senderRole: "SYSTEM",
          body: "This support ticket has been resolved.",
        },
      });
      notification = await createNotification(
        {
          userId: thread.userId,
          type: "SUPPORT_MESSAGE",
          title: "Support ticket resolved",
          body: `${thread.ticketNumber} has been resolved.`,
          link: `/account/support?thread=${thread.id}`,
          metadata: { threadId: thread.id },
        },
        database
      );
    }

    return { supportThread: updatedThread, notification };
  });

  await deliverNotificationPush(updated.notification);
  return response.json({
    supportThread: serializeThread(updated.supportThread),
  });
}
