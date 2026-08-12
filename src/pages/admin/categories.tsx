import { useEffect, useMemo, useState, type FormEvent } from "react";
import { FolderTree, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
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
  createAdminCategory,
  deleteAdminCategory,
  getAdminCategories,
  updateAdminCategory,
  type AdminCategory,
  type AdminCategoryInput,
  type AdminCategoryStatus,
} from "@/services/adminCatalog";
import { ApiError } from "@/services/http";
import { AdminLayout } from "./_components/AdminLayout";
import { AdminPageHeader, AdminStatusBadge, AdminTableShell } from "./_components/admin-ui";
import type { StatusTone } from "./admin-data";

type CategoryForm = {
  name: string;
  slug: string;
  description: string;
  status: AdminCategoryStatus;
  parentId: string;
};

type CategoryFormErrors = Partial<Record<keyof CategoryForm, string>>;

const EMPTY_FORM: CategoryForm = { name: "", slug: "", description: "", status: "ACTIVE", parentId: "" };
const STATUS_TONES: Record<AdminCategoryStatus, StatusTone> = {
  ACTIVE: "green",
  DRAFT: "slate",
  INACTIVE: "amber",
};

function toForm(category: AdminCategory): CategoryForm {
  return {
    name: category.name,
    slug: category.slug,
    description: category.description ?? "",
    status: category.status,
    parentId: category.parentId ?? "",
  };
}

function CategoryField({
  id,
  label,
  value,
  onChange,
  error,
  maxLength,
}: {
  id: "name" | "slug";
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  maxLength: number;
}) {
  return (
    <label htmlFor={`category-${id}`} className="block">
      <span className="text-sm font-bold text-[#050505]">{label}</span>
      <input
        id={`category-${id}`}
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        className={`mt-2 h-[50px] w-full rounded-[14px] border bg-white px-4 text-sm font-semibold outline-none transition focus:ring-4 ${error ? "border-[#B42318]/55 focus:border-[#B42318] focus:ring-[#B42318]/10" : "border-[#050505]/10 focus:border-[#D4A72C] focus:ring-[#D4A72C]/10"}`}
      />
      {error && <p className="mt-1.5 text-xs font-semibold text-[#B42318]">{error}</p>}
    </label>
  );
}

export default function AdminCategories() {
  const queryString = useSearch();
  const { currentUser } = useStore();
  const { t } = useLanguage();
  const { toast } = useToast();
  const initialSearch = useMemo(() => new URLSearchParams(queryString).get("search")?.trim() ?? "", [queryString]);
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<AdminCategoryStatus | "all">("all");
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null);
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<CategoryFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminCategory | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const isAdmin = currentUser?.role?.trim().toLowerCase() === "admin";

  useEffect(() => setSearch(initialSearch), [initialSearch]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setIsLoading(true);
      setLoadError(null);
      getAdminCategories({
        search,
        status: statusFilter === "all" ? undefined : statusFilter,
        signal: controller.signal,
      })
        .then(setCategories)
        .catch((error: unknown) => {
          if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : t("admin.categories.loadError"));
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [refreshVersion, search, statusFilter, t]);

  const statusOptions = useMemo(() => [
    { value: "ACTIVE", label: t("admin.categories.statuses.active") },
    { value: "DRAFT", label: t("admin.categories.statuses.draft") },
    { value: "INACTIVE", label: t("admin.categories.statuses.inactive") },
  ], [t]);

  // Parent options: main categories only (one level of nesting from the
  // dialog keeps admin editing simple; deeper levels come from the importer).
  const parentOptions = useMemo(() => [
    { value: "", label: t("admin.categories.noParent", { fallback: "None (main category)" }) },
    ...categories
      .filter((category) => !category.parentId && category.id !== editingCategory?.id)
      .map((category) => ({ value: category.id, label: category.name })),
  ], [categories, editingCategory, t]);

  const updateField = <K extends keyof CategoryForm>(field: K, value: CategoryForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  };

  const openCreate = () => {
    setEditingCategory(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEdit = (category: AdminCategory) => {
    setEditingCategory(category);
    setForm(toForm(category));
    setFormErrors({});
    setFormError(null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingCategory(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormError(null);
  };

  const saveCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setFormErrors({ name: t("admin.categories.validation.name") });
      return;
    }
    const input: AdminCategoryInput = {
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      description: form.description.trim() || undefined,
      status: form.status,
      parentId: form.parentId || null,
    };
    setIsSaving(true);
    setFormError(null);
    try {
      if (editingCategory) {
        await updateAdminCategory(editingCategory.id, input);
        toast({ title: t("admin.categories.updatedSuccess") });
      } else {
        await createAdminCategory(input);
        toast({ title: t("admin.categories.createdSuccess") });
      }
      closeForm();
      setRefreshVersion((value) => value + 1);
    } catch (error) {
      if (error instanceof ApiError && error.field && error.field in EMPTY_FORM) {
        setFormErrors((current) => ({
          ...current,
          [error.field as keyof CategoryForm]: error.status === 409 ? t("admin.categories.duplicate") : error.message,
        }));
      } else {
        setFormError(error instanceof Error ? error.message : t("admin.categories.saveError"));
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
      await deleteAdminCategory(deleteTarget.id);
      setDeleteTarget(null);
      setRefreshVersion((value) => value + 1);
      toast({ title: t("admin.categories.deletedSuccess") });
    } catch (error) {
      // 409 covers both "has linked products" and "has subcategories"; the
      // server message states which one applies.
      setDeleteError(error instanceof ApiError && error.status === 409
        ? error.message || t("admin.categories.linkedDeleteError")
        : error instanceof Error ? error.message : t("admin.categories.deleteError"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminPageHeader
          title={t("admin.categories.title")}
          description={t("admin.categories.description")}
          action={isAdmin ? (
            <button type="button" onClick={openCreate} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#F9DC5C] px-4 text-sm font-semibold text-[#050505] shadow-sm transition hover:-translate-y-px hover:bg-[#D4A72C] focus:outline-none focus:ring-2 focus:ring-[#D4A72C]/45">
              <Plus size={16} />{t("admin.categories.addCategory")}
            </button>
          ) : undefined}
        />

        <section className="grid gap-3 rounded-lg border border-[#EFE2BC] bg-white p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_190px_auto] sm:items-end">
          <label>
            <span className="text-xs font-bold uppercase tracking-wide text-[#717182]">{t("admin.categories.searchCategories")}</span>
            <span className="mt-2 flex h-11 items-center gap-2 rounded-lg border border-[#050505]/10 bg-[#FBFAF7] px-3">
              <Search size={16} className="text-[#D4A72C]" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("admin.categories.searchPlaceholder")} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </span>
          </label>
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-[#717182]">{t("admin.categories.status")}</span>
            <DentalSelect label={t("admin.categories.status")} value={statusFilter} onChange={(value) => setStatusFilter(value as AdminCategoryStatus | "all")} options={[{ value: "all", label: t("admin.categories.allStatuses") }, ...statusOptions]} triggerClassName="mt-2 h-11 rounded-lg bg-[#FBFAF7]" />
          </div>
          <button type="button" onClick={() => setRefreshVersion((value) => value + 1)} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#EFE2BC] px-4 text-sm font-semibold text-[#717182] hover:bg-[#FFF9E8] dark:hover:border-[#D4A72C]/40 dark:hover:bg-white/[0.05] dark:hover:text-[#F6D85D]">
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />{t("admin.categories.refresh")}
          </button>
        </section>

        {loadError && <div role="alert" className="rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] p-4 text-sm font-semibold text-[#B42318]">{loadError}</div>}

        <AdminTableShell>
          <table className="min-w-full divide-y divide-[#EFE2BC] text-sm">
            <thead className="bg-[#FFF9E8] text-xs uppercase tracking-wide text-[#717182]"><tr>
              <th className="px-5 py-3 text-start font-bold">{t("admin.categories.categoryName")}</th>
              <th className="px-5 py-3 text-start font-bold">{t("admin.categories.parent", { fallback: "Type / Parent" })}</th>
              <th className="px-5 py-3 text-start font-bold">{t("admin.categories.slug")}</th>
              <th className="px-5 py-3 text-start font-bold">{t("admin.categories.products")}</th>
              <th className="px-5 py-3 text-start font-bold">{t("admin.categories.status")}</th>
              {isAdmin && <th className="px-5 py-3 text-end font-bold">{t("admin.categories.actions")}</th>}
            </tr></thead>
            <tbody className="divide-y divide-[#F3E8C8]">
              {categories.map((category) => <tr key={category.id}>
                <td className="px-5 py-4"><p className="font-semibold text-[#050505]">{category.name}</p>{category.description && <p className="mt-1 max-w-[420px] truncate text-xs text-[#8A8D9A]">{category.description}</p>}</td>
                <td className="px-5 py-4">
                  {category.parentId ? (
                    <span className="text-xs text-[#717182]">
                      <span className="font-bold text-[#8A6A1F]">{t("admin.categories.subcategory", { fallback: "Subcategory" })}</span>
                      <span className="mx-1">·</span>
                      {category.parentName ?? "—"}
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-[#717182]">
                      {t("admin.categories.mainCategory", { fallback: "Main category" })}
                      {category.childCount > 0 && <span className="ms-1 font-medium">({category.childCount})</span>}
                    </span>
                  )}
                </td>
                <td className="px-5 py-4 font-mono text-xs text-[#717182]">{category.slug}</td>
                <td className="px-5 py-4 text-[#717182]">{category.productCount}</td>
                <td className="px-5 py-4"><AdminStatusBadge tone={STATUS_TONES[category.status]}>{t(`admin.categories.statuses.${category.status.toLowerCase()}`)}</AdminStatusBadge></td>
                {isAdmin && <td className="px-5 py-4"><div className="flex justify-end gap-2">
                  <button type="button" onClick={() => openEdit(category)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#050505]/10 bg-white px-3 text-xs font-semibold hover:border-[#D4A72C]/60 hover:bg-[#FFF7D6] dark:hover:border-[#D4A72C]/40 dark:hover:bg-white/[0.05] dark:hover:text-[#F6D85D]"><Pencil size={13} />{t("admin.categories.edit")}</button>
                  <button type="button" onClick={() => { setDeleteTarget(category); setDeleteError(null); }} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#F2C8C8] bg-white px-3 text-xs font-semibold text-[#B42318] hover:bg-[#FFF3F3] dark:hover:border-[#F97066]/40 dark:hover:bg-[#B42318]/15 dark:hover:text-[#FDA29B]"><Trash2 size={13} />{t("admin.categories.delete")}</button>
                </div></td>}
              </tr>)}
              {isLoading && categories.length === 0 && <tr><td colSpan={isAdmin ? 6 : 5} className="px-5 py-10 text-center text-[#717182]">{t("admin.categories.loading")}</td></tr>}
              {!isLoading && !loadError && categories.length === 0 && <tr><td colSpan={isAdmin ? 6 : 5} className="px-5 py-10 text-center"><FolderTree size={28} className="mx-auto text-[#D4A72C]" /><p className="mt-3 text-sm font-medium text-[#717182]">{t("admin.categories.noCategories")}</p></td></tr>}
            </tbody>
          </table>
        </AdminTableShell>
      </div>

      <Dialog open={isFormOpen} onOpenChange={(open) => open ? setIsFormOpen(true) : closeForm()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[22px] border-[#EFE2BC] bg-[#FFFEFB] sm:max-w-[620px]">
          <DialogHeader><DialogTitle className="text-2xl font-bold">{editingCategory ? t("admin.categories.editCategory") : t("admin.categories.addCategory")}</DialogTitle><DialogDescription>{t("admin.categories.formDescription")}</DialogDescription></DialogHeader>
          <form onSubmit={saveCategory} noValidate>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <CategoryField id="name" label={t("admin.categories.categoryName")} value={form.name} onChange={(value) => updateField("name", value)} error={formErrors.name} maxLength={150} />
              <CategoryField id="slug" label={t("admin.categories.slugOptional")} value={form.slug} onChange={(value) => updateField("slug", value)} error={formErrors.slug} maxLength={180} />
              <div><span className="text-sm font-bold">{t("admin.categories.status")}</span><DentalSelect label={t("admin.categories.status")} value={form.status} onChange={(value) => updateField("status", value as AdminCategoryStatus)} options={statusOptions} triggerClassName="mt-2 h-[50px] rounded-[14px]" /></div>
              <div>
                <span className="text-sm font-bold">{t("admin.categories.parentCategory", { fallback: "Parent Category" })}</span>
                <DentalSelect label={t("admin.categories.parentCategory", { fallback: "Parent Category" })} value={form.parentId} onChange={(value) => updateField("parentId", value)} options={parentOptions} triggerClassName="mt-2 h-[50px] rounded-[14px]" />
                {formErrors.parentId && <p className="mt-1.5 text-xs font-semibold text-[#B42318]">{formErrors.parentId}</p>}
              </div>
              <label className="block sm:col-span-2"><span className="text-sm font-bold">{t("admin.categories.descriptionField")}</span><textarea value={form.description} onChange={(event) => updateField("description", event.target.value)} maxLength={2000} className="mt-2 min-h-[110px] w-full resize-none rounded-[14px] border border-[#050505]/10 bg-white px-4 py-3 text-sm outline-none focus:border-[#D4A72C] focus:ring-4 focus:ring-[#D4A72C]/10" /></label>
            </div>
            {formError && <p role="alert" className="mt-4 rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] p-3 text-sm font-semibold text-[#B42318]">{formError}</p>}
            <DialogFooter className="mt-6 gap-2 sm:gap-2"><button type="button" onClick={closeForm} disabled={isSaving} className="h-10 rounded-lg border border-[#EFE2BC] bg-white px-4 text-sm font-semibold text-[#717182]">{t("common.cancel")}</button><button type="submit" disabled={isSaving} className="h-10 rounded-lg bg-[#F9DC5C] px-4 text-sm font-semibold hover:bg-[#D4A72C] disabled:opacity-60">{isSaving ? t("admin.categories.saving") : editingCategory ? t("admin.categories.saveChanges") : t("admin.categories.createCategory")}</button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !isDeleting) setDeleteTarget(null); }}>
        <AlertDialogContent className="rounded-[20px] border-[#EFE2BC] bg-white"><AlertDialogHeader><AlertDialogTitle>{t("admin.categories.deleteCategory")}</AlertDialogTitle><AlertDialogDescription>{t("admin.categories.deleteConfirmation", { values: { name: deleteTarget?.name ?? "" } })}</AlertDialogDescription></AlertDialogHeader>{deleteError && <p role="alert" className="rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] p-3 text-sm font-semibold text-[#B42318]">{deleteError}</p>}<AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); void confirmDelete(); }} disabled={isDeleting} className="bg-[#B42318] text-white hover:bg-[#8F1C13]">{isDeleting ? t("admin.categories.deleting") : t("admin.categories.deleteCategory")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
