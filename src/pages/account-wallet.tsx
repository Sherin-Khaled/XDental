import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import {
  Check,
  CircleHelp,
  CreditCard,
  Gift,
  Package,
  RefreshCw,
  Search,
  type LucideIcon,
} from "lucide-react";
import { Container } from "@/components/dental/Container";
import { AccountSidebar } from "@/components/dental/AccountSidebar";
import {
  AccountFilterToolbar,
  accountFilterControlClassName,
  accountFilterSearchClassName,
  accountFilterTriggerClassName,
} from "@/components/dental/AccountFilterToolbar";
import { Button } from "@/components/dental/Button";
import { DentalSelect } from "@/components/dental/Select";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import { accountT, accountValue } from "@/lib/accountI18n";

type HistoryItem = {
  title: string;
  date: string;
  status: "Pending" | "Used" | "Added" | "Expired";
  points: number;
};

type StatusFilter = "all" | HistoryItem["status"];
type DateFilter = "all" | "30d" | "6m";

type Reward = {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  tone: "green" | "gold";
  discountEGP: number;
  // Optional modifiers used by checkout when this reward is applied.
  freeShipping?: boolean;
  minOrderEGP?: number;
};

const POINTS_BALANCE = 1250;
const STORE_CREDIT = 50;
const POINT_VALUE_EGP = 0.1;
export const CHECKOUT_POINTS_KEY = "x-dental-checkout-points";
export const CHECKOUT_REWARD_KEY = "x-dental-checkout-reward";

const earnMethods: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    title: "Place Orders",
    description: "Earn points when your order is completed.",
    icon: Package,
  },
  {
    title: "Reorder Clinic Essentials",
    description: "Earn rewards on repeat purchases and supply lists.",
    icon: RefreshCw,
  },
  {
    title: "Use Offers",
    description: "Get extra points on selected weekly deals.",
    icon: Gift,
  },
  {
    title: "Complete Your Profile",
    description: "Keep your account details updated for better rewards.",
    icon: Check,
  },
];

const rewards: Reward[] = [
  {
    id: "clinic-essentials-50",
    title: "EGP 50 Off Clinic Essentials",
    subtitle: "Use on orders above EGP 1,000.",
    badge: "Available",
    tone: "green",
    discountEGP: 50,
    minOrderEGP: 1000,
  },
  {
    id: "free-delivery",
    title: "Free Delivery Voucher",
    subtitle: "Use on orders above EGP 800.",
    badge: "Available",
    tone: "green",
    discountEGP: 0,
    freeShipping: true,
    minOrderEGP: 800,
  },
  {
    id: "extra-points-weekly",
    title: "Extra Points on Weekly Offers",
    subtitle: "Earn 2x points on selected offers.",
    badge: "Active",
    tone: "gold",
    discountEGP: 0,
  },
];

const history: HistoryItem[] = [
  {
    title: "Order #XD-10245 completed",
    date: "24 Jul 2025",
    status: "Pending",
    points: 125,
  },
  {
    title: "Redeemed at checkout",
    date: "12 Jul 2025",
    status: "Used",
    points: -300,
  },
  {
    title: "Weekly offer bonus",
    date: "01 Jul 2025",
    status: "Added",
    points: 50,
  },
  {
    title: "Expired points",
    date: "20 Jun 2025",
    status: "Expired",
    points: -100,
  },
];

function Card({
  children,
  className,
}: {
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
      {children}
    </section>
  );
}

function StatCard({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <Card className="flex min-h-[118px] flex-col items-center justify-center text-center">
      <p className="font-display text-[26px] font-bold leading-none text-[var(--xd-gold-active)] sm:text-[28px]">
        {value}
      </p>
      <p className="mt-3 text-[12px] font-semibold text-[#717182]">{label}</p>
    </Card>
  );
}

function IconTile({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  const { t } = useLanguage();

  return (
    <div className="rounded-[18px] border border-[var(--xd-gold-border-soft)] bg-white/65 p-5">
      <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-active)]">
        <Icon size={18} />
      </span>
      <h3 className="text-[14px] font-bold text-[#050505]">{accountValue(t, title)}</h3>
      <p className="mt-2 text-[12px] leading-5 text-[#8A8D9A]">{accountValue(t, description)}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: HistoryItem["status"] }) {
  const { t } = useLanguage();
  const classes = {
    Pending: "bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-text)]",
    Used: "bg-[var(--xd-info-bg)] text-[var(--xd-info-text)]",
    Added: "bg-[#16803C]/10 text-[#16803C]",
    Expired: "bg-[#F44336]/10 text-[#F44336]",
  };

  return (
    <span className={cn("rounded-full px-3 py-1 text-[11px] font-bold", classes[status])}>
      {accountValue(t, status)}
    </span>
  );
}

export default function AccountWallet() {
  const [, navigate] = useLocation();
  const { isRtl, t } = useLanguage();
  const [redeemPoints, setRedeemPoints] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Pre-fill redeem input with the full available balance on first mount
  // so the equivalent value is visible and the user can adjust.
  useEffect(() => {
    if (redeemPoints === "" && POINTS_BALANCE > 0) {
      setRedeemPoints(String(POINTS_BALANCE));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parsedRedeemPoints = Number(redeemPoints);
  const hasValidRedeemInput =
    redeemPoints.trim() !== "" &&
    Number.isFinite(parsedRedeemPoints) &&
    parsedRedeemPoints > 0;
  const numericRedeemPoints = hasValidRedeemInput
    ? Math.min(POINTS_BALANCE, Math.max(0, Math.floor(parsedRedeemPoints)))
    : 0;
  const redeemEquivalent = numericRedeemPoints * POINT_VALUE_EGP;
  const isRedeemValid = hasValidRedeemInput && numericRedeemPoints > 0;

  const filteredHistory = useMemo(() => {
    const query = search.trim().toLowerCase();
    const newestHistoryTime = Math.max(
      ...history.map((item) => new Date(item.date).getTime())
    );
    const cutoff =
      dateFilter === "all"
        ? Number.NEGATIVE_INFINITY
        : newestHistoryTime - (dateFilter === "30d" ? 30 : 183) * 24 * 60 * 60 * 1000;

    return history
      .filter((item) => statusFilter === "all" || item.status === statusFilter)
      .filter((item) => new Date(item.date).getTime() >= cutoff)
      .filter((item) => {
        if (!query) return true;

        return [item.title, item.date, item.status].some((value) =>
          value.toLowerCase().includes(query)
        );
      });
  }, [dateFilter, search, statusFilter]);

  const safeStore = {
    setItem(key: string, value: string) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* storage unavailable */
      }
    },
    removeItem(key: string) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* storage unavailable */
      }
    },
  };

  const persistPoints = (points: number, source: string) => {
    safeStore.setItem(
      CHECKOUT_POINTS_KEY,
      JSON.stringify({ pointsToApply: points, source })
    );
  };

  const persistReward = (reward: Reward | null) => {
    if (!reward) {
      safeStore.removeItem(CHECKOUT_REWARD_KEY);
      return;
    }
    safeStore.setItem(
      CHECKOUT_REWARD_KEY,
      JSON.stringify({
        rewardId: reward.id,
        label: reward.title,
        discountEGP: reward.discountEGP,
        freeShipping: Boolean(reward.freeShipping),
        minOrderEGP: reward.minOrderEGP ?? 0,
      })
    );
  };

  const goToCheckoutWithAllPoints = () => {
    persistPoints(POINTS_BALANCE, "wallet");
    navigate("/checkout");
  };

  const goToCheckoutWithCustomPoints = () => {
    if (!isRedeemValid) return;
    persistPoints(numericRedeemPoints, "wallet-custom");
    navigate("/checkout");
  };

  const goToCheckoutWithReward = (reward: Reward) => {
    persistReward(reward);
    navigate("/checkout");
  };

  return (
    <div className="bg-[var(--xd-bg)] pb-14 pt-10 lg:pb-20 lg:pt-14">
      <Container className="overflow-x-clip">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:gap-7">
          <AccountSidebar />

          <main className="space-y-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--xd-gold-active)]">
                  {accountT(t, "wallet.eyebrow", "Rewards & Credit")}
                </p>
                <h1 className="font-display text-[36px] font-bold leading-none text-[#050505] sm:text-[44px]">
                  {accountT(t, "wallet.title", "Wallet & Points")}
                </h1>
                <p className="mt-4 max-w-[680px] text-[15px] leading-6 text-[#8A8D9A]">
                  {accountT(
                    t,
                    "wallet.description",
                    "Track your points, store credit, coupons, and reward activity in one place."
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  document.getElementById("wallet-earn-methods")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                  setStatusMessage(accountT(t, "wallet.showingEarnMethods", "Showing how points are earned."));
                }}
                className={cn(
                  "inline-flex h-11 shrink-0 items-center gap-2 self-start rounded-full text-[13px] font-bold text-[#050505] transition-colors hover:text-[var(--xd-gold-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)] sm:mt-7",
                  isRtl ? "flex-row-reverse" : ""
                )}
              >
                <CircleHelp size={15} />
                <span>{accountT(t, "wallet.howItWorks", "How It Works")}</span>
              </button>
            </div>

            {statusMessage && (
              <div
                role="status"
                className="rounded-[14px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-active)]/[0.08] px-4 py-3 text-[13px] font-semibold text-[#5F5F5F]"
              >
                {statusMessage}
              </div>
            )}

            <Card className="p-6 lg:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-[#8A8D9A]">
                    {accountT(t, "wallet.currentBalance", "Current Balance")}
                  </p>
                  <p className="mt-3 font-display text-[40px] font-bold leading-none text-[var(--xd-gold-active)] sm:text-[48px]">
                    {POINTS_BALANCE.toLocaleString()} {accountT(t, "wallet.pointsUnit", "Points")}
                  </p>
                  <div className="mt-5 space-y-2 text-[14px] text-[#717182]">
                    <p>
                      {accountT(t, "wallet.equivalent", "Equivalent")}:{" "}
                      <span className="font-bold text-[#050505]">EGP {POINTS_BALANCE * POINT_VALUE_EGP}</span>
                    </p>
                    <p>
                      {accountT(t, "wallet.storeCredit", "Store Credit")}:{" "}
                      <span className="font-bold text-[#050505]">EGP {STORE_CREDIT}</span>
                    </p>
                  </div>
                  <p className="mt-5 max-w-[520px] text-[13px] text-[#8A8D9A]">
                    {accountT(t, "wallet.redeemDescription", "Use available points to reduce your order total during checkout.")}
                  </p>
                </div>

                <div
                  className={cn(
                    "flex w-full shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-start lg:w-auto lg:flex-row lg:items-center lg:justify-end",
                    isRtl ? "lg:flex-row-reverse" : ""
                  )}
                >
                  <Button
                    type="button"
                    onClick={goToCheckoutWithAllPoints}
                    variant="primary"
                    className="w-full gap-2 px-6 text-[13px] sm:w-auto"
                  >
                    <CreditCard size={15} />
                    {accountT(t, "wallet.usePointsAtCheckout", "Use Points at Checkout")}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      document.getElementById("wallet-rewards")?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                      setStatusMessage(accountT(t, "wallet.showingRewards", "Showing available rewards."));
                    }}
                    variant="secondary"
                    className="w-full px-5 text-[13px] text-[#050505] sm:w-auto"
                  >
                    {accountT(t, "wallet.viewRewards", "View Rewards")}
                  </Button>
                </div>
              </div>
            </Card>

            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard value="1,250" label={accountT(t, "wallet.availablePoints", "Available Points")} />
              <StatCard value="300" label={accountT(t, "wallet.pendingPoints", "Pending Points")} />
              <StatCard value="EGP 50" label={accountT(t, "wallet.storeCredit", "Store Credit")} />
              <StatCard value="200" label={accountT(t, "wallet.expiringSoon", "Expiring Soon")} />
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
              <div className="space-y-6">
                <div id="wallet-earn-methods" className="scroll-mt-28">
                  <Card>
                    <h2 className="text-[20px] font-bold text-[#050505]">
                      {accountT(t, "wallet.howToEarnPoints", "How to earn points")}
                    </h2>
                    <p className="mt-2 text-[13px] leading-5 text-[#8A8D9A]">
                      {accountT(
                        t,
                        "wallet.howToEarnDescription",
                        "Earn rewards as you shop, reorder clinic essentials, and use X Dental Store features."
                      )}
                    </p>

                    <div className="mt-6 grid gap-5 md:grid-cols-2">
                      {earnMethods.map((method) => (
                        <IconTile key={method.title} {...method} />
                      ))}
                    </div>
                  </Card>
                </div>

                <Card>
                  <h2 className="text-[20px] font-bold text-[#050505]">
                    {accountT(t, "wallet.pointsHistory", "Points History")}
                  </h2>
                  <p className="mt-2 text-[13px] leading-5 text-[#8A8D9A]">
                    {accountT(t, "wallet.pointsHistoryDescription", "Track points earned, redeemed, pending, and expired.")}
                  </p>

                  <AccountFilterToolbar className="mt-6 md:grid-cols-[1fr_160px_160px]">
                    <label className={cn(accountFilterSearchClassName, "md:col-span-1")}>
                      <Search
                        size={16}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8A8D9A]"
                      />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={accountT(t, "wallet.searchActivity", "Search activity")}
                        className="h-12 w-full rounded-full border border-[#050505]/10 bg-white px-11 text-[14px] text-[#050505] outline-none transition placeholder:text-[#B3B4BD] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10"
                      />
                    </label>
                    <DentalSelect
                      className={accountFilterControlClassName}
                      label={accountT(t, "wallet.filterPointsByStatus", "Filter points by status")}
                      value={statusFilter}
                      onChange={(value) => setStatusFilter(value as StatusFilter)}
                      triggerClassName={cn(accountFilterTriggerClassName, "md:text-[14px]")}
                      options={[
                        { value: "all", label: accountT(t, "values.filters.allStatus", "All Status") },
                        { value: "Pending", label: accountValue(t, "Pending") },
                        { value: "Used", label: accountValue(t, "Used") },
                        { value: "Added", label: accountValue(t, "Added") },
                        { value: "Expired", label: accountValue(t, "Expired") },
                      ]}
                    />
                    <DentalSelect
                      className={accountFilterControlClassName}
                      label={accountT(t, "wallet.filterPointsByDate", "Filter points by date")}
                      value={dateFilter}
                      onChange={(value) => setDateFilter(value as DateFilter)}
                      triggerClassName={cn(accountFilterTriggerClassName, "md:text-[14px]")}
                      options={[
                        { value: "all", label: accountT(t, "values.filters.allTime", "All Time") },
                        { value: "30d", label: accountT(t, "values.filters.last30Days", "Last 30 days") },
                        { value: "6m", label: accountT(t, "values.filters.last6Months", "Last 6 months") },
                      ]}
                    />
                  </AccountFilterToolbar>

                  <div className="mt-6 divide-y divide-[#050505]/[0.07]">
                    {filteredHistory.map((item) => (
                      <div key={`${item.title}-${item.date}`} className="flex items-center justify-between gap-4 py-4">
                        <div>
                          <p className="text-[14px] font-bold text-[#050505]">{accountValue(t, item.title)}</p>
                          <p className="mt-1 text-[12px] text-[#8A8D9A]">{item.date}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <StatusBadge status={item.status} />
                          <p
                            className={cn(
                              "min-w-[86px] text-right text-[15px] font-bold",
                              item.points >= 0 ? "text-[#16803C]" : "text-[#F44336]"
                            )}
                          >
                            {item.points >= 0 ? "+" : ""}
                            {item.points} {accountT(t, "wallet.pointsShort", "pts")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              <aside className="space-y-6">
                <Card>
                  <h2 className="text-[18px] font-bold text-[#050505]">
                    {accountT(t, "wallet.redeemPoints", "Redeem Points")}
                  </h2>
                  <p className="mt-2 text-[13px] leading-5 text-[#8A8D9A]">
                    {accountT(t, "wallet.redeemDescription", "Use available points to reduce your order total during checkout.")}
                  </p>

                  <label className="mt-5 block">
                    <span className="mb-2 block text-[13px] font-bold text-[#050505]">
                      {accountT(t, "wallet.enterPoints", "Enter points")}
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={POINTS_BALANCE}
                      step={10}
                      value={redeemPoints}
                      onChange={(event) => {
                        const raw = event.target.value;
                        // Strip non-numeric characters, drop signs, and prevent negatives.
                        const sanitized = raw.replace(/[^0-9]/g, "");
                        if (sanitized === "") {
                          setRedeemPoints("");
                          return;
                        }
                        const parsed = Number(sanitized);
                        if (!Number.isFinite(parsed) || parsed < 0) {
                          setRedeemPoints("");
                          return;
                        }
                        const clamped = Math.min(POINTS_BALANCE, Math.floor(parsed));
                        setRedeemPoints(String(clamped));
                      }}
                      placeholder="0"
                      className="h-12 w-full rounded-[12px] border border-[var(--xd-gold-border-soft)] bg-white px-4 text-[14px] text-[#050505] outline-none transition placeholder:text-[var(--xd-gold-active)]/50 focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10"
                    />
                  </label>

                  <div className="mt-4 rounded-[14px] bg-[#F8F2E3] p-4">
                    <p className="text-[12px] text-[#8A8D9A]">{accountT(t, "wallet.equivalent", "Equivalent")}</p>
                    <p className="mt-2 text-[20px] font-bold text-[var(--xd-gold-active)]">
                      EGP {redeemEquivalent.toFixed(0)}
                    </p>
                  </div>

                  <Button
                    type="button"
                    onClick={goToCheckoutWithCustomPoints}
                    disabled={!isRedeemValid}
                    variant="primary"
                    className="mt-5 w-full px-5 text-[14px]"
                  >
                    {accountT(t, "wallet.usePointsAtCheckout", "Use Points at Checkout")}
                  </Button>

                  <p className="mt-4 text-center text-[11px] leading-5 text-[#8A8D9A]">
                    {accountT(t, "wallet.pointsCheckoutNote", "Points can be applied during checkout when your cart is eligible.")}
                  </p>
                </Card>

                <div id="wallet-rewards" className="scroll-mt-28">
                  <Card>
                    <h2 className="text-[18px] font-bold text-[#050505]">
                      {accountT(t, "wallet.availableRewards", "Available Rewards")}
                    </h2>
                    <p className="mt-2 text-[13px] leading-5 text-[#8A8D9A]">
                      {accountT(t, "wallet.availableRewardsDescription", "Use rewards and vouchers when eligible during checkout.")}
                    </p>

                    <div className="mt-5 space-y-3">
                      {rewards.map((reward) => (
                        <div
                          key={reward.id}
                          className="rounded-[16px] border border-[var(--xd-gold-border-soft)] bg-white/70 p-4"
                        >
                          <div className="flex gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-active)]">
                              <Gift size={17} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <h3 className="text-[14px] font-bold text-[#050505]">{accountValue(t, reward.title)}</h3>
                              <p className="mt-1 text-[12px] leading-5 text-[#8A8D9A]">{accountValue(t, reward.subtitle)}</p>
                              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                                <span
                                  className={cn(
                                    "rounded-full px-3 py-1 text-[11px] font-bold",
                                    reward.tone === "green"
                                      ? "bg-[#16803C]/10 text-[#16803C]"
                                      : "bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-text)]"
                                  )}
                                >
                                  {accountValue(t, reward.badge)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => goToCheckoutWithReward(reward)}
                                  className="inline-flex items-center gap-1 text-[12px] font-bold text-[var(--xd-gold-text)] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)] rounded-full"
                                >
                                  {accountT(t, "wallet.useAtCheckout", "Use at Checkout")}
                                  <span aria-hidden="true" className={isRtl ? "rotate-180" : ""}>
                                    <DirectionalIcon direction="forward" family="arrow" size={12} />
                                  </span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </aside>
            </div>
          </main>
        </div>
      </Container>
    </div>
  );
}
