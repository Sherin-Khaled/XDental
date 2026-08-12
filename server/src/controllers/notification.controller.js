import { prisma } from "../config/db.js";
import {
  getPublicPushConfiguration,
  readPushConfiguration,
} from "../config/push.js";
import {
  PushSubscriptionInputError,
  removePushSubscription,
  savePushSubscription,
} from "../services/pushSubscription.service.js";
import { isValidId } from "../utils/records.js";

function serializeNotification(notification) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    link: notification.link ?? null,
    readAt: notification.readAt ?? null,
    metadata: notification.metadata ?? {},
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
  };
}

function requireCustomer(request, response) {
  if (request.user?.role?.toLowerCase() !== "customer") {
    response.status(403).json({ message: "Customer account required." });
    return false;
  }
  return true;
}

export function getPushConfiguration(request, response) {
  if (!requireCustomer(request, response)) return;
  const configuration = readPushConfiguration();
  return response.json(getPublicPushConfiguration(configuration));
}

export async function subscribeToPushNotifications(request, response) {
  if (!requireCustomer(request, response)) return;
  const configuration = readPushConfiguration();
  if (!configuration.enabled) {
    return response.status(503).json({
      code: "PUSH_NOT_CONFIGURED",
      message: "Browser push notifications are not configured yet.",
    });
  }

  try {
    await savePushSubscription({
      userId: request.user.id,
      subscription: request.body,
    });
    return response.json({ subscribed: true });
  } catch (error) {
    if (error instanceof PushSubscriptionInputError) {
      return response.status(400).json({
        code: error.code,
        message: error.message,
      });
    }
    throw error;
  }
}

export async function unsubscribeFromPushNotifications(request, response) {
  if (!requireCustomer(request, response)) return;

  try {
    await removePushSubscription({
      userId: request.user.id,
      endpoint: request.body?.endpoint,
    });
    return response.json({ unsubscribed: true });
  } catch (error) {
    if (error instanceof PushSubscriptionInputError) {
      return response.status(400).json({
        code: error.code,
        message: error.message,
      });
    }
    throw error;
  }
}

export async function getMyNotifications(request, response) {
  const notifications = await prisma.notification.findMany({
    where: { userId: request.user.id },
    orderBy: { createdAt: "desc" },
  });
  return response.json({ notifications: notifications.map(serializeNotification) });
}

export async function markNotificationRead(request, response) {
  if (!isValidId(request.params.id)) {
    return response.status(404).json({ message: "Notification not found." });
  }

  const result = await prisma.notification.updateMany({
    where: { id: request.params.id, userId: request.user.id },
    data: { readAt: new Date() },
  });
  if (result.count === 0) {
    return response.status(404).json({ message: "Notification not found." });
  }

  const notification = await prisma.notification.findUnique({ where: { id: request.params.id } });
  return response.json({ notification: serializeNotification(notification) });
}

export async function markAllNotificationsRead(request, response) {
  const now = new Date();
  const result = await prisma.notification.updateMany({
    where: { userId: request.user.id, readAt: null },
    data: { readAt: now },
  });
  return response.json({ updatedCount: result.count, readAt: now });
}
