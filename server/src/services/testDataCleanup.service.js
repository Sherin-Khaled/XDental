const PROTECTED_EMAILS = new Set(["admin@xdental.local"]);

const SMOKE_NAME_FRAGMENTS = [
  "smoke test customer",
  "other smoke customer",
  "order smoke customer",
];

const GENERATED_LOCAL_EMAIL_PATTERNS = [
  {
    pattern: /^checkout\.verify(?:\+|$)/,
    reason: "local checkout verifier email",
  },
  {
    pattern: /^admin-order\.verify(?:\+|$)/,
    reason: "local admin-order verifier email",
  },
  {
    pattern: /^flow\.customer(?:\+|$)/,
    reason: "local product-request flow email",
  },
  {
    pattern: /^notification\.flow(?:\+|$)/,
    reason: "local notification flow email",
  },
];

const EMPTY_COUNTS = Object.freeze({
  notifications: 0,
  supportMessages: 0,
  supportThreads: 0,
  productRequests: 0,
  orderItems: 0,
  orders: 0,
  quoteItems: 0,
  quotes: 0,
  users: 0,
});

function unique(values) {
  return [...new Set(values)];
}

export function getTestUserMatchReasons(user) {
  const email = user.email.trim().toLowerCase();
  if (PROTECTED_EMAILS.has(email)) return [];

  const name = user.name.trim().toLowerCase();
  const reasons = [];

  for (const fragment of SMOKE_NAME_FRAGMENTS) {
    if (name.includes(fragment)) reasons.push(`name contains "${fragment}"`);
  }

  if (email.startsWith("smoke.customer+")) {
    reasons.push("email starts with smoke.customer+");
  }
  if (email.startsWith("order.smoke")) {
    reasons.push("email starts with order.smoke");
  }

  const separatorIndex = email.lastIndexOf("@");
  const localPart = separatorIndex >= 0 ? email.slice(0, separatorIndex) : email;
  const domain = separatorIndex >= 0 ? email.slice(separatorIndex + 1) : "";

  if (domain === "xdental.local") {
    if (/(^|[.+_-])smoke(?:[.+_-]|$)/.test(localPart)) {
      reasons.push("clearly generated local smoke email");
    }

    for (const { pattern, reason } of GENERATED_LOCAL_EMAIL_PATTERNS) {
      if (pattern.test(localPart)) reasons.push(reason);
    }
  }

  return unique(reasons);
}

export async function findTestUsers(client) {
  const users = await client.user.findMany({
    orderBy: [{ createdAt: "asc" }, { email: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  return users.flatMap((user) => {
    const reasons = getTestUserMatchReasons(user);
    return reasons.length > 0 ? [{ ...user, reasons }] : [];
  });
}

async function collectOwnedIds(client, userIds) {
  const [orders, quotes, productRequests, supportThreads] = await Promise.all([
    client.order.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    }),
    client.quote.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    }),
    client.productRequest.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    }),
    client.supportThread.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    }),
  ]);

  const ownedIds = {
    orderIds: orders.map(({ id }) => id),
    quoteIds: quotes.map(({ id }) => id),
    productRequestIds: productRequests.map(({ id }) => id),
    supportThreadIds: supportThreads.map(({ id }) => id),
  };
  const referenceIds = new Set([
    ...ownedIds.orderIds,
    ...ownedIds.quoteIds,
    ...ownedIds.productRequestIds,
    ...ownedIds.supportThreadIds,
    ...userIds,
  ]);
  const notifications = await client.notification.findMany({
    select: { id: true, userId: true, metadata: true },
  });

  return {
    ...ownedIds,
    notificationIds: notifications
      .filter(({ userId, metadata }) => {
        if (userIds.includes(userId)) return true;
        if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
        return ["orderId", "quoteId", "productRequestId", "threadId", "userId", "customerId"].some(
          (key) => typeof metadata[key] === "string" && referenceIds.has(metadata[key])
        );
      })
      .map(({ id }) => id),
  };
}

function supportMessageWhere(userIds, supportThreadIds) {
  return {
    OR: [
      { senderId: { in: userIds } },
      { threadId: { in: supportThreadIds } },
    ],
  };
}

async function countOwnedData(client, userIds, ownedIds) {
  const { notificationIds, orderIds, quoteIds, supportThreadIds } = ownedIds;
  const [
    notifications,
    supportMessages,
    supportThreads,
    productRequests,
    orderItems,
    orders,
    quoteItems,
    quotes,
    users,
  ] = await Promise.all([
    client.notification.count({ where: { id: { in: notificationIds } } }),
    client.supportMessage.count({
      where: supportMessageWhere(userIds, supportThreadIds),
    }),
    client.supportThread.count({ where: { id: { in: supportThreadIds } } }),
    client.productRequest.count({ where: { userId: { in: userIds } } }),
    client.orderItem.count({ where: { orderId: { in: orderIds } } }),
    client.order.count({ where: { id: { in: orderIds } } }),
    client.quoteItem.count({ where: { quoteId: { in: quoteIds } } }),
    client.quote.count({ where: { id: { in: quoteIds } } }),
    client.user.count({ where: { id: { in: userIds } } }),
  ]);

  return {
    notifications,
    supportMessages,
    supportThreads,
    productRequests,
    orderItems,
    orders,
    quoteItems,
    quotes,
    users,
  };
}

export async function previewUserOwnedData(client, ids) {
  const userIds = unique(ids.filter(Boolean));
  if (userIds.length === 0) return { ...EMPTY_COUNTS };

  const ownedIds = await collectOwnedIds(client, userIds);
  return countOwnedData(client, userIds, ownedIds);
}

export async function deleteUsersAndOwnedData(client, ids) {
  const userIds = unique(ids.filter(Boolean));
  if (userIds.length === 0) return { ...EMPTY_COUNTS };

  return client.$transaction(async (transaction) => {
    const ownedIds = await collectOwnedIds(transaction, userIds);
    const { notificationIds, orderIds, quoteIds, supportThreadIds } = ownedIds;

    const notifications = await transaction.notification.deleteMany({
      where: { id: { in: notificationIds } },
    });
    const supportMessages = await transaction.supportMessage.deleteMany({
      where: supportMessageWhere(userIds, supportThreadIds),
    });
    const quoteItems = await transaction.quoteItem.deleteMany({
      where: { quoteId: { in: quoteIds } },
    });
    const quotes = await transaction.quote.deleteMany({
      where: { id: { in: quoteIds } },
    });
    const productRequests = await transaction.productRequest.deleteMany({
      where: { userId: { in: userIds } },
    });
    const supportThreads = await transaction.supportThread.deleteMany({
      where: { id: { in: supportThreadIds } },
    });
    const orderItems = await transaction.orderItem.deleteMany({
      where: { orderId: { in: orderIds } },
    });
    const orders = await transaction.order.deleteMany({
      where: { id: { in: orderIds } },
    });
    const users = await transaction.user.deleteMany({
      where: { id: { in: userIds } },
    });

    return {
      notifications: notifications.count,
      supportMessages: supportMessages.count,
      supportThreads: supportThreads.count,
      productRequests: productRequests.count,
      orderItems: orderItems.count,
      orders: orders.count,
      quoteItems: quoteItems.count,
      quotes: quotes.count,
      users: users.count,
    };
  });
}
