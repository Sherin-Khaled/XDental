import { prisma } from "../config/db.js";
import {
  createSubmissionEmailDelivery,
  getEmailDeliveryMap,
} from "../services/email.service.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT_STATUSES = new Set(["NEW", "REVIEWED", "RESOLVED"]);
const CONTACT_SOURCES = new Set(["contact_page", "account", "machine_inquiry"]);

function cleanText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function toContactMessage(message, emailDelivery = null) {
  return {
    id: message.id,
    name: message.name,
    email: message.email,
    phone: message.phone,
    subject: message.subject,
    message: message.message,
    source: message.source,
    status: message.status,
    internalNotes: message.internalNotes ?? "",
    archivedAt: message.archivedAt ?? null,
    emailDelivery,
    user: message.user
      ? { id: message.user.id, name: message.user.name, email: message.user.email }
      : null,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}

/**
 * POST /api/contact — public endpoint for the contact page form.
 * Guests are allowed; a signed-in customer is linked via userId.
 */
export async function createContactMessage(request, response) {
  if (cleanText(request.body?.website, 200)) {
    return response.status(201).json({
      message: "Your message has been received. Our team will contact you soon.",
      contactMessage: { id: null, createdAt: new Date() },
    });
  }

  const name = cleanText(request.body?.name, 100);
  const email = cleanText(request.body?.email, 200).toLowerCase();
  const phone = cleanText(request.body?.phone, 30);
  const subject = cleanText(request.body?.subject, 200);
  const message = cleanText(request.body?.message, 3000);
  const requestedSource = cleanText(request.body?.source, 50);
  const source = CONTACT_SOURCES.has(requestedSource) ? requestedSource : "contact_page";

  if (name.length < 2) {
    return response.status(400).json({ message: "Please enter your name." });
  }

  if (message.length < 5) {
    return response.status(400).json({ message: "Please enter a message." });
  }

  if (!email && !phone) {
    return response.status(400).json({ message: "Provide an email address or phone number so we can reach you." });
  }

  if (email && !EMAIL_PATTERN.test(email)) {
    return response.status(400).json({ message: "Enter a valid email address." });
  }

  const created = await prisma.contactMessage.create({
    data: {
      name,
      email: email || null,
      phone: phone || null,
      subject: subject || null,
      message,
      source,
      userId: request.user?.id ?? null,
    },
  });

  const isMachineInquiry =
    source === "machine_inquiry" ||
    /\b(machine|equipment|device)\b/i.test(`${subject} ${message}`);
  await createSubmissionEmailDelivery({
    category: isMachineInquiry ? "MACHINE_INQUIRY" : "CONTACT",
    entityId: created.id,
    replyTo: email,
    payload: {
      name,
      email,
      phone,
      subject,
      message,
      reference: created.id,
      adminPath: "/admin/support",
    },
  });

  return response.status(201).json({
    message: "Your message has been received. Our team will contact you soon.",
    contactMessage: { id: created.id, createdAt: created.createdAt },
  });
}

/** GET /api/admin/contact-messages — newest first, optional status filter. */
export async function getAdminContactMessages(request, response) {
  const status = cleanText(request.query?.status, 20).toUpperCase();
  const search = cleanText(request.query?.search, 120);
  const includeArchived = request.query?.includeArchived === "true";
  const where = {
    ...(CONTACT_STATUSES.has(status) ? { status } : {}),
    ...(!includeArchived ? { archivedAt: null } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
            { subject: { contains: search, mode: "insensitive" } },
            { message: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const messages = await prisma.contactMessage.findMany({
    where,
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const ids = messages.map((message) => message.id);
  const [contactDeliveries, machineDeliveries] = await Promise.all([
    getEmailDeliveryMap("CONTACT", ids),
    getEmailDeliveryMap("MACHINE_INQUIRY", ids),
  ]);

  return response.json({
    contactMessages: messages.map((message) =>
      toContactMessage(
        message,
        contactDeliveries.get(message.id) ?? machineDeliveries.get(message.id) ?? null
      )
    ),
  });
}

/** PATCH /api/admin/contact-messages/:id — notes and recoverable archive state. */
export async function updateAdminContactMessage(request, response) {
  const data = {};
  if (Object.hasOwn(request.body ?? {}, "internalNotes")) {
    data.internalNotes = cleanText(request.body?.internalNotes, 5000) || null;
  }
  if (typeof request.body?.archived === "boolean") {
    data.archivedAt = request.body.archived ? new Date() : null;
  }
  if (Object.keys(data).length === 0) {
    return response.status(400).json({ message: "Provide internalNotes or archived." });
  }

  try {
    const updated = await prisma.contactMessage.update({
      where: { id: request.params.id },
      data,
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    const [contactDeliveries, machineDeliveries] = await Promise.all([
      getEmailDeliveryMap("CONTACT", [updated.id]),
      getEmailDeliveryMap("MACHINE_INQUIRY", [updated.id]),
    ]);
    return response.json({
      contactMessage: toContactMessage(
        updated,
        contactDeliveries.get(updated.id) ?? machineDeliveries.get(updated.id) ?? null
      ),
    });
  } catch (error) {
    if (error?.code === "P2025") {
      return response.status(404).json({ message: "Contact message not found." });
    }
    throw error;
  }
}

/** PATCH /api/admin/contact-messages/:id/status */
export async function updateAdminContactMessageStatus(request, response) {
  const status = cleanText(request.body?.status, 20).toUpperCase();
  if (!CONTACT_STATUSES.has(status)) {
    return response.status(400).json({ message: "Status must be NEW, REVIEWED, or RESOLVED." });
  }

  try {
    const updated = await prisma.contactMessage.update({
      where: { id: request.params.id },
      data: { status },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    const [contactDeliveries, machineDeliveries] = await Promise.all([
      getEmailDeliveryMap("CONTACT", [updated.id]),
      getEmailDeliveryMap("MACHINE_INQUIRY", [updated.id]),
    ]);
    return response.json({
      contactMessage: toContactMessage(
        updated,
        contactDeliveries.get(updated.id) ?? machineDeliveries.get(updated.id) ?? null
      ),
    });
  } catch (error) {
    if (error?.code === "P2025") {
      return response.status(404).json({ message: "Contact message not found." });
    }
    throw error;
  }
}
