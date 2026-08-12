import { useMemo, useState } from "react";
import { AlertTriangle, Check, Loader2, Plus, Power, PowerOff, Sparkles, Trash2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import {
  createAdminProductOption,
  createAdminProductOptionValue,
  createAdminProductVariant,
  deleteAdminProductOptionValue,
  replaceAdminVariantOptionValues,
  updateAdminProductVariant,
  type AdminProductCatalog,
  type AdminProductVariant,
  type AdminVariantStatus,
} from "@/services/adminProductCatalog";
import { ApiError } from "@/services/http";
import {
  combinationDisplayLabel,
  extractDuplicateCombinationText,
  findDuplicateSignatures,
  generateVariantCombinations,
  type GeneratedCombination,
} from "@/lib/adminVariantCombinations";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdminInput, AdminSelect } from "./admin-form";
import { AdminPanel, AdminStatusBadge } from "./admin-ui";

const VARIANT_STATUS_OPTIONS: AdminVariantStatus[] = ["ACTIVE", "LOW_STOCK", "OUT_OF_STOCK", "DRAFT", "INACTIVE"];

function variantLabel(variant: AdminProductVariant) {
  return (
    combinationDisplayLabel(
      variant.selections.map((selection) => ({ optionNameEn: selection.option.nameEn, valueEn: selection.optionValue.valueEn }))
    ) || variant.sku || variant.id
  );
}

function safeErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : fallback;
}

type DraftRow = { sku: string; barcode: string; priceOverride: string; stockQuantity: string; status: AdminVariantStatus };

function defaultDraft(): DraftRow {
  return { sku: "", barcode: "", priceOverride: "", stockQuantity: "0", status: "ACTIVE" };
}

export function ProductVariantsPanel({
  productId,
  catalog,
  onChange,
}: {
  productId: string;
  catalog: AdminProductCatalog;
  onChange: () => void;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();

  // Options editor
  const [optionCode, setOptionCode] = useState("");
  const [optionNameEn, setOptionNameEn] = useState("");
  const [optionNameAr, setOptionNameAr] = useState("");
  const [optionError, setOptionError] = useState<string | null>(null);
  const [isCreatingOption, setIsCreatingOption] = useState(false);

  const [valueDrafts, setValueDrafts] = useState<Record<string, { code: string; valueEn: string; valueAr: string }>>({});
  const [valueErrors, setValueErrors] = useState<Record<string, string>>({});
  const [creatingValueForOption, setCreatingValueForOption] = useState<string | null>(null);
  const [deleteValueTarget, setDeleteValueTarget] = useState<{ id: string; label: string } | null>(null);
  const [forceDeleteWarning, setForceDeleteWarning] = useState<{ id: string; label: string; activeVariantCount: number } | null>(null);
  const [isDeletingValue, setIsDeletingValue] = useState(false);

  // Combination generator
  const [selectedValueIdsByOption, setSelectedValueIdsByOption] = useState<Record<string, string[]>>({});
  const [rowDrafts, setRowDrafts] = useState<Record<string, DraftRow>>({});
  const [creatingRowKey, setCreatingRowKey] = useState<string | null>(null);
  const [creationResults, setCreationResults] = useState<Array<{ label: string; ok: boolean; message?: string }> | null>(null);
  const [isCreatingAll, setIsCreatingAll] = useState(false);

  const existingSignatures = useMemo(
    () => new Set(
      catalog.variants.map((variant) =>
        [...variant.selections]
          .map((selection) => `${selection.option.code.toUpperCase()}=${selection.optionValue.code.toUpperCase()}`)
          .sort()
          .join(", ")
      )
    ),
    [catalog.variants]
  );
  const generated = useMemo(
    () => generateVariantCombinations(catalog.options, selectedValueIdsByOption),
    [catalog.options, selectedValueIdsByOption]
  );
  const duplicatesWithinGenerated = useMemo(() => findDuplicateSignatures(generated), [generated]);

  const draftFor = (key: string) => rowDrafts[key] ?? defaultDraft();
  const updateDraft = (key: string, patch: Partial<DraftRow>) =>
    setRowDrafts((current) => ({ ...current, [key]: { ...draftFor(key), ...patch } }));

  // Variant editing
  const [editingVariant, setEditingVariant] = useState<AdminProductVariant | null>(null);
  const [editForm, setEditForm] = useState<DraftRow>(defaultDraft());
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [busyVariantId, setBusyVariantId] = useState<string | null>(null);

  // Bulk edit
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<AdminVariantStatus | "">("");
  const [bulkThreshold, setBulkThreshold] = useState("");
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [bulkResults, setBulkResults] = useState<Array<{ label: string; ok: boolean; message?: string }> | null>(null);

  const submitOption = async () => {
    setOptionError(null);
    if (!optionCode.trim() || !optionNameEn.trim()) {
      setOptionError(t("admin.variants.optionValidation"));
      return;
    }
    setIsCreatingOption(true);
    try {
      await createAdminProductOption(productId, {
        code: optionCode.trim().toUpperCase(),
        nameEn: optionNameEn.trim(),
        nameAr: optionNameAr.trim() || undefined,
        sortOrder: catalog.options.length,
      });
      setOptionCode("");
      setOptionNameEn("");
      setOptionNameAr("");
      toast({ title: t("admin.variants.optionCreated") });
      onChange();
    } catch (error) {
      setOptionError(safeErrorMessage(error, t("admin.variants.optionSaveError")));
    } finally {
      setIsCreatingOption(false);
    }
  };

  const submitValue = async (optionId: string) => {
    const draft = valueDrafts[optionId] ?? { code: "", valueEn: "", valueAr: "" };
    if (!draft.code.trim() || !draft.valueEn.trim()) {
      setValueErrors((current) => ({ ...current, [optionId]: t("admin.variants.valueValidation") }));
      return;
    }
    setCreatingValueForOption(optionId);
    setValueErrors((current) => ({ ...current, [optionId]: "" }));
    try {
      const option = catalog.options.find((item) => item.id === optionId);
      await createAdminProductOptionValue(optionId, {
        code: draft.code.trim().toUpperCase(),
        valueEn: draft.valueEn.trim(),
        valueAr: draft.valueAr.trim() || undefined,
        sortOrder: option?.values.length ?? 0,
      });
      setValueDrafts((current) => ({ ...current, [optionId]: { code: "", valueEn: "", valueAr: "" } }));
      toast({ title: t("admin.variants.valueCreated") });
      onChange();
    } catch (error) {
      setValueErrors((current) => ({ ...current, [optionId]: safeErrorMessage(error, t("admin.variants.valueSaveError")) }));
    } finally {
      setCreatingValueForOption(null);
    }
  };

  const requestDeleteValue = (valueId: string, label: string) => setDeleteValueTarget({ id: valueId, label });

  const confirmDeleteValue = async (force: boolean) => {
    const target = forceDeleteWarning ?? deleteValueTarget;
    if (!target) return;
    setIsDeletingValue(true);
    try {
      const result = await deleteAdminProductOptionValue(target.id, force);
      toast({
        title: result.deactivatedVariantCount > 0
          ? t("admin.variants.valueDeletedWithDeactivation", { values: { count: result.deactivatedVariantCount } })
          : t("admin.variants.valueDeleted"),
      });
      setDeleteValueTarget(null);
      setForceDeleteWarning(null);
      onChange();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && typeof error.payload === "object" && error.payload && "activeVariantCount" in error.payload) {
        const count = Number((error.payload as { activeVariantCount?: number }).activeVariantCount ?? 0);
        setDeleteValueTarget(null);
        setForceDeleteWarning({ id: target.id, label: target.label, activeVariantCount: count });
      } else {
        toast({ title: safeErrorMessage(error, t("admin.variants.valueSaveError")), variant: "destructive" });
        setDeleteValueTarget(null);
        setForceDeleteWarning(null);
      }
    } finally {
      setIsDeletingValue(false);
    }
  };

  const toggleGeneratorValue = (optionId: string, valueId: string) => {
    setSelectedValueIdsByOption((current) => {
      const selected = current[optionId] ?? [];
      return {
        ...current,
        [optionId]: selected.includes(valueId) ? selected.filter((id) => id !== valueId) : [...selected, valueId],
      };
    });
  };

  const createCombination = async (combination: GeneratedCombination) => {
    const draft = draftFor(combination.key);
    const stockQuantity = Number(draft.stockQuantity);
    if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
      return { ok: false, message: t("admin.variants.stockValidation") };
    }
    try {
      const variant = await createAdminProductVariant(productId, {
        sku: draft.sku.trim() || undefined,
        barcode: draft.barcode.trim() || undefined,
        priceOverride: draft.priceOverride.trim() ? Number(draft.priceOverride) : null,
        stockQuantity,
        status: draft.status,
      });
      await replaceAdminVariantOptionValues(variant.id, combination.selections.map((selection) => selection.valueId));
      return { ok: true };
    } catch (error) {
      const duplicateText = error instanceof ApiError ? extractDuplicateCombinationText(error.message) : null;
      return { ok: false, message: duplicateText ? t("admin.variants.duplicateCombinationError", { values: { combination: duplicateText } }) : safeErrorMessage(error, t("admin.variants.variantSaveError")) };
    }
  };

  const creatableRows = generated.filter((row) => !existingSignatures.has(row.signature) && !duplicatesWithinGenerated.has(row.signature));

  const createAllValid = async () => {
    setIsCreatingAll(true);
    setCreationResults(null);
    const results: Array<{ label: string; ok: boolean; message?: string }> = [];
    for (const row of creatableRows) {
      const label = combinationDisplayLabel(row.selections.map((s) => ({ optionNameEn: s.optionNameEn, valueEn: s.valueEn })));
      const outcome = await createCombination(row);
      results.push({ label, ok: outcome.ok, message: outcome.message });
    }
    setCreationResults(results);
    setIsCreatingAll(false);
    if (results.some((result) => result.ok)) onChange();
  };

  const openEditVariant = (variant: AdminProductVariant) => {
    setEditingVariant(variant);
    setEditForm({
      sku: variant.sku ?? "",
      barcode: variant.barcode ?? "",
      priceOverride: variant.priceOverride === null ? "" : String(variant.priceOverride),
      stockQuantity: String(variant.stockQuantity),
      status: variant.status,
    });
    setEditError(null);
  };

  const saveEditVariant = async () => {
    if (!editingVariant) return;
    const stockQuantity = Number(editForm.stockQuantity);
    if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
      setEditError(t("admin.variants.stockValidation"));
      return;
    }
    setIsSavingEdit(true);
    setEditError(null);
    try {
      await updateAdminProductVariant(editingVariant.id, {
        sku: editForm.sku.trim() || undefined,
        barcode: editForm.barcode.trim() || undefined,
        priceOverride: editForm.priceOverride.trim() ? Number(editForm.priceOverride) : null,
        stockQuantity,
        status: editForm.status,
      });
      toast({ title: t("admin.variants.variantUpdated") });
      setEditingVariant(null);
      onChange();
    } catch (error) {
      setEditError(safeErrorMessage(error, t("admin.variants.variantSaveError")));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const toggleVariantActivation = async (variant: AdminProductVariant) => {
    setBusyVariantId(variant.id);
    try {
      const nextAvailable = !variant.isAvailable;
      await updateAdminProductVariant(variant.id, {
        isAvailable: nextAvailable,
        status: nextAvailable && variant.stockQuantity > 0 ? "ACTIVE" : "INACTIVE",
      });
      toast({ title: nextAvailable ? t("admin.variants.variantActivated") : t("admin.variants.variantDeactivated") });
      onChange();
    } catch (error) {
      toast({ title: safeErrorMessage(error, t("admin.variants.variantSaveError")), variant: "destructive" });
    } finally {
      setBusyVariantId(null);
    }
  };

  const toggleSelectVariant = (variantId: string) => {
    setSelectedVariantIds((current) => {
      const next = new Set(current);
      if (next.has(variantId)) next.delete(variantId);
      else next.add(variantId);
      return next;
    });
  };

  const runBulkEdit = async () => {
    if (selectedVariantIds.size === 0 || (!bulkStatus && !bulkThreshold.trim())) return;
    setIsBulkRunning(true);
    setBulkResults(null);
    const results: Array<{ label: string; ok: boolean; message?: string }> = [];
    for (const variantId of selectedVariantIds) {
      const variant = catalog.variants.find((item) => item.id === variantId);
      const label = variant ? variantLabel(variant) : variantId;
      try {
        await updateAdminProductVariant(variantId, {
          ...(bulkStatus ? { status: bulkStatus } : {}),
          ...(bulkThreshold.trim() ? { lowStockThreshold: Number(bulkThreshold) } : {}),
        });
        results.push({ label, ok: true });
      } catch (error) {
        results.push({ label, ok: false, message: safeErrorMessage(error, t("admin.variants.variantSaveError")) });
      }
    }
    setBulkResults(results);
    setIsBulkRunning(false);
    if (results.some((result) => result.ok)) {
      setSelectedVariantIds(new Set());
      onChange();
    }
  };

  return (
    <div className="space-y-6" data-admin-variants-panel>
      <AdminPanel title={t("admin.variants.optionsTitle")} description={t("admin.variants.optionsDescription")}>
        <div className="space-y-4">
          {catalog.options.map((option) => (
            <div key={option.id} className="rounded-[14px] border border-[#EFE2BC] bg-[#FBFAF7] p-4" data-admin-option={option.code}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-[#050505]">{option.nameEn}<span className="ms-2 font-mono text-xs text-[#8A8D9A]">{option.code}</span></p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {option.values.map((value) => (
                  <span key={value.id} className="inline-flex items-center gap-1.5 rounded-full border border-[#E7C85D]/60 bg-white py-1 ps-3 pe-1.5 text-xs font-bold text-[#765600]">
                    {value.valueEn}
                    <button type="button" aria-label={t("admin.variants.removeValue")} onClick={() => requestDeleteValue(value.id, value.valueEn)} className="grid h-5 w-5 place-items-center rounded-full hover:bg-black/5">
                      <Trash2 size={11} />
                    </button>
                  </span>
                ))}
                {option.values.length === 0 && <p className="text-xs text-[#8A8D9A]">{t("admin.variants.noValuesYet")}</p>}
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <AdminInput
                  id={`value-code-${option.id}`}
                  label={t("admin.variants.valueCode")}
                  value={valueDrafts[option.id]?.code ?? ""}
                  onChange={(event) => setValueDrafts((current) => ({ ...current, [option.id]: { ...(current[option.id] ?? { code: "", valueEn: "", valueAr: "" }), code: event.target.value } }))}
                  wrapperClassName="w-28"
                  maxLength={80}
                />
                <AdminInput
                  id={`value-en-${option.id}`}
                  label={t("admin.variants.valueEn")}
                  value={valueDrafts[option.id]?.valueEn ?? ""}
                  onChange={(event) => setValueDrafts((current) => ({ ...current, [option.id]: { ...(current[option.id] ?? { code: "", valueEn: "", valueAr: "" }), valueEn: event.target.value } }))}
                  wrapperClassName="w-36"
                  maxLength={160}
                />
                <button
                  type="button"
                  disabled={creatingValueForOption === option.id}
                  onClick={() => void submitValue(option.id)}
                  className="inline-flex h-[50px] items-center gap-1.5 rounded-[14px] border border-[#E8D9AF] bg-white px-4 text-sm font-semibold hover:border-[#D4A72C] disabled:opacity-60"
                >
                  {creatingValueForOption === option.id ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {t("admin.variants.addValue")}
                </button>
              </div>
              {valueErrors[option.id] && <p className="mt-1.5 text-xs font-semibold text-[#B42318]">{valueErrors[option.id]}</p>}
            </div>
          ))}

          <div className="flex flex-wrap items-end gap-2 border-t border-[#EFE2BC] pt-4">
            <AdminInput id="new-option-code" label={t("admin.variants.optionCode")} value={optionCode} onChange={(event) => setOptionCode(event.target.value)} wrapperClassName="w-28" maxLength={80} />
            <AdminInput id="new-option-en" label={t("admin.variants.optionNameEn")} value={optionNameEn} onChange={(event) => setOptionNameEn(event.target.value)} wrapperClassName="w-40" maxLength={160} />
            <AdminInput id="new-option-ar" label={t("admin.variants.optionNameAr")} value={optionNameAr} onChange={(event) => setOptionNameAr(event.target.value)} wrapperClassName="w-40" maxLength={160} optional={t("admin.variants.optional")} />
            <button type="button" disabled={isCreatingOption} onClick={() => void submitOption()} className="inline-flex h-[50px] items-center gap-1.5 rounded-[14px] bg-[#F9DC5C] px-4 text-sm font-semibold text-[#050505] hover:bg-[#D4A72C] disabled:opacity-60">
              {isCreatingOption ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {t("admin.variants.addOption")}
            </button>
          </div>
          {optionError && <p className="text-xs font-semibold text-[#B42318]">{optionError}</p>}
        </div>
      </AdminPanel>

      {catalog.options.length > 0 && (
        <AdminPanel title={t("admin.variants.generatorTitle")} description={t("admin.variants.generatorDescription")}>
          <div className="grid gap-4 sm:grid-cols-2">
            {catalog.options.map((option) => (
              <div key={option.id}>
                <p className="text-xs font-bold uppercase tracking-wide text-[#717182]">{option.nameEn}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {option.values.map((value) => {
                    const isSelected = (selectedValueIdsByOption[option.id] ?? []).includes(value.id);
                    return (
                      <button
                        key={value.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => toggleGeneratorValue(option.id, value.id)}
                        className={`h-9 rounded-full border px-3.5 text-xs font-bold transition ${isSelected ? "border-[#D4A72C] bg-[#FFF3B0] text-[#6F5000]" : "border-[#050505]/10 bg-white text-[#717182] hover:border-[#D4A72C]/55"}`}
                      >
                        {value.valueEn}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {generated.length > 0 && (
            <div className="mt-5 space-y-2" data-admin-generated-combinations>
              {generated.map((row) => {
                const alreadyExists = existingSignatures.has(row.signature);
                const isDuplicateInBatch = duplicatesWithinGenerated.has(row.signature);
                const label = combinationDisplayLabel(row.selections.map((s) => ({ optionNameEn: s.optionNameEn, valueEn: s.valueEn })));
                const draft = draftFor(row.key);
                return (
                  <div key={row.key} className="rounded-[14px] border border-[#EFE2BC] bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-[#050505]">{label}</p>
                      {alreadyExists && <AdminStatusBadge tone="slate">{t("admin.variants.alreadyExists")}</AdminStatusBadge>}
                      {!alreadyExists && isDuplicateInBatch && (
                        <AdminStatusBadge tone="red">
                          <AlertTriangle size={12} className="me-1" />
                          {t("admin.variants.duplicateInSelection")}
                        </AdminStatusBadge>
                      )}
                    </div>
                    {!alreadyExists && !isDuplicateInBatch && (
                      <div className="mt-2 flex flex-wrap items-end gap-2">
                        <AdminInput id={`row-sku-${row.key}`} label={t("admin.variants.sku")} value={draft.sku} onChange={(event) => updateDraft(row.key, { sku: event.target.value })} wrapperClassName="w-32" optional={t("admin.variants.optional")} />
                        <AdminInput id={`row-barcode-${row.key}`} label={t("admin.variants.barcode")} value={draft.barcode} onChange={(event) => updateDraft(row.key, { barcode: event.target.value })} wrapperClassName="w-32" optional={t("admin.variants.optional")} />
                        <AdminInput id={`row-price-${row.key}`} type="number" min={0} step={0.01} label={t("admin.variants.priceOverride")} value={draft.priceOverride} onChange={(event) => updateDraft(row.key, { priceOverride: event.target.value })} wrapperClassName="w-32" optional={t("admin.variants.optional")} />
                        <AdminInput id={`row-stock-${row.key}`} type="number" min={0} step={1} label={t("admin.variants.stock")} value={draft.stockQuantity} onChange={(event) => updateDraft(row.key, { stockQuantity: event.target.value })} wrapperClassName="w-24" />
                        <button
                          type="button"
                          disabled={creatingRowKey === row.key}
                          onClick={async () => {
                            setCreatingRowKey(row.key);
                            const outcome = await createCombination(row);
                            setCreatingRowKey(null);
                            if (outcome.ok) {
                              toast({ title: t("admin.variants.variantCreated") });
                              onChange();
                            } else {
                              toast({ title: outcome.message, variant: "destructive" });
                            }
                          }}
                          className="inline-flex h-[50px] items-center gap-1.5 rounded-[14px] border border-[#E8D9AF] bg-white px-4 text-sm font-semibold hover:border-[#D4A72C] disabled:opacity-60"
                        >
                          {creatingRowKey === row.key ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                          {t("admin.variants.create")}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {creatableRows.length > 1 && (
                <button type="button" disabled={isCreatingAll} onClick={() => void createAllValid()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#050505] px-4 text-sm font-semibold text-white hover:bg-[#050505]/85 disabled:opacity-60">
                  {isCreatingAll ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {t("admin.variants.createAll", { values: { count: creatableRows.length } })}
                </button>
              )}

              {creationResults && (
                <div className="rounded-[14px] border border-[#EFE2BC] bg-[#FBFAF7] p-3 text-sm" data-admin-bulk-results="generator">
                  <p className="font-bold text-[#050505]">{t("admin.variants.resultsTitle")}</p>
                  <ul className="mt-2 space-y-1">
                    {creationResults.map((result, index) => (
                      <li key={index} className={`flex items-center gap-2 ${result.ok ? "text-[#137A36]" : "text-[#B42318]"}`}>
                        {result.ok ? <Check size={14} /> : <AlertTriangle size={14} />}
                        <span className="font-semibold">{result.label}</span>
                        {!result.ok && result.message && <span className="text-xs">— {result.message}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </AdminPanel>
      )}

      <AdminPanel title={t("admin.variants.matrixTitle")} description={t("admin.variants.matrixDescription")}>
        {catalog.variants.length === 0 ? (
          <p className="text-sm text-[#717182]">{t("admin.variants.noVariants")}</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-2 rounded-[14px] border border-[#EFE2BC] bg-[#FBFAF7] p-3" data-admin-bulk-edit>
              <p className="w-full text-xs font-bold uppercase tracking-wide text-[#717182]">
                {t("admin.variants.bulkEditSelected", { values: { count: selectedVariantIds.size } })}
              </p>
              <AdminSelect
                id="bulk-status"
                label={t("admin.products.status")}
                value={bulkStatus}
                onChange={(value) => setBulkStatus(value as AdminVariantStatus)}
                options={[{ value: "", label: t("admin.variants.noChange") }, ...VARIANT_STATUS_OPTIONS.map((status) => ({ value: status, label: t(`admin.products.statuses.${status === "LOW_STOCK" ? "lowStock" : status === "OUT_OF_STOCK" ? "outOfStock" : status.toLowerCase()}`) }))]}
                wrapperClassName="w-48"
              />
              <AdminInput id="bulk-threshold" type="number" min={0} step={1} label={t("admin.variants.lowStockThreshold")} value={bulkThreshold} onChange={(event) => setBulkThreshold(event.target.value)} wrapperClassName="w-40" optional={t("admin.variants.optional")} />
              <button
                type="button"
                disabled={selectedVariantIds.size === 0 || isBulkRunning || (!bulkStatus && !bulkThreshold.trim())}
                onClick={() => void runBulkEdit()}
                className="h-[50px] rounded-[14px] bg-[#F9DC5C] px-4 text-sm font-semibold text-[#050505] hover:bg-[#D4A72C] disabled:opacity-60"
              >
                {isBulkRunning ? t("admin.variants.applying") : t("admin.variants.applyBulkEdit")}
              </button>
            </div>
            {bulkResults && (
              <div className="rounded-[14px] border border-[#EFE2BC] bg-[#FBFAF7] p-3 text-sm" data-admin-bulk-results="matrix">
                <p className="font-bold text-[#050505]">{t("admin.variants.resultsTitle")}</p>
                <ul className="mt-2 space-y-1">
                  {bulkResults.map((result, index) => (
                    <li key={index} className={`flex items-center gap-2 ${result.ok ? "text-[#137A36]" : "text-[#B42318]"}`}>
                      {result.ok ? <Check size={14} /> : <AlertTriangle size={14} />}
                      <span className="font-semibold">{result.label}</span>
                      {!result.ok && result.message && <span className="text-xs">— {result.message}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border border-[#EFE2BC]">
              <table className="min-w-full divide-y divide-[#EFE2BC] text-sm">
                <thead className="bg-[#FFF9E8] text-xs uppercase tracking-wide text-[#717182]">
                  <tr>
                    <th className="w-10 px-3 py-3" />
                    <th className="px-4 py-3 text-start font-bold">{t("admin.variants.combination")}</th>
                    <th className="px-4 py-3 text-start font-bold">{t("admin.variants.sku")}</th>
                    <th className="px-4 py-3 text-start font-bold">{t("admin.variants.effectivePrice")}</th>
                    <th className="px-4 py-3 text-start font-bold">{t("admin.variants.stock")}</th>
                    <th className="px-4 py-3 text-start font-bold">{t("admin.products.status")}</th>
                    <th className="px-4 py-3 text-end font-bold">{t("admin.products.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3E8C8]">
                  {catalog.variants.map((variant) => (
                    <tr key={variant.id} data-admin-variant-row={variant.id}>
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={selectedVariantIds.has(variant.id)} onChange={() => toggleSelectVariant(variant.id)} className="h-4 w-4 rounded border-[#D4A72C]/55" aria-label={t("admin.variants.selectVariant")} />
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#050505]">{variantLabel(variant)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[#717182]">{variant.sku ?? "—"}</td>
                      <td className="px-4 py-3">
                        {variant.priceOverride === null ? (
                          <span className="text-[#8A8D9A]">{t("admin.variants.usesParentPrice")}</span>
                        ) : (
                          <span className="font-semibold">{variant.priceOverride}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{variant.stockQuantity}</td>
                      <td className="px-4 py-3">
                        <AdminStatusBadge tone={variant.status === "ACTIVE" ? "green" : variant.status === "OUT_OF_STOCK" ? "red" : variant.status === "LOW_STOCK" ? "amber" : "slate"}>
                          {t(`admin.products.statuses.${variant.status === "LOW_STOCK" ? "lowStock" : variant.status === "OUT_OF_STOCK" ? "outOfStock" : variant.status.toLowerCase()}`)}
                        </AdminStatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button type="button" aria-label={t("admin.variants.editVariant")} title={t("admin.variants.editVariant")} onClick={() => openEditVariant(variant)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#050505]/10 bg-white hover:border-[#D4A72C]/60 hover:bg-[#FFF7D6]">
                            <Sparkles size={13} />
                          </button>
                          <button
                            type="button"
                            aria-label={variant.isAvailable ? t("admin.products.deactivate") : t("admin.products.activate")}
                            title={variant.isAvailable ? t("admin.products.deactivate") : t("admin.products.activate")}
                            disabled={busyVariantId === variant.id}
                            onClick={() => void toggleVariantActivation(variant)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#050505]/10 bg-white hover:border-[#D4A72C]/60 hover:bg-[#FFF7D6] disabled:opacity-50"
                          >
                            {variant.isAvailable ? <PowerOff size={13} /> : <Power size={13} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </AdminPanel>

      {editingVariant && (
        <Dialog open onOpenChange={(open) => { if (!open && !isSavingEdit) setEditingVariant(null); }}>
          <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] min-w-0 flex-col overflow-hidden rounded-[20px] border-[#EFE2BC] bg-white p-0 sm:max-w-[560px]">
            <DialogHeader className="shrink-0 border-b border-[#EFE2BC] px-6 pb-4 pt-6">
              <DialogTitle>{variantLabel(editingVariant)}</DialogTitle>
              <DialogDescription>{t("admin.variants.editVariantDescription")}</DialogDescription>
            </DialogHeader>
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <AdminInput id="edit-sku" label={t("admin.variants.sku")} value={editForm.sku} onChange={(event) => setEditForm((current) => ({ ...current, sku: event.target.value }))} />
                <AdminInput id="edit-barcode" label={t("admin.variants.barcode")} value={editForm.barcode} onChange={(event) => setEditForm((current) => ({ ...current, barcode: event.target.value }))} />
                <AdminInput id="edit-price" type="number" min={0} step={0.01} label={t("admin.variants.priceOverride")} value={editForm.priceOverride} onChange={(event) => setEditForm((current) => ({ ...current, priceOverride: event.target.value }))} optional={t("admin.variants.fallbackHint")} />
                <AdminInput id="edit-stock" type="number" min={0} step={1} label={t("admin.variants.stock")} value={editForm.stockQuantity} onChange={(event) => setEditForm((current) => ({ ...current, stockQuantity: event.target.value }))} />
                <AdminSelect id="edit-status" label={t("admin.products.status")} value={editForm.status} onChange={(value) => setEditForm((current) => ({ ...current, status: value as AdminVariantStatus }))} options={VARIANT_STATUS_OPTIONS.map((status) => ({ value: status, label: t(`admin.products.statuses.${status === "LOW_STOCK" ? "lowStock" : status === "OUT_OF_STOCK" ? "outOfStock" : status.toLowerCase()}`) }))} wrapperClassName="sm:col-span-2" />
              </div>
              {editError && <p role="alert" className="mt-4 rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] p-3 text-sm font-semibold text-[#B42318]">{editError}</p>}
            </div>
            <DialogFooter className="shrink-0 gap-2 border-t border-[#EFE2BC] bg-white px-6 py-4 sm:gap-2">
              <button type="button" onClick={() => setEditingVariant(null)} disabled={isSavingEdit} className="h-10 rounded-lg border border-[#EFE2BC] bg-white px-4 text-sm font-semibold text-[#717182]">{t("common.cancel")}</button>
              <button type="button" disabled={isSavingEdit} onClick={() => void saveEditVariant()} className="h-10 rounded-lg bg-[#F9DC5C] px-4 text-sm font-semibold text-[#050505] hover:bg-[#D4A72C] disabled:opacity-60">
                {isSavingEdit ? t("admin.products.saving") : t("admin.products.saveChanges")}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={Boolean(deleteValueTarget)} onOpenChange={(open) => { if (!open) setDeleteValueTarget(null); }}>
        <AlertDialogContent className="rounded-[20px] border-[#EFE2BC] bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.variants.deleteValueTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.variants.deleteValueDescription", { values: { value: deleteValueTarget?.label ?? "" } })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingValue}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={isDeletingValue} onClick={(event) => { event.preventDefault(); void confirmDeleteValue(false); }} className="bg-[#B42318] text-white hover:bg-[#8F1C13]">
              {isDeletingValue ? t("admin.products.deleting") : t("admin.products.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(forceDeleteWarning)} onOpenChange={(open) => { if (!open) setForceDeleteWarning(null); }}>
        <AlertDialogContent className="rounded-[20px] border-[#EFE2BC] bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.variants.forceDeleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.variants.forceDeleteDescription", { values: { count: forceDeleteWarning?.activeVariantCount ?? 0, value: forceDeleteWarning?.label ?? "" } })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingValue}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={isDeletingValue} onClick={(event) => { event.preventDefault(); void confirmDeleteValue(true); }} className="bg-[#B42318] text-white hover:bg-[#8F1C13]">
              {isDeletingValue ? t("admin.products.deleting") : t("admin.variants.forceDeleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
