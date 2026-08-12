import webpush from "web-push";
import { prisma } from "../config/db.js";
import { readPushConfiguration } from "../config/push.js";

function cleanText(value, maximumLength) {
  return typeof value === "string" ? value.trim().slice(0, maximumLength) : "";
}

function safeLink(value) {
  const link = cleanText(value, 500);
  return link.startsWith("/") && !link.startsWith("//") ? link : "/";
}

export function createPushPayload(input) {
  return JSON.stringify({
    title: cleanText(input.title, 120) || "X Dental Store",
    body: cleanText(input.body, 240) || "You have a new account update.",
    link: safeLink(input.link),
    tag: cleanText(input.tag, 80) || "x-dental-account-update",
  });
}

export async function sendPushNotificationToUser(
  input,
  {
    database = prisma,
    configuration = readPushConfiguration(),
    sendNotification = (...argumentsList) => webpush.sendNotification(...argumentsList),
  } = {}
) {
  if (!configuration.enabled) {
    return { enabled: false, sentCount: 0, failedCount: 0, removedCount: 0 };
  }

  const subscriptions = await database.pushSubscription.findMany({
    where: { userId: input.userId },
    select: {
      id: true,
      endpoint: true,
      p256dh: true,
      auth: true,
    },
  });
  if (subscriptions.length === 0) {
    return { enabled: true, sentCount: 0, failedCount: 0, removedCount: 0 };
  }

  const payload = createPushPayload(input);
  const results = await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload,
          {
            TTL: 300,
            urgency: "normal",
            timeout: 5_000,
            vapidDetails: {
              subject: configuration.subject,
              publicKey: configuration.publicKey,
              privateKey: configuration.privateKey,
            },
          }
        );
        return { id: subscription.id, sent: true, expired: false };
      } catch (error) {
        const statusCode = Number(error?.statusCode);
        return {
          id: subscription.id,
          sent: false,
          expired: statusCode === 404 || statusCode === 410,
        };
      }
    })
  );

  const expiredIds = results.filter((result) => result.expired).map((result) => result.id);
  let removedCount = 0;
  if (expiredIds.length > 0) {
    const removed = await database.pushSubscription.deleteMany({
      where: {
        userId: input.userId,
        id: { in: expiredIds },
      },
    });
    removedCount = removed.count;
  }

  return {
    enabled: true,
    sentCount: results.filter((result) => result.sent).length,
    failedCount: results.filter((result) => !result.sent).length,
    removedCount,
  };
}
