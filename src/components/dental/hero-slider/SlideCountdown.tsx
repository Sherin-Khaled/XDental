import { useEffect, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";

const UNIT_LABELS = {
  days: { en: "Days", ar: "يوم" },
  hours: { en: "Hrs", ar: "ساعة" },
  minutes: { en: "Mins", ar: "دقيقة" },
  seconds: { en: "Secs", ar: "ثانية" },
} as const;

function remainingMs(to: string) {
  return Math.max(0, new Date(to).getTime() - Date.now());
}

/** Days/Hrs/Mins/Secs countdown for flash-sale slides. Renders nothing once
 *  the target date passes. */
export function SlideCountdown({ to, accentColor }: { to: string; accentColor?: string }) {
  const { language, isRtl } = useLanguage();
  const [remaining, setRemaining] = useState(() => remainingMs(to));

  useEffect(() => {
    setRemaining(remainingMs(to));
    const timer = window.setInterval(() => setRemaining(remainingMs(to)), 1000);
    return () => window.clearInterval(timer);
  }, [to]);

  if (remaining <= 0) return null;

  const totalSeconds = Math.floor(remaining / 1000);
  const units = [
    { key: "days", value: Math.floor(totalSeconds / 86400) },
    { key: "hours", value: Math.floor((totalSeconds % 86400) / 3600) },
    { key: "minutes", value: Math.floor((totalSeconds % 3600) / 60) },
    { key: "seconds", value: totalSeconds % 60 },
  ] as const;

  return (
    <div
      role="timer"
      aria-label={isRtl ? "الوقت المتبقي على انتهاء العرض" : "Time left until the offer ends"}
      className="mt-7 flex flex-wrap items-center gap-2.5 sm:gap-3"
    >
      {units.map(({ key, value }) => (
        <div
          key={key}
          className="min-w-[62px] rounded-[14px] border border-[rgba(122,86,0,0.22)] bg-[rgba(255,255,255,0.86)] px-3 py-2 text-center backdrop-blur-md sm:min-w-[68px]"
        >
          <div
            className="font-display text-[22px] font-semibold leading-[1.1] tabular-nums tracking-[-0.02em] sm:text-[24px]"
            style={{ color: accentColor ?? "var(--hero-highlight)" }}
          >
            {String(value).padStart(2, "0")}
          </div>
          <div className="mt-0.5 text-[11px] font-medium" style={{ color: "var(--hero-muted)" }}>
            {UNIT_LABELS[key][language]}
          </div>
        </div>
      ))}
    </div>
  );
}
