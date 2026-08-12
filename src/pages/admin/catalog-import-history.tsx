import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Loader2, RefreshCw } from "lucide-react";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { useLanguage } from "@/context/LanguageContext";
import {
  getAdminCatalogImportBatch,
  getAdminCatalogImportBatches,
  type CatalogImportBatch,
  type CatalogImportBatchSummary,
} from "@/services/adminCatalogImport";
import { countImportRowsByAction, filterImportRows, IMPORT_ROW_FILTER_TABS, type ImportRowFilterTab } from "@/lib/adminCatalogImportUi";
import { extractDuplicateCombinationText } from "@/lib/adminVariantCombinations";
import { AdminLayout } from "./_components/AdminLayout";
import { AdminPageHeader, AdminStatusBadge, AdminTableShell } from "./_components/admin-ui";
import type { StatusTone } from "./admin-data";

const STATUS_TONE: Record<CatalogImportBatchSummary["status"], StatusTone> = {
  PREVIEW: "slate",
  APPLIED: "green",
  FAILED: "red",
};

export default function AdminCatalogImportHistory() {
  const { language, t } = useLanguage();
  const [batches, setBatches] = useState<CatalogImportBatchSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<CatalogImportBatch | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [rowTab, setRowTab] = useState<ImportRowFilterTab>("all");

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);
    getAdminCatalogImportBatches(controller.signal)
      .then(setBatches)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : t("admin.catalogImport.history.loadError"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [refreshVersion, t]);

  useEffect(() => {
    if (!selectedBatchId) {
      setSelectedBatch(null);
      return;
    }
    const controller = new AbortController();
    setIsLoadingDetail(true);
    setDetailError(null);
    setRowTab("all");
    getAdminCatalogImportBatch(selectedBatchId, { signal: controller.signal })
      .then(setSelectedBatch)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setDetailError(error instanceof Error ? error.message : t("admin.catalogImport.history.loadError"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingDetail(false);
      });
    return () => controller.abort();
  }, [selectedBatchId, t]);

  const formatDate = (value: string | null) =>
    value ? new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";

  const rowCounts = useMemo(() => (selectedBatch ? countImportRowsByAction(selectedBatch.rows) : null), [selectedBatch]);
  const filteredRows = useMemo(() => (selectedBatch ? filterImportRows(selectedBatch.rows, rowTab) : []), [selectedBatch, rowTab]);

  return (
    <AdminLayout>
      <div className="space-y-6" data-admin-catalog-import-history>
        <Link href="/admin/catalog-import" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#8A651C] hover:text-[#5F430C]">
          <DirectionalIcon direction="back" family="chevron" size={16} />
          {t("admin.catalogImport.history.backToImport")}
        </Link>

        <AdminPageHeader
          title={t("admin.catalogImport.history.title")}
          description={t("admin.catalogImport.history.description")}
          action={
            <button type="button" onClick={() => setRefreshVersion((value) => value + 1)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#EFE2BC] bg-white px-4 text-sm font-semibold text-[#717182] hover:bg-[#FFF9E8]">
              <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
              {t("admin.products.refresh")}
            </button>
          }
        />

        {loadError && <div role="alert" className="rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] p-4 text-sm font-semibold text-[#B42318]">{loadError}</div>}

        <AdminTableShell>
          <table className="min-w-full divide-y divide-[#EFE2BC] text-sm">
            <thead className="bg-[#FFF9E8] text-xs uppercase tracking-wide text-[#717182]">
              <tr>
                <th className="px-4 py-3 text-start font-bold">{t("admin.catalogImport.history.filename")}</th>
                <th className="px-4 py-3 text-start font-bold">{t("admin.catalogImport.sourceSystem")}</th>
                <th className="px-4 py-3 text-start font-bold">{t("admin.catalogImport.history.status")}</th>
                <th className="px-4 py-3 text-start font-bold">{t("admin.catalogImport.totalRows")}</th>
                <th className="px-4 py-3 text-start font-bold">{t("admin.catalogImport.action.ERROR")}</th>
                <th className="px-4 py-3 text-start font-bold">{t("admin.catalogImport.warnings")}</th>
                <th className="px-4 py-3 text-start font-bold">{t("admin.catalogImport.history.createdBy")}</th>
                <th className="px-4 py-3 text-start font-bold">{t("admin.catalogImport.history.previewDate")}</th>
                <th className="px-4 py-3 text-start font-bold">{t("admin.catalogImport.appliedAt")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3E8C8]">
              {batches.map((batch) => (
                <tr
                  key={batch.id}
                  onClick={() => setSelectedBatchId(batch.id)}
                  className={`cursor-pointer ${selectedBatchId === batch.id ? "bg-[#FFF7D6]" : ""}`}
                  data-admin-import-batch-row={batch.id}
                >
                  <td className="px-4 py-3 font-semibold text-[#050505]">{batch.filename ?? t("admin.catalogImport.history.untitled")}</td>
                  <td className="px-4 py-3 text-[#717182]">{batch.sourceSystem}</td>
                  <td className="px-4 py-3"><AdminStatusBadge tone={STATUS_TONE[batch.status]}>{t(`admin.catalogImport.history.batchStatus.${batch.status}`)}</AdminStatusBadge></td>
                  <td className="px-4 py-3">{batch.totalRows}</td>
                  <td className="px-4 py-3">{batch.errorRows}</td>
                  <td className="px-4 py-3">{batch.warningRows}</td>
                  <td className="px-4 py-3 text-[#717182]">{batch.createdBy?.name ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-[#717182]">{formatDate(batch.createdAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-[#717182]">{formatDate(batch.appliedAt)}</td>
                </tr>
              ))}
              {!isLoading && !loadError && batches.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-[#717182]">{t("admin.catalogImport.history.noBatches")}</td></tr>
              )}
              {isLoading && batches.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-[#717182]">{t("admin.products.loading")}</td></tr>
              )}
            </tbody>
          </table>
        </AdminTableShell>

        {selectedBatchId && (
          <section className="rounded-lg border border-[#EFE2BC] bg-white p-5 shadow-sm" data-admin-import-batch-detail={selectedBatchId}>
            <h2 className="text-base font-bold text-[#050505]">{t("admin.catalogImport.history.rowLevelTitle")}</h2>
            {isLoadingDetail && <p className="mt-3 flex items-center gap-2 text-sm text-[#717182]"><Loader2 size={14} className="animate-spin" />{t("admin.products.loading")}</p>}
            {detailError && <p role="alert" className="mt-3 text-sm font-semibold text-[#B42318]">{detailError}</p>}
            {selectedBatch && rowCounts && (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  {IMPORT_ROW_FILTER_TABS.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setRowTab(tab)}
                      className={`h-8 rounded-full border px-3 text-xs font-bold ${rowTab === tab ? "border-[#D4A72C] bg-[#FFF3B0] text-[#6F5000]" : "border-[#050505]/10 bg-white text-[#717182]"}`}
                    >
                      {tab === "all" ? t("admin.catalogImport.allRows") : t(`admin.catalogImport.action.${tab}`)}
                    </button>
                  ))}
                </div>
                <div className="mt-3 max-h-[420px] overflow-y-auto rounded-lg border border-[#EFE2BC]">
                  <table className="min-w-full divide-y divide-[#EFE2BC] text-xs">
                    <thead className="sticky top-0 bg-[#FFF9E8] uppercase tracking-wide text-[#717182]">
                      <tr>
                        <th className="px-3 py-2 text-start font-bold">{t("admin.catalogImport.columnEntity")}</th>
                        <th className="px-3 py-2 text-start font-bold">{t("admin.catalogImport.columnRow")}</th>
                        <th className="px-3 py-2 text-start font-bold">{t("admin.catalogImport.columnSku")}</th>
                        <th className="px-3 py-2 text-start font-bold">{t("admin.catalogImport.columnAction")}</th>
                        <th className="px-3 py-2 text-start font-bold">{t("admin.catalogImport.columnMessages")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3E8C8]">
                      {filteredRows.map((row) => {
                        const duplicateText = row.validationMessages.map((message) => extractDuplicateCombinationText(message)).find(Boolean);
                        return (
                          <tr key={row.id}>
                            <td className="px-3 py-2 font-semibold text-[#717182]">{t(`admin.catalogImport.entityType.${row.entityType}`)}</td>
                            <td className="px-3 py-2 text-[#8A8D9A]">{row.rowNumber}</td>
                            <td className="px-3 py-2 font-mono text-[#717182]">{row.sku ?? "—"}</td>
                            <td className="px-3 py-2"><AdminStatusBadge tone={row.action === "CREATE" ? "green" : row.action === "UPDATE" ? "blue" : row.action === "SKIP" ? "slate" : "red"}>{t(`admin.catalogImport.action.${row.action}`)}</AdminStatusBadge></td>
                            <td className="max-w-xs px-3 py-2 leading-5 text-[#717182]">{duplicateText ? <span className="font-semibold text-[#B42318]">{t("admin.catalogImport.duplicateCombinationLabel")}: {duplicateText}</span> : row.validationMessages.join(" ")}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </AdminLayout>
  );
}
