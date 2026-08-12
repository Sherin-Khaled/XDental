import { apiDownload, apiRequest, type ApiDownload } from "./http";

export type IntegrationSyncStatus = "PENDING" | "SUCCESS" | "FAILED";

export type IntegrationRowIssue = {
  rowNumber: number | null;
  message?: string;
  messages?: string[];
};

export type IntegrationSyncDetails = {
  startedAt?: string;
  completedAt?: string;
  outcome?: string;
  recordsReceived?: number;
  recordsCreated?: number;
  recordsUpdated?: number;
  recordsFailed?: number;
  recordsMarkedInactive?: number;
  warnings?: number;
  ordersExported?: number;
  orderItemsExported?: number;
  ordersMarkedExported?: number;
  note?: string;
  message?: string;
  errorSummary?: string | IntegrationRowIssue[] | null;
};

export type IntegrationSyncLog = {
  id: string;
  entityType: string;
  entityId: string | null;
  direction: "OWNER_TO_WEBSITE" | "WEBSITE_TO_OWNER";
  status: IntegrationSyncStatus;
  sourceSystem: string | null;
  startedAt: string;
  details: IntegrationSyncDetails | null;
  createdAt: string;
};

export type IntegrationStatus = {
  mode: "MANUAL_CSV";
  automaticSyncEnabled: boolean;
  lastProductImport: IntegrationSyncLog | null;
  lastOrderExport: IntegrationSyncLog | null;
};

export type ProductImportResult = {
  outcome: "SUCCESS" | "PARTIAL" | "FAILED";
  recordsReceived: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  recordsMarkedInactive: number;
  warnings: IntegrationRowIssue[];
  errors: IntegrationRowIssue[];
  syncLogId: string;
};

export async function getAdminIntegrationStatus(signal?: AbortSignal) {
  const result = await apiRequest<{ integration: IntegrationStatus }>("/admin/integrations/status", { signal });
  return result.integration;
}

export async function getAdminIntegrationLogs(signal?: AbortSignal) {
  const result = await apiRequest<{ logs: IntegrationSyncLog[] }>(
    "/admin/integrations/sync-logs?limit=20",
    { signal }
  );
  return result.logs;
}

export function downloadProductImportTemplate() {
  return apiDownload("/admin/integrations/products/import-template");
}

export async function importAdminProductsCsv(csv: string) {
  const result = await apiRequest<{ import: ProductImportResult }>(
    "/admin/integrations/products/import-csv",
    {
      method: "POST",
      body: csv,
      headers: { "Content-Type": "text/csv" },
    }
  );
  return result.import;
}

export function exportConfirmedOrdersCsv() {
  return apiDownload("/admin/integrations/orders/export?status=CONFIRMED");
}

export function saveApiDownload(download: ApiDownload, fallbackFilename: string) {
  const url = URL.createObjectURL(download.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = download.filename || fallbackFilename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
