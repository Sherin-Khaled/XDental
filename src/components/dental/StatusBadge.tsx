import * as React from "react";
import { CheckCircle2, CircleX, Clock3, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { getOrderStatusStyle } from "@/utils";
import { useLanguage } from "@/context/LanguageContext";
import { accountValue } from "@/lib/accountI18n";

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: string;
}

function StatusBadge({ className, status, ...props }: StatusBadgeProps) {
  const { t } = useLanguage();
  const styles = getOrderStatusStyle(status);
  const normalizedStatus = status.toLowerCase();
  const Icon =
    ["delivered", "confirmed", "verified"].includes(normalizedStatus)
      ? CheckCircle2
      : ["rejected", "canceled", "cancelled"].includes(normalizedStatus)
        ? CircleX
        : ["processing", "pending", "pending review", "pending collection", "preparing"].includes(normalizedStatus)
          ? Clock3
          : ["shipped", "sent to supplier/system", "out for delivery"].includes(normalizedStatus)
            ? Truck
            : null;
  
  return (
    <div 
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border",
        styles.bg,
        styles.text,
        styles.border,
        className
      )} 
      {...props}
    >
      {Icon && <Icon size={12} strokeWidth={2.2} aria-hidden="true" />}
      {accountValue(t, status)}
    </div>
  );
}

export { StatusBadge };
