import { createHash } from "node:crypto";
import { prisma } from "../config/db.js";
import { sendPushNotificationToUser } from "./pushNotification.service.js";
import { shouldCreateNotification } from "./accountPreference.service.js";

export async function createNotification(input, database = prisma) {
  if (!(await shouldCreateNotification(input, database))) return null;
  return database.notification.create({
    data: {
      userId: input.userId ?? input.user,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
      metadata: input.metadata ?? {},
    },
  });
}

export async function notifyStaff(input, database = prisma) {
  const permissionKey =
    typeof input.permissionKey === "string" && input.permissionKey.trim()
      ? input.permissionKey.trim()
      : null;
  const staff = await database.user.findMany({
    where: permissionKey
      ? {
          OR: [
            { role: "ADMIN" },
            {
              role: "SUPPORT",
              permissions: {
                some: { permission: { key: permissionKey } },
              },
            },
          ],
        }
      : { role: { in: ["ADMIN", "SUPPORT"] } },
    select: { id: true },
  });
  const recipientIds = [...new Set(staff.map(({ id }) => id).filter(Boolean))];
  if (recipientIds.length === 0) return [];

  const dedupeKey =
    typeof input.dedupeKey === "string" && input.dedupeKey.trim()
      ? input.dedupeKey.trim()
      : null;
  let existingRecipientIds = new Set();
  if (dedupeKey) {
    const existing = await database.notification.findMany({
      where: {
        userId: { in: recipientIds },
        metadata: { path: ["dedupeKey"], equals: dedupeKey },
      },
      select: { userId: true },
    });
    existingRecipientIds = new Set(existing.map(({ userId }) => userId));
  }

  const pendingRecipientIds = recipientIds.filter(
    (userId) => !existingRecipientIds.has(userId)
  );
  if (pendingRecipientIds.length === 0) return [];

  await database.notification.createMany({
    data: pendingRecipientIds.map((userId) => ({
      ...(dedupeKey
        ? {
            id: `staff_${createHash("sha256")
              .update(`x-dental-staff-notification:v1:${dedupeKey}:${userId}`)
              .digest("hex")
              .slice(0, 48)}`,
          }
        : {}),
      userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
      metadata: {
        ...(input.metadata ?? {}),
        ...(dedupeKey ? { dedupeKey } : {}),
      },
    })),
    ...(dedupeKey ? { skipDuplicates: true } : {}),
  });
  return pendingRecipientIds;
}

export async function deliverNotificationPush(
  notification,
  sendNotification = sendPushNotificationToUser
) {
  if (!notification?.userId) {
    return { enabled: false, sentCount: 0, failedCount: 0, removedCount: 0 };
  }

  try {
    return await sendNotification({
      userId: notification.userId,
      title: notification.title,
      body: notification.body,
      link: notification.link,
      tag: `notification-${notification.id}`,
    });
  } catch {
    // The database notification has already committed. Browser delivery is
    // best-effort and must never fail the order, quote, request, or support API.
    return { enabled: true, sentCount: 0, failedCount: 1, removedCount: 0 };
  }
}
