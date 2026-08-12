import { apiRequest } from "./http";
import type { CustomerOrder, OrderStatus, PaymentStatus } from "./orders";

export type AdminOrderStatus = OrderStatus;

export type AdminOrder = CustomerOrder & {
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
  };
};

export async function getAdminOrders(options: { search?: string; status?: OrderStatus } = {}) {
  const params = new URLSearchParams();
  if (options.search?.trim()) params.set("search", options.search.trim());
  if (options.status) params.set("status", options.status);
  const query = params.toString();
  const result = await apiRequest<{ orders: AdminOrder[] }>(`/admin/orders${query ? `?${query}` : ""}`);
  return result.orders;
}

export async function getAdminOrder(id: string) {
  const result = await apiRequest<{ order: AdminOrder }>(`/admin/orders/${encodeURIComponent(id)}`);
  return result.order;
}

export async function updateAdminOrderStatus(id: string, status: AdminOrderStatus) {
  const result = await apiRequest<{ order: AdminOrder; statusChanged: boolean }>(
    `/admin/orders/${encodeURIComponent(id)}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }
  );
  return result;
}

export async function updateAdminOrderPaymentStatus(id: string, paymentStatus: PaymentStatus) {
  const result = await apiRequest<{ order: AdminOrder; paymentStatusChanged: boolean }>(
    `/admin/orders/${encodeURIComponent(id)}/payment-status`,
    {
      method: "PATCH",
      body: JSON.stringify({ paymentStatus }),
    }
  );
  return result;
}
