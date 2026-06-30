import { Notification } from "../models/Notification.js";
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
  const notifications = await Notification.find({ user: request.user.id }).sort({ createdAt: -1 });
  return response.json({ notifications: notifications.map(serializeNotification) });
}

export async function markNotificationRead(request, response) {
  if (!isValidId(request.params.id)) return response.status(404).json({ message: "Notification not found." });
  const notification = await Notification.findOneAndUpdate(
    { _id: request.params.id, user: request.user.id },
    { $set: { readAt: new Date() } },
    { new: true }
  );
  if (!notification) return response.status(404).json({ message: "Notification not found." });
  return response.json({ notification: serializeNotification(notification) });
}

export async function markAllNotificationsRead(request, response) {
  const now = new Date();
  const result = await Notification.updateMany({ user: request.user.id, readAt: null }, { $set: { readAt: now } });
  return response.json({ updatedCount: result.modifiedCount, readAt: now });
}
