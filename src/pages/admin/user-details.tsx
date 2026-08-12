import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { FileClock, Pause, Play, Plus, ShieldCheck, UserRoundCheck, XCircle } from "lucide-react";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { DentalSelect } from "@/components/dental/Select";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@/services/http";
import {
  createCustomerBenefit,
  createAdminUserAccountActionRequest,
  getAdminUser,
  getPermissionCatalog,
  replaceSupportPermissions,
  updateAdminUserStatus,
  updateCustomerBenefit,
  updateCustomerBenefitLifecycle,
  updateCustomerTier,
  type AdminUser,
  type CustomerBenefit,
  type CustomerBenefitInput,
  type PermissionCatalog,
} from "@/services/adminUsers";
import { AdminLayout } from "./_components/AdminLayout";
import { AdminPageHeader, AdminStatusBadge } from "./_components/admin-ui";

const EMPTY_BENEFIT: CustomerBenefitInput = {
  type: "FREE_SHIPPING",
  titleEn: "",
  titleAr: "",
  descriptionEn: null,
  descriptionAr: null,
  discountPercent: null,
  discountAmount: null,
  promoCode: null,
  minimumOrderAmount: null,
  startsAt: null,
  endsAt: null,
};

function textInputClass() {
  return "h-11 w-full rounded-xl border border-[#050505]/10 bg-white px-3 text-sm font-semibold text-[#050505] outline-none focus:border-[#D4A72C] focus:ring-4 focus:ring-[#D4A72C]/10";
}

export default function AdminUserDetails() {
  const [, params] = useRoute("/admin/users/:id");
  const userId = params?.id ?? "";
  const [, setLocation] = useLocation();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [catalog, setCatalog] = useState<PermissionCatalog | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [preset, setPreset] = useState("CUSTOM");
  const [benefitForm, setBenefitForm] = useState<CustomerBenefitInput>(EMPTY_BENEFIT);
  const [editingBenefitId, setEditingBenefitId] = useState<string | null>(null);
  const [pendingTierChange, setPendingTierChange] = useState<"standard" | "vip" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lifecycleAction, setLifecycleAction] = useState<"DEACTIVATION" | "DELETION" | null>(null);
  const [lifecycleCustomerResponse, setLifecycleCustomerResponse] = useState("");
  const [lifecycleAdminNote, setLifecycleAdminNote] = useState("");
  const [lifecycleConfirmation, setLifecycleConfirmation] = useState("");

  const load = async () => {
    setError(null);
    try {
      const [nextUser, nextCatalog] = await Promise.all([getAdminUser(userId), getPermissionCatalog()]);
      setUser(nextUser);
      setPermissions(nextUser.permissions);
      setCatalog(nextCatalog);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : "Unable to load this account.");
    }
  };

  useEffect(() => {
    void load();
  }, [userId]);

  const savePermissions = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      setUser(await replaceSupportPermissions(user.id, permissions));
      toast({ title: t("admin.users.permissions.saved", { fallback: "Permissions updated" }) });
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : "Unable to update permissions.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveBenefit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setIsSaving(true);
    setError(null);
    try {
      if (editingBenefitId) {
        await updateCustomerBenefit(user.id, editingBenefitId, benefitForm);
      } else {
        await createCustomerBenefit(user.id, benefitForm);
      }
      setBenefitForm(EMPTY_BENEFIT);
      setEditingBenefitId(null);
      await load();
      toast({ title: t("admin.users.benefits.saved", { fallback: "Benefit saved" }) });
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : "Unable to save this benefit.");
    } finally {
      setIsSaving(false);
    }
  };

  const beginEdit = (benefit: CustomerBenefit) => {
    setEditingBenefitId(benefit.id);
    setBenefitForm({
      type: benefit.type,
      titleEn: benefit.titleEn,
      titleAr: benefit.titleAr,
      descriptionEn: benefit.descriptionEn,
      descriptionAr: benefit.descriptionAr,
      discountPercent: benefit.discountPercent,
      discountAmount: benefit.discountAmount,
      promoCode: benefit.promoCode,
      minimumOrderAmount: benefit.minimumOrderAmount,
      startsAt: benefit.startsAt?.slice(0, 16) ?? null,
      endsAt: benefit.endsAt?.slice(0, 16) ?? null,
    });
  };

  const changeLifecycle = async (benefit: CustomerBenefit, action: "PAUSE" | "REACTIVATE" | "REVOKE") => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateCustomerBenefitLifecycle(user.id, benefit.id, action);
      await load();
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : "Unable to update this benefit.");
    } finally {
      setIsSaving(false);
    }
  };

  const initiateAccountLifecycle = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !lifecycleAction) return;
    const confirmation = lifecycleAction === "DELETION"
      ? "INITIATE_DELETION"
      : "INITIATE_DEACTIVATION";
    if (
      lifecycleConfirmation !== confirmation
      || !lifecycleCustomerResponse.trim()
      || !lifecycleAdminNote.trim()
    ) return;
    setIsSaving(true);
    setError(null);
    try {
      const result = await createAdminUserAccountActionRequest(user.id, {
        type: lifecycleAction,
        customerResponse: lifecycleCustomerResponse.trim(),
        adminNote: lifecycleAdminNote.trim(),
        confirmation,
      });
      setLocation(`/admin/account-requests?request=${encodeURIComponent(result.request.id)}`);
    } catch (saveError) {
      setError(saveError instanceof ApiError ? saveError.message : "Unable to start this account action.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <AdminLayout>
        <div className="rounded-xl border border-[#EFE2BC] bg-white p-8 text-sm font-semibold text-[#717182]">
          {error ?? t("admin.users.loading")}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <Link href="/admin/users" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--xd-gold-text)]">
          <DirectionalIcon direction="back" size={16} />
          {t("admin.users.backToUsers", { fallback: "Back to users" })}
        </Link>
        <AdminPageHeader
          title={user.name}
          description={`${user.email} · ${user.role.toUpperCase()}`}
          action={user.role === "support" ? (
            <button
              type="button"
              onClick={async () => setUser(await updateAdminUserStatus(user.id, !user.isActive))}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--xd-gold-border)] px-4 text-sm font-bold text-[var(--xd-gold-text)]"
            >
              <UserRoundCheck size={17} />
              {user.isActive
                ? t("admin.users.deactivate", { fallback: "Deactivate account" })
                : t("admin.users.activate", { fallback: "Activate account" })}
            </button>
          ) : undefined}
        />

        {error && <div role="alert" className="rounded-xl border border-[#F44336]/25 bg-[#F44336]/5 p-4 text-sm font-semibold text-[#B42318]">{error}</div>}

        <section className="grid gap-4 rounded-[20px] border border-[#EFE2BC] bg-white p-5 shadow-sm sm:grid-cols-4">
          <div><p className="text-xs font-bold uppercase text-[#717182]">{t("admin.users.role")}</p><p className="mt-2 font-black text-[#050505]">{user.role}</p></div>
          <div><p className="text-xs font-bold uppercase text-[#717182]">{t("admin.users.status", { fallback: "Status" })}</p><p className="mt-2 font-black text-[#050505]">{user.isActive ? "Active" : "Inactive"}</p></div>
          <div><p className="text-xs font-bold uppercase text-[#717182]">{t("admin.users.columns.created")}</p><p className="mt-2 font-black text-[#050505]">{new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-EG").format(new Date(user.createdAt))}</p></div>
          <div><p className="text-xs font-bold uppercase text-[#717182]">{t("admin.users.lifecycleState", { fallback: "Lifecycle" })}</p><p className="mt-2 font-black text-[#050505]">{user.lifecycleState.replaceAll("_", " ")}</p></div>
        </section>

        {user.role === "customer" && (
          <>
            <section className="rounded-[20px] border border-[#EFE2BC] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <FileClock size={19} className="text-[#D4A72C]" />
                    <h2 className="text-lg font-black text-[#050505]">{t("admin.users.accountLifecycle", { fallback: "Account lifecycle" })}</h2>
                  </div>
                  <p className="mt-1 text-sm text-[#717182]">{t("admin.users.accountLifecycleHelp", { fallback: "Protected two-stage deactivation and deletion with a permanent audit trail." })}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {user.lifecycleRequests.some((request) => ["PENDING", "UNDER_REVIEW", "APPROVED"].includes(request.status)) ? (
                    <Link
                      href={`/admin/account-requests?request=${encodeURIComponent(user.lifecycleRequests.find((request) => ["PENDING", "UNDER_REVIEW", "APPROVED"].includes(request.status))!.id)}`}
                      className="inline-flex h-10 items-center rounded-lg bg-[#F9DC5C] px-4 text-sm font-black text-[#050505]"
                    >
                      {t("admin.users.openAccountRequest", { fallback: "Open account request" })}
                    </Link>
                  ) : user.lifecycleState === "ACTIVE" ? (
                    <>
                      <button type="button" onClick={() => { setLifecycleAction("DEACTIVATION"); setLifecycleConfirmation(""); }} className="h-10 rounded-lg border border-[#D4A72C]/40 px-4 text-sm font-bold text-[#705A16]">
                        {t("admin.users.initiateDeactivation", { fallback: "Start deactivation" })}
                      </button>
                      <button type="button" onClick={() => { setLifecycleAction("DELETION"); setLifecycleConfirmation(""); }} className="h-10 rounded-lg border border-[#F44336]/30 px-4 text-sm font-bold text-[#B42318]">
                        {t("admin.users.initiateDeletion", { fallback: "Start deletion" })}
                      </button>
                    </>
                  ) : user.lifecycleState === "DEACTIVATED" ? (
                    <>
                      {user.lifecycleRequests.find((request) => request.type === "DEACTIVATION" && request.status === "COMPLETED") && (
                        <Link
                          href={`/admin/account-requests?request=${encodeURIComponent(user.lifecycleRequests.find((request) => request.type === "DEACTIVATION" && request.status === "COMPLETED")!.id)}`}
                          className="inline-flex h-10 items-center rounded-lg border border-[#D4A72C]/40 px-4 text-sm font-bold text-[#705A16]"
                        >
                          {t("admin.users.reactivateFromRequest", { fallback: "Review reactivation" })}
                        </Link>
                      )}
                      <button type="button" onClick={() => { setLifecycleAction("DELETION"); setLifecycleConfirmation(""); }} className="h-10 rounded-lg border border-[#F44336]/30 px-4 text-sm font-bold text-[#B42318]">
                        {t("admin.users.initiateDeletion", { fallback: "Start deletion" })}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              {lifecycleAction && user.lifecycleState !== "DELETED" && (
                <form onSubmit={initiateAccountLifecycle} className="mt-5 grid gap-4 rounded-xl border border-[#EFE2BC] bg-[#FBFAF7] p-4">
                  <label className="text-sm font-bold text-[#050505]">
                    {t("admin.users.customerVisibleResponse", { fallback: "Customer-visible response" })}
                    <textarea required maxLength={1000} value={lifecycleCustomerResponse} onChange={(event) => setLifecycleCustomerResponse(event.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-[#EFE2BC] bg-white p-3 text-sm outline-none focus:border-[#D4A72C]" />
                  </label>
                  <label className="text-sm font-bold text-[#050505]">
                    {t("admin.users.privateAdminReason", { fallback: "Private administrative reason" })}
                    <textarea required maxLength={2000} value={lifecycleAdminNote} onChange={(event) => setLifecycleAdminNote(event.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-[#EFE2BC] bg-white p-3 text-sm outline-none focus:border-[#D4A72C]" />
                  </label>
                  <label className="text-sm font-bold text-[#050505]">
                    {t("admin.users.typedConfirmation", { fallback: "Type {token} to continue", values: { token: lifecycleAction === "DELETION" ? "INITIATE_DELETION" : "INITIATE_DEACTIVATION" } })}
                    <input value={lifecycleConfirmation} onChange={(event) => setLifecycleConfirmation(event.target.value)} autoComplete="off" className={`mt-2 ${textInputClass()}`} />
                  </label>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setLifecycleAction(null)} className="h-10 rounded-lg border border-[#EFE2BC] px-4 text-sm font-bold">{t("common.cancel", { fallback: "Cancel" })}</button>
                    <button disabled={isSaving} className="h-10 rounded-lg bg-[#F9DC5C] px-4 text-sm font-black text-[#050505] disabled:opacity-60">{t("admin.users.createAccountRequest", { fallback: "Create protected request" })}</button>
                  </div>
                </form>
              )}

              <div className="mt-5 space-y-2">
                {user.lifecycleRequests.map((request) => (
                  <Link key={request.id} href={`/admin/account-requests?request=${encodeURIComponent(request.id)}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#EFE2BC] bg-[#FBFAF7] px-4 py-3 text-sm">
                    <span className="font-mono font-bold text-[#705A16]">{request.publicRequestNumber}</span>
                    <span className="font-semibold text-[#5F5F5F]">{request.type.replaceAll("_", " ")} · {request.status.replaceAll("_", " ")}</span>
                  </Link>
                ))}
                {user.lifecycleRequests.length === 0 && <p className="text-sm text-[#717182]">{t("admin.users.noLifecycleHistory", { fallback: "No account lifecycle actions have been recorded." })}</p>}
              </div>
            </section>

            {user.lifecycleState !== "DELETED" && (
            <section className="rounded-[20px] border border-[#EFE2BC] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-[#050505]">{t("admin.users.customerTier", { fallback: "Customer tier" })}</h2>
                  <p className="mt-1 text-sm text-[#717182]">{t("admin.users.tierHelp", { fallback: "VIP is a commercial tier and never grants staff access." })}</p>
                </div>
                <DentalSelect
                  label={t("admin.users.customerTier", { fallback: "Customer tier" })}
                  value={user.customerTier}
                  onChange={async (value) => {
                    const nextTier = value as "standard" | "vip";
                    if (nextTier === "vip") {
                      setPendingTierChange(nextTier);
                      return;
                    }
                    setUser(await updateCustomerTier(user.id, nextTier));
                  }}
                  options={[{ value: "standard", label: "Standard" }, { value: "vip", label: "VIP" }]}
                  triggerClassName="min-w-[180px]"
                />
              </div>
              {pendingTierChange === "vip" && (
                <div className="mt-4 rounded-[14px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)]/45 p-4 text-sm text-[#5F5F5F] dark:text-[#D6D0C3]">
                  <p className="font-bold text-[#050505] dark:text-[#F7F2E6]">{t("admin.users.vipConfirmationTitle", { fallback: "Confirm VIP tier benefits" })}</p>
                  <p className="mt-1 leading-5">{t("admin.users.vipConfirmationBody", { fallback: "VIP automatically receives double point earning, free Standard delivery, Fast upgrade-only pricing, and free Pickup. No manual benefit is required." })}</p>
                  <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => setPendingTierChange(null)} className="h-9 rounded-lg border border-[var(--xd-gold-border)] px-3 text-xs font-bold">{t("common.cancel", { fallback: "Cancel" })}</button><button type="button" onClick={async () => { setUser(await updateCustomerTier(user.id, "vip")); setPendingTierChange(null); }} className="h-9 rounded-lg bg-[image:var(--xd-gold-gradient)] px-3 text-xs font-bold text-[#050505]">{t("admin.users.confirmVip", { fallback: "Confirm VIP" })}</button><a href="#vip-additional-benefit" className="inline-flex h-9 items-center rounded-lg border border-[var(--xd-gold-border)] px-3 text-xs font-bold text-[var(--xd-gold-text)]">{t("admin.users.addAdditionalVipBenefit", { fallback: "Add Additional VIP Benefit" })}</a></div>
                </div>
              )}
            </section>
            )}

            {user.customerTier === "vip" && user.lifecycleState !== "DELETED" && (
              <section id="vip-additional-benefit" className="rounded-[20px] border border-[#EFE2BC] bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <Plus size={18} className="text-[#D4A72C]" />
                  <h2 className="text-lg font-black text-[#050505]">{t("admin.users.benefits.title", { fallback: "VIP benefits" })}</h2>
                </div>
                <form onSubmit={saveBenefit} noValidate className="mt-5 grid gap-4 sm:grid-cols-2">
                  <DentalSelect
                    label={t("admin.users.benefits.type", { fallback: "Benefit type" })}
                    value={benefitForm.type}
                    onChange={(value) => setBenefitForm((current) => ({ ...current, type: value as CustomerBenefitInput["type"] }))}
                    options={["FREE_SHIPPING", "PERCENTAGE_DISCOUNT", "FIXED_DISCOUNT", "PROMO_CODE", "CUSTOM"].map((value) => ({ value, label: value.replaceAll("_", " ") }))}
                  />
                  <label className="text-sm font-bold text-[#050505]">English title<input required value={benefitForm.titleEn} onChange={(e) => setBenefitForm((c) => ({ ...c, titleEn: e.target.value }))} className={`mt-2 ${textInputClass()}`} /></label>
                  <label className="text-sm font-bold text-[#050505]">العنوان بالعربية<input required dir="rtl" value={benefitForm.titleAr} onChange={(e) => setBenefitForm((c) => ({ ...c, titleAr: e.target.value }))} className={`mt-2 ${textInputClass()}`} /></label>
                  <label className="text-sm font-bold text-[#050505]">Discount %<input type="number" min="0" max="100" value={benefitForm.discountPercent ?? ""} onChange={(e) => setBenefitForm((c) => ({ ...c, discountPercent: e.target.value ? Number(e.target.value) : null }))} className={`mt-2 ${textInputClass()}`} /></label>
                  <label className="text-sm font-bold text-[#050505]">Discount amount<input type="number" min="0" value={benefitForm.discountAmount ?? ""} onChange={(e) => setBenefitForm((c) => ({ ...c, discountAmount: e.target.value ? Number(e.target.value) : null }))} className={`mt-2 ${textInputClass()}`} /></label>
                  <label className="text-sm font-bold text-[#050505]">Promo code<input value={benefitForm.promoCode ?? ""} onChange={(e) => setBenefitForm((c) => ({ ...c, promoCode: e.target.value }))} className={`mt-2 ${textInputClass()}`} /></label>
                  <label className="text-sm font-bold text-[#050505]">Minimum order<input type="number" min="0" value={benefitForm.minimumOrderAmount ?? ""} onChange={(e) => setBenefitForm((c) => ({ ...c, minimumOrderAmount: e.target.value ? Number(e.target.value) : null }))} className={`mt-2 ${textInputClass()}`} /></label>
                  <label className="text-sm font-bold text-[#050505]">Starts at<input type="datetime-local" value={benefitForm.startsAt ?? ""} onChange={(e) => setBenefitForm((c) => ({ ...c, startsAt: e.target.value || null }))} className={`mt-2 ${textInputClass()}`} /></label>
                  <label className="text-sm font-bold text-[#050505]">Ends at<input type="datetime-local" value={benefitForm.endsAt ?? ""} onChange={(e) => setBenefitForm((c) => ({ ...c, endsAt: e.target.value || null }))} className={`mt-2 ${textInputClass()}`} /></label>
                  <div className="sm:col-span-2 flex justify-end gap-2">
                    {editingBenefitId && <button type="button" onClick={() => { setEditingBenefitId(null); setBenefitForm(EMPTY_BENEFIT); }} className="h-10 rounded-lg border border-[#EFE2BC] px-4 text-sm font-bold">Cancel</button>}
                    <button disabled={isSaving} className="h-10 rounded-lg bg-[#F9DC5C] px-4 text-sm font-black text-[#050505] disabled:opacity-60">{editingBenefitId ? "Save changes" : "Add benefit"}</button>
                  </div>
                </form>

                <div className="mt-6 space-y-3">
                  {user.benefits.map((benefit) => (
                    <article key={benefit.id} className="rounded-[16px] border border-[#EFE2BC] bg-[#FBFAF7] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2"><h3 className="font-black text-[#050505]">{language === "ar" ? benefit.titleAr : benefit.titleEn}</h3><AdminStatusBadge tone={benefit.lifecycle === "ACTIVE" ? "green" : benefit.lifecycle === "REVOKED" ? "red" : "amber"}>{benefit.lifecycle}</AdminStatusBadge></div>
                          <p className="mt-2 text-xs text-[#717182]">{benefit.type.replaceAll("_", " ")}{benefit.minimumOrderAmount ? ` · Min EGP ${benefit.minimumOrderAmount}` : ""}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {benefit.lifecycle !== "REVOKED" && <button type="button" onClick={() => beginEdit(benefit)} className="h-8 rounded-lg border border-[#EFE2BC] px-3 text-xs font-bold">Edit</button>}
                          {benefit.lifecycle === "ACTIVE" && <button type="button" onClick={() => changeLifecycle(benefit, "PAUSE")} className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#EFE2BC] px-3 text-xs font-bold"><Pause size={13} />Pause</button>}
                          {benefit.lifecycle === "PAUSED" && <button type="button" onClick={() => changeLifecycle(benefit, "REACTIVATE")} className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#EFE2BC] px-3 text-xs font-bold"><Play size={13} />Reactivate</button>}
                          {benefit.lifecycle !== "REVOKED" && <button type="button" onClick={() => changeLifecycle(benefit, "REVOKE")} className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#F44336]/25 px-3 text-xs font-bold text-[#B42318]"><XCircle size={13} />Revoke</button>}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {user.role === "support" && catalog && (
          <section className="rounded-[20px] border border-[#EFE2BC] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div><div className="flex items-center gap-2"><ShieldCheck size={19} className="text-[#D4A72C]" /><h2 className="text-lg font-black text-[#050505]">Support permissions</h2></div><p className="mt-1 text-sm text-[#717182]">{permissions.length} selected · last changed {user.permissionsUpdatedAt ? new Date(user.permissionsUpdatedAt).toLocaleString() : "never"}{user.permissionsUpdatedBy ? ` by ${user.permissionsUpdatedBy.name}` : ""}</p></div>
              <DentalSelect label="Preset" value={preset} onChange={(value) => { setPreset(value); if (value !== "CUSTOM") setPermissions(catalog.presets[value] ?? []); }} options={[{ value: "SUPPORT_VIEWER", label: "Support Viewer" }, { value: "SUPPORT_AGENT", label: "Support Agent" }, { value: "SUPPORT_MANAGER", label: "Support Manager" }, { value: "CUSTOM", label: "Custom" }]} triggerClassName="min-w-[190px]" />
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(catalog.groups).map(([group, keys]) => (
                <fieldset key={group} className="rounded-xl border border-[#EFE2BC] bg-[#FBFAF7] p-4"><legend className="px-1 text-xs font-black">{group.replaceAll("_", " ")}</legend><div className="mt-2 space-y-2">{keys.map((key) => <label key={key} className="flex gap-2 text-xs font-semibold text-[#5F5F5F]"><input type="checkbox" checked={permissions.includes(key)} onChange={(e) => { setPreset("CUSTOM"); setPermissions((current) => e.target.checked ? [...current, key] : current.filter((item) => item !== key)); }} className="h-4 w-4 accent-[#D4A72C]" /><span>{key.replaceAll("_", " ")}</span></label>)}</div></fieldset>
              ))}
            </div>
            <div className="mt-5 flex justify-end"><button type="button" disabled={isSaving} onClick={savePermissions} className="h-10 rounded-lg bg-[#F9DC5C] px-5 text-sm font-black text-[#050505] disabled:opacity-60">Save permissions</button></div>
          </section>
        )}
      </div>
    </AdminLayout>
  );
}
