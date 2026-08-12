import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Download, FileDown, RefreshCw, Upload } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import {
  downloadProductImportTemplate,
  exportConfirmedOrdersCsv,
  getAdminIntegrationLogs,
  getAdminIntegrationStatus,
  importAdminProductsCsv,
  saveApiDownload,
  type IntegrationRowIssue,
  type IntegrationSyncLog,
  type IntegrationSyncStatus,
  type ProductImportResult,
} from "@/services/adminIntegrations";
import { AdminPanel, AdminStatusBadge, AdminTableShell } from "./admin-ui";
import type { StatusTone } from "../admin-data";

const STATUS_TONES: Record<IntegrationSyncStatus, StatusTone> = {
  PENDING: "amber",
  SUCCESS: "green",
  FAILED: "red",
};

function issueText(issue: IntegrationRowIssue) {
  return issue.messages?.join(" ") || issue.message || "";
}

function shortSummary(log: IntegrationSyncLog, warningsLabel: string) {
  const errorSummary = log.details?.errorSummary;
  if (typeof errorSummary === "string" && errorSummary) return errorSummary;
  if (Array.isArray(errorSummary) && errorSummary.length > 0) {
    return issueText(errorSummary[0]);
  }
  if ((log.details?.warnings ?? 0) > 0) return `${log.details?.warnings} ${warningsLabel}`;
  return log.details?.note || log.details?.message || "—";
}

export function OwnerSystemSyncPanel({ isAdmin }: { isAdmin: boolean }) {
  const { language, t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Awaited<ReturnType<typeof getAdminIntegrationStatus>> | null>(null);
  const [logs, setLogs] = useState<IntegrationSyncLog[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ProductImportResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadSyncData = useCallback(async (signal?: AbortSignal, initial = false) => {
    if (initial) setIsLoading(true);
    else setIsRefreshing(true);
    setLoadError(null);
    try {
      const [nextStatus, nextLogs] = await Promise.all([
        getAdminIntegrationStatus(signal),
        getAdminIntegrationLogs(signal),
      ]);
      setStatus(nextStatus);
      setLogs(nextLogs);
    } catch (error) {
      if (!signal?.aborted) {
        setLoadError(error instanceof Error ? error.message : t("admin.ownerSync.loadError"));
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [t]);

  useEffect(() => {
    const controller = new AbortController();
    void loadSyncData(controller.signal, true);
    return () => controller.abort();
  }, [loadSyncData]);

  const formatDate = useCallback((value?: string | null) => {
    if (!value) return t("admin.ownerSync.noSyncYet");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t("admin.ownerSync.noSyncYet");
    return new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-EG", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }, [language, t]);

  const typeLabel = useCallback((entityType: string) => {
    if (entityType === "PRODUCT_CATALOG_IMPORT") return t("admin.ownerSync.productImport");
    if (entityType === "CONFIRMED_ORDER_EXPORT") return t("admin.ownerSync.confirmedOrderExport");
    if (entityType === "CONFIRMED_ORDER_EXPORT_MARK") return t("admin.ownerSync.exportAcknowledgement");
    return entityType;
  }, [t]);

  const statusLabel = useCallback((value: IntegrationSyncStatus) =>
    t(`admin.ownerSync.statuses.${value.toLowerCase()}`), [t]);

  const latestLog = logs[0] ?? null;
  const statusCards = useMemo(() => [
    { label: t("admin.ownerSync.lastImport"), log: status?.lastProductImport ?? null },
    { label: t("admin.ownerSync.lastExport"), log: status?.lastOrderExport ?? null },
    { label: t("admin.ownerSync.latestSync"), log: latestLog },
  ], [latestLog, status, t]);

  const clearActionFeedback = () => {
    setActionError(null);
    setActionMessage(null);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    clearActionFeedback();
    setImportResult(null);
    setSelectedFile(event.target.files?.[0] ?? null);
  };

  const handleTemplateDownload = async () => {
    clearActionFeedback();
    setIsDownloadingTemplate(true);
    try {
      const download = await downloadProductImportTemplate();
      saveApiDownload(download, "x-dental-product-import-template.csv");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t("admin.ownerSync.templateError"));
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleImport = async () => {
    clearActionFeedback();
    setImportResult(null);
    if (!selectedFile) {
      setActionError(t("admin.ownerSync.fileRequired"));
      return;
    }
    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      setActionError(t("admin.ownerSync.fileTypeError"));
      return;
    }
    if (selectedFile.size > 2 * 1024 * 1024) {
      setActionError(t("admin.ownerSync.fileSizeError"));
      return;
    }

    setIsImporting(true);
    try {
      const result = await importAdminProductsCsv(await selectedFile.text());
      setImportResult(result);
      setActionMessage(t("admin.ownerSync.importCompleted"));
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadSyncData();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t("admin.ownerSync.importError"));
    } finally {
      setIsImporting(false);
    }
  };

  const handleOrderExport = async () => {
    clearActionFeedback();
    setIsExporting(true);
    try {
      const download = await exportConfirmedOrdersCsv();
      saveApiDownload(download, "x-dental-confirmed-orders.csv");
      setActionMessage(t("admin.ownerSync.exportDownloaded"));
      await loadSyncData();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t("admin.ownerSync.exportError"));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AdminPanel title={t("admin.ownerSync.title")} description={t("admin.ownerSync.manualNote")}>
      <div className="rounded-lg border border-[#F9DC5C]/60 bg-[#FFF9E8] px-4 py-3 text-sm leading-6 text-[#5F5948]">
        <span className="font-bold text-[#050505]">{t("admin.ownerSync.manualCsvSync")}</span>{" "}
        {t("admin.ownerSync.directNewAccNote")}
      </div>

      {loadError && (
        <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] p-4 text-sm font-semibold text-[#B42318]">
          <span>{loadError}</span>
          <button type="button" onClick={() => void loadSyncData()} className="rounded-md border border-[#B42318]/25 bg-white px-3 py-1.5 text-xs font-bold">
            {t("admin.ownerSync.retry")}
          </button>
        </div>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {statusCards.map(({ label, log }) => (
          <div key={label} className="rounded-lg border border-[#EFE2BC] bg-[#FBFAF7] p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[#717182]">{label}</p>
            {isLoading ? (
              <p className="mt-3 text-sm text-[#717182]">{t("admin.ownerSync.loading")}</p>
            ) : log ? (
              <>
                <div className="mt-3"><AdminStatusBadge tone={STATUS_TONES[log.status]}>{statusLabel(log.status)}</AdminStatusBadge></div>
                <p className="mt-3 text-sm font-semibold text-[#050505]">{typeLabel(log.entityType)}</p>
                <p className="mt-1 text-xs text-[#717182]">{formatDate(log.details?.completedAt || log.createdAt)}</p>
              </>
            ) : (
              <p className="mt-3 text-sm text-[#717182]">{t("admin.ownerSync.noSyncYet")}</p>
            )}
          </div>
        ))}
      </div>

      {isAdmin ? (
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <section className="rounded-lg border border-[#EFE2BC] p-4">
            <h3 className="text-sm font-bold text-[#050505]">{t("admin.ownerSync.productImport")}</h3>
            <div className="mt-4 flex flex-col gap-3">
              <button type="button" disabled={isDownloadingTemplate} onClick={() => void handleTemplateDownload()} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#D4A72C]/45 bg-white px-4 text-sm font-semibold text-[#050505] hover:bg-[#FFF9E8] dark:hover:border-[#D4A72C]/40 dark:hover:bg-white/[0.05] dark:hover:text-[#F6D85D] disabled:cursor-not-allowed disabled:opacity-60">
                <Download size={16} />
                {isDownloadingTemplate ? t("admin.ownerSync.downloading") : t("admin.ownerSync.downloadTemplate")}
              </button>
              <div>
                <label htmlFor="owner-product-csv" className="cursor-pointer text-xs font-bold uppercase tracking-wide text-[#717182]">{t("admin.ownerSync.selectCsv")}</label>
                <input id="owner-product-csv" ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="mt-2 block w-full cursor-pointer rounded-lg border border-[#050505]/10 bg-[#FBFAF7] px-3 py-2 text-sm text-[#717182] transition-colors duration-200 hover:border-[#D4A72C]/75 hover:bg-[#FFF9E8] focus-visible:border-[#D4A72C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A72C]/20 file:me-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-[#FFF2B2] file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-[#050505]" />
              </div>
              <button type="button" disabled={isImporting || !selectedFile} onClick={() => void handleImport()} className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#F9DC5C] px-4 text-sm font-semibold text-[#050505] transition-colors hover:bg-[#D4A72C] disabled:cursor-not-allowed disabled:opacity-60">
                <Upload size={16} />
                {isImporting ? t("admin.ownerSync.importing") : t("admin.ownerSync.importProductsCsv")}
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-[#EFE2BC] p-4">
            <h3 className="text-sm font-bold text-[#050505]">{t("admin.ownerSync.orderExport")}</h3>
            <p className="mt-2 text-sm leading-6 text-[#717182]">{t("admin.ownerSync.orderExportDescription")}</p>
            <button type="button" disabled={isExporting} onClick={() => void handleOrderExport()} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#050505] px-4 text-sm font-semibold text-white hover:bg-[#2B2B2B] disabled:cursor-not-allowed disabled:opacity-60">
              <FileDown size={16} />
              {isExporting ? t("admin.ownerSync.exporting") : t("admin.ownerSync.exportConfirmedOrders")}
            </button>
          </section>
        </div>
      ) : (
        <p className="mt-5 rounded-lg border border-[#EFE2BC] bg-[#FBFAF7] p-4 text-sm text-[#717182]">
          {t("admin.ownerSync.readOnly")}
        </p>
      )}

      {actionError && <p role="alert" className="mt-4 rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] p-3 text-sm font-semibold text-[#B42318]">{actionError}</p>}
      {actionMessage && <p role="status" className="mt-4 rounded-lg border border-[#CFE8D6] bg-[#F4FBF5] p-3 text-sm font-semibold text-[#16803C]">{actionMessage}</p>}

      {importResult && (
        <section className="mt-4 rounded-lg border border-[#EFE2BC] bg-[#FBFAF7] p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [t("admin.ownerSync.created"), importResult.recordsCreated],
              [t("admin.ownerSync.updated"), importResult.recordsUpdated],
              [t("admin.ownerSync.failed"), importResult.recordsFailed],
              [t("admin.ownerSync.warnings"), importResult.warnings.length],
            ].map(([label, value]) => <div key={label} className="rounded-md bg-white p-3 text-center"><p className="text-xs font-bold uppercase text-[#717182]">{label}</p><p className="mt-1 text-xl font-bold text-[#050505]">{value}</p></div>)}
          </div>
          {(importResult.errors.length > 0 || importResult.warnings.length > 0) && (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {importResult.errors.length > 0 && <IssueList title={t("admin.ownerSync.failed")} issues={importResult.errors} rowLabel={t("admin.ownerSync.row")} tone="red" />}
              {importResult.warnings.length > 0 && <IssueList title={t("admin.ownerSync.warnings")} issues={importResult.warnings} rowLabel={t("admin.ownerSync.row")} tone="amber" />}
            </div>
          )}
        </section>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-[#050505]">{t("admin.ownerSync.syncLogs")}</h3>
        <button type="button" onClick={() => void loadSyncData()} disabled={isRefreshing} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#EFE2BC] px-3 text-xs font-bold text-[#717182] hover:bg-[#FFF9E8] dark:hover:border-[#D4A72C]/40 dark:hover:bg-white/[0.05] dark:hover:text-[#F6D85D] disabled:opacity-60">
          <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
          {t("admin.ownerSync.refresh")}
        </button>
      </div>

      <div className="mt-3">
        <AdminTableShell>
          <table className="min-w-full divide-y divide-[#EFE2BC] text-sm">
            <thead className="bg-[#FFF9E8] text-xs uppercase tracking-wide text-[#717182]"><tr>
              <th className="px-4 py-3 text-start font-bold">{t("admin.ownerSync.dateTime")}</th>
              <th className="px-4 py-3 text-start font-bold">{t("admin.ownerSync.sourceType")}</th>
              <th className="px-4 py-3 text-start font-bold">{t("admin.ownerSync.status")}</th>
              <th className="px-4 py-3 text-start font-bold">{t("admin.ownerSync.created")}</th>
              <th className="px-4 py-3 text-start font-bold">{t("admin.ownerSync.updated")}</th>
              <th className="px-4 py-3 text-start font-bold">{t("admin.ownerSync.failed")}</th>
              <th className="px-4 py-3 text-start font-bold">{t("admin.ownerSync.summary")}</th>
            </tr></thead>
            <tbody className="divide-y divide-[#F3E8C8]">
              {logs.map((log) => <tr key={log.id}>
                <td className="whitespace-nowrap px-4 py-3 text-[#717182]">{formatDate(log.details?.completedAt || log.createdAt)}</td>
                <td className="px-4 py-3"><p className="font-semibold text-[#050505]">{typeLabel(log.entityType)}</p><p className="mt-1 text-xs text-[#8A8D9A]">{log.sourceSystem || "—"}</p></td>
                <td className="px-4 py-3"><AdminStatusBadge tone={STATUS_TONES[log.status]}>{statusLabel(log.status)}</AdminStatusBadge></td>
                <td className="px-4 py-3 text-[#717182]">{log.details?.recordsCreated ?? "—"}</td>
                <td className="px-4 py-3 text-[#717182]">{log.details?.recordsUpdated ?? "—"}</td>
                <td className="px-4 py-3 text-[#717182]">{log.details?.recordsFailed ?? "—"}</td>
                <td className="max-w-xs px-4 py-3 text-xs leading-5 text-[#717182]">{shortSummary(log, t("admin.ownerSync.warnings").toLowerCase())}</td>
              </tr>)}
              {!isLoading && !loadError && logs.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-[#717182]">{t("admin.ownerSync.noLogs")}</td></tr>}
              {isLoading && logs.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-[#717182]">{t("admin.ownerSync.loading")}</td></tr>}
            </tbody>
          </table>
        </AdminTableShell>
      </div>
    </AdminPanel>
  );
}

function IssueList({ title, issues, rowLabel, tone }: { title: string; issues: IntegrationRowIssue[]; rowLabel: string; tone: "red" | "amber" }) {
  const classes = tone === "red" ? "border-[#F2C8C8] bg-[#FFF3F3] text-[#B42318]" : "border-[#F9DC5C]/60 bg-[#FFF9E8] text-[#8A642C]";
  return <div className={`rounded-lg border p-3 text-xs ${classes}`}><p className="font-bold">{title}</p><ul className="mt-2 space-y-1.5">{issues.map((issue, index) => <li key={`${issue.rowNumber}-${index}`}>{issue.rowNumber ? `${rowLabel} ${issue.rowNumber}: ` : ""}{issueText(issue)}</li>)}</ul></div>;
}
