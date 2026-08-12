import { Bell, CircleCheck, CircleX, Clock3, FileText, LifeBuoy, MessageSquareText, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNotificationCategory, getNotificationTone } from "@/lib/notificationPresentation";
import type { ApiNotification } from "@/services/notifications";

export function NotificationIconBadge({
  notification,
  compact = false,
}: {
  notification: ApiNotification;
  compact?: boolean;
}) {
  const tone = getNotificationTone(notification);
  const category = getNotificationCategory(notification.type);
  const Icon =
    tone === "destructive"
      ? CircleX
      : tone === "success"
        ? CircleCheck
        : tone === "warning"
          ? Clock3
          : category === "order"
            ? Package
            : category === "quote"
              ? FileText
              : category === "support"
                ? LifeBuoy
                : category === "product-request"
                  ? MessageSquareText
                  : Bell;

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border",
        compact ? "h-8 w-8" : "h-11 w-11",
        tone === "destructive" && "border-[#F2C8C8] bg-[#FFF3F3] text-[#B42318]",
        tone === "success" && "border-[#CFE8D6] bg-[#F4FBF5] text-[#16803C]",
        tone === "warning" && "border-[#F9DC5C]/70 bg-[#FFF9E8] text-[#9A6B12]",
        tone === "neutral" && "border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-text)]"
      )}
      aria-hidden="true"
    >
      <Icon size={compact ? 14 : 17} strokeWidth={2} />
    </span>
  );
}
