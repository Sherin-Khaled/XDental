import type { CatalogBrand, CatalogCategory } from "@/services/catalog";
import type { Product } from "@/types/product";
import {
  getCategoryTranslationKey,
  getLocalizedCategoryName,
  getLocalizedProductName,
  normalizeCategorySlug,
} from "@/lib/catalogTranslations";

type Translate = (
  key: string,
  options?: { fallback?: string; values?: Record<string, string | number> }
) => string;

export type GlobalSearchType = "product" | "category" | "brand" | "page";

export type GlobalSearchItem = {
  id: string;
  type: GlobalSearchType;
  title: string;
  metadata: string;
  href: string;
  image?: string;
  requiresAuth?: boolean;
  priority: number;
  suggested?: boolean;
  searchValues: string[];
};

export type GlobalSearchResult = GlobalSearchItem & {
  score: number;
  matchText?: string;
};

export type GlobalSearchResults = Record<GlobalSearchType, GlobalSearchResult[]>;

const resultLimits: Record<GlobalSearchType, number> = {
  product: 5,
  category: 4,
  brand: 4,
  page: 4,
};

const websitePages = [
  { id: "home", titleKey: "nav.home", fallback: "Home", href: "/", suggested: true },
  { id: "products", titleKey: "nav.products", fallback: "Products", href: "/products", suggested: true },
  { id: "categories", titleKey: "nav.categories", fallback: "Categories", href: "/categories" },
  { id: "brands", titleKey: "nav.brands", fallback: "Brands", href: "/brands" },
  { id: "about", titleKey: "nav.about", fallback: "About", href: "/about" },
  { id: "contact", titleKey: "nav.contact", fallback: "Contact", href: "/contact" },
  { id: "cart", titleKey: "nav.cart", fallback: "Cart", href: "/cart" },
  { id: "sign-in", titleKey: "nav.signIn", fallback: "Sign In", href: "/signin" },
  { id: "create-account", titleKey: "globalSearch.pages.createAccount", fallback: "Create Account", href: "/signup" },
];

const accountPages = [
  { id: "account-dashboard", titleKey: "globalSearch.pages.accountDashboard", fallback: "Account Dashboard", href: "/account/dashboard", suggested: true },
  { id: "profile", titleKey: "account.profile", fallback: "Profile", href: "/account/profile" },
  { id: "orders", titleKey: "account.myOrders", fallback: "My Orders", href: "/account/orders" },
  { id: "wishlist", titleKey: "account.wishlist", fallback: "Wishlist", href: "/account/wishlist" },
  { id: "supply-lists", titleKey: "account.mySupplyLists", fallback: "My Supply Lists", href: "/account/supply-lists", suggested: true },
  { id: "clinic-locations", titleKey: "account.clinicLocations", fallback: "Clinic Locations", href: "/account/clinic-branches" },
  { id: "address-book", titleKey: "account.addressBook", fallback: "Address Book", href: "/account/address-book" },
  { id: "quotes", titleKey: "account.quotes", fallback: "Quotes", href: "/account/quotes", suggested: true, keywords: ["Request Quote", "Request a Quote"] },
  { id: "product-requests", titleKey: "account.productRequests", fallback: "Product Requests", href: "/account/product-requests" },
  { id: "notifications", titleKey: "account.notifications", fallback: "Notifications", href: "/account/notifications" },
  { id: "wallet", titleKey: "account.walletPoints", fallback: "Wallet & Points", href: "/account/wallet" },
  { id: "support", titleKey: "account.supportTickets", fallback: "Support Tickets", href: "/account/support" },
  { id: "settings", titleKey: "account.settings", fallback: "Settings", href: "/account/settings" },
];

function formatPrice(price: number) {
  return `EGP ${new Intl.NumberFormat("en-US").format(price)}`;
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/&/g, "and").replace(/[\s_]+/g, "-");
}

function uniqueBySlug<T extends { slug: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.slug)) return false;
    seen.add(item.slug);
    return true;
  });
}

/** Builds a single product's search index entry. Exported so callers with a
 * small, server-fetched product list (not the full catalogue) can build
 * matching entries for the "product" result group without needing the
 * full-catalogue path through {@link buildGlobalSearchIndex}. */
export function buildProductSearchItem(
  product: Product,
  index: number,
  t: Translate,
  language: "en" | "ar"
): GlobalSearchItem {
  const title = getLocalizedProductName(product, language, t);
  const category = t(getCategoryTranslationKey(product.category), {
    fallback: t(`products.items.${product.id}.category`, { fallback: product.category }),
  });
  const price = formatPrice(product.currentPrice);

  return {
    id: product.id,
    type: "product",
    title,
    metadata: t("globalSearch.metadata.product", {
      fallback: "Product - {category} - {price}",
      values: { category, price },
    }),
    href: `/products/${product.slug || product.id}`,
    image: product.image,
    priority: product.isBestSeller ? 80 - index : 50 - index,
    suggested: product.isBestSeller || product.isWeeklyOffer,
    searchValues: [
      title,
      product.name,
      product.brand,
      product.category,
      category,
      product.sku ?? "",
    ],
  };
}

export function buildGlobalSearchIndex(
  t: Translate,
  language: "en" | "ar",
  catalogProducts: Product[],
  catalogCategories: CatalogCategory[],
  catalogBrands: CatalogBrand[]
): GlobalSearchItem[] {
  const products = catalogProducts.map((product, index) => buildProductSearchItem(product, index, t, language));

  const categories = uniqueBySlug(catalogCategories).map<GlobalSearchItem>(
    (category, index) => {
      const slug = normalizeCategorySlug(category.slug);
      const title = getLocalizedCategoryName(category, language, t);

      return {
        id: category.id,
        type: "category",
        title,
        metadata: t("globalSearch.metadata.category", { fallback: "Category" }),
        href: `/products?category=${encodeURIComponent(slug)}`,
        priority: 70 - index,
        suggested: ["endodontics", "clinic-essentials", "infection-control"].includes(slug),
        searchValues: [title, category.name, category.slug, slug],
      };
    }
  );

  const brands = catalogBrands.map<GlobalSearchItem>((brand, index) => ({
    id: brand.id,
    type: "brand",
    title: brand.name,
    metadata: t("globalSearch.metadata.brand", { fallback: "Brand" }),
    href: `/products?brand=${encodeURIComponent(brand.slug)}`,
    priority: brand.featured ? 70 - index : 40 - index,
    suggested: brand.featured,
    searchValues: [brand.name, brand.slug, slugify(brand.name), brand.country ?? ""],
  }));

  const pages = [
    ...websitePages.map((page, index) => {
      const title = t(page.titleKey, { fallback: page.fallback });

      return {
        id: page.id,
        type: "page" as const,
        title,
        metadata: t("globalSearch.metadata.page", { fallback: "Page" }),
        href: page.href,
        priority: 60 - index,
        suggested: page.suggested,
        searchValues: [title, page.fallback, page.href],
      };
    }),
    ...accountPages.map((page, index) => {
      const title = t(page.titleKey, { fallback: page.fallback });

      return {
        id: page.id,
        type: "page" as const,
        title,
        metadata: t("globalSearch.metadata.accountPage", { fallback: "Page - Account" }),
        href: page.href,
        requiresAuth: true,
        priority: 80 - index,
        suggested: page.suggested,
        searchValues: [title, page.fallback, page.href, ...(page.keywords ?? [])],
      };
    }),
  ];

  return [...products, ...categories, ...brands, ...pages];
}

export function normalizeSearchQuery(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function levenshteinDistance(a: string, b: string) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function getItemMatch(item: GlobalSearchItem, normalizedQuery: string) {
  const searchableText = normalizeSearchQuery(item.searchValues.filter(Boolean).join(" "));
  const normalizedTitle = normalizeSearchQuery(item.title);

  if (normalizedTitle.startsWith(normalizedQuery)) {
    return { score: 130 + item.priority, matchText: normalizedQuery };
  }

  if (normalizedTitle.includes(normalizedQuery)) {
    return { score: 115 + item.priority, matchText: normalizedQuery };
  }

  if (searchableText.includes(normalizedQuery)) {
    return { score: 95 + item.priority, matchText: normalizedQuery };
  }

  const tokens = searchableText.split(/[\s./?=&-]+/).filter((token) => token.length >= 3);
  const prefixToken = tokens.find((token) => token.startsWith(normalizedQuery));
  if (prefixToken) {
    return { score: 80 + item.priority, matchText: normalizedQuery };
  }

  if (normalizedQuery.length >= 4) {
    const fuzzyThreshold = normalizedQuery.length > 5 ? 2 : 1;
    const fuzzyToken = tokens.find((token) => {
      if (Math.abs(token.length - normalizedQuery.length) > fuzzyThreshold) return false;
      return levenshteinDistance(token, normalizedQuery) <= fuzzyThreshold;
    });

    if (fuzzyToken) {
      return { score: 45 + item.priority, matchText: fuzzyToken };
    }
  }

  return null;
}

function emptyResults(): GlobalSearchResults {
  return {
    product: [],
    category: [],
    brand: [],
    page: [],
  };
}

function groupResults(items: GlobalSearchResult[]) {
  return items.reduce<GlobalSearchResults>((groups, item) => {
    if (groups[item.type].length < resultLimits[item.type]) {
      groups[item.type].push(item);
    }

    return groups;
  }, emptyResults());
}

export function searchGlobalIndex(index: GlobalSearchItem[], query: string) {
  const normalizedQuery = normalizeSearchQuery(query);

  if (!normalizedQuery) {
    return groupResults(
      index
        .filter((item) => item.suggested)
        .map((item) => ({ ...item, score: item.priority }))
        .sort((a, b) => b.score - a.score)
    );
  }

  const scoredResults = index.reduce<GlobalSearchResult[]>((results, item) => {
    const match = getItemMatch(item, normalizedQuery);
    if (match) {
      results.push({ ...item, ...match });
    }

    return results;
  }, []);

  return groupResults(scoredResults.sort((a, b) => b.score - a.score));
}

export function countSearchResults(results: GlobalSearchResults) {
  return Object.values(results).reduce((total, group) => total + group.length, 0);
}
