import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Building2, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { useSearch } from "wouter";
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
  createAdminBrand,
  deleteAdminBrand,
  getAdminBrands,
  updateAdminBrand,
  type AdminBrand,
  type AdminBrandInput,
  type AdminBrandStatus,
} from "@/services/adminBrands";
import { ApiError } from "@/services/http";
import { AdminLayout } from "./_components/AdminLayout";
import { AdminPageHeader, AdminStatusBadge, AdminTableShell } from "./_components/admin-ui";
import type { StatusTone } from "./admin-data";

type BrandForm = {
  name: string;
  country: string;
  logoUrl: string;
  description: string;
  featured: "true" | "false";
  status: AdminBrandStatus;
};

type BrandFormErrors = Partial<Record<keyof BrandForm, string>>;

const EMPTY_FORM: BrandForm = {
  name: "",
  country: "",
  logoUrl: "",
  description: "",
  featured: "false",
  status: "ACTIVE",
};

const STATUS_TONES: Record<AdminBrandStatus, StatusTone> = {
  ACTIVE: "green",
  INACTIVE: "slate",
  NEEDS_LOGO: "amber",
};

function validLogoUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function BrandField({
  id,
  label,
  value,
  onChange,
  error,
  type = "text",
  maxLength,
}: {
  id: keyof BrandForm;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  maxLength?: number;
}) {
  return <label htmlFor={`brand-${id}`} className="block"><span className="text-sm font-bold text-[#050505]">{label}</span><input id={`brand-${id}`} type={type} value={value} onChange={(event) => onChange(event.target.value)} maxLength={maxLength} aria-invalid={Boolean(error)} className={`mt-2 h-[50px] w-full rounded-[14px] border bg-white px-4 text-sm font-semibold text-[#050505] outline-none transition focus:ring-4 ${error ? "border-[#B42318]/55 focus:border-[#B42318] focus:ring-[#B42318]/10" : "border-[#050505]/10 focus:border-[#D4A72C] focus:ring-[#D4A72C]/10"}`} />{error && <p className="mt-1.5 text-xs font-semibold text-[#B42318]">{error}</p>}</label>;
}

function toForm(brand: AdminBrand): BrandForm {
  return {
    name: brand.name,
    country: brand.country ?? "",
    logoUrl: brand.logoUrl ?? "",
    description: brand.description ?? "",
    featured: brand.featured ? "true" : "false",
    status: brand.status,
  };
}

export default function AdminBrands() {
  const queryString = useSearch();
  const { currentUser } = useStore();
  const { t } = useLanguage();
  const { toast } = useToast();
  const initialSearch = useMemo(() => new URLSearchParams(queryString).get("search")?.trim() ?? "", [queryString]);
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<AdminBrandStatus | "all">("all");
  const [featuredFilter, setFeaturedFilter] = useState<"all" | "true" | "false">("all");
  const [brands, setBrands] = useState<AdminBrand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<AdminBrand | null>(null);
  const [form, setForm] = useState<BrandForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<BrandFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminBrand | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const isAdmin = currentUser?.role?.trim().toLowerCase() === "admin";

  useEffect(() => { setSearch(initialSearch); }, [initialSearch]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setIsLoading(true);
      setLoadError(null);
      getAdminBrands({
        search,
        status: statusFilter === "all" ? undefined : statusFilter,
        featured: featuredFilter === "all" ? undefined : featuredFilter === "true",
        signal: controller.signal,
      }).then(setBrands).catch((error: unknown) => {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : t("admin.brands.loadError"));
      }).finally(() => { if (!controller.signal.aborted) setIsLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [featuredFilter, refreshVersion, search, statusFilter, t]);

  const statusOptions = useMemo(() => [
    { value: "ACTIVE", label: t("admin.brands.statuses.active") },
    { value: "INACTIVE", label: t("admin.brands.statuses.inactive") },
    { value: "NEEDS_LOGO", label: t("admin.brands.statuses.needsLogo") },
  ], [t]);

  const updateField = <K extends keyof BrandForm>(field: K, value: BrandForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  };

  const openCreate = () => {
    setEditingBrand(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEdit = (brand: AdminBrand) => {
    setEditingBrand(brand);
    setForm(toForm(brand));
    setFormErrors({});
    setFormError(null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingBrand(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormError(null);
  };

  const validateForm = () => {
    const errors: BrandFormErrors = {};
    if (!form.name.trim()) errors.name = t("admin.brands.validation.name");
    if (!validLogoUrl(form.logoUrl)) errors.logoUrl = t("admin.brands.validation.logoUrl");
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveBrand = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateForm()) return;
    const input: AdminBrandInput = {
      name: form.name.trim(),
      country: form.country.trim() || undefined,
      logoUrl: form.logoUrl.trim() || undefined,
      description: form.description.trim() || undefined,
      featured: form.featured === "true",
      status: form.status,
    };
    setIsSaving(true);
    setFormError(null);
    try {
      if (editingBrand) {
        await updateAdminBrand(editingBrand.id, input);
        toast({ title: t("admin.brands.updatedSuccess") });
      } else {
        await createAdminBrand(input);
        toast({ title: t("admin.brands.createdSuccess") });
      }
      closeForm();
      setRefreshVersion((value) => value + 1);
    } catch (error) {
      if (error instanceof ApiError && error.field && error.field in EMPTY_FORM) {
        setFormErrors((current) => ({ ...current, [error.field as keyof BrandForm]: error.status === 409 ? t("admin.brands.duplicate") : error.message }));
      } else {
        setFormError(error instanceof Error ? error.message : t("admin.brands.saveError"));
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
      await deleteAdminBrand(deleteTarget.id);
      setDeleteTarget(null);
      setRefreshVersion((value) => value + 1);
      toast({ title: t("admin.brands.deletedSuccess") });
    } catch (error) {
      setDeleteError(error instanceof ApiError && error.status === 409 ? t("admin.brands.linkedDeleteError") : error instanceof Error ? error.message : t("admin.brands.deleteError"));
    } finally {
      setIsDeleting(false);
    }
  };

  return <AdminLayout><div className="space-y-6">
    <AdminPageHeader title={t("admin.brands.title")} description={t("admin.brands.description")} action={isAdmin ? <button type="button" onClick={openCreate} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#F9DC5C] px-4 text-sm font-semibold text-[#050505] shadow-sm transition hover:-translate-y-px hover:bg-[#D4A72C] focus:outline-none focus:ring-2 focus:ring-[#D4A72C]/45"><Plus size={16} />{t("admin.brands.addBrand")}</button> : undefined} />
    <section className="grid gap-3 rounded-lg border border-[#EFE2BC] bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_190px_190px_auto] xl:items-end">
      <label><span className="text-xs font-bold uppercase tracking-wide text-[#717182]">{t("admin.brands.searchBrands")}</span><span className="mt-2 flex h-11 items-center gap-2 rounded-lg border border-[#050505]/10 bg-[#FBFAF7] px-3"><Search size={16} className="text-[#D4A72C]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("admin.brands.searchPlaceholder")} className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></span></label>
      <div><span className="text-xs font-bold uppercase tracking-wide text-[#717182]">{t("admin.brands.status")}</span><DentalSelect label={t("admin.brands.status")} value={statusFilter} onChange={(value) => setStatusFilter(value as AdminBrandStatus | "all")} options={[{ value: "all", label: t("admin.brands.allStatuses") }, ...statusOptions]} triggerClassName="mt-2 h-11 rounded-lg bg-[#FBFAF7]" /></div>
      <div><span className="text-xs font-bold uppercase tracking-wide text-[#717182]">{t("admin.brands.featured")}</span><DentalSelect label={t("admin.brands.featured")} value={featuredFilter} onChange={(value) => setFeaturedFilter(value as "all" | "true" | "false")} options={[{ value: "all", label: t("admin.brands.allFeatured") }, { value: "true", label: t("common.yes", { fallback: "Yes" }) }, { value: "false", label: t("common.no", { fallback: "No" }) }]} triggerClassName="mt-2 h-11 rounded-lg bg-[#FBFAF7]" /></div>
      <button type="button" onClick={() => setRefreshVersion((value) => value + 1)} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#EFE2BC] px-4 text-sm font-semibold text-[#717182] hover:bg-[#FFF9E8] dark:hover:border-[#D4A72C]/40 dark:hover:bg-white/[0.05] dark:hover:text-[#F6D85D]"><RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />{t("admin.brands.refresh")}</button>
    </section>
    {loadError && <div role="alert" className="rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] p-4 text-sm font-semibold text-[#B42318]">{loadError}</div>}
    <AdminTableShell><table className="min-w-full divide-y divide-[#EFE2BC] text-sm"><thead className="bg-[#FFF9E8] text-xs uppercase tracking-wide text-[#717182]"><tr><th className="px-5 py-3 text-start font-bold">{t("admin.brands.brand")}</th><th className="px-5 py-3 text-start font-bold">{t("admin.brands.country")}</th><th className="px-5 py-3 text-start font-bold">{t("admin.brands.products")}</th><th className="px-5 py-3 text-start font-bold">{t("admin.brands.featured")}</th><th className="px-5 py-3 text-start font-bold">{t("admin.brands.status")}</th>{isAdmin && <th className="px-5 py-3 text-end font-bold">{t("admin.brands.actions")}</th>}</tr></thead><tbody className="divide-y divide-[#F3E8C8]">{brands.map((brand) => <tr key={brand.id}><td className="px-5 py-4"><div className="flex items-center gap-3">{brand.logoUrl ? <img src={brand.logoUrl} alt="" className="h-10 w-10 rounded-lg border border-[#EFE2BC] object-contain" /> : <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FFF9E8] text-[#D4A72C]"><Building2 size={18} /></span>}<div><p className="font-semibold text-[#050505]">{brand.name}</p><p className="mt-1 text-xs text-[#8A8D9A]">{brand.slug}</p></div></div></td><td className="px-5 py-4 text-[#717182]">{brand.country || t("admin.brands.notProvided")}</td><td className="px-5 py-4 text-[#717182]">{brand.productCount}</td><td className="px-5 py-4 text-[#717182]">{brand.featured ? t("common.yes", { fallback: "Yes" }) : t("common.no", { fallback: "No" })}</td><td className="px-5 py-4"><AdminStatusBadge tone={STATUS_TONES[brand.status]}>{t(`admin.brands.statuses.${brand.status === "NEEDS_LOGO" ? "needsLogo" : brand.status.toLowerCase()}`)}</AdminStatusBadge></td>{isAdmin && <td className="px-5 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => openEdit(brand)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#050505]/10 bg-white px-3 text-xs font-semibold text-[#050505] hover:border-[#D4A72C]/60 hover:bg-[#FFF7D6] dark:hover:border-[#D4A72C]/40 dark:hover:bg-white/[0.05] dark:hover:text-[#F6D85D]"><Pencil size={13} />{t("admin.brands.edit")}</button><button type="button" onClick={() => { setDeleteTarget(brand); setDeleteError(null); }} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#F2C8C8] bg-white px-3 text-xs font-semibold text-[#B42318] hover:bg-[#FFF3F3] dark:hover:border-[#F97066]/40 dark:hover:bg-[#B42318]/15 dark:hover:text-[#FDA29B]"><Trash2 size={13} />{t("admin.brands.delete")}</button></div></td>}</tr>)}{isLoading && brands.length === 0 && <tr><td colSpan={isAdmin ? 6 : 5} className="px-5 py-10 text-center text-[#717182]">{t("admin.brands.loading")}</td></tr>}{!isLoading && !loadError && brands.length === 0 && <tr><td colSpan={isAdmin ? 6 : 5} className="px-5 py-10 text-center"><Building2 size={28} className="mx-auto text-[#D4A72C]" /><p className="mt-3 text-sm font-medium text-[#717182]">{t("admin.brands.noBrands")}</p></td></tr>}</tbody></table></AdminTableShell>
  </div>

  <Dialog open={isFormOpen} onOpenChange={(open) => open ? setIsFormOpen(true) : closeForm()}><DialogContent className="max-h-[90vh] overflow-y-auto rounded-[22px] border-[#EFE2BC] bg-[#FFFEFB] sm:max-w-[650px]"><DialogHeader><DialogTitle className="text-2xl font-bold text-[#050505]">{editingBrand ? t("admin.brands.editBrand") : t("admin.brands.addBrand")}</DialogTitle><DialogDescription>{t("admin.brands.formDescription")}</DialogDescription></DialogHeader><form onSubmit={saveBrand} noValidate><div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><BrandField id="name" label={t("admin.brands.brandName")} value={form.name} onChange={(value) => updateField("name", value)} error={formErrors.name} maxLength={150} /></div><BrandField id="country" label={t("admin.brands.country")} value={form.country} onChange={(value) => updateField("country", value)} maxLength={100} /><BrandField id="logoUrl" label={t("admin.brands.logoUrl")} value={form.logoUrl} onChange={(value) => updateField("logoUrl", value)} error={formErrors.logoUrl} type="url" maxLength={1000} /><div><span className="text-sm font-bold text-[#050505]">{t("admin.brands.featured")}</span><DentalSelect label={t("admin.brands.featured")} value={form.featured} onChange={(value) => updateField("featured", value as "true" | "false")} options={[{ value: "false", label: t("common.no", { fallback: "No" }) }, { value: "true", label: t("common.yes", { fallback: "Yes" }) }]} triggerClassName="mt-2 h-[50px] rounded-[14px]" /></div><div><span className="text-sm font-bold text-[#050505]">{t("admin.brands.status")}</span><DentalSelect label={t("admin.brands.status")} value={form.status} onChange={(value) => updateField("status", value as AdminBrandStatus)} options={statusOptions} triggerClassName="mt-2 h-[50px] rounded-[14px]" /></div><label className="block sm:col-span-2"><span className="text-sm font-bold text-[#050505]">{t("admin.brands.descriptionField")}</span><textarea value={form.description} onChange={(event) => updateField("description", event.target.value)} maxLength={2000} className="mt-2 min-h-[110px] w-full resize-none rounded-[14px] border border-[#050505]/10 bg-white px-4 py-3 text-sm outline-none focus:border-[#D4A72C] focus:ring-4 focus:ring-[#D4A72C]/10" /></label></div>{formError && <p role="alert" className="mt-4 rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] p-3 text-sm font-semibold text-[#B42318]">{formError}</p>}<DialogFooter className="mt-6 gap-2 sm:gap-2"><button type="button" onClick={closeForm} disabled={isSaving} className="h-10 rounded-lg border border-[#EFE2BC] bg-white px-4 text-sm font-semibold text-[#717182]">{t("common.cancel")}</button><button type="submit" disabled={isSaving} className="h-10 rounded-lg bg-[#F9DC5C] px-4 text-sm font-semibold text-[#050505] hover:bg-[#D4A72C] disabled:opacity-60">{isSaving ? t("admin.brands.saving") : editingBrand ? t("admin.brands.saveChanges") : t("admin.brands.createBrand")}</button></DialogFooter></form></DialogContent></Dialog>

  <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !isDeleting) setDeleteTarget(null); }}><AlertDialogContent className="rounded-[20px] border-[#EFE2BC] bg-white"><AlertDialogHeader><AlertDialogTitle>{t("admin.brands.deleteBrand")}</AlertDialogTitle><AlertDialogDescription>{t("admin.brands.deleteConfirmation", { values: { name: deleteTarget?.name ?? "" } })}</AlertDialogDescription></AlertDialogHeader>{deleteError && <p role="alert" className="rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] p-3 text-sm font-semibold text-[#B42318]">{deleteError}</p>}<AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); void confirmDelete(); }} disabled={isDeleting} className="bg-[#B42318] text-white hover:bg-[#8F1C13]">{isDeleting ? t("admin.brands.deleting") : t("admin.brands.deleteBrand")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </AdminLayout>;
}
