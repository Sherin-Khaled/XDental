import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { Check, Search } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { fetchPublicProducts } from "@/services/catalog";
import { getCategoryTranslationKey, getLocalizedProductName } from "@/lib/catalogTranslations";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/product";

const AUTOCOMPLETE_MIN_QUERY_LENGTH = 2;
const AUTOCOMPLETE_DEBOUNCE_MS = 250;
const AUTOCOMPLETE_LIMIT = 8;

type ProductMatch = {
  product: Product;
  name: string;
  category: string;
};

function AutocompleteThumbnail({ image }: { image?: string }) {
  const [hasImageError, setHasImageError] = useState(false);

  return image && !hasImageError ? (
    <img
      src={image}
      alt=""
      className="h-full w-full object-cover"
      onError={() => setHasImageError(true)}
    />
  ) : (
    <Search size={14} className="text-[var(--xd-gold-active)]" />
  );
}

export function ProductAutocomplete({
  id,
  label,
  value,
  selectedProductId,
  error,
  onValueChange,
  onSelect,
  className,
  inputClassName,
}: {
  id: string;
  label: string;
  value: string;
  selectedProductId?: string;
  error?: string;
  onValueChange: (value: string) => void;
  onSelect: (product: Product, displayName: string) => void;
  className?: string;
  inputClassName?: string;
}) {
  const { t, language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const query = value.trim();

  // Small, debounced server search — never a filter over the full catalogue.
  useEffect(() => {
    if (query.length < AUTOCOMPLETE_MIN_QUERY_LENGTH) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    const controller = new AbortController();
    setIsSearching(true);
    const debounce = window.setTimeout(() => {
      fetchPublicProducts({ search: query, limit: AUTOCOMPLETE_LIMIT, signal: controller.signal })
        .then(({ products }) => {
          if (!controller.signal.aborted) setSearchResults(products);
        })
        .catch(() => {})
        .finally(() => {
          if (!controller.signal.aborted) setIsSearching(false);
        });
    }, AUTOCOMPLETE_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(debounce);
      controller.abort();
    };
  }, [query]);

  const matches = useMemo<ProductMatch[]>(
    () =>
      searchResults.map((product) => ({
        product,
        name: getLocalizedProductName(product, language, t),
        category: t(`products.items.${product.id}.category`, {
          fallback: t(getCategoryTranslationKey(product.category), { fallback: product.category }),
        }),
      })),
    [searchResults, language, t]
  );
  const listboxId = `${id}-suggestions`;

  const chooseProduct = (match: ProductMatch) => {
    onSelect(match.product, match.name);
    setIsOpen(false);
    setHighlightedIndex(0);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (!isOpen || matches.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((current) => (current + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) => (current - 1 + matches.length) % matches.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      chooseProduct(matches[Math.min(highlightedIndex, matches.length - 1)]);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <label htmlFor={id} className="mb-2 block text-[13px] font-bold text-[#050505]">
        {label}
      </label>
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-[#9A9CA7]"
        />
        <input
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen && query.length > 0}
          aria-controls={listboxId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          autoComplete="off"
          maxLength={300}
          value={value}
          placeholder={t("productAutocomplete.searchProducts")}
          onChange={(event) => {
            const nextValue = event.target.value;
            onValueChange(nextValue);
            setHighlightedIndex(0);
            setIsOpen(nextValue.trim().length > 0);
          }}
          onFocus={() => setIsOpen(query.length > 0)}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 100)}
          onKeyDown={handleKeyDown}
          className={cn(
            "h-12 w-full rounded-[12px] border bg-white ps-11 pe-4 text-[14px] text-[#050505] outline-none transition placeholder:text-[#B3B4BD] focus:ring-4",
            error
              ? "border-[#B42318]/50 focus:border-[#B42318] focus:ring-[#B42318]/10"
              : "border-[#050505]/10 focus:border-[var(--xd-gold-border-hover)] focus:ring-[var(--xd-gold-active)]/10",
            inputClassName
          )}
        />
      </div>

      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-2 text-[12px] font-semibold text-[#B42318]">
          {error}
        </p>
      ) : selectedProductId ? (
        <p className="mt-2 flex min-w-0 items-center gap-1.5 text-[12px] font-semibold text-[#6E5620]">
          <Check size={14} className="shrink-0" />
          <span className="shrink-0">{t("productAutocomplete.selectedProduct")}:</span>
          <span className="truncate">{value}</span>
        </p>
      ) : !query ? (
        <p className="mt-2 text-[12px] text-[#8A8D9A]">{t("productAutocomplete.startTyping")}</p>
      ) : null}

      {isOpen && query.length > 0 && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute inset-x-0 top-[calc(100%+8px)] z-[100] max-h-[238px] overflow-y-auto rounded-[16px] border border-[var(--xd-gold-border-soft)] bg-[#FFFEFB] p-1.5 shadow-[0_18px_44px_rgba(5,5,5,0.14)]"
        >
          {isSearching ? (
            <div className="px-3 py-4 text-[12px] text-[#8A8D9A]">{t("products.loading", { fallback: "Loading products..." })}</div>
          ) : matches.length > 0 ? (
            matches.map((match, index) => (
              <button
                key={match.product.id}
                type="button"
                role="option"
                aria-selected={match.product.id === selectedProductId}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => chooseProduct(match)}
                className={cn(
                  "flex w-full min-w-0 items-center gap-3 rounded-[12px] px-3 py-2.5 text-start transition-colors",
                  highlightedIndex === index || match.product.id === selectedProductId
                    ? "bg-[var(--xd-gold-bg-soft)]"
                    : "hover:bg-[#F8F5EC]"
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-[var(--xd-gold-border-soft)] bg-white">
                  <AutocompleteThumbnail image={match.product.image} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-[#050505]">{match.name}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-[#8A8D9A]">
                    {match.product.brand} · {match.category}
                  </span>
                </span>
                {match.product.id === selectedProductId && <Check size={15} className="shrink-0 text-[#8B6816]" />}
              </button>
            ))
          ) : query.length < AUTOCOMPLETE_MIN_QUERY_LENGTH ? (
            <div className="px-3 py-4 text-[12px] text-[#8A8D9A]">{t("productAutocomplete.startTyping")}</div>
          ) : (
            <div className="px-3 py-3">
              <p className="text-[13px] font-bold text-[#050505]">{t("productAutocomplete.noMatches")}</p>
              <p className="mt-1 text-[12px] leading-5 text-[#8A8D9A]">{t("productAutocomplete.useCustomRequest")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
