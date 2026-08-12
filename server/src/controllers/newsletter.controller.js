import { prisma } from "../config/db.js";
import {
  createSubmissionEmailDelivery,
  getEmailDeliveryMap,
} from "../services/email.service.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NEWSLETTER_SOURCES = new Set(["home", "footer", "contact"]);
const NEWSLETTER_LOCALES = new Set(["en", "ar"]);

function cleanText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

/**
 * POST /api/newsletter/subscribe — public. Duplicate subscriptions are
 * treated as success so the form never leaks whether an email is registered.
 */
export async function subscribeToNewsletter(request, response) {
  if (cleanText(request.body?.website, 200)) {
    return response.status(201).json({
      message: "You are subscribed to the newsletter.",
      alreadySubscribed: false,
    });
  }

  const email = cleanText(request.body?.email, 200).toLowerCase();
  const requestedSource = cleanText(request.body?.source, 30);
  const requestedLocale = cleanText(request.body?.locale, 10).toLowerCase();

  if (!email || !EMAIL_PATTERN.test(email)) {
    return response.status(400).json({ message: "Enter a valid email address." });
  }

  const source = NEWSLETTER_SOURCES.has(requestedSource) ? requestedSource : null;
  const locale = NEWSLETTER_LOCALES.has(requestedLocale) ? requestedLocale : null;

  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });

  if (existing) {
    if (existing.status !== "SUBSCRIBED") {
      await prisma.newsletterSubscriber.update({
        where: { email },
        data: { status: "SUBSCRIBED", source: source ?? existing.source, locale: locale ?? existing.locale },
      });
    }
    return response.json({ message: "You are subscribed to the newsletter.", alreadySubscribed: true });
  }

  const created = await prisma.newsletterSubscriber.create({
    data: { email, source, locale },
  });

  await createSubmissionEmailDelivery({
    category: "NEWSLETTER",
    entityId: created.id,
    replyTo: email,
    payload: {
      email,
      subject: "Newsletter subscription",
      reference: created.id,
      message: `Source: ${source || "unknown"}\nLocale: ${locale || "unknown"}`,
      adminPath: "/admin/settings",
    },
  });

  return response.status(201).json({ message: "You are subscribed to the newsletter.", alreadySubscribed: false });
}

/** GET /api/admin/newsletter-subscribers — newest first. */
export async function getAdminNewsletterSubscribers(_request, response) {
  const subscribers = await prisma.newsletterSubscriber.findMany({
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  const emailDeliveries = await getEmailDeliveryMap(
    "NEWSLETTER",
    subscribers.map((subscriber) => subscriber.id)
  );

  return response.json({
    subscribers: subscribers.map((subscriber) => ({
      id: subscriber.id,
      email: subscriber.email,
      source: subscriber.source,
      locale: subscriber.locale,
      status: subscriber.status,
      emailDelivery: emailDeliveries.get(subscriber.id) ?? null,
      createdAt: subscriber.createdAt,
    })),
  });
}
