import { apiRequest } from "./http";
import type { EmailDelivery } from "./emailDeliveries";

export type SupportThread = {
  id: string;
  ticketNumber: string;
  user?: { id: string; name: string; email: string; role: string };
  productRequestId: string | null;
  subject: string;
  type: "PRODUCT_REQUEST" | "GENERAL_SUPPORT" | "ORDER" | "QUOTE";
  related: string;
  status: "Open" | "Waiting for Support" | "Waiting for Customer" | "Resolved";
  priority: "Normal" | "Urgent";
  lastMessageAt: string;
  latestMessage: string;
  createdAt: string;
  updatedAt: string;
  emailDelivery?: EmailDelivery | null;
};

export type SupportMessage = {
  id: string;
  threadId: string;
  sender: { id: string; name: string; email: string; role: string } | null;
  senderRole: "CUSTOMER" | "SUPPORT" | "ADMIN" | "SYSTEM";
  body: string;
  readAt: string | null;
  createdAt: string;
};

export async function getMySupportThreads(signal?: AbortSignal) {
  const result = await apiRequest<{ supportThreads: SupportThread[] }>("/support/threads/my", { signal });
  return result.supportThreads;
}

export async function createSupportThread(input: {
  subject: string;
  type: SupportThread["type"];
  related?: string;
  priority: SupportThread["priority"];
  message: string;
}) {
  const result = await apiRequest<{ supportThread: SupportThread }>("/support/threads", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return result.supportThread;
}

export async function getSupportMessages(threadId: string, admin = false, signal?: AbortSignal) {
  const prefix = admin ? "/admin/support" : "/support";
  return apiRequest<{ supportThread: SupportThread; messages: SupportMessage[] }>(
    `${prefix}/threads/${threadId}/messages`,
    { signal }
  );
}

export async function sendSupportMessage(threadId: string, body: string, admin = false) {
  const prefix = admin ? "/admin/support" : "/support";
  return apiRequest<{ supportThread: SupportThread; message: SupportMessage; autoResponse: SupportMessage | null }>(`${prefix}/threads/${threadId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export async function getAdminSupportThreads() {
  const result = await apiRequest<{ supportThreads: SupportThread[] }>("/admin/support/threads");
  return result.supportThreads;
}

export async function updateAdminSupportThreadStatus(threadId: string, status: SupportThread["status"]) {
  const result = await apiRequest<{ supportThread: SupportThread }>(`/admin/support/threads/${threadId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return result.supportThread;
}
