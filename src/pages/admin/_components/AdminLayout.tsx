import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useStore } from "@/context/StoreContext";
import {
  BarChart3,
  Building2,
  ClipboardList,
  FileQuestion,
  FolderTree,
  Menu,
  MessagesSquare,
  Package,
  Search,
  Settings,
  ShoppingCart,
  Users,
  X,
} from "lucide-react";
import {
  adminBrands,
  adminCategories,
  adminOrders,
  adminProducts,
  adminQuotes,
  adminUsers,
} from "../admin-data";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
};

const navItems: NavItem[] = [
  { href: "/admin", label: "Overview", icon: BarChart3 },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/brands", label: "Brands", icon: Building2 },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/quotes", label: "Quotes", icon: FileQuestion },
  { href: "/admin/product-requests", label: "Product Requests", icon: ClipboardList },
  { href: "/admin/support", label: "Support Inbox", icon: MessagesSquare },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function isActiveRoute(location: string, href: string) {
  const pathname = location.split("?")[0];
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type AdminSearchGroup =
  | "Products"
  | "Brands"
  | "Categories"
  | "Orders"
  | "Quotes"
  | "Product Requests"
  | "Users";

type AdminSearchResult = {
  group: AdminSearchGroup;
  typeLabel: string;
  title: string;
  subtitle: string;
  href: string;
  searchValue: string;
  keywords: string[];
};

const adminSearchResults: AdminSearchResult[] = [
  ...adminProducts.map((product) => ({
    group: "Products" as const,
    typeLabel: "Product",
    title: product.name,
    subtitle: `${product.sku} - ${product.brand} - ${product.status}`,
    href: "/admin/products",
    searchValue: product.name,
    keywords: [product.name, product.sku, product.category, product.brand, product.status],
  })),
  ...adminBrands.map((brand) => ({
    group: "Brands" as const,
    typeLabel: "Brand",
    title: brand.name,
    subtitle: `${brand.country} - ${brand.status}`,
    href: "/admin/brands",
    searchValue: brand.name,
    keywords: [brand.name, brand.country, brand.status, brand.featured],
  })),
  ...adminCategories.map((category) => ({
    group: "Categories" as const,
    typeLabel: "Category",
    title: category.name,
    subtitle: `${category.slug} - ${category.status}`,
    href: "/admin/categories",
    searchValue: category.name,
    keywords: [category.name, category.slug, category.status],
  })),
  ...adminOrders.map((order) => ({
    group: "Orders" as const,
    typeLabel: "Order",
    title: order.id,
    subtitle: `${order.customer} - ${order.status}`,
    href: "/admin/orders",
    searchValue: order.id,
    keywords: [order.id, order.customer, order.status, order.total, order.date],
  })),
  ...adminQuotes.map((quote) => ({
    group: "Quotes" as const,
    typeLabel: "Quote",
    title: quote.id,
    subtitle: `${quote.clinic} - ${quote.status}`,
    href: "/admin/quotes",
    searchValue: quote.id,
    keywords: [quote.id, quote.clinic, quote.owner, quote.status, quote.date],
  })),
  ...adminUsers.map((user) => ({
    group: "Users" as const,
    typeLabel: "User",
    title: user.name,
    subtitle: `${user.email} - ${user.status}`,
    href: "/admin/users",
    searchValue: user.name,
    keywords: [user.id, user.name, user.role, user.email, user.status],
  })),
];

const quickActions = [
  { label: "Add Product", subtitle: "Open product management", href: "/admin/products" },
  { label: "Manage Products", subtitle: "View and filter the product list", href: "/admin/products" },
  { label: "Manage Brands", subtitle: "Review brand records", href: "/admin/brands" },
  { label: "View Orders", subtitle: "Check order queue", href: "/admin/orders" },
  { label: "View Quotes", subtitle: "Review quote requests", href: "/admin/quotes" },
  { label: "View Users", subtitle: "Manage admin user records", href: "/admin/users" },
];

const searchGroupOrder: AdminSearchGroup[] = [
  "Products",
  "Brands",
  "Categories",
  "Orders",
  "Quotes",
  "Product Requests",
  "Users",
];

function AdminNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const { currentUser } = useStore();
  const visibleItems = currentUser?.role === "support"
    ? navItems.filter((item) => item.href === "/admin/product-requests" || item.href === "/admin/support")
    : navItems;

  return (
    <nav className="space-y-1" aria-label="Admin navigation">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const isActive = isActiveRoute(location, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-[background-color,border-color,color,box-shadow] duration-200 ease-out ${
              isActive
                ? "border border-[#F9DC5C]/70 bg-[#FFF7D6] text-[#050505] shadow-sm"
                : "text-[#717182] hover:bg-[#FBFAF7] hover:text-[#050505]"
            }`}
          >
            <Icon size={18} className={isActive ? "text-[#D4A72C]" : "text-[#B88A44]/70"} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarContent() {
  return (
    <>
      <div className="border-b border-[#EFE2BC] px-6 py-5">
        <p className="text-lg font-black tracking-tight text-[#050505]">X Dental Store</p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#B88A44]">Admin Dashboard</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <AdminNavigation />
      </div>
    </>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const commandInputRef = useRef<HTMLInputElement | null>(null);
  const [location, navigate] = useLocation();
  const activeItem = navItems.find((item) => isActiveRoute(location, item.href));
  const trimmedCommandQuery = commandQuery.trim();
  const commandResults = useMemo(() => {
    const normalizedQuery = trimmedCommandQuery.toLowerCase();
    if (!normalizedQuery) return [];

    return adminSearchResults
      .filter((item) => item.keywords.some((keyword) => keyword.toLowerCase().includes(normalizedQuery)))
      .slice(0, 10);
  }, [trimmedCommandQuery]);
  const groupedCommandResults = useMemo(() => {
    return searchGroupOrder
      .map((group) => ({
        group,
        items: commandResults.filter((item) => item.group === group),
      }))
      .filter((section) => section.items.length > 0);
  }, [commandResults]);

  const openCommandPalette = () => {
    setIsCommandOpen(true);
  };

  const closeCommandPalette = () => {
    setIsCommandOpen(false);
  };

  const navigateToSearchResult = (item: AdminSearchResult) => {
    closeCommandPalette();
    setCommandQuery("");
    navigate(`${item.href}?search=${encodeURIComponent(item.searchValue)}`);
  };

  const handleCommandSubmit = () => {
    if (commandResults[0]) {
      navigateToSearchResult(commandResults[0]);
      return;
    }

    if (trimmedCommandQuery) {
      closeCommandPalette();
      navigate(`/admin/products?search=${encodeURIComponent(trimmedCommandQuery)}`);
    }
  };

  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openCommandPalette();
      }

      if (event.key === "Escape") {
        closeCommandPalette();
      }
    };

    document.addEventListener("keydown", handleKeyboardShortcut);
    return () => document.removeEventListener("keydown", handleKeyboardShortcut);
  }, []);

  useEffect(() => {
    if (isCommandOpen) {
      window.setTimeout(() => commandInputRef.current?.focus(), 0);
    }
  }, [isCommandOpen]);

  return (
    <div className="min-h-screen bg-[#FBFAF7] text-[#050505]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-[#EFE2BC] bg-white lg:flex">
        <SidebarContent />
      </aside>

      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close admin navigation"
            className="absolute inset-0 bg-[#050505]/35"
            onClick={() => setIsMobileOpen(false)}
          />
          <aside className="relative flex h-full w-[min(20rem,85vw)] flex-col border-r border-[#EFE2BC] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#EFE2BC] px-6 py-5">
              <div>
                <p className="text-lg font-black tracking-tight text-[#050505]">X Dental Store</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#B88A44]">Admin</p>
              </div>
              <button
                type="button"
                aria-label="Close admin navigation"
                className="rounded-lg border border-[#EFE2BC] p-2 text-[#717182] transition hover:bg-[#FFF7D6] hover:text-[#050505]"
                onClick={() => setIsMobileOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-5">
              <AdminNavigation onNavigate={() => setIsMobileOpen(false)} />
            </div>
          </aside>
        </div>
      )}

      <div className="min-h-screen lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-[#EFE2BC] bg-white/90 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              aria-label="Open admin navigation"
              className="rounded-lg border border-[#EFE2BC] p-2 text-[#717182] transition hover:bg-[#FFF7D6] hover:text-[#050505] lg:hidden"
              onClick={() => setIsMobileOpen(true)}
            >
              <Menu size={20} />
            </button>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#717182]">{activeItem?.label ?? "Admin"}</p>
            </div>

            <button
              type="button"
              onClick={openCommandPalette}
              onFocus={openCommandPalette}
              className="flex min-w-0 flex-[1.3] items-center gap-2 rounded-[14px] border border-[#050505]/10 bg-white/[0.65] px-3 py-2 text-left text-sm text-[#717182] transition hover:border-[#D4A72C]/45 hover:bg-white sm:max-w-md"
            >
              <Search size={16} className="shrink-0 text-[#D4A72C]" />
              <span className="min-w-0 flex-1 truncate">Search products, brands, orders, users...</span>
              <span className="hidden shrink-0 rounded-md border border-[#EFE2BC] bg-[#FFF9E8] px-1.5 py-0.5 text-[11px] font-bold text-[#B88A44] sm:inline">
                Ctrl K
              </span>
            </button>

            <div className="hidden rounded-full border border-[#EFE2BC] bg-[#FFF9E8] px-3 py-1.5 text-sm font-semibold text-[#050505] sm:block">
              Admin user
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>

      {isCommandOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-20 sm:pt-24">
          <button
            type="button"
            aria-label="Close admin search"
            className="absolute inset-0 bg-[#050505]/20"
            onClick={closeCommandPalette}
          />

          <section className="relative z-10 w-full max-w-[720px] overflow-hidden rounded-[22px] border border-[#EFE2BC] bg-white shadow-[0_28px_80px_rgba(5,5,5,0.16)]">
            <div className="flex items-center gap-3 border-b border-[#EFE2BC] px-4 py-3">
              <Search size={18} className="shrink-0 text-[#D4A72C]" />
              <input
                ref={commandInputRef}
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleCommandSubmit();
                  }
                }}
                placeholder="Search admin records..."
                className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-[#050505] outline-none placeholder:text-[#717182]"
              />
              <button
                type="button"
                aria-label="Close admin search"
                className="rounded-full p-1.5 text-[#717182] transition hover:bg-[#FFF7D6] hover:text-[#050505]"
                onClick={closeCommandPalette}
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[min(68vh,520px)] overflow-y-auto p-3">
              {!trimmedCommandQuery && (
                <div>
                  <p className="px-2 pb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#B88A44]">
                    Search across admin records
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {quickActions.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        onClick={() => {
                          closeCommandPalette();
                          navigate(action.href);
                        }}
                        className="rounded-[14px] border border-[#EFE2BC] bg-[#FBFAF7] px-3 py-3 text-left transition hover:border-[#D4A72C]/55 hover:bg-[#FFF9E8]"
                      >
                        <span className="block text-sm font-bold text-[#050505]">{action.label}</span>
                        <span className="mt-1 block text-xs text-[#717182]">{action.subtitle}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {trimmedCommandQuery && commandResults.length === 0 && (
                <div className="px-3 py-8 text-center">
                  <p className="text-sm font-bold text-[#050505]">No admin records found.</p>
                  <p className="mt-2 text-sm text-[#717182]">
                    Try a product name, SKU, order number, brand, or user email.
                  </p>
                </div>
              )}

              {trimmedCommandQuery && commandResults.length > 0 && (
                <div className="space-y-3">
                  {groupedCommandResults.map((section) => (
                    <div key={section.group}>
                      <p className="px-2 pb-1 text-xs font-bold uppercase tracking-[0.16em] text-[#B88A44]">
                        {section.group}
                      </p>
                      <div className="space-y-1">
                        {section.items.map((item) => (
                          <button
                            key={`${item.group}-${item.title}-${item.href}`}
                            type="button"
                            onClick={() => navigateToSearchResult(item)}
                            className="flex w-full min-w-0 items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition hover:bg-[#FBFAF7]"
                          >
                            <span className="shrink-0 rounded-full border border-[#F9DC5C]/70 bg-[#FFF7D6] px-2 py-0.5 text-[11px] font-bold text-[#B88A44]">
                              {item.typeLabel}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-bold text-[#050505]">{item.title}</span>
                              <span className="mt-0.5 block truncate text-xs text-[#717182]">{item.subtitle}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
