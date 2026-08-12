import type { Language } from "@/context/LanguageContext";
import type { ApiNotification } from "@/services/notifications";

export type NotificationCategory =
  | "order"
  | "quote"
  | "product-request"
  | "support"
  | "account";

export type NotificationTone = "success" | "destructive" | "warning" | "neutral";

type Translate = (
  key: string,
  options?: { fallback?: string; values?: Record<string, string | number> }
) => string;

export function getNotificationCategory(type: ApiNotification["type"]): NotificationCategory {
  if (type === "SUPPORT_MESSAGE") return "support";
  if (type === "ORDER_UPDATE") return "order";
  if (type === "QUOTE_UPDATE") return "quote";
  if (type === "ACCOUNT") return "account";
  return "product-request";
}

export function getNotificationTone(notification: ApiNotification): NotificationTone {
  const metadataStatus =
    typeof notification.metadata?.status === "string"
      ? notification.metadata.status.toUpperCase()
      : "";
  const copy = `${notification.title} ${notification.body}`.toLowerCase();

  if (
    metadataStatus === "REJECTED" ||
    metadataStatus === "CANCELED" ||
    metadataStatus === "CANCELLED" ||
    copy.includes("rejected") ||
    copy.includes("canceled") ||
    copy.includes("cancelled") ||
    copy.includes("not available")
  ) {
    return "destructive";
  }

  if (
    metadataStatus === "CONFIRMED" ||
    metadataStatus === "DELIVERED" ||
    metadataStatus === "VERIFIED" ||
    notification.type === "PRODUCT_AVAILABLE" ||
    copy.includes("confirmed") ||
    copy.includes("verified") ||
    copy.includes("approved") ||
    copy.includes("resolved") ||
    copy.includes("available") ||
    copy.includes("paid")
  ) {
    return "success";
  }

  if (
    metadataStatus === "PENDING" ||
    metadataStatus === "PENDING_REVIEW" ||
    copy.includes("pending") ||
    copy.includes("under review")
  ) {
    return "warning";
  }

  return "neutral";
}

export function formatNotificationRelativeTime(
  createdAt: string,
  language: Language,
  t: Translate,
  now = Date.now()
) {
  const timestamp = new Date(createdAt).getTime();
  if (!Number.isFinite(timestamp)) return "";

  const elapsedMs = Math.max(0, now - timestamp);
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return t("account.notifications.relative.justNow", { fallback: "Just now" });
  if (minutes === 1) {
    return t("account.notifications.relative.oneMinuteAgo", { fallback: "1 minute ago" });
  }
  if (minutes < 60) {
    return t("account.notifications.relative.minutesAgo", {
      fallback: "{count} minutes ago",
      values: { count: minutes },
    });
  }

  const hours = Math.floor(minutes / 60);
  if (hours === 1) return t("account.notifications.relative.oneHourAgo", { fallback: "1 hour ago" });
  if (hours < 24) {
    return t("account.notifications.relative.hoursAgo", {
      fallback: "{count} hours ago",
      values: { count: hours },
    });
  }
  if (hours < 48) return t("account.notifications.relative.yesterday", { fallback: "Yesterday" });

  return new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-EG", {
    day: "numeric",
    month: "short",
    year: new Date(createdAt).getFullYear() === new Date(now).getFullYear() ? undefined : "numeric",
  }).format(new Date(createdAt));
}
