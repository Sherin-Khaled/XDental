import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { CheckCircle2, Circle, CircleX, CreditCard, Download, MapPin, Package } from "lucide-react";
import { AccountSidebar } from "@/components/dental/AccountSidebar";
import { Button } from "@/components/dental/Button";
import { Container } from "@/components/dental/Container";
import { StatusBadge } from "@/components/dental/StatusBadge";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { OrderPricingBreakdown } from "@/components/dental/OrderPricingBreakdown";
import { useLanguage } from "@/context/LanguageContext";
import { accountT, accountValue } from "@/lib/accountI18n";
import {
  getMyOrder,
  getOrderStatusLabel,
  getPaymentStatusLabel,
  type CustomerOrder,
  type OrderStatus,
} from "@/services/orders";
import { formatCurrency } from "@/utils";

export default function AccountOrderDetail() {
  const { id } = useParams();
  const { t, language } = useLanguage();
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setHasError(true);
      setIsLoading(false);
      return;
    }

    let active = true;
    getMyOrder(id)
      .then((result) => {
        if (active) setOrder(result);
      })
      .catch(() => {
        if (active) setHasError(true);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  if (isLoading) {
    return <div className="py-20 text-center text-[#717182]">{accountT(t, "orders.loading", "Loading orders...")}</div>;
  }

  if (hasError || !order) {
    return (
      <div className="py-20 text-center">
        <p className="font-semibold text-[#717182]">{accountT(t, "orders.detail.notFound", "Order not found")}</p>
        <Link href="/account/orders" className="mt-4 inline-block font-bold text-[var(--xd-gold-text)] underline">
          {accountT(t, "orders.title", "My Orders")}
        </Link>
      </div>
    );
  }

  const statusLabel = getOrderStatusLabel(order.status);
  const deliveryLabel = t(`checkout.shippingMethods.${order.deliveryMethod}.title`, { fallback: order.deliveryMethod });
  const paymentLabel = t(`checkout.paymentMethods.${order.paymentMethod}.title`, { fallback: order.paymentMethod });
  const paymentStatusLabel = getPaymentStatusLabel(order.paymentStatus);
  const isDestructiveStatus = order.status === "REJECTED" || order.status === "CANCELED";
  const fulfillmentStatuses: OrderStatus[] = [
    "PENDING_REVIEW",
    "CONFIRMED",
    "PREPARING",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
  ];
  const currentFulfillmentIndex = fulfillmentStatuses.indexOf(order.status);
  const trackingSteps = isDestructiveStatus
    ? [
        { label: accountT(t, "orders.detail.orderPlaced", "Order Placed"), complete: true, current: false, destructive: false },
        { label: accountValue(t, statusLabel), complete: false, current: true, destructive: true },
      ]
    : fulfillmentStatuses.map((status, index) => ({
        label: accountValue(t, getOrderStatusLabel(status)),
        complete: index <= currentFulfillmentIndex,
        current: index === currentFulfillmentIndex,
        destructive: false,
      }));

  const handleDownloadInvoice = () => {
    const lines = [
      `Order ${order.orderNumber}`,
      `Placed: ${new Date(order.createdAt).toLocaleString()}`,
      `Status: ${statusLabel}`,
      `Payment method: ${paymentLabel}`,
      `Payment status: ${paymentStatusLabel}`,
      "",
      "Items:",
      ...order.items.map((item) => `${item.productName} - Qty ${item.quantity} - ${formatCurrency(item.total)}`),
      "",
      ...(order.pricing?.productPromotionSavings
        ? [`Original products subtotal: ${formatCurrency(order.pricing.originalSubtotal)}`, `Flash Sale savings: -${formatCurrency(order.pricing.productPromotionSavings)}`]
        : []),
      `Subtotal: ${formatCurrency(order.subtotal)}`,
      ...(order.pricing?.monetaryDiscount
        ? [`Order promotion: -${formatCurrency(order.pricing.monetaryDiscount)}`]
        : []),
      ...(order.pointsRedeemed > 0
        ? [`Points redeemed (${order.pointsRedeemed}): -${formatCurrency(order.pointsRedemptionValue)}`]
        : []),
      ...(order.pricing?.shippingDiscount
        ? [`Shipping before discount: ${formatCurrency(order.pricing.shippingBeforeDiscount)}`, `Shipping savings: -${formatCurrency(order.pricing.shippingDiscount)}`]
        : []),
      `Final shipping: ${formatCurrency(order.shipping)}`,
      ...(order.pricing?.totalSavings
        ? [`Total savings: ${formatCurrency(order.pricing.totalSavings)}`]
        : []),
      `Total: ${formatCurrency(order.total)}`,
      ...(order.walletCreditUsed > 0
        ? [`Wallet credit used: -${formatCurrency(order.walletCreditUsed)}`]
        : []),
      `Remaining Cash on Delivery: ${formatCurrency(order.remainingCodAmount)}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${order.orderNumber.toLowerCase()}-order.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setStatusMessage(accountT(t, "orders.detail.invoiceDownloaded", "Invoice for {orderNumber} downloaded.", { orderNumber: order.orderNumber }));
  };

  return (
    <div className="bg-[var(--xd-bg)] pb-14 pt-10 lg:pb-20 lg:pt-14">
      <Container className="overflow-x-clip">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:gap-7">
          <AccountSidebar />

          <div className="min-w-0 space-y-6">
            <div className="mb-2 flex items-center gap-4">
              <Link href="/account/orders" className="-ml-2 rounded-full p-2 text-[#7A7A7A] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)]">
                <DirectionalIcon direction="back" size={20} />
              </Link>
              <h1 className="font-display text-3xl font-bold text-[#050505]">{accountT(t, "orders.detail.title", "Order Details")}</h1>
            </div>

            <div className="flex flex-col justify-between gap-6 rounded-[24px] border border-[#050505]/5 bg-white p-6 shadow-sm md:flex-row md:items-center lg:p-8">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-bold text-[#050505]">{order.orderNumber}</h2>
                  <StatusBadge status={statusLabel} />
                  <StatusBadge status={paymentStatusLabel} />
                </div>
                <p className="text-[#7A7A7A]">
                  {accountT(t, "orders.detail.placedOn", "Placed on {date}", {
                    date: new Date(order.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                  })}
                </p>
              </div>
              <Button type="button" onClick={handleDownloadInvoice} variant="secondary" className="gap-2">
                <Download size={18} /> {accountT(t, "orders.detail.invoice", "Invoice")}
              </Button>
            </div>

            {statusMessage && (
              <div role="status" className="rounded-[14px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-active)]/[0.08] px-4 py-3 text-[13px] font-semibold text-[#5F5F5F]">
                {statusMessage}
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <div className="rounded-[24px] border border-[#050505]/5 bg-white p-6 shadow-sm lg:p-8">
                  <h3 className="mb-6 font-display text-lg font-bold text-[#050505]">{accountT(t, "orders.detail.orderStatus", "Order Status")}</h3>
                  <div className="space-y-5">
                    {trackingSteps.map((step, index) => (
                      <div key={`${step.label}-${index}`} className="flex items-center gap-4">
                        {step.destructive ? (
                          <CircleX size={24} className="text-[#B42318]" />
                        ) : step.complete ? (
                          <CheckCircle2 size={24} className="text-[#16803C]" />
                        ) : step.current ? (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--xd-gold-active)]">
                            <span className="h-2 w-2 rounded-full bg-[var(--xd-gold)]" />
                          </span>
                        ) : (
                          <Circle size={24} className="text-gray-300" />
                        )}
                        <span className="font-semibold text-[#050505]">{step.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-[#050505]/5 bg-white p-6 shadow-sm lg:p-8">
                  <h3 className="mb-6 font-display text-lg font-bold text-[#050505]">
                    {accountT(t, "orders.detail.itemsTitle", "Items ({count})", { count: order.itemCount })}
                  </h3>
                  <div className="space-y-6">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex gap-4 border-b border-gray-100 pb-6 last:border-0 last:pb-0">
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-[#050505]/5 bg-[var(--xd-bg)]">
                          <Package size={28} className="text-[var(--xd-gold-active)]" />
                        </div>
                        <div className="flex min-w-0 flex-1 justify-between gap-4">
                          <div className="min-w-0">
                            {item.sku && <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--xd-gold-text)]">{item.sku}</div>}
                            <h4 className="font-semibold text-[#050505]">{item.productName}</h4>
                            <div className="mt-1 text-sm text-[#7A7A7A]">{accountT(t, "common.qtyValue", "Qty: {quantity}", { quantity: item.quantity })}</div>
                            {item.promotionDiscount !== null && item.promotionDiscount > 0 && (
                              <p className="mt-1 text-xs font-semibold text-[#16803C] dark:text-[#7BE39D]">
                                {(language === "ar" ? item.promotionTitleAr : item.promotionTitleEn)
                                  || t("admin.orders.productPromotionSavings", { fallback: "Flash Sale savings" })}
                                {item.originalUnitPrice !== null && (
                                  <span className="ms-2 font-normal text-[#8A8D9A] line-through">
                                    {formatCurrency(item.originalUnitPrice * item.quantity)}
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0 font-bold text-[#050505]">{formatCurrency(item.total)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-6 rounded-[24px] border border-[#050505]/5 bg-white p-6 shadow-sm">
                  <div>
                    <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-[#050505]">
                      <MapPin size={20} className="text-[var(--xd-gold-text)]" /> {accountT(t, "orders.detail.shippingInfo", "Shipping Info")}
                    </h3>
                    <div className="rounded-xl bg-[var(--xd-bg)] p-4 text-sm text-[#5F5F5F]">
                      <p className="mb-1 font-semibold text-[#050505]">{order.shippingAddress.name}</p>
                      <p>{order.shippingAddress.line1}</p>
                      <p>{order.shippingAddress.city}, {order.shippingAddress.governorate}</p>
                      <p>{order.shippingAddress.phone}</p>
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-[#050505]">
                      <CreditCard size={20} className="text-[var(--xd-gold-text)]" /> {accountT(t, "orders.detail.paymentInfo", "Payment Info")}
                    </h3>
                    <div className="rounded-xl bg-[var(--xd-bg)] p-4 text-sm text-[#5F5F5F]">
                      <p className="mb-1 font-semibold text-[#050505]">{paymentLabel}</p>
                      <p>{accountT(t, "orders.detail.paymentStatus", "Payment status")}: <span className="font-semibold text-[var(--xd-gold-text)]">{accountValue(t, paymentStatusLabel)}</span></p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-[#050505]/5 bg-white p-6 shadow-sm">
                  <h3 className="mb-4 font-display text-lg font-bold text-[#050505]">{accountT(t, "common.summary", "Summary")}</h3>
                  <OrderPricingBreakdown order={order} deliveryLabel={deliveryLabel} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
