import { prisma } from "../config/db.js";
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
