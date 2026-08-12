import nodemailer from "nodemailer";
import { prisma } from "../config/db.js";
import {
  getNotificationRecipient,
  readMailConfiguration,
} from "../config/mail.js";
import { buildSubmissionEmail } from "./emailTemplates.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RETRY_THROTTLE_MS = 60_000;
const MAX_ERROR_LENGTH = 500;

function createSmtpTransport(configuration) {
  return nodemailer.createTransport({
    host: configuration.smtp.host,
    port: configuration.smtp.port,
    secure: configuration.smtp.secure,
    disableFileAccess: true,
    disableUrlAccess: true,
    auth: {
      user: configuration.smtp.user,
      pass: configuration.smtp.pass,
    },
    connectionTimeout: configuration.smtp.connectionTimeout,
    greetingTimeout: configuration.smtp.greetingTimeout,
    socketTimeout: configuration.smtp.socketTimeout,
  });
}

let transportFactory = createSmtpTransport;

function sanitizeEmail(value) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return EMAIL_PATTERN.test(email) ? email : null;
}

function normalizeMailError(error) {
  const candidate =
    error && typeof error === "object"
      ? [error.code, error.command, error.responseCode, error.message]
          .filter(Boolean)
          .join(" | ")
      : String(error ?? "Unknown SMTP error");
  return candidate
    .replace(/(pass(word)?|auth(entication)?|credential|secret|token)\s*[=:]\s*[^\s|]+/gi, "$1=[redacted]")
    .slice(0, MAX_ERROR_LENGTH);
}

function serializeDelivery(delivery) {
  return {
    id: delivery.id,
    category: delivery.category,
    entityId: delivery.entityId,
    status: delivery.status,
    recipient: delivery.recipient,
    replyTo: delivery.replyTo,
    subject: delivery.subject,
    retryCount: delivery.retryCount,
    lastAttemptAt: delivery.lastAttemptAt,
    lastRetryAt: delivery.lastRetryAt,
    sentAt: delivery.sentAt,
    errorMessage: delivery.errorMessage,
    createdAt: delivery.createdAt,
    updatedAt: delivery.updatedAt,
  };
}

async function sendDelivery(delivery, {
  database = prisma,
  configuration = readMailConfiguration(),
  transport,
} = {}) {
  const recipient = getNotificationRecipient(delivery.category, configuration);
  const template = buildSubmissionEmail({
    category: delivery.category,
    payload: delivery.payload,
    appBaseUrl: configuration.appBaseUrl,
  });
  const replyTo = sanitizeEmail(delivery.replyTo);
  const attemptTime = new Date();

  await database.emailDelivery.update({
    where: { id: delivery.id },
    data: {
      status: "PENDING",
      recipient,
      subject: template.subject,
      errorMessage: null,
      lastAttemptAt: attemptTime,
    },
  });

  try {
    const mailTransport = transport ?? transportFactory(configuration);
    await mailTransport.sendMail({
      from: {
        name: configuration.from.name,
        address: configuration.from.email,
      },
      to: recipient,
      ...(replyTo ? { replyTo } : {}),
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    const sent = await database.emailDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        errorMessage: null,
      },
    });
    return { delivery: serializeDelivery(sent), sent: true };
  } catch (error) {
    const failed = await database.emailDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "FAILED",
        errorMessage: normalizeMailError(error),
      },
    });
    return { delivery: serializeDelivery(failed), sent: false };
  }
}

export async function createSubmissionEmailDelivery({
  category,
  entityId,
  payload,
  replyTo,
  database = prisma,
  configuration = readMailConfiguration(),
  transport,
}) {
  const template = buildSubmissionEmail({
    category,
    payload,
    appBaseUrl: configuration.appBaseUrl,
  });
  const recipient = getNotificationRecipient(category, configuration) || null;
  const safeReplyTo = sanitizeEmail(replyTo);
  const initialStatus = configuration.enabled ? "PENDING" : "DISABLED";

  const delivery = await database.emailDelivery.upsert({
    where: { category_entityId: { category, entityId } },
    create: {
      category,
      entityId,
      status: initialStatus,
      recipient,
      replyTo: safeReplyTo,
      subject: template.subject,
      payload,
    },
    update: {
      status: initialStatus,
      recipient,
      replyTo: safeReplyTo,
      subject: template.subject,
      payload,
      errorMessage: null,
    },
  });

  if (!configuration.enabled) {
    return { delivery: serializeDelivery(delivery), sent: false, skipped: true, reason: "disabled" };
  }

  return sendDelivery(delivery, { database, configuration, transport });
}

export async function retryEmailDelivery(id, {
  database = prisma,
  configuration = readMailConfiguration(),
  transport,
  now = new Date(),
} = {}) {
  const existing = await database.emailDelivery.findUnique({ where: { id } });
  if (!existing) {
    const error = new Error("Email delivery record not found.");
    error.code = "EMAIL_DELIVERY_NOT_FOUND";
    throw error;
  }

  if (!configuration.enabled) {
    const disabled = await database.emailDelivery.update({
      where: { id },
      data: { status: "DISABLED", errorMessage: null },
    });
    return {
      delivery: serializeDelivery(disabled),
      sent: false,
      skipped: true,
      reason: "disabled",
    };
  }

  if (
    existing.lastRetryAt &&
    now.getTime() - new Date(existing.lastRetryAt).getTime() < RETRY_THROTTLE_MS
  ) {
    const error = new Error("Please wait before retrying this email again.");
    error.code = "EMAIL_RETRY_THROTTLED";
    throw error;
  }

  const pending = await database.emailDelivery.update({
    where: { id },
    data: {
      status: "PENDING",
      retryCount: { increment: 1 },
      lastRetryAt: now,
      errorMessage: null,
    },
  });
  return sendDelivery(pending, { database, configuration, transport });
}

export async function getEmailDeliveries({ category, status, search, take = 300 } = {}, database = prisma) {
  const deliveries = await database.emailDelivery.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { recipient: { contains: search, mode: "insensitive" } },
              { subject: { contains: search, mode: "insensitive" } },
              { entityId: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
  });
  return deliveries.map(serializeDelivery);
}

export async function getEmailDeliveryMap(category, entityIds, database = prisma) {
  if (!Array.isArray(entityIds) || entityIds.length === 0) return new Map();
  const deliveries = await database.emailDelivery.findMany({
    where: { category, entityId: { in: entityIds } },
  });
  return new Map(deliveries.map((delivery) => [delivery.entityId, serializeDelivery(delivery)]));
}

export function setMailTransportFactoryForTests(factory) {
  transportFactory = factory;
}

export function resetMailTransportFactoryForTests() {
  transportFactory = createSmtpTransport;
}
