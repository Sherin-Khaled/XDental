import { useLanguage } from "@/context/LanguageContext";
import type { CustomerOrder, PricingSource } from "@/services/orders";
import { formatCurrency } from "@/utils";
import { cn } from "@/lib/utils";

function sourceTitle(source: PricingSource | null, language: "en" | "ar") {
  if (!source) return "";
  return (language === "ar" ? source.titleAr : source.titleEn)
    || source.titleEn
    || source.titleAr;
}

function PricingRow({
  label,
  value,
  discount = false,
}: {
  label: string;
  value: number;
  discount?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[#717182] dark:text-[#C6BEAE]">{label}</span>
      <span className={cn(
        "shrink-0 font-semibold text-[#050505] dark:text-[#F7F2E6]",
        discount && "text-[#16803C] dark:text-[#7BE39D]"
      )}>
        {discount ? "−" : ""}{formatCurrency(value)}
      </span>
    </div>
  );
}

export function OrderPricingBreakdown({
  order,
  deliveryLabel,
  className,
  showLegacyNote = true,
}: {
  order: CustomerOrder;
  deliveryLabel?: string;
  className?: string;
  showLegacyNote?: boolean;
}) {
  const { language, t } = useLanguage();
  const pricing = order.pricing;

  if (!pricing) {
    return (
      <div className={cn("space-y-2 text-sm", className)}>
        <PricingRow label={t("admin.orders.subtotal", { fallback: "Subtotal" })} value={order.subtotal} />
        <PricingRow
          label={deliveryLabel
            ? `${t("admin.orders.shipping", { fallback: "Shipping" })} (${deliveryLabel})`
            : t("admin.orders.shipping", { fallback: "Shipping" })}
          value={order.shipping}
        />
        {showLegacyNote && (
          <p className="pt-1 text-xs leading-5 text-[#8A8D9A] dark:text-[#AAA395]">
            {t("admin.orders.legacyPricing", { fallback: "This order predates detailed pricing snapshots." })}
          </p>
        )}
        <div className="flex items-center justify-between border-t border-[#050505]/10 pt-3 dark:border-white/10">
          <span className="font-bold text-[#050505] dark:text-[#F7F2E6]">{t("admin.orders.total", { fallback: "Total" })}</span>
          <span className="font-display text-lg font-bold text-[#050505] dark:text-[#F7F2E6]">{formatCurrency(order.total)}</span>
        </div>
      </div>
    );
  }

  const winningTitle = sourceTitle(pricing.winningMonetarySource, language);
  const freeShippingTitle = sourceTitle(pricing.freeShippingSource, language);
  const vipShippingTitle = sourceTitle(pricing.vipShippingSource, language);
  const deliveryOfferIsFreeShippingSource = Boolean(
    pricing.deliveryOffer
    && pricing.freeShippingSource?.type === "DELIVERY_OFFER"
    && sourceTitle(pricing.deliveryOffer, language) === freeShippingTitle
  );

  return (
    <div className={cn("space-y-2 text-sm", className)}>
      {pricing.productPromotionSavings > 0 && (
        <>
          <PricingRow label={t("admin.orders.originalSubtotal", { fallback: "Original products subtotal" })} value={pricing.originalSubtotal} />
          <PricingRow label={t("admin.orders.productPromotionSavings", { fallback: "Flash Sale savings" })} value={pricing.productPromotionSavings} discount />
        </>
      )}
      <PricingRow label={t("admin.orders.effectiveSubtotal", { fallback: "Products subtotal after promotions" })} value={order.subtotal} />
      {pricing.shippingDiscount > 0 && (
        <PricingRow label={t("admin.orders.shippingBeforeDiscount", { fallback: "Shipping before discount" })} value={pricing.shippingBeforeDiscount} />
      )}
      {pricing.deliveryOfferDiscount > 0 && !deliveryOfferIsFreeShippingSource && (
        <PricingRow
          label={`${t("admin.orders.deliveryOfferDiscount", { fallback: "Delivery offer discount" })}${pricing.deliveryOffer ? ` — ${sourceTitle(pricing.deliveryOffer, language)}` : ""}`}
          value={pricing.deliveryOfferDiscount}
          discount
        />
      )}
      {pricing.vipShippingDiscount > 0 && (
        <PricingRow
          label={`${t("admin.orders.vipShippingDiscount", { fallback: "VIP delivery saving" })}${vipShippingTitle ? ` â€” ${vipShippingTitle}` : ""}`}
          value={pricing.vipShippingDiscount}
          discount
        />
      )}
      {pricing.freeShippingSource && (
        <PricingRow
          label={`${t("admin.orders.shippingPromotion", { fallback: "Free shipping promotion" })}${freeShippingTitle ? ` — ${freeShippingTitle}` : ""}`}
          value={deliveryOfferIsFreeShippingSource
            ? pricing.shippingDiscount
            : Math.max(0, pricing.shippingDiscount - pricing.deliveryOfferDiscount - pricing.vipShippingDiscount)}
          discount
        />
      )}
      {pricing.monetaryDiscount > 0 && (
        <PricingRow
          label={`${t("admin.orders.monetaryPromotion", { fallback: "Order promotion" })}${winningTitle ? ` — ${winningTitle}` : ""}`}
          value={pricing.monetaryDiscount}
          discount
        />
      )}
      {order.pointsRedeemed > 0 && (
        <PricingRow
          label={`${t("admin.orders.pointsRedeemed", { fallback: "Points redeemed" })} (${order.pointsRedeemed.toLocaleString("en-US")})`}
          value={order.pointsRedemptionValue}
          discount
        />
      )}
      <PricingRow
        label={deliveryLabel
          ? `${t("admin.orders.finalShipping", { fallback: "Final shipping" })} (${deliveryLabel})`
          : t("admin.orders.finalShipping", { fallback: "Final shipping" })}
        value={order.shipping}
      />
      {pricing.totalSavings > 0 && (
        <PricingRow label={t("admin.orders.totalSavings", { fallback: "Total savings" })} value={pricing.totalSavings} discount />
      )}
      <div className="flex items-center justify-between border-t border-[#050505]/10 pt-3 dark:border-white/10">
        <span className="font-bold text-[#050505] dark:text-[#F7F2E6]">{t("admin.orders.total", { fallback: "Total" })}</span>
        <span className="font-display text-lg font-bold text-[#050505] dark:text-[#F7F2E6]">{formatCurrency(order.total)}</span>
      </div>
      {order.walletCreditUsed > 0 && (
        <PricingRow
          label={t("admin.orders.walletCreditUsed", { fallback: "Wallet credit used" })}
          value={order.walletCreditUsed}
          discount
        />
      )}
      {pricing.loyalty && (
        <div className="flex items-center justify-between rounded-lg bg-[var(--xd-gold-bg-soft)] px-3 py-2.5">
          <span className="font-bold text-[#5F5F5F] dark:text-[#D6D0C3]">
            {t("admin.orders.remainingCod", { fallback: "Remaining Cash on Delivery" })}
          </span>
          <span className="font-display font-bold text-[#050505] dark:text-[#F7F2E6]">
            {formatCurrency(order.remainingCodAmount)}
          </span>
        </div>
      )}
    </div>
  );
}
