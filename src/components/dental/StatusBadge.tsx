import * as React from "react";
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
  
  return (
    <div 
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border",
        styles.bg,
        styles.text,
        styles.border,
        className
      )} 
      {...props}
    >
      {accountValue(t, status)}
    </div>
  );
}

export { StatusBadge };
