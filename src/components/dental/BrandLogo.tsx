import { Link } from "wouter";
import { cn } from "@/lib/utils";

export const BRAND_NAME = "X Dental Store";
export const ISOLATED_BRAND_NAME = "\u200EX Dental Store\u200E";

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  textClassName?: string;
};

export function BrandLogo({
  className,
  markClassName,
  textClassName,
}: BrandLogoProps) {
  return (
    <Link
      href="/"
      dir="ltr"
      aria-label={`${BRAND_NAME} home`}
      className={cn(
        "inline-flex items-center gap-2.5 shrink-0 focus-visible:outline-none",
        className
      )}
      style={{ direction: "ltr", unicodeBidi: "isolate" }}
    >
      <span
        className={cn(
          "flex items-center justify-center shrink-0 overflow-hidden",
          markClassName
        )}
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "var(--xd-gold-warm)",
          boxShadow: "0 4px 12px var(--xd-gold-border-soft)",
        }}
      >
        <img
          src="/navbar-logo-icon.png"
          alt=""
          aria-hidden="true"
          width={512}
          height={512}
          decoding="async"
          className="block h-6 w-6 object-contain"
          style={{ filter: "brightness(0) invert(1)" }}
        />
      </span>
      <span
        dir="ltr"
        className={cn("font-display text-[15px] whitespace-nowrap", textClassName)}
        style={{ direction: "ltr", unicodeBidi: "isolate" }}
      >
        {BRAND_NAME}
      </span>
    </Link>
  );
}
