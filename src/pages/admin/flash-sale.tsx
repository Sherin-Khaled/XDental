import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ImageOff, Pencil, Plus, RefreshCw, Trash2, Zap } from "lucide-react";
import { DentalSelect } from "@/components/dental/Select";
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
import { useLanguage } from "@/context/LanguageContext";
import { useStore } from "@/context/StoreContext";
import { useToast } from "@/hooks/use-toast";
import {
  createAdminFlashSale,
  deleteAdminFlashSale,
  getAdminFlashSales,
  updateAdminFlashSale,
  type AdminFlashSale,
  type AdminFlashSaleInput,
} from "@/services/adminFlashSale";
import { getAdminProducts, type AdminProduct } from "@/services/adminCatalog";
import { ApiError, resolveApiAssetUrl } from "@/services/http";
import { AdminLayout } from "./_components/AdminLayout";
import { AdminPageHeader, AdminStatusBadge, AdminTableShell } from "./_components/admin-ui";
import type { StatusTone } from "./admin-data";

type FlashSaleForm = {
  productId: string;
  salePrice: string;
  startsAt: string;
  endsAt: string;
  isActive: "true" | "false";
  displayOrder: string;
};

type FlashSaleFormErrors = Partial<Record<keyof FlashSaleForm, string>>;

const NONE_VALUE = "none";
const CAIRO_TIMEZONE = "Africa/Cairo";
const EMPTY_FORM: FlashSaleForm = {
  productId: NONE_VALUE,
  salePrice: "",
  startsAt: "",
  endsAt: "",
  isActive: "true",
  displayOrder: "0",
};

type SaleState = "active" | "scheduled" | "expired" | "inactive";

function saleState(flashSale: AdminFlashSale): SaleState {
  if (!flashSale.isActive) return "inactive";
  const now = Date.now();
  if (now < new Date(flashSale.startsAt).getTime()) return "scheduled";
  if (now >= new Date(flashSale.endsAt).getTime()) return "expired";
  return "active";
}

const STATE_TONES: Record<SaleState, StatusTone> = {
  active: "green",
  scheduled: "amber",
  expired: "slate",
  inactive: "slate",
};

function FlashSaleRowThumbnail({ imageUrl }: { imageUrl?: string | null }) {
  const [hasImageError, setHasImageError] = useState(false);
  const resolvedUrl = imageUrl ? resolveApiAssetUrl(imageUrl) ?? imageUrl : null;

  return resolvedUrl && !hasImageError ? (
    <img
      src={resolvedUrl}
      alt=""
      className="h-full w-full object-cover"
      onError={() => setHasImageError(true)}
    />
  ) : (
    <ImageOff size={16} className="text-[#B88A44]" />
  );
}

function cairoDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CAIRO_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function toCairoInputValue(iso: string) {
  const parts = cairoDateParts(new Date(iso));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function cairoInputToDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const intendedUtc = Date.UTC(+year, +month - 1, +day, +hour, +minute);
  let candidate = intendedUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = cairoDateParts(new Date(candidate));
    const representedUtc = Date.UTC(
      +parts.year,
      +parts.month - 1,
      +parts.day,
      +parts.hour,
      +parts.minute,
      +parts.second
    );
    candidate += intendedUtc - representedUtc;
  }
  const result = new Date(candidate);
  return toCairoInputValue(result.toISOString()) === value ? result : null;
}

function toForm(flashSale: AdminFlashSale): FlashSaleForm {
  return {
    productId: flashSale.product?.id ?? NONE_VALUE,
    salePrice: String(flashSale.salePrice),
    startsAt: toCairoInputValue(flashSale.startsAt),
    endsAt: toCairoInputValue(flashSale.endsAt),
    isActive: flashSale.isActive ? "true" : "false",
    displayOrder: String(flashSale.displayOrder),
  };
}

export default function AdminFlashSalePage() {
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const { currentUser } = useStore();
  const isAdmin = currentUser?.role?.trim().toLowerCase() === "admin";
  const [flashSales, setFlashSales] = useState<AdminFlashSale[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFlashSale, setEditingFlashSale] = useState<AdminFlashSale | null>(null);
  const [form, setForm] = useState<FlashSaleForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FlashSaleFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminFlashSale | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);
    getAdminFlashSales({ signal: controller.signal })
      .then(setFlashSales)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : t("admin.flashSale.loadError"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [refreshVersion, t]);

  // Bounded, searchable product picker — the catalogue is thousands of rows,
  // so this never fetches more than a small page at a time.
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      getAdminProducts({ search: productSearch.trim() || undefined, sort: "name", direction: "asc", limit: 50, signal: controller.signal })
        .then((result) => {
          if (!controller.signal.aborted) setProducts(result.products.filter((product) => product.price !== null));
        })
        .catch(() => {});
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [productSearch]);

  const formatPrice = (price: number | null) => price === null
    ? t("admin.products.notProvided")
    : new Intl.NumberFormat(language === "ar" ? "ar-EG" : "en-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 2 }).format(price);

  const formatDateTime = (iso: string) =>
    new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-EG", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: CAIRO_TIMEZONE,
    }).format(new Date(iso));

  const stateLabels: Record<SaleState, string> = useMemo(() => ({
    active: t("admin.flashSale.statuses.active"),
    scheduled: t("admin.flashSale.statuses.scheduled"),
    expired: t("admin.flashSale.statuses.expired"),
    inactive: t("admin.flashSale.statuses.inactive"),
  }), [t]);

  const productOptions = useMemo(() => {
    const options = products.map((product) => ({ value: product.id, label: `${product.name} — ${formatPrice(product.price)}` }));
    // The current search page may not include the already-selected product
    // (e.g. when editing) — keep it selectable without widening the fetch.
    const activeProduct = editingFlashSale?.product;
    if (activeProduct && form.productId === activeProduct.id && !options.some((option) => option.value === activeProduct.id)) {
      options.unshift({ value: activeProduct.id, label: `${activeProduct.name} — ${formatPrice(activeProduct.price)}` });
    }
    return options;
  }, [products, editingFlashSale, form.productId, language]);

  const selectedProduct =
    products.find((product) => product.id === form.productId) ??
    (editingFlashSale?.product?.id === form.productId ? editingFlashSale.product : null);
  const overlapCount = useMemo(() => {
    const proposedStart = cairoInputToDate(form.startsAt)?.getTime();
    const proposedEnd = cairoInputToDate(form.endsAt)?.getTime();
    if (!proposedStart || !proposedEnd || proposedEnd <= proposedStart || form.productId === NONE_VALUE) return 0;
    return flashSales.filter((sale) =>
      sale.id !== editingFlashSale?.id
      && sale.product?.id === form.productId
      && proposedStart < new Date(sale.endsAt).getTime()
      && proposedEnd > new Date(sale.startsAt).getTime()
    ).length;
  }, [editingFlashSale?.id, flashSales, form.endsAt, form.productId, form.startsAt]);

  const updateField = <K extends keyof FlashSaleForm>(field: K, value: FlashSaleForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  };

  const openCreate = () => {
    setEditingFlashSale(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormError(null);
    setProductSearch("");
    setIsFormOpen(true);
  };

  const openEdit = (flashSale: AdminFlashSale) => {
    setEditingFlashSale(flashSale);
    setForm(toForm(flashSale));
    setFormErrors({});
    setFormError(null);
    setProductSearch("");
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingFlashSale(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormError(null);
    setProductSearch("");
  };

  const validateForm = () => {
    const errors: FlashSaleFormErrors = {};
    const salePrice = Number(form.salePrice);
    if (form.productId === NONE_VALUE) errors.productId = t("admin.flashSale.validation.product");
    if (!form.salePrice.trim() || !Number.isFinite(salePrice) || salePrice <= 0) {
      errors.salePrice = t("admin.flashSale.validation.salePrice");
    } else if (selectedProduct?.price !== null && selectedProduct !== null && salePrice >= (selectedProduct?.price ?? Infinity)) {
      errors.salePrice = t("admin.flashSale.validation.salePriceTooHigh");
    }
    if (!form.startsAt) errors.startsAt = t("admin.flashSale.validation.startsAt");
    if (!form.endsAt) errors.endsAt = t("admin.flashSale.validation.endsAt");
    const startsAt = form.startsAt ? cairoInputToDate(form.startsAt) : null;
    const endsAt = form.endsAt ? cairoInputToDate(form.endsAt) : null;
    if (form.startsAt && !startsAt) errors.startsAt = t("admin.flashSale.validation.startsAt");
    if (form.endsAt && !endsAt) errors.endsAt = t("admin.flashSale.validation.endsAt");
    if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
      errors.endsAt = t("admin.flashSale.validation.endsAtBeforeStart");
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      window.requestAnimationFrame(() => {
        const invalid = formRef.current?.querySelector<HTMLElement>(
          '[aria-invalid="true"]'
        );
        const target = invalid?.matches("input, textarea, button")
          ? invalid
          : invalid?.querySelector<HTMLElement>("input, textarea, button");
        target?.focus();
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
    return Object.keys(errors).length === 0;
  };

  const saveFlashSale = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateForm()) return;
    const input: AdminFlashSaleInput = {
      productId: form.productId,
      salePrice: Number(form.salePrice),
      startsAt: cairoInputToDate(form.startsAt)!.toISOString(),
      endsAt: cairoInputToDate(form.endsAt)!.toISOString(),
      isActive: form.isActive === "true",
      displayOrder: Number(form.displayOrder) || 0,
    };
    setIsSaving(true);
    setFormError(null);
    try {
      if (editingFlashSale) {
        await updateAdminFlashSale(editingFlashSale.id, input);
        toast({ title: t("admin.flashSale.updatedSuccess") });
      } else {
        await createAdminFlashSale(input);
        toast({ title: t("admin.flashSale.createdSuccess") });
      }
      closeForm();
      setRefreshVersion((value) => value + 1);
    } catch (error) {
      if (error instanceof ApiError && error.field && error.field in EMPTY_FORM) {
        setFormErrors((current) => ({ ...current, [error.field as keyof FlashSaleForm]: error.message }));
        window.requestAnimationFrame(() => {
          const invalid = formRef.current?.querySelector<HTMLElement>(
            '[aria-invalid="true"]'
          );
          const target = invalid?.matches("input, textarea, button")
            ? invalid
            : invalid?.querySelector<HTMLElement>("input, textarea, button");
          target?.focus();
        });
      } else {
        setFormError(error instanceof Error ? error.message : t("admin.flashSale.saveError"));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteAdminFlashSale(deleteTarget.id);
      setDeleteTarget(null);
      setRefreshVersion((value) => value + 1);
      toast({ title: t("admin.flashSale.deletedSuccess") });
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : t("admin.flashSale.deleteError"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminPageHeader
          title={t("admin.flashSale.title")}
          description={t("admin.flashSale.description")}
          action={
            isAdmin ? (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#F9DC5C] px-4 text-sm font-semibold text-[#050505] shadow-sm transition hover:-translate-y-px hover:bg-[#D4A72C] focus:outline-none focus:ring-2 focus:ring-[#D4A72C]/45"
              >
                <Plus size={16} />
                {t("admin.flashSale.addFlashSale")}
              </button>
            ) : undefined
          }
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setRefreshVersion((value) => value + 1)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#EFE2BC] px-4 text-sm font-semibold text-[#717182] hover:bg-[#FBFAF7] dark:hover:border-[#D4A72C]/40 dark:hover:bg-white/[0.05] dark:hover:text-[#F6D85D]"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            {t("admin.flashSale.refresh")}
          </button>
        </div>

        {loadError && <div role="alert" className="rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] p-4 text-sm font-semibold text-[#B42318]">{loadError}</div>}

        <AdminTableShell>
          <table className="min-w-full divide-y divide-[#EFE2BC] text-sm">
            <thead className="bg-[#FFF9E8] text-xs uppercase tracking-wide text-[#717182]">
              <tr>
                <th className="px-5 py-3 text-start font-bold">{t("admin.flashSale.product")}</th>
                <th className="px-5 py-3 text-start font-bold">{t("admin.flashSale.salePrice")}</th>
                <th className="px-5 py-3 text-start font-bold">{t("admin.flashSale.originalPrice")}</th>
                <th className="px-5 py-3 text-start font-bold">{t("admin.flashSale.startsAt")}</th>
                <th className="px-5 py-3 text-start font-bold">{t("admin.flashSale.endsAt")}</th>
                <th className="px-5 py-3 text-start font-bold">{t("admin.flashSale.statusColumn")}</th>
                {isAdmin && <th className="px-5 py-3 text-end font-bold">{t("admin.flashSale.actions")}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3E8C8]">
              {flashSales.map((flashSale) => {
                const state = saleState(flashSale);
                return (
                  <tr key={flashSale.id}>
                    <td className="min-w-[220px] px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#EFE2BC] bg-[#FBFAF7]">
                          <FlashSaleRowThumbnail imageUrl={flashSale.product?.imageUrl} />
                        </span>
                        <p className="truncate font-semibold text-[#050505]">
                          {flashSale.product?.name ?? t("admin.products.notProvided")}
                        </p>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 font-semibold text-[#050505]">{formatPrice(flashSale.salePrice)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-[#717182] line-through">{formatPrice(flashSale.product?.price ?? null)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-[#717182]">{formatDateTime(flashSale.startsAt)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-[#717182]">{formatDateTime(flashSale.endsAt)}</td>
                    <td className="px-5 py-4"><AdminStatusBadge tone={STATE_TONES[state]}>{stateLabels[state]}</AdminStatusBadge></td>
                    {isAdmin && (
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => openEdit(flashSale)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#050505]/10 bg-white px-3 text-xs font-semibold hover:border-[#D4A72C]/60 hover:bg-[#FFF7D6] dark:hover:border-[#D4A72C]/40 dark:hover:bg-white/[0.05] dark:hover:text-[#F6D85D]">
                            <Pencil size={13} />
                            {t("admin.flashSale.edit")}
                          </button>
                          <button type="button" onClick={() => { setDeleteTarget(flashSale); setDeleteError(null); }} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#F2C8C8] bg-white px-3 text-xs font-semibold text-[#B42318] hover:bg-[#FFF3F3] dark:hover:border-[#F97066]/40 dark:hover:bg-[#B42318]/15 dark:hover:text-[#FDA29B]">
                            <Trash2 size={13} />
                            {t("admin.flashSale.delete")}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {isLoading && flashSales.length === 0 && (
                <tr><td colSpan={isAdmin ? 7 : 6} className="px-5 py-10 text-center text-[#717182]">{t("admin.flashSale.loading")}</td></tr>
              )}
              {!isLoading && !loadError && flashSales.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="px-5 py-10 text-center">
                    <Zap size={28} className="mx-auto text-[#D4A72C]" />
                    <p className="mt-3 text-sm font-medium text-[#717182]">{t("admin.flashSale.noFlashSales")}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </AdminTableShell>
      </div>

      <Dialog open={isFormOpen} onOpenChange={(open) => (open ? setIsFormOpen(true) : closeForm())}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] min-w-0 flex-col overflow-hidden rounded-[22px] border-[#EFE2BC] bg-[#FFFEFB] p-0 sm:max-w-[640px]">
          <DialogHeader className="shrink-0 border-b border-[#EFE2BC] px-6 pb-5 pt-6">
            <DialogTitle className="text-2xl font-bold">
              {editingFlashSale ? t("admin.flashSale.editFlashSale") : t("admin.flashSale.addFlashSale")}
            </DialogTitle>
            <DialogDescription>{t("admin.flashSale.formDescription")}</DialogDescription>
          </DialogHeader>
          <form ref={formRef} onSubmit={saveFlashSale} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-5">
            <div className="mb-4 rounded-[14px] border border-[#D4A72C]/25 bg-[#FFF9E8] px-4 py-3 text-sm leading-6 text-[#62521D] dark:bg-[#D4A72C]/10 dark:text-[#F4E6A6]">
              {t("admin.flashSale.checkoutBehavior")}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div
                className="sm:col-span-2"
                aria-invalid={Boolean(formErrors.productId)}
                aria-describedby={formErrors.productId ? "flash-product-error" : undefined}
              >
                <span className="text-sm font-bold">{t("admin.flashSale.product")}</span>
                <input
                  type="search"
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder={t("admin.products.searchPlaceholder")}
                  className="mt-2 h-11 w-full rounded-[14px] border border-[#050505]/10 bg-white px-4 text-sm outline-none transition focus:border-[#D4A72C] focus:ring-4 focus:ring-[#D4A72C]/10"
                />
                <DentalSelect
                  label={t("admin.flashSale.product")}
                  value={form.productId}
                  onChange={(value) => updateField("productId", value)}
                  placeholder={t("admin.flashSale.selectProduct")}
                  options={[{ value: NONE_VALUE, label: t("admin.flashSale.selectProduct"), disabled: true }, ...productOptions]}
                  triggerClassName="mt-2 h-[50px] rounded-[14px]"
                />
                {formErrors.productId && <p id="flash-product-error" role="alert" className="mt-1.5 text-xs font-semibold text-[#B42318]">{formErrors.productId}</p>}
              </div>

              <label className="block">
                <span className="text-sm font-bold text-[#050505]">{t("admin.flashSale.salePrice")}</span>
                <input
                  id="flash-sale-price"
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.salePrice}
                  onChange={(event) => updateField("salePrice", event.target.value)}
                  aria-invalid={Boolean(formErrors.salePrice)}
                  aria-describedby={formErrors.salePrice ? "flash-sale-price-error" : undefined}
                  className={`mt-2 h-[50px] w-full rounded-[14px] border bg-white px-4 text-sm font-semibold outline-none transition focus:ring-4 ${formErrors.salePrice ? "border-[#B42318]/55 focus:border-[#B42318] focus:ring-[#B42318]/10" : "border-[#050505]/10 focus:border-[#D4A72C] focus:ring-[#D4A72C]/10"}`}
                />
                {formErrors.salePrice && <p id="flash-sale-price-error" role="alert" className="mt-1.5 text-xs font-semibold text-[#B42318]">{formErrors.salePrice}</p>}
              </label>

              <div>
                <span className="text-sm font-bold">{t("admin.flashSale.active")}</span>
                <DentalSelect
                  label={t("admin.flashSale.active")}
                  value={form.isActive}
                  onChange={(value) => updateField("isActive", value as "true" | "false")}
                  options={[
                    { value: "true", label: t("common.yes", { fallback: "Yes" }) },
                    { value: "false", label: t("common.no", { fallback: "No" }) },
                  ]}
                  triggerClassName="mt-2 h-[50px] rounded-[14px]"
                />
              </div>

              <label className="block">
                <span className="text-sm font-bold text-[#050505]">{t("admin.flashSale.startsAt")} <span className="font-medium text-[#717182]">({CAIRO_TIMEZONE})</span></span>
                <input
                  id="flash-sale-start"
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(event) => updateField("startsAt", event.target.value)}
                  aria-invalid={Boolean(formErrors.startsAt)}
                  aria-describedby={formErrors.startsAt ? "flash-sale-start-error" : undefined}
                  className={`mt-2 h-[50px] w-full rounded-[14px] border bg-white px-4 text-sm font-semibold outline-none transition focus:ring-4 ${formErrors.startsAt ? "border-[#B42318]/55 focus:border-[#B42318] focus:ring-[#B42318]/10" : "border-[#050505]/10 focus:border-[#D4A72C] focus:ring-[#D4A72C]/10"}`}
                />
                {formErrors.startsAt && <p id="flash-sale-start-error" role="alert" className="mt-1.5 text-xs font-semibold text-[#B42318]">{formErrors.startsAt}</p>}
              </label>

              <label className="block">
                <span className="text-sm font-bold text-[#050505]">{t("admin.flashSale.endsAt")} <span className="font-medium text-[#717182]">({CAIRO_TIMEZONE})</span></span>
                <input
                  id="flash-sale-end"
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(event) => updateField("endsAt", event.target.value)}
                  aria-invalid={Boolean(formErrors.endsAt)}
                  aria-describedby={formErrors.endsAt ? "flash-sale-end-error" : undefined}
                  className={`mt-2 h-[50px] w-full rounded-[14px] border bg-white px-4 text-sm font-semibold outline-none transition focus:ring-4 ${formErrors.endsAt ? "border-[#B42318]/55 focus:border-[#B42318] focus:ring-[#B42318]/10" : "border-[#050505]/10 focus:border-[#D4A72C] focus:ring-[#D4A72C]/10"}`}
                />
                {formErrors.endsAt && <p id="flash-sale-end-error" role="alert" className="mt-1.5 text-xs font-semibold text-[#B42318]">{formErrors.endsAt}</p>}
              </label>

              <label className="block">
                <span className="text-sm font-bold text-[#050505]">{t("admin.flashSale.displayOrder")}</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={form.displayOrder}
                  onChange={(event) => updateField("displayOrder", event.target.value)}
                  className="mt-2 h-[50px] w-full rounded-[14px] border border-[#050505]/10 bg-white px-4 text-sm font-semibold outline-none transition focus:border-[#D4A72C] focus:ring-4 focus:ring-[#D4A72C]/10"
                />
              </label>
            </div>

            {overlapCount > 0 && (
              <p role="status" className="mt-4 rounded-lg border border-[#D4A72C]/35 bg-[#FFF9E8] p-3 text-sm font-semibold text-[#725A00] dark:bg-[#D4A72C]/10 dark:text-[#F4E6A6]">
                {t("admin.flashSale.overlapWarning", { values: { count: overlapCount } })}
              </p>
            )}

            {formError && <p role="alert" className="mt-4 rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] p-3 text-sm font-semibold text-[#B42318]">{formError}</p>}
            </div>

            <DialogFooter className="shrink-0 gap-2 border-t border-[#EFE2BC] bg-[#FFFEFB] px-6 py-4 sm:gap-2">
              <button type="button" onClick={closeForm} disabled={isSaving} className="h-10 rounded-lg border border-[#EFE2BC] bg-white px-4 text-sm font-semibold text-[#717182]">
                {t("common.cancel")}
              </button>
              <button type="submit" disabled={isSaving} className="h-10 rounded-lg bg-[#F9DC5C] px-4 text-sm font-semibold hover:bg-[#D4A72C] disabled:opacity-60">
                {isSaving ? t("admin.flashSale.saving") : editingFlashSale ? t("admin.flashSale.saveChanges") : t("admin.flashSale.createFlashSale")}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !isDeleting) setDeleteTarget(null); }}>
        <AlertDialogContent className="rounded-[20px] border-[#EFE2BC] bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.flashSale.deleteFlashSale")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.flashSale.deleteConfirmation", { values: { name: deleteTarget?.product?.name ?? "" } })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p role="alert" className="rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] p-3 text-sm font-semibold text-[#B42318]">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => { event.preventDefault(); void confirmDelete(); }}
              disabled={isDeleting}
              className="bg-[#B42318] text-white hover:bg-[#8F1C13]"
            >
              {isDeleting ? t("admin.flashSale.deleting") : t("admin.flashSale.deleteFlashSale")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
