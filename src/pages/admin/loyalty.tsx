import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { CircleDollarSign, Coins, History, Search, Settings2 } from "lucide-react";
import { AdminLayout } from "./_components/AdminLayout";
import { useLanguage } from "@/context/LanguageContext";
import { formatCurrency } from "@/utils";
import {
  adjustAdminCustomerPoints,
  adjustAdminCustomerWallet,
  getAdminLoyaltyCustomer,
  getAdminLoyaltyCustomers,
  getAdminLoyaltySettings,
  updateAdminLoyaltySettings,
  type AdminLoyaltyCustomer,
  type AdminLoyaltyCustomerDetail,
} from "@/services/adminLoyalty";
import type { LoyaltyProgramSettings } from "@/services/account";
import { useStore } from "@/context/StoreContext";
import { DentalSelect } from "@/components/dental/Select";

const fieldClass = "mt-2 h-11 w-full rounded-xl border border-[#E8DFC6] bg-white px-3 text-sm text-[#050505] outline-none transition focus:border-[#D4A72C] focus:ring-2 focus:ring-[#F9DC5C]/30 dark:border-white/10 dark:bg-white/[0.04] dark:text-[#F7F2E6]";
const panelClass = "rounded-2xl border border-[#E8DFC6] bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.025]";

function createRequestKey() {
  return `loyalty-${crypto.randomUUID()}`;
}

export default function AdminLoyalty() {
  const { t, language } = useLanguage();
  const { currentUser } = useStore();
  const [customers, setCustomers] = useState<AdminLoyaltyCustomer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminLoyaltyCustomerDetail | null>(null);
  const [settings, setSettings] = useState<LoyaltyProgramSettings | null>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"customers" | "transactions" | "settings">("customers");
  const [points, setPoints] = useState("");
  const [pointsDirection, setPointsDirection] = useState<"ADD" | "REMOVE">("ADD");
  const [pointsReason, setPointsReason] = useState("");
  const [walletAmount, setWalletAmount] = useState("");
  const [walletType, setWalletType] = useState<"PROMOTIONAL_CREDIT" | "ADMIN_CREDIT" | "ADMIN_DEBIT" | "REFUND_CREDIT">("ADMIN_CREDIT");
  const [walletReason, setWalletReason] = useState("");
  const [approvalReference, setApprovalReference] = useState("");
  const [pointsConfirmed, setPointsConfirmed] = useState(false);
  const [walletConfirmed, setWalletConfirmed] = useState(false);
  const [settingsConfirmed, setSettingsConfirmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const canManage = currentUser?.role === "admin"
    || currentUser?.permissions?.includes("LOYALTY_MANAGE");

  const refreshCustomers = useCallback(() => {
    const controller = new AbortController();
    void getAdminLoyaltyCustomers(search, controller.signal)
      .then((rows) => {
        setCustomers(rows);
        setSelectedId((current) => current ?? rows[0]?.id ?? null);
      })
      .catch(() => setMessage(t("admin.loyalty.loadError", { fallback: "Loyalty data could not be loaded." })));
    return () => controller.abort();
  }, [search, t]);

  useEffect(() => refreshCustomers(), [refreshCustomers]);

  useEffect(() => {
    const controller = new AbortController();
    getAdminLoyaltySettings(controller.signal).then(setSettings).catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    const controller = new AbortController();
    getAdminLoyaltyCustomer(selectedId, controller.signal)
      .then(setDetail)
      .catch(() => setDetail(null));
    return () => controller.abort();
  }, [selectedId]);

  const recentActivity = useMemo(() => {
    if (!detail) return [];
    return [
      ...detail.pointTransactions.map((item) => ({
        id: item.id,
        date: item.createdAt,
        label: item.description,
        value: `${item.points > 0 ? "+" : ""}${item.points} pts`,
      })),
      ...detail.walletTransactions.map((item) => ({
        id: item.id,
        date: item.createdAt,
        label: item.description,
        value: `${item.amount > 0 ? "+" : ""}${formatCurrency(item.amount)}`,
      })),
    ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
  }, [detail]);

  const refreshSelected = async () => {
    if (!selectedId) return;
    const [customerDetail, rows] = await Promise.all([
      getAdminLoyaltyCustomer(selectedId),
      getAdminLoyaltyCustomers(search),
    ]);
    setDetail(customerDetail);
    setCustomers(rows);
  };

  const submitPoints = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedId || !pointsConfirmed || !canManage) return;
    setSaving(true);
    setMessage(null);
    try {
      await adjustAdminCustomerPoints(
        selectedId,
        { points: Number(points) * (pointsDirection === "REMOVE" ? -1 : 1), reason: pointsReason },
        createRequestKey()
      );
      setPoints("");
      setPointsReason("");
      setPointsConfirmed(false);
      await refreshSelected();
      setMessage(t("admin.loyalty.adjustmentSaved", { fallback: "Audited adjustment saved." }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("admin.loyalty.saveError", { fallback: "Adjustment could not be saved." }));
    } finally {
      setSaving(false);
    }
  };

  const submitWallet = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedId || !walletConfirmed || !canManage) return;
    setSaving(true);
    setMessage(null);
    try {
      await adjustAdminCustomerWallet(
        selectedId,
        {
          amount: walletAmount,
          adjustmentType: walletType,
          reason: walletReason,
          ...(walletType === "REFUND_CREDIT" ? { approvalReference } : {}),
        },
        createRequestKey()
      );
      setWalletAmount("");
      setWalletReason("");
      setApprovalReference("");
      setWalletConfirmed(false);
      await refreshSelected();
      setMessage(t("admin.loyalty.adjustmentSaved", { fallback: "Audited adjustment saved." }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("admin.loyalty.saveError", { fallback: "Adjustment could not be saved." }));
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault();
    if (!settings || !settingsConfirmed || !canManage) return;
    setSaving(true);
    setMessage(null);
    try {
      setSettings(await updateAdminLoyaltySettings(settings));
      setSettingsConfirmed(false);
      setMessage(t("admin.loyalty.settingsSaved", { fallback: "Loyalty settings saved." }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("admin.loyalty.saveError", { fallback: "Settings could not be saved." }));
    } finally {
      setSaving(false);
    }
  };

  const numberSetting = (key: keyof LoyaltyProgramSettings, label: string) => settings && (
    <label className="text-sm font-semibold text-[#4E4E4E] dark:text-[#D6D0C3]">
      {label}
      <input
        type="number"
        min="0"
        step={key === "redemptionValueEgp" || key === "maximumRedemptionPercent" ? "0.01" : "1"}
        value={String(settings[key])}
        disabled={!canManage}
        onChange={(event) => setSettings({ ...settings, [key]: Number(event.target.value) })}
        className={fieldClass}
      />
    </label>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#B88A44]">{t("admin.loyalty.eyebrow", { fallback: "Admin" })}</p>
          <h1 className="mt-2 text-3xl font-black text-[#050505] dark:text-[#F7F2E6]">{t("admin.loyalty.title", { fallback: "Loyalty & Wallet" })}</h1>
          <p className="mt-2 text-sm text-[#717182] dark:text-[#C6BEAE]">{t("admin.loyalty.description", { fallback: "Inspect immutable ledgers and create authorized, audited adjustments." })}</p>
        </header>

        {message && <div role="status" className="w-fit max-w-full rounded-xl border border-[#E8DFC6] bg-[#FFF9E8] px-4 py-3 text-sm font-semibold text-[#4E4E4E] dark:border-white/10 dark:bg-white/[0.04] dark:text-[#F7F2E6]">{message}</div>}

        <div role="tablist" aria-label={t("admin.loyalty.title", { fallback: "Loyalty & Wallet" })} className="flex w-full flex-wrap gap-2 rounded-[18px] border border-[#E8DFC6] bg-white/75 p-2 dark:border-white/10 dark:bg-white/[0.025]">
          {(["customers", "transactions", "settings"] as const).map((tab) => (
            <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)} className={`rounded-[12px] px-4 py-2.5 text-sm font-bold transition ${activeTab === tab ? "bg-[image:var(--xd-gold-gradient)] text-[#050505]" : "text-[#717182] hover:bg-[var(--xd-gold-bg-soft)] dark:text-[#C6BEAE]"}`}>
              {t(`admin.loyalty.tabs.${tab}`, { fallback: tab === "customers" ? "Customers" : tab === "transactions" ? "Transactions" : "Program Settings" })}
            </button>
          ))}
        </div>

        {activeTab === "customers" && <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <section className={panelClass}>
            <div className="relative">
              <Search size={17} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[#8A8D9A]" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("admin.loyalty.search", { fallback: "Search customers" })} className={`${fieldClass} mt-0 ps-10`} />
            </div>
            <div className="mt-4 space-y-2 pb-3 xl:max-h-[calc(100vh-310px)] xl:overflow-y-auto">
              {customers.map((customer) => (
                <button key={customer.id} type="button" onClick={() => setSelectedId(customer.id)} className={`w-full rounded-xl border p-3 text-start transition ${selectedId === customer.id ? "border-[#D4A72C] bg-[#FFF7D6] dark:bg-[#D4A72C]/15" : "border-[#E8DFC6] hover:border-[#D4A72C]/60 dark:border-white/10"}`}>
                  <p className="truncate text-sm font-bold text-[#050505] dark:text-[#F7F2E6]">{customer.name}</p>
                  <p className="mt-1 truncate text-xs text-[#717182] dark:text-[#C6BEAE]">{customer.email}</p>
                  <div className="mt-2 flex gap-3 text-[11px] font-semibold text-[#8A6510] dark:text-[#F2D24B]">
                    <span>{customer.availablePoints} pts</span>
                    <span>{formatCurrency(customer.walletBalance)}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <div className="min-w-0 space-y-6">
            {detail ? (
              <>
                <section className={panelClass}>
                  <h2 className="text-xl font-black text-[#050505] dark:text-[#F7F2E6]">{detail.customer.name}</h2>
                  <p className="mt-1 text-sm text-[#717182] dark:text-[#C6BEAE]">{detail.customer.email}</p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-[#FFF9E8] p-4 dark:bg-white/[0.04]"><Coins size={18} className="text-[#B88A44]" /><p className="mt-2 text-xs text-[#717182]">{t("admin.loyalty.availablePoints", { fallback: "Available points" })}</p><p className="mt-1 text-xl font-black dark:text-[#F7F2E6]">{detail.account.availablePoints}</p></div>
                    <div className="rounded-xl bg-[#FFF9E8] p-4 dark:bg-white/[0.04]"><History size={18} className="text-[#B88A44]" /><p className="mt-2 text-xs text-[#717182]">{t("admin.loyalty.pendingPoints", { fallback: "Pending points" })}</p><p className="mt-1 text-xl font-black dark:text-[#F7F2E6]">{detail.account.pendingPoints}</p></div>
                    <div className="rounded-xl bg-[#FFF9E8] p-4 dark:bg-white/[0.04]"><CircleDollarSign size={18} className="text-[#B88A44]" /><p className="mt-2 text-xs text-[#717182]">{t("admin.loyalty.walletBalance", { fallback: "Wallet balance" })}</p><p className="mt-1 text-xl font-black dark:text-[#F7F2E6]">{formatCurrency(detail.account.walletBalance)}</p></div>
                  </div>
                </section>

                {canManage ? <div className="grid gap-6 lg:grid-cols-2">
                  <form onSubmit={submitPoints} className={panelClass}>
                    <h2 className="font-black text-[#050505] dark:text-[#F7F2E6]">{t("admin.loyalty.pointsAdjustment", { fallback: "Points adjustment" })}</h2>
                    <p className="mt-1 text-xs leading-5 text-[#717182] dark:text-[#C6BEAE]">{t("admin.loyalty.pointsAdjustmentHelp", { fallback: "Add or remove loyalty points. Every adjustment is recorded in the customer ledger." })}</p>
                    <DentalSelect label={t("admin.loyalty.adjustmentType", { fallback: "Adjustment type" })} value={pointsDirection} onChange={(value) => setPointsDirection(value as "ADD" | "REMOVE")} options={[{ value: "ADD", label: t("admin.loyalty.add", { fallback: "Add points" }) }, { value: "REMOVE", label: t("admin.loyalty.remove", { fallback: "Remove points" }) }]} className="mt-4" />
                    <label className="mt-4 block text-sm font-semibold dark:text-[#D6D0C3]">{t("admin.loyalty.pointsAmount", { fallback: "Points amount" })}<input required min="1" type="number" step="1" value={points} onChange={(event) => setPoints(event.target.value)} className={fieldClass} /></label>
                    <label className="mt-4 block text-sm font-semibold dark:text-[#D6D0C3]">{t("admin.loyalty.reason", { fallback: "Reason" })}<textarea required value={pointsReason} onChange={(event) => setPointsReason(event.target.value)} className={`${fieldClass} h-24 py-3`} /></label>
                    <label className="mt-4 flex items-start gap-2 text-xs font-semibold text-[#5F5F5F] dark:text-[#D6D0C3]"><input type="checkbox" checked={pointsConfirmed} onChange={(event) => setPointsConfirmed(event.target.checked)} />{t("admin.loyalty.confirmAudit", { fallback: "I confirm this audited adjustment." })}</label>
                    <button disabled={!pointsConfirmed || saving} className="mt-4 rounded-full bg-[#F9DC5C] px-5 py-2.5 text-sm font-bold text-[#050505] disabled:opacity-50">{t("common.save", { fallback: "Save" })}</button>
                  </form>

                  <form onSubmit={submitWallet} className={panelClass}>
                    <h2 className="font-black text-[#050505] dark:text-[#F7F2E6]">{t("admin.loyalty.walletAdjustment", { fallback: "Wallet adjustment" })}</h2>
                    <p className="mt-1 text-xs leading-5 text-[#717182] dark:text-[#C6BEAE]">{t("admin.loyalty.walletAdjustmentHelp", { fallback: "Add or remove EGP-denominated store credit. This is separate from loyalty points." })}</p>
                    <DentalSelect label={t("admin.loyalty.type", { fallback: "Adjustment type" })} value={walletType} onChange={(value) => setWalletType(value as typeof walletType)} className="mt-4" options={[{ value: "ADMIN_CREDIT", label: t("admin.loyalty.walletTypes.adminCredit", { fallback: "Add store credit" }) }, { value: "PROMOTIONAL_CREDIT", label: t("admin.loyalty.walletTypes.promotionalCredit", { fallback: "Promotional credit" }) }, { value: "ADMIN_DEBIT", label: t("admin.loyalty.walletTypes.adminDebit", { fallback: "Remove store credit" }) }, { value: "REFUND_CREDIT", label: t("admin.loyalty.walletTypes.refundCredit", { fallback: "Approved refund credit" }) }]} />
                    <label className="mt-4 block text-sm font-semibold dark:text-[#D6D0C3]">{t("admin.loyalty.amount", { fallback: "Amount (EGP)" })}<input required type="number" min="0.01" step="0.01" value={walletAmount} onChange={(event) => setWalletAmount(event.target.value)} className={fieldClass} /></label>
                    {walletType === "REFUND_CREDIT" && <label className="mt-4 block text-sm font-semibold dark:text-[#D6D0C3]">{t("admin.loyalty.approvalReference", { fallback: "Approved refund reference" })}<input required value={approvalReference} onChange={(event) => setApprovalReference(event.target.value)} className={fieldClass} /></label>}
                    <label className="mt-4 block text-sm font-semibold dark:text-[#D6D0C3]">{t("admin.loyalty.reason", { fallback: "Reason" })}<textarea required value={walletReason} onChange={(event) => setWalletReason(event.target.value)} className={`${fieldClass} h-24 py-3`} /></label>
                    <label className="mt-4 flex items-start gap-2 text-xs font-semibold text-[#5F5F5F] dark:text-[#D6D0C3]"><input type="checkbox" checked={walletConfirmed} onChange={(event) => setWalletConfirmed(event.target.checked)} />{t("admin.loyalty.confirmAudit", { fallback: "I confirm this audited adjustment." })}</label>
                    <button disabled={!walletConfirmed || saving} className="mt-4 rounded-full bg-[#F9DC5C] px-5 py-2.5 text-sm font-bold text-[#050505] disabled:opacity-50">{t("common.save", { fallback: "Save" })}</button>
                  </form>
                </div> : (
                  <section className={panelClass}>{t("admin.loyalty.viewOnly", { fallback: "You have view-only loyalty access. A separate management permission is required for adjustments." })}</section>
                )}

                <section className={panelClass}>
                  <h2 className="flex items-center gap-2 font-black text-[#050505] dark:text-[#F7F2E6]"><History size={18} />{t("admin.loyalty.immutableHistory", { fallback: "Immutable transaction history" })}</h2>
                  <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead><tr className="border-b border-[#E8DFC6] text-start text-xs text-[#717182]"><th className="px-3 py-3 text-start">{t("admin.loyalty.date", { fallback: "Date" })}</th><th className="px-3 py-3 text-start">{t("admin.loyalty.descriptionLabel", { fallback: "Description" })}</th><th className="px-3 py-3 text-end">{t("admin.loyalty.value", { fallback: "Value" })}</th></tr></thead><tbody>{recentActivity.map((item) => <tr key={item.id} className="border-b border-[#E8DFC6]/70 dark:border-white/10"><td className="whitespace-nowrap px-3 py-3 text-[#717182]">{new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-GB").format(new Date(item.date))}</td><td className="px-3 py-3 font-semibold dark:text-[#F7F2E6]">{item.label}</td><td className="whitespace-nowrap px-3 py-3 text-end font-bold text-[#8A6510] dark:text-[#F2D24B]">{item.value}</td></tr>)}</tbody></table></div>
                </section>
              </>
            ) : <section className={panelClass}>{t("admin.loyalty.selectCustomer", { fallback: "Select a customer to inspect balances and history." })}</section>}

          </div>
        </div>}

        {activeTab === "transactions" && <section className={panelClass}>
          <h2 className="flex items-center gap-2 text-lg font-black text-[#050505] dark:text-[#F7F2E6]"><History size={19} />{t("admin.loyalty.transactions", { fallback: "Transactions" })}</h2>
          <p className="mt-1 text-sm text-[#717182] dark:text-[#C6BEAE]">{t("admin.loyalty.transactionsHelp", { fallback: "Select a customer in Customers to inspect their authorized points and store-credit history." })}</p>
          {detail ? <div className="mt-5 space-y-2">{recentActivity.map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E8DFC6] px-4 py-3 text-sm dark:border-white/10"><div><p className="font-bold text-[#050505] dark:text-[#F7F2E6]">{item.label}</p><p className="mt-1 text-xs text-[#717182] dark:text-[#C6BEAE]">{new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-GB").format(new Date(item.date))}</p></div><span className="font-bold text-[#8A6510] dark:text-[#F2D24B]">{item.value}</span></article>)}</div> : <p className="mt-5 text-sm text-[#717182]">{t("admin.loyalty.selectCustomer", { fallback: "Select a customer to inspect balances and history." })}</p>}
        </section>}

        {activeTab === "settings" && settings && (
              <form onSubmit={saveSettings} className={panelClass}>
                <h2 className="flex items-center gap-2 text-lg font-black text-[#050505] dark:text-[#F7F2E6]"><Settings2 size={19} />{t("admin.loyalty.settings", { fallback: "Loyalty Program Settings" })}</h2>
                <label className="mt-5 flex items-center gap-2 text-sm font-semibold dark:text-[#D6D0C3]"><input type="checkbox" disabled={!canManage} checked={settings.enabled} onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })} />{t("admin.loyalty.programEnabled", { fallback: "Program enabled" })}</label>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {numberSetting("standardPointsPerEgp10", t("admin.loyalty.standardRate", { fallback: "Standard points / EGP 10" }))}
                  {numberSetting("vipPointsPerEgp10", t("admin.loyalty.vipRate", { fallback: "VIP points / EGP 10" }))}
                  {numberSetting("pointsPerRedemptionUnit", t("admin.loyalty.pointsUnit", { fallback: "Points per redemption unit" }))}
                  {numberSetting("redemptionValueEgp", t("admin.loyalty.redemptionValue", { fallback: "Redemption unit value (EGP)" }))}
                  {numberSetting("welcomePoints", t("admin.loyalty.welcomePoints", { fallback: "Welcome points" }))}
                  {numberSetting("welcomeMinimumSubtotalEgp", t("admin.loyalty.welcomeMinimumSubtotal", { fallback: "Welcome minimum product subtotal (EGP)" }))}
                  {numberSetting("welcomeExpiryDays", t("admin.loyalty.welcomeExpiryDays", { fallback: "Welcome expiry (days)" }))}
                  {numberSetting("minimumRedemptionPoints", t("admin.loyalty.minimumPoints", { fallback: "Minimum redemption points" }))}
                  {numberSetting("maximumRedemptionPercent", t("admin.loyalty.maximumPercent", { fallback: "Maximum redemption (%)" }))}
                  {numberSetting("expiryMonths", t("admin.loyalty.expiryMonths", { fallback: "Expiry (months)" }))}
                </div>
                {canManage && <><label className="mt-5 flex items-start gap-2 text-xs font-semibold text-[#5F5F5F] dark:text-[#D6D0C3]"><input type="checkbox" checked={settingsConfirmed} onChange={(event) => setSettingsConfirmed(event.target.checked)} />{t("admin.loyalty.confirmSettings", { fallback: "I confirm these program-rule changes." })}</label>
                <button disabled={!settingsConfirmed || saving} className="mt-4 rounded-full bg-[#F9DC5C] px-5 py-2.5 text-sm font-bold text-[#050505] disabled:opacity-50">{t("common.save", { fallback: "Save" })}</button></>}
              </form>
            )}
      </div>
    </AdminLayout>
  );
}
