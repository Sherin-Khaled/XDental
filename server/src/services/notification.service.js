import { prisma } from "../config/db.js";

export async function createNotification(input, database = prisma) {
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
  const staff = await database.user.findMany({
    where: { role: { in: ["ADMIN", "SUPPORT"] } },
    select: { id: true },
  });
  if (staff.length === 0) return [];

  await database.notification.createMany({
    data: staff.map(({ id }) => ({
      userId: id,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
      metadata: input.metadata ?? {},
    })),
  });
  return staff.map(({ id }) => id);
}
