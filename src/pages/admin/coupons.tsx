import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Pencil, Plus, RefreshCw, Tags, Trash2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@/services/http";
import {
  createAdminCoupon,
  deleteAdminCoupon,
  getAdminCoupons,
  updateAdminCoupon,
  type AdminCoupon,
  type AdminCouponInput,
  type CouponDiscountType,
} from "@/services/coupons";
import { AdminLayout } from "./_components/AdminLayout";
import { AdminPageHeader, AdminStatusBadge, AdminTableShell } from "./_components/admin-ui";
import { AdminSelect } from "./_components/admin-form";

type CouponForm = {
  code: string;
  discountType: CouponDiscountType;
  value: string;
  minimumOrderAmount: string;
  startsAt: string;
  endsAt: string;
  isActive: "true" | "false";
};

const EMPTY_FORM: CouponForm = {
  code: "",
  discountType: "PERCENTAGE",
  value: "",
  minimumOrderAmount: "0",
  startsAt: "",
  endsAt: "",
  isActive: "false",
};

const COMPACT_TOAST_CLASS =
  "w-fit max-w-[min(90vw,22rem)] self-end px-4 py-3";

const copy = {
  en: {
    title: "Coupons",
    description: "Create and control real coupon codes used by cart and checkout.",
    add: "Add coupon",
    empty: "No coupons have been created. New coupons start inactive.",
    code: "Code",
    type: "Discount type",
    value: "Value",
    minimum: "Minimum order (EGP)",
    starts: "Starts at (optional)",
    ends: "Ends at (optional)",
    active: "Active",
    scheduled: "Scheduled",
    expired: "Expired",
    inactive: "Inactive",
    yes: "Yes",
    no: "No",
    percentage: "Percentage",
    fixed: "Fixed amount",
    freeShipping: "Free shipping",
    status: "Status",
    actions: "Actions",
    edit: "Edit",
    remove: "Delete",
    save: "Save coupon",
    saving: "Saving...",
    cancel: "Cancel",
    createTitle: "Create coupon",
    editTitle: "Edit coupon",
    formDescription: "The customer must enter this code. The backend validates uniqueness, Cairo schedule, minimum order, and discount on every order.",
    deleteTitle: "Delete coupon?",
    deleteDescription: "The code will immediately stop working. Existing order totals are not changed.",
    loading: "Loading coupons...",
    refresh: "Refresh",
    created: "Coupon created.",
    updated: "Coupon updated.",
    deleted: "Coupon deleted.",
  },
  ar: {
    title: "كوبونات الخصم",
    description: "إنشاء وإدارة أكواد خصم حقيقية تعمل في السلة والدفع.",
    add: "إضافة كوبون",
    empty: "لم يتم إنشاء كوبونات بعد. تبدأ الكوبونات الجديدة غير مفعّلة.",
    code: "الكود",
    type: "نوع الخصم",
    value: "القيمة",
    minimum: "الحد الأدنى للطلب (جنيه)",
    starts: "وقت البداية (اختياري)",
    ends: "وقت النهاية (اختياري)",
    active: "مفعّل",
    scheduled: "مجدول",
    expired: "منتهي",
    inactive: "غير مفعّل",
    yes: "نعم",
    no: "لا",
    percentage: "نسبة مئوية",
    fixed: "مبلغ ثابت",
    freeShipping: "شحن مجاني",
    status: "الحالة",
    actions: "الإجراءات",
    edit: "تعديل",
    remove: "حذف",
    save: "حفظ الكوبون",
    saving: "جارٍ الحفظ...",
    cancel: "إلغاء",
    createTitle: "إنشاء كوبون",
    editTitle: "تعديل الكوبون",
    formDescription: "يجب على العميل إدخال هذا الكود. يتحقق الخادم من التفرد وجدول القاهرة والحد الأدنى والخصم مع كل طلب.",
    deleteTitle: "حذف الكوبون؟",
    deleteDescription: "سيتوقف الكود عن العمل فورًا، ولن تتغير إجماليات الطلبات السابقة.",
    loading: "جارٍ تحميل الكوبونات...",
    refresh: "تحديث",
    created: "تم إنشاء الكوبون.",
    updated: "تم تحديث الكوبون.",
    deleted: "تم حذف الكوبون.",
  },
};

function toLocalValue(date: string | null, time: string | null) {
  if (!date || !time) return "";
  return `${date.slice(0, 10)}T${time}`;
}

function formFor(coupon: AdminCoupon): CouponForm {
  return {
    code: coupon.code,
    discountType: coupon.discountType,
    value: coupon.discountType === "FREE_SHIPPING" ? "" : String(coupon.value),
    minimumOrderAmount: String(coupon.minimumOrderAmount),
    startsAt: toLocalValue(coupon.startsAt, coupon.startTime),
    endsAt: toLocalValue(coupon.endsAt, coupon.endTime),
    isActive: coupon.isActive ? "true" : "false",
  };
}

export default function AdminCouponsPage() {
  const { language } = useLanguage();
  const text = copy[language === "ar" ? "ar" : "en"];
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [editing, setEditing] = useState<AdminCoupon | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<CouponForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof CouponForm, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminCoupon | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);
    getAdminCoupons(controller.signal)
      .then(setCoupons)
      .catch((error) => {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "Unable to load coupons.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [refreshVersion]);

  const typeLabels = useMemo(() => ({
    PERCENTAGE: text.percentage,
    FIXED: text.fixed,
    FREE_SHIPPING: text.freeShipping,
  }), [text]);

  const updateField = <K extends keyof CouponForm>(field: K, value: CouponForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEdit = (coupon: AdminCoupon) => {
    setEditing(coupon);
    setForm(formFor(coupon));
    setErrors({});
    setFormError(null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const validate = () => {
    const next: Partial<Record<keyof CouponForm, string>> = {};
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$/.test(form.code.trim())) next.code = "Use 2-40 letters, numbers, hyphens, or underscores.";
    const value = Number(form.value);
    if (form.discountType !== "FREE_SHIPPING" && (!Number.isFinite(value) || value <= 0)) next.value = "Enter a value greater than zero.";
    if (form.discountType === "PERCENTAGE" && value > 100) next.value = "Percentage cannot exceed 100%.";
    if (!Number.isFinite(Number(form.minimumOrderAmount)) || Number(form.minimumOrderAmount) < 0) next.minimumOrderAmount = "Enter zero or a positive amount.";
    if (Boolean(form.startsAt) !== Boolean(form.endsAt)) {
      if (!form.startsAt) next.startsAt = "Enter both dates or leave both empty.";
      if (!form.endsAt) next.endsAt = "Enter both dates or leave both empty.";
    }
    if (form.startsAt && form.endsAt && form.endsAt <= form.startsAt) next.endsAt = "End must be after start.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    const input: AdminCouponInput = {
      code: form.code.trim().toUpperCase(),
      discountType: form.discountType,
      value: form.discountType === "FREE_SHIPPING" ? 0 : Number(form.value),
      minimumOrderAmount: Number(form.minimumOrderAmount) || 0,
      startsAt: form.startsAt,
      endsAt: form.endsAt,
      isActive: form.isActive === "true",
    };
    setIsSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await updateAdminCoupon(editing.id, input);
        toast({ title: text.updated, className: COMPACT_TOAST_CLASS });
      } else {
        await createAdminCoupon(input);
        toast({ title: text.created, className: COMPACT_TOAST_CLASS });
      }
      closeForm();
      setRefreshVersion((value) => value + 1);
    } catch (error) {
      if (error instanceof ApiError && error.field && error.field in EMPTY_FORM) {
        setErrors((current) => ({ ...current, [error.field as keyof CouponForm]: error.message }));
      } else {
        setFormError(error instanceof Error ? error.message : "Unable to save coupon.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteAdminCoupon(deleteTarget.id);
      setDeleteTarget(null);
      setRefreshVersion((value) => value + 1);
      toast({ title: text.deleted, className: COMPACT_TOAST_CLASS });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminPageHeader
          title={text.title}
          description={text.description}
          action={
            <button type="button" onClick={openCreate} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#F9DC5C] px-4 text-sm font-semibold text-[#050505] hover:bg-[#D4A72C]">
              <Plus size={16} /> {text.add}
            </button>
          }
        />
        <div className="flex justify-end">
          <button type="button" onClick={() => setRefreshVersion((value) => value + 1)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#EFE2BC] px-4 text-sm font-semibold text-[#717182]">
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> {text.refresh}
          </button>
        </div>
        {loadError && <p role="alert" className="rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] p-4 text-sm font-semibold text-[#B42318]">{loadError}</p>}
        <AdminTableShell>
          <table className="min-w-full divide-y divide-[#EFE2BC] text-sm">
            <thead className="bg-[#FFF9E8] text-xs uppercase tracking-wide text-[#717182]">
              <tr>
                <th className="px-5 py-3 text-start">{text.code}</th>
                <th className="px-5 py-3 text-start">{text.type}</th>
                <th className="px-5 py-3 text-start">{text.value}</th>
                <th className="px-5 py-3 text-start">{text.minimum}</th>
                <th className="px-5 py-3 text-start">{text.status}</th>
                <th className="px-5 py-3 text-end">{text.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3E8C8]">
              {coupons.map((coupon) => (
                <tr key={coupon.id}>
                  <td className="px-5 py-4 font-bold text-[#050505]">{coupon.code}</td>
                  <td className="px-5 py-4 text-[#717182]">{typeLabels[coupon.discountType]}</td>
                  <td className="px-5 py-4 text-[#717182]">{coupon.discountType === "PERCENTAGE" ? `${coupon.value}%` : coupon.discountType === "FIXED" ? `EGP ${coupon.value}` : "—"}</td>
                  <td className="px-5 py-4 text-[#717182]">EGP {coupon.minimumOrderAmount}</td>
                  <td className="px-5 py-4"><AdminStatusBadge tone={coupon.isCurrentlyValid ? "green" : coupon.isActive && coupon.status !== "EXPIRED" ? "amber" : "slate"}>{coupon.isCurrentlyValid ? text.active : !coupon.isActive ? text.inactive : coupon.status === "EXPIRED" ? text.expired : text.scheduled}</AdminStatusBadge></td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => openEdit(coupon)} className="inline-flex h-8 items-center gap-1 rounded-md border px-3 text-xs font-semibold"><Pencil size={13} />{text.edit}</button>
                      <button type="button" onClick={() => setDeleteTarget(coupon)} className="inline-flex h-8 items-center gap-1 rounded-md border border-[#F2C8C8] px-3 text-xs font-semibold text-[#B42318]"><Trash2 size={13} />{text.remove}</button>
                    </div>
                  </td>
                </tr>
              ))}
              {isLoading && coupons.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-[#717182]">{text.loading}</td></tr>}
              {!isLoading && !loadError && coupons.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-[#717182]"><Tags className="mx-auto mb-3 text-[#D4A72C]" />{text.empty}</td></tr>}
            </tbody>
          </table>
        </AdminTableShell>
      </div>

      <Dialog open={isFormOpen} onOpenChange={(open) => (open ? setIsFormOpen(true) : closeForm())}>
        <DialogContent
          dir={language === "ar" ? "rtl" : "ltr"}
          data-admin-dialog="coupon-editor"
          className={`flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] min-w-0 flex-col overflow-hidden rounded-[22px] border-[#EFE2BC] bg-[#FFFEFB] p-0 sm:max-w-[620px] ${
            language === "ar" ? "[&>button]:left-4 [&>button]:right-auto" : ""
          }`}
        >
          <DialogHeader className="shrink-0 border-b border-[#EFE2BC] px-6 pb-5 pt-6 text-start sm:text-start">
            <DialogTitle>{editing ? text.editTitle : text.createTitle}</DialogTitle>
            <DialogDescription>{text.formDescription}</DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="grid min-h-0 min-w-0 flex-1 gap-4 overflow-y-auto overflow-x-hidden px-6 py-5 sm:grid-cols-2">
            <p className="sm:col-span-2 rounded-lg border border-[#EFE2BC] bg-[#FFF9E8] px-4 py-3 text-xs font-semibold text-[#717182]">
              Africa/Cairo — Cairo Time · {language === "ar" ? "لا يتم تطبيق الكود تلقائيًا." : "The code is never applied automatically."}
            </p>
            <label className="sm:col-span-2"><span className="text-sm font-bold">{text.code}</span><input value={form.code} onChange={(event) => updateField("code", event.target.value.toUpperCase())} className="mt-2 h-12 w-full rounded-xl border px-4" aria-invalid={Boolean(errors.code)} />{errors.code && <p className="mt-1 text-xs text-[#B42318]">{errors.code}</p>}</label>
            <AdminSelect
              id="coupon-discount-type"
              label={text.type}
              value={form.discountType}
              onChange={(value) => updateField("discountType", value as CouponDiscountType)}
              options={[
                { value: "PERCENTAGE", label: text.percentage },
                { value: "FIXED", label: text.fixed },
                { value: "FREE_SHIPPING", label: text.freeShipping },
              ]}
              error={errors.discountType}
            />
            <label><span className="text-sm font-bold">{text.value}</span><input type="number" min="0" step="0.01" disabled={form.discountType === "FREE_SHIPPING"} value={form.value} onChange={(event) => updateField("value", event.target.value)} className="mt-2 h-12 w-full rounded-xl border px-4 disabled:bg-[#F3F2ED]" />{errors.value && <p className="mt-1 text-xs text-[#B42318]">{errors.value}</p>}</label>
            <label><span className="text-sm font-bold">{text.minimum}</span><input type="number" min="0" step="0.01" value={form.minimumOrderAmount} onChange={(event) => updateField("minimumOrderAmount", event.target.value)} className="mt-2 h-12 w-full rounded-xl border px-4" />{errors.minimumOrderAmount && <p className="mt-1 text-xs text-[#B42318]">{errors.minimumOrderAmount}</p>}</label>
            <AdminSelect
              id="coupon-active"
              label={text.active}
              value={form.isActive}
              onChange={(value) => updateField("isActive", value as "true" | "false")}
              options={[
                { value: "false", label: text.no },
                { value: "true", label: text.yes },
              ]}
              error={errors.isActive}
            />
            <label><span className="text-sm font-bold">{text.starts}</span><input type="datetime-local" value={form.startsAt} onChange={(event) => updateField("startsAt", event.target.value)} className="mt-2 h-12 w-full rounded-xl border px-4" />{errors.startsAt && <p className="mt-1 text-xs text-[#B42318]">{errors.startsAt}</p>}</label>
            <label><span className="text-sm font-bold">{text.ends}</span><input type="datetime-local" value={form.endsAt} onChange={(event) => updateField("endsAt", event.target.value)} className="mt-2 h-12 w-full rounded-xl border px-4" />{errors.endsAt && <p className="mt-1 text-xs text-[#B42318]">{errors.endsAt}</p>}</label>
            {formError && <p role="alert" className="sm:col-span-2 rounded-lg bg-[#FFF3F3] p-3 text-sm text-[#B42318]">{formError}</p>}
            </div>
            <DialogFooter className="shrink-0 gap-2 border-t border-[#EFE2BC] bg-[#FFFEFB] px-6 py-4 sm:space-x-0">
              <button type="button" onClick={closeForm} className="h-10 rounded-lg border px-4 text-sm font-semibold">{text.cancel}</button>
              <button type="submit" disabled={isSaving} className="h-10 rounded-lg bg-[#F9DC5C] px-4 text-sm font-semibold">{isSaving ? text.saving : text.save}</button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !isDeleting) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader className="text-start sm:text-start"><AlertDialogTitle>{text.deleteTitle}</AlertDialogTitle><AlertDialogDescription>{text.deleteDescription}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>{text.cancel}</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); void confirmDelete(); }} className="bg-[#B42318] text-white">{text.remove}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
