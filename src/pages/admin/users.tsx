import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, RefreshCw, Search, UsersRound } from "lucide-react";
import { Link, useSearch } from "wouter";
import { DentalSelect } from "@/components/dental/Select";
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
  createAdminUser,
  getAdminUsers,
  getPermissionCatalog,
  type AdminUser,
  type AdminUserRole,
  type CustomerTier,
  type PermissionCatalog,
} from "@/services/adminUsers";
import { ApiError } from "@/services/http";
import { AdminLayout } from "./_components/AdminLayout";
import { AdminPageHeader, AdminStatusBadge, AdminTableShell } from "./_components/admin-ui";
import type { StatusTone } from "./admin-data";

type UserForm = {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: AdminUserRole;
  customerTier: CustomerTier;
  permissionPreset: string;
  permissions: string[];
};

type UserFormErrors = Partial<Record<keyof UserForm, string>>;

const EMPTY_FORM: UserForm = {
  name: "",
  email: "",
  phone: "",
  password: "",
  role: "customer",
  customerTier: "standard",
  permissionPreset: "SUPPORT_VIEWER",
  permissions: [],
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_TONES: Record<AdminUserRole, StatusTone> = {
  admin: "purple",
  support: "blue",
  customer: "slate",
};

function formatDate(value: string, language: string) {
  return new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-EG", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs font-semibold text-[#B42318]">{message}</p>;
}

function UserInput({
  id,
  label,
  value,
  onChange,
  error,
  type = "text",
  autoComplete,
  maxLength,
  required,
}: {
  id: keyof UserForm;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  autoComplete?: string;
  maxLength?: number;
  required?: boolean;
}) {
  return (
    <label htmlFor={`admin-user-${id}`} className="block">
      <span className="text-sm font-bold text-[#050505]">{label}</span>
      <input
        id={`admin-user-${id}`}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        maxLength={maxLength}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `admin-user-${id}-error` : undefined}
        className={`mt-2 h-[52px] w-full rounded-[14px] border bg-white px-4 text-sm font-semibold text-[#050505] outline-none transition placeholder:text-[#B3B4BD] focus:ring-4 ${
          error
            ? "border-[#B42318]/55 focus:border-[#B42318] focus:ring-[#B42318]/10"
            : "border-[#050505]/10 focus:border-[#D4A72C] focus:ring-[#D4A72C]/10"
        }`}
      />
      <span id={`admin-user-${id}-error`}><FieldError message={error} /></span>
    </label>
  );
}

export default function AdminUsers() {
  const queryString = useSearch();
  const { currentUser } = useStore();
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const initialSearch = useMemo(
    () => new URLSearchParams(queryString).get("search")?.trim() ?? "",
    [queryString]
  );
  const [search, setSearch] = useState(initialSearch);
  const [roleFilter, setRoleFilter] = useState<AdminUserRole | "all">("all");
  const [tierFilter, setTierFilter] = useState<CustomerTier | "all">("all");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<UserFormErrors>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [permissionCatalog, setPermissionCatalog] = useState<PermissionCatalog | null>(null);
  const isAdmin = currentUser?.role?.trim().toLowerCase() === "admin";

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setIsLoading(true);
      setLoadError(null);
      getAdminUsers({
        search,
        role: roleFilter === "all" ? undefined : roleFilter,
        tier: tierFilter === "all" ? undefined : tierFilter,
        signal: controller.signal,
      })
        .then(setUsers)
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setLoadError(error instanceof ApiError ? error.message : t("admin.users.loadError"));
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [refreshVersion, roleFilter, search, t, tierFilter]);

  useEffect(() => {
    if (!isAdmin) return;
    getPermissionCatalog().then(setPermissionCatalog).catch(() => setPermissionCatalog(null));
  }, [isAdmin]);

  const roleOptions = useMemo(
    () => [
      { value: "customer", label: t("admin.users.roles.customer") },
      { value: "support", label: t("admin.users.roles.support") },
      { value: "admin", label: t("admin.users.roles.admin") },
    ],
    [t]
  );

  const filterOptions = useMemo(
    () => [{ value: "all", label: t("admin.users.allRoles") }, ...roleOptions],
    [roleOptions, t]
  );

  const updateField = (field: keyof UserForm, value: string) => {
    setForm((current) => {
      if (field === "role") {
        return {
          ...current,
          role: value as AdminUserRole,
          customerTier: value === "customer" ? current.customerTier : "standard",
          permissions:
            value === "support"
              ? (current.permissions.length
                  ? current.permissions
                  : permissionCatalog?.presets.SUPPORT_VIEWER ?? [])
              : [],
        };
      }
      return ({ ...current, [field]: value });
    });
    setFormErrors((current) => ({ ...current, [field]: undefined }));
    setCreateError(null);
  };

  const validateForm = () => {
    const errors: UserFormErrors = {};
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();

    if (name.length < 2 || name.length > 100) errors.name = t("admin.users.validation.name");
    if (!EMAIL_PATTERN.test(email)) errors.email = t("admin.users.validation.email");
    if (phone.length > 30) errors.phone = t("admin.users.validation.phone");
    if (form.password.length < 8 || form.password.length > 128) {
      errors.password = t("admin.users.validation.password");
    }
    if (!roleOptions.some((option) => option.value === form.role)) {
      errors.role = t("admin.users.validation.role");
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const closeCreateDialog = () => {
    setIsCreateOpen(false);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setCreateError(null);
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateForm()) return;

    setIsCreating(true);
    setCreateError(null);
    try {
      await createAdminUser({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        password: form.password,
        role: form.role,
        ...(form.role === "customer" ? { customerTier: form.customerTier } : {}),
        ...(form.role === "support" ? { permissions: form.permissions } : {}),
      });
      closeCreateDialog();
      setRefreshVersion((current) => current + 1);
      toast({ title: t("admin.users.createdSuccess") });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 409) {
          setFormErrors((current) => ({ ...current, email: t("admin.users.emailExists") }));
        } else if (error.status === 403) {
          setCreateError(t("admin.users.notAllowed"));
        } else if (error.field && error.field in EMPTY_FORM) {
          setFormErrors((current) => ({ ...current, [error.field as keyof UserForm]: error.message }));
        } else {
          setCreateError(error.message);
        }
      } else {
        setCreateError(t("admin.users.createError"));
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminPageHeader
          title={t("admin.users.title")}
          description={t("admin.users.description")}
          action={isAdmin ? (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#F9DC5C] px-4 text-sm font-semibold text-[#050505] shadow-sm transition hover:-translate-y-px hover:bg-[#D4A72C] focus:outline-none focus:ring-2 focus:ring-[#D4A72C]/45 focus:ring-offset-2"
            >
              <Plus size={17} />
              {t("admin.users.addUser")}
            </button>
          ) : undefined}
        />

        <section className="grid gap-3 rounded-lg border border-[#EFE2BC] bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_200px_200px_auto] sm:items-end">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-[#717182]">{t("admin.users.searchUsers")}</span>
            <span className="mt-2 flex h-11 items-center gap-2 rounded-lg border border-[#050505]/10 bg-[#FBFAF7] px-3 focus-within:border-[#D4A72C] focus-within:ring-4 focus-within:ring-[#D4A72C]/10">
              <Search size={16} className="shrink-0 text-[#D4A72C]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("admin.users.searchPlaceholder")}
                className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#050505] outline-none placeholder:text-[#B3B4BD]"
              />
            </span>
          </label>
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-[#717182]">{t("admin.users.filterByRole")}</span>
            <DentalSelect
              label={t("admin.users.filterByRole")}
              value={roleFilter}
              onChange={(value) => setRoleFilter(value as AdminUserRole | "all")}
              options={filterOptions}
              triggerClassName="mt-2 h-11 rounded-lg bg-[#FBFAF7] px-3"
            />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-[#717182]">
              {t("admin.users.customerTier", { fallback: "Customer tier" })}
            </span>
            <DentalSelect
              label={t("admin.users.customerTier", { fallback: "Customer tier" })}
              value={tierFilter}
              onChange={(value) => setTierFilter(value as CustomerTier | "all")}
              options={[
                { value: "all", label: t("admin.users.allTiers", { fallback: "All tiers" }) },
                { value: "standard", label: t("admin.users.tiers.standard", { fallback: "Standard" }) },
                { value: "vip", label: t("admin.users.tiers.vip", { fallback: "VIP" }) },
              ]}
              triggerClassName="mt-2 h-11 rounded-lg bg-[#FBFAF7] px-3"
            />
          </div>
          <button
            type="button"
            onClick={() => setRefreshVersion((current) => current + 1)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#EFE2BC] bg-white px-4 text-sm font-semibold text-[#717182] transition hover:border-[#D4A72C]/55 hover:bg-[#FFF9E8] hover:text-[#050505] dark:hover:border-[#D4A72C]/40 dark:hover:bg-white/[0.05] dark:hover:text-[#F6D85D]"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            {t("admin.users.refresh")}
          </button>
        </section>

        {loadError && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] p-4 text-sm font-semibold text-[#B42318]">
            <span>{loadError}</span>
            <button type="button" onClick={() => setRefreshVersion((current) => current + 1)} className="underline underline-offset-4">
              {t("admin.users.retry")}
            </button>
          </div>
        )}

        <AdminTableShell>
          <table className="min-w-full divide-y divide-[#EFE2BC] text-sm">
            <thead className="bg-[#FFF9E8] text-start text-xs uppercase tracking-wide text-[#717182]">
              <tr>
                <th className="px-5 py-3 text-start font-bold">{t("admin.users.columns.user")}</th>
                <th className="px-5 py-3 text-start font-bold">{t("admin.users.columns.contact")}</th>
                <th className="px-5 py-3 text-start font-bold">{t("admin.users.role")}</th>
                <th className="px-5 py-3 text-start font-bold">{t("admin.users.lifecycleState", { fallback: "Lifecycle" })}</th>
                <th className="px-5 py-3 text-start font-bold">{t("admin.users.columns.activity")}</th>
                <th className="px-5 py-3 text-start font-bold">{t("admin.users.columns.created")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3E8C8]">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-[#050505]">{user.name}</p>
                  </td>
                  <td className="px-5 py-4">
                    <AdminStatusBadge tone={user.lifecycleState === "ACTIVE" ? "green" : user.lifecycleState === "DELETED" ? "red" : "amber"}>
                      {user.lifecycleState === "DELETION_REQUESTED"
                        ? t("admin.accountRequests.lifecycles.deletionRequested", { fallback: "Deletion requested" })
                        : user.lifecycleState === "DEACTIVATED"
                          ? t("admin.accountRequests.lifecycles.deactivated", { fallback: "Deactivated" })
                          : user.lifecycleState === "DELETED"
                            ? t("admin.accountRequests.lifecycles.deleted", { fallback: "Deleted / anonymized" })
                            : t("admin.accountRequests.lifecycles.active", { fallback: "Active" })}
                    </AdminStatusBadge>
                  </td>
                  <td className="px-5 py-4 text-[#717182]">
                    <p className="font-medium text-[#050505]">{user.email}</p>
                    {user.phone && <p className="mt-1">{user.phone}</p>}
                  </td>
                  <td className="px-5 py-4">
                    <AdminStatusBadge tone={ROLE_TONES[user.role]}>{t(`admin.users.roles.${user.role}`)}</AdminStatusBadge>
                    {user.role === "customer" && user.customerTier === "vip" && (
                      <span className="ms-2 inline-flex rounded-full border border-[var(--xd-gold-border)] bg-[var(--xd-gold-bg-soft)] px-2 py-0.5 text-[10px] font-black text-[var(--xd-gold-text)]">
                        VIP
                      </span>
                    )}
                    {!user.isActive && (
                      <span className="ms-2 inline-flex rounded-full border border-[#F44336]/25 px-2 py-0.5 text-[10px] font-bold text-[#F44336]">
                        {t("admin.users.inactive", { fallback: "Inactive" })}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-[#717182]">
                    <p>{t("admin.users.orderCount", { values: { count: user.orderCount } })}</p>
                    <p className="mt-1">{t("admin.users.requestCount", { values: { count: user.productRequestCount } })}</p>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-[#717182]">
                    <p>{formatDate(user.createdAt, language)}</p>
                    {isAdmin && user.role !== "admin" && (
                      <Link href={`/admin/users/${user.id}`} className="mt-2 inline-flex font-bold text-[var(--xd-gold-text)] hover:underline">
                        {user.lifecycleState === "DELETION_REQUESTED"
                          ? t("admin.users.openAccountRequest", { fallback: "Open account request" })
                          : t("admin.users.viewAccount", { fallback: "View account" })}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
              {isLoading && users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm font-semibold text-[#717182]">
                    {t("admin.users.loading")}
                  </td>
                </tr>
              )}
              {!isLoading && !loadError && users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <UsersRound size={30} className="mx-auto text-[#D4A72C]" />
                    <p className="mt-3 text-sm font-semibold text-[#717182]">{t("admin.users.noUsers")}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </AdminTableShell>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={(open) => (open ? setIsCreateOpen(true) : closeCreateDialog())}>
        <DialogContent data-admin-dialog="user-editor" className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] min-w-0 flex-col overflow-hidden rounded-[22px] border-[#EFE2BC] bg-[#FFFEFB] p-0 sm:max-w-[620px]">
          <DialogHeader className="shrink-0 border-b border-[#EFE2BC] px-6 pb-5 pt-6 text-start sm:text-start">
            <DialogTitle className="text-2xl font-bold text-[#050505]">{t("admin.users.createUser")}</DialogTitle>
            <DialogDescription className="leading-6 text-[#717182]">{t("admin.users.createDescription")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} noValidate className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <UserInput id="name" label={t("admin.users.fullName")} value={form.name} onChange={(value) => updateField("name", value)} error={formErrors.name} autoComplete="name" maxLength={100} required />
              </div>
              <UserInput id="email" label={t("admin.users.email")} value={form.email} onChange={(value) => updateField("email", value)} error={formErrors.email} type="email" autoComplete="email" maxLength={254} required />
              <UserInput id="phone" label={t("admin.users.phone")} value={form.phone} onChange={(value) => updateField("phone", value)} error={formErrors.phone} type="tel" autoComplete="tel" maxLength={31} />
              <UserInput id="password" label={t("admin.users.password")} value={form.password} onChange={(value) => updateField("password", value)} error={formErrors.password} type="password" autoComplete="new-password" maxLength={128} required />
              <div>
                <span className="text-sm font-bold text-[#050505]">{t("admin.users.role")}</span>
                <DentalSelect
                  label={t("admin.users.role")}
                  value={form.role}
                  onChange={(value) => updateField("role", value)}
                  options={roleOptions}
                  triggerClassName={formErrors.role ? "mt-2 border-[#B42318]/55" : "mt-2"}
                />
                <FieldError message={formErrors.role} />
              </div>
              {form.role === "customer" && (
                <div>
                  <span className="text-sm font-bold text-[#050505]">
                    {t("admin.users.customerTier", { fallback: "Customer tier" })}
                  </span>
                  <DentalSelect
                    label={t("admin.users.customerTier", { fallback: "Customer tier" })}
                    value={form.customerTier}
                    onChange={(value) => setForm((current) => ({ ...current, customerTier: value as CustomerTier }))}
                    options={[
                      { value: "standard", label: t("admin.users.tiers.standard", { fallback: "Standard" }) },
                      { value: "vip", label: t("admin.users.tiers.vip", { fallback: "VIP" }) },
                    ]}
                    triggerClassName="mt-2"
                  />
                </div>
              )}
            </div>

            {form.role === "support" && permissionCatalog && (
              <section className="mt-5 rounded-[16px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)]/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-[#050505]">
                      {t("admin.users.permissions.title", { fallback: "Permissions" })}
                    </h3>
                    <p className="mt-1 text-xs text-[#717182]">
                      {t("admin.users.permissions.selected", {
                        fallback: "{count} selected",
                        values: { count: form.permissions.length },
                      })}
                    </p>
                  </div>
                  <DentalSelect
                    label={t("admin.users.permissions.preset", { fallback: "Permission preset" })}
                    value={form.permissionPreset}
                    onChange={(value) => {
                      const preset = value === "CUSTOM" ? form.permissions : permissionCatalog.presets[value] ?? [];
                      setForm((current) => ({ ...current, permissionPreset: value, permissions: [...preset] }));
                    }}
                    options={[
                      { value: "SUPPORT_VIEWER", label: t("admin.users.permissions.viewer", { fallback: "Support Viewer" }) },
                      { value: "SUPPORT_AGENT", label: t("admin.users.permissions.agent", { fallback: "Support Agent" }) },
                      { value: "SUPPORT_MANAGER", label: t("admin.users.permissions.manager", { fallback: "Support Manager" }) },
                      { value: "CUSTOM", label: t("admin.users.permissions.custom", { fallback: "Custom" }) },
                    ]}
                    triggerClassName="h-10 min-w-[190px]"
                  />
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {Object.entries(permissionCatalog.groups).map(([group, keys]) => (
                    <fieldset key={group} className="rounded-xl border border-[#050505]/[0.06] bg-white/65 p-3">
                      <legend className="px-1 text-xs font-black text-[#050505]">
                        {t(`admin.users.permissionGroups.${group}`, { fallback: group.replaceAll("_", " ") })}
                      </legend>
                      <div className="mt-2 space-y-2">
                        {keys.map((key) => (
                          <label key={key} className="flex cursor-pointer items-start gap-2 text-xs font-semibold text-[#5F5F5F]">
                            <input
                              type="checkbox"
                              checked={form.permissions.includes(key)}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  permissionPreset: "CUSTOM",
                                  permissions: event.target.checked
                                    ? [...current.permissions, key]
                                    : current.permissions.filter((permission) => permission !== key),
                                }))
                              }
                              className="mt-0.5 h-4 w-4 rounded border-[var(--xd-gold-border)] accent-[#D4A72C]"
                            />
                            <span>{t(`admin.users.permissionLabels.${key}`, { fallback: key.replaceAll("_", " ") })}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </div>
              </section>
            )}

            {createError && <div role="alert" className="mt-4 rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] p-3 text-sm font-semibold text-[#B42318]">{createError}</div>}
            </div>

            <DialogFooter className="shrink-0 gap-2 border-t border-[#EFE2BC] bg-[#FFFEFB] px-6 py-4 sm:gap-2">
              <button type="button" onClick={closeCreateDialog} disabled={isCreating} className="inline-flex h-10 items-center justify-center rounded-lg border border-[#EFE2BC] bg-white px-4 text-sm font-semibold text-[#717182] transition hover:bg-[#FBFAF7] dark:hover:border-[#D4A72C]/40 dark:hover:bg-white/[0.05] dark:hover:text-[#F6D85D] disabled:opacity-60">
                {t("admin.users.cancel")}
              </button>
              <button type="submit" disabled={isCreating} className="inline-flex h-10 items-center justify-center rounded-lg bg-[#F9DC5C] px-4 text-sm font-semibold text-[#050505] transition hover:bg-[#D4A72C] disabled:cursor-not-allowed disabled:opacity-60">
                {isCreating ? t("admin.users.creating") : t("admin.users.createUser")}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
