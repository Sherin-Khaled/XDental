import { apiRequest } from "./http";
import type { EmailDelivery } from "./emailDeliveries";

export type ContactMessageInput = {
  name: string;
  email?: string;
  phone?: string;
  subject?: string;
  message: string;
  source?: "contact_page" | "account";
  website?: string;
};

/** Stores a contact message in the backend; resolves only after the save succeeds. */
export async function submitContactMessage(input: ContactMessageInput) {
  return apiRequest<{ message: string; contactMessage: { id: string; createdAt: string } }>("/contact", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Subscribes an email to the newsletter; duplicates resolve as success. */
export async function subscribeToNewsletter(input: { email: string; source?: string; locale?: string; website?: string }) {
  return apiRequest<{ message: string; alreadySubscribed: boolean }>("/newsletter/subscribe", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type ContactMessageStatus = "NEW" | "REVIEWED" | "RESOLVED";

export type AdminContactMessage = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  subject: string | null;
  message: string;
  source: string;
  status: ContactMessageStatus;
  internalNotes: string;
  archivedAt: string | null;
  emailDelivery: EmailDelivery | null;
  user: { id: string; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
};

export async function getAdminContactMessages(options: {
  status?: ContactMessageStatus;
  search?: string;
  includeArchived?: boolean;
} = {}) {
  const query = new URLSearchParams();
  if (options.status) query.set("status", options.status);
  if (options.search?.trim()) query.set("search", options.search.trim());
  if (options.includeArchived) query.set("includeArchived", "true");
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const result = await apiRequest<{ contactMessages: AdminContactMessage[] }>(`/admin/contact-messages${suffix}`);
  return result.contactMessages;
}

export async function updateAdminContactMessage(
  id: string,
  input: { internalNotes?: string; archived?: boolean }
) {
  const result = await apiRequest<{ contactMessage: AdminContactMessage }>(
    `/admin/contact-messages/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
  return result.contactMessage;
}

export async function updateAdminContactMessageStatus(id: string, status: ContactMessageStatus) {
  const result = await apiRequest<{ contactMessage: AdminContactMessage }>(
    `/admin/contact-messages/${encodeURIComponent(id)}/status`,
    { method: "PATCH", body: JSON.stringify({ status }) }
  );
  return result.contactMessage;
}

export type AdminNewsletterSubscriber = {
  id: string;
  email: string;
  source: string | null;
  locale: string | null;
  status: "SUBSCRIBED" | "UNSUBSCRIBED";
  emailDelivery: EmailDelivery | null;
  createdAt: string;
};

export async function getAdminNewsletterSubscribers() {
  const result = await apiRequest<{ subscribers: AdminNewsletterSubscriber[] }>("/admin/newsletter-subscribers");
  return result.subscribers;
}
