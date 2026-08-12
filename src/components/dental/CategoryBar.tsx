import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCatalog } from "@/context/CatalogContext";
import { useLanguage } from "@/context/LanguageContext";
import {
  getLocalizedCategoryName,
  getCategorySlugFromSearch,
} from "@/lib/catalogTranslations";
import { getCategoryIcon } from "@/lib/categoryIcons";
import type { CatalogCategoryNode } from "@/services/catalog";

const CLOSE_DELAY_MS = 120;

function subcategoryHref(mainSlug: string, subSlug: string) {
  return `/products?category=${encodeURIComponent(mainSlug)}&subcategory=${encodeURIComponent(subSlug)}`;
}

/**
 * Backend-driven category bar. Main categories come from the category tree
 * API; hovering a main category with subcategories opens a mega-menu panel
 * (desktop pointers only — touch devices navigate directly, and the products
 * page filter provides the accordion experience on mobile).
 */
export function CategoryBar() {
  const { language, t } = useLanguage();
  const { categoryTree } = useCatalog();
  const [location] = useLocation();
  const search = useSearch();
  const pathname = location.split("?")[0];
  const isProductsPage = pathname === "/products";
  const activeCategory = getCategorySlugFromSearch(search);

  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  // Close the panel on navigation.
  useEffect(() => {
    setOpenSlug(null);
  }, [location, search]);

  const openCategory = (slug: string, hasChildren: boolean) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenSlug(hasChildren ? slug : null);
  };

  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenSlug(null), CLOSE_DELAY_MS);
  };

  const openNode = useMemo(
    () => categoryTree.find((node) => node.slug === openSlug) ?? null,
    [categoryTree, openSlug]
  );

  if (categoryTree.length === 0) return null;

  return (
    <div className="w-full border-b border-[#050505]/[0] bg-[var(--xd-bg)]">
      <div className="px-5 sm:px-8 lg:px-12">
        <div className="relative mx-auto max-w-[1344px]" onMouseLeave={scheduleClose}>
          <div className="no-scrollbar touch-scroll-x -mx-3 -my-2 flex items-center gap-4 overflow-x-auto overflow-y-hidden px-3 py-6 sm:gap-6 lg:gap-8">
            {isProductsPage && (
              <BarItem
                slug="all"
                label={t("products.collections.all", { fallback: "All Products" })}
                href="/products"
                isActive={activeCategory === "all"}
                hasChildren={false}
                onEnter={() => openCategory("all", false)}
              />
            )}
            {categoryTree.map((node) => (
              <BarItem
                key={node.slug}
                slug={node.slug}
                label={getLocalizedCategoryName(node, language, t)}
                href={`/products?category=${encodeURIComponent(node.slug)}`}
                isActive={isProductsPage && activeCategory === node.slug}
                hasChildren={node.children.length > 0}
                onEnter={() => openCategory(node.slug, node.children.length > 0)}
              />
            ))}
          </div>

          <div className="pointer-events-none absolute right-0 top-0 h-full w-16 bg-gradient-to-l from-[var(--xd-bg)] to-transparent" />

          {openNode && openNode.children.length > 0 && (
            <div
              onMouseEnter={() => openCategory(openNode.slug, true)}
              onMouseLeave={scheduleClose}
              className="absolute left-0 right-0 top-full z-[60] hidden pt-1 lg:block"
            >
              <div className="overflow-hidden rounded-[20px] border border-[var(--xd-gold-border-soft)] bg-white/95 shadow-[0_28px_70px_rgba(5,5,5,0.14)] backdrop-blur-xl">
                <div className="flex items-center justify-between gap-4 border-b border-[#050505]/[0.06] px-7 py-4">
                  <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--xd-gold-active)]">
                    {getLocalizedCategoryName(openNode, language, t)}
                  </p>
                  <Link
                    href={`/products?category=${encodeURIComponent(openNode.slug)}`}
                    className="text-[12px] font-bold text-[#717182] transition hover:text-[var(--xd-gold-active)]"
                  >
                    {t("categoryBar.viewAll", { fallback: "View all" })}
                  </Link>
                </div>
                <div className="max-h-[420px] overflow-y-auto px-7 py-5">
                  <div className="gap-x-10 [column-fill:balance] md:columns-2 lg:columns-3 xl:columns-4">
                    {openNode.children.map((child) => (
                      <MegaMenuGroup key={child.slug} mainSlug={openNode.slug} node={child} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BarItem({
  slug,
  label,
  href,
  isActive,
  hasChildren,
  onEnter,
}: {
  slug: string;
  label: string;
  href: string;
  isActive: boolean;
  hasChildren: boolean;
  onEnter: () => void;
}) {
  const Icon = getCategoryIcon(slug);

  return (
    <Link
      href={href}
      onMouseEnter={onEnter}
      onFocus={onEnter}
      className={cn(
        "group relative flex shrink-0 items-center gap-2 whitespace-nowrap bg-transparent py-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)]",
        isActive ? "text-[var(--xd-gold-active)]" : "text-[#717182] hover:text-[var(--xd-gold-active)]"
      )}
    >
      <Icon size={16} className="xd-premium-icon text-current transition-colors" />
      <span
        className={cn(
          "text-[13px] transition-colors",
          isActive ? "font-bold text-[#050505]" : "font-medium text-current group-hover:text-[var(--xd-gold-active)]"
        )}
      >
        {label}
      </span>
      {hasChildren && (
        <ChevronDown size={12} className="hidden text-current opacity-60 lg:block" aria-hidden="true" />
      )}
      {isActive && (
        <span className="xd-gradient-gold absolute -bottom-4 left-0 right-0 h-[2px] rounded-full" />
      )}
    </Link>
  );
}

/**
 * One subcategory entry in the mega-menu. Subcategories that have their own
 * children render as a small group: the subcategory as a header link with its
 * children indented beneath it.
 */
function MegaMenuGroup({ mainSlug, node }: { mainSlug: string; node: CatalogCategoryNode }) {
  const { language, t } = useLanguage();
  const label = getLocalizedCategoryName(node, language, t);

  if (node.children.length === 0) {
    return (
      <Link
        href={subcategoryHref(mainSlug, node.slug)}
        className="block break-inside-avoid rounded-[8px] py-1.5 text-[13px] font-medium leading-5 text-[#3A3A3A] transition hover:text-[var(--xd-gold-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)]"
      >
        {label}
      </Link>
    );
  }

  return (
    <div className="break-inside-avoid pb-2">
      <Link
        href={subcategoryHref(mainSlug, node.slug)}
        className="block rounded-[8px] py-1.5 text-[13px] font-bold leading-5 text-[#050505] transition hover:text-[var(--xd-gold-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)]"
      >
        {label}
      </Link>
      <div className="border-s border-[#050505]/[0.08] ps-3">
        {node.children.map((child) => (
          <Link
            key={child.slug}
            href={subcategoryHref(mainSlug, child.slug)}
            className="block rounded-[8px] py-1 text-[12.5px] font-medium leading-5 text-[#717182] transition hover:text-[var(--xd-gold-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)]"
          >
            {getLocalizedCategoryName(child, language, t)}
          </Link>
        ))}
      </div>
    </div>
  );
}
