import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils";

/**
 * Keeps the currency and amount together wherever a monetary value is shown.
 * The formatting itself remains centralized in `formatCurrency` so every
 * surface uses the same EGP-first convention.
 */
export function Money({
  amount,
  className,
}: {
  amount: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex shrink-0 whitespace-nowrap", className)} dir="ltr">
      {formatCurrency(amount)}
    </span>
  );
}
