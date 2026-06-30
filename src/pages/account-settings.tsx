import { useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from "react";
import { useLocation } from "wouter";
import {
  Bell,
  Globe,
  LockKeyhole,
  Mail,
  Shield,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { Container } from "@/components/dental/Container";
import { AccountSidebar } from "@/components/dental/AccountSidebar";
import { Button } from "@/components/dental/Button";
import { useLanguage } from "@/context/LanguageContext";
import { useStore } from "@/context/StoreContext";
import { accountT, accountValue } from "@/lib/accountI18n";
import { cn } from "@/lib/utils";

type ToggleMap = Record<string, boolean>;
type AccountAction = "deactivate" | "delete";

const inputClassName =
  "h-12 w-full rounded-[12px] border border-[#050505]/10 bg-white px-4 text-[14px] text-[#050505] outline-none transition placeholder:text-[#B3B4BD] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10";

function Toggle({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onToggle}
      className={cn(
        "relative h-7 w-12 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)]",
        checked ? "bg-[var(--xd-gold-active)]" : "bg-[#D9D9D9]"
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
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[14px] font-bold text-[#050505]">{label}</span>
      <Toggle checked={checked} onToggle={onToggle} />
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

function ChangePasswordModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: () => void;
}) {
  const { t } = useLanguage();

  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (form.newPassword !== form.confirmPassword) {
      setError(accountT(t, "settings.passwordMismatch", "New password and confirmation do not match."));
      return;
    }

    if (form.newPassword.length < 8) {
      setError(accountT(t, "settings.passwordTooShort", "New password must be at least 8 characters."));
      return;
    }

    onSave();
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
            className="h-11 px-6 text-[14px]"
          >
            {accountT(t, "settings.savePassword", "Save Password")}
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
}: {
  action: AccountAction;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useLanguage();
  const isDelete = action === "delete";
  const title = isDelete
    ? accountT(t, "settings.deleteAccountQuestion", "Delete Account?")
    : accountT(t, "settings.deactivateAccountQuestion", "Deactivate Account?");
  const description = isDelete
    ? accountT(
        t,
        "settings.deleteAccountDescription",
        "This starts an account deletion request. Orders, quotes, supply lists, and saved data may no longer be available once the request is processed."
      )
    : accountT(
        t,
        "settings.deactivateAccountDescription",
        "This starts an account deactivation request. You can contact support later if you need the account restored."
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
            type="button"
            onClick={onConfirm}
            variant="destructive"
            size="sm"
            className="h-11 px-6 text-[14px]"
          >
            {isDelete
              ? accountT(t, "settings.requestDeletion", "Request Deletion")
              : accountT(t, "settings.requestDeactivation", "Request Deactivation")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AccountSettings() {
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const { signOut: setSignedOut } = useStore();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [pendingAccountAction, setPendingAccountAction] = useState<AccountAction | null>(null);
  const [notifications, setNotifications] = useState<ToggleMap>({
    orderUpdates: true,
    quoteUpdates: true,
    productRequests: true,
    stockAlerts: true,
    supportReplies: true,
  });
  const [privacy, setPrivacy] = useState<ToggleMap>({
    recommendations: true,
    browsingActivity: true,
    reorderSuggestions: true,
  });
  const [communication, setCommunication] = useState<ToggleMap>({
    weeklyOffers: true,
    newArrivals: true,
    supplyDeals: false,
    stockAlerts: true,
  });

  const toggle = (
    setter: Dispatch<SetStateAction<ToggleMap>>,
    key: string
  ) => {
    setter((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const signOut = () => {
    setStatusMessage(null);
    setSignedOut();
    navigate("/signin");
  };

  const confirmAccountAction = () => {
    if (!pendingAccountAction) return;

    setStatusMessage(
      pendingAccountAction === "delete"
        ? accountT(t, "settings.deletionSubmitted", "Account deletion request submitted.")
        : accountT(t, "settings.deactivationSubmitted", "Account deactivation request submitted.")
    );
    setPendingAccountAction(null);
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
                        {accountT(t, "settings.lastUpdated3Months", "Last updated 3 months ago")}
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

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[14px] font-bold text-[#050505]">
                        {accountT(t, "settings.activeSessions", "Active Sessions")}
                      </p>
                      <p className="mt-1 max-w-[320px] text-[12px] leading-5 text-[#8A8D9A]">
                        {accountT(t, "settings.activeSessionsDescription", "Sign out from other devices if you notice unusual activity.")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={signOut}
                      variant="secondary"
                      size="sm"
                      className="h-10 border-[#F44336]/25 px-5 text-[13px] text-[#F44336] hover:bg-[#F44336]/[0.04] focus-visible:ring-[#F44336]/30"
                    >
                      {accountT(t, "settings.signOut", "Sign Out")}
                    </Button>
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
                    checked={notifications.orderUpdates}
                    onToggle={() => toggle(setNotifications, "orderUpdates")}
                  />
                  <ToggleRow
                    label={accountT(t, "settings.quoteUpdates", "Quote Updates")}
                    checked={notifications.quoteUpdates}
                    onToggle={() => toggle(setNotifications, "quoteUpdates")}
                  />
                  <ToggleRow
                    label={accountT(t, "settings.productRequestUpdates", "Product Request Updates")}
                    checked={notifications.productRequests}
                    onToggle={() => toggle(setNotifications, "productRequests")}
                  />
                  <ToggleRow
                    label={accountT(t, "settings.backInStockAlerts", "Back-in-Stock Alerts")}
                    checked={notifications.stockAlerts}
                    onToggle={() => toggle(setNotifications, "stockAlerts")}
                  />
                  <ToggleRow
                    label={accountT(t, "settings.supportReplies", "Support Replies")}
                    checked={notifications.supportReplies}
                    onToggle={() => toggle(setNotifications, "supportReplies")}
                  />
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
                  <LabeledInput label={accountT(t, "settings.language", "Language")} value={accountValue(t, "English")} />
                  <LabeledInput label={accountT(t, "settings.country", "Country")} value={accountValue(t, "Egypt")} disabled />
                  <LabeledInput label={accountT(t, "settings.currency", "Currency")} value={accountValue(t, "EGP (Egyptian Pound)")} disabled />
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
                    checked={privacy.recommendations}
                    onToggle={() => toggle(setPrivacy, "recommendations")}
                  />
                  <ToggleRow
                    label={accountT(t, "settings.saveBrowsingActivity", "Save browsing and wishlist activity")}
                    checked={privacy.browsingActivity}
                    onToggle={() => toggle(setPrivacy, "browsingActivity")}
                  />
                  <ToggleRow
                    label={accountT(t, "settings.useOrderHistory", "Use order history for reorder suggestions")}
                    checked={privacy.reorderSuggestions}
                    onToggle={() => toggle(setPrivacy, "reorderSuggestions")}
                  />
                  <p className="pt-2 text-[12px] text-[#8A8D9A]">
                    {accountT(t, "settings.changePreferencesAnytime", "You can change these preferences at any time.")}
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
                    checked={communication.weeklyOffers}
                    onToggle={() => toggle(setCommunication, "weeklyOffers")}
                  />
                  <ToggleRow
                    label={accountT(t, "settings.newArrivals", "New arrivals")}
                    checked={communication.newArrivals}
                    onToggle={() => toggle(setCommunication, "newArrivals")}
                  />
                  <ToggleRow
                    label={accountT(t, "settings.clinicSupplyDeals", "Clinic supply deals")}
                    checked={communication.supplyDeals}
                    onToggle={() => toggle(setCommunication, "supplyDeals")}
                  />
                  <ToggleRow
                    label={accountT(t, "settings.backInStockAlertsLower", "Back-in-stock alerts")}
                    checked={communication.stockAlerts}
                    onToggle={() => toggle(setCommunication, "stockAlerts")}
                  />
                  <p className="pt-2 text-[12px] text-[#8A8D9A]">
                    {accountT(t, "settings.unsubscribeAnytime", "You can unsubscribe from marketing messages at any time.")}
                  </p>
                </div>
              </SettingsCard>
            </div>

            <SettingsCard
              icon={TriangleAlert}
              title={accountT(t, "settings.accountActions", "Account Actions")}
              subtitle={accountT(t, "settings.accountActionsDescription", "Manage sensitive account actions.")}
              className="xl:col-span-2"
            >
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={() => setPendingAccountAction("deactivate")}
                  variant="secondary"
                  size="sm"
                  className="h-11 px-5 text-[13px] text-[#717182]"
                >
                  {accountT(t, "settings.deactivateAccount", "Deactivate Account")}
                </Button>
                <Button
                  type="button"
                  onClick={() => setPendingAccountAction("delete")}
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
          onSave={() => {
            setIsPasswordModalOpen(false);
            setStatusMessage(accountT(t, "settings.passwordChanged", "Password changed successfully."));
          }}
        />
      )}

      {pendingAccountAction && (
        <AccountActionModal
          action={pendingAccountAction}
          onClose={() => setPendingAccountAction(null)}
          onConfirm={confirmAccountAction}
        />
      )}
    </div>
  );
}
