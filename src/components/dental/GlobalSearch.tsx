import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  FileText,
  Grid2X2,
  Package,
  Search,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/dental/Button";
import { useLanguage } from "@/context/LanguageContext";
import { useStore } from "@/context/StoreContext";
import { cn } from "@/lib/utils";
import {
  buildGlobalSearchIndex,
  countSearchResults,
  searchGlobalIndex,
  type GlobalSearchResult,
  type GlobalSearchType,
} from "@/lib/searchIndex";

type GlobalSearchProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const groupOrder: GlobalSearchType[] = ["product", "category", "brand", "page"];

function getResultIcon(result: GlobalSearchResult) {
  if (result.type === "product") return Package;
  if (result.type === "category") return Grid2X2;
  if (result.type === "brand") return Building2;
  return result.requiresAuth ? User : FileText;
}

function getResultId(result: GlobalSearchResult) {
  return `global-search-result-${result.type}-${result.id}`;
}

function getHighlightedParts(text: string, matchText?: string) {
  if (!matchText) return [{ text, highlighted: false }];

  const normalizedText = text.toLowerCase();
  const normalizedMatch = matchText.toLowerCase();
  const parts: Array<{ text: string; highlighted: boolean }> = [];
  let searchFrom = 0;

  while (searchFrom < text.length) {
    const matchIndex = normalizedText.indexOf(normalizedMatch, searchFrom);

    if (matchIndex === -1) {
      parts.push({ text: text.slice(searchFrom), highlighted: false });
      break;
    }

    if (matchIndex > searchFrom) {
      parts.push({ text: text.slice(searchFrom, matchIndex), highlighted: false });
    }

    parts.push({
      text: text.slice(matchIndex, matchIndex + matchText.length),
      highlighted: true,
    });
    searchFrom = matchIndex + matchText.length;
  }

  return parts.length ? parts : [{ text, highlighted: false }];
}

function HighlightedText({
  text,
  matchText,
  className,
}: {
  text: string;
  matchText?: string;
  className?: string;
}) {
  return (
    <span className={className}>
      {getHighlightedParts(text, matchText).map((part, index) =>
        part.highlighted ? (
          <mark
            key={`${part.text}-${index}`}
            className="rounded-[5px] bg-[var(--xd-gold-bg-soft)] px-0.5 text-[#7A5200]"
          >
            {part.text}
          </mark>
        ) : (
          <span key={`${part.text}-${index}`}>{part.text}</span>
        )
      )}
    </span>
  );
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const { direction, isRtl, t } = useLanguage();
  const { isAuthenticated } = useStore();
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const index = useMemo(() => buildGlobalSearchIndex(t), [t]);
  const groupedResults = useMemo(() => searchGlobalIndex(index, query), [index, query]);
  const flatResults = useMemo(
    () => groupOrder.flatMap((group) => groupedResults[group]),
    [groupedResults]
  );
  const resultCount = countSearchResults(groupedResults);
  const selectedResult = flatResults[selectedIndex];

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    const focusFrame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    setSelectedIndex((currentIndex) =>
      flatResults.length === 0 ? 0 : Math.min(currentIndex, flatResults.length - 1)
    );
  }, [flatResults.length]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onOpenChange, open]);

  const handleSelect = (result: GlobalSearchResult) => {
    const destination =
      result.requiresAuth && !isAuthenticated
        ? `/signin?redirect=${encodeURIComponent(result.href)}`
        : result.href;

    onOpenChange(false);
    navigate(destination);
  };

  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onOpenChange(false);
      return;
    }

    if (!flatResults.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((currentIndex) => (currentIndex + 1) % flatResults.length);
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((currentIndex) =>
        currentIndex === 0 ? flatResults.length - 1 : currentIndex - 1
      );
    }

    if (event.key === "Enter") {
      event.preventDefault();
      handleSelect(flatResults[selectedIndex]);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[90] flex h-[100dvh] w-screen items-center justify-center overflow-hidden p-6 max-sm:p-4"
          role="presentation"
          onClick={() => onOpenChange(false)}
        >
          <motion.div
            className="absolute inset-0 bg-[#050505]/30 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={t("globalSearch.ariaLabel")}
            dir={direction}
            onClick={(event) => event.stopPropagation()}
            className="relative z-10 w-full max-w-[720px] overflow-hidden rounded-[28px] border border-white/80 bg-[rgba(251,250,247,0.96)] shadow-[0_30px_90px_rgba(5,5,5,0.22)] backdrop-blur-2xl max-sm:max-h-[86vh] max-sm:rounded-b-none max-sm:rounded-t-[26px] max-sm:border-x-0 max-sm:border-b-0"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#050505]/[0.06] px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--xd-gold-text)]">
                  {query.trim()
                    ? t("globalSearch.resultsTitle")
                    : t("globalSearch.popularTitle")}
                </p>
                <p className="mt-1 text-[12px] text-[#717182]">
                  {t("globalSearch.resultCount", {
                    values: { count: resultCount },
                  })}
                </p>
              </div>

              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                variant="tertiary"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-full text-[#050505] hover:bg-[var(--xd-gold-bg-soft)]"
                aria-label={t("globalSearch.close")}
              >
                <X size={18} />
              </Button>
            </div>

            <div className="px-4 pt-4 sm:px-5">
              <label className="relative block h-[52px]">
                <Search
                  size={18}
                  className={cn(
                    "pointer-events-none absolute top-1/2 -translate-y-1/2 text-[#8C8798]",
                    isRtl ? "right-4" : "left-4"
                  )}
                />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder={t("globalSearch.placeholder")}
                  className={cn(
                    "h-[52px] w-full rounded-[18px] border border-[#050505]/[0.08] bg-white/82 text-[15px] text-[#050505] outline-none transition placeholder:text-[#8C8798] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-bg-soft)]",
                    isRtl ? "pl-4 pr-12 text-right" : "pl-12 pr-4 text-left"
                  )}
                  aria-label={t("globalSearch.placeholder")}
                  aria-controls="global-search-results"
                  aria-activedescendant={selectedResult ? getResultId(selectedResult) : undefined}
                  autoComplete="off"
                />
              </label>
            </div>

            <div
              id="global-search-results"
              role="listbox"
              className="max-h-[54vh] overflow-y-auto px-4 py-4 sm:max-h-[58vh] sm:px-5"
            >
              {resultCount > 0 ? (
                <div className="space-y-5">
                  {groupOrder.map((group) => {
                    const results = groupedResults[group];
                    if (!results.length) return null;

                    return (
                      <section key={group} aria-label={t(`globalSearch.groups.${group}`)}>
                        <h3 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8C8798]">
                          {t(`globalSearch.groups.${group}`)}
                        </h3>
                        <div className="space-y-2">
                          {results.map((result) => {
                            const flatIndex = flatResults.findIndex(
                              (item) => item.type === result.type && item.id === result.id
                            );
                            const isSelected = flatIndex === selectedIndex;
                            const Icon = getResultIcon(result);

                            return (
                              <button
                                id={getResultId(result)}
                                key={`${result.type}-${result.id}`}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onMouseEnter={() => setSelectedIndex(flatIndex)}
                                onClick={() => handleSelect(result)}
                                className={cn(
                                  "flex w-full min-w-0 items-center gap-3 rounded-[18px] border px-3 py-3 text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)]",
                                  isSelected
                                    ? "border-[var(--xd-gold-border-hover)] bg-white shadow-[0_12px_28px_rgba(5,5,5,0.07)]"
                                    : "border-transparent bg-white/58 hover:border-[var(--xd-gold-border-soft)] hover:bg-white/82"
                                )}
                              >
                                {result.image ? (
                                  <img
                                    src={result.image}
                                    alt=""
                                    className="h-11 w-11 shrink-0 rounded-[14px] object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-active)]">
                                    <Icon size={18} />
                                  </span>
                                )}

                                <span className="min-w-0 flex-1">
                                  <HighlightedText
                                    text={result.title}
                                    matchText={result.matchText}
                                    className="block truncate text-[14px] font-semibold text-[#050505]"
                                  />
                                  <HighlightedText
                                    text={result.metadata}
                                    matchText={result.matchText}
                                    className="mt-1 block truncate text-[12px] text-[#717182]"
                                  />
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              ) : (
                <div className="px-4 py-12 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[16px] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-active)]">
                    <Search size={20} />
                  </div>
                  <h3 className="text-[18px] font-semibold text-[#050505]">
                    {t("globalSearch.emptyTitle")}
                  </h3>
                  <p className="mx-auto mt-2 max-w-[330px] text-[14px] leading-6 text-[#717182]">
                    {t("globalSearch.emptyBody")}
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-[#050505]/[0.06] px-4 py-3 text-[11px] text-[#8C8798] sm:px-5">
              {t("globalSearch.hint")}
            </div>
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}
