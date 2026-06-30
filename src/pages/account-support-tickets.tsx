import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  CheckCircle2,
  Clock3,
  Eye,
  LifeBuoy,
  MessageSquare,
  Plus,
  Search,
  Send,
  X,
} from "lucide-react";
import { AccountSidebar } from "@/components/dental/AccountSidebar";
import {
  AccountFilterToolbar,
  accountFilterControlClassName,
  accountFilterSearchClassName,
  accountFilterTriggerClassName,
} from "@/components/dental/AccountFilterToolbar";
import { Button } from "@/components/dental/Button";
import { Container } from "@/components/dental/Container";
import { DentalSelect, type DentalSelectOption } from "@/components/dental/Select";
import { useLanguage } from "@/context/LanguageContext";
import { accountT, accountValue } from "@/lib/accountI18n";
import { cn } from "@/lib/utils";
import {
  createSupportThread,
  getMySupportThreads,
  getSupportMessages,
  sendSupportMessage,
  type SupportMessage,
  type SupportThread,
} from "@/services/support";

type TicketStatus = "Open" | "Waiting for Support" | "Waiting for Customer" | "Resolved";
type TicketPriority = "Normal" | "Urgent";
type TicketTab = "active" | "history";
type StatusFilter = "all" | TicketStatus;
type DateFilter = "30d" | "6m" | "all";
type SortOrder = "newest" | "oldest";

type Ticket = {
  id: string;
  ticketNumber: string;
  createdAt: string;
  subject: string;
  type: string;
  related: string;
  status: TicketStatus;
  priority: TicketPriority;
  latest: string;
  messages?: SupportMessage[];
};

function toTicket(thread: SupportThread, messages?: SupportMessage[]): Ticket {
  return {
    id: thread.id,
    ticketNumber: thread.ticketNumber,
    createdAt: thread.createdAt.slice(0, 10),
    subject: thread.subject,
    type: thread.type.replaceAll("_", " "),
    related: thread.related || (thread.productRequestId ? "Product Request" : "Account Support"),
    status: thread.status,
    priority: thread.priority,
    latest: thread.latestMessage || "No messages yet",
    messages,
  };
}

type NewTicketForm = {
  subject: string;
  type: string;
  related: string;
  priority: TicketPriority;
  message: string;
};

// Development fixture retained for visual reference only; live account data always comes from the API.
const developmentTicketFixtures: Ticket[] = [
  {
    id: "ticket-1042",
    ticketNumber: "ST-1042",
    createdAt: "2026-05-24",
    subject: "Delivery delay for Order #XD-10245",
    type: "Delivery Issue",
    related: "Order #XD-10245",
    status: "Waiting for Support",
    priority: "Normal",
    latest: "Our team is reviewing the delivery status.",
  },
  {
    id: "ticket-1038",
    ticketNumber: "ST-1038",
    createdAt: "2026-05-20",
    subject: "Question about payment confirmation",
    type: "Payment Issue",
    related: "Order #XD-10198",
    status: "Open",
    priority: "Normal",
    latest: "Ticket submitted and waiting for support review.",
  },
  {
    id: "ticket-1019",
    ticketNumber: "ST-1019",
    createdAt: "2026-03-03",
    subject: "Missing item from composite order",
    type: "Order Issue",
    related: "Order #XD-10082",
    status: "Resolved",
    priority: "Normal",
    latest: "Replacement item was shipped and the ticket was resolved.",
  },
  {
    id: "ticket-1007",
    ticketNumber: "ST-1007",
    createdAt: "2026-01-14",
    subject: "Quote update for implantology supplies",
    type: "Quote Request",
    related: "Quote #QT-4408",
    status: "Resolved",
    priority: "Normal",
    latest: "Quote was updated and approved by the clinic.",
  },
];
void developmentTicketFixtures;

const emptyNewTicket: NewTicketForm = {
  subject: "",
  type: "Delivery Issue",
  related: "",
  priority: "Normal",
  message: "",
};

const inputClassName =
  "h-12 w-full rounded-[12px] border border-[#050505]/10 bg-white px-4 text-[14px] text-[#050505] outline-none transition placeholder:text-[#B3B4BD] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10";
const toolbarControlClassName =
  "h-12 w-full rounded-full border border-[#050505]/10 bg-white px-4 text-[14px] text-[#050505] outline-none transition placeholder:text-[#B3B4BD] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10";

function formatTicketDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "min-w-0 overflow-hidden rounded-[24px] border border-[var(--xd-gold-active)]/[0.12] bg-white/80 shadow-[0_12px_34px_rgba(5,5,5,0.04)] backdrop-blur",
        className
      )}
    >
      {children}
    </section>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <Card className="flex min-h-[112px] flex-col items-center justify-center p-5 text-center">
      <p className="font-display text-[28px] font-bold leading-none text-[var(--xd-gold-active)]">
        {value}
      </p>
      <p className="mt-3 text-[12px] font-bold text-[#717182]">{label}</p>
    </Card>
  );
}

function SelectControl({
  label,
  value,
  onChange,
  options,
  className,
  triggerClassName,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: DentalSelectOption[];
  className?: string;
  triggerClassName?: string;
}) {
  return (
    <DentalSelect
      className={className}
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      triggerClassName={cn(
        accountFilterTriggerClassName,
        "border-[#050505]/10 bg-white xl:text-[14px]",
        triggerClassName
      )}
    />
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: DentalSelectOption[];
}) {
  const { t } = useLanguage();

  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-bold text-[#050505]">{label}</span>
      <DentalSelect
        label={label}
        value={value}
        onChange={onChange}
        options={options}
        triggerClassName="rounded-[12px]"
      />
    </label>
  );
}

function StatusPill({ status }: { status: TicketStatus }) {
  const { t } = useLanguage();
  const classes: Record<TicketStatus, string> = {
    Open: "bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-text)]",
    "Waiting for Support": "bg-[var(--xd-info-bg)] text-[var(--xd-info-text)]",
    "Waiting for Customer": "bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-text)]",
    Resolved: "bg-[#16803C]/10 text-[#16803C]",
  };

  return (
    <span className={cn("rounded-full px-3 py-1 text-[11px] font-bold", classes[status])}>
      {accountValue(t, status)}
    </span>
  );
}

function PriorityPill({ priority }: { priority: TicketPriority }) {
  const { t } = useLanguage();

  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-[11px] font-bold",
        priority === "Urgent"
          ? "bg-[#F44336]/10 text-[#F44336]"
          : "bg-[var(--xd-info-bg)] text-[var(--xd-info-text)]"
      )}
    >
      {accountValue(t, priority)}
    </span>
  );
}

function TicketCard({
  ticket,
  isExpanded,
  isReplying,
  replyDraft,
  onView,
  onReply,
  onReplyDraftChange,
  onSubmitReply,
  onCancelReply,
}: {
  ticket: Ticket;
  isExpanded: boolean;
  isReplying: boolean;
  replyDraft: string;
  onView: () => void;
  onReply: () => void;
  onReplyDraftChange: (value: string) => void;
  onSubmitReply: (event: FormEvent<HTMLFormElement>) => void;
  onCancelReply: () => void;
}) {
  const { t } = useLanguage();

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-[16px] font-bold text-[#050505]">
            {accountT(t, "support.ticketNumber", "Ticket #{ticketNumber}", { ticketNumber: ticket.ticketNumber })}
          </h2>
          <p className="mt-1 text-[12px] font-medium text-[#8A8D9A]">
            {accountT(t, "support.createdDate", "Created {date}", { date: formatTicketDate(ticket.createdAt) })}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          <StatusPill status={ticket.status} />
          <PriorityPill priority={ticket.priority} />
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-[18px] font-bold leading-7 text-[#050505]">{accountValue(t, ticket.subject)}</h3>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-[#717182]">
          <span>
            {accountT(t, "support.typeLabel", "Type")}:{" "}
            <strong className="font-bold text-[#050505]">{accountValue(t, ticket.type)}</strong>
          </span>
          <span>
            {accountT(t, "support.relatedLabel", "Related")}:{" "}
            <strong className="font-bold text-[var(--xd-gold-text)]">{accountValue(t, ticket.related)}</strong>
          </span>
        </div>

        <div className="mt-4 inline-flex max-w-full rounded-[10px] border border-[var(--xd-info-text)]/10 bg-[var(--xd-info-bg)] px-3 py-2 text-[12px] font-semibold leading-5 text-[var(--xd-info-text)]">
          {accountT(t, "support.latestLabel", "Latest")}: {accountValue(t, ticket.latest)}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={onView}
          variant="tertiary"
          size="sm"
          className="h-10 gap-2 px-4 text-[13px] text-[var(--xd-gold-text)] hover:bg-[var(--xd-gold-active)]/[0.08] hover:text-[#050505]"
        >
          <Eye size={15} />
          {isExpanded ? accountT(t, "support.hideDetails", "Hide Details") : accountT(t, "support.viewTicket", "View Ticket")}
        </Button>
        <Button
          type="button"
          onClick={onReply}
          variant="secondary"
          size="sm"
          className="h-10 gap-2 px-4 text-[13px] text-[var(--xd-gold-text)]"
        >
          <MessageSquare size={15} />
          {accountT(t, "support.addReply", "Add Reply")}
        </Button>
      </div>

      {isExpanded && (
        <div className="mt-5 border-t border-[#050505]/[0.07] pt-5">
          <h4 className="text-[13px] font-bold text-[#050505]">
            {accountT(t, "support.supportChat", "Support Chat")}
          </h4>
          <div className="mt-4 space-y-4">
            {ticket.messages?.length ? ticket.messages.map((message) => (
              <div key={message.id} className={cn("flex", message.senderRole === "CUSTOMER" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] rounded-[14px] px-4 py-3 text-[13px] leading-5",
                  message.senderRole === "SYSTEM"
                    ? "border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] text-[#717182]"
                    : message.senderRole === "CUSTOMER"
                    ? "bg-[#050505] text-white"
                    : "bg-[var(--xd-info-bg)] text-[var(--xd-info-text)]"
                )}>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide opacity-70">{message.senderRole}</p>
                  <p>{message.body}</p>
                </div>
              </div>
            )) : (
              <p className="text-[13px] text-[#8A8D9A]">{accountT(t, "support.noMessages", "No messages yet")}</p>
            )}
            <div className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#16803C]/10 text-[#16803C]">
                <CheckCircle2 size={15} />
              </span>
              <div>
                <p className="text-[13px] font-bold text-[#050505]">
                  {accountT(t, "support.ticketCreated", "Ticket created")}
                </p>
                <p className="mt-1 text-[12px] leading-5 text-[#8A8D9A]">
                  {accountT(t, "support.ticketLoggedFor", "{type} logged for {related}.", {
                    type: accountValue(t, ticket.type),
                    related: accountValue(t, ticket.related),
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isReplying && (
        <form onSubmit={onSubmitReply} className="mt-5 border-t border-[#050505]/[0.07] pt-5">
          <label className="block">
            <span className="mb-2 block text-[13px] font-bold text-[#050505]">
              {accountT(t, "support.replyToTicket", "Reply to ticket")}
            </span>
            <textarea
              required
              value={replyDraft}
              onChange={(event) => onReplyDraftChange(event.target.value)}
              placeholder={accountT(t, "support.replyPlaceholder", "Add context, documents, or an update for support.")}
              className="min-h-[112px] w-full resize-none rounded-[14px] border border-[#050505]/10 bg-white px-4 py-3 text-[14px] text-[#050505] outline-none transition placeholder:text-[#B3B4BD] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10"
            />
          </label>
          <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              onClick={onCancelReply}
              variant="tertiary"
              size="sm"
              className="h-10 px-5 text-[13px]"
            >
              {accountT(t, "common.cancel", "Cancel")}
            </Button>
            <Button type="submit" variant="primary" size="sm" className="h-10 gap-2 px-5 text-[13px]">
              <Send size={14} />
              {accountT(t, "support.sendReply", "Send Reply")}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

function NewTicketModal({
  form,
  onChange,
  onClose,
  onSubmit,
}: {
  form: NewTicketForm;
  onChange: (form: NewTicketForm) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useLanguage();

  return (
    <div
      className="no-scrollbar fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[#050505]/40 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-ticket-title"
    >
      <form
        onSubmit={onSubmit}
        className="flex max-h-[calc(100vh-48px)] w-full max-w-[620px] flex-col overflow-hidden rounded-[28px] border border-[var(--xd-gold-border-soft)] bg-white shadow-[0_24px_70px_rgba(5,5,5,0.18)]"
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6 sm:px-8 sm:pt-8">
          <div>
            <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--xd-gold-active)]">
              {accountT(t, "support.eyebrow", "Support Center")}
            </p>
            <h2 id="new-ticket-title" className="font-display text-[28px] font-bold text-[#050505]">
              {accountT(t, "support.openNewTicket", "Open New Ticket")}
            </h2>
            <p className="mt-2 text-[14px] leading-6 text-[#8A8D9A]">
              {accountT(t, "support.modalDescription", "Share the issue details so the support team can route it correctly.")}
            </p>
          </div>
          <Button
            type="button"
            onClick={onClose}
            variant="tertiary"
            size="icon"
            className="h-10 w-10 shrink-0"
            aria-label={accountT(t, "support.closeNewTicketForm", "Close new ticket form")}
          >
            <X size={18} />
          </Button>
        </div>

        <div className="no-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-6 sm:px-8">
          <label className="block">
            <span className="mb-2 block text-[13px] font-bold text-[#050505]">
              {accountT(t, "support.subject", "Subject")}
            </span>
            <input
              required
              value={form.subject}
              onChange={(event) => onChange({ ...form, subject: event.target.value })}
              placeholder={accountT(t, "support.subjectPlaceholder", "Example: Delivery delay for Order #XD-10245")}
              className={inputClassName}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldSelect
              label={accountT(t, "support.issueType", "Issue Type")}
              value={form.type}
              onChange={(value) => onChange({ ...form, type: value })}
              options={[
                { value: "Delivery Issue", label: accountValue(t, "Delivery Issue") },
                { value: "Payment Issue", label: accountValue(t, "Payment Issue") },
                { value: "Order Issue", label: accountValue(t, "Order Issue") },
                { value: "Quote Request", label: accountValue(t, "Quote Request") },
                { value: "Product Question", label: accountValue(t, "Product Question") },
                { value: "Account Question", label: accountValue(t, "Account Question") },
              ]}
            />

            <FieldSelect
              label={accountT(t, "support.priority", "Priority")}
              value={form.priority}
              onChange={(value) => onChange({ ...form, priority: value as TicketPriority })}
              options={[
                { value: "Normal", label: accountValue(t, "Normal") },
                { value: "Urgent", label: accountValue(t, "Urgent") },
              ]}
            />
          </div>

          <label className="block">
            <span className="mb-2 block text-[13px] font-bold text-[#050505]">
              {accountT(t, "support.relatedOrderOrQuote", "Related Order or Quote")}
            </span>
            <input
              value={form.related}
              onChange={(event) => onChange({ ...form, related: event.target.value })}
              placeholder={accountT(t, "support.relatedPlaceholder", "Order #XD-10245")}
              className={inputClassName}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[13px] font-bold text-[#050505]">
              {accountT(t, "support.message", "Message")}
            </span>
            <textarea
              required
              value={form.message}
              onChange={(event) => onChange({ ...form, message: event.target.value })}
              placeholder={accountT(t, "support.messagePlaceholder", "Describe what happened and what help you need.")}
              className="min-h-[112px] w-full resize-none rounded-[14px] border border-[#050505]/10 bg-white px-4 py-3 text-[14px] text-[#050505] outline-none transition placeholder:text-[#B3B4BD] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10"
            />
          </label>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-[#050505]/[0.07] bg-white px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
          <Button
            type="button"
            onClick={onClose}
            variant="tertiary"
            size="sm"
            className="h-11 px-5 text-[14px]"
          >
            {accountT(t, "common.cancel", "Cancel")}
          </Button>
          <Button type="submit" variant="primary" size="sm" className="h-11 gap-2 px-6 text-[14px]">
            <Plus size={16} />
            {accountT(t, "support.openTicket", "Open Ticket")}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function AccountSupportTickets() {
  const { t } = useLanguage();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TicketTab>("active");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("6m");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [replyTicketId, setReplyTicketId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [newTicketForm, setNewTicketForm] = useState<NewTicketForm>(emptyNewTicket);

  useEffect(() => {
    let active = true;
    getMySupportThreads()
      .then(async (threads) => {
        if (!active) return;
        setTickets(threads.map((thread) => toTicket(thread)));
        const requestedThread = new URLSearchParams(window.location.search).get("thread");
        if (requestedThread && threads.some((thread) => thread.id === requestedThread)) {
          const result = await getSupportMessages(requestedThread);
          if (active) {
            setTickets((current) => current.map((ticket) => ticket.id === requestedThread ? toTicket(result.supportThread, result.messages) : ticket));
            setExpandedTicketId(requestedThread);
          }
        }
      })
      .catch(() => {
        if (active) setStatusMessage(accountT(t, "support.loadFailed", "Failed to load support tickets."));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  const stats = useMemo(
    () => ({
      open: tickets.filter((ticket) => ticket.status === "Open").length,
      waiting: tickets.filter((ticket) => ticket.status === "Waiting for Support").length,
      resolved: tickets.filter((ticket) => ticket.status === "Resolved").length,
      urgent: tickets.filter((ticket) => ticket.priority === "Urgent").length,
    }),
    [tickets]
  );

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase();
    const newestTicketTime = Math.max(
      ...tickets.map((ticket) => new Date(`${ticket.createdAt}T00:00:00`).getTime())
    );
    const cutoff =
      dateFilter === "all"
        ? Number.NEGATIVE_INFINITY
        : newestTicketTime - (dateFilter === "30d" ? 30 : 183) * 24 * 60 * 60 * 1000;

    return tickets
      .filter((ticket) => (activeTab === "active" ? ticket.status !== "Resolved" : ticket.status === "Resolved"))
      .filter((ticket) => statusFilter === "all" || ticket.status === statusFilter)
      .filter((ticket) => new Date(`${ticket.createdAt}T00:00:00`).getTime() >= cutoff)
      .filter((ticket) => {
        if (!query) return true;

        return [
          ticket.ticketNumber,
          ticket.subject,
          ticket.type,
          ticket.related,
          ticket.latest,
          ticket.status,
          ticket.priority,
        ].some((value) => value.toLowerCase().includes(query));
      })
      .sort((a, b) => {
        const aTime = new Date(`${a.createdAt}T00:00:00`).getTime();
        const bTime = new Date(`${b.createdAt}T00:00:00`).getTime();

        return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
      });
  }, [activeTab, dateFilter, search, sortOrder, statusFilter, tickets]);

  const handleOpenTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const type = newTicketForm.type === "Quote Request" ? "QUOTE" : newTicketForm.related.toLowerCase().includes("order") ? "ORDER" : "GENERAL_SUPPORT";
      const thread = await createSupportThread({
        subject: newTicketForm.subject,
        type,
        related: newTicketForm.related,
        priority: newTicketForm.priority,
        message: newTicketForm.message,
      });
      const createdTicket = toTicket(thread);
      setTickets((current) => [createdTicket, ...current]);
      setActiveTab("active");
      setStatusFilter("all");
      setDateFilter("all");
      setSearch("");
      setNewTicketForm(emptyNewTicket);
      setIsNewTicketOpen(false);
      setStatusMessage(accountT(t, "support.ticketOpened", "Ticket #{ticketNumber} opened.", { ticketNumber: thread.ticketNumber }));
    } catch {
      setStatusMessage(accountT(t, "support.sendFailed", "Failed to send message. Please try again."));
    }
  };

  const handleSubmitReply = async (event: FormEvent<HTMLFormElement>, ticket: Ticket) => {
    event.preventDefault();
    try {
      const result = await sendSupportMessage(ticket.id, replyDraft);
      setTickets((current) => current.map((item) => item.id === ticket.id
        ? toTicket(result.supportThread, [...(item.messages ?? []), result.message])
        : item));
      setReplyTicketId(null);
      setReplyDraft("");
      setStatusMessage(accountT(t, "support.replyAdded", "Reply added to Ticket #{ticketNumber}.", { ticketNumber: ticket.ticketNumber }));
    } catch {
      setStatusMessage(accountT(t, "support.sendFailed", "Failed to send message. Please try again."));
    }
  };

  const handleViewTicket = async (ticket: Ticket) => {
    if (expandedTicketId === ticket.id) {
      setExpandedTicketId(null);
      return;
    }
    setExpandedTicketId(ticket.id);
    try {
      const result = await getSupportMessages(ticket.id);
      setTickets((current) => current.map((item) => item.id === ticket.id ? toTicket(result.supportThread, result.messages) : item));
    } catch {
      setStatusMessage(accountT(t, "support.loadMessagesFailed", "Failed to load messages."));
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
                <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--xd-gold-active)]">
                  {accountT(t, "support.eyebrow", "Support Center")}
                </p>
                <h1 className="font-display text-[36px] font-bold leading-none text-[#050505] sm:text-[44px]">
                  {accountT(t, "support.title", "Support Tickets")}
                </h1>
                <p className="mt-4 max-w-[760px] text-[15px] leading-6 text-[#8A8D9A]">
                  {accountT(
                    t,
                    "support.description",
                    "Contact support and track issues related to orders, delivery, payment, products, quotes, or account questions."
                  )}
                </p>
              </div>

              <Button
                type="button"
                onClick={() => {
                  setStatusMessage(null);
                  setIsNewTicketOpen(true);
                }}
                variant="primary"
                className="h-11 w-full gap-2 px-5 text-[14px] sm:w-auto"
                >
                  <Plus size={17} />
                  {accountT(t, "support.openNewTicket", "Open New Ticket")}
              </Button>
            </div>

            {statusMessage && (
              <div
                role="status"
                className="rounded-[14px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-active)]/[0.08] px-4 py-3 text-[13px] font-semibold text-[#5F5F5F]"
              >
                {statusMessage}
              </div>
            )}

            {isLoading && <div role="status" className="text-[13px] font-semibold text-[#717182]">{accountT(t, "common.loading", "Loading...")}</div>}

            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard value={stats.open} label={accountValue(t, "Open")} />
              <StatCard value={stats.waiting} label={accountValue(t, "Waiting for Support")} />
              <StatCard value={stats.resolved} label={accountValue(t, "Resolved")} />
              <StatCard value={stats.urgent} label={accountValue(t, "Urgent")} />
            </div>

            <AccountFilterToolbar className="sm:grid-cols-3 xl:grid-cols-[minmax(0,1fr)_160px_180px_160px]">
              <label className={cn(accountFilterSearchClassName, "sm:col-span-3 xl:col-span-1")}>
                <span className="sr-only">{accountT(t, "support.searchTickets", "Search tickets")}</span>
                <Search
                  size={17}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8A8D9A]"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={accountT(t, "support.searchPlaceholder", "Search by order number or product name")}
                  className={cn(toolbarControlClassName, "pl-11")}
                />
              </label>

              <SelectControl
                className={accountFilterControlClassName}
                label={accountT(t, "support.filterByStatus", "Filter by status")}
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as StatusFilter)}
                options={[
                  { value: "all", label: accountT(t, "values.filters.allStatus", "All Status") },
                  { value: "Open", label: accountValue(t, "Open") },
                  { value: "Waiting for Support", label: accountT(t, "support.waiting", "Waiting") },
                  { value: "Resolved", label: accountValue(t, "Resolved") },
                ]}
              />

              <SelectControl
                className={accountFilterControlClassName}
                label={accountT(t, "support.filterByDate", "Filter by date")}
                value={dateFilter}
                onChange={(value) => setDateFilter(value as DateFilter)}
                options={[
                  { value: "6m", label: accountT(t, "values.filters.last6Months", "Last 6 months") },
                  { value: "30d", label: accountT(t, "values.filters.last30Days", "Last 30 days") },
                  { value: "all", label: accountT(t, "values.filters.allTime", "All time") },
                ]}
              />

              <SelectControl
                className={accountFilterControlClassName}
                label={accountT(t, "support.sortTickets", "Sort tickets")}
                value={sortOrder}
                onChange={(value) => setSortOrder(value as SortOrder)}
                options={[
                  { value: "newest", label: accountT(t, "values.filters.newestFirst", "Newest First") },
                  { value: "oldest", label: accountT(t, "values.filters.oldestFirst", "Oldest First") },
                ]}
              />
            </AccountFilterToolbar>

            <div className="inline-flex max-w-full rounded-full border border-[var(--xd-gold-border-soft)] bg-white/65 p-1 shadow-[0_8px_24px_rgba(5,5,5,0.03)]">
              {[
                ["active", accountT(t, "values.tabs.activeTickets", "Active Tickets")],
                ["history", accountT(t, "values.tabs.ticketHistory", "Ticket History")],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setActiveTab(value as TicketTab);
                    setStatusFilter("all");
                  }}
                  className={cn(
                    "rounded-full px-5 py-2 text-[13px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)]",
                    activeTab === value
                      ? "bg-[var(--xd-gold-active)]/15 text-[var(--xd-gold-text)]"
                      : "text-[#717182] hover:text-[#050505]"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-5">
              {filteredTickets.length > 0 ? (
                filteredTickets.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    isExpanded={expandedTicketId === ticket.id}
                    isReplying={replyTicketId === ticket.id}
                    replyDraft={replyTicketId === ticket.id ? replyDraft : ""}
                    onView={() => void handleViewTicket(ticket)}
                    onReply={() => {
                      setReplyTicketId(ticket.id);
                      setReplyDraft("");
                    }}
                    onReplyDraftChange={setReplyDraft}
                    onSubmitReply={(event) => handleSubmitReply(event, ticket)}
                    onCancelReply={() => {
                      setReplyTicketId(null);
                      setReplyDraft("");
                    }}
                  />
                ))
              ) : (
                <Card className="p-10 text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-active)]">
                    <LifeBuoy size={24} />
                  </span>
                  <h2 className="mt-4 text-[18px] font-bold text-[#050505]">
                    {accountT(t, "support.noTicketsFound", "No tickets found")}
                  </h2>
                  <p className="mx-auto mt-2 max-w-[420px] text-[14px] leading-6 text-[#8A8D9A]">
                    {accountT(t, "support.noTicketsDescription", "Adjust your filters or open a new ticket so support can review the issue.")}
                  </p>
                  <Button
                    type="button"
                    onClick={() => setIsNewTicketOpen(true)}
                    variant="primary"
                    className="mt-5 gap-2 px-5 text-[14px]"
                  >
                    <Plus size={16} />
                    {accountT(t, "support.openNewTicket", "Open New Ticket")}
                  </Button>
                </Card>
              )}
            </div>
          </main>
        </div>
      </Container>

      {isNewTicketOpen && (
        <NewTicketModal
          form={newTicketForm}
          onChange={setNewTicketForm}
          onClose={() => {
            setIsNewTicketOpen(false);
            setNewTicketForm(emptyNewTicket);
          }}
          onSubmit={handleOpenTicket}
        />
      )}
    </div>
  );
}
