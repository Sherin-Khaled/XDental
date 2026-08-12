import { useMemo, useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, Check, CheckCircle2, History, Loader2, RotateCcw, XCircle } from "lucide-react";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import {
  applyAdminCatalogImport,
  CATALOG_IMPORT_ENTITY_TYPES,
  previewAdminCatalogImport,
  previewAdminCatalogImportExcel,
  type CatalogImportBatch,
  type CatalogImportEntities,
  type CatalogImportEntityType,
} from "@/services/adminCatalogImport";
import {
  countImportRowsByAction,
  evaluateApplyGate,
  filterImportRows,
  hasWarning,
  IMPORT_ROW_FILTER_TABS,
  parseEntityJsonInput,
  type ImportRowFilterTab,
} from "@/lib/adminCatalogImportUi";
import { extractDuplicateCombinationText } from "@/lib/adminVariantCombinations";
import { AdminCheckbox, AdminInput } from "./_components/admin-form";
import { AdminLayout } from "./_components/AdminLayout";
import { AdminPageHeader, AdminPanel, AdminStatusBadge, AdminTableShell } from "./_components/admin-ui";
import type { StatusTone } from "./admin-data";
import type { CatalogImportRowAction } from "@/services/adminCatalogImport";

const ACTION_TONE: Record<CatalogImportRowAction, StatusTone> = {
  CREATE: "green",
  UPDATE: "blue",
  SKIP: "slate",
  CONFLICT: "red",
  ERROR: "red",
};

export default function AdminCatalogImportCenter() {
  const { t } = useLanguage();
  const { toast } = useToast();

  const [sourceSystem, setSourceSystem] = useState("");
  const [filename, setFilename] = useState("");
  const [enabledEntities, setEnabledEntities] = useState<Set<CatalogImportEntityType>>(new Set(["PRODUCTS"]));
  const [entityInputs, setEntityInputs] = useState<Partial<Record<CatalogImportEntityType, string>>>({});
  const [entityErrors, setEntityErrors] = useState<Partial<Record<CatalogImportEntityType, string>>>({});
  const [markMissingInactive] = useState(false);

  const [batch, setBatch] = useState<CatalogImportBatch | null>(null);
  const [previewSnapshot, setPreviewSnapshot] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [rowTab, setRowTab] = useState<ImportRowFilterTab>("all");

  const [excelSourceSystem, setExcelSourceSystem] = useState("");
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isPreviewingExcel, setIsPreviewingExcel] = useState(false);
  const [excelPreviewError, setExcelPreviewError] = useState<string | null>(null);

  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [appliedBatch, setAppliedBatch] = useState<CatalogImportBatch | null>(null);

  const buildEntities = (): CatalogImportEntities => {
    const entities: CatalogImportEntities = {};
    for (const entityType of CATALOG_IMPORT_ENTITY_TYPES) {
      if (!enabledEntities.has(entityType)) continue;
      const parsed = parseEntityJsonInput(entityInputs[entityType] ?? "");
      if (parsed.ok && parsed.rows.length > 0) entities[entityType] = parsed.rows;
    }
    return entities;
  };

  const currentInputSignature = useMemo(
    () => JSON.stringify({ sourceSystem, entities: buildEntities() }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sourceSystem, enabledEntities, entityInputs]
  );
  const isStale = previewSnapshot !== null && previewSnapshot !== currentInputSignature;

  const validateEntityInputs = (): boolean => {
    const errors: typeof entityErrors = {};
    for (const entityType of enabledEntities) {
      const parsed = parseEntityJsonInput(entityInputs[entityType] ?? "");
      if (!parsed.ok) errors[entityType] = t(`admin.catalogImport.jsonError.${parsed.error}`);
    }
    setEntityErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const runPreview = async () => {
    if (!sourceSystem.trim()) {
      setPreviewError(t("admin.catalogImport.sourceSystemRequired"));
      return;
    }
    if (!validateEntityInputs()) return;
    const entities = buildEntities();
    if (Object.keys(entities).length === 0) {
      setPreviewError(t("admin.catalogImport.noRowsProvided"));
      return;
    }
    setIsPreviewing(true);
    setPreviewError(null);
    setAppliedBatch(null);
    setIsConfirmed(false);
    try {
      const result = await previewAdminCatalogImport({ sourceSystem: sourceSystem.trim(), filename: filename.trim() || undefined, entities });
      setBatch(result.batch);
      setPreviewSnapshot(JSON.stringify({ sourceSystem, entities }));
      setRowTab("all");
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : t("admin.catalogImport.previewError"));
    } finally {
      setIsPreviewing(false);
    }
  };

  const runExcelPreview = async () => {
    if (!excelFile) {
      setExcelPreviewError(t("admin.catalogImport.excel.fileRequired"));
      return;
    }
    if (!excelSourceSystem.trim()) {
      setExcelPreviewError(t("admin.catalogImport.sourceSystemRequired"));
      return;
    }
    setIsPreviewingExcel(true);
    setExcelPreviewError(null);
    setAppliedBatch(null);
    setIsConfirmed(false);
    try {
      const result = await previewAdminCatalogImportExcel({ sourceSystem: excelSourceSystem.trim(), filename: excelFile.name, file: excelFile });
      setBatch(result.batch);
      setPreviewSnapshot(null);
      setRowTab("all");
    } catch (error) {
      setExcelPreviewError(error instanceof Error ? error.message : t("admin.catalogImport.previewError"));
    } finally {
      setIsPreviewingExcel(false);
    }
  };

  const rowCounts = batch ? countImportRowsByAction(batch.rows) : null;
  const conflictRowCount = batch?.rows.filter((row) => row.action === "CONFLICT").length ?? 0;
  const gate = evaluateApplyGate(batch, conflictRowCount, isStale, isConfirmed);
  const filteredRows = batch ? filterImportRows(batch.rows, rowTab) : [];

  const runApply = async () => {
    if (!batch || !gate.canApply) return;
    setIsApplying(true);
    setApplyError(null);
    try {
      const applied = await applyAdminCatalogImport(batch.id, true);
      setAppliedBatch(applied);
      toast({ title: t("admin.catalogImport.applySuccess") });
    } catch (error) {
      setApplyError(error instanceof Error ? error.message : t("admin.catalogImport.applyError"));
    } finally {
      setIsApplying(false);
    }
  };

  const startOver = () => {
    setBatch(null);
    setPreviewSnapshot(null);
    setAppliedBatch(null);
    setIsConfirmed(false);
    setPreviewError(null);
    setApplyError(null);
    setExcelFile(null);
    setExcelPreviewError(null);
  };

  return (
    <AdminLayout>
      <div className="space-y-6" data-admin-catalog-import>
        <AdminPageHeader
          title={t("admin.catalogImport.title")}
          description={t("admin.catalogImport.description")}
          action={
            <Link href="/admin/catalog-import/history" className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#EFE2BC] bg-white px-4 text-sm font-semibold text-[#717182] hover:bg-[#FFF9E8]">
              <History size={16} />
              {t("admin.catalogImport.viewHistory")}
            </Link>
          }
        />

        {appliedBatch ? (
          <AdminPanel title={t("admin.catalogImport.resultTitle")} description={t("admin.catalogImport.resultDescription")}>
            <div className="flex items-center gap-3 rounded-lg border border-[#BFE4C9] bg-[#F0FAF3] p-4">
              <CheckCircle2 size={22} className="text-[#137A36]" />
              <div>
                <p className="text-sm font-bold text-[#137A36]">{t("admin.catalogImport.appliedHeadline")}</p>
                <p className="text-xs text-[#137A36]/80">{t("admin.catalogImport.batchId")}: {appliedBatch.id}</p>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" data-admin-import-result-stats>
              <div className="rounded-lg border border-[#EFE2BC] bg-[#FBFAF7] p-3"><dt className="text-[11px] font-bold uppercase text-[#8A8D9A]">{t("admin.catalogImport.appliedAt")}</dt><dd className="mt-1 text-sm font-bold">{appliedBatch.appliedAt ? new Date(appliedBatch.appliedAt).toLocaleString() : "—"}</dd></div>
              <div className="rounded-lg border border-[#EFE2BC] bg-[#FBFAF7] p-3"><dt className="text-[11px] font-bold uppercase text-[#8A8D9A]">{t("admin.catalogImport.actor")}</dt><dd className="mt-1 text-sm font-bold">{appliedBatch.createdBy?.name ?? "—"}</dd></div>
              <div className="rounded-lg border border-[#EFE2BC] bg-[#FBFAF7] p-3"><dt className="text-[11px] font-bold uppercase text-[#8A8D9A]">{t("admin.catalogImport.totalRows")}</dt><dd className="mt-1 text-sm font-bold">{appliedBatch.totalRows}</dd></div>
              <div className="rounded-lg border border-[#EFE2BC] bg-[#FBFAF7] p-3"><dt className="text-[11px] font-bold uppercase text-[#8A8D9A]">{t("admin.catalogImport.warnings")}</dt><dd className="mt-1 text-sm font-bold">{appliedBatch.warningRows}</dd></div>
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/admin/products" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#F9DC5C] px-4 text-sm font-semibold text-[#050505] hover:bg-[#D4A72C]">
                {t("admin.catalogImport.viewImportedProducts")}
                <DirectionalIcon direction="forward" family="chevron" size={15} />
              </Link>
              <button type="button" onClick={startOver} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#EFE2BC] bg-white px-4 text-sm font-semibold text-[#717182] hover:bg-[#FFF9E8]">
                <RotateCcw size={15} />
                {t("admin.catalogImport.startAnother")}
              </button>
            </div>
          </AdminPanel>
        ) : (
          <>
            <AdminPanel title={t("admin.catalogImport.excel.title")} description={t("admin.catalogImport.excel.description")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminInput
                  id="excel-import-source-system"
                  label={t("admin.catalogImport.sourceSystem")}
                  value={excelSourceSystem}
                  onChange={(event) => setExcelSourceSystem(event.target.value)}
                  maxLength={120}
                />
                <label className="block" htmlFor="excel-import-file">
                  <span className="text-sm font-bold text-[#050505]">{t("admin.catalogImport.excel.chooseFile")}</span>
                  <input
                    id="excel-import-file"
                    type="file"
                    accept=".xlsx"
                    onChange={(event) => setExcelFile(event.target.files?.[0] ?? null)}
                    className="mt-2 block w-full rounded-[14px] border border-[#050505]/10 bg-white px-4 py-2.5 text-sm outline-none file:me-3 file:rounded-md file:border-0 file:bg-[#F9DC5C] file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-[#050505] hover:file:bg-[#D4A72C] focus:border-[#D4A72C] focus:ring-4 focus:ring-[#D4A72C]/10"
                  />
                  {excelFile && (
                    <span className="mt-1.5 block text-xs text-[#717182]">{t("admin.catalogImport.excel.selectedFile", { values: { name: excelFile.name } })}</span>
                  )}
                </label>
              </div>

              {excelPreviewError && <p role="alert" className="mt-4 rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] p-3 text-sm font-semibold text-[#B42318]">{excelPreviewError}</p>}

              <button
                type="button"
                disabled={isPreviewingExcel}
                onClick={() => void runExcelPreview()}
                className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-[#050505] px-5 text-sm font-semibold text-white hover:bg-[#050505]/85 disabled:opacity-60"
                data-admin-excel-import-run
              >
                {isPreviewingExcel ? <Loader2 size={15} className="animate-spin" /> : null}
                {isPreviewingExcel ? t("admin.catalogImport.previewing") : t("admin.catalogImport.runPreview")}
              </button>
              <p className="mt-2 text-xs leading-5 text-[#8A8D9A]">{t("admin.catalogImport.dryRunNotice")}</p>
            </AdminPanel>

            <AdminPanel title={t("admin.catalogImport.uploadTitle")} description={t("admin.catalogImport.uploadDescription")}>
              <div
                className="mb-5 rounded-[14px] border border-[#BFD9F3] bg-[#F1F7FD] p-4 dark:border-[#5297D5]/45 dark:bg-[#5297D5]/12"
                data-admin-technical-import-notice
              >
                <p className="inline-flex items-center gap-1.5 text-sm font-bold text-[#1769A7] dark:text-[#8BC5F7]">
                  {t("admin.catalogImport.technicalFormatLabel")}
                </p>
                <p className="mt-1.5 text-xs leading-5 text-[#1769A7]/90 dark:text-[#8BC5F7]/90">
                  {t("admin.catalogImport.technicalFormatExplanation")}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminInput id="import-source-system" label={t("admin.catalogImport.sourceSystem")} value={sourceSystem} onChange={(event) => setSourceSystem(event.target.value)} maxLength={120} />
                <AdminInput id="import-filename" label={t("admin.catalogImport.filename")} value={filename} onChange={(event) => setFilename(event.target.value)} maxLength={300} optional={t("admin.variants.optional")} />
              </div>

              <div className="mt-5">
                <p className="text-xs font-bold uppercase tracking-wide text-[#717182]">{t("admin.catalogImport.entitiesToInclude")}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CATALOG_IMPORT_ENTITY_TYPES.map((entityType) => {
                    const isEnabled = enabledEntities.has(entityType);
                    return (
                      <button
                        key={entityType}
                        type="button"
                        aria-pressed={isEnabled}
                        onClick={() =>
                          setEnabledEntities((current) => {
                            const next = new Set(current);
                            if (next.has(entityType)) next.delete(entityType);
                            else next.add(entityType);
                            return next;
                          })
                        }
                        className={`h-9 rounded-full border px-3.5 text-xs font-bold transition ${isEnabled ? "border-[#D4A72C] bg-[#FFF3B0] text-[#6F5000]" : "border-[#050505]/10 bg-white text-[#717182]"}`}
                      >
                        {t(`admin.catalogImport.entityType.${entityType}`)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {CATALOG_IMPORT_ENTITY_TYPES.filter((entityType) => enabledEntities.has(entityType)).map((entityType) => (
                  <label key={entityType} className="block" data-admin-entity-input={entityType}>
                    <span className="text-sm font-bold text-[#050505]">{t(`admin.catalogImport.entityType.${entityType}`)}</span>
                    <textarea
                      value={entityInputs[entityType] ?? ""}
                      onChange={(event) => setEntityInputs((current) => ({ ...current, [entityType]: event.target.value }))}
                      placeholder='[{"sku": "SKU-1", "name": "Example", "price": 100, "stockQuantity": 10}]'
                      className="mt-2 min-h-[100px] w-full resize-y rounded-[14px] border border-[#050505]/10 bg-white px-4 py-3 font-mono text-xs outline-none focus:border-[#D4A72C] focus:ring-4 focus:ring-[#D4A72C]/10"
                    />
                    {entityErrors[entityType] && <p className="mt-1.5 text-xs font-semibold text-[#B42318]">{entityErrors[entityType]}</p>}
                  </label>
                ))}
              </div>

              <div className="mt-5 border-t border-[#EFE2BC] pt-4">
                <AdminCheckbox id="mark-missing-inactive" checked={markMissingInactive} disabled onCheckedChange={() => undefined} label={t("admin.catalogImport.markMissingInactive")} description={t("admin.catalogImport.markMissingInactiveUnavailable")} />
              </div>

              {previewError && <p role="alert" className="mt-4 rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] p-3 text-sm font-semibold text-[#B42318]">{previewError}</p>}

              <button type="button" disabled={isPreviewing} onClick={() => void runPreview()} className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-[#050505] px-5 text-sm font-semibold text-white hover:bg-[#050505]/85 disabled:opacity-60">
                {isPreviewing ? <Loader2 size={15} className="animate-spin" /> : null}
                {isPreviewing ? t("admin.catalogImport.previewing") : t("admin.catalogImport.runPreview")}
              </button>
              <p className="mt-2 text-xs leading-5 text-[#8A8D9A]">{t("admin.catalogImport.dryRunNotice")}</p>
            </AdminPanel>

            {batch && rowCounts && (
              <AdminPanel title={t("admin.catalogImport.previewTitle")} description={t("admin.catalogImport.previewDescription")}>
                {isStale && (
                  <p className="mb-4 flex items-center gap-2 rounded-lg border border-[#F1C58F] bg-[#FFF5E8] p-3 text-sm font-semibold text-[#A65300]">
                    <AlertTriangle size={16} />
                    {t("admin.catalogImport.stalePreview")}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7" data-admin-import-summary-cards>
                  <SummaryCard label={t("admin.catalogImport.totalRows")} value={batch.totalRows} />
                  <SummaryCard label={t("admin.catalogImport.action.CREATE")} value={rowCounts.CREATE} tone="success" />
                  <SummaryCard label={t("admin.catalogImport.action.UPDATE")} value={rowCounts.UPDATE} tone="information" />
                  <SummaryCard label={t("admin.catalogImport.action.SKIP")} value={rowCounts.SKIP} />
                  <SummaryCard label={t("admin.catalogImport.action.CONFLICT")} value={rowCounts.CONFLICT} tone="error" />
                  <SummaryCard label={t("admin.catalogImport.action.ERROR")} value={rowCounts.ERROR} tone="error" />
                  <SummaryCard label={t("admin.catalogImport.warnings")} value={batch.warningRows} tone="warning" />
                </div>

                <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label={t("admin.catalogImport.rowFilterLabel")}>
                  {IMPORT_ROW_FILTER_TABS.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={rowTab === tab}
                      onClick={() => setRowTab(tab)}
                      className={`h-9 rounded-full border px-3.5 text-xs font-bold transition ${rowTab === tab ? "border-[#D4A72C] bg-[#FFF3B0] text-[#6F5000]" : "border-[#050505]/10 bg-white text-[#717182]"}`}
                    >
                      {tab === "all" ? t("admin.catalogImport.allRows") : t(`admin.catalogImport.action.${tab}`)}
                    </button>
                  ))}
                </div>

                <AdminTableShell>
                  <table className="mt-4 min-w-full divide-y divide-[#EFE2BC] text-sm">
                    <thead className="bg-[#FFF9E8] text-xs uppercase tracking-wide text-[#717182]">
                      <tr>
                        <th className="px-4 py-3 text-start font-bold">{t("admin.catalogImport.columnEntity")}</th>
                        <th className="px-4 py-3 text-start font-bold">{t("admin.catalogImport.columnRow")}</th>
                        <th className="px-4 py-3 text-start font-bold">{t("admin.catalogImport.columnExternalId")}</th>
                        <th className="px-4 py-3 text-start font-bold">{t("admin.catalogImport.columnSku")}</th>
                        <th className="px-4 py-3 text-start font-bold">{t("admin.catalogImport.columnAction")}</th>
                        <th className="px-4 py-3 text-start font-bold">{t("admin.catalogImport.columnMessages")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3E8C8]">
                      {filteredRows.map((row) => {
                        const duplicateText = row.validationMessages.map((message) => extractDuplicateCombinationText(message)).find(Boolean);
                        return (
                          <tr key={row.id} data-admin-import-row={row.id}>
                            <td className="px-4 py-3 text-xs font-semibold text-[#717182]">{t(`admin.catalogImport.entityType.${row.entityType}`)}</td>
                            <td className="px-4 py-3 text-xs text-[#8A8D9A]">{row.rowNumber}</td>
                            <td className="px-4 py-3 text-xs text-[#717182]">{row.externalId ?? "—"}</td>
                            <td className="px-4 py-3 font-mono text-xs text-[#717182]">{row.sku ?? "—"}</td>
                            <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5"><AdminStatusBadge tone={ACTION_TONE[row.action]}>{t(`admin.catalogImport.action.${row.action}`)}</AdminStatusBadge>{hasWarning(row) && <AdminStatusBadge tone="amber">{t("admin.catalogImport.warning")}</AdminStatusBadge>}</div></td>
                            <td className="max-w-sm px-4 py-3 text-xs leading-5 text-[#717182]">
                              {duplicateText ? (
                                <span className="font-semibold text-[#B42318]">{t("admin.catalogImport.duplicateCombinationLabel")}: {duplicateText}</span>
                              ) : (
                                row.validationMessages.join(" ")
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredRows.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[#717182]">{t("admin.catalogImport.noRowsForFilter")}</td></tr>
                      )}
                    </tbody>
                  </table>
                </AdminTableShell>

                <div className="mt-6 rounded-[14px] border border-[#EFE2BC] bg-[#FBFAF7] p-4" data-admin-import-confirm>
                  <p className="text-sm font-bold text-[#050505]">{t("admin.catalogImport.confirmTitle")}</p>
                  <p className="mt-1 text-xs leading-5 text-[#717182]">
                    {t("admin.catalogImport.confirmSummary", { values: { create: rowCounts.CREATE, update: rowCounts.UPDATE, source: batch.sourceSystem } })}
                  </p>
                  {gate.reason && (
                    <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#A65300]">
                      <AlertTriangle size={14} />
                      {t(`admin.catalogImport.gateReason.${gate.reason}`)}
                    </p>
                  )}
                  <label className="mt-3 flex items-start gap-2 text-sm font-semibold text-[#050505]">
                    <input type="checkbox" checked={isConfirmed} onChange={(event) => setIsConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-[#D4A72C]/55" />
                    {t("admin.catalogImport.confirmCheckbox")}
                  </label>
                  {applyError && <p role="alert" className="mt-3 rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] p-3 text-sm font-semibold text-[#B42318]">{applyError}</p>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" disabled={!gate.canApply || isApplying} onClick={() => void runApply()} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#F9DC5C] px-5 text-sm font-semibold text-[#050505] hover:bg-[#D4A72C] disabled:cursor-not-allowed disabled:opacity-50" data-admin-import-apply-button>
                      {isApplying ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                      {isApplying ? t("admin.catalogImport.applying") : t("admin.catalogImport.applyImport")}
                    </button>
                    <button type="button" onClick={startOver} className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#EFE2BC] bg-white px-4 text-sm font-semibold text-[#717182] hover:bg-white">
                      <XCircle size={15} />
                      {t("admin.catalogImport.cancelPreview")}
                    </button>
                  </div>
                </div>
              </AdminPanel>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: "success" | "error" | "warning" | "information" }) {
  const toneClass =
    tone === "success" ? "border-[#BFE4C9] bg-[#F0FAF3] text-[#137A36] dark:border-[#43A862]/45 dark:bg-[#43A862]/12 dark:text-[#8DE3A6]"
    : tone === "error" ? "border-[#F2C8C8] bg-[#FFF3F3] text-[#B42318] dark:border-[#E45B52]/45 dark:bg-[#E45B52]/12 dark:text-[#FF9B94]"
    : tone === "warning" ? "border-[#F1C58F] bg-[#FFF5E8] text-[#A65300] dark:border-[#E78B37]/45 dark:bg-[#E78B37]/12 dark:text-[#F5B675]"
    : tone === "information" ? "border-[#BFD9F3] bg-[#F1F7FD] text-[#1769A7] dark:border-[#5297D5]/45 dark:bg-[#5297D5]/12 dark:text-[#8BC5F7]"
    : "border-[#EFE2BC] bg-[#FBFAF7] text-[#050505] dark:border-white/10 dark:bg-white/[0.03] dark:text-[#F5F1E7]";
  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}
