import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleX, Clock3, CreditCard, MapPin, Package, Send, UserRound, X } from "lucide-react";
import { useSearch } from "wouter";
import { useLanguage } from "@/context/LanguageContext";
import { formatCurrency } from "@/utils";
import { OrderPricingBreakdown } from "@/components/dental/OrderPricingBreakdown";
import {
  getAdminOrder,
  getAdminOrders,
  updateAdminOrderPaymentStatus,
  updateAdminOrderStatus,
  type AdminOrder,
  type AdminOrderStatus,
} from "@/services/adminOrders";
import type { OrderStatus, PaymentStatus } from "@/services/orders";
import { AdminLayout } from "./_components/AdminLayout";
import { AdminPageHeader, AdminStatusBadge, AdminTableShell } from "./_components/admin-ui";
import type { StatusTone } from "./admin-data";

const statusTone: Record<OrderStatus, StatusTone> = {
  PENDING_REVIEW: "amber",
  CONFIRMED: "green",
  PREPARING: "amber",
  OUT_FOR_DELIVERY: "blue",
  DELIVERED: "green",
  REJECTED: "red",
  CANCELED: "red",
};

const paymentStatusTone: Record<PaymentStatus, StatusTone> = {
  PENDING_COLLECTION: "amber",
  PAID: "green",
};

const paymentStatusKey: Record<PaymentStatus, string> = {
  PENDING_COLLECTION: "admin.orders.paymentStatuses.pendingCollection",
  PAID: "admin.orders.paymentStatuses.paid",
};

function statusIcon(status: OrderStatus) {
  if (status === "CONFIRMED" || status === "DELIVERED") return <CheckCircle2 size={12} aria-hidden="true" />;
  if (status === "REJECTED" || status === "CANCELED") return <CircleX size={12} aria-hidden="true" />;
  if (status === "PENDING_REVIEW" || status === "PREPARING") return <Clock3 size={12} aria-hidden="true" />;
  return <Send size={12} aria-hidden="true" />;
}

const statusKey: Record<OrderStatus, string> = {
  PENDING_REVIEW: "admin.orders.statuses.pendingReview",
  CONFIRMED: "admin.orders.statuses.confirmed",
  PREPARING: "admin.orders.statuses.preparing",
  OUT_FOR_DELIVERY: "admin.orders.statuses.outForDelivery",
  DELIVERED: "admin.orders.statuses.delivered",
  REJECTED: "admin.orders.statuses.rejected",
  CANCELED: "admin.orders.statuses.canceled",
};

const nextStatusActions: Record<OrderStatus, AdminOrderStatus[]> = {
  PENDING_REVIEW: ["CONFIRMED", "REJECTED", "CANCELED"],
  CONFIRMED: ["PREPARING", "CANCELED"],
  PREPARING: ["OUT_FOR_DELIVERY", "CANCELED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELED"],
  DELIVERED: [],
  REJECTED: [],
  CANCELED: [],
};

const statusActionKey: Record<AdminOrderStatus, string> = {
  PENDING_REVIEW: "admin.orders.statuses.pendingReview",
  CONFIRMED: "admin.orders.confirmOrder",
  PREPARING: "admin.orders.markPreparing",
  OUT_FOR_DELIVERY: "admin.orders.markOutForDelivery",
  DELIVERED: "admin.orders.markDelivered",
  REJECTED: "admin.orders.rejectOrder",
  CANCELED: "admin.orders.cancelOrder",
};

function formatDate(value: string, language: string) {
  return new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function OrderDetailPanel({
  order,
  isLoading,
  error,
  isUpdating,
  message,
  onClose,
  onStatusUpdate,
  onPaymentStatusUpdate,
}: {
  order: AdminOrder | null;
  isLoading: boolean;
  error: string | null;
  isUpdating: boolean;
  message: { text: string; tone: "success" | "destructive" | "error" } | null;
  onClose: () => void;
  onStatusUpdate: (status: AdminOrderStatus) => void;
  onPaymentStatusUpdate: (status: PaymentStatus) => void;
}) {
  const { t, language } = useLanguage();

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#050505]/35" role="dialog" aria-modal="true" aria-label={t("admin.orders.detailTitle")}>
      <button type="button" className="absolute inset-0 cursor-default" aria-label={t("admin.orders.closeDetails")} onClick={onClose} />
      <section className="relative z-10 h-full w-full max-w-2xl overflow-y-auto border-l border-[#EFE2BC] bg-[#FBFAF7] p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#D4A72C]">{t("admin.orders.detailEyebrow")}</p>
            <h2 className="mt-2 text-2xl font-bold text-[#050505]">{order?.orderNumber ?? t("admin.orders.detailTitle")}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#EFE2BC] bg-white p-2 text-[#717182] transition hover:bg-[#FFF7D6] hover:text-[#050505] dark:hover:border-[#D4A72C]/40 dark:hover:bg-white/[0.05] dark:hover:text-[#F6D85D]"
            aria-label={t("admin.orders.closeDetails")}
          >
            <X size={18} />
          </button>
        </div>

        {isLoading && <p className="mt-8 text-sm font-semibold text-[#717182]">{t("admin.orders.loadingDetails")}</p>}
        {error && <div role="alert" className="mt-6 rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] p-4 text-sm font-semibold text-[#B42318]">{error}</div>}

        {order && (
          <div className="mt-6 space-y-5">
            {message && (
              <div
                role={message.tone === "error" ? "alert" : "status"}
                className={`rounded-lg border p-4 text-sm font-semibold ${
                  message.tone === "success"
                    ? "border-[#CFE8D6] bg-[#F4FBF5] text-[#16803C]"
                    : "border-[#F2C8C8] bg-[#FFF3F3] text-[#B42318]"
                }`}
              >
                {message.text}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#EFE2BC] bg-white p-4">
              <div className="flex flex-wrap gap-6">
                <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#717182]">{t("admin.orders.currentStatus")}</p>
                <div className="mt-2">
                  <AdminStatusBadge tone={statusTone[order.status]} icon={statusIcon(order.status)}>{t(statusKey[order.status])}</AdminStatusBadge>
                </div>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#717182]">{t("admin.orders.paymentStatus")}</p>
                  <div className="mt-2">
                    <AdminStatusBadge tone={paymentStatusTone[order.paymentStatus]}>{t(paymentStatusKey[order.paymentStatus])}</AdminStatusBadge>
                  </div>
                </div>
              </div>
              <p className="text-2xl font-bold text-[#050505]">{formatCurrency(order.total)}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <section className="rounded-lg border border-[#EFE2BC] bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-[#050505]"><UserRound size={17} className="text-[#D4A72C]" />{t("admin.orders.customerDetails")}</div>
                <div className="mt-3 space-y-1.5 text-sm text-[#717182]">
                  <p className="font-semibold text-[#050505]">{order.customer.name}</p>
                  <p className="break-all">{order.customer.email}</p>
                  <p>{order.customer.phone || t("admin.orders.notProvided")}</p>
                </div>
              </section>

              <section className="rounded-lg border border-[#EFE2BC] bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-[#050505]"><MapPin size={17} className="text-[#D4A72C]" />{t("admin.orders.shippingDetails")}</div>
                <div className="mt-3 space-y-1.5 text-sm text-[#717182]">
                  <p>{order.shippingAddress.line1}</p>
                  <p>{[order.shippingAddress.city, order.shippingAddress.governorate].filter(Boolean).join(", ")}</p>
                  <p>{order.shippingAddress.country}</p>
                  {order.shippingAddress.apartmentFloor && <p>{order.shippingAddress.apartmentFloor}</p>}
                  <p className="font-semibold text-[#050505]">{t(`checkout.shippingMethods.${order.deliveryMethod}.title`, { fallback: order.deliveryMethod })}</p>
                </div>
              </section>
            </div>

            <section className="rounded-lg border border-[#EFE2BC] bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-[#050505]"><CreditCard size={17} className="text-[#D4A72C]" />{t("admin.orders.paymentAndNotes")}</div>
              <div className="mt-3 grid gap-3 text-sm text-[#717182] sm:grid-cols-2">
                <div><span className="font-semibold text-[#050505]">{t("admin.orders.paymentMethod")}: </span>{t(`checkout.paymentMethods.${order.paymentMethod}.title`, { fallback: order.paymentMethod })}</div>
                <div><span className="font-semibold text-[#050505]">{t("admin.orders.paymentStatus")}: </span>{t(paymentStatusKey[order.paymentStatus])}</div>
                <div><span className="font-semibold text-[#050505]">{t("admin.orders.deliveryNotes")}: </span>{order.shippingAddress.deliveryNotes || t("admin.orders.notProvided")}</div>
                <div className="sm:col-span-2"><span className="font-semibold text-[#050505]">{t("admin.orders.orderNotes")}: </span>{order.orderNotes || t("admin.orders.notProvided")}</div>
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-[#EFE2BC] bg-white">
              <div className="flex items-center gap-2 border-b border-[#EFE2BC] px-4 py-3 text-sm font-bold text-[#050505]"><Package size={17} className="text-[#D4A72C]" />{t("admin.orders.items")}</div>
              <div className="divide-y divide-[#F3E8C8]">
                {order.items.map((item) => (
                  <div key={item.id} className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4">
                    <div>
                      <p className="font-semibold text-[#050505]">{item.productName}</p>
                      {item.sku && <p className="mt-1 text-xs text-[#717182]">{item.sku}</p>}
                      {item.promotionDiscount !== null && item.promotionDiscount > 0 && (
                        <p className="mt-1 text-xs font-semibold text-[#16803C]">
                          {(language === "ar" ? item.promotionTitleAr : item.promotionTitleEn) || t("admin.orders.productPromotionSavings")}
                          {item.originalUnitPrice !== null && (
                            <span className="ms-2 font-normal text-[#8A8D9A] line-through">
                              {formatCurrency(item.originalUnitPrice * item.quantity)}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <p className="text-[#717182]">{t("admin.orders.quantity", { values: { quantity: item.quantity } })}</p>
                    <p className="font-semibold text-[#050505]">{formatCurrency(item.total)}</p>
                  </div>
                ))}
              </div>
              <OrderPricingBreakdown
                order={order}
                deliveryLabel={t(`checkout.shippingMethods.${order.deliveryMethod}.title`, { fallback: order.deliveryMethod })}
                className="border-t border-[#EFE2BC] bg-[#FFF9E8] px-4 py-3 dark:bg-[#D4A72C]/[0.06]"
              />
            </section>

            <div className="flex flex-wrap gap-3 border-t border-[#EFE2BC] pt-5">
              {nextStatusActions[order.status].map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={isUpdating}
                  onClick={() => onStatusUpdate(status)}
                  className={status === "REJECTED" || status === "CANCELED"
                    ? "rounded-lg border border-[#F2C8C8] bg-white px-4 py-2.5 text-sm font-bold text-[#B42318] transition hover:bg-[#FFF3F3] dark:hover:border-[#F97066]/40 dark:hover:bg-[#B42318]/15 dark:hover:text-[#FDA29B] disabled:cursor-not-allowed disabled:opacity-60"
                    : "rounded-lg bg-[#F9DC5C] px-4 py-2.5 text-sm font-bold text-[#050505] transition hover:bg-[#D4A72C] disabled:cursor-not-allowed disabled:opacity-60"}
                >
                  {t(statusActionKey[status])}
                </button>
              ))}
              {order.paymentStatus === "PENDING_COLLECTION" && order.status !== "REJECTED" && order.status !== "CANCELED" && (
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => onPaymentStatusUpdate("PAID")}
                  className="rounded-lg border border-[#16803C]/30 bg-[#16803C]/10 px-4 py-2.5 text-sm font-bold text-[#16803C] transition hover:bg-[#16803C]/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t("admin.orders.markCashCollected")}
                </button>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default function AdminOrders() {
  const search = useSearch();
  const { t, language } = useLanguage();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; tone: "success" | "destructive" | "error" } | null>(null);
  const orderSearchQuery = useMemo(() => new URLSearchParams(search).get("search")?.trim() ?? "", [search]);

  const loadOrders = () => {
    setIsLoading(true);
    setLoadError(null);
    getAdminOrders({ search: orderSearchQuery })
      .then(setOrders)
      .catch(() => setLoadError(t("admin.orders.loadError")))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError(null);
    getAdminOrders({ search: orderSearchQuery })
      .then((result) => { if (active) setOrders(result); })
      .catch(() => { if (active) setLoadError(t("admin.orders.loadError")); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [orderSearchQuery, t]);

  const openOrder = async (id: string) => {
    setSelectedOrderId(id);
    setSelectedOrder(null);
    setDetailError(null);
    setActionMessage(null);
    setIsDetailLoading(true);
    try {
      setSelectedOrder(await getAdminOrder(id));
    } catch {
      setDetailError(t("admin.orders.detailError"));
    } finally {
      setIsDetailLoading(false);
    }
  };

  const closeOrder = () => {
    setSelectedOrderId(null);
    setSelectedOrder(null);
    setDetailError(null);
    setActionMessage(null);
  };

  const handleStatusUpdate = async (status: AdminOrderStatus) => {
    if (!selectedOrder) return;
    if (status === "REJECTED" && !window.confirm(t("admin.orders.confirmReject"))) return;
    if (status === "CANCELED" && !window.confirm(t("admin.orders.confirmCancel"))) return;

    setIsUpdating(true);
    setActionMessage(null);
    try {
      const result = await updateAdminOrderStatus(selectedOrder.id, status);
      setSelectedOrder(result.order);
      setOrders((current) => current.map((order) => order.id === result.order.id ? result.order : order));
      setActionMessage({
        tone: status === "REJECTED" || status === "CANCELED" ? "destructive" : "success",
        text: t("admin.orders.statusUpdatedMessage", {
          values: { status: t(statusKey[status]) },
        }),
      });
    } catch {
      setActionMessage({ tone: "error", text: t("admin.orders.updateError") });
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePaymentStatusUpdate = async (paymentStatus: PaymentStatus) => {
    if (!selectedOrder) return;
    setIsUpdating(true);
    setActionMessage(null);
    try {
      const result = await updateAdminOrderPaymentStatus(selectedOrder.id, paymentStatus);
      setSelectedOrder(result.order);
      setOrders((current) => current.map((order) => order.id === result.order.id ? result.order : order));
      setActionMessage({ tone: "success", text: t("admin.orders.cashCollectedMessage") });
    } catch {
      setActionMessage({ tone: "error", text: t("admin.orders.paymentUpdateError") });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminPageHeader title={t("admin.orders.title")} description={t("admin.orders.description")} />

        {loadError && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] p-4 text-sm font-semibold text-[#B42318]">
            <span>{loadError}</span>
            <button type="button" onClick={loadOrders} className="rounded-md border border-[#F2C8C8] bg-white px-3 py-1.5 text-xs font-bold">{t("admin.orders.retry")}</button>
          </div>
        )}

        <AdminTableShell>
          <table className="min-w-full divide-y divide-[#EFE2BC] text-sm">
            <thead className="bg-[#FFF9E8] text-left text-xs uppercase tracking-wide text-[#717182]">
              <tr>
                <th className="px-5 py-3 font-bold">{t("admin.orders.columns.order")}</th>
                <th className="px-5 py-3 font-bold">{t("admin.orders.columns.customer")}</th>
                <th className="px-5 py-3 font-bold">{t("admin.orders.columns.items")}</th>
                <th className="px-5 py-3 font-bold">{t("admin.orders.columns.total")}</th>
                <th className="px-5 py-3 font-bold">{t("admin.orders.columns.date")}</th>
                <th className="px-5 py-3 font-bold">{t("admin.orders.columns.status")}</th>
                <th className="px-5 py-3 font-bold">{t("admin.orders.columns.payment")}</th>
                <th className="px-5 py-3 font-bold">{t("admin.orders.columns.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3E8C8]">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-5 py-4 font-semibold text-[#050505]">{order.orderNumber}</td>
                  <td className="px-5 py-4"><p className="font-semibold text-[#050505]">{order.customer.name}</p><p className="mt-1 text-xs text-[#717182]">{order.customer.email}</p></td>
                  <td className="px-5 py-4 text-[#717182]">{order.itemCount}</td>
                  <td className="px-5 py-4 font-semibold text-[#050505]">{formatCurrency(order.total)}</td>
                  <td className="px-5 py-4 text-[#717182]">{formatDate(order.createdAt, language)}</td>
                  <td className="px-5 py-4"><AdminStatusBadge tone={statusTone[order.status]} icon={statusIcon(order.status)}>{t(statusKey[order.status])}</AdminStatusBadge></td>
                  <td className="px-5 py-4"><AdminStatusBadge tone={paymentStatusTone[order.paymentStatus]}>{t(paymentStatusKey[order.paymentStatus])}</AdminStatusBadge></td>
                  <td className="px-5 py-4"><button type="button" onClick={() => openOrder(order.id)} className="rounded-md border border-[#050505]/10 bg-white px-3 py-2 text-xs font-bold text-[#050505] transition hover:border-[#D4A72C]/60 hover:bg-[#FFF7D6] dark:hover:border-[#D4A72C]/40 dark:hover:bg-white/[0.05] dark:hover:text-[#F6D85D]">{t("admin.orders.viewOrder")}</button></td>
                </tr>
              ))}
              {isLoading && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-sm font-medium text-[#717182]">{t("admin.orders.loading")}</td></tr>
              )}
              {!isLoading && !loadError && orders.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-sm font-medium text-[#717182]">{orderSearchQuery ? t("admin.orders.noSearchResults") : t("admin.orders.empty")}</td></tr>
              )}
            </tbody>
          </table>
        </AdminTableShell>
      </div>

      {selectedOrderId && (
        <OrderDetailPanel
          order={selectedOrder}
          isLoading={isDetailLoading}
          error={detailError}
          isUpdating={isUpdating}
          message={actionMessage}
          onClose={closeOrder}
          onStatusUpdate={handleStatusUpdate}
          onPaymentStatusUpdate={handlePaymentStatusUpdate}
        />
      )}
    </AdminLayout>
  );
}
