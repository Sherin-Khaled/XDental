import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "xdental.theme";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

function readStoredTheme(): Theme | null {
  try {
    const storedTheme = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(storedTheme) ? storedTheme : null;
  } catch {
    return null;
  }
}

function persistTheme(theme: Theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Theme switching still works when storage is unavailable.
  }
}

function getInitialTheme(): Theme {
  if (typeof document !== "undefined") {
    const appliedTheme = document.documentElement.dataset.theme;
    if (appliedTheme === "light" || appliedTheme === "dark") return appliedTheme;
  }

  if (typeof window !== "undefined") {
    const storedTheme = readStoredTheme();
    if (storedTheme) return storedTheme;
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  }

  return "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  themeColor?.setAttribute("content", theme === "dark" ? "#0E0E0C" : "#F8F7F2");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const setTheme = useCallback((nextTheme: Theme) => {
    persistTheme(nextTheme);
    setThemeState(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((currentTheme) => {
      const nextTheme = currentTheme === "dark" ? "light" : "dark";
      persistTheme(nextTheme);
      return nextTheme;
    });
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleSystemChange = (event: MediaQueryListEvent) => {
      if (!readStoredTheme()) {
        setThemeState(event.matches ? "dark" : "light");
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && isTheme(event.newValue)) {
        setThemeState(event.newValue);
      }
    };

    mediaQuery.addEventListener("change", handleSystemChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      mediaQuery.removeEventListener("change", handleSystemChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [setTheme, theme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
