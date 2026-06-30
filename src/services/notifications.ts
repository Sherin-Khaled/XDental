import { apiRequest } from "./http";

export type ApiNotification = {
  id: string;
  type: "PRODUCT_REQUEST" | "SUPPORT_MESSAGE" | "PRODUCT_AVAILABLE" | "ORDER_UPDATE" | "QUOTE_UPDATE" | "ACCOUNT";
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export async function getMyNotifications() {
  const result = await apiRequest<{ notifications: ApiNotification[] }>("/notifications/my");
  return result.notifications;
}

export async function markNotificationRead(id: string) {
  return apiRequest<{ notification: ApiNotification }>(`/notifications/${id}/read`, { method: "PATCH" });
}

export async function markAllNotificationsRead() {
  return apiRequest<{ updatedCount: number; readAt: string }>("/notifications/read-all", { method: "PATCH" });
}
