import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Bell,
  FileText,
  Heart,
  Package,
  LifeBuoy,
} from "lucide-react";
import { Container } from "@/components/dental/Container";
import { AccountSidebar } from "@/components/dental/AccountSidebar";
import { Button } from "@/components/dental/Button";
import { useLanguage } from "@/context/LanguageContext";
import { accountT, accountValue } from "@/lib/accountI18n";
import { cn } from "@/lib/utils";
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type ApiNotification,
} from "@/services/notifications";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  tag?: string;
  tagLabel?: string;
  timeAgo: string;
  type: "order" | "quote" | "product-request" | "wishlist" | "offers" | "support" | "account";
  isRead: boolean;
  targetUrl?: string;
};

type NotificationFilter =
  | "all"
  | "unread"
  | "order"
  | "quote"
  | "product-request"
  | "offers"
  | "support"
  | "account";

// Development fixture retained for visual reference only; live account data always comes from the API.
const developmentNotificationFixtures: NotificationItem[] = [
  {
    id: "n-1",
    title: "Order #ORD-2023-1102 is processing",
    message: "Your order has been confirmed and is now being prepared for delivery.",
    tag: "Order",
    tagLabel: "Order",
    timeAgo: "2 hours ago",
    type: "order",
    isRead: false,
    targetUrl: "/account/orders/ord-3",
  },
  {
    id: "n-2",
    title: "Quote #XQ-2038 has been approved",
    message: "Your quote is ready to review and will expire on 30 July 2025.",
    tag: "Quote",
    tagLabel: "Quote",
    timeAgo: "1 day ago",
    type: "quote",
    isRead: false,
    targetUrl: "/account/quotes/xq-2038",
  },
  {
    id: "n-3",
    title: "We're checking supplier availability",
    message: "Our team is checking availability for M3-Pro Gold Rotary Files Double.",
    tag: "Product Request",
    tagLabel: "Product Request",
    timeAgo: "2 days ago",
    type: "product-request",
    isRead: false,
    targetUrl: "/account/product-requests/request-1024",
  },
  {
    id: "n-4",
    title: "Sterilization Pouches are back in stock",
    message: "Sterilization Pouches 200 pcs are available again and ready to order.",
    tag: "Wishlist",
    tagLabel: "Wishlist",
    timeAgo: "3 days ago",
    type: "wishlist",
    isRead: true,
    targetUrl: "/products",
  },
  {
    id: "n-5",
    title: "Order #ORD-2023-1042 was delivered",
    message: "Your order has been delivered successfully. You can view details or reorder items from your account.",
    tag: "Order",
    tagLabel: "Order",
    timeAgo: "5 days ago",
    type: "order",
    isRead: true,
    targetUrl: "/account/orders/ord-1",
  },
  {
    id: "n-6",
    title: "Quote #XQ-2018 has expired",
    message: "This quote has expired. You can request a new quote using the same products.",
    tag: "Quote",
    tagLabel: "Quote",
    timeAgo: "1 week ago",
    type: "quote",
    isRead: true,
    targetUrl: "/account/quotes/xq-2018",
  },
  {
    id: "n-7",
    title: "New weekly offers are available",
    message: "Explore selected dental supplies with updated weekly pricing and limited-time offers.",
    tag: "Offers",
    tagLabel: "Offers",
    timeAgo: "1 week ago",
    type: "offers",
    isRead: true,
    targetUrl: "/products?isWeeklyOffer=true",
  },
  {
    id: "n-8",
    title: "Support replied to your ticket",
    message: "Our team replied to your delivery question. Open the ticket to continue the conversation.",
    tag: "Support",
    tagLabel: "Support",
    timeAgo: "2 weeks ago",
    type: "support",
    isRead: true,
    targetUrl: "/account/support",
  },
  {
    id: "n-9",
    title: "Your password was changed",
    message: "Your account password was changed successfully. If this wasn't you, contact support immediately.",
    tag: "Account",
    tagLabel: "Account",
    timeAgo: "3 weeks ago",
    type: "account",
    isRead: true,
    targetUrl: "/account/settings",
  },
];
void developmentNotificationFixtures;

const notificationFilters: { value: NotificationFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "order", label: "Orders" },
  { value: "quote", label: "Quotes" },
  { value: "product-request", label: "Product Requests" },
  { value: "offers", label: "Offers" },
  { value: "support", label: "Support" },
  { value: "account", label: "Account" },
];

function relativeTime(date: string) {
  const elapsed = Math.max(0, Date.now() - new Date(date).getTime());
  const hours = Math.floor(elapsed / 3_600_000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function toNotificationItem(item: ApiNotification): NotificationItem {
  const type: NotificationItem["type"] =
    item.type === "SUPPORT_MESSAGE" ? "support"
      : item.type === "ORDER_UPDATE" ? "order"
      : item.type === "QUOTE_UPDATE" ? "quote"
      : item.type === "ACCOUNT" ? "account"
      : "product-request";
  const tagLabel = type === "product-request" ? "Product Request" : type === "support" ? "Support" : type[0].toUpperCase() + type.slice(1);
  return {
    id: item.id,
    title: item.title,
    message: item.body,
    tagLabel,
    timeAgo: relativeTime(item.createdAt),
    type,
    isRead: Boolean(item.readAt),
    targetUrl: item.link ?? undefined,
  };
}

function EmptyState() {
  const { t } = useLanguage();

  return (
    <section className="rounded-[24px] border border-[var(--xd-gold-active)]/[0.14] bg-white/80 p-10 text-center shadow-[0_12px_34px_rgba(5,5,5,0.04)] backdrop-blur">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-active)]">
        <Bell size={24} />
      </span>
      <h2 className="mt-4 text-[18px] font-bold text-[#050505]">{accountT(t, "notifications.emptyTitle", "You're all caught up")}</h2>
      <p className="mx-auto mt-2 max-w-[420px] text-[14px] leading-6 text-[#8A8D9A]">
        {accountT(t, "notifications.emptyDescription", "New account updates will appear here.")}
      </p>
    </section>
  );
}

function NotificationCard({ item, onOpen }: { item: NotificationItem; onOpen: () => void }) {
  const { t } = useLanguage();
  const Icon =
    item.type === "order"
      ? Package
      : item.type === "quote"
      ? FileText
      : item.type === "wishlist"
      ? Heart
      : item.type === "support"
      ? LifeBuoy
      : Bell;
  const cardClassName = cn(
    "block rounded-[24px] border p-[22px] shadow-[0_12px_34px_rgba(5,5,5,0.04)] transition-all",
    item.targetUrl && "cursor-pointer hover:-translate-y-0.5 hover:border-[var(--xd-gold-border-hover)] hover:bg-white",
    item.isRead
      ? "border-[var(--xd-gold-border-soft)] bg-white/80"
      : "border-[var(--xd-gold-active)]/[0.32] bg-[var(--xd-gold-active)]/[0.04]"
  );

  const content = (
    <div className="flex items-start gap-4">
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--xd-gold-text)]",
          item.isRead ? "bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-text)]" : "bg-[var(--xd-gold)]/16 text-[var(--xd-gold-active)]"
        )}
      >
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {!item.isRead && (
            <span className="h-2 w-2 rounded-full bg-[var(--xd-gold)]" aria-label={accountT(t, "notifications.unreadNotification", "Unread notification")} />
          )}
          <h3 className="text-[16px] font-bold text-[#050505]">{accountValue(t, item.title)}</h3>
        </div>
        <p className="mt-1.5 text-[14px] leading-6 text-[#8A8D9A]">{accountValue(t, item.message)}</p>
        <div className="mt-2.5 flex items-center gap-3 text-[13px]">
          <span className="inline-flex rounded-full bg-[#050505]/[0.04] px-3 py-1 text-[#717182]">
            {item.tagLabel ? accountValue(t, item.tagLabel) : null}
          </span>
          <span className="text-[#8A8D9A]">{accountValue(t, item.timeAgo)}</span>
        </div>
      </div>
    </div>
  );

  if (item.targetUrl) {
    return (
      <button type="button" onClick={onOpen} className={cn(cardClassName, "w-full text-start")}>
        {content}
      </button>
    );
  }

  return (
    <section className={cardClassName}>
      {content}
    </section>
  );
}

export default function AccountNotifications() {
  const [, navigate] = useLocation();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const unreadCount = notifications.filter((item) => !item.isRead).length;
  const hasUnread = unreadCount > 0;

  useEffect(() => {
    let active = true;
    getMyNotifications()
      .then((items) => {
        if (active) setNotifications(items.map(toNotificationItem));
      })
      .catch(() => {
        if (active) setStatusMessage(accountT(t, "notifications.loadFailed", "Failed to load notifications."));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);
  const filteredNotifications = useMemo(() => {
    if (activeFilter === "all") return notifications;
    if (activeFilter === "unread") return notifications.filter((item) => !item.isRead);
    return notifications.filter((item) => item.type === activeFilter);
  }, [activeFilter, notifications]);

  const handleMarkAllAsRead = async () => {
    if (!hasUnread) return;
    try {
      await markAllNotificationsRead();
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
      setStatusMessage(accountT(t, "notifications.markedAllRead", "All notifications marked as read."));
    } catch {
      setStatusMessage(accountT(t, "notifications.updateFailed", "Failed to update notifications."));
    }
  };

  const handleOpenNotification = async (item: NotificationItem) => {
    try {
      if (!item.isRead) await markNotificationRead(item.id);
      setNotifications((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, isRead: true } : candidate));
      if (item.targetUrl) navigate(item.targetUrl);
    } catch {
      setStatusMessage(accountT(t, "notifications.updateFailed", "Failed to update notification."));
    }
  };

  return (
    <div className="bg-[var(--xd-bg)] pb-14 pt-10 lg:pb-20 lg:pt-14">
      <Container className="overflow-x-clip">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:gap-7">
          <AccountSidebar />

          <main className="min-w-0 space-y-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--xd-gold-active)]">{accountT(t, "notifications.eyebrow", "Account Updates")}</p>
                <h1 className="font-display text-[36px] font-bold leading-none text-[#050505] sm:text-[44px]">{accountT(t, "notifications.title", "Notifications")}</h1>
                <p className="mt-4 max-w-[720px] text-[15px] leading-6 text-[#8A8D9A]">{accountT(t, "notifications.description", "Stay updated on orders, quotes, product requests, back-in-stock alerts, and account activity.")}</p>
              </div>

              <div className="flex items-start gap-3">
                <Button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  disabled={!hasUnread}
                  variant="tertiary"
                  size="sm"
                  className="h-10 px-3 text-[#717182] hover:bg-transparent hover:text-[#050505] disabled:opacity-45"
                >
                  {hasUnread
                    ? accountT(t, "notifications.markAllAsReadCount", "Mark All as Read ({count})", { count: unreadCount })
                    : accountT(t, "notifications.allRead", "All Read")}
                </Button>
                <Button asChild variant="primary" size="sm" className="h-10 px-5">
                  <Link href="/account/settings">{accountT(t, "settings.title", "Settings")}</Link>
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {notificationFilters.map((filter) => {
                const isActive = activeFilter === filter.value;

                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setActiveFilter(filter.value)}
                    className={cn(
                      "inline-flex h-10 items-center rounded-full border px-4 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]",
                      isActive
                        ? "border-[var(--xd-gold-active)] bg-[var(--xd-gold-active)] text-white shadow-[0_8px_20px_rgba(212,167,44,0.18)]"
                        : "border-[var(--xd-gold-border-soft)] bg-white/70 text-[var(--xd-gold-text)] hover:border-[var(--xd-gold-border)] hover:bg-[var(--xd-gold-active)]/[0.08] hover:text-[#050505]"
                    )}
                  >
                    {accountValue(t, filter.label)}
                  </button>
                );
              })}
            </div>

            {statusMessage && (
              <div
                role="status"
                className="rounded-[14px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] px-4 py-3 text-[13px] font-semibold text-[#5F5F5F]"
              >
                {statusMessage}
              </div>
            )}

            <div className="space-y-4">
              {isLoading ? (
                <div role="status" className="rounded-[20px] border border-[var(--xd-gold-border-soft)] bg-white/70 p-8 text-center text-[13px] font-semibold text-[#717182]">
                  {accountT(t, "common.loading", "Loading...")}
                </div>
              ) : filteredNotifications.length > 0 ? (
                filteredNotifications.map((item) => (
                  <NotificationCard
                    key={item.id}
                    item={item}
                    onOpen={() => handleOpenNotification(item)}
                  />
                ))
              ) : (
                <EmptyState />
              )}
            </div>
          </main>
        </div>
      </Container>
    </div>
  );
}
