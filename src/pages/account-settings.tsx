import { useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from "react";
import { Link, useLocation } from "wouter";
import { useCallback, useEffect, useRef } from "react";
import {
  Bell,
  Globe,
  LockKeyhole,
  Mail,
  MonitorSmartphone,
  RefreshCw,
  Shield,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { Container } from "@/components/dental/Container";
import { AccountSidebar } from "@/components/dental/AccountSidebar";
import { Button } from "@/components/dental/Button";
import { DentalSelect, type DentalSelectOption } from "@/components/dental/Select";
import { useLanguage } from "@/context/LanguageContext";
import { useStore } from "@/context/StoreContext";
import { accountT, accountValue } from "@/lib/accountI18n";
import {
  accountRequestStatusTranslationKey,
  approvedCustomerExplanationTranslationKey,
} from "@/lib/accountRequestWorkflow";
import { AuthApiError, changePassword } from "@/services/auth";
import {
  cancelAccountActionRequest,
  createAccountActionRequest,
  getAccountActionRequests,
  getAccountPreferences,
  getAccountSessions,
  logoutOtherAccountSessions,
  revokeAccountSession,
  updateAccountPreferences,
  type AccountActionRequest,
  type AccountActionRequestStatus,
  type AccountPreferences,
  type AccountSession,
} from "@/services/account";
import { ApiError } from "@/services/http";
import { cn } from "@/lib/utils";

type AccountAction = "deactivate" | "delete";
type BooleanPreferenceKey = {
  [Key in keyof AccountPreferences]: AccountPreferences[Key] extends boolean
    ? Key
    : never;
}[keyof AccountPreferences];

const inputClassName =
  "h-12 w-full rounded-[12px] border border-[#050505]/10 bg-white px-4 text-[14px] text-[#050505] outline-none transition placeholder:text-[#B3B4BD] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10";

const languageOptions: DentalSelectOption[] = [
  { value: "en", label: "English" },
  { value: "ar", label: "العربية" },
];

function Toggle({
  label,
  checked,
  onToggle,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={checked}
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "relative h-7 w-12 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)]",
        checked ? "bg-[var(--xd-gold-active)]" : "bg-[#D9D9D9]",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <span
        className={cn(
          "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "left-6" : "left-1"
        )}
      />
    </button>
  );
}

function ToggleRow({
  label,
  checked,
  onToggle,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={cn("text-[14px] font-bold", disabled ? "text-[#8A8D9A]" : "text-[#050505]")}>{label}</span>
      <Toggle label={label} checked={checked} onToggle={onToggle} disabled={disabled} />
    </div>
  );
}

function SettingsCard({
  icon: Icon,
  title,
  subtitle,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[24px] border border-[var(--xd-gold-active)]/[0.12] bg-white/80 p-5 shadow-[0_12px_34px_rgba(5,5,5,0.04)] backdrop-blur sm:p-6",
        className
      )}
    >
      <div className="mb-6 flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-active)]">
          <Icon size={18} />
        </span>
        <div>
          <h2 className="text-[18px] font-bold text-[#050505]">{title}</h2>
          <p className="mt-1 text-[13px] leading-5 text-[#8A8D9A]">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function LabeledInput({
  label,
  value,
  disabled = false,
}: {
  label: string;
  value: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-bold text-[#050505]">{label}</span>
      <input
        value={value}
        disabled={disabled}
        onChange={() => undefined}
        className={cn(inputClassName, disabled && "bg-[#F5F4EF] text-[#9A9A9A]")}
      />
    </label>
  );
}

function formatSessionDate(value: string, language: "en" | "ar") {
  return new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function accountRequestStatusLabel(
  t: ReturnType<typeof useLanguage>["t"],
  status: AccountActionRequestStatus
) {
  const fallback: Record<AccountActionRequestStatus, string> = {
    PENDING: "Pending",
    UNDER_REVIEW: "Under Review",
    APPROVED: "Approved — Awaiting Completion",
    REJECTED: "Rejected",
    CANCELED: "Canceled",
    COMPLETED: "Completed",
  };
  return accountT(
    t,
    `settings.accountRequestStatuses.${accountRequestStatusTranslationKey(status)}`,
    fallback[status]
  );
}

function accountRequestTypeLabel(
  t: ReturnType<typeof useLanguage>["t"],
  type: AccountActionRequest["type"]
) {
  return type === "DELETION"
    ? accountT(t, "settings.accountRequestTypes.deletion", "Deletion")
    : accountT(t, "settings.accountRequestTypes.deactivation", "Deactivation");
}

function ChangePasswordModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (signedOutOtherSessions: number) => void;
}) {
  const { t } = useLanguage();

  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (form.newPassword !== form.confirmPassword) {
      setError(accountT(t, "settings.passwordMismatch", "New password and confirmation do not match."));
      return;
    }

    if (form.newPassword.length < 8) {
      setError(accountT(t, "settings.passwordTooShort", "New password must be at least 8 characters."));
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const result = await changePassword(form.currentPassword, form.newPassword);
      onSave(result.signedOutOtherSessions);
    } catch (submitError) {
      if (submitError instanceof AuthApiError && submitError.status === 401) {
        setError(accountT(t, "settings.wrongCurrentPassword", "The current password is incorrect."));
      } else if (submitError instanceof AuthApiError && submitError.status !== 0) {
        setError(submitError.message);
      } else {
        setError(accountT(t, "settings.passwordChangeFailed", "The password could not be changed. Please try again."));
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#050505]/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-password-title"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[520px] rounded-[28px] border border-[var(--xd-gold-border-soft)] bg-white p-6 shadow-[0_24px_70px_rgba(5,5,5,0.18)] sm:p-8"
      >
        <div className="mb-6">
          <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--xd-gold-active)]">
            {accountT(t, "settings.security", "Security")}
          </p>
          <h2 id="settings-password-title" className="font-display text-[28px] font-bold text-[#050505]">
            {accountT(t, "settings.changePassword", "Change Password")}
          </h2>
          <p className="mt-2 text-[14px] leading-6 text-[#8A8D9A]">
            {accountT(t, "settings.changePasswordDescription", "Enter your current password and choose a new secure password.")}
          </p>
        </div>

        <div className="space-y-5">
          {[
            ["currentPassword", accountT(t, "settings.currentPassword", "Current Password"), "current-password"],
            ["newPassword", accountT(t, "settings.newPassword", "New Password"), "new-password"],
            ["confirmPassword", accountT(t, "settings.confirmNewPassword", "Confirm New Password"), "new-password"],
          ].map(([key, label, autoComplete]) => (
            <label key={key} className="block">
              <span className="mb-2 block text-[13px] font-bold text-[#050505]">{label}</span>
              <input
                required
                type="password"
                autoComplete={autoComplete}
                value={form[key as keyof typeof form]}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
                className={inputClassName}
              />
              {key === "newPassword" && (
                <span className="mt-2 block text-[12px] text-[#8A8D9A]">
                  {accountT(t, "settings.passwordHint", "Use at least 8 characters.")}
                </span>
              )}
            </label>
          ))}
        </div>

        {error && (
          <p className="mt-4 rounded-[12px] border border-[#F44336]/20 bg-[#F44336]/[0.08] px-4 py-3 text-[13px] font-semibold text-[#F44336]">
            {error}
          </p>
        )}

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            onClick={onClose}
            variant="tertiary"
            size="sm"
            className="h-11 px-5 text-[14px]"
          >
            {accountT(t, "common.cancel", "Cancel")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSaving}
            className="h-11 px-6 text-[14px]"
          >
            {isSaving
              ? accountT(t, "common.saving", "Saving...")
              : accountT(t, "settings.savePassword", "Save Password")}
          </Button>
        </div>
      </form>
    </div>
  );
}

function AccountActionModal({
  action,
  onClose,
  onConfirm,
  isSubmitting,
}: {
  action: AccountAction;
  onClose: () => void;
  onConfirm: (input: { customerReason: string; customerDetails: string }) => void;
  isSubmitting: boolean;
}) {
  const { t } = useLanguage();
  const isDelete = action === "delete";
  const [customerReason, setCustomerReason] = useState("");
  const [customerDetails, setCustomerDetails] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const canSubmit = isDelete ? confirmationText === "DELETE" : confirmed;
  const title = isDelete
    ? accountT(t, "settings.deleteAccountQuestion", "Delete Account?")
    : accountT(t, "settings.deactivateAccountQuestion", "Deactivate Account?");
  const description = isDelete
    ? accountT(
        t,
        "settings.deleteAccountDescription",
        "Deletion requires review. If approved, direct profile details are anonymized while transactional records that the store must retain remain preserved."
      )
    : accountT(
        t,
        "settings.deactivateAccountDescription",
        "After approval and completion, your account becomes inaccessible and all sessions are revoked. Orders and business records remain preserved."
      );

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#050505]/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-action-title"
    >
      <div className="w-full max-w-[480px] rounded-[28px] border border-[#F44336]/20 bg-white p-6 shadow-[0_24px_70px_rgba(5,5,5,0.18)] sm:p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F44336]/10 text-[#F44336]">
          <TriangleAlert size={20} />
        </span>
        <h2 id="account-action-title" className="mt-5 font-display text-[26px] font-bold text-[#050505]">
          {title}
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-[#8A8D9A]">{description}</p>
        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-2 block text-[13px] font-bold text-[#050505]">
              {accountT(t, "settings.accountRequestReason", "Reason (optional)")}
            </span>
            <textarea
              maxLength={500}
              value={customerReason}
              onChange={(event) => setCustomerReason(event.target.value)}
              className="min-h-[92px] w-full resize-y rounded-[12px] border border-[#050505]/10 bg-white px-4 py-3 text-[14px] text-[#050505] outline-none focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[13px] font-bold text-[#050505]">
              {accountT(t, "settings.accountRequestDetails", "Additional details (optional)")}
            </span>
            <textarea
              maxLength={2000}
              value={customerDetails}
              onChange={(event) => setCustomerDetails(event.target.value)}
              className="min-h-[76px] w-full resize-y rounded-[12px] border border-[#050505]/10 bg-white px-4 py-3 text-[14px] text-[#050505] outline-none focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10"
            />
          </label>
          {isDelete ? (
            <label className="block rounded-[14px] border border-[#F44336]/20 bg-[#F44336]/[0.05] p-4">
              <span className="block text-[13px] font-bold text-[#050505]">
                {accountT(t, "settings.typeDeleteConfirmation", "Type DELETE to confirm this reviewed deletion request.")}
              </span>
              <input
                value={confirmationText}
                onChange={(event) => setConfirmationText(event.target.value)}
                autoComplete="off"
                className={cn(inputClassName, "mt-3")}
              />
            </label>
          ) : (
            <label className="flex items-start gap-3 rounded-[14px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] p-4">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--xd-gold-active)]"
              />
              <span className="text-[13px] font-semibold leading-5 text-[#5F5F5F]">
                {accountT(t, "settings.confirmDeactivationRequest", "I understand that my account becomes inaccessible only after an administrator approves and completes this request.")}
              </span>
            </label>
          )}
        </div>
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            variant="tertiary"
            size="sm"
            className="h-11 px-5 text-[14px]"
          >
            {accountT(t, "common.cancel", "Cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => onConfirm({ customerReason, customerDetails })}
            disabled={!canSubmit || isSubmitting}
            variant="destructive"
            size="sm"
            className="h-11 px-6 text-[14px]"
          >
            {isSubmitting
              ? accountT(t, "common.saving", "Saving...")
              : isDelete
              ? accountT(t, "settings.requestDeletion", "Request Deletion")
              : accountT(t, "settings.requestDeactivation", "Request Deactivation")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AccountSettings() {
  const { direction, language, t } = useLanguage();
  const [, navigate] = useLocation();
  const {
    currentUser,
    signOut: setSignedOut,
    changeLanguage,
  } = useStore();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [pendingAccountAction, setPendingAccountAction] = useState<AccountAction | null>(null);
  const [isSubmittingAccountAction, setIsSubmittingAccountAction] = useState(false);
  const [preferences, setPreferences] = useState<AccountPreferences | null>(null);
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [accountActionRequests, setAccountActionRequests] = useState<AccountActionRequest[]>([]);
  const [legacyCurrentSession, setLegacyCurrentSession] = useState(false);
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);
  const [settingsLoadError, setSettingsLoadError] = useState<string | null>(null);
  const [savingPreferences, setSavingPreferences] = useState<Set<keyof AccountPreferences>>(
    () => new Set()
  );
  const [sessionAction, setSessionAction] = useState<string | null>(null);
  const settingsRequestId = useRef(0);

  const loadSettings = useCallback(async (signal?: AbortSignal) => {
    const requestId = ++settingsRequestId.current;
    setIsSettingsLoading(true);
    setSettingsLoadError(null);
    try {
      const [preferenceResult, sessionResult, actionRequests] = await Promise.all([
        getAccountPreferences(signal),
        getAccountSessions(signal),
        getAccountActionRequests(signal),
      ]);
      if (requestId !== settingsRequestId.current) return;
      setPreferences(preferenceResult.preferences);
      setSessions(sessionResult.sessions);
      setAccountActionRequests(actionRequests);
      setLegacyCurrentSession(sessionResult.legacyCurrentSession);
    } catch (error) {
      if (signal?.aborted || requestId !== settingsRequestId.current) return;
      setSettingsLoadError(
        error instanceof ApiError && error.status !== 0
          ? error.message
          : accountT(
              t,
              "settings.loadFailed",
              "Your settings could not be loaded. Please try again."
            )
      );
    } finally {
      if (requestId === settingsRequestId.current) {
        setIsSettingsLoading(false);
      }
    }
  }, [currentUser?.id]);

  useEffect(() => {
    const controller = new AbortController();
    void loadSettings(controller.signal);
    return () => {
      settingsRequestId.current += 1;
      controller.abort();
    };
  }, [loadSettings]);

  useEffect(() => {
    setPreferences((current) =>
      current && current.language !== language
        ? { ...current, language }
        : current
    );
  }, [language]);

  const saveBooleanPreference = async (key: BooleanPreferenceKey) => {
    if (!preferences || savingPreferences.has(key)) return;
    const previous = preferences;
    const nextValue = !preferences[key];
    setPreferences({ ...preferences, [key]: nextValue });
    setSavingPreferences((current) => new Set(current).add(key));
    setStatusMessage(null);
    try {
      const result = await updateAccountPreferences({ [key]: nextValue });
      setPreferences(result.preferences);
    } catch {
      setPreferences(previous);
      setStatusMessage(
        accountT(
          t,
          "settings.saveFailed",
          "Your preference could not be saved. Please try again."
        )
      );
    } finally {
      setSavingPreferences((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };

  const saveLanguage = async (nextLanguage: "en" | "ar") => {
    if (!preferences || savingPreferences.has("language") || nextLanguage === language) {
      return;
    }
    const previous = preferences;
    setPreferences({ ...preferences, language: nextLanguage });
    setSavingPreferences((current) => new Set(current).add("language"));
    setStatusMessage(null);
    const saved = await changeLanguage(nextLanguage);
    if (!saved) {
      setPreferences(previous);
      setStatusMessage(
        accountT(
          t,
          "settings.saveFailed",
          "Your preference could not be saved. Please try again."
        )
      );
    }
    setSavingPreferences((current) => {
      const next = new Set(current);
      next.delete("language");
      return next;
    });
  };

  const signOut = () => {
    setStatusMessage(null);
    setSignedOut();
    navigate("/signin");
  };

  const revokeSession = async (session: AccountSession) => {
    if (session.isCurrent || sessionAction) return;
    setSessionAction(session.id);
    setStatusMessage(null);
    try {
      await revokeAccountSession(session.id);
      setSessions((current) => current.filter((item) => item.id !== session.id));
      setStatusMessage(
        accountT(t, "settings.sessionRevoked", "The selected device was signed out.")
      );
    } catch (error) {
      setStatusMessage(
        error instanceof ApiError && error.status !== 0
          ? error.message
          : accountT(t, "settings.sessionActionFailed", "The session could not be signed out.")
      );
    } finally {
      setSessionAction(null);
    }
  };

  const signOutOtherDevices = async () => {
    if (sessionAction || legacyCurrentSession) return;
    setSessionAction("others");
    setStatusMessage(null);
    try {
      const result = await logoutOtherAccountSessions();
      setSessions((current) => current.filter((session) => session.isCurrent));
      setStatusMessage(
        accountT(
          t,
          "settings.otherSessionsRevoked",
          "{count} other device(s) signed out.",
          { count: result.revokedCount }
        )
      );
    } catch (error) {
      setStatusMessage(
        error instanceof ApiError && error.status !== 0
          ? error.message
          : accountT(t, "settings.sessionActionFailed", "The sessions could not be signed out.")
      );
    } finally {
      setSessionAction(null);
    }
  };

  const confirmAccountAction = async (input: {
    customerReason: string;
    customerDetails: string;
  }) => {
    if (!pendingAccountAction || isSubmittingAccountAction) return;

    const isDelete = pendingAccountAction === "delete";
    setIsSubmittingAccountAction(true);
    try {
      const result = await createAccountActionRequest({
        type: isDelete ? "DELETION" : "DEACTIVATION",
        customerReason: input.customerReason,
        customerDetails: input.customerDetails,
        confirmation: isDelete ? "DELETE" : "DEACTIVATE",
      });
      setAccountActionRequests((current) => {
        const withoutExisting = current.filter((item) => item.id !== result.request.id);
        return [result.request, ...withoutExisting];
      });
      setStatusMessage(
        result.created
          ? accountT(
              t,
              "settings.accountRequestSubmitted",
              "Your account request was submitted for administrator review."
            )
          : accountT(
              t,
              "settings.accountRequestAlreadyActive",
              "An active request of this type already exists. Its current status is shown below."
            )
      );
      setPendingAccountAction(null);
    } catch (error) {
      setStatusMessage(
        accountT(
          t,
          "settings.accountActionFailed",
          "The request could not be submitted. Please try again."
        )
      );
    } finally {
      setIsSubmittingAccountAction(false);
    }
  };

  const cancelAccountRequest = async (accountRequest: AccountActionRequest) => {
    if (!accountRequest.canCancel || isSubmittingAccountAction) return;
    setIsSubmittingAccountAction(true);
    setStatusMessage(null);
    try {
      const updated = await cancelAccountActionRequest(accountRequest.id);
      setAccountActionRequests((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      setStatusMessage(
        accountT(t, "settings.accountRequestCanceled", "Your account request was canceled.")
      );
    } catch (error) {
      setStatusMessage(
        accountT(t, "settings.accountActionFailed", "The request could not be updated.")
      );
    } finally {
      setIsSubmittingAccountAction(false);
    }
  };

  return (
    <div className="bg-[var(--xd-bg)] pb-14 pt-10 lg:pb-20 lg:pt-14">
      <Container className="overflow-x-clip">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:gap-7">
          <AccountSidebar onLogout={signOut} />

          <main className="space-y-8">
            <div>
              <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--xd-gold-active)]">
                {accountT(t, "settings.eyebrow", "Account Control")}
              </p>
              <h1 className="font-display text-[36px] font-bold leading-none text-[#050505] sm:text-[44px]">
                {accountT(t, "settings.title", "Settings")}
              </h1>
              <p className="mt-4 max-w-[780px] text-[15px] leading-6 text-[#8A8D9A]">
                {accountT(t, "settings.description", "Manage your account preferences, security, notifications, language, and privacy options.")}
              </p>
            </div>

            {statusMessage && (
              <div
                role="status"
                className="rounded-[14px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-active)]/[0.08] px-4 py-3 text-[13px] font-semibold text-[#5F5F5F]"
              >
                {statusMessage}
              </div>
            )}

            {isSettingsLoading && (
              <div
                role="status"
                className="flex min-h-[180px] items-center justify-center rounded-[24px] border border-[var(--xd-gold-border-soft)] bg-white/80 text-[14px] font-semibold text-[#717182]"
              >
                {accountT(t, "common.loading", "Loading...")}
              </div>
            )}

            {!isSettingsLoading && settingsLoadError && (
              <div
                role="alert"
                className="rounded-[24px] border border-[#F44336]/20 bg-[#F44336]/[0.06] p-6"
              >
                <p className="text-[14px] font-semibold text-[#B42318]">{settingsLoadError}</p>
                <Button
                  type="button"
                  onClick={() => void loadSettings()}
                  variant="secondary"
                  size="sm"
                  className="mt-4 h-10 gap-2 px-4 text-[13px]"
                >
                  <RefreshCw size={15} />
                  {accountT(t, "common.retry", "Retry")}
                </Button>
              </div>
            )}

            {!isSettingsLoading && !settingsLoadError && preferences && (
            <div className="grid gap-6 xl:grid-cols-2">
              <SettingsCard
                icon={LockKeyhole}
                title={accountT(t, "settings.passwordSecurity", "Password & Security")}
                subtitle={accountT(t, "settings.passwordSecurityDescription", "Manage your password, active sessions, and account protection.")}
              >
                <div className="space-y-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[14px] font-bold text-[#050505]">
                        {accountT(t, "settings.password", "Password")}
                      </p>
                      <p className="mt-1 text-[12px] text-[#8A8D9A]">
                        {accountT(t, "settings.passwordAdvice", "Use a strong password that you do not use anywhere else.")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => setIsPasswordModalOpen(true)}
                      variant="secondary"
                      size="sm"
                      className="h-10 px-5 text-[13px] text-[var(--xd-gold-text)]"
                    >
                      {accountT(t, "settings.changePassword", "Change Password")}
                    </Button>
                  </div>

                  <div className="h-px bg-[#050505]/[0.07]" />

                  <div>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-[14px] font-bold text-[#050505]">
                          {accountT(t, "settings.activeSessions", "Active Sessions")}
                        </p>
                        <p className="mt-1 max-w-[340px] text-[12px] leading-5 text-[#8A8D9A]">
                          {accountT(t, "settings.activeSessionsDescription", "Review signed-in devices and revoke access immediately.")}
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={() => void signOutOtherDevices()}
                        variant="secondary"
                        size="sm"
                        disabled={
                          Boolean(sessionAction)
                          || legacyCurrentSession
                          || sessions.every((session) => session.isCurrent)
                        }
                        className="h-10 border-[#F44336]/25 px-4 text-[12px] text-[#F44336] hover:bg-[#F44336]/[0.04] focus-visible:ring-[#F44336]/30"
                      >
                        {sessionAction === "others"
                          ? accountT(t, "common.saving", "Saving...")
                          : accountT(t, "settings.signOutOtherDevices", "Sign Out Other Devices")}
                      </Button>
                    </div>

                    {legacyCurrentSession && (
                      <p className="mt-4 rounded-[12px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] px-3 py-2 text-[12px] leading-5 text-[var(--xd-gold-text)]">
                        {accountT(
                          t,
                          "settings.legacySessionNotice",
                          "This development session predates secure session tracking. Sign in again once to manage all devices."
                        )}
                      </p>
                    )}

                    <div className="mt-4 space-y-3">
                      {sessions.length === 0 ? (
                        <p className="text-[12px] text-[#8A8D9A]">
                          {accountT(t, "settings.noTrackedSessions", "No tracked sessions are available yet.")}
                        </p>
                      ) : (
                        sessions.map((session) => (
                          <div
                            key={session.id}
                            className="flex flex-col gap-3 rounded-[14px] border border-[#050505]/[0.08] bg-[var(--xd-bg)] p-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex min-w-0 gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-active)]">
                                <MonitorSmartphone size={16} />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-[13px] font-bold text-[#050505]">
                                  {session.deviceSummary}
                                  {session.isCurrent && (
                                    <span className="ms-2 text-[11px] text-[var(--xd-gold-text)]">
                                      {accountT(t, "settings.thisDevice", "This device")}
                                    </span>
                                  )}
                                </p>
                                <p className="mt-1 text-[11px] leading-4 text-[#8A8D9A]">
                                  {accountT(t, "settings.lastActive", "Last active")}:{" "}
                                  {formatSessionDate(session.lastSeenAt, language)}
                                </p>
                              </div>
                            </div>
                            {!session.isCurrent && (
                              <Button
                                type="button"
                                onClick={() => void revokeSession(session)}
                                variant="tertiary"
                                size="sm"
                                disabled={Boolean(sessionAction)}
                                className="h-9 border border-[#F44336]/20 px-3 text-[12px] text-[#F44336] hover:bg-[#F44336]/[0.04]"
                              >
                                {sessionAction === session.id
                                  ? accountT(t, "common.saving", "Saving...")
                                  : accountT(t, "settings.signOut", "Sign Out")}
                              </Button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </SettingsCard>

              <SettingsCard
                icon={Bell}
                title={accountT(t, "settings.notificationPreferences", "Notification Preferences")}
                subtitle={accountT(t, "settings.notificationPreferencesDescription", "Choose which account updates you want to receive.")}
              >
                <div className="space-y-4">
                  <ToggleRow
                    label={accountT(t, "settings.orderUpdates", "Order Updates")}
                    checked={preferences.orderUpdates}
                    onToggle={() => void saveBooleanPreference("orderUpdates")}
                    disabled={savingPreferences.has("orderUpdates")}
                  />
                  <ToggleRow
                    label={accountT(t, "settings.quoteUpdates", "Quote Updates")}
                    checked={preferences.quoteUpdates}
                    onToggle={() => void saveBooleanPreference("quoteUpdates")}
                    disabled={savingPreferences.has("quoteUpdates")}
                  />
                  <ToggleRow
                    label={accountT(t, "settings.productRequestUpdates", "Product Request Updates")}
                    checked={preferences.productRequestUpdates}
                    onToggle={() => void saveBooleanPreference("productRequestUpdates")}
                    disabled={savingPreferences.has("productRequestUpdates")}
                  />
                  <ToggleRow
                    label={accountT(t, "settings.backInStockAlerts", "Back-in-Stock Alerts")}
                    checked={preferences.backInStockUpdates}
                    onToggle={() => void saveBooleanPreference("backInStockUpdates")}
                    disabled={savingPreferences.has("backInStockUpdates")}
                  />
                  <ToggleRow
                    label={accountT(t, "settings.supportReplies", "Support Replies")}
                    checked={preferences.supportReplyUpdates}
                    onToggle={() => void saveBooleanPreference("supportReplyUpdates")}
                    disabled={savingPreferences.has("supportReplyUpdates")}
                  />
                  <p className="pt-2 text-[12px] text-[#8A8D9A]">
                    {accountT(t, "settings.notificationPreferenceNote", "These choices apply to future optional notifications. Security alerts always remain enabled.")}
                  </p>
                  <Button
                    type="button"
                    onClick={() => navigate("/account/notifications")}
                    variant="secondary"
                    size="sm"
                    className="mt-2 h-11 w-full text-[13px] text-[var(--xd-gold-text)]"
                  >
                    {accountT(t, "settings.manageNotifications", "Manage Notifications")}
                  </Button>
                </div>
              </SettingsCard>

              <SettingsCard
                icon={Globe}
                title={accountT(t, "settings.languageRegion", "Language & Region")}
                subtitle={accountT(t, "settings.languageRegionDescription", "Set your preferred language, country, and shopping currency.")}
              >
                <div className="space-y-5">
                  <div className="block">
                    <span className="mb-2 block text-[13px] font-bold text-[#050505]">
                      {accountT(t, "settings.language", "Language")}
                    </span>
                    <DentalSelect
                      label={accountT(t, "settings.language", "Language")}
                      value={language}
                      onChange={(value) => void saveLanguage(value as "en" | "ar")}
                      options={languageOptions}
                      disabled={savingPreferences.has("language")}
                      dir={direction}
                      triggerClassName="h-12 rounded-[12px] border-[var(--xd-gold-border-soft)] bg-[var(--xd-surface)] px-4 text-[14px] text-[var(--xd-text)] shadow-[0_6px_18px_rgba(5,5,5,0.03)] hover:border-[var(--xd-gold-border-hover)] focus:border-[var(--xd-gold-border-hover)] focus:ring-[var(--xd-gold-focus-ring)] disabled:cursor-wait disabled:opacity-70 [&>svg]:text-[var(--xd-gold-active)]"
                      contentClassName="z-[100] rounded-[14px] border-[var(--xd-gold-border-soft)] bg-[var(--xd-surface)] text-[var(--xd-text)] shadow-[0_18px_44px_rgba(5,5,5,0.16)]"
                      itemClassName="text-[var(--xd-text-muted)] focus:bg-[var(--xd-gold-bg-soft)] focus:text-[var(--xd-text)] data-[state=checked]:bg-[var(--xd-gold-bg-soft)] data-[state=checked]:text-[var(--xd-gold-text)]"
                    />
                  </div>
                  <LabeledInput
                    label={accountT(t, "settings.country", "Country")}
                    value={accountValue(t, preferences.country)}
                    disabled
                  />
                  <LabeledInput
                    label={accountT(t, "settings.currency", "Currency")}
                    value={accountValue(t, "EGP (Egyptian Pound)")}
                    disabled
                  />
                </div>
              </SettingsCard>

              <SettingsCard
                icon={Shield}
                title={accountT(t, "settings.privacyPreferences", "Privacy Preferences")}
                subtitle={accountT(t, "settings.privacyPreferencesDescription", "Manage how your data is used for recommendations and account support.")}
              >
                <div className="space-y-4">
                  <ToggleRow
                    label={accountT(t, "settings.personalizedRecommendations", "Personalized product recommendations")}
                    checked={preferences.personalizedRecommendations}
                    onToggle={() => void saveBooleanPreference("personalizedRecommendations")}
                    disabled={savingPreferences.has("personalizedRecommendations")}
                  />
                  <ToggleRow
                    label={accountT(t, "settings.saveBrowsingActivity", "Save browsing and wishlist activity")}
                    checked={preferences.saveBrowsingActivity}
                    onToggle={() => void saveBooleanPreference("saveBrowsingActivity")}
                    disabled={savingPreferences.has("saveBrowsingActivity")}
                  />
                  <ToggleRow
                    label={accountT(t, "settings.useOrderHistory", "Use order history for reorder suggestions")}
                    checked={preferences.useOrderHistoryForSuggestions}
                    onToggle={() => void saveBooleanPreference("useOrderHistoryForSuggestions")}
                    disabled={savingPreferences.has("useOrderHistoryForSuggestions")}
                  />
                  <p className="pt-2 text-[12px] text-[#8A8D9A]">
                    {accountT(t, "settings.privacyPreferenceNote", "Your choices are saved now. Personalized recommendation features will use them when those features are introduced.")}
                  </p>
                </div>
              </SettingsCard>

              <SettingsCard
                icon={Mail}
                title={accountT(t, "settings.communicationPreferences", "Communication Preferences")}
                subtitle={accountT(t, "settings.communicationPreferencesDescription", "Control marketing and service messages from X Dental Store.")}
              >
                <div className="space-y-4">
                  <ToggleRow
                    label={accountT(t, "settings.weeklyOffers", "Weekly offers")}
                    checked={preferences.weeklyOffers}
                    onToggle={() => void saveBooleanPreference("weeklyOffers")}
                    disabled={savingPreferences.has("weeklyOffers")}
                  />
                  <ToggleRow
                    label={accountT(t, "settings.newArrivals", "New arrivals")}
                    checked={preferences.newArrivals}
                    onToggle={() => void saveBooleanPreference("newArrivals")}
                    disabled={savingPreferences.has("newArrivals")}
                  />
                  <ToggleRow
                    label={accountT(t, "settings.clinicSupplyDeals", "Clinic supply deals")}
                    checked={preferences.clinicSupplyOffers}
                    onToggle={() => void saveBooleanPreference("clinicSupplyOffers")}
                    disabled={savingPreferences.has("clinicSupplyOffers")}
                  />
                  <ToggleRow
                    label={accountT(t, "settings.backInStockAlertsLower", "Back-in-stock alerts")}
                    checked={preferences.marketingBackInStock}
                    onToggle={() => void saveBooleanPreference("marketingBackInStock")}
                    disabled={savingPreferences.has("marketingBackInStock")}
                  />
                  <p className="pt-2 text-[12px] text-[#8A8D9A]">
                    {accountT(t, "settings.marketingConsentNote", "Marketing messages are off until you explicitly opt in. Transactional and support messages are separate.")}
                  </p>
                </div>
              </SettingsCard>
            </div>
            )}

            <SettingsCard
              icon={TriangleAlert}
              title={accountT(t, "settings.accountActions", "Account Actions")}
              subtitle={accountT(t, "settings.accountActionsDescription", "Manage sensitive account actions.")}
              className="xl:col-span-2"
            >
              {accountActionRequests.length > 0 && (
                <div className="mb-6 space-y-3">
                  <p className="text-[13px] font-bold text-[#050505]">
                    {accountT(t, "settings.accountRequestHistory", "Your account requests")}
                  </p>
                  {accountActionRequests.map((accountRequest) => (
                    <article
                      key={accountRequest.id}
                      className="rounded-[16px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-bg)] p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[13px] font-bold text-[#050505]">
                              {accountRequest.publicRequestNumber}
                            </span>
                            <span className="rounded-full border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--xd-gold-text)]">
                              {accountRequestStatusLabel(t, accountRequest.status)}
                            </span>
                          </div>
                          <p className="mt-2 text-[13px] font-semibold text-[#5F5F5F]">
                            {accountRequestTypeLabel(t, accountRequest.type)}
                          </p>
                          <p className="mt-1 text-[12px] text-[#8A8D9A]">
                            {new Intl.DateTimeFormat(
                              language === "ar" ? "ar-EG" : "en-EG",
                              { dateStyle: "medium", timeStyle: "short" }
                            ).format(new Date(accountRequest.submittedAt))}
                          </p>
                        </div>
                        {accountRequest.canCancel && (
                          <Button
                            type="button"
                            onClick={() => void cancelAccountRequest(accountRequest)}
                            disabled={isSubmittingAccountAction}
                            variant="tertiary"
                            size="sm"
                            className="h-9 border border-[#F44336]/20 px-4 text-[12px] text-[#F44336] hover:bg-[#F44336]/[0.04]"
                          >
                            {accountT(t, "settings.cancelAccountRequest", "Cancel request")}
                          </Button>
                        )}
                      </div>
                      {accountRequest.status === "APPROVED" && (
                        <div
                          className="mt-3 rounded-[12px] border border-[#D4A72C]/30 bg-[#FFF9E8] px-3 py-2.5 text-[12px] font-semibold leading-5 text-[#705A16] dark:bg-[#D4A72C]/10 dark:text-[#F2D77B]"
                          role="status"
                        >
                          {accountT(
                            t,
                            `settings.${approvedCustomerExplanationTranslationKey(accountRequest.type)}`,
                            accountRequest.type === "DELETION"
                              ? "Your deletion request is approved and awaiting a separate completion step. Your account has not been deleted yet."
                              : "Your deactivation request is approved and awaiting a separate completion step. Your account is still active until that step is completed."
                          )}
                        </div>
                      )}
                      {accountRequest.status === "COMPLETED"
                        && accountRequest.type === "DEACTIVATION" && (
                          <div
                            className="mt-3 rounded-[12px] border border-[#D4A72C]/30 bg-[#FFF9E8] px-3 py-3 text-[12px] font-semibold leading-5 text-[#705A16] dark:bg-[#D4A72C]/10 dark:text-[#F2D77B]"
                            role="status"
                          >
                            <p>
                              {accountT(
                                t,
                                "settings.completedDeactivationExplanation",
                                "Your account has been deactivated. To restore access, contact X Dental Store support. An administrator must review and reactivate the account. You will need to sign in again after reactivation."
                              )}
                            </p>
                            <Link
                              href="/contact?topic=account-access"
                              className="mt-2 inline-flex rounded-lg border border-[#D4A72C]/35 bg-white px-3 py-2 text-xs font-black text-[#705A16] transition hover:border-[#D4A72C] hover:bg-[#FFF4C7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A72C]/40 dark:bg-white/[0.06] dark:text-[#F2D77B]"
                            >
                              {accountT(
                                t,
                                "settings.accountAccessHelp",
                                "Account Access Help"
                              )}
                            </Link>
                          </div>
                        )}
                      {accountRequest.customerResponse && (
                        <div className="mt-3 rounded-[12px] bg-white/70 px-3 py-2">
                          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#8A8D9A]">
                            {accountT(t, "settings.reviewerResponse", "Reviewer response")}
                          </p>
                          <p className="mt-1 text-[13px] leading-5 text-[#5F5F5F]">
                            {accountRequest.customerResponse}
                          </p>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-3 border-t border-[#050505]/[0.07] pt-5">
                <Button
                  type="button"
                  onClick={() => setPendingAccountAction("deactivate")}
                  disabled={accountActionRequests.some(
                    (item) =>
                      item.type === "DEACTIVATION"
                      && ["PENDING", "UNDER_REVIEW", "APPROVED"].includes(item.status)
                  )}
                  variant="secondary"
                  size="sm"
                  className="h-11 px-5 text-[13px] text-[#717182]"
                >
                  {accountT(t, "settings.deactivateAccount", "Deactivate Account")}
                </Button>
                <Button
                  type="button"
                  onClick={() => setPendingAccountAction("delete")}
                  disabled={accountActionRequests.some(
                    (item) =>
                      item.type === "DELETION"
                      && ["PENDING", "UNDER_REVIEW", "APPROVED"].includes(item.status)
                  )}
                  variant="secondary"
                  size="sm"
                  className="h-11 border-[#F44336]/25 px-5 text-[13px] text-[#F44336] hover:bg-[#F44336]/[0.04] focus-visible:ring-[#F44336]/30"
                >
                  {accountT(t, "settings.deleteAccount", "Delete Account")}
                </Button>
              </div>
            </SettingsCard>
          </main>
        </div>
      </Container>

      {isPasswordModalOpen && (
        <ChangePasswordModal
          onClose={() => setIsPasswordModalOpen(false)}
          onSave={(signedOutOtherSessions) => {
            setIsPasswordModalOpen(false);
            void loadSettings();
            setStatusMessage(
              accountT(
                t,
                "settings.passwordChanged",
                "Password changed successfully. {count} other device(s) were signed out.",
                { count: signedOutOtherSessions }
              )
            );
          }}
        />
      )}

      {pendingAccountAction && (
        <AccountActionModal
          action={pendingAccountAction}
          onClose={() => setPendingAccountAction(null)}
          onConfirm={confirmAccountAction}
          isSubmitting={isSubmittingAccountAction}
        />
      )}
    </div>
  );
}
