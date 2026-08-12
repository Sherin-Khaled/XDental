import { useEffect, useState } from "react";
import {
  CircleDollarSign,
  Clock3,
  Coins,
  Crown,
  Gift,
  History,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { AccountSidebar } from "@/components/dental/AccountSidebar";
import { Container } from "@/components/dental/Container";
import { useLanguage } from "@/context/LanguageContext";
import { accountT } from "@/lib/accountI18n";
import {
  getMyLoyalty,
  type CustomerLoyaltySummary,
  type LoyaltyPointTransaction,
  type WalletTransaction,
} from "@/services/account";
import { formatCurrency } from "@/utils";

function formatDate(value: string, language: string) {
  return new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function pointActivityLabel(
  transaction: LoyaltyPointTransaction,
  t: ReturnType<typeof useLanguage>["t"]
) {
  const labels: Record<LoyaltyPointTransaction["type"], string> = {
    WELCOME_PENDING: accountT(t, "wallet.activity.welcomePending", "Welcome points pending"),
    WELCOME_ACTIVATED: accountT(t, "wallet.activity.welcomeActivated", "Welcome points activated"),
    WELCOME_GRANTED: accountT(t, "wallet.activity.welcomeGranted", "Welcome points granted"),
    WELCOME_RESTORE: accountT(t, "wallet.activity.welcomeRestore", "Welcome points restored"),
    ORDER_EARN: accountT(t, "wallet.activity.orderEarn", "Points earned from order"),
    REDEMPTION: accountT(t, "wallet.activity.redemption", "Points redeemed"),
    RESTORE: accountT(t, "wallet.activity.restore", "Points restored"),
    REVERSAL: accountT(t, "wallet.activity.reversal", "Points reversed"),
    EXPIRATION: accountT(t, "wallet.activity.expiration", "Points expired"),
    ADMIN_ADJUSTMENT: accountT(t, "wallet.activity.adjustment", "Points adjustment"),
  };
  return labels[transaction.type];
}

function walletActivityLabel(
  transaction: WalletTransaction,
  t: ReturnType<typeof useLanguage>["t"]
) {
  const labels: Record<WalletTransaction["type"], string> = {
    REFUND_CREDIT: accountT(t, "wallet.activity.refundCredit", "Approved refund credit"),
    PROMOTIONAL_CREDIT: accountT(t, "wallet.activity.promotionalCredit", "Promotional store credit"),
    ADMIN_CREDIT: accountT(t, "wallet.activity.adminCredit", "Store credit added"),
    ADMIN_DEBIT: accountT(t, "wallet.activity.adminDebit", "Store credit adjustment"),
    ORDER_PAYMENT: accountT(t, "wallet.activity.orderPayment", "Wallet used on order"),
    RESTORE: accountT(t, "wallet.activity.walletRestore", "Wallet credit restored"),
  };
  return labels[transaction.type];
}

export default function AccountWallet() {
  const { t, language } = useLanguage();
  const [summary, setSummary] = useState<CustomerLoyaltySummary | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    getMyLoyalty(controller.signal)
      .then(setSummary)
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, []);

  const stats = summary
    ? [
        {
          icon: Coins,
          label: accountT(t, "wallet.availablePoints", "Available points"),
          value: summary.account.availablePoints.toLocaleString("en-US"),
        },
        {
          icon: Clock3,
          label: accountT(t, "wallet.pendingPoints", "Pending points"),
          value: summary.account.pendingPoints.toLocaleString("en-US"),
        },
        {
          icon: Gift,
          label: accountT(t, "wallet.rewardValue", "Reward value"),
          value: formatCurrency(summary.account.redeemablePointValue),
        },
        ...(summary.account.pendingPoints > 0 ? [{
          icon: Clock3,
          label: accountT(t, "wallet.pendingPoints", "Pending points"),
          value: summary.account.pendingPoints.toLocaleString("en-US"),
          detail: accountT(t, "wallet.pendingHelp", "Purchase points become available after delivery."),
        }] : []),
        {
          icon: CircleDollarSign,
          label: accountT(t, "wallet.storeCredit", "Store credit wallet"),
          value: formatCurrency(summary.account.walletBalance),
        },
      ].filter((stat, index) => !(index === 1 && summary.account.pendingPoints === 0))
    : [];

  return (
    <div className="bg-[var(--xd-bg)] pb-14 pt-10 lg:pb-20 lg:pt-14">
      <Container className="overflow-x-clip">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:gap-7">
          <AccountSidebar />

          <main className="min-w-0 space-y-7">
            <header>
              <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--xd-gold-active)]">
                {accountT(t, "wallet.eyebrow", "Rewards & Credit")}
              </p>
              <h1 className="font-display text-[34px] font-bold leading-tight text-[#050505] dark:text-[#F7F2E6] sm:text-[42px]">
                {accountT(t, "wallet.rewardsWalletTitle", "Rewards & Wallet")}
              </h1>
              <p className="mt-3 max-w-[720px] text-[14px] leading-6 text-[#717182] dark:text-[#C6BEAE]">
                {accountT(
                  t,
                  "wallet.realDescription",
                  "Track earned points and EGP-denominated store credit. Points are rewards for eligible checkout use and are not cash."
                )}
              </p>
            </header>

            {error && (
              <div role="alert" className="rounded-[16px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-700 dark:text-red-300">
                {accountT(t, "wallet.loadError", "Rewards information could not be loaded. Please try again.")}
              </div>
            )}

            {!summary && !error ? (
              <div role="status" className="rounded-[22px] border border-[var(--xd-gold-border-soft)] bg-white/70 p-8 text-sm font-semibold text-[#717182] dark:bg-white/[0.025] dark:text-[#C6BEAE]">
                {accountT(t, "wallet.loading", "Loading your rewards and wallet…")}
              </div>
            ) : summary ? (
              <>
                {!summary.settings.enabled && (
                  <div role="status" className="rounded-[16px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] px-4 py-3 text-sm font-semibold text-[#5F5F5F] dark:text-[#D6D0C3]">
                    {accountT(t, "wallet.temporarilyPaused", "Rewards redemption is temporarily paused. Your balances and history remain safe.")}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {stats.map(({ icon: Icon, label, value, detail }) => (
                    <section key={label} className="rounded-[22px] border border-[var(--xd-gold-border-soft)] bg-white/80 p-5 shadow-[0_12px_34px_rgba(5,5,5,0.04)] dark:bg-white/[0.025]">
                      <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-active)]">
                        <Icon size={18} aria-hidden="true" />
                      </span>
                      <p className="mt-4 text-[12px] font-semibold text-[#717182] dark:text-[#C6BEAE]">{label}</p>
                      <p className="mt-1 font-display text-[25px] font-bold text-[#050505] dark:text-[#F7F2E6]">{value}</p>
                      {detail && <p className="mt-1 text-[11px] leading-4 text-[#8A8D9A] dark:text-[#BDB6A8]">{detail}</p>}
                    </section>
                  ))}
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                  <section className="rounded-[24px] border border-[var(--xd-gold-border-soft)] bg-white/80 p-5 dark:bg-white/[0.025] sm:p-6">
                    <div className="flex items-center gap-3">
                      <History size={19} className="text-[var(--xd-gold-active)]" aria-hidden="true" />
                      <h2 className="text-[18px] font-bold text-[#050505] dark:text-[#F7F2E6]">
                        {accountT(t, "wallet.pointsActivity", "Points activity")}
                      </h2>
                    </div>
                    <div className="mt-5 space-y-3">
                      {summary.pointTransactions.length ? summary.pointTransactions.slice(0, 10).map((transaction) => (
                        <article key={transaction.id} className="flex items-center justify-between gap-4 rounded-[14px] border border-[#050505]/[0.06] px-4 py-3 dark:border-white/10">
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-[#050505] dark:text-[#F7F2E6]">{pointActivityLabel(transaction, t)}</p>
                            <p className="mt-1 text-[11px] text-[#8A8D9A] dark:text-[#BDB6A8]">{formatDate(transaction.createdAt, language)}{transaction.expiresAt ? ` · ${accountT(t, "wallet.expires", "Expires")} ${formatDate(transaction.expiresAt, language)}` : ""}</p>
                          </div>
                          <span className={`shrink-0 font-bold ${transaction.points > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-[#8A6510] dark:text-[#F2D24B]"}`}>
                            {transaction.points > 0 ? "+" : ""}{transaction.points.toLocaleString("en-US")}
                          </span>
                        </article>
                      )) : (
                        <p className="rounded-[14px] border border-dashed border-[var(--xd-gold-border-soft)] px-4 py-5 text-sm text-[#717182] dark:text-[#C6BEAE]">
                          {accountT(t, "wallet.noPointsActivity", "No points activity yet.")}
                        </p>
                      )}
                    </div>
                  </section>

                  <section className="rounded-[24px] border border-[var(--xd-gold-border-soft)] bg-white/80 p-5 dark:bg-white/[0.025] sm:p-6">
                    <div className="flex items-center gap-3">
                      <CircleDollarSign size={19} className="text-[var(--xd-gold-active)]" aria-hidden="true" />
                      <h2 className="text-[18px] font-bold text-[#050505] dark:text-[#F7F2E6]">
                        {accountT(t, "wallet.walletActivity", "Wallet activity")}
                      </h2>
                    </div>
                    <div className="mt-5 space-y-3">
                      {summary.walletTransactions.length ? summary.walletTransactions.slice(0, 10).map((transaction) => (
                        <article key={transaction.id} className="flex items-center justify-between gap-4 rounded-[14px] border border-[#050505]/[0.06] px-4 py-3 dark:border-white/10">
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-[#050505] dark:text-[#F7F2E6]">{walletActivityLabel(transaction, t)}</p>
                            <p className="mt-1 text-[11px] text-[#8A8D9A] dark:text-[#BDB6A8]">{formatDate(transaction.createdAt, language)}</p>
                          </div>
                          <span className={`shrink-0 font-bold ${transaction.amount > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-[#8A6510] dark:text-[#F2D24B]"}`}>
                            {transaction.amount > 0 ? "+" : ""}{formatCurrency(transaction.amount)}
                          </span>
                        </article>
                      )) : (
                        <p className="rounded-[14px] border border-dashed border-[var(--xd-gold-border-soft)] px-4 py-5 text-sm text-[#717182] dark:text-[#C6BEAE]">
                          {accountT(t, "wallet.noWalletActivity", "No wallet activity yet.")}
                        </p>
                      )}
                    </div>
                  </section>
                </div>

                {summary.account.pointsExpiringSoon > 0 && (
                  <div className="flex items-start gap-3 rounded-[18px] border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-900 dark:text-amber-200">
                    <Clock3 size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <p className="font-semibold">
                      {accountT(t, "wallet.expiringSoon", "{points} points expire within 30 days.", {
                        points: summary.account.pointsExpiringSoon.toLocaleString("en-US"),
                      })}
                    </p>
                  </div>
                )}

                <section className="rounded-[24px] border border-[var(--xd-gold-border-soft)] bg-white/80 p-6 dark:bg-white/[0.025] sm:p-7">
                  <div className="flex items-center gap-3">
                    {summary.customerTier === "vip" ? (
                      <Crown size={20} className="text-[var(--xd-gold-active)]" aria-hidden="true" />
                    ) : (
                      <Sparkles size={20} className="text-[var(--xd-gold-active)]" aria-hidden="true" />
                    )}
                    <h2 className="text-[18px] font-bold text-[#050505] dark:text-[#F7F2E6]">
                      {accountT(t, "wallet.programRules", "How rewards work")}
                    </h2>
                  </div>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-[16px] bg-[var(--xd-gold-bg-soft)]/50 p-4 text-sm leading-6 text-[#5F5F5F] dark:text-[#D6D0C3]">
                      <p className="font-bold text-[#050505] dark:text-[#F7F2E6]">{accountT(t, "wallet.earningRules", "Earning")}</p>
                      <p className="mt-1">
                        {summary.customerTier === "vip"
                          ? accountT(t, "wallet.vipEarnRule", "VIP customers earn 2 points for each complete EGP 10 block of eligible delivered-order spending.")
                          : accountT(t, "wallet.standardEarnRule", "Standard customers earn 1 point for each complete EGP 10 block of eligible delivered-order spending.")}
                      </p>
                    </div>
                    <div className="rounded-[16px] bg-[var(--xd-gold-bg-soft)]/50 p-4 text-sm leading-6 text-[#5F5F5F] dark:text-[#D6D0C3]">
                      <p className="font-bold text-[#050505] dark:text-[#F7F2E6]">{accountT(t, "wallet.redemptionRules", "Redemption")}</p>
                      <p className="mt-1">
                        {accountT(t, "wallet.redemptionRuleBody", "Redeem in 100-point increments, where 100 points gives EGP 10 of eligible product value, up to 20% of the product subtotal. Points expire 12 months after activation.")}
                      </p>
                      <p className="mt-2 text-[12px]">
                        {accountT(
                          t,
                          "wallet.welcomeRuleBody",
                          "{points} welcome points are available immediately, expire after {days} days, and require at least EGP {minimum} of eligible products. Points cannot pay shipping; store credit is separate.",
                          {
                            points: summary.settings.welcomePoints,
                            days: summary.settings.welcomeExpiryDays,
                            minimum: summary.settings.welcomeMinimumSubtotalEgp,
                          }
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-start gap-2 text-[12px] leading-5 text-[#717182] dark:text-[#C6BEAE]">
                    <ShieldCheck size={16} className="mt-0.5 shrink-0 text-[var(--xd-gold-active)]" aria-hidden="true" />
                    <p>{accountT(t, "wallet.notCashNotice", "Points and store credit cannot be withdrawn or transferred. Wallet credit is used only for X Dental Store orders.")}</p>
                  </div>
                </section>
              </>
            ) : null}
          </main>
        </div>
      </Container>
    </div>
  );
}
