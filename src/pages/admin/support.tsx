import { useEffect, useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { useLocation } from "wouter";
import { AdminLayout } from "./_components/AdminLayout";
import { AdminPageHeader, AdminStatusBadge } from "./_components/admin-ui";
import {
  getAdminSupportThreads,
  getSupportMessages,
  sendSupportMessage,
  updateAdminSupportThreadStatus,
  type SupportMessage,
  type SupportThread,
} from "@/services/support";

function tone(status: SupportThread["status"]) {
  if (status === "Resolved") return "green" as const;
  if (status === "Waiting for Support") return "amber" as const;
  if (status === "Waiting for Customer") return "blue" as const;
  return "slate" as const;
}

export default function AdminSupport() {
  const [location] = useLocation();
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getAdminSupportThreads()
      .then((items) => {
        if (!active) return;
        setThreads(items);
        const requested = new URLSearchParams(location.split("?")[1] ?? "").get("thread");
        setSelectedId(requested && items.some((item) => item.id === requested) ? requested : items[0]?.id ?? null);
      })
      .catch(() => active && setStatusMessage("Failed to load support inbox."))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [location]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    let active = true;
    getSupportMessages(selectedId, true)
      .then((result) => {
        if (!active) return;
        setMessages(result.messages);
        setThreads((current) => current.map((thread) => thread.id === result.supportThread.id ? result.supportThread : thread));
      })
      .catch(() => active && setStatusMessage("Failed to load conversation."));
    return () => {
      active = false;
    };
  }, [selectedId]);

  const selected = threads.find((thread) => thread.id === selectedId);

  const submitReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedId || !draft.trim()) return;
    try {
      const result = await sendSupportMessage(selectedId, draft, true);
      setMessages((current) => [...current, result.message]);
      setThreads((current) => current.map((thread) => thread.id === selectedId ? result.supportThread : thread));
      setDraft("");
      setStatusMessage("Reply sent.");
    } catch {
      setStatusMessage("Failed to send reply.");
    }
  };

  const changeThreadStatus = async (status: SupportThread["status"]) => {
    if (!selectedId) return;
    try {
      const updated = await updateAdminSupportThreadStatus(selectedId, status);
      setThreads((current) => current.map((thread) => thread.id === selectedId ? { ...thread, ...updated } : thread));
      if (status === "Resolved") {
        const result = await getSupportMessages(selectedId, true);
        setMessages(result.messages);
      }
      setStatusMessage(`Thread updated to ${status}.`);
    } catch {
      setStatusMessage("Failed to update thread status.");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminPageHeader title="Support Inbox" description="Read customer support conversations and reply from one persistent inbox." />
        {statusMessage && <div role="status" className="rounded-lg border border-[#EFE2BC] bg-[#FFF9E8] px-4 py-3 text-sm font-semibold text-[#5F5F5F]">{statusMessage}</div>}
        <div className="grid min-h-[620px] overflow-hidden rounded-lg border border-[#EFE2BC] bg-white shadow-sm lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="border-b border-[#EFE2BC] lg:border-b-0 lg:border-r">
            <div className="border-b border-[#EFE2BC] px-5 py-4 text-sm font-bold text-[#050505]">Threads ({threads.length})</div>
            <div className="max-h-[620px] overflow-y-auto">
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setSelectedId(thread.id)}
                  className={`w-full border-b border-[#F3E8C8] px-5 py-4 text-left transition-colors ${selectedId === thread.id ? "bg-[#FFF9E8]" : "hover:bg-[#FBFAF7]"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-bold text-[#050505]">{thread.ticketNumber}</p>
                    <AdminStatusBadge tone={tone(thread.status)}>{thread.status}</AdminStatusBadge>
                  </div>
                  <p className="mt-2 line-clamp-1 text-sm font-semibold text-[#5F5F5F]">{thread.subject}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#8A8D9A]">{thread.latestMessage || "No messages yet"}</p>
                </button>
              ))}
              {!isLoading && threads.length === 0 && <p className="p-6 text-sm text-[#717182]">No support threads yet.</p>}
              {isLoading && <p className="p-6 text-sm text-[#717182]">Loading inbox...</p>}
            </div>
          </aside>

          <section className="flex min-h-[520px] flex-col">
            {selected ? (
              <>
                <header className="border-b border-[#EFE2BC] px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-bold text-[#050505]">{selected.subject}</h2>
                      <p className="mt-1 text-xs text-[#717182]">{selected.user?.name ?? "Customer"} · {selected.ticketNumber}</p>
                    </div>
                    <select value={selected.status} onChange={(event) => void changeThreadStatus(event.target.value as SupportThread["status"])} className="h-9 rounded-lg border border-[#EFE2BC] bg-white px-3 text-xs font-bold text-[#050505] outline-none focus:border-[#D4A72C]">
                      {(["Open", "Waiting for Support", "Waiting for Customer", "Resolved"] as const).map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </div>
                </header>
                <div className="flex-1 space-y-4 overflow-y-auto bg-[#FBFAF7] p-5">
                  {messages.map((message) => (
                    <div key={message.id} className={`flex ${message.senderRole === "ADMIN" || message.senderRole === "SUPPORT" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-6 ${message.senderRole === "SYSTEM" ? "border border-[#EFE2BC] bg-[#FFF9E8] text-[#717182]" : message.senderRole === "CUSTOMER" ? "bg-white text-[#050505] shadow-sm" : "bg-[#050505] text-white"}`}>
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wide opacity-60">{message.senderRole}</p>
                        <p>{message.body}</p>
                      </div>
                    </div>
                  ))}
                  {messages.length === 0 && <p className="text-center text-sm text-[#8A8D9A]">No messages yet.</p>}
                </div>
                <form onSubmit={submitReply} className="flex gap-3 border-t border-[#EFE2BC] p-4">
                  <textarea
                    required
                    maxLength={2000}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Message support customer..."
                    className="min-h-11 flex-1 resize-none rounded-lg border border-[#EFE2BC] px-3 py-2 text-sm outline-none focus:border-[#D4A72C]"
                  />
                  <button type="submit" className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#F9DC5C] px-4 text-sm font-bold text-[#050505]">
                    <Send size={15} /> Send
                  </button>
                </form>
              </>
            ) : <div className="flex flex-1 items-center justify-center p-8 text-sm text-[#717182]">Select a support thread.</div>}
          </section>
        </div>
      </div>
    </AdminLayout>
  );
}
