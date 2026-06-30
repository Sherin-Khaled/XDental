import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "wouter";
import {
  Check,
  Clock3,
  Download,
  FileText,
  Pencil,
  X,
} from "lucide-react";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { AccountSidebar } from "@/components/dental/AccountSidebar";
import { Button } from "@/components/dental/Button";
import { Container } from "@/components/dental/Container";
import { useLanguage } from "@/context/LanguageContext";
import { useStore } from "@/context/StoreContext";
import {
  getQuoteDetail,
  type QuoteDetail,
  type QuoteProduct,
  type QuoteProductStatus,
  type QuoteStatus,
  type QuoteStatusStep,
} from "@/data/quotes";
import { accountT, accountValue } from "@/lib/accountI18n";
import { cn } from "@/lib/utils";

function formatDate(date?: string) {
  if (!date) return "Pending";

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(date?: string) {
  if (!date) return "Pending";

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
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

function StatusPill({ status }: { status: QuoteStatus }) {
  const { t } = useLanguage();
  const classes: Record<QuoteStatus, string> = {
    "Pending Review": "bg-[var(--xd-gold-bg-soft)] text-[#A67800]",
    Approved: "bg-[#16803C]/10 text-[#16803C]",
    Accepted: "bg-[#16803C]/10 text-[#16803C]",
    Expired: "bg-[#050505]/10 text-[#6A6A6A]",
  };

  return (
    <span className={cn("inline-flex rounded-full px-3 py-1 text-[11px] font-bold", classes[status])}>
      {accountValue(t, status)}
    </span>
  );
}

function ExpiryPill({ date }: { date?: string }) {
  const { t } = useLanguage();
  if (!date) return null;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F9A825]/12 px-3 py-1 text-[11px] font-bold text-[#C57B00]">
      <Clock3 size={13} />
      {accountT(t, "quotes.expiresDate", "Expires {date}", { date: formatDate(date) })}
    </span>
  );
}

function ProductStatusPill({ status }: { status: QuoteProductStatus }) {
  const { t } = useLanguage();
  const classes: Record<QuoteProductStatus, string> = {
    Available: "bg-[#16803C]/10 text-[#16803C]",
    "Limited Stock": "bg-[#F9A825]/14 text-[#C57B00]",
    Backordered: "bg-[var(--xd-info-bg)] text-[var(--xd-info-text)]",
  };

  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold", classes[status])}>
      {accountValue(t, status)}
    </span>
  );
}

function SummaryRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-[12px]">
      <dt className="text-[#6A6A6A]">{label}</dt>
      <dd className={cn("max-w-[150px] text-right font-bold text-[#050505]", valueClassName)}>
        {value}
      </dd>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-[12px]">
      <dt className="text-[#6A6A6A]">{label}</dt>
      <dd className="max-w-[160px] text-right font-bold leading-5 text-[#050505]">{value}</dd>
    </div>
  );
}

function StatusStep({ step }: { step: QuoteStatusStep }) {
  const { t } = useLanguage();
  const isCurrent = step.status === "current";
  const isCompleted = step.status === "completed";

  return (
    <div className="relative z-10 flex min-w-0 items-center gap-3 md:flex-col md:text-center">
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-white",
          isCurrent
            ? "border-[var(--xd-gold-active)] bg-[var(--xd-gold-active)] text-white shadow-[0_8px_18px_var(--xd-gold-border-soft)]"
            : isCompleted
              ? "border-[var(--xd-gold-active)] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-active)]"
              : "border-[#050505]/12 bg-[var(--xd-bg)] text-[#9B9B9B]"
        )}
      >
        {isCompleted || isCurrent ? <Check size={17} /> : <Clock3 size={16} />}
      </span>
      <div className="min-w-0">
        <p
          className={cn(
            "text-[12px] font-bold leading-5",
            isCurrent ? "text-[var(--xd-gold-active)]" : isCompleted ? "text-[#050505]" : "text-[#6A6A6A]"
          )}
        >
          {accountValue(t, step.label)}
        </p>
        <p className={cn("text-[11px] font-medium", isCurrent ? "text-[var(--xd-gold-active)]" : "text-[#8A8D9A]")}>
          {step.date ? formatShortDate(step.date) : accountValue(t, step.note ?? "")}
        </p>
      </div>
    </div>
  );
}

function QuotedProductRow({ product }: { product: QuoteProduct }) {
  const { t } = useLanguage();

  return (
    <article className="grid gap-4 border-b border-[#050505]/[0.07] py-5 first:pt-0 last:border-b-0 last:pb-0 sm:grid-cols-[72px_minmax(0,1fr)]">
      <div className="h-[72px] w-[72px] rounded-[14px] border border-[#050505]/[0.05] bg-[#F3F2EF]" />

      <div className="min-w-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold leading-5 text-[#050505]">{product.name}</h3>
            <p className="mt-1 text-[12px] font-medium text-[#8A8D9A]">{product.supplier}</p>
            <p className="mt-1 text-[12px] font-medium text-[#8A8D9A]">{product.meta}</p>
          </div>
          <ProductStatusPill status={product.status} />
        </div>

        <div className="mt-5 grid gap-3 text-[11px] sm:grid-cols-[72px_92px_92px_minmax(86px,1fr)] sm:items-end">
          <div>
            <p className="font-medium text-[#8A8D9A]">{accountT(t, "quotes.requestedQty", "Requested Qty")}</p>
            <p className="mt-1 text-[14px] font-bold text-[#050505]">{product.requestedQty}</p>
          </div>
          <div>
            <p className="font-medium text-[#8A8D9A]">{accountT(t, "quotes.originalPrice", "Original Price")}</p>
            <p className="mt-1 font-bold text-[#8A8D9A] line-through">{formatCurrency(product.originalPrice)}</p>
          </div>
          <div>
            <p className="font-medium text-[#8A8D9A]">{accountT(t, "quotes.quotedPrice", "Quoted Price")}</p>
            <p className="mt-1 font-bold text-[var(--xd-gold-active)]">{formatCurrency(product.quotedPrice)}</p>
          </div>
          <div className="sm:text-right">
            <p className="font-medium text-[#8A8D9A]">{accountT(t, "quotes.lineTotal", "Line Total")}</p>
            <p className="mt-1 text-[16px] font-bold text-[#050505]">{formatCurrency(product.lineTotal)}</p>
            <p className="mt-0.5 text-[10px] font-bold text-[#16803C]">
              {accountT(t, "quotes.saveAmount", "Save {amount}", { amount: formatCurrency(product.savings) })}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

function QuoteSummaryCard({
  quote,
  status,
  onAccept,
  onRequestChanges,
  onDownload,
}: {
  quote: QuoteDetail;
  status: QuoteStatus;
  onAccept: () => void;
  onRequestChanges: () => void;
  onDownload: () => void;
}) {
  const { t } = useLanguage();

  return (
    <Card className="p-6">
      <h2 className="text-[17px] font-bold text-[#050505]">{accountT(t, "quotes.summaryTitle", "Quote Summary")}</h2>
      <dl className="mt-5 space-y-4">
        <SummaryRow label={accountT(t, "quotes.originalSubtotal", "Original Subtotal")} value={formatCurrency(quote.originalSubtotal)} />
        <SummaryRow
          label={accountT(t, "quotes.quoteDiscount", "Quote Discount")}
          value={`-${formatCurrency(quote.quoteDiscount)}`}
          valueClassName="text-[#16803C]"
        />
        <SummaryRow label={accountT(t, "quotes.quotedSubtotal", "Quoted Subtotal")} value={formatCurrency(quote.quotedSubtotal)} />
        <SummaryRow label={accountT(t, "quotes.shippingEstimate", "Shipping Estimate")} value={formatCurrency(quote.shippingEstimate)} />
        <SummaryRow label={accountT(t, "quotes.taxVat", "Tax / VAT")} value={accountValue(t, quote.taxNote)} valueClassName="text-[#6A6A6A]" />
      </dl>

      <div className="mt-6 flex items-end justify-between gap-4 border-t border-[#050505]/[0.07] pt-5">
        <div>
          <p className="text-[11px] font-bold text-[#16803C]">
            {accountT(t, "quotes.youSave", "You Save: {amount}", { amount: formatCurrency(quote.quoteDiscount) })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[12px] font-bold text-[#050505]">{accountT(t, "quotes.totalQuote", "Total Quote")}</p>
          <p className="font-display text-[22px] font-bold text-[#050505]">
            {formatCurrency(quote.total)}
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <Button
          type="button"
          onClick={onAccept}
          disabled={status === "Accepted" || status === "Expired"}
          variant="primary"
          className="h-12 w-full text-[14px]"
        >
          {status === "Accepted" ? accountT(t, "quotes.quoteAccepted", "Quote Accepted") : accountT(t, "quotes.acceptQuote", "Accept Quote")}
        </Button>
        <Button
          type="button"
          onClick={onRequestChanges}
          disabled={status === "Accepted" || status === "Expired"}
          variant="secondary"
          className="h-12 w-full text-[14px] text-[var(--xd-gold-active)]"
        >
          {accountT(t, "quotes.requestChanges", "Request Changes")}
        </Button>
        <button
          type="button"
          onClick={onDownload}
          className="mx-auto flex h-10 items-center justify-center gap-2 rounded-full px-4 text-[13px] font-bold text-[#717182] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
        >
          <Download size={15} />
          {accountT(t, "quotes.downloadQuote", "Download Quote")}
        </button>
      </div>
    </Card>
  );
}

function NotFoundState() {
  const { t } = useLanguage();

  return (
    <div className="bg-[var(--xd-bg)] pb-14 pt-10 lg:pb-20 lg:pt-14">
      <Container className="overflow-x-clip">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:gap-7">
          <AccountSidebar />
          <main className="min-w-0">
            <Link
              href="/account/quotes"
              className="mb-5 inline-flex h-10 items-center gap-2 rounded-full text-[13px] font-bold text-[#717182] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
            >
              <DirectionalIcon direction="back" size={16} />
              {accountT(t, "quotes.backToQuotes", "Back to Quotes")}
            </Link>
            <Card className="p-10 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-active)]">
                <FileText size={24} />
              </span>
              <h1 className="mt-4 text-[24px] font-bold text-[#050505]">{accountT(t, "quotes.notFoundTitle", "Quote not found")}</h1>
              <p className="mx-auto mt-2 max-w-[420px] text-[14px] leading-6 text-[#717182]">
                {accountT(t, "quotes.notFoundDescription", "This quote is not available in the current account data.")}
              </p>
            </Card>
          </main>
        </div>
      </Container>
    </div>
  );
}

export default function AccountQuoteDetail() {
  const { id } = useParams();
  const { currentUser } = useStore();
  const quote = currentUser
    ? getQuoteDetail(id, currentUser.id, Boolean(currentUser.isDemo))
    : undefined;
  const { t } = useLanguage();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isAccepted, setIsAccepted] = useState(false);
  const [isChangeFormOpen, setIsChangeFormOpen] = useState(false);
  const [changeDraft, setChangeDraft] = useState("");

  if (!quote) {
    return <NotFoundState />;
  }

  const displayStatus: QuoteStatus = isAccepted ? "Accepted" : quote.status;
  const statusSteps = isAccepted
    ? quote.statusSteps.map((step) =>
        step.label === "Accepted"
          ? { ...step, status: "current" as const, date: new Date().toISOString().slice(0, 10), note: undefined }
          : { ...step, status: step.status === "pending" ? ("completed" as const) : step.status }
      )
    : quote.statusSteps;

  const handleAcceptQuote = () => {
    setIsAccepted(true);
    setIsChangeFormOpen(false);
    setStatusMessage(accountT(t, "quotes.messages.accepted", "Quote {quoteNumber} has been accepted.", { quoteNumber: quote.quoteNumber }));
  };

  const handleDownloadQuote = () => {
    const lines = [
      `Quote ${quote.quoteNumber}`,
      `Requested: ${formatDate(quote.requestedAt)}`,
      `Branch: ${quote.branch}`,
      `Status: ${displayStatus}`,
      "",
      "Products:",
      ...quote.products.map(
        (product) =>
          `${product.name} - Qty ${product.requestedQty} - ${formatCurrency(product.lineTotal)}`
      ),
      "",
      `Total Quote: ${formatCurrency(quote.total)}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${quote.quoteNumber.toLowerCase()}-quote.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setStatusMessage(accountT(t, "quotes.messages.downloadStarted", "Quote {quoteNumber} download started.", { quoteNumber: quote.quoteNumber }));
  };

  const handleRequestChanges = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!changeDraft.trim()) return;

    setStatusMessage(accountT(t, "quotes.messages.changeRequestSent", "Change request sent for Quote {quoteNumber}.", { quoteNumber: quote.quoteNumber }));
    setChangeDraft("");
    setIsChangeFormOpen(false);
  };

  return (
    <div className="bg-[var(--xd-bg)] pb-14 pt-10 lg:pb-20 lg:pt-14">
      <Container className="overflow-x-clip">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:gap-7">
          <AccountSidebar />

          <main className="min-w-0 space-y-6">
            <Link
              href="/account/quotes"
              className="inline-flex h-10 items-center gap-2 rounded-full text-[13px] font-bold text-[#717182] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
            >
              <DirectionalIcon direction="back" size={16} />
              {accountT(t, "quotes.backToQuotes", "Back to Quotes")}
            </Link>

            <Card className="p-6 sm:p-8">
              <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <h1 className="font-display text-[30px] font-bold leading-tight text-[#050505] sm:text-[34px]">
                    {accountT(t, "quotes.quoteTitle", "Quote {quoteNumber}", { quoteNumber: quote.quoteNumber })}
                  </h1>
                  <p className="mt-3 text-[13px] font-medium text-[#6A6A6A]">
                    {accountT(t, "quotes.requestedMeta", "Requested on {date} - {count} products - {branch}", {
                      date: formatDate(quote.requestedAt),
                      count: quote.productCount,
                      branch: accountValue(t, quote.branch),
                    })}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <StatusPill status={displayStatus} />
                    <ExpiryPill date={quote.expiresAt} />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 md:justify-end">
                  <Button
                    type="button"
                    onClick={handleAcceptQuote}
                    disabled={displayStatus === "Accepted" || displayStatus === "Expired"}
                    variant="primary"
                    size="sm"
                    className="h-10 px-5 text-[13px]"
                  >
                    {displayStatus === "Accepted" ? accountValue(t, "Accepted") : accountT(t, "quotes.acceptQuote", "Accept Quote")}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setIsChangeFormOpen(true)}
                    disabled={displayStatus === "Accepted" || displayStatus === "Expired"}
                    variant="secondary"
                    size="sm"
                    className="h-10 px-5 text-[13px] text-[var(--xd-gold-active)]"
                  >
                    {accountT(t, "quotes.requestChanges", "Request Changes")}
                  </Button>
                  <button
                    type="button"
                    onClick={handleDownloadQuote}
                    className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-[13px] font-bold text-[#717182] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
                  >
                    <Download size={15} />
                    {accountT(t, "common.download", "Download")}
                  </button>
                </div>
              </div>
            </Card>

            {statusMessage && (
              <div
                role="status"
                className="rounded-[16px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-active)]/[0.08] px-4 py-3 text-[13px] font-semibold text-[#5F5F5F]"
              >
                {statusMessage}
              </div>
            )}

            {isChangeFormOpen && displayStatus !== "Accepted" && displayStatus !== "Expired" && (
              <Card className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-[17px] font-bold text-[#050505]">{accountT(t, "quotes.requestChanges", "Request Changes")}</h2>
                    <p className="mt-1 text-[13px] leading-5 text-[#6A6A6A]">
                      {accountT(t, "quotes.changeRequestDescription", "Tell the sales team what needs to change before you accept this quote.")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsChangeFormOpen(false)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#717182] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
                    aria-label={accountT(t, "quotes.closeChangeRequestForm", "Close change request form")}
                  >
                    <X size={17} />
                  </button>
                </div>
                <form onSubmit={handleRequestChanges} className="mt-4 space-y-3">
                  <textarea
                    value={changeDraft}
                    onChange={(event) => setChangeDraft(event.target.value)}
                    placeholder={accountT(t, "quotes.changeRequestPlaceholder", "Example: Please adjust quantity, delivery date, or replace an unavailable product.")}
                    className="min-h-[108px] w-full resize-none rounded-[14px] border border-[#050505]/10 bg-white px-4 py-3 text-[14px] text-[#050505] outline-none transition placeholder:text-[#B3B4BD] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10"
                  />
                  <div className="flex flex-wrap gap-3">
                    <Button type="submit" variant="primary" size="sm" className="h-10 px-5 text-[13px]" disabled={!changeDraft.trim()}>
                      {accountT(t, "quotes.sendRequest", "Send Request")}
                    </Button>
                    <button
                      type="button"
                      onClick={() => {
                        setChangeDraft("");
                        setIsChangeFormOpen(false);
                      }}
                      className="inline-flex h-10 items-center justify-center rounded-full px-4 text-[13px] font-bold text-[#717182] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
                    >
                      {accountT(t, "common.cancel", "Cancel")}
                    </button>
                  </div>
                </form>
              </Card>
            )}

            <Card className="p-6 sm:p-7">
              <h2 className="text-[18px] font-bold text-[#050505]">{accountT(t, "quotes.statusTitle", "Quote Status")}</h2>
              <p className="mt-2 text-[13px] leading-5 text-[#6A6A6A]">
                {displayStatus === "Accepted"
                  ? accountT(t, "quotes.acceptedStatusDescription", "This quote has been accepted and is ready for order processing.")
                  : accountT(t, "quotes.approvedStatusDescription", "This quote is approved and available until {date}.", { date: formatDate(quote.expiresAt) })}
              </p>
              <div className="relative mt-7">
                <div className="absolute left-[12.5%] right-[12.5%] top-5 hidden h-px bg-[#050505]/10 md:block" />
                <div className="grid gap-5 md:grid-cols-4">
                  {statusSteps.map((step) => (
                    <StatusStep key={step.label} step={step} />
                  ))}
                </div>
              </div>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,0.95fr)]">
              <div className="min-w-0 space-y-6">
                <Card className="p-6 sm:p-7">
                  <h2 className="text-[18px] font-bold text-[#050505]">{accountT(t, "quotes.quotedProducts", "Quoted Products")}</h2>
                  <p className="mt-2 text-[13px] leading-5 text-[#6A6A6A]">
                    {accountT(t, "quotes.quotedProductsDescription", "Review requested quantities, quoted prices, and product availability.")}
                  </p>
                  <div className="mt-7">
                    {quote.products.map((product) => (
                      <QuotedProductRow key={product.id} product={product} />
                    ))}
                  </div>
                </Card>

                <Card className="p-6 sm:p-7">
                  <h2 className="text-[17px] font-bold text-[#050505]">{accountT(t, "quotes.customerRequest", "Customer Request")}</h2>
                  <p className="mt-4 text-[13px] leading-6 text-[#050505]">{accountValue(t, quote.customerRequest)}</p>
                  <p className="mt-4 text-[12px] text-[#8A8D9A]">{accountT(t, "quotes.sourceValue", "Source: {source}", { source: accountValue(t, quote.requestSource) })}</p>
                </Card>

                <Card className="p-6 sm:p-7">
                  <h2 className="text-[17px] font-bold text-[#050505]">{accountT(t, "quotes.salesNotes", "Sales Notes")}</h2>
                  <p className="mt-4 text-[13px] leading-6 text-[#050505]">{accountValue(t, quote.salesNotes)}</p>
                  <p className="mt-4 text-[12px] text-[#8A8D9A]">{accountT(t, "quotes.preparedBy", "Quote prepared by: {name}", { name: accountValue(t, quote.preparedBy) })}</p>
                </Card>

                <Card className="p-6 sm:p-7">
                  <h2 className="text-[17px] font-bold text-[#050505]">{accountT(t, "quotes.activityTitle", "Quote Activity")}</h2>
                  <div className="mt-5 space-y-4">
                    {quote.activity.map((activity) => (
                      <div key={`${activity.title}-${activity.date}`} className="flex gap-3">
                        <span
                          className={cn(
                            "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                            activity.status === "pending" ? "bg-[#D9D9D9]" : "bg-[var(--xd-gold-active)]"
                          )}
                        />
                        <div>
                          <p className="text-[13px] font-semibold text-[#050505]">{accountValue(t, activity.title)}</p>
                          <p className="mt-0.5 text-[11px] text-[#6A6A6A]">{formatShortDate(activity.date)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              <aside className="min-w-0 space-y-6">
                <QuoteSummaryCard
                  quote={quote}
                  status={displayStatus}
                  onAccept={handleAcceptQuote}
                  onRequestChanges={() => setIsChangeFormOpen(true)}
                  onDownload={handleDownloadQuote}
                />

                <Card className="p-6">
                  <h2 className="text-[17px] font-bold text-[#050505]">{accountT(t, "quotes.detailsTitle", "Quote Details")}</h2>
                  <dl className="mt-5 space-y-4">
                    <DetailRow label={accountT(t, "quotes.quoteNumber", "Quote Number")} value={quote.quoteNumber} />
                    <DetailRow label={accountT(t, "quotes.requestedDateLabel", "Requested Date")} value={formatDate(quote.requestedAt)} />
                    <DetailRow label={accountT(t, "quotes.approvedDate", "Approved Date")} value={accountValue(t, formatDate(quote.approvedAt))} />
                    <DetailRow label={accountT(t, "quotes.expiryDate", "Expiry Date")} value={formatDate(quote.expiresAt)} />
                    <DetailRow label={accountT(t, "quotes.quoteSource", "Quote Source")} value={accountValue(t, quote.source)} />
                    <DetailRow label={accountT(t, "common.branch", "Branch")} value={accountValue(t, quote.branch)} />
                    <DetailRow label={accountT(t, "common.status", "Status")} value={accountValue(t, displayStatus)} />
                  </dl>
                </Card>

                <Card className="p-6">
                  <h2 className="text-[17px] font-bold text-[#050505]">{accountT(t, "quotes.contactBranch", "Contact & Branch")}</h2>
                  <div className="mt-5 space-y-2 text-[13px] leading-5">
                    <p className="font-bold text-[#050505]">{quote.contact.name}</p>
                    <p className="text-[#6A6A6A]">{quote.contact.phone}</p>
                    <p className="text-[#6A6A6A]">{quote.contact.email}</p>
                    <p className="pt-2 font-bold text-[#050505]">{quote.contact.branch}</p>
                    <p className="text-[#6A6A6A]">{quote.contact.address}</p>
                  </div>
                  <Link
                    href="/account/clinic-branches"
                    className="mt-4 text-[13px] font-bold text-[var(--xd-gold-active)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)]"
                  >
                    {accountT(t, "quotes.editBranchDetails", "Edit branch details")}
                  </Link>
                </Card>
              </aside>
            </div>
          </main>
        </div>
      </Container>
    </div>
  );
}
