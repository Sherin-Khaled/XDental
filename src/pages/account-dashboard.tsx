import { Link } from "wouter";
import {
  Bell,
  ClipboardList,
  Headset,
  MapPin,
  MessageSquareText,
  ReceiptText,
  Search,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { AccountSidebar } from "@/components/dental/AccountSidebar";
import { Button } from "@/components/dental/Button";
import { Container } from "@/components/dental/Container";
import { StatusBadge } from "@/components/dental/StatusBadge";
import { useStore, type AuthUser } from "@/context/StoreContext";
import { mockOrders } from "@/data/orders";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import { accountT } from "@/lib/accountI18n";
import { formatCurrency } from "@/utils";
import { formatUserDisplayName } from "@/lib/userDisplayName";

type Shortcut = {
  titleKey: string;
  descKey: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

function getOverviewMetrics(
  t: ReturnType<typeof useLanguage>["t"],
  wishlistCount: number,
  currentUser: AuthUser | null
) {
  const points = currentUser?.stats?.points ?? 0;
  const activeOrders = currentUser?.isDemo ? "2" : "0";
  const pendingQuotes = currentUser?.isDemo ? "1" : "0";

  return [
    { label: accountT(t, "dashboard.metrics.activeOrders", "Active Orders"), value: activeOrders },
    { label: accountT(t, "dashboard.metrics.pendingQuotes", "Pending Quotes"), value: pendingQuotes },
    { label: accountT(t, "dashboard.metrics.wishlistItems", "Wishlist Items"), value: String(wishlistCount) },
    { label: accountT(t, "dashboard.metrics.xPoints", "X-Points"), value: points.toLocaleString("en-US"), isAccent: true },
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
          {accountT(t, item.titleKey, item.title)}
        </span>
        <span className="mt-1 block text-pretty text-[14px] leading-[22px] text-[#6A6A6A]">
          {accountT(t, item.descKey, item.description)}
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
  const displayName = formatUserDisplayName(currentUser, language) || accountT(t, "profile.dentalProfessional", "Dental Professional");
  const profileSubtitle = currentUser?.professionalRole ?? accountT(t, "profile.dentalProfessional", "Dental Professional");
  const role = currentUser?.role?.trim().toLowerCase();
  const hasStaffAccess = role === "admin" || role === "support";
  const overviewMetrics = getOverviewMetrics(t, wishlistIds.length, currentUser);
  const quickActions = buildQuickActions(t);
  const accountSupportTools = buildAccountSupportTools(t);
  const recentOrders = currentUser?.isDemo ? mockOrders.slice(0, 3) : [];

  return (
    <div className="bg-[var(--xd-bg)] pb-14 pt-10 lg:pb-20 lg:pt-14">
      <Container className="overflow-x-clip">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:gap-7">
          <AccountSidebar />

          <main className="min-w-0 space-y-8">
            <section className="relative isolate w-full overflow-hidden rounded-[28px] border border-[var(--xd-gold-border-soft)] bg-[linear-gradient(135deg,rgba(255,255,255,0.92)_0%,rgba(255,253,246,0.86)_54%,rgba(255,255,255,0.90)_100%)] p-6 shadow-[0_16px_40px_rgba(5,5,5,0.045)] backdrop-blur sm:p-7">
              <div className="pointer-events-none absolute -left-20 -top-24 -z-10 h-56 w-56 rounded-full bg-[var(--xd-gold-bg-soft)] blur-3xl" />
              <div className="pointer-events-none absolute -right-24 bottom-0 -z-10 h-52 w-52 rounded-full bg-white/80 blur-3xl" />

              <div className="min-w-0">
                <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--xd-gold-text)]">
                  {accountT(t, "dashboard.overviewEyebrow", "Account Overview")}
                </p>
                <h1 className="mt-2.5 max-w-[660px] font-display text-[30px] font-semibold leading-[1.08] text-[#050505] sm:text-[34px] lg:text-[38px]">
                  {accountT(t, "dashboard.welcome", "Welcome back, {name}", { name: displayName })}
                </h1>
                <p className="mt-2 text-[15px] font-semibold text-[#717182] sm:text-[16px]">
                  {profileSubtitle}
                </p>
                {hasStaffAccess && (
                  <Button asChild variant="secondary" size="sm" className="mt-5 gap-2">
                    <Link href="/admin" data-testid="link-admin-dashboard">
                      <ShieldCheck size={16} />
                      {t("account.adminDashboard")}
                      <DirectionalIcon direction="forward" size={15} />
                    </Link>
                  </Button>
                )}
              </div>

              <div className="mt-6 grid gap-3 rounded-[22px] border border-[var(--xd-gold-border-soft)] bg-white/[0.48] p-3 sm:grid-cols-2 lg:grid-cols-4">
                {overviewMetrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="flex min-h-[78px] min-w-0 flex-col justify-center rounded-[16px] border border-[#050505]/[0.05] bg-white/[0.72] px-4 py-3"
                  >
                    <p
                      className={cn(
                        "font-display text-[24px] font-bold leading-none text-[#050505] sm:text-[26px]",
                        metric.isAccent && "text-[var(--xd-gold-text)]"
                      )}
                    >
                      {metric.value}
                    </p>
                    <p className="mt-1 text-[12px] font-bold text-[#717182] sm:text-[13px]">
                      {metric.label}
                    </p>
                  </div>
                ))}
              </div>
            </section>

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
          </main>
        </div>
      </Container>
    </div>
  );
}
