import { apiRequest } from "./http";
import type { EmailDelivery } from "./emailDeliveries";

export type ProductRequestStatus = "Under Review" | "Available" | "Searching Supplier" | "Not Available" | "Canceled";

export type SupportThreadSummary = {
  id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  priority: string;
  lastMessageAt: string;
};

export type ApiProductRequest = {
  id: string;
  requestNumber: string;
  user?: { id: string; name: string; email: string; role: string };
  productId: string | null;
  externalProductId: string | null;
  productName: string;
  brand: string;
  sku: string;
  category: string;
  quantity: number | null;
  branch: string;
  message: string;
  notes: string;
  status: ProductRequestStatus;
  source: "PRODUCT_PAGE" | "ACCOUNT_PAGE" | "CHAT";
  chatThread: SupportThreadSummary | null;
  teamUpdates: Array<{ title: string; date: string }>;
  attachments: Array<{ name: string; url?: string; mimeType?: string; size?: number }>;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  emailDelivery?: EmailDelivery | null;
};

export type CreateProductRequestInput = {
  productId?: string;
  productName: string;
  brand?: string;
  sku?: string;
  category?: string;
  quantity?: number;
  branch?: string;
  message?: string;
  notes?: string;
  source: "PRODUCT_PAGE" | "ACCOUNT_PAGE" | "CHAT";
};

export async function getMyProductRequests() {
  const result = await apiRequest<{ productRequests: ApiProductRequest[] }>("/product-requests/my");
  return result.productRequests;
}

export async function getMyProductRequest(id: string) {
  const result = await apiRequest<{ productRequest: ApiProductRequest }>(`/product-requests/my/${id}`);
  return result.productRequest;
}

export async function createProductRequest(input: CreateProductRequestInput) {
  return apiRequest<{ productRequest: ApiProductRequest; supportThread: SupportThreadSummary }>("/product-requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function cancelMyProductRequest(id: string) {
  const result = await apiRequest<{ productRequest: ApiProductRequest }>(`/product-requests/my/${id}/cancel`, {
    method: "PATCH",
  });
  return result.productRequest;
}

export async function updateMyProductRequestDetails(id: string, input: { note?: string; attachments?: Array<{ name: string; mimeType?: string; size?: number }> }) {
  const result = await apiRequest<{ productRequest: ApiProductRequest }>(`/product-requests/my/${id}/details`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return result.productRequest;
}

export async function getAdminProductRequests() {
  const result = await apiRequest<{ productRequests: ApiProductRequest[] }>("/admin/product-requests");
  return result.productRequests;
}

export async function updateAdminProductRequestStatus(id: string, status: ProductRequestStatus) {
  const result = await apiRequest<{ productRequest: ApiProductRequest }>(`/admin/product-requests/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return result.productRequest;
}
