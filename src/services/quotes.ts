import { apiRequest } from "./http";
import type { EmailDelivery } from "./emailDeliveries";

export type QuoteStatus =
  | "PENDING"
  | "SUPPLIER_REVIEW"
  | "DRAFT_RESPONSE"
  | "SENT"
  | "ACCEPTED"
  | "REJECTED"
  | "CANCELED";

export type QuoteItem = {
  id: string;
  productId: string | null;
  productName: string;
  brand: string | null;
  sku: string | null;
  quantity: number;
  selectedOptions: string | null;
  requestedPrice: number | null;
  quotedPrice: number | null;
};

export type Quote = {
  id: string;
  quoteNumber: string;
  status: QuoteStatus;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
  notes: string;
  adminResponse: string;
  quotedPrice: number | null;
  supportThreadId: string | null;
  supportThread: {
    id: string;
    ticketNumber: string;
    status: string;
    createdAt: string;
  } | null;
  items: QuoteItem[];
  itemCount: number;
  totalQuantity: number;
  emailDelivery?: EmailDelivery | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateQuoteInput = {
  notes?: string;
  items: Array<{
    productId?: string;
    productName: string;
    brand?: string;
    sku?: string;
    quantity: number;
    selectedOptions?: string;
    requestedPrice?: number;
  }>;
};

export async function createQuote(input: CreateQuoteInput) {
  const result = await apiRequest<{ quote: Quote }>("/quotes", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return result.quote;
}

export async function getMyQuotes() {
  const result = await apiRequest<{ quotes: Quote[] }>("/quotes/my");
  return result.quotes;
}

export async function getMyQuote(id: string) {
  const result = await apiRequest<{ quote: Quote }>(`/quotes/my/${encodeURIComponent(id)}`);
  return result.quote;
}

export async function getAdminQuotes(options: { search?: string; status?: QuoteStatus } = {}) {
  const params = new URLSearchParams();
  if (options.search?.trim()) params.set("search", options.search.trim());
  if (options.status) params.set("status", options.status);
  const query = params.toString();
  const result = await apiRequest<{ quotes: Quote[] }>(`/admin/quotes${query ? `?${query}` : ""}`);
  return result.quotes;
}

export async function getAdminQuote(id: string) {
  const result = await apiRequest<{ quote: Quote }>(`/admin/quotes/${encodeURIComponent(id)}`);
  return result.quote;
}

export async function updateAdminQuoteStatus(id: string, status: QuoteStatus) {
  const result = await apiRequest<{ quote: Quote }>(`/admin/quotes/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return result.quote;
}

export async function respondToAdminQuote(
  id: string,
  input: { adminResponse: string; quotedPrice?: number; status: "DRAFT_RESPONSE" | "SENT" }
) {
  const result = await apiRequest<{ quote: Quote }>(`/admin/quotes/${encodeURIComponent(id)}/response`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return result.quote;
}
