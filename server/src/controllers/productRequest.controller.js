import { Notification } from "../models/Notification.js";
import { ProductRequest } from "../models/ProductRequest.js";
import { SupportMessage } from "../models/SupportMessage.js";
import { SupportThread } from "../models/SupportThread.js";
import { sendEmailIfConfigured } from "../services/email.service.js";
import { createNotification } from "../services/notification.service.js";
import { cleanText, isValidId, nextPublicNumber, safeUser } from "../utils/records.js";

const STATUSES = ["Under Review", "Available", "Searching Supplier", "Not Available", "Canceled"];
const SOURCES = ["PRODUCT_PAGE", "ACCOUNT_PAGE", "CHAT"];

function threadSummary(thread) {
  if (!thread) return null;
  return {
    id: thread.id,
    ticketNumber: thread.ticketNumber,
    subject: thread.subject,
    status: thread.status,
    priority: thread.priority,
    lastMessageAt: thread.lastMessageAt,
  };
}

function serializeRequest(request) {
  return {
    id: request.id,
    requestNumber: request.requestNumber,
    user: request.user?.name ? safeUser(request.user) : undefined,
    productId: request.productId ?? null,
    externalProductId: request.externalProductId ?? null,
    productName: request.productName,
    brand: request.brand ?? "",
    sku: request.sku ?? "",
    category: request.category ?? "",
    quantity: request.quantity ?? null,
    branch: request.branch ?? "",
    message: request.message ?? "",
    notes: request.notes ?? "",
    status: request.status,
    source: request.source,
    chatThread: threadSummary(request.chatThread),
    teamUpdates: request.teamUpdates,
    attachments: request.attachments,
    externalSystemName: request.externalSystemName ?? null,
    externalStatus: request.externalStatus ?? null,
    syncStatus: request.syncStatus ?? null,
    lastSyncedAt: request.lastSyncedAt ?? null,
    resolvedAt: request.resolvedAt ?? null,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
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
  if (quantity === null) return response.status(400).json({ message: "Quantity must be a positive whole number." });

  let productRequest;
  let thread;
  try {
    productRequest = await ProductRequest.create({
      requestNumber: nextPublicNumber("PR"),
      user: request.user.id,
      productId: cleanText(request.body?.productId, 200) || undefined,
      externalProductId: cleanText(request.body?.externalProductId, 200) || undefined,
      productName,
      brand: cleanText(request.body?.brand, 200) || undefined,
      sku: cleanText(request.body?.sku, 120) || undefined,
      category: cleanText(request.body?.category, 200) || undefined,
      quantity,
      branch: cleanText(request.body?.branch, 200) || undefined,
      message: cleanText(request.body?.message, 2000) || undefined,
      notes: cleanText(request.body?.notes, 4000) || undefined,
      source,
      teamUpdates: [{ title: "Request submitted", date: new Date() }],
    });

    thread = await SupportThread.create({
      ticketNumber: nextPublicNumber("ST"),
      user: request.user.id,
      productRequest: productRequest.id,
      subject: `Product request: ${productName}`,
      type: "PRODUCT_REQUEST",
      status: "Waiting for Support",
      priority: "Normal",
      lastMessageAt: new Date(),
    });

    productRequest.chatThread = thread.id;
    await productRequest.save();

    await SupportMessage.create({
      thread: thread.id,
      senderRole: "SYSTEM",
      body: `Your product request for ${productName} was sent to support.`,
    });
    const customerMessage = cleanText(request.body?.message, 2000);
    if (customerMessage) {
      await SupportMessage.create({
        thread: thread.id,
        sender: request.user.id,
        senderRole: "CUSTOMER",
        body: customerMessage,
      });
    }

    await createNotification({
      user: request.user.id,
      type: "PRODUCT_REQUEST",
      title: "Product request sent",
      body: `Your request for ${productName} is under review.`,
      link: `/account/product-requests/${productRequest.id}`,
      metadata: { productRequestId: productRequest.id, threadId: thread.id },
    });

    await productRequest.populate("chatThread");
    return response.status(201).json({ productRequest: serializeRequest(productRequest), supportThread: threadSummary(thread) });
  } catch (error) {
    if (thread) await SupportMessage.deleteMany({ thread: thread.id }).catch(() => {});
    if (thread) await SupportThread.deleteOne({ _id: thread.id }).catch(() => {});
    if (productRequest) await Notification.deleteMany({ "metadata.productRequestId": productRequest.id }).catch(() => {});
    if (productRequest) await ProductRequest.deleteOne({ _id: productRequest.id }).catch(() => {});
    throw error;
  }
}

export async function getMyProductRequests(request, response) {
  const requests = await ProductRequest.find({ user: request.user.id })
    .populate("chatThread")
    .sort({ createdAt: -1 });
  return response.json({ productRequests: requests.map(serializeRequest) });
}

export async function getMyProductRequest(request, response) {
  if (!isValidId(request.params.id)) return response.status(404).json({ message: "Product request not found." });
  const productRequest = await ProductRequest.findOne({ _id: request.params.id, user: request.user.id }).populate("chatThread");
  if (!productRequest) return response.status(404).json({ message: "Product request not found." });
  return response.json({ productRequest: serializeRequest(productRequest) });
}

export async function cancelMyProductRequest(request, response) {
  if (!isValidId(request.params.id)) return response.status(404).json({ message: "Product request not found." });
  const productRequest = await ProductRequest.findOne({ _id: request.params.id, user: request.user.id }).populate("chatThread");
  if (!productRequest) return response.status(404).json({ message: "Product request not found." });
  if (["Available", "Not Available", "Canceled"].includes(productRequest.status) || productRequest.resolvedAt) {
    return response.status(409).json({ message: "This product request can no longer be canceled." });
  }

  productRequest.status = "Canceled";
  productRequest.resolvedAt = new Date();
  productRequest.teamUpdates.push({ title: "Request canceled", date: new Date() });
  await productRequest.save();
  return response.json({ productRequest: serializeRequest(productRequest) });
}

export async function updateMyProductRequestDetails(request, response) {
  if (!isValidId(request.params.id)) return response.status(404).json({ message: "Product request not found." });
  const productRequest = await ProductRequest.findOne({ _id: request.params.id, user: request.user.id }).populate("chatThread");
  if (!productRequest) return response.status(404).json({ message: "Product request not found." });
  if (productRequest.status === "Canceled") return response.status(409).json({ message: "Canceled requests cannot be updated." });

  const note = cleanText(request.body?.note, 2000);
  const attachments = Array.isArray(request.body?.attachments)
    ? request.body.attachments.slice(0, 10).map((item) => ({
        name: cleanText(item?.name, 255),
        mimeType: cleanText(item?.mimeType, 120) || undefined,
        size: Number.isFinite(Number(item?.size)) ? Math.max(0, Number(item.size)) : undefined,
      })).filter((item) => item.name)
    : [];
  if (!note && attachments.length === 0) return response.status(400).json({ message: "Add a note or attachment metadata." });
  if (note) productRequest.notes = [productRequest.notes, note].filter(Boolean).join("\n");
  if (attachments.length) productRequest.attachments.push(...attachments);
  productRequest.teamUpdates.push({ title: note ? "Customer added request details" : "Customer added attachment metadata", date: new Date() });
  await productRequest.save();
  return response.json({ productRequest: serializeRequest(productRequest) });
}

export async function getAdminProductRequests(_request, response) {
  const requests = await ProductRequest.find().populate("user").populate("chatThread").sort({ createdAt: -1 });
  return response.json({ productRequests: requests.map(serializeRequest) });
}

export async function getAdminProductRequest(request, response) {
  if (!isValidId(request.params.id)) return response.status(404).json({ message: "Product request not found." });
  const productRequest = await ProductRequest.findById(request.params.id).populate("user").populate("chatThread");
  if (!productRequest) return response.status(404).json({ message: "Product request not found." });
  return response.json({ productRequest: serializeRequest(productRequest) });
}

export async function updateAdminProductRequestStatus(request, response) {
  const status = request.body?.status;
  if (!STATUSES.includes(status)) return response.status(400).json({ message: "Invalid product request status." });
  if (!isValidId(request.params.id)) return response.status(404).json({ message: "Product request not found." });

  const productRequest = await ProductRequest.findById(request.params.id).populate("user").populate("chatThread");
  if (!productRequest) return response.status(404).json({ message: "Product request not found." });

  const statusChanged = productRequest.status !== status;
  productRequest.status = status;
  productRequest.resolvedAt = ["Available", "Not Available", "Canceled"].includes(status) ? new Date() : undefined;
  if (statusChanged) productRequest.teamUpdates.push({ title: `Status changed to ${status}`, date: new Date() });
  await productRequest.save();

  if (statusChanged) {
    const isAvailable = status === "Available";
    await createNotification({
      user: productRequest.user.id,
      type: isAvailable ? "PRODUCT_AVAILABLE" : "PRODUCT_REQUEST",
      title: isAvailable ? "Product available" : "Product request updated",
      body: isAvailable
        ? `${productRequest.productName} is now available.`
        : `Your product request status is now ${status}.`,
      link: `/account/product-requests/${productRequest.id}`,
      metadata: { productRequestId: productRequest.id, threadId: productRequest.chatThread?.id },
    });

    if (isAvailable && productRequest.chatThread) {
      await SupportMessage.create({
        thread: productRequest.chatThread.id,
        senderRole: "SYSTEM",
        body: `${productRequest.productName} is now available. Support can help you complete the order.`,
      });
      productRequest.chatThread.lastMessageAt = new Date();
      productRequest.chatThread.status = "Waiting for Customer";
      await productRequest.chatThread.save();
      await sendEmailIfConfigured({ event: "PRODUCT_AVAILABLE" }).catch(() => {});
    }
  }

  return response.json({ productRequest: serializeRequest(productRequest) });
}
