export const PERMISSION_GROUPS = {
  SUPPORT_INBOX: [
    "SUPPORT_INBOX_VIEW",
    "SUPPORT_INBOX_REPLY",
    "SUPPORT_INBOX_ASSIGN",
    "SUPPORT_INBOX_CLOSE",
  ],
  ORDERS: ["ORDERS_VIEW", "ORDERS_UPDATE_STATUS"],
  QUOTES: ["QUOTES_VIEW", "QUOTES_REPLY", "QUOTES_APPROVE"],
  PRODUCT_REQUESTS: [
    "PRODUCT_REQUESTS_VIEW",
    "PRODUCT_REQUESTS_REPLY",
    "PRODUCT_REQUESTS_UPDATE",
  ],
  CUSTOMERS: ["USERS_VIEW", "CUSTOMER_PROFILE_VIEW"],
  NOTIFICATIONS: ["NOTIFICATIONS_SEND"],
  ACCOUNT_REQUESTS: ["ACCOUNT_REQUESTS_VIEW", "ACCOUNT_REQUESTS_MANAGE"],
  ACCOUNT_LIFECYCLE: ["ACCOUNT_LIFECYCLE_VIEW", "ACCOUNT_LIFECYCLE_MANAGE"],
  LOYALTY: ["LOYALTY_VIEW", "LOYALTY_MANAGE"],
};

export const PERMISSION_KEYS = Object.freeze(Object.values(PERMISSION_GROUPS).flat());
export const PERMISSION_KEY_SET = new Set(PERMISSION_KEYS);

export const PERMISSION_PRESETS = Object.freeze({
  SUPPORT_VIEWER: [
    "SUPPORT_INBOX_VIEW",
    "ORDERS_VIEW",
    "QUOTES_VIEW",
    "PRODUCT_REQUESTS_VIEW",
  ],
  SUPPORT_AGENT: [
    "SUPPORT_INBOX_VIEW",
    "SUPPORT_INBOX_REPLY",
    "ORDERS_VIEW",
    "QUOTES_VIEW",
    "QUOTES_REPLY",
    "PRODUCT_REQUESTS_VIEW",
    "PRODUCT_REQUESTS_REPLY",
    "PRODUCT_REQUESTS_UPDATE",
    "CUSTOMER_PROFILE_VIEW",
  ],
  SUPPORT_MANAGER: [
    "SUPPORT_INBOX_VIEW",
    "SUPPORT_INBOX_REPLY",
    "SUPPORT_INBOX_ASSIGN",
    "SUPPORT_INBOX_CLOSE",
    "ORDERS_VIEW",
    "ORDERS_UPDATE_STATUS",
    "QUOTES_VIEW",
    "QUOTES_REPLY",
    "QUOTES_APPROVE",
    "PRODUCT_REQUESTS_VIEW",
    "PRODUCT_REQUESTS_REPLY",
    "PRODUCT_REQUESTS_UPDATE",
    "USERS_VIEW",
    "CUSTOMER_PROFILE_VIEW",
    "NOTIFICATIONS_SEND",
  ],
});

export function normalizePermissionKeys(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((key) => String(key).trim().toUpperCase()).filter(Boolean))];
}

export function invalidPermissionKeys(keys) {
  return keys.filter((key) => !PERMISSION_KEY_SET.has(key));
}

export async function replaceUserPermissions(database, userId, keys, grantedById) {
  const normalized = normalizePermissionKeys(keys);
  const invalid = invalidPermissionKeys(normalized);
  if (invalid.length) {
    const error = new Error(`Unsupported permission key: ${invalid[0]}`);
    error.statusCode = 400;
    error.field = "permissions";
    throw error;
  }

  const permissions = normalized.length
    ? await database.permission.findMany({
        where: { key: { in: normalized } },
        select: { id: true, key: true },
      })
    : [];

  if (permissions.length !== normalized.length) {
    const error = new Error("Permission seed is incomplete. Run the permission seed.");
    error.statusCode = 503;
    throw error;
  }

  await database.userPermission.deleteMany({ where: { userId } });
  if (permissions.length) {
    await database.userPermission.createMany({
      data: permissions.map((permission) => ({
        userId,
        permissionId: permission.id,
        grantedById,
      })),
    });
  }
  await database.user.update({
    where: { id: userId },
    data: {
      permissionsUpdatedAt: new Date(),
      permissionsUpdatedById: grantedById,
    },
  });
}
