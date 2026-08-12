import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link } from "wouter";
import { ToastAction } from "@/components/ui/toast";
import { useLanguage } from "@/context/LanguageContext";
import { useStore } from "@/context/StoreContext";
import { toast } from "@/hooks/use-toast";
import { accountValue } from "@/lib/accountI18n";
import { ACCOUNT_REQUESTS_REFRESH_EVENT } from "@/lib/accountRequestWorkflow";
import { getNotificationTone } from "@/lib/notificationPresentation";
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type ApiNotification,
} from "@/services/notifications";

const POLL_INTERVAL_MS = 45_000;

type NotificationContextValue = {
  notifications: ApiNotification[];
  unreadCount: number;
  isLoading: boolean;
  hasLoadError: boolean;
  refreshNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

function toastClassName(notification: ApiNotification) {
  const tone = getNotificationTone(notification);
  if (tone === "destructive") return "border-[#F2C8C8] bg-[#FFF3F3] text-[#7A271A]";
  if (tone === "success") return "border-[#CFE8D6] bg-[#F4FBF5] text-[#14532D]";
  if (tone === "warning") return "border-[#F9DC5C]/70 bg-[#FFF9E8] text-[#6B4E0B]";
  return "border-[var(--xd-gold-border-soft)] bg-white text-[#050505]";
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { currentUser, isAuthenticated, isAuthLoading } = useStore();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  const activeUserIdRef = useRef<string | null>(null);
  const fetchingUserIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const userId = isAuthenticated && !isAuthLoading ? currentUser?.id ?? null : null;

  const markAsRead = useCallback(async (id: string) => {
    const updated = await markNotificationRead(id);
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, readAt: updated.notification.readAt } : item))
    );
  }, []);

  const markAllAsRead = useCallback(async () => {
    const result = await markAllNotificationsRead();
    setNotifications((current) => current.map((item) => ({ ...item, readAt: result.readAt })));
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!userId || fetchingUserIdRef.current === userId) return;
    fetchingUserIdRef.current = userId;

    try {
      const items = await getMyNotifications();
      if (activeUserIdRef.current !== userId) return;

      if (!initializedRef.current) {
        seenIdsRef.current = new Set(items.map((item) => item.id));
        initializedRef.current = true;
      } else {
        const newUnread = items.filter((item) => !item.readAt && !seenIdsRef.current.has(item.id));
        items.forEach((item) => seenIdsRef.current.add(item.id));

        const newest = newUnread[0];
        if (newest) {
          toast({
            title: accountValue(t, newest.title),
            description: accountValue(t, newest.body),
            className: toastClassName(newest),
            action: newest.link ? (
              <ToastAction altText={t("account.notifications.open", { fallback: "Open notification" })} asChild>
                <Link
                  href={newest.link}
                  onClick={() => {
                    if (newest.link?.startsWith("/admin/account-requests")) {
                      window.dispatchEvent(
                        new Event(ACCOUNT_REQUESTS_REFRESH_EVENT)
                      );
                    }
                    void markAsRead(newest.id);
                  }}
                >
                  {t("account.notifications.open", { fallback: "Open" })}
                </Link>
              </ToastAction>
            ) : undefined,
          });
        }
      }

      setNotifications(items);
      setHasLoadError(false);
    } catch {
      if (activeUserIdRef.current === userId) setHasLoadError(true);
    } finally {
      if (fetchingUserIdRef.current === userId) fetchingUserIdRef.current = null;
      if (activeUserIdRef.current === userId) setIsLoading(false);
    }
  }, [markAsRead, t, userId]);

  useEffect(() => {
    activeUserIdRef.current = userId;
    fetchingUserIdRef.current = null;
    initializedRef.current = false;
    seenIdsRef.current = new Set();
    setNotifications([]);
    setHasLoadError(false);
    setIsLoading(Boolean(userId));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    void refreshNotifications();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshNotifications();
    }, POLL_INTERVAL_MS);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshNotifications();
    };

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshNotifications, userId]);

  const unreadCount = useMemo(
    () => notifications.reduce((count, item) => count + (item.readAt ? 0 : 1), 0),
    [notifications]
  );

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      unreadCount,
      isLoading,
      hasLoadError,
      refreshNotifications,
      markAsRead,
      markAllAsRead,
    }),
    [hasLoadError, isLoading, markAllAsRead, markAsRead, notifications, refreshNotifications, unreadCount]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used within NotificationProvider.");
  return context;
}
