import { useEffect, useState } from "react";
import { Archive, ArchiveRestore, Mail, Phone, RefreshCw, Save, Search } from "lucide-react";
import { AdminStatusBadge } from "./admin-ui";
import { useLanguage } from "@/context/LanguageContext";
import {
  getAdminContactMessages,
  updateAdminContactMessage,
  updateAdminContactMessageStatus,
  type AdminContactMessage,
  type ContactMessageStatus,
} from "@/services/contact";
import {
  retryAdminEmailDelivery,
  type EmailDeliveryStatus,
} from "@/services/emailDeliveries";

const STATUS_TONES: Record<ContactMessageStatus, "amber" | "blue" | "green"> = {
  NEW: "amber",
  REVIEWED: "blue",
  RESOLVED: "green",
};
const EMAIL_STATUS_TONES: Record<EmailDeliveryStatus, "slate" | "amber" | "green" | "red"> = {
  DISABLED: "slate",
  PENDING: "amber",
  SENT: "green",
  FAILED: "red",
};

/**
 * Contact-page messages (guests included) for the admin/support inbox.
 * Data comes from the ContactMessage table via /api/admin/contact-messages.
 */
export function ContactMessagesPanel() {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<AdminContactMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    getAdminContactMessages({ includeArchived: true })
      .then((items) => {
        if (!active) return;
        setMessages(items);
        setNoteDrafts(Object.fromEntries(items.map((item) => [item.id, item.internalNotes])));
      })
      .catch(() => active && setError(t("admin.contactMessages.loadError", { fallback: "Failed to load contact messages." })))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [refreshVersion, t]);

  const setStatus = async (id: string, status: ContactMessageStatus) => {
    try {
      const updated = await updateAdminContactMessageStatus(id, status);
      setMessages((current) => current.map((item) => (item.id === id ? updated : item)));
    } catch {
      setError(t("admin.contactMessages.updateError", { fallback: "The message status could not be updated." }));
    }
  };

  const retryEmail = async (messageId: string, deliveryId: string) => {
    setError(null);
    try {
      const emailDelivery = await retryAdminEmailDelivery(deliveryId);
      setMessages((current) =>
        current.map((item) => (item.id === messageId ? { ...item, emailDelivery } : item))
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The email notification could not be retried."
      );
    }
  };

  const updateWorkflow = async (
    messageId: string,
    input: { internalNotes?: string; archived?: boolean }
  ) => {
    setError(null);
    setSavingId(messageId);
    try {
      const updated = await updateAdminContactMessage(messageId, input);
      setMessages((current) => current.map((item) => (item.id === messageId ? updated : item)));
      setNoteDrafts((current) => ({ ...current, [messageId]: updated.internalNotes }));
    } catch {
      setError("The contact-message workflow could not be updated.");
    } finally {
      setSavingId(null);
    }
  };

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleMessages = messages.filter((message) => {
    if (!showArchived && message.archivedAt) return false;
    if (!normalizedSearch) return true;
    return [
      message.name,
      message.email,
      message.phone,
      message.subject,
      message.message,
      message.internalNotes,
    ].some((value) => value?.toLocaleLowerCase().includes(normalizedSearch));
  });

  return (
    <section className="rounded-lg border border-[#EFE2BC] bg-white shadow-sm dark:border-white/10 dark:bg-[#111827]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFE2BC] px-5 py-4 dark:border-white/10">
        <div>
          <h2 className="text-base font-bold text-[#050505] dark:text-white">
            {t("admin.contactMessages.title", { fallback: "Contact Messages" })}
          </h2>
          <p className="mt-0.5 text-xs text-[#717182] dark:text-slate-400">
            {t("admin.contactMessages.description", { fallback: "Messages from the public contact form, including guests." })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshVersion((value) => value + 1)}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#EFE2BC] px-3 text-xs font-semibold text-[#717182] hover:bg-[#FFF9E8] dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/5"
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          {t("admin.categories.refresh", { fallback: "Refresh" })}
        </button>
      </div>

      {error && <p role="alert" className="mx-5 mt-4 rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] p-3 text-sm font-semibold text-[#B42318]">{error}</p>}

      <div className="flex flex-wrap items-center gap-3 border-b border-[#EFE2BC] px-5 py-3 dark:border-white/10">
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Search contact messages</span>
          <Search size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[#8A8D9A]" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search messages"
            className="h-9 w-full rounded-lg border border-[#EFE2BC] bg-white ps-9 pe-3 text-sm text-[#050505] outline-none focus:border-[#D4A72C] focus:ring-2 focus:ring-[#D4A72C]/20 dark:border-white/15 dark:bg-white/5 dark:text-white"
          />
        </label>
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#717182] dark:text-slate-300">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
            className="h-4 w-4 rounded border-[#D9C990] text-[#A57B13] focus:ring-[#D4A72C]"
          />
          Show archived
        </label>
      </div>

      <div className="divide-y divide-[#F3E8C8] dark:divide-white/10">
        {visibleMessages.map((message) => (
          <article key={message.id} className="px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-[#050505] dark:text-white">{message.name}</p>
              <AdminStatusBadge tone={STATUS_TONES[message.status]}>{message.status}</AdminStatusBadge>
              {message.emailDelivery && (
                <AdminStatusBadge tone={EMAIL_STATUS_TONES[message.emailDelivery.status]}>
                  EMAIL {message.emailDelivery.status}
                </AdminStatusBadge>
              )}
              <span className="text-xs text-[#8A8D9A]">{new Date(message.createdAt).toLocaleString()}</span>
              <span className="rounded-full bg-[#FFF9E8] px-2 py-0.5 text-[11px] font-semibold text-[#8A6A1F]">{message.source}</span>
              {message.user && (
                <span className="text-[11px] font-semibold text-[#717182]">
                  {t("admin.contactMessages.registeredCustomer", { fallback: "Registered customer" })}
                </span>
              )}
              {message.archivedAt && <AdminStatusBadge tone="slate">ARCHIVED</AdminStatusBadge>}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#717182] dark:text-slate-400">
              {message.email && <span className="inline-flex items-center gap-1"><Mail size={12} /><span dir="ltr">{message.email}</span></span>}
              {message.phone && <span className="inline-flex items-center gap-1"><Phone size={12} /><span dir="ltr">{message.phone}</span></span>}
              {message.subject && <span className="font-semibold">{message.subject}</span>}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#3A3A3A] dark:text-slate-200">{message.message}</p>
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-semibold text-[#717182] dark:text-slate-400">Internal notes</span>
              <textarea
                value={noteDrafts[message.id] ?? ""}
                onChange={(event) =>
                  setNoteDrafts((current) => ({ ...current, [message.id]: event.target.value }))
                }
                rows={2}
                maxLength={5000}
                className="w-full rounded-lg border border-[#EFE2BC] bg-[#FFFCF4] px-3 py-2 text-sm text-[#3A3A3A] outline-none focus:border-[#D4A72C] focus:ring-2 focus:ring-[#D4A72C]/20 dark:border-white/15 dark:bg-white/5 dark:text-slate-200"
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              {message.status !== "REVIEWED" && (
                <button type="button" onClick={() => void setStatus(message.id, "REVIEWED")} className="h-8 rounded-md border border-[#050505]/10 bg-white px-3 text-xs font-semibold hover:border-[#D4A72C]/60 hover:bg-[#FFF7D6]">
                  {t("admin.contactMessages.markReviewed", { fallback: "Mark Reviewed" })}
                </button>
              )}
              {message.status !== "RESOLVED" && (
                <button type="button" onClick={() => void setStatus(message.id, "RESOLVED")} className="h-8 rounded-md border border-[#ABEFC6] bg-white px-3 text-xs font-semibold text-[#067647] hover:bg-[#ECFDF3]">
                  {t("admin.contactMessages.markResolved", { fallback: "Mark Resolved" })}
                </button>
              )}
              {message.emailDelivery && message.emailDelivery.status !== "SENT" && (
                <button
                  type="button"
                  onClick={() => void retryEmail(message.id, message.emailDelivery!.id)}
                  className="h-8 rounded-md border border-[#EFE2BC] bg-white px-3 text-xs font-semibold text-[#8A6A1F] hover:bg-[#FFF9E8] dark:border-white/15 dark:bg-white/5 dark:text-[#F6D85D]"
                >
                  Retry email
                </button>
              )}
              <button
                type="button"
                disabled={savingId === message.id || (noteDrafts[message.id] ?? "") === message.internalNotes}
                onClick={() => void updateWorkflow(message.id, { internalNotes: noteDrafts[message.id] ?? "" })}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#EFE2BC] bg-white px-3 text-xs font-semibold text-[#8A6A1F] hover:bg-[#FFF9E8] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:text-[#F6D85D]"
              >
                <Save size={13} />
                Save notes
              </button>
              <button
                type="button"
                disabled={savingId === message.id}
                onClick={() => void updateWorkflow(message.id, { archived: !message.archivedAt })}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#D0D5DD] bg-white px-3 text-xs font-semibold text-[#475467] hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-300"
              >
                {message.archivedAt ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                {message.archivedAt ? "Restore" : "Archive"}
              </button>
            </div>
          </article>
        ))}
        {isLoading && messages.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-[#717182]">{t("admin.categories.loading", { fallback: "Loading..." })}</p>
        )}
        {!isLoading && !error && visibleMessages.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-[#717182]">
            {t("admin.contactMessages.empty", { fallback: "No contact messages yet." })}
          </p>
        )}
      </div>
    </section>
  );
}
