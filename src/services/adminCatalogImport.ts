import { apiRequest } from "./http";

/** Typed wrappers around the Phase 7A preview-first catalog import endpoints (server/src/services/catalogImport.service.js). */

export const CATALOG_IMPORT_ENTITY_TYPES = [
  "BRANDS",
  "CATEGORIES",
  "PRODUCTS",
  "PRODUCT_OPTIONS",
  "OPTION_VALUES",
  "VARIANTS",
  "VARIANT_OPTION_VALUES",
  "IMAGES",
  "INVENTORY",
] as const;

export type CatalogImportEntityType = (typeof CATALOG_IMPORT_ENTITY_TYPES)[number];
export type CatalogImportRowAction = "CREATE" | "UPDATE" | "SKIP" | "CONFLICT" | "ERROR";
export type CatalogImportBatchStatus = "PREVIEW" | "APPLIED" | "FAILED";

export type CatalogImportRow = {
  id: string;
  entityType: CatalogImportEntityType;
  rowNumber: number;
  externalId: string | null;
  sku: string | null;
  action: CatalogImportRowAction;
  validationMessages: string[];
};

export type CatalogImportBatchSummary = {
  id: string;
  sourceSystem: string;
  filename: string | null;
  status: CatalogImportBatchStatus;
  dryRun: boolean;
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
  appliedAt: string | null;
};

export type CatalogImportBatch = CatalogImportBatchSummary & { rows: CatalogImportRow[] };

export type CatalogImportPreviewResult = {
  batch: CatalogImportBatch;
  summary: { totalRows: number; validRows: number; warningRows: number; errorRows: number };
};

/** Each entity's rows are plain objects matching the canonical fields in server/src/services/catalogImport.contract.js. */
export type CatalogImportEntities = Partial<Record<CatalogImportEntityType, Array<Record<string, unknown>>>>;

export async function previewAdminCatalogImport(input: {
  sourceSystem: string;
  filename?: string;
  entities: CatalogImportEntities;
}) {
  const result = await apiRequest<{ preview: CatalogImportPreviewResult }>(
    "/admin/integrations/catalog-imports/preview",
    { method: "POST", body: JSON.stringify(input) }
  );
  return result.preview;
}

/** Uploads an .xlsx workbook for the preview-first Excel catalogue import (Phase 7C). sourceSystem/filename travel as query params since the request body is the raw file bytes, not JSON. */
export async function previewAdminCatalogImportExcel(input: { sourceSystem: string; filename?: string; file: File }) {
  const params = new URLSearchParams({ sourceSystem: input.sourceSystem });
  if (input.filename) params.set("filename", input.filename);
  const result = await apiRequest<{ preview: CatalogImportPreviewResult }>(
    `/admin/integrations/catalog-imports/excel/preview?${params.toString()}`,
    { method: "POST", body: input.file, headers: { "Content-Type": "application/octet-stream" } }
  );
  return result.preview;
}

export async function applyAdminCatalogImport(batchId: string, confirmed: boolean) {
  const result = await apiRequest<{ batch: CatalogImportBatch }>(
    `/admin/integrations/catalog-imports/${encodeURIComponent(batchId)}/apply`,
    { method: "POST", body: JSON.stringify({ confirmed }) }
  );
  return result.batch;
}

export async function getAdminCatalogImportBatches(signal?: AbortSignal) {
  const result = await apiRequest<{ batches: CatalogImportBatchSummary[] }>(
    "/admin/integrations/catalog-imports",
    { signal }
  );
  return result.batches;
}

export async function getAdminCatalogImportBatch(
  batchId: string,
  options: { entityType?: CatalogImportEntityType; action?: CatalogImportRowAction; signal?: AbortSignal } = {}
) {
  const params = new URLSearchParams();
  if (options.entityType) params.set("entityType", options.entityType);
  if (options.action) params.set("action", options.action);
  const query = params.toString();
  const result = await apiRequest<{ batch: CatalogImportBatch }>(
    `/admin/integrations/catalog-imports/${encodeURIComponent(batchId)}${query ? `?${query}` : ""}`,
    { signal: options.signal }
  );
  return result.batch;
}
