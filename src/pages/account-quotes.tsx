import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  FileText,
  Package,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
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
import { useStore } from "@/context/StoreContext";
import {
  getStoredQuoteSummaries,
  quoteSummaries,
  type QuoteStatus,
  type QuoteSummary,
  type QuoteTab,
} from "@/data/quotes";
import { accountT, accountValue } from "@/lib/accountI18n";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | QuoteStatus;
type DateFilter = "30d" | "6m" | "all";
type SortOrder = "newest" | "oldest";

const emptyQuoteForm = {
  source: "",
  branch: "Main Clinic",
  notes: "",
};

const inputClassName =
  "h-12 w-full rounded-[12px] border border-[#050505]/10 bg-white px-4 text-[14px] text-[#050505] outline-none transition placeholder:text-[#B3B4BD] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10";
const toolbarControlClassName =
  "h-12 w-full rounded-full border border-[#050505]/10 bg-white px-4 text-[14px] text-[#050505] outline-none transition placeholder:text-[#B3B4BD] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10";

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatCurrency(value: number) {
  return `EGP ${value.toLocaleString("en-US")}`;
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-[24px] border border-[var(--xd-gold-active)]/[0.14] bg-white/85 shadow-[0_14px_36px_rgba(5,5,5,0.04)] backdrop-blur",
        className
      )}
    >
      {children}
    </section>
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

function StatusPill({ status }: { status: QuoteStatus }) {
  const { t } = useLanguage();
  const classes: Record<QuoteStatus, string> = {
    "Pending Review": "bg-[var(--xd-gold-bg-soft)] text-[#A67800]",
    Approved: "bg-[#16803C]/10 text-[#16803C]",
    Accepted: "bg-[#16803C]/10 text-[#16803C]",
    Expired: "bg-[#050505]/10 text-[#6A6A6A]",
  };

  return (
    <span className={cn("inline-flex rounded-full px-3 py-1.5 text-[12px] font-bold", classes[status])}>
      {accountValue(t, status)}
    </span>
  );
}

function QuotePreview({ count }: { count: number }) {
  const visibleSlotCount = Math.min(2, Math.max(count, 0));
  const overflow = Math.max(count - visibleSlotCount, 0);

  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: visibleSlotCount }).map((_, index) => (
        <span
          key={index}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold)]/[0.06]"
        >
          <Package size={18} strokeWidth={1.8} className="text-[var(--xd-gold-hover)]" />
        </span>
      ))}
      {overflow > 0 && (
        <span className="flex h-11 min-w-11 items-center justify-center rounded-[11px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] px-2 text-[12px] font-bold text-[var(--xd-gold-text)]">
          +{overflow}
        </span>
      )}
    </div>
  );
}

function QuoteMeta({ quote }: { quote: QuoteSummary }) {
  const { t } = useLanguage();
  const source = quote.previousOrder ? `${quote.source} ${quote.previousOrder}` : quote.source;
  const metaItems = [
    <span key="products" className="font-bold text-[#050505]">
      {quote.productCount} <span className="text-[#717182]">{accountT(t, "common.products", "products")}</span>
    </span>,
    <span key="source">
      <span className="font-semibold text-[#6A6A6A]">{accountT(t, "quotes.sourceLabel", "Source:")} </span>
      <span>{quote.previousOrder ? `${accountValue(t, quote.source)} ${quote.previousOrder}` : accountValue(t, source)}</span>
    </span>,
    <span key="branch">
      <span className="font-semibold text-[#6A6A6A]">{accountT(t, "common.branchWithColon", "Branch:")} </span>
      <span>{accountValue(t, quote.branch)}</span>
    </span>,
  ];

  if (quote.expiresAt) {
    metaItems.push(
      <span key="expires">
        <span className="font-semibold text-[#6A6A6A]">{accountT(t, "quotes.expiresLabel", "Expires:")} </span>
        <span>{formatDate(quote.expiresAt)}</span>
      </span>
    );
  }

  if (quote.acceptedAt) {
    metaItems.push(
      <span key="accepted">
        <span className="font-semibold text-[#16803C]">{accountT(t, "quotes.acceptedLabel", "Accepted:")} </span>
        <span className="text-[#16803C]">{formatDate(quote.acceptedAt)}</span>
      </span>
    );
  }

  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-6 text-[#8A8D9A]">
      {metaItems.map((item, index) => (
        <span key={item.key ?? index} className="inline-flex items-center gap-2">
          {index > 0 && <span className="text-[#C8C4B8]">·</span>}
          {item}
        </span>
      ))}
    </p>
  );
}

function QuoteCard({
  quote,
  onSecondaryAction,
}: {
  quote: QuoteSummary;
  onSecondaryAction: (quote: QuoteSummary) => void;
}) {
  const { t } = useLanguage();
  const secondaryLabel =
    quote.status === "Pending Review"
      ? accountT(t, "quotes.contactSales", "Contact Sales")
      : quote.status === "Approved"
        ? accountT(t, "quotes.requestChanges", "Request Changes")
        : quote.status === "Accepted"
          ? accountT(t, "quotes.reorderQuote", "Reorder Quote")
          : accountT(t, "quotes.requestAgain", "Request Again");
  const SecondaryIcon = quote.status === "Pending Review" ? Phone : quote.status === "Approved" ? Pencil : RefreshCw;

  return (
    <Card className="p-[22px] sm:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h2 className="text-[18px] font-bold text-[#050505]">{accountT(t, "quotes.quoteNumberTitle", "Quote #{quoteNumber}", { quoteNumber: quote.quoteNumber })}</h2>
          <p className="mt-1 text-[13px] font-semibold text-[#8A8D9A]">
            {accountT(t, "quotes.requestedDate", "Requested {date}", { date: formatDate(quote.requestedAt) })}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
          <StatusPill status={quote.status} />
          <p className="font-display text-[21px] font-bold text-[var(--xd-gold-active)]">
            {formatCurrency(quote.total)}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <QuotePreview count={quote.productCount} />
        <QuoteMeta quote={quote} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          asChild
          variant="primary"
          size="sm"
          className="h-10 px-5 text-[13px]"
        >
          <Link href={`/account/quotes/${quote.id}`}>{accountT(t, "common.viewDetails", "View Details")}</Link>
        </Button>
        {quote.status === "Pending Review" ? (
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="h-10 gap-2 px-5 text-[13px] text-[var(--xd-gold-active)]"
          >
            <a href="tel:+201552229405" onClick={() => onSecondaryAction(quote)}>
              <SecondaryIcon size={15} />
              {secondaryLabel}
            </a>
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => onSecondaryAction(quote)}
            variant="secondary"
            size="sm"
            className="h-10 gap-2 px-5 text-[13px] text-[var(--xd-gold-active)]"
          >
            <SecondaryIcon size={15} />
            {secondaryLabel}
          </Button>
        )}
      </div>
    </Card>
  );
}

function RequestQuoteModal({
  form,
  onChange,
  onClose,
  onSubmit,
}: {
  form: typeof emptyQuoteForm;
  onChange: (form: typeof emptyQuoteForm) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useLanguage();

  return (
    <div
      className="no-scrollbar fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[#050505]/40 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="request-quote-title"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-[560px] rounded-[28px] border border-[var(--xd-gold-border-soft)] bg-white p-6 shadow-[0_24px_70px_rgba(5,5,5,0.18)] sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--xd-gold-active)]">
              {accountT(t, "quotes.eyebrow", "Clinic Quotes")}
            </p>
            <h2 id="request-quote-title" className="font-display text-[28px] font-bold text-[#050505]">
              {accountT(t, "quotes.requestNewQuote", "Request New Quote")}
            </h2>
            <p className="mt-2 text-[14px] leading-6 text-[#8A8D9A]">
              {accountT(t, "quotes.requestModalDescription", "Tell sales what your clinic needs and we will prepare bulk pricing.")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#717182] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
            aria-label={accountT(t, "quotes.closeQuoteForm", "Close quote form")}
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-2 block text-[13px] font-bold text-[#050505]">{accountT(t, "quotes.quoteSource", "Quote Source")}</span>
            <input
              required
              value={form.source}
              onChange={(event) => onChange({ ...form, source: event.target.value })}
              placeholder={accountValue(t, "Monthly Clinic Essentials")}
              className={inputClassName}
            />
          </label>
          <FieldSelect
            label={accountT(t, "common.branch", "Branch")}
            value={form.branch}
            onChange={(value) => onChange({ ...form, branch: value })}
            options={[
              { value: "Main Clinic", label: accountValue(t, "Main Clinic") },
              { value: "Dokki Branch", label: accountValue(t, "Dokki Branch") },
              { value: "General", label: accountValue(t, "General") },
            ]}
          />
          <label className="block">
            <span className="mb-2 block text-[13px] font-bold text-[#050505]">{accountT(t, "common.notes", "Notes")}</span>
            <textarea
              value={form.notes}
              onChange={(event) => onChange({ ...form, notes: event.target.value })}
              placeholder={accountT(t, "quotes.notesPlaceholder", "Add products, brands, quantities, or budget notes.")}
              className="min-h-[112px] w-full resize-none rounded-[14px] border border-[#050505]/10 bg-white px-4 py-3 text-[14px] text-[#050505] outline-none transition placeholder:text-[#B3B4BD] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-full px-5 text-[14px] font-bold text-[#717182] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
          >
            {accountT(t, "common.cancel", "Cancel")}
          </button>
          <Button type="submit" variant="primary" size="sm" className="h-11 gap-2 px-6 text-[14px]">
            <Plus size={16} />
            {accountT(t, "quotes.submitQuoteRequest", "Submit Quote Request")}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function AccountQuotes() {
  const [, navigate] = useLocation();
  const { t } = useLanguage();
  const { currentUser } = useStore();
  const [quotes, setQuotes] = useState<QuoteSummary[]>(() =>
    currentUser?.isDemo
      ? [...getStoredQuoteSummaries(currentUser.id), ...quoteSummaries]
      : getStoredQuoteSummaries(currentUser?.id)
  );
  const [activeTab, setActiveTab] = useState<QuoteTab>("active");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("6m");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [quoteForm, setQuoteForm] = useState(emptyQuoteForm);
  

  const filteredQuotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    const newestQuoteTime = Math.max(
      ...quotes.map((quote) => new Date(`${quote.requestedAt}T00:00:00`).getTime())
    );
    const cutoff =
      dateFilter === "all"
        ? Number.NEGATIVE_INFINITY
        : newestQuoteTime - (dateFilter === "30d" ? 30 : 183) * 24 * 60 * 60 * 1000;

    return quotes
      .filter((quote) => quote.tab === activeTab)
      .filter((quote) => quote.isVisible !== false)
      .filter((quote) => statusFilter === "all" || quote.status === statusFilter)
      .filter((quote) => new Date(`${quote.requestedAt}T00:00:00`).getTime() >= cutoff)
      .filter((quote) => {
        if (!query) return true;

        return [
          quote.quoteNumber,
          quote.source,
          quote.branch,
          quote.status,
          quote.previousOrder ?? "",
        ].some((value) => value.toLowerCase().includes(query));
      })
      .sort((a, b) => {
        const aTime = new Date(`${a.requestedAt}T00:00:00`).getTime();
        const bTime = new Date(`${b.requestedAt}T00:00:00`).getTime();

        return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
      });
  }, [activeTab, dateFilter, quotes, search, sortOrder, statusFilter]);

  const handleSubmitQuote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const highestQuoteNumber = Math.max(
      ...quotes.map((quote) => Number(quote.quoteNumber.replace("XQ-", "")))
    );
    const quoteNumber = `XQ-${highestQuoteNumber + 1}`;
    const createdQuote: QuoteSummary = {
      id: quoteNumber.toLowerCase(),
      quoteNumber,
      requestedAt: new Date().toISOString().slice(0, 10),
      productCount: 1,
      previewCount: 1,
      source: quoteForm.source,
      branch: quoteForm.branch,
      status: "Pending Review",
      total: 0,
      tab: "active",
    };

    setQuotes((currentQuotes) => [createdQuote, ...currentQuotes]);
    setActiveTab("active");
    setSearch("");
    setStatusFilter("all");
    setQuoteForm(emptyQuoteForm);
    setIsModalOpen(false);
    setStatusMessage(accountT(t, "quotes.messages.requested", "Quote #{quoteNumber} has been requested.", { quoteNumber }));
  };

  const createQuoteFromExisting = (sourceQuote: QuoteSummary) => {
    const highestQuoteNumber = Math.max(
      ...quotes.map((quote) => Number(quote.quoteNumber.replace("XQ-", "")))
    );
    const quoteNumber = `XQ-${highestQuoteNumber + 1}`;
    const createdQuote: QuoteSummary = {
      id: quoteNumber.toLowerCase(),
      quoteNumber,
      requestedAt: new Date().toISOString().slice(0, 10),
      productCount: sourceQuote.productCount,
      previewCount: sourceQuote.previewCount,
      source: sourceQuote.source,
      previousOrder: sourceQuote.previousOrder,
      branch: sourceQuote.branch,
      status: "Pending Review",
      total: 0,
      tab: "active",
    };

    setQuotes((currentQuotes) => [createdQuote, ...currentQuotes]);
    setActiveTab("active");
    setStatusFilter("all");
    setDateFilter("all");
    setSearch("");
    setStatusMessage(accountT(t, "quotes.messages.requestedFrom", "Quote #{quoteNumber} requested from #{sourceQuoteNumber}.", { quoteNumber, sourceQuoteNumber: sourceQuote.quoteNumber }));
  };

  const handleQuoteSecondaryAction = (quote: QuoteSummary) => {
    if (quote.status === "Pending Review") {
      setStatusMessage(accountT(t, "quotes.messages.callingSales", "Calling sales about #{quoteNumber}.", { quoteNumber: quote.quoteNumber }));
      return;
    }

    if (quote.status === "Approved") {
      navigate(`/account/quotes/${quote.id}`);
      return;
    }

    createQuoteFromExisting(quote);
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
                  {accountT(t, "quotes.eyebrow", "Clinic Quotes")}
                </p>
                <h1 className="font-display text-[42px] font-bold leading-none text-[#050505] sm:text-[48px]">
                  {accountT(t, "quotes.title", "Quotes")}
                </h1>
                <p className="mt-4 max-w-[760px] text-[15px] leading-6 text-[#6A6A6A]">
                  {accountT(t, "quotes.description", "Review quote requests, bulk pricing, and special product offers from our sales team.")}
                </p>
              </div>

              <Button
                type="button"
                onClick={() => {
                  setStatusMessage(null);
                  setIsModalOpen(true);
                }}
                variant="primary"
                className="h-12 w-full gap-2 px-6 text-[14px] sm:w-auto"
              >
                <Plus size={17} />
                {accountT(t, "quotes.requestNewQuote", "Request New Quote")}
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

            {/* stat cards removed to reduce visual weight */}

            <AccountFilterToolbar className="mt-8 sm:grid-cols-3 xl:grid-cols-[minmax(0,1fr)_140px_170px_180px]">
              <label className={cn(accountFilterSearchClassName, "sm:col-span-3 xl:col-span-1")}>
                <span className="sr-only">{accountT(t, "quotes.searchLabel", "Search quotes")}</span>
                <Search
                  size={17}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8A8D9A]"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={accountT(t, "quotes.searchPlaceholder", "Search by quote number or product name")}
                  className={cn(toolbarControlClassName, "pl-11")}
                />
              </label>

              <SelectControl
                className={accountFilterControlClassName}
                label={accountT(t, "quotes.statusFilterLabel", "Filter quotes by status")}
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as StatusFilter)}
                options={[
                  { value: "all", label: accountValue(t, "All Status") },
                  { value: "Pending Review", label: accountValue(t, "Pending") },
                  { value: "Approved", label: accountValue(t, "Approved") },
                  { value: "Accepted", label: accountValue(t, "Accepted") },
                  { value: "Expired", label: accountValue(t, "Expired") },
                ]}
              />

              <SelectControl
                className={accountFilterControlClassName}
                label={accountT(t, "quotes.dateFilterLabel", "Filter quotes by date")}
                value={dateFilter}
                onChange={(value) => setDateFilter(value as DateFilter)}
                options={[
                  { value: "6m", label: accountValue(t, "Last 6 months") },
                  { value: "30d", label: accountValue(t, "Last 30 days") },
                  { value: "all", label: accountValue(t, "All time") },
                ]}
              />

              <SelectControl
                className={accountFilterControlClassName}
                label={accountT(t, "quotes.sortLabel", "Sort quotes")}
                value={sortOrder}
                onChange={(value) => setSortOrder(value as SortOrder)}
                options={[
                  { value: "newest", label: accountValue(t, "Newest First") },
                  { value: "oldest", label: accountT(t, "filters.oldestFirst", "Oldest First") },
                ]}
              />
            </AccountFilterToolbar>

            <div className="inline-flex max-w-full rounded-full border border-[var(--xd-gold-border-soft)] bg-white/65 p-1 shadow-[0_8px_24px_rgba(5,5,5,0.03)]">
              {[
                ["active", accountValue(t, "Active Quotes")],
                ["history", accountValue(t, "Quote History")],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setActiveTab(value as QuoteTab);
                    setStatusFilter("all");
                  }}
                  className={cn(
                    "rounded-full px-5 py-2 text-[13px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)]",
                    activeTab === value
                      ? "bg-[var(--xd-gold-active)] text-white shadow-[0_8px_20px_rgba(212,167,44,0.18)]"
                      : "text-[var(--xd-gold-text)] hover:bg-[var(--xd-gold-active)]/[0.08] hover:text-[#050505]"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {filteredQuotes.length > 0 ? (
                filteredQuotes.map((quote) => (
                  <QuoteCard
                    key={quote.id}
                    quote={quote}
                    onSecondaryAction={handleQuoteSecondaryAction}
                  />
                ))
              ) : (
                <Card className="p-10 text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-active)]">
                    <FileText size={24} />
                  </span>
                  <h2 className="mt-4 text-[18px] font-bold text-[#050505]">{accountT(t, "quotes.emptyTitle", "No quotes found")}</h2>
                  <p className="mx-auto mt-2 max-w-[420px] text-[14px] leading-6 text-[#8A8D9A]">
                    {accountT(t, "quotes.emptyDescription", "Adjust your filters or request a new quote for your clinic.")}
                  </p>
                </Card>
              )}
            </div>
          </main>
        </div>
      </Container>

      {isModalOpen && (
        <RequestQuoteModal
          form={quoteForm}
          onChange={setQuoteForm}
          onClose={() => {
            setIsModalOpen(false);
            setQuoteForm(emptyQuoteForm);
          }}
          onSubmit={handleSubmitQuote}
        />
      )}
    </div>
  );
}
