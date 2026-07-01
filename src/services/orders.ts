import { apiRequest } from "./http";

export type OrderStatus =
  | "PENDING"
  | "SENT_TO_OWNER_SYSTEM"
  | "CONFIRMED"
  | "REJECTED"
  | "CANCELED";

export type OrderStatusLabel =
  | "Pending"
  | "Sent to Supplier/System"
  | "Confirmed"
  | "Rejected"
  | "Canceled";

export type OrderItem = {
  id: string;
  productId: string | null;
  externalProductId: string | null;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type CustomerOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: {
    name: string;
    line1: string;
    city: string;
    governorate: string;
    country: string;
    phone: string;
    apartmentFloor: string;
    postalCode: string;
    deliveryNotes: string;
    clinicName: string;
    clinicBranch: string;
  };
  deliveryMethod: string;
  orderNotes: string;
  paymentMethod: string;
  syncStatus: string | null;
  itemCount: number;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
};

export type CreateOrderInput = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  country: string;
  governorate: string;
  cityArea: string;
  streetAddress: string;
  buildingNumber: string;
  apartmentFloor?: string;
  postalCode?: string;
  deliveryNotes?: string;
  clinicName?: string;
  clinicBranch?: string;
  orderNotes?: string;
  deliveryMethod: string;
  paymentMethod: string;
  items: Array<{
    productId?: string;
    externalProductId?: string;
    productName: string;
    sku?: string;
    selectedOptions?: string;
    quantity: number;
    unitPrice: number;
  }>;
};

export function getOrderStatusLabel(status: OrderStatus): OrderStatusLabel {
  const labels: Record<OrderStatus, OrderStatusLabel> = {
    PENDING: "Pending",
    SENT_TO_OWNER_SYSTEM: "Sent to Supplier/System",
    CONFIRMED: "Confirmed",
    REJECTED: "Rejected",
    CANCELED: "Canceled",
  };
  return labels[status];
}

export async function createOrder(input: CreateOrderInput) {
  const result = await apiRequest<{ order: CustomerOrder }>("/orders", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return result.order;
}

export async function getMyOrders() {
  const result = await apiRequest<{ orders: CustomerOrder[] }>("/orders/my");
  return result.orders;
}

export async function getMyOrder(id: string) {
  const result = await apiRequest<{ order: CustomerOrder }>(`/orders/my/${encodeURIComponent(id)}`);
  return result.order;
}
