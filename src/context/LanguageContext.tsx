import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import en from "@/locales/en.json";
import ar from "@/locales/ar.json";

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

const translations: Record<Language, TranslationTree> = { en, ar };
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
  const direction = language === "ar" ? "rtl" : "ltr";

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
      const activeValue = getNestedValue(translations[language], key);
      const fallbackValue = getNestedValue(translations.en, key);
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

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }

  return context;
}
