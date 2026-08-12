import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { LifeBuoy, MessageCircle, Plus, RefreshCw, Send, X } from "lucide-react";
import { Button } from "@/components/dental/Button";
import { DentalSelect } from "@/components/dental/Select";
import { useLanguage } from "@/context/LanguageContext";
import { useStore } from "@/context/StoreContext";
import { cn } from "@/lib/utils";
import { presentSupportMessageBody } from "@/lib/supportMessagePresentation";
import {
  createSupportThread,
  getMySupportThreads,
  getSupportMessages,
  sendSupportMessage,
  type SupportMessage,
  type SupportThread,
} from "@/services/support";

function isStaffRole(role?: string) {
  const normalizedRole = role?.trim().toLowerCase();
  return normalizedRole === "admin" || normalizedRole === "support";
}

export function FloatingSupportChat() {
  const { currentUser, isAuthenticated, isAuthLoading } = useStore();
  const { language, t } = useLanguage();
  const [location, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isNewConversation, setIsNewConversation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? null,
    [selectedThreadId, threads]
  );

  const loadMessages = async (threadId: string) => {
    const result = await getSupportMessages(threadId);
    setMessages(result.messages);
    return result.supportThread;
  };

  const loadThreads = async (preferredThreadId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const nextThreads = await getMySupportThreads();
      setThreads(nextThreads);

      const targetThreadId =
        preferredThreadId && nextThreads.some((thread) => thread.id === preferredThreadId)
          ? preferredThreadId
          : selectedThreadId && nextThreads.some((thread) => thread.id === selectedThreadId)
            ? selectedThreadId
            : nextThreads[0]?.id ?? null;

      setSelectedThreadId(targetThreadId);
      setIsNewConversation(nextThreads.length === 0);

      if (targetThreadId) {
        await loadMessages(targetThreadId);
      } else {
        setMessages([]);
      }
    } catch {
      setError(t("floatingSupport.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !isAuthenticated) return;
    void loadThreads();
    // Opening the panel is the refresh boundary; thread changes are handled explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isOpen]);

  useEffect(() => {
    setIsOpen(false);
  }, [location]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const handleLauncherClick = () => {
    if (isAuthLoading) return;
    if (!isAuthenticated) {
      navigate("/signin?redirect=/account/support");
      return;
    }
    setIsOpen((current) => !current);
  };

  const handleThreadChange = async (threadId: string) => {
    setSelectedThreadId(threadId);
    setIsNewConversation(false);
    setIsLoading(true);
    setError(null);
    try {
      await loadMessages(threadId);
    } catch {
      setError(t("floatingSupport.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message) {
      setError(t("floatingSupport.messageRequired"));
      return;
    }

    setIsSending(true);
    setError(null);
    try {
      if (isNewConversation || !selectedThreadId) {
        const createdThread = await createSupportThread({
          subject: t("floatingSupport.generalSubject"),
          type: "GENERAL_SUPPORT",
          priority: "Normal",
          message,
        });
        setDraft("");
        setIsNewConversation(false);
        await loadThreads(createdThread.id);
      } else {
        await sendSupportMessage(selectedThreadId, message);
        setDraft("");
        const updatedThread = await loadMessages(selectedThreadId);
        setThreads((current) =>
          current.map((thread) => (thread.id === updatedThread.id ? updatedThread : thread))
        );
      }
    } catch {
      setError(t("floatingSupport.sendFailed"));
    } finally {
      setIsSending(false);
    }
  };

  if (isAuthLoading || (isAuthenticated && isStaffRole(currentUser?.role))) return null;

  return (
    <div className="fixed bottom-4 end-4 z-[70] sm:bottom-6 sm:end-6">
      {isOpen && (
        <section
          role="dialog"
          aria-modal="false"
          aria-label={t("floatingSupport.title")}
          className="absolute bottom-[68px] end-0 flex h-[min(560px,calc(100vh-120px))] w-[min(390px,calc(100vw-32px))] flex-col overflow-hidden rounded-[24px] border border-[var(--xd-gold-border-soft)] bg-white shadow-[0_24px_70px_rgba(5,5,5,0.2)]"
        >
          <header className="flex items-center justify-between gap-3 border-b border-[#050505]/[0.07] bg-[var(--xd-gold-bg-soft)] px-4 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="xd-gradient-gold flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#050505]">
                <LifeBuoy size={18} />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-[14px] font-bold text-[#050505]">{t("floatingSupport.title")}</h2>
                <p className="truncate text-[11px] text-[#717182]">{t("floatingSupport.subtitle")}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#717182] hover:bg-black/[0.05] hover:text-[#050505]"
              aria-label={t("common.close", { fallback: "Close" })}
            >
              <X size={17} />
            </button>
          </header>

          <div className="border-b border-[#050505]/[0.07] px-4 py-3">
            <div className="flex items-center gap-2">
              {threads.length > 0 && !isNewConversation ? (
                <DentalSelect
                  label={t("floatingSupport.selectConversation")}
                  value={selectedThreadId ?? ""}
                  onChange={(value) => void handleThreadChange(value)}
                  options={threads.map((thread) => ({
                    value: thread.id,
                    label: `${thread.ticketNumber} · ${thread.subject}`,
                  }))}
                  className="min-w-0 flex-1"
                  triggerClassName="h-10 rounded-[10px] px-3 text-[12px]"
                  contentClassName="z-[80] max-h-[240px] rounded-[12px]"
                  itemClassName="py-2 text-[12px]"
                />
              ) : (
                <p className="min-w-0 flex-1 text-[12px] font-semibold text-[#5F5F5F]">
                  {t("floatingSupport.newConversation")}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsNewConversation(true);
                  setMessages([]);
                  setError(null);
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#050505]/10 text-[#5F5F5F] hover:border-[var(--xd-gold-border-hover)] hover:text-[#050505]"
                aria-label={t("floatingSupport.newConversation")}
                title={t("floatingSupport.newConversation")}
              >
                <Plus size={16} />
              </button>
              <button
                type="button"
                onClick={() => void loadThreads(selectedThreadId ?? undefined)}
                disabled={isLoading}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#050505]/10 text-[#5F5F5F] hover:border-[var(--xd-gold-border-hover)] hover:text-[#050505] disabled:opacity-50"
                aria-label={t("floatingSupport.refresh")}
                title={t("floatingSupport.refresh")}
              >
                <RefreshCw size={15} className={cn(isLoading && "animate-spin")} />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[#FAFAF8] px-4 py-4" aria-live="polite">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-[13px] text-[#717182]">
                {t("common.loading", { fallback: "Loading..." })}
              </div>
            ) : isNewConversation ? (
              <div className="rounded-[16px] border border-[var(--xd-gold-border-soft)] bg-white p-4 text-[13px] leading-6 text-[#5F5F5F]">
                <p className="font-bold text-[#050505]">{t("floatingSupport.newConversation")}</p>
                <p className="mt-1">{t("floatingSupport.newConversationHelp")}</p>
              </div>
            ) : messages.length > 0 ? (
              <div className="space-y-3">
                {messages.map((message) => {
                  const isCustomer = message.senderRole === "CUSTOMER";
                  return (
                    <div key={message.id} className={cn("flex", isCustomer ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[86%] rounded-[16px] px-3.5 py-2.5 text-[12px] leading-5",
                          isCustomer
                            ? "rounded-ee-[5px] bg-[var(--xd-gold)] text-[#3A2600]"
                            : "rounded-es-[5px] border border-[#050505]/[0.07] bg-white text-[#454545]"
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{presentSupportMessageBody(t, message.body)}</p>
                        <p className="mt-1 text-[10px] opacity-65">
                          {new Date(message.createdAt).toLocaleTimeString(language === "ar" ? "ar-EG" : "en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-center text-[13px] leading-6 text-[#717182]">
                {selectedThread ? t("floatingSupport.noMessages") : t("floatingSupport.noThreads")}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} noValidate className="border-t border-[#050505]/[0.07] bg-white p-3">
            {error && (
              <p role="alert" className="mb-2 rounded-[10px] bg-[#DA2B1E]/[0.06] px-3 py-2 text-[11px] font-semibold text-[#B42318]">
                {error}
              </p>
            )}
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={2000}
                rows={2}
                placeholder={t("floatingSupport.messagePlaceholder")}
                className="min-h-[44px] flex-1 resize-none rounded-[14px] border border-[#050505]/10 px-3 py-2.5 text-[12px] leading-5 outline-none placeholder:text-[#A2A3AB] focus:border-[var(--xd-gold-border-hover)]"
                aria-label={t("floatingSupport.messagePlaceholder")}
              />
              <Button
                type="submit"
                size="icon"
                disabled={isSending}
                className="h-11 w-11 shrink-0"
                aria-label={isNewConversation ? t("floatingSupport.startConversation") : t("floatingSupport.send")}
              >
                <Send size={16} />
              </Button>
            </div>
            <Link
              href="/account/support"
              className="mt-2 flex items-center justify-center gap-1.5 rounded-full py-1.5 text-[11px] font-bold text-[var(--xd-gold-text)] hover:text-[#3A2600]"
            >
              <MessageCircle size={13} />
              {t("floatingSupport.openSupportCenter")}
            </Link>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={handleLauncherClick}
        className="xd-gradient-primary-button group flex h-14 w-14 items-center justify-center rounded-full hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-focus-ring)] focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:h-[58px] sm:w-[58px]"
        aria-label={t("floatingSupport.openChat")}
        aria-expanded={isOpen}
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={23} />}
      </button>
    </div>
  );
}
