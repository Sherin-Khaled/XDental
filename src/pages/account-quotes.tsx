import { useEffect, useMemo, useState, type FormEvent, type HTMLAttributes, type KeyboardEvent } from "react";
import { FileText, MessageSquareText, Package, Plus, Search, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { AccountSidebar } from "@/components/dental/AccountSidebar";
import { Button } from "@/components/dental/Button";
import { Container } from "@/components/dental/Container";
import { ProductAutocomplete } from "@/components/dental/ProductAutocomplete";
import { DentalSelect } from "@/components/dental/Select";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import { createQuote, getMyQuotes, type Quote, type QuoteStatus } from "@/services/quotes";
import type { Product } from "@/types/product";

const STATUS_OPTIONS: QuoteStatus[] = [
  "PENDING",
  "SUPPLIER_REVIEW",
  "DRAFT_RESPONSE",
  "SENT",
  "ACCEPTED",
  "REJECTED",
  "CANCELED",
];

function Card({ children, className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("rounded-[24px] border border-[var(--xd-gold-active)]/[0.14] bg-white/85 shadow-[0_14px_36px_rgba(5,5,5,0.04)]", className)} {...props}>{children}</section>;
}

function statusClasses(status: QuoteStatus) {
  if (status === "SENT" || status === "ACCEPTED") return "border-[#16803C]/20 bg-[#16803C]/10 text-[#16803C]";
  if (status === "REJECTED" || status === "CANCELED") return "border-[#B42318]/20 bg-[#B42318]/10 text-[#B42318]";
  return "border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-text)]";
}

function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const { t } = useLanguage();
  return <span className={cn("inline-flex rounded-full border px-3 py-1.5 text-[12px] font-bold", statusClasses(status))}>{t(`quoteWorkflow.statuses.${status.toLowerCase()}`)}</span>;
}

function formatDate(value: string, language: string) {
  return new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-EG", { dateStyle: "medium" }).format(new Date(value));
}

function RequestQuoteModal({ onClose, onCreated }: { onClose: () => void; onCreated: (quote: Quote) => void }) {
  const { t } = useLanguage();
  const [productName, setProductName] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [productError, setProductError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!productName.trim()) {
      setProductError(t("quoteWorkflow.productRequired"));
      return;
    }
    setIsSubmitting(true);
    setProductError(null);
    setError(null);
    try {
      const quote = await createQuote({
        notes: notes.trim() || undefined,
        items: [{
          productId: selectedProduct?.id,
          productName: productName.trim(),
          brand: selectedProduct?.brand,
          sku: selectedProduct?.sku ?? undefined,
          quantity,
          requestedPrice: selectedProduct?.currentPrice,
        }],
      });
      onCreated(quote);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t("quoteWorkflow.requestError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[#050505]/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-quote-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form onSubmit={submit} className="w-full max-w-[560px] rounded-[28px] border border-[var(--xd-gold-border-soft)] bg-white p-6 shadow-[0_24px_70px_rgba(5,5,5,0.18)] sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--xd-gold-active)]">{t("quoteWorkflow.quoteRequest")}</p>
            <h2 id="account-quote-title" className="mt-2 font-display text-[28px] font-bold text-[#050505]">{t("quoteWorkflow.requestQuote")}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-[#717182] hover:bg-[#FBFAF7]" aria-label={t("common.close", { fallback: "Close" })}><X size={18} /></button>
        </div>
        <div className="mt-6 space-y-4">
          <ProductAutocomplete
            id="account-quote-product"
            label={t("quoteWorkflow.productOrRequest")}
            value={productName}
            selectedProductId={selectedProduct?.id}
            error={productError ?? undefined}
            onValueChange={(value) => {
              setProductName(value);
              setSelectedProduct(null);
              setProductError(null);
            }}
            onSelect={(product, displayName) => {
              setProductName(displayName);
              setSelectedProduct(product);
              setProductError(null);
            }}
          />
          <label className="block"><span className="mb-2 block text-[13px] font-bold text-[#050505]">{t("common.quantity")}</span><input type="number" min={1} max={10000} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} className="h-12 w-full rounded-[12px] border border-[#050505]/10 px-4 text-[14px] outline-none focus:border-[var(--xd-gold-border-hover)]" /></label>
          <label className="block"><span className="mb-2 block text-[13px] font-bold text-[#050505]">{t("quoteWorkflow.customerMessage")}</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={4000} className="min-h-[112px] w-full resize-none rounded-[14px] border border-[#050505]/10 px-4 py-3 text-[14px] outline-none focus:border-[var(--xd-gold-border-hover)]" /></label>
          {error && <p role="alert" className="rounded-[12px] border border-[#B42318]/20 bg-[#B42318]/[0.06] px-4 py-3 text-[13px] font-semibold text-[#B42318]">{error}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-3"><Button type="button" variant="secondary" onClick={onClose}>{t("common.cancel")}</Button><Button type="submit" variant="primary" disabled={isSubmitting}>{isSubmitting ? t("quoteWorkflow.submitting") : t("quoteWorkflow.submitRequest")}</Button></div>
      </form>
    </div>
  );
}

export default function AccountQuotes() {
  const [, navigate] = useLocation();
  const { language, t } = useLanguage();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<QuoteStatus | "all">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const loadQuotes = () => {
    setIsLoading(true);
    setError(null);
    getMyQuotes().then(setQuotes).catch(() => setError(t("quoteWorkflow.loadError"))).finally(() => setIsLoading(false));
  };

  useEffect(() => { loadQuotes(); }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return quotes.filter((quote) => status === "all" || quote.status === status).filter((quote) => {
      if (!query) return true;
      return [quote.quoteNumber, quote.status, ...quote.items.map((item) => item.productName)].some((value) => value.toLowerCase().includes(query));
    });
  }, [quotes, search, status]);

  const openQuote = (quote: Quote) => navigate(`/account/quotes/${quote.id}`);
  const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>, quote: Quote) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openQuote(quote); }
  };

  return (
    <div className="bg-[var(--xd-bg)] pb-14 pt-10 lg:pb-20 lg:pt-14">
      <Container><div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:gap-7"><AccountSidebar />
        <main className="min-w-0 space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--xd-gold-active)]">{t("quoteWorkflow.quoteRequest")}</p><h1 className="mt-2 font-display text-[42px] font-bold text-[#050505]">{t("quoteWorkflow.myQuotes")}</h1><p className="mt-3 text-[15px] text-[#6A6A6A]">{t("quoteWorkflow.customerDescription")}</p></div><Button type="button" onClick={() => { setSuccess(null); setIsModalOpen(true); }} className="gap-2"><Plus size={17} />{t("quoteWorkflow.requestQuote")}</Button></div>
          {success && <div role="status" className="rounded-[14px] border border-[#16803C]/20 bg-[#16803C]/10 px-4 py-3 text-[13px] font-semibold text-[#16803C]">{success}</div>}
          {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-[14px] border border-[#B42318]/20 bg-[#B42318]/[0.06] px-4 py-3 text-[13px] font-semibold text-[#B42318]"><span>{error}</span><button type="button" onClick={loadQuotes} className="underline">{t("quoteWorkflow.retry")}</button></div>}
          <Card className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_220px]">
            <label className="flex h-12 items-center gap-2 rounded-full border border-[#050505]/10 bg-white px-4"><Search size={17} className="text-[#8A8D9A]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("quoteWorkflow.searchQuotes")} className="min-w-0 flex-1 bg-transparent text-[14px] outline-none" /></label>
            <DentalSelect label={t("quoteWorkflow.filterStatus")} value={status} onChange={(value) => setStatus(value as QuoteStatus | "all")} options={[{ value: "all", label: t("quoteWorkflow.allStatuses") }, ...STATUS_OPTIONS.map((value) => ({ value, label: t(`quoteWorkflow.statuses.${value.toLowerCase()}`) }))]} triggerClassName="h-12 rounded-full" />
          </Card>
          <div className="space-y-4">
            {filtered.map((quote) => (
              <Card key={quote.id} className="cursor-pointer p-5 transition hover:-translate-y-px hover:border-[var(--xd-gold-border)] sm:p-6" role="link" tabIndex={0} onClick={() => openQuote(quote)} onKeyDown={(event) => handleCardKeyDown(event, quote)}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-active)]"><Package size={19} /></span><div><h2 className="text-[18px] font-bold text-[#050505]">{quote.quoteNumber}</h2><p className="mt-1 text-[12px] text-[#8A8D9A]">{formatDate(quote.createdAt, language)}</p></div></div><p className="mt-4 line-clamp-2 text-[14px] font-semibold text-[#5F5F5F]">{quote.items.map((item) => item.productName).join(", ")}</p><p className="mt-2 text-[13px] text-[#8A8D9A]">{t("quoteWorkflow.itemSummary", { values: { count: quote.itemCount, quantity: quote.totalQuantity } })}</p></div><div className="flex shrink-0 flex-col items-start gap-3 sm:items-end"><QuoteStatusBadge status={quote.status} />{quote.quotedPrice !== null && <p className="font-display text-[20px] font-bold text-[var(--xd-gold-active)]">{t("quoteWorkflow.priceValue", { values: { price: quote.quotedPrice.toLocaleString() } })}</p>}{quote.supportThreadId && <Link href={`/account/support?thread=${quote.supportThreadId}`} onClick={(event) => event.stopPropagation()} className="inline-flex items-center gap-2 text-[13px] font-bold text-[var(--xd-gold-active)] hover:underline"><MessageSquareText size={15} />{t("quoteWorkflow.openSupportChat")}</Link>}</div></div>
              </Card>
            ))}
            {isLoading && <Card className="p-10 text-center text-[14px] text-[#717182]">{t("quoteWorkflow.loading")}</Card>}
            {!isLoading && !error && filtered.length === 0 && <Card className="p-10 text-center"><FileText size={28} className="mx-auto text-[var(--xd-gold-active)]" /><h2 className="mt-4 text-[18px] font-bold">{t("quoteWorkflow.noQuotes")}</h2></Card>}
          </div>
        </main>
      </div></Container>
      {isModalOpen && <RequestQuoteModal onClose={() => setIsModalOpen(false)} onCreated={(quote) => { setQuotes((current) => [quote, ...current]); setIsModalOpen(false); setSuccess(t("quoteWorkflow.requestSubmitted", { values: { quoteNumber: quote.quoteNumber } })); }} />}
    </div>
  );
}
