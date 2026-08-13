import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Language = "en" | "ar";
type TranslationTree = Record<string, unknown>;
type TranslationValues = Record<string, string | number>;

type TranslateOptions = {
  fallback?: string;
  values?: TranslationValues;
};

type LanguageContextValue = {
  language: Language;
  direction: "ltr" | "rtl";
  isRtl: boolean;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, options?: TranslateOptions) => string;
};

type TranslationModule = { default: TranslationTree };

const translationLoaders: Record<Language, () => Promise<TranslationModule>> = {
  en: () => import("@/locales/en.json"),
  ar: () => import("@/locales/ar.json"),
};
const translationCache: Partial<Record<Language, TranslationTree>> = {};
const STORAGE_KEY = "xdental.language";
const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function isLanguage(value: string | null): value is Language {
  return value === "en" || value === "ar";
}

function readInitialLanguage(): Language {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isLanguage(stored) ? stored : "en";
}

function getNestedValue(source: TranslationTree, key: string): unknown {
  return key.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, source);
}

function interpolate(value: string, replacements?: TranslationValues) {
  if (!replacements) return value;

  return value.replace(/\{(\w+)\}/g, (match, token) => {
    const replacement = replacements[token];
    return replacement === undefined ? match : String(replacement);
  });
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readInitialLanguage);
  const [translations, setTranslations] = useState<Partial<Record<Language, TranslationTree>>>(
    translationCache
  );
  const direction = language === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    let cancelled = false;
    const requiredLanguages: Language[] = language === "ar" ? ["en", "ar"] : ["en"];

    Promise.all(
      requiredLanguages.map(async (requiredLanguage) => {
        if (!translationCache[requiredLanguage]) {
          translationCache[requiredLanguage] = (await translationLoaders[requiredLanguage]()).default;
        }
      })
    ).then(() => {
      if (!cancelled) setTranslations({ ...translationCache });
    });

    return () => {
      cancelled = true;
    };
  }, [language]);

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    window.localStorage.setItem(STORAGE_KEY, nextLanguage);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((currentLanguage) => {
      const nextLanguage = currentLanguage === "en" ? "ar" : "en";
      window.localStorage.setItem(STORAGE_KEY, nextLanguage);
      return nextLanguage;
    });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = language;
    root.dir = direction;
    document.body.dir = direction;
  }, [direction, language]);

  const t = useCallback(
    (key: string, options?: TranslateOptions) => {
      const activeValue = translations[language]
        ? getNestedValue(translations[language], key)
        : undefined;
      const fallbackValue = translations.en
        ? getNestedValue(translations.en, key)
        : undefined;
      const resolved =
        typeof activeValue === "string"
          ? activeValue
          : typeof fallbackValue === "string"
            ? fallbackValue
            : options?.fallback ?? key;

      return interpolate(resolved, options?.values);
    },
    [language]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      direction,
      isRtl: direction === "rtl",
      setLanguage,
      toggleLanguage,
      t,
    }),
    [direction, language, setLanguage, t, toggleLanguage]
  );

  const isReady = Boolean(translations.en && translations[language]);

  return (
    <LanguageContext.Provider value={value}>
      {isReady ? children : (
        <div className="flex min-h-screen items-center justify-center bg-[var(--xd-bg)]" role="status" aria-label="Loading language">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--xd-gold-active)] border-t-transparent" />
        </div>
      )}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }

  return context;
}
