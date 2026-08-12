export const SUPPORT_AUTO_ACKNOWLEDGEMENT =
  "Thanks for contacting X Dental Store. Our support team received your message and will reply as soon as possible.";

export async function createFirstMessageAcknowledgement(database, threadId) {
  const [customerMessageCount, existingAcknowledgement] = await Promise.all([
    database.supportMessage.count({
      where: { threadId, senderRole: "CUSTOMER" },
    }),
    database.supportMessage.findFirst({
      where: {
        threadId,
        senderRole: "SYSTEM",
        body: SUPPORT_AUTO_ACKNOWLEDGEMENT,
      },
      select: { id: true },
    }),
  ]);

  if (customerMessageCount !== 1 || existingAcknowledgement) return null;

  return database.supportMessage.create({
    data: {
      threadId,
      senderRole: "SYSTEM",
      body: SUPPORT_AUTO_ACKNOWLEDGEMENT,
    },
    include: { sender: true },
  });
}
