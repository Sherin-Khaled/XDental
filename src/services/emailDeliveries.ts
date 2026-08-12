import { apiRequest } from "./http";

export type EmailDeliveryStatus = "DISABLED" | "PENDING" | "SENT" | "FAILED";
export type EmailNotificationCategory =
  | "CONTACT"
  | "NEWSLETTER"
  | "QUOTE"
  | "PRODUCT_REQUEST"
  | "MACHINE_INQUIRY"
  | "SUPPORT";

export type EmailDelivery = {
  id: string;
  category: EmailNotificationCategory;
  entityId: string;
  status: EmailDeliveryStatus;
  recipient: string | null;
  replyTo: string | null;
  subject: string | null;
  retryCount: number;
  lastAttemptAt: string | null;
  lastRetryAt: string | null;
  sentAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getAdminEmailDeliveries(filters?: {
  category?: EmailNotificationCategory;
  status?: EmailDeliveryStatus;
  search?: string;
}) {
  const query = new URLSearchParams();
  if (filters?.category) query.set("category", filters.category);
  if (filters?.status) query.set("status", filters.status);
  if (filters?.search) query.set("search", filters.search);
  const suffix = query.size ? `?${query.toString()}` : "";
  const result = await apiRequest<{ emailDeliveries: EmailDelivery[] }>(
    `/admin/email-deliveries${suffix}`
  );
  return result.emailDeliveries;
}

export async function retryAdminEmailDelivery(id: string) {
  const result = await apiRequest<{ emailDelivery: EmailDelivery }>(
    `/admin/email-deliveries/${encodeURIComponent(id)}/retry`,
    { method: "POST" }
  );
  return result.emailDelivery;
}

