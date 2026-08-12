import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { Link, useLocation } from "wouter";
import { useStore } from "@/context/StoreContext";
import { useLanguage } from "@/context/LanguageContext";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { NotificationDropdown } from "@/components/dental/NotificationDropdown";
import { ThemeToggle } from "@/components/dental/ThemeToggle";
import { ACCOUNT_REQUESTS_REFRESH_EVENT } from "@/lib/accountRequestWorkflow";
import { getAdminAccountActionRequestAttentionCount } from "@/services/adminAccountActionRequests";
import {
  BarChart3,
  Building2,
  CalendarClock,
  ClipboardList,
  Coins,
  FileQuestion,
  FolderTree,
  Menu,
  MessagesSquare,
  MapPinned,
  Package,
  Settings,
  ShoppingCart,
  Tags,
  Users,
  UserRoundCog,
  UploadCloud,
  History,
  X,
  Zap,
  Images,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  labelKey?: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  permission?: string;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { href: "/admin", label: "Overview", labelKey: "admin.shell.overview", icon: BarChart3, adminOnly: true },
  { href: "/admin/products", label: "Products", labelKey: "admin.shell.products", icon: Package, adminOnly: true },
  { href: "/admin/catalog-import", label: "Catalog Import", labelKey: "admin.shell.catalogImport", icon: UploadCloud, adminOnly: true },
  { href: "/admin/catalog-import/history", label: "Import History", labelKey: "admin.shell.catalogImportHistory", icon: History, adminOnly: true },
  { href: "/admin/flash-sale", label: "Flash Sale", labelKey: "admin.shell.flashSale", icon: Zap, adminOnly: true },
  { href: "/admin/coupons", label: "Coupons", labelKey: "admin.shell.coupons", icon: Tags, adminOnly: true },
  {
    href: "/admin/hero-slider",
    label: "Hero Slider",
    labelKey: "admin.heroSlider.nav",
    icon: Images,
    adminOnly: true,
  },
  {
    href: "/admin/scheduled-promotions",
    label: "Scheduled Promotions",
    labelKey: "admin.scheduledPromotions.nav",
    icon: CalendarClock,
    adminOnly: true,
  },
  {
    href: "/admin/delivery",
    label: "Delivery Offers",
    labelKey: "admin.delivery.nav",
    icon: MapPinned,
    adminOnly: true,
  },
  { href: "/admin/categories", label: "Categories", labelKey: "admin.shell.categories", icon: FolderTree, adminOnly: true },
  { href: "/admin/brands", label: "Brands", labelKey: "admin.shell.brands", icon: Building2, adminOnly: true },
  { href: "/admin/orders", label: "Orders", labelKey: "admin.shell.orders", icon: ShoppingCart, permission: "ORDERS_VIEW" },
  { href: "/admin/quotes", label: "Quotes", labelKey: "admin.shell.quotes", icon: FileQuestion, permission: "QUOTES_VIEW" },
  { href: "/admin/product-requests", label: "Product Requests", labelKey: "admin.shell.productRequests", icon: ClipboardList, permission: "PRODUCT_REQUESTS_VIEW" },
  { href: "/admin/support", label: "Support Inbox", labelKey: "admin.shell.supportInbox", icon: MessagesSquare, permission: "SUPPORT_INBOX_VIEW" },
  { href: "/admin/account-requests", label: "Account Requests", labelKey: "admin.shell.accountRequests", icon: UserRoundCog, permission: "ACCOUNT_REQUESTS_VIEW" },
  { href: "/admin/loyalty", label: "Loyalty & Wallet", labelKey: "admin.shell.loyalty", icon: Coins, permission: "LOYALTY_VIEW" },
  { href: "/admin/users", label: "Users", labelKey: "admin.shell.users", icon: Users, permission: "USERS_VIEW" },
  { href: "/admin/settings", label: "Settings", labelKey: "admin.shell.settings", icon: Settings, adminOnly: true },
];

function isActiveRoute(location: string, href: string) {
  const pathname = location.split("?")[0];
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Some nav hrefs are prefixes of a sibling href (e.g. "/admin/catalog-import"
 * and "/admin/catalog-import/history"), so more than one can match the same
 * pathname via isActiveRoute's prefix check. Only the longest (most
 * specific) match should ever render as active.
 */
function findActiveNavHref(location: string, items: NavItem[]) {
  return items
    .filter((item) => isActiveRoute(location, item.href))
    .reduce<string | undefined>((longest, item) => (!longest || item.href.length > longest.length ? item.href : longest), undefined);
}

function AdminNavigation({
  onNavigate,
  accountRequestAttentionCount,
}: {
  onNavigate?: () => void;
  accountRequestAttentionCount: number;
}) {
  const [location] = useLocation();
  const { currentUser } = useStore();
  const { t } = useLanguage();
  const visibleItems = currentUser?.role === "support"
    ? navItems.filter(
        (item) =>
          !item.adminOnly &&
          (!item.permission || currentUser.permissions?.includes(item.permission))
      )
    : navItems;

  const activeHref = findActiveNavHref(location, visibleItems);

  return (
    <nav className="space-y-1" aria-label={t("admin.shell.navigation")}>
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.href === activeHref;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-[background-color,border-color,color,box-shadow] duration-200 ease-out ${
              isActive
                ? "border border-[#F9DC5C]/70 bg-[#FFF7D6] text-[#050505] shadow-sm dark:border-[#D4A72C]/50 dark:bg-[#D4A72C]/15 dark:text-[#F6D85D]"
                : "text-[#717182] hover:bg-[#FBFAF7] hover:text-[#050505] dark:hover:bg-white/[0.05] dark:hover:text-[#F6D85D]"
            }`}
          >
            <Icon size={18} className={isActive ? "text-[#D4A72C]" : "text-[#B88A44]/70"} />
            <span className="min-w-0 flex-1">
              {item.labelKey
                ? t(item.labelKey, { fallback: item.label })
                : item.label}
            </span>
            {item.href === "/admin/account-requests"
              && accountRequestAttentionCount > 0 && (
                <span
                  className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#F9DC5C] px-1.5 py-0.5 text-[10px] font-black leading-4 text-[#27210D]"
                  aria-label={t("admin.accountRequests.attentionBadgeLabel", {
                    values: { count: accountRequestAttentionCount },
                  })}
                >
                  {accountRequestAttentionCount > 99
                    ? "99+"
                    : accountRequestAttentionCount}
                </span>
              )}
          </Link>
        );
      })}
    </nav>
  );
}

function BackToAccountLink({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useLanguage();
  return (
    <Link
      href="/account/dashboard"
      onClick={onNavigate}
      className="flex items-center gap-3 rounded-lg border border-[#EFE2BC] bg-[#FBFAF7] px-3 py-2.5 text-sm font-semibold text-[#717182] transition hover:border-[#D4A72C]/45 hover:bg-[#FFF7D6] hover:text-[#050505] dark:hover:border-[#D4A72C]/40 dark:hover:bg-white/[0.05] dark:hover:text-[#F6D85D]"
    >
      <DirectionalIcon direction="back" size={18} className="text-[#B88A44]" />
      <span>{t("admin.backToAccount")}</span>
    </Link>
  );
}

function SidebarContent({
  accountRequestAttentionCount,
}: {
  accountRequestAttentionCount: number;
}) {
  const { t } = useLanguage();
  return (
    <>
      <div className="border-b border-[#EFE2BC] px-6 py-5">
        <p className="text-lg font-black tracking-tight text-[#050505]">X Dental Store</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#B88A44]">
          {t("admin.shell.dashboard")}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <AdminNavigation
          accountRequestAttentionCount={accountRequestAttentionCount}
        />
      </div>
      <div className="border-t border-[#EFE2BC] p-4">
        <BackToAccountLink />
      </div>
    </>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const { currentUser } = useStore();
  const { isRtl, t } = useLanguage();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [accountRequestAttentionCount, setAccountRequestAttentionCount] =
    useState(0);
  const attentionRequestSequence = useRef(0);
  const [location] = useLocation();
  const activeItem = navItems.find((item) => item.href === findActiveNavHref(location, navItems));
  const canViewAccountRequests =
    currentUser?.role === "admin"
    || (
      currentUser?.role === "support"
      && currentUser.permissions?.includes("ACCOUNT_REQUESTS_VIEW")
    );

  const refreshAccountRequestAttentionCount = useCallback(() => {
    if (!canViewAccountRequests) {
      setAccountRequestAttentionCount(0);
      return;
    }

    const sequence = ++attentionRequestSequence.current;
    void getAdminAccountActionRequestAttentionCount()
      .then(({ count }) => {
        if (sequence === attentionRequestSequence.current) {
          setAccountRequestAttentionCount(count);
        }
      })
      .catch(() => {
        // Keep the last known count. The Account Requests page still remains usable.
      });
  }, [canViewAccountRequests]);

  useEffect(() => {
    refreshAccountRequestAttentionCount();

    const handleFocus = () => refreshAccountRequestAttentionCount();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshAccountRequestAttentionCount();
      }
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener(
      ACCOUNT_REQUESTS_REFRESH_EVENT,
      handleFocus
    );
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(
        ACCOUNT_REQUESTS_REFRESH_EVENT,
        handleFocus
      );
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refreshAccountRequestAttentionCount]);

  useEffect(() => {
    document.documentElement.classList.add("xd-admin-page-active");
    document.body.classList.add("xd-admin-page-active");
    return () => {
      document.documentElement.classList.remove("xd-admin-page-active");
      document.body.classList.remove("xd-admin-page-active");
    };
  }, []);

  return (
    <div className="admin-dashboard flex h-dvh min-h-0 w-full overflow-hidden bg-[#FBFAF7] text-[#050505]">
      <aside
        className={`fixed inset-y-0 z-40 hidden h-dvh w-72 flex-col overflow-hidden border-[#EFE2BC] bg-white lg:flex ${
          isRtl ? "right-0 border-l" : "left-0 border-r"
        }`}
      >
        <SidebarContent
          accountRequestAttentionCount={accountRequestAttentionCount}
        />
      </aside>

      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            aria-label={t("admin.shell.closeNavigation")}
            className="absolute inset-0 bg-[#050505]/35"
            onClick={() => setIsMobileOpen(false)}
          />
          <aside
            className={`relative flex h-dvh w-[min(20rem,85vw)] flex-col overflow-hidden border-[#EFE2BC] bg-white shadow-xl ${
              isRtl ? "border-l" : "border-r"
            }`}
          >
            <div className="flex items-center justify-between border-b border-[#EFE2BC] px-6 py-5">
              <div>
                <p className="text-lg font-black tracking-tight text-[#050505]">X Dental Store</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#B88A44]">
                  {t("admin.shell.admin")}
                </p>
              </div>
              <button
                type="button"
                aria-label={t("admin.shell.closeNavigation")}
                className="rounded-lg border border-[#EFE2BC] p-2 text-[#717182] transition hover:bg-[#FFF7D6] hover:text-[#050505] dark:hover:border-[#D4A72C]/40 dark:hover:bg-white/[0.05] dark:hover:text-[#F6D85D]"
                onClick={() => setIsMobileOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-5">
              <AdminNavigation
                onNavigate={() => setIsMobileOpen(false)}
                accountRequestAttentionCount={accountRequestAttentionCount}
              />
            </div>
            <div className="border-t border-[#EFE2BC] p-4">
              <BackToAccountLink onNavigate={() => setIsMobileOpen(false)} />
            </div>
          </aside>
        </div>
      )}

      <div className={`flex h-dvh min-w-0 flex-1 flex-col ${isRtl ? "lg:pr-72" : "lg:pl-72"}`}>
        <header className="z-30 shrink-0 border-b border-[#EFE2BC] bg-white/90 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              aria-label={t("admin.shell.openNavigation")}
              className="rounded-lg border border-[#EFE2BC] p-2 text-[#717182] transition hover:bg-[#FFF7D6] hover:text-[#050505] dark:hover:border-[#D4A72C]/40 dark:hover:bg-white/[0.05] dark:hover:text-[#F6D85D] lg:hidden"
              onClick={() => setIsMobileOpen(true)}
            >
              <Menu size={20} />
            </button>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#717182]">
                {activeItem?.labelKey
                  ? t(activeItem.labelKey, { fallback: activeItem.label })
                  : activeItem?.label ?? t("admin.shell.admin")}
              </p>
            </div>

            {canViewAccountRequests && (
              <NotificationDropdown
                actionClassName="h-9 w-9 rounded-lg shadow-none"
                viewAllHref="/admin/account-requests"
                viewAllLabel={t("admin.accountRequests.viewAccountRequests")}
              />
            )}

            <ThemeToggle className="h-9 w-9 rounded-lg shadow-none" />

            <div className="hidden rounded-full border border-[#EFE2BC] bg-[#FFF9E8] px-3 py-1.5 text-sm font-semibold text-[#050505] sm:block">
              {currentUser?.name || currentUser?.email}
            </div>
          </div>
        </header>

        <main
          id="admin-main-scroll"
          data-admin-main-scroll=""
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        >
          {children}
        </main>
      </div>

    </div>
  );
}
