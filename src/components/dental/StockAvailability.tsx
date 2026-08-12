import { AlertTriangle } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/product";

type StockProduct = Pick<
  Product,
  "available" | "status" | "stockQuantity" | "stockStatus"
>;

export function isLowStockProduct(product: StockProduct) {
  if (product.available === false || product.status === "OUT_OF_STOCK") {
    return false;
  }
  return product.status === "LOW_STOCK" || product.stockStatus === "Low Stock";
}

function visibleStockQuantity(product: StockProduct) {
  return Number.isInteger(product.stockQuantity) && Number(product.stockQuantity) > 0
    ? Number(product.stockQuantity)
    : null;
}

export function LowStockNotice({
  product,
  variant = "compact",
  showAvailabilityNote = false,
  className,
}: {
  product: StockProduct;
  variant?: "compact" | "detail";
  showAvailabilityNote?: boolean;
  className?: string;
}) {
  const { t } = useLanguage();
  if (!isLowStockProduct(product)) return null;

  const quantity = visibleStockQuantity(product);
  const compactLabel = quantity === null
      ? t("common.lowStock")
      : t("common.lowStockWithCount", {
        fallback: "Low stock \u00b7 Only {count} left",
        values: { count: quantity },
      });
  const detailLabel = quantity === null
      ? t("common.lowStock")
      : t("productDetail.lowStockWithCount", {
        fallback: "Low stock \u2014 only {count} left",
        values: { count: quantity },
      });

  return (
    <div
      data-low-stock="true"
      className={cn(
        variant === "detail"
          ? "rounded-[14px] border border-[var(--xd-gold-border)] bg-[var(--xd-gold-bg-soft)] px-3.5 py-3"
          : showAvailabilityNote
            ? "flex min-w-0 flex-col items-start"
            : "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1",
        className
      )}
    >
      <span
        className={cn(
          "inline-flex max-w-full items-center gap-1.5 font-bold text-[var(--xd-gold-text)]",
          variant === "detail"
            ? "text-[13px] leading-5"
            : "rounded-full border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-medium)] px-2.5 py-1 text-[11px] leading-4"
        )}
      >
        <AlertTriangle size={variant === "detail" ? 15 : 12} strokeWidth={2.1} className="shrink-0" />
        <span>{variant === "detail" ? detailLabel : compactLabel}</span>
      </span>

      {showAvailabilityNote && (
        <p className="mt-1.5 text-[12px] font-medium leading-5 text-[var(--xd-text-muted)]">
          {t("common.availabilityConfirmedWhenProcessed", {
            fallback: "Availability is confirmed when the order is processed.",
          })}
        </p>
      )}
    </div>
  );
}
