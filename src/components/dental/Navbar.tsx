import { useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, ShoppingCart, Search, Menu, X, Globe, User } from "lucide-react";
import { BrandLogo } from "@/components/dental/BrandLogo";
import { Button } from "@/components/dental/Button";
import { GlobalSearch } from "@/components/dental/GlobalSearch";
import { useStore } from "@/context/StoreContext";
import { useLanguage } from "@/context/LanguageContext";
import { useClickOutside } from "@/hooks/use-click-outside";
import { formatUserDisplayName } from "@/lib/userDisplayName";

const NAV_LINKS = [
  { labelKey: "nav.home", href: "/" },
  { labelKey: "nav.products", href: "/products" },
  { labelKey: "nav.categories", href: "/categories" },
  { labelKey: "nav.brands", href: "/brands" },
  { labelKey: "nav.about", href: "/about" },
  { labelKey: "nav.contact", href: "/contact" },
];

export function Navbar() {
  const { cartCount, wishlistIds, isAuthenticated, isAuthLoading, currentUser } = useStore();
  const { t, toggleLanguage, language } = useLanguage();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const mobileNavRef = useRef<HTMLElement>(null);
  useClickOutside(mobileNavRef, () => setMobileOpen(false), {
    enabled: mobileOpen,
  });
  const badgeClassName =
    "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--xd-gold)] px-1 text-[9px] font-bold leading-none text-[#050505]";
  const compactActionClassName =
    "h-10 w-10 rounded-full text-[#050505] hover:bg-[var(--xd-gold-bg-soft)]";
  const mobileMenuItemClassName =
    "flex h-11 items-center justify-between rounded-xl px-3 text-[15px] font-medium text-[#050505] transition-colors hover:bg-[var(--xd-gold-bg-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]";
  const userDisplayName = formatUserDisplayName(currentUser, language);
  const userInitials =
    currentUser?.name
      ?.split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "XD";

  return (
    <header
      ref={mobileNavRef}
      className="sticky top-0 z-50 w-full"
      style={{
        background: "rgba(251,250,247,0.8)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(5,5,5,0.06)",
      }}
    >
      <div className="px-5 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[1344px]">
          <div className="flex items-center justify-between" style={{ height: 76 }}>

          {/* Logo: gold square icon + wordmark */}
          <BrandLogo textClassName="font-semibold tracking-tight leading-none text-[var(--xd-text)]" />

          {/* Desktop nav */}
          <nav className="hidden items-center gap-5 lg:flex xl:gap-8">
            {NAV_LINKS.map(({ labelKey, href }) => {
              const isActive = href === "/" ? location === "/" : location.startsWith(href) && href !== "/";
              return (
                <Link
                  key={labelKey}
                  href={href}
                  className="relative text-[14px] font-medium transition-colors focus-visible:outline-none"
                  style={{ color: isActive ? "var(--xd-text)" : "#5A5A5A" }}
                >
                  {t(labelKey)}
                  {isActive && (
                    <span
                      className="absolute -bottom-[6px] left-0 right-0 h-[2px] rounded-full"
                      style={{ background: "var(--xd-gold)" }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            {/* Search icon button */}
            <Button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                setSearchOpen(true);
              }}
              variant="tertiary"
              size="icon"
              className={`${compactActionClassName} text-[#5A5A5A]`}
              aria-label={t("nav.search")}
              data-testid="button-search"
            >
              <Search size={18} strokeWidth={1.75} />
            </Button>

            {/* Language toggle */}
            <Button
              type="button"
              onClick={toggleLanguage}
              variant="tertiary"
              size="sm"
              className="hidden h-10 rounded-full border-0 bg-transparent px-2.5 text-[14px] font-semibold text-[#050505] shadow-none hover:bg-[var(--xd-gold-bg-soft)] hover:text-[#050505] lg:inline-flex"
              data-testid="button-language"
              aria-label="Toggle language"
            >
              {t("nav.language")}
            </Button>

            <Button
              asChild
              variant="tertiary"
              size="icon"
              className={`relative hidden ${compactActionClassName} lg:inline-flex`}
            >
              <Link href="/account/wishlist" data-testid="link-wishlist" aria-label={t("nav.wishlist")}>
                <Heart size={18} strokeWidth={1.75} />
                {wishlistIds.length > 0 && (
                  <span className={badgeClassName}>
                    {wishlistIds.length}
                  </span>
                )}
              </Link>
            </Button>

            {/* Cart */}
            <Button
              asChild
              variant="tertiary"
              size="icon"
              className={`relative ${compactActionClassName}`}
            >
              <Link href="/cart" data-testid="link-cart">
                <ShoppingCart size={19} strokeWidth={1.75} />
                {cartCount > 0 && (
                  <span className={badgeClassName}>
                    {cartCount}
                  </span>
                )}
              </Link>
            </Button>

            {/* Auth/account action */}
            <div className="hidden h-10 w-[82px] items-center justify-end lg:flex">
              {isAuthLoading ? (
                <span
                  className="h-10 w-10 animate-pulse rounded-full bg-[#050505]/[0.07]"
                  aria-hidden="true"
                  data-testid="auth-loading-placeholder"
                />
              ) : isAuthenticated ? (
                <Button
                  asChild
                  variant="tertiary"
                  size="icon"
                  className={compactActionClassName}
                >
                  <Link
                    href="/account/dashboard"
                    data-testid="link-account"
                    aria-label={userDisplayName || t("nav.account")}
                  >
                    <User size={20} strokeWidth={1.75} />
                  </Link>
                </Button>
              ) : (
                <Button
                  asChild
                  variant="primary"
                  size="sm"
                  className="h-10 px-4 text-[13px]"
                >
                  <Link href="/signin" data-testid="link-sign-in">{t("nav.signIn")}</Link>
                </Button>
              )}
            </div>

            {/* Mobile menu */}
            <Button
              type="button"
              onClick={() => setMobileOpen(o => !o)}
              variant="tertiary"
              size="icon"
              className={`${compactActionClassName} lg:hidden`}
              data-testid="button-mobile-menu"
              aria-label={t("nav.toggleMenu")}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </Button>
          </div>
        </div>
      </div>
      </div>

      {/* Mobile dropdown */}
      <AnimatePresence initial={false}>
        {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="px-5 pb-6 pt-2 sm:px-8 lg:hidden"
          style={{ borderTop: "1px solid rgba(5,5,5,0.06)" }}
        >
          <nav className="mx-auto flex max-w-[1344px] flex-col gap-1">
            {NAV_LINKS.map(({ labelKey, href }) => (
              <Link
                key={labelKey}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={mobileMenuItemClassName}
              >
                <span>{t(labelKey)}</span>
              </Link>
            ))}
            <Link
              href="/account/wishlist"
              onClick={() => setMobileOpen(false)}
              className={mobileMenuItemClassName}
            >
              <span className="inline-flex items-center gap-3">
                <Heart size={17} strokeWidth={1.75} />
                {t("nav.wishlist")}
              </span>
              {wishlistIds.length > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--xd-gold)] px-1.5 text-[10px] font-bold text-[#050505]">
                  {wishlistIds.length}
                </span>
              )}
            </Link>
            {isAuthLoading ? (
              <div className={mobileMenuItemClassName} aria-hidden="true">
                <span className="inline-flex items-center gap-3">
                  <span className="h-7 w-7 animate-pulse rounded-full bg-[#050505]/[0.07]" />
                  <span className="h-3 w-24 animate-pulse rounded-full bg-[#050505]/[0.07]" />
                </span>
              </div>
            ) : (
              <Link
                href={isAuthenticated ? "/account/dashboard" : "/signin"}
                onClick={() => setMobileOpen(false)}
                className={mobileMenuItemClassName}
              >
                <span className="inline-flex min-w-0 items-center gap-3">
                  {isAuthenticated ? (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--xd-gold)] text-[11px] font-bold text-[#050505]">
                      {userInitials}
                    </span>
                  ) : (
                    <User size={17} strokeWidth={1.75} />
                  )}
                  <span className="truncate">
                    {isAuthenticated ? userDisplayName || t("nav.account") : t("nav.signIn")}
                  </span>
                </span>
              </Link>
            )}
            <Button
              type="button"
              onClick={toggleLanguage}
              variant="tertiary"
              size="sm"
              className="mt-2 h-11 justify-start gap-3 rounded-xl border-0 bg-transparent px-3 text-[15px] font-semibold text-[#050505] shadow-none hover:bg-[var(--xd-gold-bg-soft)] hover:text-[#050505]"
            >
              <Globe size={16} />
              {t("nav.language")}
            </Button>
          </nav>
        </motion.div>
        )}
      </AnimatePresence>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
