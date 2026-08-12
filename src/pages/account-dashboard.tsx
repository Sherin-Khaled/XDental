import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  Bell,
  Crown,
  ClipboardList,
  FileText,
  Headset,
  MapPin,
  MessageSquareText,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { AccountSidebar } from "@/components/dental/AccountSidebar";
import { Button } from "@/components/dental/Button";
import { Container } from "@/components/dental/Container";
import { StatusBadge } from "@/components/dental/StatusBadge";
import { ScheduledPromotionPlacement } from "@/components/dental/ScheduledPromotionPlacement";
import { useStore, type AuthUser } from "@/context/StoreContext";
import { mockOrders } from "@/data/orders";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import { accountT, accountValue } from "@/lib/accountI18n";
import { formatCurrency } from "@/utils";
import { formatUserDisplayName } from "@/lib/userDisplayName";
import { getMyOrders, type OrderStatus } from "@/services/orders";
import {
  getMyLoyalty,
  getMyVipBenefits,
  type CustomerLoyaltySummary,
  type CustomerVipBenefit,
} from "@/services/account";

const ACTIVE_ORDER_STATUSES = new Set<OrderStatus>([
  "PENDING_REVIEW",
  "CONFIRMED",
  "PREPARING",
  "OUT_FOR_DELIVERY",
]);

type Shortcut = {
  titleKey: string;
  descKey: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  directTranslation?: boolean;
  permission?: string;
};

function getOverviewMetrics(
  t: ReturnType<typeof useLanguage>["t"],
  wishlistCount: number,
  currentUser: AuthUser | null,
  activeOrderCount: number | null,
  loyalty: CustomerLoyaltySummary | null
) {
  const points = currentUser?.isDemo
    ? currentUser.stats?.points ?? 0
    : loyalty?.account.availablePoints ?? null;
  const activeOrders = currentUser?.isDemo
    ? "2"
    : activeOrderCount === null
      ? "—"
      : String(activeOrderCount);
  const pendingQuotes = currentUser?.isDemo ? "1" : "0";
  const rewardValue = currentUser?.isDemo
    ? null
    : loyalty ? formatCurrency(loyalty.account.redeemablePointValue) : null;
  const pendingPoints = currentUser?.isDemo ? 0 : loyalty?.account.pendingPoints ?? 0;

  return [
    { label: accountT(t, "dashboard.metrics.openOrders", "Open Orders"), value: activeOrders },
    { label: accountT(t, "dashboard.metrics.pendingQuotes", "Pending Quotes"), value: pendingQuotes },
    { label: accountT(t, "dashboard.metrics.wishlistItems", "Wishlist Items"), value: String(wishlistCount) },
    {
      label: accountT(t, "dashboard.metrics.availablePoints", "Available Points"),
      value: points === null ? "—" : points.toLocaleString("en-US"),
      subvalue: rewardValue ? accountT(t, "dashboard.metrics.pointsWorth", "Worth {amount}", { amount: rewardValue }) : undefined,
      note: pendingPoints > 0 ? accountT(t, "dashboard.metrics.pendingPoints", "{points} pending after delivery", { points: pendingPoints.toLocaleString("en-US") }) : undefined,
      isAccent: true,
    },
  ];
}

function buildQuickActions(t: ReturnType<typeof useLanguage>["t"]): Shortcut[] {
  return [
    {
      titleKey: "dashboard.quickActionItems.browseProducts.title",
      descKey: "dashboard.quickActionItems.browseProducts.description",
      title: "Browse Products",
      description: "Explore dental supplies and clinic essentials.",
      href: "/products",
      icon: Search,
    },
    {
      titleKey: "dashboard.quickActionItems.viewOrders.title",
      descKey: "dashboard.quickActionItems.viewOrders.description",
      title: "View Orders",
      description: "Track current orders and reorder previous items.",
      href: "/account/orders",
      icon: ClipboardList,
    },
    {
      titleKey: "dashboard.quickActionItems.requestQuote.title",
      descKey: "dashboard.quickActionItems.requestQuote.description",
      title: "Request Quote",
      description: "Ask for pricing on bulk or special products.",
      href: "/account/quotes",
      icon: ReceiptText,
    },
    {
      titleKey: "dashboard.quickActionItems.support.title",
      descKey: "dashboard.quickActionItems.support.description",
      title: "Contact Support",
      description: "Get help with orders, delivery, or products.",
      href: "/account/support",
      icon: Headset,
    },
  ];
}

function buildAccountSupportTools(t: ReturnType<typeof useLanguage>["t"]): Shortcut[] {
  return [
    {
      titleKey: "dashboard.accountSupportTools.addressBook.title",
      descKey: "dashboard.accountSupportTools.addressBook.description",
      title: "Address Book",
      description: "Manage saved delivery addresses for your clinic.",
      href: "/account/address",
      icon: MapPin,
    },
    {
      titleKey: "dashboard.accountSupportTools.walletPoints.title",
      descKey: "dashboard.accountSupportTools.walletPoints.description",
      title: "Wallet & Points",
      description: "View your points balance and available rewards.",
      href: "/account/wallet",
      icon: Wallet,
    },
    {
      titleKey: "dashboard.accountSupportTools.notifications.title",
      descKey: "dashboard.accountSupportTools.notifications.description",
      title: "Notifications",
      description: "Review order updates and important account alerts.",
      href: "/account/notifications",
      icon: Bell,
    },
    {
      titleKey: "dashboard.accountSupportTools.supportTickets.title",
      descKey: "dashboard.accountSupportTools.supportTickets.description",
      title: "Support Tickets",
      description: "Follow up on your support requests and replies.",
      href: "/account/support",
      icon: MessageSquareText,
    },
  ];
}

function buildStaffQuickActions(role?: string, permissions: string[] = []): Shortcut[] {
  const actions: Shortcut[] = [
    {
      titleKey: "staffAccount.adminDashboard",
      descKey: "staffAccount.actions.adminDashboardDescription",
      title: "Admin Dashboard",
      description: "Open the store operations overview.",
      href: "/admin",
      icon: ShieldCheck,
      directTranslation: true,
      permission: "__ADMIN_ONLY__",
    },
    {
      titleKey: "staffAccount.ordersManagement",
      descKey: "staffAccount.actions.ordersDescription",
      title: "Orders Management",
      description: "Review and update customer orders.",
      href: "/admin/orders",
      icon: ClipboardList,
      directTranslation: true,
      permission: "ORDERS_VIEW",
    },
    {
      titleKey: "staffAccount.quotesManagement",
      descKey: "staffAccount.actions.quotesDescription",
      title: "Quotes Management",
      description: "Review and respond to customer quote requests.",
      href: "/admin/quotes",
      icon: FileText,
      directTranslation: true,
      permission: "QUOTES_VIEW",
    },
    {
      titleKey: "staffAccount.productRequestsManagement",
      descKey: "staffAccount.actions.productRequestsDescription",
      title: "Product Requests Management",
      description: "Review customer product requests.",
      href: "/admin/product-requests",
      icon: MessageSquareText,
      directTranslation: true,
      permission: "PRODUCT_REQUESTS_VIEW",
    },
    {
      titleKey: "staffAccount.supportInbox",
      descKey: "staffAccount.actions.supportDescription",
      title: "Support Inbox",
      description: "Manage support conversations and follow-ups.",
      href: "/admin/support",
      icon: Headset,
      directTranslation: true,
      permission: "SUPPORT_INBOX_VIEW",
    },
    {
      titleKey: "staffAccount.users",
      descKey: "staffAccount.actions.usersDescription",
      title: "Users",
      description: "Open customer user management.",
      href: "/admin/users",
      icon: Users,
      directTranslation: true,
      permission: "USERS_VIEW",
    },
  ];

  if (role === "admin") {
    actions.push(
      {
        titleKey: "staffAccount.settings",
        descKey: "staffAccount.actions.settingsDescription",
        title: "Settings",
        description: "Review store administration settings.",
        href: "/admin/settings",
        icon: Settings,
        directTranslation: true,
      }
    );
  }

  return role === "admin"
    ? actions
    : actions.filter((action) => !action.permission || permissions.includes(action.permission));
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function SectionHeader({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  const { t } = useLanguage();
  return (
    <div className="mb-5 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <h2 className="font-display text-[22px] font-bold leading-tight text-[#050505]">
          {title}
        </h2>
        {description && (
          <p className="mt-1.5 max-w-[560px] text-[13px] leading-5 text-[#717182]">
            {description}
          </p>
        )}
      </div>
      {actionHref && (
        <Link
          href={actionHref}
          className="inline-flex shrink-0 items-center gap-1 text-[13px] font-bold text-[var(--xd-gold-text)] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
        >
          {actionLabel ?? t("common.viewAll")}
          <DirectionalIcon direction="forward" family="chevron" size={15} />
        </Link>
      )}
    </div>
  );
}

function QuickActionCard({ item }: { item: Shortcut }) {
  const { t } = useLanguage();
  const Icon = item.icon;
  const title = item.directTranslation ? t(item.titleKey, { fallback: item.title }) : accountT(t, item.titleKey, item.title);
  const description = item.directTranslation ? t(item.descKey, { fallback: item.description }) : accountT(t, item.descKey, item.description);

  return (
    <Link
      href={item.href}
      className="group flex min-h-[106px] items-center gap-4 rounded-[24px] border border-[var(--xd-gold-border-soft)] bg-white/70 p-5 shadow-[0_12px_30px_rgba(5,5,5,0.04)] transition-all hover:-translate-y-0.5 hover:border-[var(--xd-gold-border-hover)] hover:shadow-[var(--xd-shadow-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)] sm:p-6"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-text)] sm:h-12 sm:w-12">
        <Icon size={20} strokeWidth={1.9} />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-[#050505]">
          {title}
        </span>
        <span className="mt-1 block text-pretty text-[14px] leading-[22px] text-[#6A6A6A]">
          {description}
        </span>
      </span>
    </Link>
  );
}

function ToolRow({ item }: { item: Shortcut }) {
  const { t } = useLanguage();
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className="group flex items-center justify-between gap-4 rounded-[18px] border border-[#050505]/[0.06] bg-white/55 px-4 py-4 transition-colors hover:border-[var(--xd-gold-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-text)]">
          <Icon size={17} />
        </span>
        <span className="min-w-0">
          <span className="block text-[14px] font-semibold text-[#050505]">
            {accountT(t, item.titleKey, item.title)}
          </span>
          <span className="mt-0.5 block text-[14px] leading-5 text-[#6A6A6A]">
            {accountT(t, item.descKey, item.description)}
          </span>
        </span>
      </span>
      <DirectionalIcon
        direction="forward"
        family="chevron"
        size={16}
        className="shrink-0 text-[var(--xd-gold-text)] transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
      />
    </Link>
  );
}

export default function AccountDashboardHome() {
  const { wishlistIds, currentUser } = useStore();
  const { t, language } = useLanguage();
  const [activeOrderCount, setActiveOrderCount] = useState<number | null>(null);
  const [vipBenefits, setVipBenefits] = useState<CustomerVipBenefit[] | null>(null);
  const [customerTier, setCustomerTier] = useState<"standard" | "vip" | null>(null);
  const [loyalty, setLoyalty] = useState<CustomerLoyaltySummary | null>(null);
  const [ordersLoadFailed, setOrdersLoadFailed] = useState(false);
  const [loyaltyLoadFailed, setLoyaltyLoadFailed] = useState(false);
  const [vipLoadFailed, setVipLoadFailed] = useState(false);
  const [dashboardDataRetryToken, setDashboardDataRetryToken] = useState(0);
  const hasDashboardDataError = ordersLoadFailed || loyaltyLoadFailed || vipLoadFailed;
  const displayName = formatUserDisplayName(currentUser, language) || accountT(t, "profile.dentalProfessional", "Dental Professional");
  const profileSubtitle = currentUser?.professionalRole ?? accountT(t, "profile.dentalProfessional", "Dental Professional");
  const role = currentUser?.role?.trim().toLowerCase();
  const hasStaffAccess = role === "admin" || role === "support";
  const staffDisplayName = currentUser?.name?.trim() || accountT(t, "profile.dentalProfessional", "Dental Professional");
  const staffAccountTitle = role === "admin" ? t("staffAccount.adminAccount") : t("staffAccount.staffAccount");
  const staffRoleLabel = role === "admin" ? t("staffAccount.roles.admin") : t("staffAccount.roles.support");
  const staffQuickActions = buildStaffQuickActions(role, currentUser?.permissions);
  const overviewMetrics = getOverviewMetrics(
    t,
    wishlistIds.length,
    currentUser,
    activeOrderCount,
    loyalty
  );
  const quickActions = buildQuickActions(t);
  const accountSupportTools = buildAccountSupportTools(t);
  const recentOrders = currentUser?.isDemo ? mockOrders.slice(0, 3) : [];

  useEffect(() => {
    if (!currentUser?.id || currentUser.isDemo || role !== "customer") {
      setActiveOrderCount(null);
      setOrdersLoadFailed(false);
      return;
    }

    let isCurrentAccount = true;
    setActiveOrderCount(null);
    setOrdersLoadFailed(false);

    getMyOrders()
      .then((orders) => {
        if (!isCurrentAccount) return;
        setActiveOrderCount(
          orders.filter((order) => ACTIVE_ORDER_STATUSES.has(order.status)).length
        );
      })
      .catch(() => {
        if (isCurrentAccount) {
          setActiveOrderCount(null);
          setOrdersLoadFailed(true);
        }
      });

    return () => {
      isCurrentAccount = false;
    };
  }, [currentUser?.id, currentUser?.isDemo, role, dashboardDataRetryToken]);

  useEffect(() => {
    if (!currentUser?.id || currentUser.isDemo || role !== "customer") {
      setLoyalty(null);
      setLoyaltyLoadFailed(false);
      return;
    }
    const controller = new AbortController();
    setLoyaltyLoadFailed(false);
    getMyLoyalty(controller.signal)
      .then(setLoyalty)
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoyalty(null);
          setLoyaltyLoadFailed(true);
        }
      });
    return () => controller.abort();
  }, [currentUser?.id, currentUser?.isDemo, role, dashboardDataRetryToken]);

  useEffect(() => {
    if (!currentUser?.id || currentUser.isDemo || role !== "customer") {
      setCustomerTier(null);
      setVipBenefits(null);
      setVipLoadFailed(false);
      return;
    }
    const controller = new AbortController();
    setVipLoadFailed(false);
    getMyVipBenefits(controller.signal)
      .then((result) => {
        setCustomerTier(result.customerTier);
        setVipBenefits(result.benefits);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setCustomerTier(null);
          setVipBenefits(null);
          setVipLoadFailed(true);
        }
      });
    return () => controller.abort();
  }, [currentUser?.id, currentUser?.isDemo, role, dashboardDataRetryToken]);

  return (
    <div className="bg-[var(--xd-bg)] pb-14 pt-10 lg:pb-20 lg:pt-14">
      <Container className="overflow-x-clip">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:gap-7">
          <AccountSidebar />

          <main className="min-w-0 space-y-8">
            <ScheduledPromotionPlacement placement="ACCOUNT_DASHBOARD" />
            {hasStaffAccess ? (
              <>
                <section
                  className="relative isolate w-full overflow-hidden rounded-[28px] border border-[var(--staff-hero-border)] bg-[linear-gradient(135deg,rgba(255,255,255,0.94)_0%,rgba(244,244,240,0.92)_54%,rgba(255,253,246,0.94)_100%)] p-6 shadow-[0_16px_40px_rgba(5,5,5,0.08)] backdrop-blur [--staff-hero-accent:#6F5000] [--staff-hero-border:rgba(122,86,0,0.20)] [--staff-hero-chip:rgba(249,220,92,0.24)] [--staff-hero-muted:#5B584F] [--staff-hero-text:#12120F] sm:p-7 dark:border-[var(--staff-hero-border)] dark:bg-none dark:bg-transparent dark:shadow-none dark:backdrop-blur-none dark:[--staff-hero-accent:#F2D24B] dark:[--staff-hero-border:rgba(255,231,122,0.46)] dark:[--staff-hero-chip:rgba(255,255,255,0.025)] dark:[--staff-hero-muted:#D6D0C3]"
                >
                  <div className="pointer-events-none absolute -left-20 -top-24 -z-10 h-56 w-56 rounded-full bg-[var(--xd-gold-bg-soft)] blur-3xl dark:hidden" />
                  <div className="pointer-events-none absolute -right-24 bottom-0 -z-10 h-52 w-52 rounded-full bg-[rgba(255,255,255,0.78)] blur-3xl dark:hidden" />
                  <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--staff-hero-accent)]">
                    {staffAccountTitle}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <h1 className="font-display text-[30px] font-semibold leading-[1.08] text-[var(--staff-hero-text)] sm:text-[34px] lg:text-[38px] dark:bg-[image:var(--xd-gold-gradient)] dark:bg-clip-text dark:text-transparent dark:[-webkit-text-fill-color:transparent]">
                      {staffDisplayName}
                    </h1>
                    <span className="inline-flex rounded-full border border-[var(--staff-hero-border)] bg-[var(--staff-hero-chip)] px-3 py-1 text-[12px] font-bold text-[var(--staff-hero-accent)]">
                      {staffRoleLabel}
                    </span>
                  </div>
                  <p className="mt-4 max-w-[680px] text-[15px] leading-6 text-[var(--staff-hero-muted)]">
                    {t("staffAccount.manageOperations")}
                  </p>
                </section>

                <section>
                  <div className="mb-5">
                    <h2 className="font-display text-[22px] font-bold leading-tight text-[#050505]">
                      {t("staffAccount.staffTools")}
                    </h2>
                    <p className="mt-1.5 max-w-[600px] text-[13px] leading-5 text-[#717182]">
                      {t("staffAccount.staffToolsDescription")}
                    </p>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {staffQuickActions.map((item) => (
                      <QuickActionCard key={item.titleKey} item={item} />
                    ))}
                  </div>
                </section>
              </>
            ) : (
              <>
            <section className="relative isolate w-full overflow-hidden rounded-[28px] border border-[var(--xd-gold-border-soft)] bg-[linear-gradient(135deg,rgba(255,255,255,0.92)_0%,rgba(255,253,246,0.86)_54%,rgba(255,255,255,0.90)_100%)] p-6 shadow-[0_16px_40px_rgba(5,5,5,0.045)] backdrop-blur sm:p-7 dark:border-[rgba(255,231,122,0.24)] dark:bg-[radial-gradient(circle_at_10%_0%,rgba(242,210,75,0.12),transparent_32%),linear-gradient(145deg,rgba(24,24,20,0.98)_0%,rgba(17,17,15,0.98)_58%,rgba(14,14,12,0.99)_100%)] dark:shadow-[0_22px_54px_rgba(0,0,0,0.30)] dark:backdrop-blur-none">
              <div className="pointer-events-none absolute -left-20 -top-24 -z-10 h-56 w-56 rounded-full bg-[var(--xd-gold-bg-soft)] blur-3xl dark:bg-[rgba(242,210,75,0.08)]" />
              <div className="pointer-events-none absolute -right-24 bottom-0 -z-10 h-52 w-52 rounded-full bg-white/80 blur-3xl dark:bg-[rgba(255,231,122,0.035)]" />

              <div className="min-w-0">
                <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--xd-gold-text)] dark:text-[#F2D24B]">
                  {accountT(t, "dashboard.overviewEyebrow", "Account Overview")}
                </p>
                <h1 className="mt-2.5 max-w-[660px] text-pretty font-display text-[30px] font-semibold leading-[1.08] text-[#050505] sm:text-[34px] lg:text-[38px] dark:text-[#F7F2E6]">
                  {accountT(t, "dashboard.welcome", "Welcome back, {name}", { name: displayName })}
                </h1>
                <p className="mt-2 text-[15px] font-semibold text-[#717182] sm:text-[16px] dark:text-[#D6D0C3]">
                  {profileSubtitle}
                </p>
              </div>

              <div className="mt-6 grid gap-3 rounded-[22px] border border-[var(--xd-gold-border-soft)] bg-white/[0.48] p-3 sm:grid-cols-2 lg:grid-cols-4 dark:border-[rgba(255,231,122,0.15)] dark:bg-[rgba(5,5,5,0.28)]">
                {overviewMetrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="flex min-h-[78px] min-w-0 flex-col justify-center rounded-[16px] border border-[#050505]/[0.05] bg-white/[0.72] px-4 py-3 dark:border-[rgba(255,231,122,0.10)] dark:bg-[rgba(255,255,255,0.025)]"
                  >
                    <p
                      className={cn(
                        "font-display text-[24px] font-bold leading-none text-[#050505] sm:text-[26px] dark:text-[#F7F2E6]",
                        metric.isAccent && "text-[var(--xd-gold-text)] dark:text-[#F2D24B]"
                      )}
                    >
                      {metric.value}
                    </p>
                    <p className="mt-1 text-[12px] font-bold text-[#717182] sm:text-[13px] dark:text-[#C6BEAE]">
                      {metric.label}
                    </p>
                    {metric.subvalue && <p className="mt-1 text-[11px] font-semibold text-[#8A6510] dark:text-[#F2D24B]">{metric.subvalue}</p>}
                    {metric.note && <p className="mt-1 text-[11px] leading-4 text-[#8A8D9A] dark:text-[#BDB6A8]">{metric.note}</p>}
                  </div>
                ))}
              </div>
              {hasDashboardDataError && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[#F1C58F] bg-[#FFF5E8] px-4 py-3 text-sm dark:border-[#E78B37]/45 dark:bg-[#E78B37]/12">
                  <span className="flex items-center gap-2 font-semibold text-[#A65300] dark:text-[#F5B675]">
                    <AlertTriangle size={16} className="shrink-0" />
                    {accountT(t, "dashboard.dataLoadError", "Some account data couldn't be loaded.")}
                  </span>
                  <Button
                    type="button"
                    variant="tertiary"
                    size="sm"
                    onClick={() => setDashboardDataRetryToken((token) => token + 1)}
                  >
                    {accountT(t, "dashboard.dataLoadRetry", "Retry")}
                  </Button>
                </div>
              )}
              {loyalty && (
                <Link
                  href="/account/wallet"
                  className="mt-4 flex items-center justify-between gap-4 rounded-[16px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)]/45 px-4 py-3 text-sm transition-colors hover:border-[var(--xd-gold-border-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)] dark:border-[rgba(255,231,122,0.16)]"
                >
                  <span className="min-w-0">
                    <span className="block font-bold text-[#050505] dark:text-[#F7F2E6]">
                      {accountT(t, "dashboard.rewardsWalletLink", "Rewards & Wallet")}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-[#717182] dark:text-[#C6BEAE]">
                      {loyalty.account.pendingPoints > 0
                        ? accountT(t, "dashboard.pendingPurchasePoints", "{points} purchase points become available after delivery", {
                            points: loyalty.account.pendingPoints.toLocaleString("en-US"),
                          })
                        : accountT(t, "dashboard.viewRewardsBalances", "View points, store credit and activity")}
                    </span>
                  </span>
                  <DirectionalIcon direction="forward" family="chevron" size={17} className="shrink-0 text-[var(--xd-gold-text)]" />
                </Link>
              )}
            </section>

            {customerTier === "vip" && vipBenefits && (
              <section className="rounded-[28px] border border-[var(--xd-gold-border-soft)] bg-white/75 p-6 shadow-[0_14px_36px_rgba(5,5,5,0.04)] dark:bg-white/[0.025] sm:p-7">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-text)] dark:text-[#F2D24B]">
                    <Crown size={21} aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="font-display text-[22px] font-bold text-[#050505] dark:text-[#F7F2E6]">
                      {accountT(t, "dashboard.vipBenefitsTitle", "Your VIP Benefits")}
                    </h2>
                    <p className="mt-1.5 text-[13px] leading-5 text-[#717182] dark:text-[#C6BEAE]">
                      {accountT(t, "dashboard.vipBenefitsDescription", "Your automatic VIP tier benefits are active and verified by the server at checkout.")}
                    </p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    accountT(t, "dashboard.vipAutomaticEarning", "2 points per EGP 10 after delivered orders"),
                    accountT(t, "dashboard.vipAutomaticStandard", "Standard delivery free"),
                    accountT(t, "dashboard.vipAutomaticFast", "Fast delivery charged only at the upgrade difference"),
                    accountT(t, "dashboard.vipAutomaticPickup", "Pickup free"),
                  ].map((benefit) => <div key={benefit} className="rounded-[16px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)]/45 px-3 py-3 text-[12px] font-bold leading-5 text-[#5F5F5F] dark:text-[#D6D0C3]">{benefit}</div>)}
                </div>
                <h3 className="mt-6 text-sm font-bold text-[#050505] dark:text-[#F7F2E6]">{accountT(t, "dashboard.vipAdditionalBenefits", "Additional assigned benefits")}</h3>
                {vipBenefits.length === 0 ? (
                  <p className="mt-5 rounded-[16px] border border-[#050505]/[0.06] px-4 py-4 text-sm font-semibold text-[#717182] dark:border-white/10 dark:text-[#C6BEAE]">
                    {accountT(t, "dashboard.vipNoBenefits", "No additional benefit is currently assigned.")}
                  </p>
                ) : (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {vipBenefits.map((benefit, index) => {
                      const title = (language === "ar" ? benefit.titleAr : benefit.titleEn) || benefit.titleEn || benefit.titleAr;
                      const description = (language === "ar" ? benefit.descriptionAr : benefit.descriptionEn) || benefit.descriptionEn || benefit.descriptionAr;
                      return (
                        <article key={`${benefit.type}-${benefit.promoCode ?? index}`} className="rounded-[18px] border border-[#050505]/[0.06] bg-white/65 p-4 dark:border-white/10 dark:bg-white/[0.025]">
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="font-semibold text-[#050505] dark:text-[#F7F2E6]">{title}</h3>
                            <span className="rounded-full border border-[var(--xd-gold-border-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--xd-gold-text)] dark:text-[#F2D24B]">
                              {accountValue(t, benefit.status)}
                            </span>
                          </div>
                          {description && <p className="mt-2 text-sm leading-5 text-[#717182] dark:text-[#C6BEAE]">{description}</p>}
                          {benefit.promoCode && (
                            <div className="mt-3 rounded-[12px] bg-[var(--xd-gold-bg-soft)] px-3 py-2">
                              <p className="text-[11px] font-bold text-[#717182] dark:text-[#C6BEAE]">{accountT(t, "dashboard.vipPromoCode", "Your personal code")}</p>
                              <code className="mt-1 block font-bold tracking-[0.12em] text-[#050505] dark:text-[#F7F2E6]">{benefit.promoCode}</code>
                            </div>
                          )}
                          {benefit.minimumOrderAmount !== null && benefit.minimumOrderAmount > 0 && (
                            <p className="mt-3 text-xs font-semibold text-[#717182] dark:text-[#C6BEAE]">
                              {accountT(t, "dashboard.vipMinimumOrder", "Minimum order: {amount}", { amount: formatCurrency(benefit.minimumOrderAmount) })}
                            </p>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            <section>
              <div className="mb-5">
                <h2 className="font-display text-[22px] font-bold leading-tight text-[#050505]">
                  {accountT(t, "dashboard.quickActionsTitle", "Quick Actions")}
                </h2>
                <p className="mt-1.5 max-w-[560px] text-[13px] leading-5 text-[#717182]">
                  {accountT(t, "dashboard.quickActionsBody", "Common tasks for managing your clinic orders and purchasing flow.")}
                </p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {quickActions.map((item) => (
                  <QuickActionCard key={item.titleKey} item={item} />
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-[#050505]/[0.08] bg-white/[0.72] p-7 shadow-[0_14px_36px_rgba(5,5,5,0.04)] backdrop-blur sm:p-8">
              <SectionHeader
                title={accountT(t, "dashboard.recentOrdersTitle", "Recent Orders")}
                actionHref="/account/orders"
              />

              <div className="space-y-3">
                {recentOrders.length > 0 ? recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="grid gap-4 rounded-[18px] border border-[#050505]/[0.06] bg-white/[0.64] px-4 py-4 transition-colors hover:border-[var(--xd-gold-border)] md:grid-cols-[minmax(0,1.2fr)_120px_90px_100px_auto] md:items-center md:px-5"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-[#050505]">{order.orderNumber}</span>
                        <StatusBadge status={order.status} />
                      </div>
                    </div>
                    <p className="text-[13px] font-semibold text-[#717182]">{formatDate(order.date)}</p>
                    <p className="text-[13px] font-semibold text-[#717182]">{order.itemCount} {t("common.items", { fallback: "items" })}</p>
                    <p className="font-bold text-[#050505]">{formatCurrency(order.total)}</p>
                    <Button
                      asChild
                      variant="secondary"
                      size="sm"
                      className="h-9 justify-self-start px-4 text-[12px] md:justify-self-end"
                    >
                      <Link href={`/account/orders/${order.id}`}>
                        {t("common.viewDetails", { fallback: "View Details" })}
                      </Link>
                    </Button>
                  </div>
                )) : (
                  <p className="rounded-[18px] border border-[#050505]/[0.06] bg-white/[0.64] px-4 py-5 text-[14px] font-semibold text-[#717182]">
                    {accountT(t, "dashboard.noRecentOrders", "No recent orders yet.")}
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-[var(--xd-gold-border-soft)] bg-white/70 p-6 shadow-[0_14px_36px_rgba(5,5,5,0.04)] backdrop-blur sm:p-7">
              <SectionHeader
                title={accountT(t, "dashboard.accountSupportToolsTitle", "Account & Support Tools")}
                description={accountT(
                  t,
                  "dashboard.accountSupportToolsDescription",
                  "Manage your account details, rewards, notifications, and support requests."
                )}
              />
              <div className="grid gap-3 md:grid-cols-2">
                {accountSupportTools.map((item) => (
                  <ToolRow key={item.titleKey} item={item} />
                ))}
              </div>
            </section>
              </>
            )}
          </main>
        </div>
      </Container>
    </div>
  );
}
