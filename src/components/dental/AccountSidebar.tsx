import { useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Bell,
  Building2,
  ChevronDown,
  ClipboardList,
  FileText,
  Heart,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MapPin,
  MessageSquareText,
  Package,
  Settings,
  ShieldCheck,
  User,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/dental/Button";
import { useStore } from "@/context/StoreContext";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import { useClickOutside } from "@/hooks/use-click-outside";
import { formatUserDisplayName } from "@/lib/userDisplayName";

type AccountLink = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  isActive: (location: string) => boolean;
  permission?: string;
};

const accountLinks: AccountLink[] = [
  {
    href: "/account/dashboard",
    labelKey: "account.dashboard",
    icon: LayoutDashboard,
    isActive: (location) => location === "/account/dashboard",
  },
  {
    href: "/account",
    labelKey: "account.profile",
    icon: User,
    isActive: (location) => location === "/account",
  },
  {
    href: "/account/orders",
    labelKey: "account.myOrders",
    icon: Package,
    isActive: (location) => location.startsWith("/account/orders"),
  },
  {
    href: "/account/wishlist",
    labelKey: "account.wishlist",
    icon: Heart,
    isActive: (location) => location === "/account/wishlist",
  },
  {
    href: "/account/supply-lists",
    labelKey: "account.mySupplyLists",
    icon: ClipboardList,
    isActive: (location) => location.startsWith("/account/supply-lists"),
  },
  {
    href: "/account/clinic-branches",
    labelKey: "account.clinicBranches",
    icon: Building2,
    isActive: (location) => location.startsWith("/account/clinic-branches"),
  },
  {
    href: "/account/address",
    labelKey: "account.addressBook",
    icon: MapPin,
    isActive: (location) => location === "/account/address",
  },
  {
    href: "/account/quotes",
    labelKey: "account.quotes",
    icon: FileText,
    isActive: (location) => location.startsWith("/account/quotes"),
  },
  {
    href: "/account/product-requests",
    labelKey: "account.productRequests",
    icon: MessageSquareText,
    isActive: (location) => location.startsWith("/account/product-requests"),
  },
  {
    href: "/account/notifications",
    labelKey: "account.notifications",
    icon: Bell,
    isActive: (location) => location.startsWith("/account/notifications"),
  },
  {
    href: "/account/wallet",
    labelKey: "account.walletPoints",
    icon: Wallet,
    isActive: (location) => location === "/account/wallet",
  },
  {
    href: "/account/support",
    labelKey: "account.supportTickets",
    icon: LifeBuoy,
    isActive: (location) => location === "/account/support",
  },
  {
    href: "/account/settings",
    labelKey: "account.settings",
    icon: Settings,
    isActive: (location) => location === "/account/settings",
  },
];

const staffToolLinks: Array<AccountLink & { adminOnly?: boolean }> = [
  {
    href: "/admin",
    labelKey: "staffAccount.adminDashboard",
    icon: ShieldCheck,
    adminOnly: true,
    isActive: (location) => location === "/admin",
  },
  {
    href: "/admin/orders",
    labelKey: "staffAccount.ordersManagement",
    icon: Package,
    isActive: (location) => location.startsWith("/admin/orders"),
    permission: "ORDERS_VIEW",
  },
  {
    href: "/admin/quotes",
    labelKey: "staffAccount.quotesManagement",
    icon: FileText,
    isActive: (location) => location.startsWith("/admin/quotes"),
    permission: "QUOTES_VIEW",
  },
  {
    href: "/admin/product-requests",
    labelKey: "staffAccount.productRequestsManagement",
    icon: MessageSquareText,
    isActive: (location) => location.startsWith("/admin/product-requests"),
    permission: "PRODUCT_REQUESTS_VIEW",
  },
  {
    href: "/admin/support",
    labelKey: "staffAccount.supportInbox",
    icon: LifeBuoy,
    isActive: (location) => location.startsWith("/admin/support"),
    permission: "SUPPORT_INBOX_VIEW",
  },
  {
    href: "/admin/users",
    labelKey: "staffAccount.users",
    icon: Users,
    permission: "USERS_VIEW",
    isActive: (location) => location.startsWith("/admin/users"),
  },
  {
    href: "/admin/settings",
    labelKey: "staffAccount.settings",
    icon: Settings,
    adminOnly: true,
    isActive: (location) => location.startsWith("/admin/settings"),
  },
];

const staffPersonalLinks = accountLinks.filter((link) =>
  ["/account/dashboard", "/account", "/account/notifications", "/account/settings"].includes(link.href)
);

export function AccountSidebar({ onLogout }: { onLogout?: () => void }) {
  const [location, navigate] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { signOut, currentUser } = useStore();
  const { t, language } = useLanguage();
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const role = currentUser?.role?.trim().toLowerCase();
  const hasStaffAccess = role === "admin" || role === "support";
  const visibleStaffToolLinks = staffToolLinks.filter(
    (link) =>
      (!link.adminOnly || role === "admin") &&
      (role === "admin" || !link.permission || currentUser?.permissions?.includes(link.permission))
  );
  const visibleAccountLinks = hasStaffAccess ? [...visibleStaffToolLinks, ...staffPersonalLinks] : accountLinks;
  const activeLink = visibleAccountLinks.find((link) => link.isActive(location)) ?? accountLinks[0];
  const ActiveIcon = activeLink.icon;
  const userDisplayName = formatUserDisplayName(currentUser, language);
  const staffRoleLabel = role === "admin" ? t("staffAccount.roles.admin") : t("staffAccount.roles.support");
  const staffUserLabel = role === "admin" ? t("staffAccount.adminUser") : t("staffAccount.supportUser");

  useClickOutside(mobileMenuRef, () => setIsMobileOpen(false), {
    enabled: isMobileOpen,
  });

  const handleLogout = async () => {
    setIsMobileOpen(false);
    await signOut();

    if (onLogout) {
      onLogout();
      return;
    }

    navigate("/signin");
  };

  const renderMobileLink = (link: AccountLink) => {
    const Icon = link.icon;
    const isActive = link.isActive(location);
    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={() => setIsMobileOpen(false)}
        className={cn(
          "flex items-center gap-3 rounded-[12px] px-3.5 py-3 text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)]",
          isActive
            ? "xd-gradient-gold-border bg-[var(--xd-gold)]/[0.14] text-[var(--xd-gold-active)]"
            : "text-[#8A8D9A] hover:text-[#050505]"
        )}
      >
        <Icon size={16} strokeWidth={1.8} className="xd-premium-icon" />
        <span className={cn(isActive && "account-sidebar-active-label")}>
          {t(link.labelKey)}
        </span>
      </Link>
    );
  };

  const renderDesktopLink = (link: AccountLink) => {
    const Icon = link.icon;
    const isActive = link.isActive(location);
    return (
      <Link
        key={link.href}
        href={link.href}
        className={cn(
          "flex items-center gap-3 rounded-[12px] px-3.5 py-3 text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)]",
          isActive
            ? "xd-gradient-gold-border bg-[var(--xd-gold)]/[0.14] text-[var(--xd-gold-active)]"
            : "text-[#8A8D9A] hover:bg-[var(--xd-gold-bg-soft)] hover:text-[#050505]"
        )}
      >
        <Icon size={16} strokeWidth={1.8} className="xd-premium-icon" />
        <span className={cn(isActive && "account-sidebar-active-label")}>
          {t(link.labelKey)}
        </span>
      </Link>
    );
  };

  return (
    <aside className="w-full shrink-0 lg:w-[260px]">
      <div className="relative lg:hidden" ref={mobileMenuRef}>
        <button
          type="button"
          onClick={() => setIsMobileOpen((current) => !current)}
          className="flex h-14 w-full items-center justify-between rounded-[16px] border border-[var(--xd-gold-border-soft)] bg-white/80 px-4 text-left shadow-[0_10px_26px_rgba(5,5,5,0.04)] backdrop-blur transition-colors hover:border-[var(--xd-gold-border-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)] sm:w-auto sm:min-w-[260px]"
          aria-expanded={isMobileOpen}
          aria-controls="account-mobile-menu"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="xd-gold-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--xd-gold-bg-soft)]">
              <ActiveIcon size={16} strokeWidth={1.8} />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--xd-gold-text)]">
                {hasStaffAccess ? staffUserLabel : userDisplayName || t("common.myAccount")}
              </span>
              <span className="block truncate text-[14px] font-bold text-[#050505]">
                {t(activeLink.labelKey)}
              </span>
            </span>
          </span>
          <ChevronDown
            size={18}
            className={cn(
              "shrink-0 text-[#717182] transition-transform",
              isMobileOpen && "rotate-180"
            )}
          />
        </button>

        {isMobileOpen && (
          <div
            id="account-mobile-menu"
            className="absolute left-0 top-[calc(100%+8px)] z-40 w-full overflow-hidden rounded-[18px] border border-[var(--xd-gold-border-soft)] bg-white shadow-[0_18px_44px_rgba(5,5,5,0.12)] sm:w-[320px]"
          >
            <nav className="max-h-[min(70vh,520px)] overflow-y-auto p-2">
              {hasStaffAccess ? (
                <>
                  <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--xd-gold-text)]">
                    {t("staffAccount.staffTools")}
                  </p>
                  {visibleStaffToolLinks.map(renderMobileLink)}
                  <div className="mx-3 my-2 h-px bg-[#050505]/[0.07]" />
                  <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.15em] text-[#717182]">
                    {t("staffAccount.personalAccount")}
                  </p>
                  {staffPersonalLinks.map(renderMobileLink)}
                </>
              ) : accountLinks.map(renderMobileLink)}

              <div className="mx-3 my-2 h-px bg-[#050505]/[0.07]" />

              <Button
                type="button"
                onClick={handleLogout}
                variant="tertiary"
                size="sm"
                data-testid="button-account-logout"
                className="h-auto w-full justify-start gap-3 rounded-[12px] px-3.5 py-3 text-left text-[14px] text-[#F44336] hover:bg-transparent hover:text-[#B42318] focus-visible:ring-[#F44336]/35"
              >
                <LogOut size={16} strokeWidth={1.8} />
                {t("common.logout")}
              </Button>
            </nav>
          </div>
        )}
      </div>

      <div className="hidden rounded-[24px] border border-[var(--xd-gold-active)]/15 bg-white/70 p-4 shadow-[0_12px_34px_rgba(5,5,5,0.04)] backdrop-blur lg:sticky lg:top-28 lg:block">
        <h2 className="px-3 text-[17px] font-bold text-[#050505]">
          {hasStaffAccess ? t("staffAccount.staffAccount") : t("common.myAccount")}
        </h2>
        {userDisplayName && (
          <div className="px-3 pb-4 pt-1">
            <p className="truncate text-[12px] font-semibold text-[#717182]">{userDisplayName}</p>
            {hasStaffAccess && (
              <span className="mt-2 inline-flex rounded-full border border-[var(--xd-gold-border)] bg-[var(--xd-gold-bg-soft)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--xd-gold-text)]">
                {staffRoleLabel}
              </span>
            )}
          </div>
        )}

        <nav className="flex flex-col gap-1">
          {hasStaffAccess ? (
            <>
              <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--xd-gold-text)]">
                {t("staffAccount.staffTools")}
              </p>
              {visibleStaffToolLinks.map(renderDesktopLink)}
              <div className="mx-3 my-3 h-px bg-[#050505]/[0.07]" />
              <p className="px-3 pb-1 pt-1 text-[11px] font-bold uppercase tracking-[0.15em] text-[#717182]">
                {t("staffAccount.personalAccount")}
              </p>
              {staffPersonalLinks.map(renderDesktopLink)}
            </>
          ) : accountLinks.map(renderDesktopLink)}

          <div className="mx-3 my-4 h-px bg-[#050505]/[0.07]" />

          <Button
            type="button"
            onClick={handleLogout}
            variant="tertiary"
            size="sm"
            data-testid="button-account-logout"
            className="h-auto justify-start gap-3 rounded-[12px] px-3.5 py-3 text-left text-[14px] text-[#F44336] hover:bg-[#F44336]/[0.08] hover:text-[#F44336] focus-visible:ring-[#F44336]/35"
          >
            <LogOut size={16} strokeWidth={1.8} />
            {t("common.logout")}
          </Button>
        </nav>
      </div>
    </aside>
  );
}
