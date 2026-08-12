import { prisma } from "../../config/db.js";

export const SYNC_ENTITY_TYPES = {
  PRODUCT_IMPORT: "PRODUCT_CATALOG_IMPORT",
  ORDER_EXPORT: "CONFIRMED_ORDER_EXPORT",
  ORDER_EXPORT_MARK: "CONFIRMED_ORDER_EXPORT_MARK",
};

function parseDetails(message) {
  if (!message) return null;
  try {
    const details = JSON.parse(message);
    return details && typeof details === "object" ? details : { message };
  } catch {
    return { message };
  }
}

export function serializeSyncLog(log) {
  return {
    id: log.id,
    entityType: log.entityType,
    entityId: log.entityId ?? null,
    direction: log.direction,
    status: log.status,
    sourceSystem: log.sourceSystem ?? null,
    startedAt: log.createdAt,
    details: parseDetails(log.message),
    createdAt: log.createdAt,
  };
}

export async function startSync({ entityType, direction, sourceSystem, entityId = null }) {
  const startedAt = new Date();
  return prisma.syncLog.create({
    data: {
      entityType,
      entityId,
      direction,
      status: "PENDING",
      sourceSystem: sourceSystem || null,
      message: JSON.stringify({ version: 1, startedAt: startedAt.toISOString() }),
      createdAt: startedAt,
    },
  });
}

export async function recordSyncResult(logId, { status, summary = {}, errorSummary = null }) {
  if (!new Set(["SUCCESS", "FAILED"]).has(status)) {
    throw new Error("Sync result status must be SUCCESS or FAILED.");
  }
  const existing = await prisma.syncLog.findUnique({ where: { id: logId } });
  if (!existing) throw new Error("Sync log not found.");
  const completedAt = new Date();
  return prisma.syncLog.update({
    where: { id: logId },
    data: {
      status,
      message: JSON.stringify({
        version: 1,
        startedAt: existing.createdAt.toISOString(),
        completedAt: completedAt.toISOString(),
        ...summary,
        errorSummary,
      }),
    },
  });
}

export async function getSyncLogs({ limit = 50, entityType } = {}) {
  const logs = await prisma.syncLog.findMany({
    where: entityType ? { entityType } : undefined,
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(Number(limit) || 50, 1), 200),
  });
  return logs.map(serializeSyncLog);
}

export async function getSyncStatus() {
  const [lastProductImport, lastOrderExport] = await Promise.all([
    prisma.syncLog.findFirst({
      where: { entityType: SYNC_ENTITY_TYPES.PRODUCT_IMPORT },
      orderBy: { createdAt: "desc" },
    }),
    prisma.syncLog.findFirst({
      where: { entityType: SYNC_ENTITY_TYPES.ORDER_EXPORT },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return {
    mode: "MANUAL_CSV",
    automaticSyncEnabled: false,
    lastProductImport: lastProductImport ? serializeSyncLog(lastProductImport) : null,
    lastOrderExport: lastOrderExport ? serializeSyncLog(lastOrderExport) : null,
  };
}
