import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { Container } from "@/components/dental/Container";
import { AccountSidebar } from "@/components/dental/AccountSidebar";
import { StatusBadge } from "@/components/dental/StatusBadge";
import { Button } from "@/components/dental/Button";
import { useStore } from "@/context/StoreContext";
import { useLanguage } from "@/context/LanguageContext";
import { mockOrders } from "@/data/orders";
import { formatCurrency } from "@/utils";
import { MapPin, CreditCard, Download, CheckCircle2, Circle } from "lucide-react";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { accountT, accountValue } from "@/lib/accountI18n";

export default function AccountOrderDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { addToCart, currentUser } = useStore();
  const { t } = useLanguage();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isTrackingFocused, setIsTrackingFocused] = useState(false);
  const order = currentUser?.isDemo ? mockOrders.find(o => o.id === id) : undefined;

  useEffect(() => {
    const focusTrackingSection = () => {
      const shouldFocusTracking = window.location.hash === "#tracking";

      setIsTrackingFocused(shouldFocusTracking);

      if (!shouldFocusTracking) return;

      window.requestAnimationFrame(() => {
        document.getElementById("tracking")?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
    };

    focusTrackingSection();
    window.addEventListener("hashchange", focusTrackingSection);

    return () => {
      window.removeEventListener("hashchange", focusTrackingSection);
    };
  }, [id]);

  if (!order) {
    return <div className="text-center py-20">{accountT(t, "orders.detail.notFound", "Order not found")}</div>;
  }

  const handleDownloadInvoice = () => {
    const lines = [
      `Invoice for ${order.orderNumber}`,
      `Placed: ${new Date(order.date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}`,
      `Payment: ${order.paymentMethod}`,
      `Payment Status: ${order.paymentStatus}`,
      "",
      "Items:",
      ...order.items.map(
        (item) =>
          `${item.product.name} - Qty ${item.quantity} - ${formatCurrency(item.price * item.quantity)}`
      ),
      "",
      `Subtotal: ${formatCurrency(order.subtotal || 0)}`,
      `Shipping: ${formatCurrency(order.shipping || 0)}`,
      order.discount ? `Discount: -${formatCurrency(order.discount)}` : undefined,
      `Total: ${formatCurrency(order.total)}`,
    ].filter(Boolean);

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${order.orderNumber.toLowerCase()}-invoice.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setStatusMessage(accountT(t, "orders.detail.invoiceDownloaded", "Invoice for {orderNumber} downloaded.", { orderNumber: order.orderNumber }));
  };

  const handleReorderItems = () => {
    order.items.forEach((item) => {
      addToCart(item.product, item.quantity, item.selectedOptions ?? undefined);
    });

    navigate("/cart");
  };

  return (
    <div className="bg-[var(--xd-bg)] pb-14 pt-10 lg:pb-20 lg:pt-14">
      <Container className="overflow-x-clip">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:gap-7">
          <AccountSidebar />
          
          <div className="min-w-0 space-y-6">
            <div className="flex items-center gap-4 mb-2">
              <Link href="/account/orders" className="p-2 -ml-2 text-[#7A7A7A] hover:text-[#050505] transition-colors rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)]">
                <DirectionalIcon direction="back" size={20} />
              </Link>
              <h1 className="text-3xl font-display font-bold text-[#050505]">{accountT(t, "orders.detail.title", "Order Details")}</h1>
            </div>

            <div className="bg-white rounded-[24px] p-6 lg:p-8 border border-[#050505]/5 shadow-sm flex flex-col md:flex-row justify-between md:items-center gap-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold text-[#050505]">{order.orderNumber}</h2>
                  <StatusBadge status={order.status} />
                </div>
                <p className="text-[#7A7A7A]">
                  {accountT(t, "orders.detail.placedOn", "Placed on {date}", {
                    date: new Date(order.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                  })}
                </p>
              </div>
              <div className="flex gap-4">
                <Button type="button" onClick={handleDownloadInvoice} variant="secondary" className="gap-2">
                  <Download size={18} /> {accountT(t, "orders.detail.invoice", "Invoice")}
                </Button>
                {order.status === 'Delivered' && (
                  <Button type="button" onClick={handleReorderItems} variant="primary">{accountT(t, "orders.detail.reorderItems", "Reorder Items")}</Button>
                )}
              </div>
            </div>

            {statusMessage && (
              <div
                role="status"
                className="rounded-[14px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-active)]/[0.08] px-4 py-3 text-[13px] font-semibold text-[#5F5F5F]"
              >
                {statusMessage}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Tracking & Items */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Tracking */}
                <div
                  id="tracking"
                  className={`scroll-mt-28 rounded-[24px] bg-white p-6 transition-all duration-300 lg:p-8 ${
                    isTrackingFocused
                      ? "border border-[var(--xd-gold-active)]/60 shadow-[0_18px_46px_var(--xd-gold-bg-medium)] ring-4 ring-[var(--xd-gold-bg-soft)]"
                      : "border border-[#050505]/5 shadow-sm"
                  }`}
                >
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-display text-lg font-bold text-[#050505]">{accountT(t, "orders.detail.orderStatus", "Order Status")}</h3>
                    {isTrackingFocused && (
                      <span className="rounded-full bg-[var(--xd-gold)]/15 px-3 py-1 text-[12px] font-bold text-[var(--xd-gold-text)]">
                        {accountT(t, "orders.detail.trackingTimeline", "Tracking timeline")}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    {order.trackingSteps?.map((step, index) => {
                      const isLast = index === (order.trackingSteps?.length || 0) - 1;
                      const isCompleted = step.status === 'completed';
                      const isCurrent = step.status === 'current';
                      
                      return (
                        <div key={index} className="flex gap-4 relative pb-8 last:pb-0">
                          {!isLast && (
                            <div className={`absolute left-3 top-8 bottom-0 w-[2px] ${isCompleted ? 'bg-[#16803C]' : 'bg-gray-100'}`} />
                          )}
                          <div className="relative z-10 shrink-0 bg-white">
                            {isCompleted ? (
                              <CheckCircle2 size={24} className="text-[#16803C] fill-[#16803C]/10" />
                            ) : isCurrent ? (
                              <div className="w-6 h-6 rounded-full border-2 border-[var(--xd-gold-active)] flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-[var(--xd-gold)]" />
                              </div>
                            ) : (
                              <Circle size={24} className="text-gray-300" />
                            )}
                          </div>
                          <div className="-mt-0.5">
                            <h4 className={`font-semibold ${isCompleted || isCurrent ? 'text-[#050505]' : 'text-[#9A9A9A]'}`}>{accountValue(t, step.label)}</h4>
                            {step.date && (
                              <p className="text-sm text-[#7A7A7A] mt-1">
                                {new Date(step.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Items */}
                <div className="bg-white rounded-[24px] p-6 lg:p-8 border border-[#050505]/5 shadow-sm">
                  <h3 className="font-display font-bold text-lg text-[#050505] mb-6">
                    {accountT(t, "orders.detail.itemsTitle", "Items ({count})", { count: order.itemCount })}
                  </h3>
                  <div className="space-y-6">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex gap-4 pb-6 border-b border-gray-100 last:border-0 last:pb-0">
                        <div className="w-20 h-20 rounded-xl bg-[var(--xd-bg)] border border-[#050505]/5 shrink-0 overflow-hidden p-2">
                          <img
                            src={item.product.image}
                            alt={item.product.name}
                            width={2525}
                            height={2582}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover mix-blend-multiply"
                          />
                        </div>
                        <div className="flex-1 flex justify-between">
                          <div>
                            <div className="text-xs font-semibold text-[var(--xd-gold-text)] mb-1 uppercase tracking-wider">{item.product.brand}</div>
                            <h4 className="font-semibold text-[#050505] line-clamp-1">{item.product.name}</h4>
                            <div className="text-sm text-[#7A7A7A] mt-1">
                              {accountT(t, "common.qtyValue", "Qty: {quantity}", { quantity: item.quantity })} {item.selectedOptions && `• ${item.selectedOptions}`}
                            </div>
                          </div>
                          <div className="text-right font-bold text-[#050505]">
                            {formatCurrency(item.price * item.quantity)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Right Column: Details */}
              <div className="space-y-6">
                
                <div className="bg-white rounded-[24px] p-6 border border-[#050505]/5 shadow-sm space-y-6">
                  <div>
                    <h3 className="flex items-center gap-2 font-display font-bold text-lg text-[#050505] mb-3">
                      <MapPin size={20} className="text-[var(--xd-gold-text)]" /> {accountT(t, "orders.detail.shippingInfo", "Shipping Info")}
                    </h3>
                    <div className="text-sm text-[#5F5F5F] bg-[var(--xd-bg)] p-4 rounded-xl">
                      <p className="font-semibold text-[#050505] mb-1">{order.shippingAddress?.name}</p>
                      <p>{order.shippingAddress?.line1}</p>
                      <p>{order.shippingAddress?.city}, {order.shippingAddress?.governorate}</p>
                      <p>{order.shippingAddress?.phone}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="flex items-center gap-2 font-display font-bold text-lg text-[#050505] mb-3">
                      <CreditCard size={20} className="text-[var(--xd-gold-text)]" /> {accountT(t, "orders.detail.paymentInfo", "Payment Info")}
                    </h3>
                    <div className="text-sm text-[#5F5F5F] bg-[var(--xd-bg)] p-4 rounded-xl">
                      <p className="font-semibold text-[#050505] mb-1">{accountValue(t, order.paymentMethod)}</p>
                      <p>{accountT(t, "common.status", "Status")}: <span className="text-[#16803C] font-semibold">{accountValue(t, order.paymentStatus)}</span></p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-[24px] p-6 border border-[#050505]/5 shadow-sm">
                  <h3 className="font-display font-bold text-lg text-[#050505] mb-4">{accountT(t, "common.summary", "Summary")}</h3>
                  <div className="space-y-3 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-[#7A7A7A]">{accountT(t, "common.subtotal", "Subtotal")}</span>
                      <span className="font-medium text-[#050505]">{formatCurrency(order.subtotal || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#7A7A7A]">{accountT(t, "orders.detail.shippingMethod", "Shipping ({method})", { method: accountValue(t, order.deliveryMethod) })}</span>
                      <span className="font-medium text-[#050505]">{formatCurrency(order.shipping || 0)}</span>
                    </div>
                    {order.discount && order.discount > 0 ? (
                      <div className="flex justify-between text-[#16803C]">
                        <span>{accountT(t, "common.discount", "Discount")}</span>
                        <span className="font-medium">-{formatCurrency(order.discount)}</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="border-t border-gray-100 pt-4 flex justify-between items-center">
                    <span className="font-semibold text-[#050505]">{accountT(t, "common.total", "Total")}</span>
                    <span className="font-display font-bold text-2xl text-[#050505]">{formatCurrency(order.total)}</span>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
