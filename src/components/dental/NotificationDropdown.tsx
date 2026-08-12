import { useMemo, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Link, useLocation } from "wouter";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { NotificationIconBadge } from "@/components/dental/NotificationIconBadge";
import {
  NAVBAR_ICON_SIZE,
  NAVBAR_ICON_STROKE_WIDTH,
  NavbarCountBadge,
  navbarIconControlClassName,
} from "@/components/dental/NavbarIconControl";
import { useLanguage } from "@/context/LanguageContext";
import { useNotifications } from "@/context/NotificationContext";
import { useClickOutside } from "@/hooks/use-click-outside";
import { accountValue } from "@/lib/accountI18n";
import { formatNotificationRelativeTime } from "@/lib/notificationPresentation";
import { ACCOUNT_REQUESTS_REFRESH_EVENT } from "@/lib/accountRequestWorkflow";
import { cn } from "@/lib/utils";
import type { ApiNotification } from "@/services/notifications";

export function NotificationDropdown({
  actionClassName,
  viewAllHref = "/account/notifications",
  viewAllLabel,
}: {
  actionClassName?: string;
  viewAllHref?: string;
  viewAllLabel?: string;
}) {
  const { t, language } = useLanguage();
  const {
    notifications,
    unreadCount,
    isLoading,
    hasLoadError,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const latestNotifications = useMemo(() => notifications.slice(0, 5), [notifications]);

  useClickOutside(panelRef, () => setOpen(false), { enabled: open });

  const toggleOpen = () => {
    setOpen((current) => {
      const next = !current;
      if (next) void refreshNotifications();
      return next;
    });
  };

  const openNotification = (notification: ApiNotification) => {
    if (!notification.readAt) void markAsRead(notification.id);
    setOpen(false);
    if (notification.link) {
      if (notification.link.startsWith("/admin/account-requests")) {
        window.dispatchEvent(new Event(ACCOUNT_REQUESTS_REFRESH_EVENT));
      }
      navigate(notification.link);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={toggleOpen}
        className={cn(navbarIconControlClassName, actionClassName)}
        aria-label={t("account.notifications.title", { fallback: "Notifications" })}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="button-notifications"
      >
        <Bell size={NAVBAR_ICON_SIZE} strokeWidth={NAVBAR_ICON_STROKE_WIDTH} className="xd-premium-icon" />
        <NavbarCountBadge count={unreadCount} max={99} tone="alert" />
      </button>

      {open && (
        <section
          role="dialog"
          aria-label={t("account.notifications.latest", { fallback: "Latest notifications" })}
          className="absolute end-0 top-[calc(100%+12px)] z-[80] w-[min(390px,calc(100vw-32px))] overflow-hidden rounded-[22px] border border-[var(--xd-gold-border-soft)] bg-white/95 shadow-[0_24px_70px_rgba(5,5,5,0.18)] backdrop-blur-xl dark:bg-[#171714]/95"
        >
          <header className="flex items-center justify-between gap-3 border-b border-[#050505]/[0.07] px-5 py-4 dark:border-white/[0.08]">
            <div>
              <h2 className="text-[15px] font-bold text-[#050505] dark:text-[#F5F1E7]">
                {t("account.notifications.title", { fallback: "Notifications" })}
              </h2>
              <p className="mt-0.5 text-[11px] font-semibold text-[#8A8D9A] dark:text-[#B8B2A5]">
                {unreadCount > 0
                  ? t("account.notifications.unreadCount", {
                      fallback: "{count} unread",
                      values: { count: unreadCount },
                    })
                  : t("account.notifications.allRead", { fallback: "All Read" })}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllAsRead()}
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-bold text-[var(--xd-gold-text)] transition hover:bg-[var(--xd-gold-bg-soft)]"
              >
                <CheckCheck size={14} />
                {t("account.notifications.markAsRead", { fallback: "Mark as read" })}
              </button>
            )}
          </header>

          <div
            className="notification-dropdown-scrollbar max-h-[430px] overflow-y-auto [scrollbar-gutter:stable]"
            data-testid="notification-scroll-region"
          >
            {isLoading && notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] font-semibold text-[#717182] dark:text-[#B8B2A5]">
                {t("common.loading", { fallback: "Loading..." })}
              </p>
            ) : hasLoadError && notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] font-semibold text-[#B42318]">
                {t("account.notifications.loadFailed", { fallback: "Failed to load notifications." })}
              </p>
            ) : latestNotifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] font-semibold text-[#717182] dark:text-[#B8B2A5]">
                {t("account.notifications.noNotifications", { fallback: "No notifications yet." })}
              </p>
            ) : (
              <div className="divide-y divide-[#050505]/[0.07] dark:divide-white/[0.08]" data-testid="notification-row-list">
                {latestNotifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => openNotification(notification)}
                    className="notification-dropdown-row flex w-full items-start gap-2.5 bg-transparent px-4 py-2.5 text-start transition-colors hover:bg-[#050505]/[0.035] focus-visible:bg-[#050505]/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--xd-gold-focus-ring)] dark:hover:bg-white/[0.045] dark:focus-visible:bg-white/[0.045]"
                    data-read={notification.readAt ? "true" : "false"}
                  >
                    <NotificationIconBadge notification={notification} compact />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start gap-2">
                        <span
                          className={cn(
                            "line-clamp-1 flex-1 text-[13px] text-[#050505] dark:text-[#F5F1E7]",
                            notification.readAt ? "font-semibold" : "font-bold"
                          )}
                        >
                          {accountValue(t, notification.title)}
                        </span>
                        {!notification.readAt && (
                          <span
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--xd-gold-active)]"
                            data-testid="notification-unread-dot"
                          />
                        )}
                      </span>
                      <span className="mt-0.5 line-clamp-2 text-[12px] leading-[18px] text-[#717182] dark:text-[#C7C1B4]">
                        {accountValue(t, notification.body)}
                      </span>
                      <span className="mt-1 block text-[10px] font-semibold text-[#9A9CA6] dark:text-[#999487]">
                        {formatNotificationRelativeTime(notification.createdAt, language, t)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <footer className="border-t border-[#050505]/[0.07] p-3 dark:border-white/[0.08]">
            <Link
              href={viewAllHref}
              onClick={() => setOpen(false)}
              className="flex h-10 items-center justify-center gap-2 rounded-[12px] text-[13px] font-bold text-[var(--xd-gold-text)] transition hover:bg-[var(--xd-gold-bg-soft)]"
            >
              {viewAllLabel ?? t("account.notifications.viewAll", { fallback: "View all notifications" })}
              <DirectionalIcon direction="forward" family="chevron" size={15} />
            </Link>
          </footer>
        </section>
      )}
    </div>
  );
}
