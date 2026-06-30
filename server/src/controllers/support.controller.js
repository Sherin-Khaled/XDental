import { SupportMessage } from "../models/SupportMessage.js";
import { SupportThread } from "../models/SupportThread.js";
import { sendEmailIfConfigured } from "../services/email.service.js";
import { createNotification, notifyStaff } from "../services/notification.service.js";
import { cleanText, isValidId, nextPublicNumber, safeUser } from "../utils/records.js";

const THREAD_TYPES = ["PRODUCT_REQUEST", "GENERAL_SUPPORT", "ORDER", "QUOTE"];
const PRIORITIES = ["Normal", "Urgent"];

function isStaff(user) {
  return user?.role === "admin" || user?.role === "support";
}

function serializeThread(thread, latestMessage) {
  return {
    id: thread.id,
    ticketNumber: thread.ticketNumber,
    user: thread.user?.name ? safeUser(thread.user) : undefined,
    productRequestId: thread.productRequest ? String(thread.productRequest._id ?? thread.productRequest) : null,
    subject: thread.subject,
    type: thread.type,
    related: thread.related ?? "",
    status: thread.status,
    priority: thread.priority,
    assignedTo: thread.assignedTo?.name ? safeUser(thread.assignedTo) : null,
    lastMessageAt: thread.lastMessageAt,
    latestMessage: latestMessage?.body ?? "",
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  };
}

function serializeMessage(message) {
  return {
    id: message.id,
    threadId: message.thread?.id ?? message.thread,
    sender: message.sender?.name ? safeUser(message.sender) : null,
    senderRole: message.senderRole,
    body: message.body,
    readAt: message.readAt ?? null,
    createdAt: message.createdAt,
  };
}

async function withLatestMessages(threads) {
  if (threads.length === 0) return [];
  const ids = threads.map((thread) => thread._id);
  const latest = await SupportMessage.aggregate([
    { $match: { thread: { $in: ids } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: "$thread", body: { $first: "$body" } } },
  ]);
  const latestByThread = new Map(latest.map((message) => [String(message._id), message]));
  return threads.map((thread) => serializeThread(thread, latestByThread.get(String(thread._id))));
}

async function findAuthorizedThread(threadId, user, populate = false) {
  if (!isValidId(threadId)) return null;
  const filter = isStaff(user) ? { _id: threadId } : { _id: threadId, user: user.id };
  let query = SupportThread.findOne(filter);
  if (populate) query = query.populate("user").populate("assignedTo");
  return query;
}

export async function createSupportThread(request, response) {
  const subject = cleanText(request.body?.subject, 300);
  const body = cleanText(request.body?.message, 2000);
  const type = THREAD_TYPES.includes(request.body?.type) ? request.body.type : "GENERAL_SUPPORT";
  const priority = PRIORITIES.includes(request.body?.priority) ? request.body.priority : "Normal";
  if (!subject) return response.status(400).json({ message: "Subject is required." });
  if (!body) return response.status(400).json({ message: "Message is required." });

  const thread = await SupportThread.create({
    ticketNumber: nextPublicNumber("ST"),
    user: request.user.id,
    subject,
    type,
    related: cleanText(request.body?.related, 300) || undefined,
    status: "Waiting for Support",
    priority,
    lastMessageAt: new Date(),
  });
  await SupportMessage.create({ thread: thread.id, sender: request.user.id, senderRole: "CUSTOMER", body });
  await notifyStaff({
    type: "SUPPORT_MESSAGE",
    title: "New support ticket",
    body: `A customer opened ${thread.ticketNumber}.`,
    link: `/admin/support?thread=${thread.id}`,
    metadata: { threadId: thread.id },
  });
  return response.status(201).json({ supportThread: serializeThread(thread, { body }) });
}

export async function getMyThreads(request, response) {
  const threads = await SupportThread.find({ user: request.user.id }).sort({ lastMessageAt: -1 });
  return response.json({ supportThreads: await withLatestMessages(threads) });
}

export async function getAdminThreads(_request, response) {
  const threads = await SupportThread.find()
    .populate("user")
    .populate("assignedTo")
    .sort({ lastMessageAt: -1 });
  return response.json({ supportThreads: await withLatestMessages(threads) });
}

export async function getThreadMessages(request, response) {
  const thread = await findAuthorizedThread(request.params.threadId, request.user, true);
  if (!thread) return response.status(404).json({ message: "Support thread not found." });

  const unreadRoles = isStaff(request.user) ? ["CUSTOMER"] : ["SUPPORT", "ADMIN", "SYSTEM"];
  await SupportMessage.updateMany(
    { thread: thread.id, senderRole: { $in: unreadRoles }, readAt: null },
    { $set: { readAt: new Date() } }
  );
  const messages = await SupportMessage.find({ thread: thread.id }).populate("sender").sort({ createdAt: 1 });
  return response.json({ supportThread: serializeThread(thread), messages: messages.map(serializeMessage) });
}

export async function postThreadMessage(request, response) {
  const thread = await findAuthorizedThread(request.params.threadId, request.user, true);
  if (!thread) return response.status(404).json({ message: "Support thread not found." });
  const body = cleanText(request.body?.body, 2000);
  if (!body) return response.status(400).json({ message: "Message is required." });

  const staff = isStaff(request.user);
  const senderRole = request.user.role === "admin" ? "ADMIN" : request.user.role === "support" ? "SUPPORT" : "CUSTOMER";
  const message = await SupportMessage.create({ thread: thread.id, sender: request.user.id, senderRole, body });
  thread.lastMessageAt = new Date();
  thread.status = staff ? "Waiting for Customer" : "Waiting for Support";
  if (staff && !thread.assignedTo) thread.assignedTo = request.user.id;
  await thread.save();

  if (staff) {
    await createNotification({
      user: thread.user.id,
      type: "SUPPORT_MESSAGE",
      title: "Support replied to your ticket",
      body: `There is a new reply in ${thread.ticketNumber}.`,
      link: `/account/support?thread=${thread.id}`,
      metadata: { threadId: thread.id },
    });
    await sendEmailIfConfigured({ event: "SUPPORT_REPLY" }).catch(() => {});
  } else {
    await notifyStaff({
      type: "SUPPORT_MESSAGE",
      title: "Customer replied",
      body: `A customer replied in ${thread.ticketNumber}.`,
      link: `/admin/support?thread=${thread.id}`,
      metadata: { threadId: thread.id },
    });
  }

  await message.populate("sender");
  return response.status(201).json({ message: serializeMessage(message), supportThread: serializeThread(thread, message) });
}

export async function updateAdminThreadStatus(request, response) {
  const allowed = ["Open", "Waiting for Support", "Waiting for Customer", "Resolved"];
  if (!allowed.includes(request.body?.status)) return response.status(400).json({ message: "Invalid support thread status." });
  const thread = await findAuthorizedThread(request.params.threadId, request.user, true);
  if (!thread) return response.status(404).json({ message: "Support thread not found." });
  const changed = thread.status !== request.body.status;
  thread.status = request.body.status;
  await thread.save();

  if (changed && thread.status === "Resolved") {
    await SupportMessage.create({ thread: thread.id, senderRole: "SYSTEM", body: "This support ticket has been resolved." });
    await createNotification({
      user: thread.user.id,
      type: "SUPPORT_MESSAGE",
      title: "Support ticket resolved",
      body: `${thread.ticketNumber} has been resolved.`,
      link: `/account/support?thread=${thread.id}`,
      metadata: { threadId: thread.id },
    });
    await sendEmailIfConfigured({ event: "TICKET_RESOLVED" }).catch(() => {});
  }
  return response.json({ supportThread: serializeThread(thread) });
}
