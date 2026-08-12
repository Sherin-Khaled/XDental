import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PremiumAccentIcon({
  icon: Icon,
  size = 18,
  strokeWidth = 2.1,
  className,
}: {
  icon: LucideIcon;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center justify-center", className)} aria-hidden="true">
      <Icon
        size={size}
        strokeWidth={strokeWidth}
        className="xd-icon-amber xd-premium-icon"
        aria-hidden="true"
      />
    </span>
  );
}
