import { Moon, SunMedium } from "lucide-react";
import {
  NAVBAR_ICON_SIZE,
  NAVBAR_ICON_STROKE_WIDTH,
  navbarIconControlClassName,
} from "@/components/dental/NavbarIconControl";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { language } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const label = language === "ar"
    ? isDark ? "التبديل إلى الوضع الفاتح" : "التبديل إلى الوضع الداكن"
    : isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        navbarIconControlClassName,
        className
      )}
      aria-label={label}
      title={label}
      aria-pressed={isDark}
      data-testid="button-theme-toggle"
    >
      {isDark ? (
        <SunMedium size={NAVBAR_ICON_SIZE} strokeWidth={NAVBAR_ICON_STROKE_WIDTH} className="xd-premium-icon" />
      ) : (
        <Moon size={NAVBAR_ICON_SIZE} strokeWidth={NAVBAR_ICON_STROKE_WIDTH} className="xd-premium-icon" />
      )}
    </button>
  );
}
