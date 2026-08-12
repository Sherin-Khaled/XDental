import nodemailer from "nodemailer";
import { readMailConfiguration } from "../config/mail.js";
import { deliverNotificationPush } from "./notification.service.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendAccountActionEmail(
  communication,
  {
    configuration = readMailConfiguration(),
    createTransport = (options) => nodemailer.createTransport(options),
  } = {}
) {
  if (!configuration.enabled) {
    return { enabled: false, sent: false, skipped: true };
  }

  const recipient = String(communication?.recipient ?? "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(recipient)) {
    return { enabled: true, sent: false, skipped: true };
  }

  const transport = createTransport({
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

  try {
    await transport.sendMail({
      from: {
        name: configuration.from.name,
        address: configuration.from.email,
      },
      to: recipient,
      subject: communication.title,
      text: `${communication.title}\n\n${communication.body}`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.65;color:#242424"><h1 style="font-size:22px">${escapeHtml(communication.title)}</h1><p>${escapeHtml(communication.body)}</p></div>`,
    });
    return { enabled: true, sent: true };
  } catch {
    // Email is best-effort. The database request, audit history, and mandatory
    // in-app notification are already committed and remain authoritative.
    return { enabled: true, sent: false };
  }
}

export async function deliverAccountActionCommunications(communication) {
  if (!communication) return;
  await Promise.allSettled([
    deliverNotificationPush(communication.notification),
    sendAccountActionEmail(communication.email),
  ]);
}
