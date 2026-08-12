import { cn } from "@/lib/utils";

export const NAVBAR_ICON_SIZE = 20;
export const NAVBAR_ICON_STROKE_WIDTH = 1.8;

export const navbarIconControlClassName =
  "relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-[var(--xd-gold-border-soft)] bg-transparent text-[var(--xd-text-muted)] shadow-none transition-[transform,background-color,border-color,color,box-shadow] duration-200 ease-out hover:-translate-y-px hover:border-[var(--xd-gold-border-hover)] hover:bg-[var(--xd-gold-bg-soft)] hover:text-[var(--xd-text)] hover:shadow-[0_8px_20px_rgba(212,167,44,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--xd-bg)] active:translate-y-0 active:scale-[0.98] aria-expanded:border-[var(--xd-gold-border-hover)] aria-expanded:bg-[var(--xd-gold-bg-soft)] aria-expanded:text-[var(--xd-text)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:h-10 sm:w-10 xl:h-11 xl:w-11 xl:border-transparent xl:hover:border-[var(--xd-gold-border-hover)] xl:focus-visible:border-[var(--xd-gold-border-hover)]";

export function NavbarCountBadge({
  count,
  max,
  tone = "gold",
}: {
  count: number;
  max?: number;
  tone?: "gold" | "alert";
}) {
  if (count <= 0) return null;

  const label = max !== undefined && count > max ? `${max}+` : String(count);

  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute -end-1 -top-1 z-10 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border px-1 text-[9px] font-extrabold leading-none tabular-nums shadow-[0_2px_7px_rgba(5,5,5,0.18)]",
        tone === "alert"
          ? "border-[var(--xd-navbar-bg)] bg-[#DA2B1E] text-white"
          : "border-[var(--xd-navbar-bg)] bg-[var(--xd-gold)] text-[#050505]"
      )}
    >
      {label}
    </span>
  );
}
