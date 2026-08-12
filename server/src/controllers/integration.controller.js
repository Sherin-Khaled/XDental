import {
  exportConfirmedOrders,
  getProductImportTemplateCsv,
  getSyncLogs,
  getSyncStatus,
  importProductsFromCsv,
} from "../services/integrations/ownerSystem.adapter.js";
import { withUtf8Bom } from "../utils/csv.js";
import { cleanText, isValidId } from "../utils/records.js";
import { applyCatalogImportBatch, previewCatalogImport } from "../services/catalogImport.service.js";
import { previewCatalogImportFromExcel } from "../services/catalogImportExcel.service.js";
import { prisma } from "../config/db.js";

function booleanOption(value) {
  return value === true || (typeof value === "string" && value.toLowerCase() === "true");
}

function integrationError(response, error) {
  const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  return response.status(status).json({
    message: status < 500 && error instanceof Error ? error.message : "Owner-system integration operation failed.",
  });
}

export async function getAdminIntegrationStatus(_request, response) {
  return response.json({ integration: await getSyncStatus() });
}

export async function getAdminIntegrationLogs(request, response) {
  const limit = Math.min(Math.max(Number(request.query?.limit) || 50, 1), 200);
  const entityType = cleanText(request.query?.entityType, 100) || undefined;
  return response.json({ logs: await getSyncLogs({ limit, entityType }) });
}

export function downloadProductImportTemplate(_request, response) {
  response.setHeader("Content-Type", "text/csv; charset=utf-8");
  response.setHeader("Content-Disposition", 'attachment; filename="x-dental-product-import-template.csv"');
  return response.send(getProductImportTemplateCsv());
}

export async function importAdminProductsCsv(request, response) {
  const payload = request.body && typeof request.body === "object" ? request.body : {};
  const csv = typeof request.body === "string" ? request.body : payload.csv;
  const rawOptions = payload.options && typeof payload.options === "object" ? payload.options : payload;
  const options = {
    sourceSystem: cleanText(rawOptions.sourceSystem ?? request.query?.sourceSystem, 120),
    createMissingLookups: booleanOption(
      rawOptions.createMissingLookups ?? request.query?.createMissingLookups
    ),
    markMissingInactive: booleanOption(rawOptions.markMissingInactive ?? request.query?.markMissingInactive),
  };

  try {
    const result = await importProductsFromCsv(csv, options);
    return response.json({ import: result });
  } catch (error) {
    return integrationError(response, error);
  }
}

export async function exportAdminConfirmedOrders(request, response) {
  const status = cleanText(request.query?.status, 50).toUpperCase() || "CONFIRMED";
  try {
    const result = await exportConfirmedOrders({ status });
    const date = new Date().toISOString().slice(0, 10);
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="x-dental-confirmed-orders-${date}.csv"`);
    response.setHeader("X-Exported-Order-Count", String(result.orderCount));
    response.setHeader("X-Exported-Item-Count", String(result.itemCount));
    response.setHeader("X-Sync-Log-Id", result.syncLogId);
    return response.send(withUtf8Bom(result.csv));
  } catch (error) {
    return integrationError(response, error);
  }
}

function catalogImportError(response, error) {
  const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  return response.status(status).json({ message: status < 500 ? error.message : "Catalog import could not be processed." });
}

export async function previewAdminCatalogImport(request, response) {
  try {
    const preview = await previewCatalogImport(
      prisma,
      {
        sourceSystem: cleanText(request.body?.sourceSystem, 120),
        filename: cleanText(request.body?.filename, 300) || null,
        entities: request.body?.entities,
        createdById: request.user.id,
      }
    );
    return response.status(201).json({ preview });
  } catch (error) {
    return catalogImportError(response, error);
  }
}

export async function previewAdminCatalogImportExcel(request, response) {
  try {
    const preview = await previewCatalogImportFromExcel(prisma, {
      workbookBuffer: request.body,
      sourceSystem: cleanText(request.query?.sourceSystem, 120),
      filename: cleanText(request.query?.filename, 300) || null,
      createdById: request.user.id,
    });
    return response.status(201).json({ preview });
  } catch (error) {
    if (Array.isArray(error?.workbookProblems)) {
      return response.status(422).json({ message: error.message, workbookProblems: error.workbookProblems });
    }
    return catalogImportError(response, error);
  }
}

export async function applyAdminCatalogImport(request, response) {
  try {
    const result = await applyCatalogImportBatch(
      prisma,
      { batchId: cleanText(request.params.batchId, 200), confirmed: request.body?.confirmed === true, actorId: request.user.id }
    );
    return response.json({ batch: result });
  } catch (error) {
    return catalogImportError(response, error);
  }
}

function serializeImportBatchSummary(batch) {
  return {
    id: batch.id,
    sourceSystem: batch.sourceSystem,
    filename: batch.filename ?? null,
    status: batch.status,
    dryRun: batch.dryRun,
    totalRows: batch.totalRows,
    validRows: batch.validRows,
    warningRows: batch.warningRows,
    errorRows: batch.errorRows,
    createdBy: batch.createdBy ? { id: batch.createdBy.id, name: batch.createdBy.name } : null,
    createdAt: batch.createdAt,
    appliedAt: batch.appliedAt ?? null,
  };
}

/** Read-only import audit trail: never mutates a batch or its rows. */
export async function getAdminCatalogImportBatches(request, response) {
  const limit = Math.min(Math.max(Number(request.query?.limit) || 50, 1), 200);
  const batches = await prisma.catalogImportBatch.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  return response.json({ batches: batches.map(serializeImportBatchSummary) });
}

export async function getAdminCatalogImportBatch(request, response) {
  if (!isValidId(request.params.batchId)) return response.status(404).json({ message: "Import batch not found." });
  const entityType = cleanText(request.query?.entityType, 60).toUpperCase() || undefined;
  const action = cleanText(request.query?.action, 20).toUpperCase() || undefined;
  const batch = await prisma.catalogImportBatch.findUnique({
    where: { id: request.params.batchId },
    include: {
      createdBy: { select: { id: true, name: true } },
      rows: {
        where: { ...(entityType ? { entityType } : {}), ...(action ? { action } : {}) },
        orderBy: [{ entityType: "asc" }, { rowNumber: "asc" }],
        take: 500,
      },
    },
  });
  if (!batch) return response.status(404).json({ message: "Import batch not found." });
  return response.json({
    batch: {
      ...serializeImportBatchSummary(batch),
      rows: batch.rows.map((row) => ({
        id: row.id,
        entityType: row.entityType,
        rowNumber: row.rowNumber,
        externalId: row.externalId,
        sku: row.sku,
        action: row.action,
        validationMessages: row.validationMessages,
      })),
    },
  });
}
