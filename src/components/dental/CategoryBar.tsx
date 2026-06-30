import { Link, useLocation, useSearch } from "wouter";
import {
  Activity,
  Disc,
  Droplet,
  FileText,
  Hexagon,
  Pill,
  Scissors,
  ScanLine,
  Shield,
  ShoppingBag,
  Smile,
  Wind,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import { getCategorySlugFromSearch } from "@/lib/catalogTranslations";

type CategoryItem = {
  labelKey?: string;
  label?: string;
  slug: string;
  icon: LucideIcon;
};

const CATEGORIES: CategoryItem[] = [
  { labelKey: "categoryBar.endodontics",      slug: "endodontics",               icon: Activity    },
  { labelKey: "categoryBar.restorative",      slug: "composites-bonding",        icon: Droplet     },
  { labelKey: "categoryBar.orthodontics",     slug: "orthodontics",              icon: Smile       },
  { labelKey: "categoryBar.instruments",      slug: "hand-instruments",          icon: Wrench      },
  { labelKey: "categoryBar.consumables",      slug: "sterilization-disposables", icon: ShoppingBag },
  { labelKey: "categoryBar.equipment",        slug: "equipment",                 icon: Hexagon     },
  { labelKey: "categoryBar.surgery",          slug: "surgery",                   icon: Scissors    },
  { labelKey: "categoryBar.implantology",     slug: "implantology",              icon: Pill        },
  { labelKey: "categoryBar.infectionControl", slug: "infection-control",         icon: Shield      },
  { labelKey: "categoryBar.clinicEssentials", slug: "clinic-essentials",         icon: FileText    },
  { label: "Whitening",          slug: "whitening",        icon: Zap      },
  { label: "Periodontics",       slug: "periodontics",     icon: Wind     },
  { label: "Radiology & Imaging", slug: "radiology-imaging", icon: ScanLine },
  { label: "Burs & Rotary",      slug: "burs-rotary",      icon: Disc     },
];

const PRODUCTS_ALL_CATEGORY: CategoryItem = {
  labelKey: "products.collections.all",
  slug: "all",
  icon: ShoppingBag,
};

export function CategoryBar() {
  const { t } = useLanguage();
  const [location] = useLocation();
  const search = useSearch();
  const pathname = location.split("?")[0];
  const isProductsPage = pathname === "/products";
  const activeCategory = getCategorySlugFromSearch(search);
  const categories = isProductsPage ? [PRODUCTS_ALL_CATEGORY, ...CATEGORIES] : CATEGORIES;
//bg-[var(--xd-bg)] 
  return (
    <div className="w-full border-b border-[#050505]/[0] bg-[var(--xd-bg)] "> 
      <div className="px-5 sm:px-8 lg:px-12">
        <div className="relative mx-auto max-w-[1344px]">
          <div className="no-scrollbar touch-scroll-x flex items-center gap-4 overflow-x-auto overflow-y-hidden py-4 sm:gap-6 lg:gap-8">
            {categories.map(({ labelKey, label, slug, icon: Icon }) => {
              const isActive = isProductsPage && activeCategory === slug;
              const href = slug === "all" ? "/products" : `/products?category=${slug}`;
              const displayLabel = label ?? (labelKey ? t(labelKey) : slug);

              return (
                <Link
                  key={slug}
                  href={href}
                  className={cn(
                    "group relative flex shrink-0 items-center gap-2 whitespace-nowrap bg-transparent py-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)]",
                    isActive ? "text-[var(--xd-gold-active)]" : "text-[#717182] hover:text-[var(--xd-gold-active)]"
                  )}
                >
                  <Icon
                    size={16}
                    className="text-current transition-colors"
                  />
                  <span
                    className={cn(
                      "text-[13px] transition-colors",
                      isActive ? "font-bold text-[#050505]" : "font-medium text-current group-hover:text-[var(--xd-gold-active)]"
                    )}
                  >
                    {displayLabel}
                  </span>
                  {isActive && (
                    <span className="absolute -bottom-4 left-0 right-0 h-[2px] rounded-full bg-[var(--xd-gold)]" />
                  )}
                </Link>
              );
            })}
          </div>

          <div className="pointer-events-none absolute right-0 top-0 h-full w-16 bg-gradient-to-l from-[var(--xd-bg)] to-transparent" />
        </div>
      </div>
    </div>
  );
}
