import { useEffect, useState, type ReactNode } from "react";
import { FileText, MessageSquareText, Package } from "lucide-react";
import { Link, useParams } from "wouter";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { AccountSidebar } from "@/components/dental/AccountSidebar";
import { Button } from "@/components/dental/Button";
import { Container } from "@/components/dental/Container";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import { getMyQuote, type Quote, type QuoteStatus } from "@/services/quotes";

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-[24px] border border-[var(--xd-gold-active)]/[0.14] bg-white/85 p-6 shadow-[0_14px_36px_rgba(5,5,5,0.04)] sm:p-7", className)}>{children}</section>;
}

function statusClasses(status: QuoteStatus) {
  if (status === "SENT" || status === "ACCEPTED") return "border-[#16803C]/20 bg-[#16803C]/10 text-[#16803C]";
  if (status === "REJECTED" || status === "CANCELED") return "border-[#B42318]/20 bg-[#B42318]/10 text-[#B42318]";
  return "border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-text)]";
}

export default function AccountQuoteDetail() {
  const { id } = useParams();
  const { language, t } = useLanguage();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQuote = () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    getMyQuote(id).then(setQuote).catch(() => setError(t("quoteWorkflow.detailLoadError"))).finally(() => setIsLoading(false));
  };

  useEffect(() => { loadQuote(); }, [id]);

  const date = (value: string) => new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

  return (
    <div className="bg-[var(--xd-bg)] pb-14 pt-10 lg:pb-20 lg:pt-14">
      <Container><div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:gap-7"><AccountSidebar />
        <main className="min-w-0 space-y-6">
          <Link href="/account/quotes" className="inline-flex items-center gap-2 text-[13px] font-bold text-[#717182] hover:text-[#050505]"><DirectionalIcon direction="back" size={16} />{t("quoteWorkflow.backToQuotes")}</Link>
          {isLoading && <Card className="text-center text-[14px] text-[#717182]">{t("quoteWorkflow.loadingDetails")}</Card>}
          {error && <Card className="text-center"><p role="alert" className="text-[14px] font-semibold text-[#B42318]">{error}</p><Button type="button" onClick={loadQuote} className="mt-4">{t("quoteWorkflow.retry")}</Button></Card>}
          {quote && (
            <>
              <Card>
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--xd-gold-active)]">{t("quoteWorkflow.quoteDetails")}</p><h1 className="mt-2 font-display text-[34px] font-bold text-[#050505]">{quote.quoteNumber}</h1><p className="mt-2 text-[13px] text-[#717182]">{date(quote.createdAt)}</p></div><div className="flex flex-col items-start gap-3 sm:items-end"><span className={cn("inline-flex rounded-full border px-3 py-1.5 text-[12px] font-bold", statusClasses(quote.status))}>{t(`quoteWorkflow.statuses.${quote.status.toLowerCase()}`)}</span>{quote.supportThreadId && <Button asChild variant="secondary" size="sm"><Link href={`/account/support?thread=${quote.supportThreadId}`} className="gap-2"><MessageSquareText size={15} />{t("quoteWorkflow.openSupportChat")}</Link></Button>}</div></div>
              </Card>
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.8fr)]">
                <div className="space-y-6">
                  <Card><h2 className="text-[18px] font-bold text-[#050505]">{t("quoteWorkflow.requestedItems")}</h2><div className="mt-5 divide-y divide-[#050505]/[0.07]">{quote.items.map((item) => <div key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-active)]"><Package size={18} /></span><div className="min-w-0 flex-1"><p className="font-bold text-[#050505]">{item.productName}</p><p className="mt-1 text-[13px] text-[#717182]">{t("quoteWorkflow.quantityValue", { values: { quantity: item.quantity } })}{item.selectedOptions ? ` · ${item.selectedOptions}` : ""}</p>{item.sku && <p className="mt-1 text-[12px] text-[#8A8D9A]">{item.sku}</p>}</div></div>)}</div></Card>
                  <Card><h2 className="text-[18px] font-bold text-[#050505]">{t("quoteWorkflow.customerMessage")}</h2><p className="mt-4 whitespace-pre-wrap text-[14px] leading-6 text-[#5F5F5F]">{quote.notes || t("quoteWorkflow.notProvided")}</p></Card>
                  <Card className={quote.adminResponse ? "border-[#16803C]/25" : undefined}><h2 className="text-[18px] font-bold text-[#050505]">{t("quoteWorkflow.adminResponse")}</h2>{quote.adminResponse ? <><p className="mt-4 whitespace-pre-wrap text-[14px] leading-6 text-[#5F5F5F]">{quote.adminResponse}</p>{quote.respondedAt && <p className="mt-4 text-[12px] text-[#8A8D9A]">{date(quote.respondedAt)}</p>}</> : <p className="mt-4 text-[14px] text-[#8A8D9A]">{t("quoteWorkflow.awaitingResponse")}</p>}</Card>
                </div>
                <aside className="space-y-6"><Card><h2 className="text-[18px] font-bold text-[#050505]">{t("quoteWorkflow.summary")}</h2><dl className="mt-5 space-y-4 text-[14px]"><div className="flex justify-between gap-4"><dt className="text-[#717182]">{t("quoteWorkflow.items")}</dt><dd className="font-bold text-[#050505]">{quote.itemCount}</dd></div><div className="flex justify-between gap-4"><dt className="text-[#717182]">{t("quoteWorkflow.totalQuantity")}</dt><dd className="font-bold text-[#050505]">{quote.totalQuantity}</dd></div><div className="flex justify-between gap-4 border-t border-[#050505]/[0.07] pt-4"><dt className="font-bold text-[#050505]">{t("quoteWorkflow.quotedPrice")}</dt><dd className="font-display text-[20px] font-bold text-[var(--xd-gold-active)]">{quote.quotedPrice === null ? t("quoteWorkflow.pending") : t("quoteWorkflow.priceValue", { values: { price: quote.quotedPrice.toLocaleString() } })}</dd></div></dl></Card>{quote.supportThread && <Card><div className="flex items-center gap-3"><MessageSquareText size={20} className="text-[var(--xd-gold-active)]" /><div><h2 className="font-bold text-[#050505]">{t("quoteWorkflow.linkedDiscussion")}</h2><p className="mt-1 text-[12px] text-[#8A8D9A]">{quote.supportThread.ticketNumber}</p></div></div><Button asChild className="mt-5 w-full"><Link href={`/account/support?thread=${quote.supportThreadId}`}>{t("quoteWorkflow.openSupportChat")}</Link></Button></Card>}</aside>
              </div>
            </>
          )}
          {!isLoading && !error && !quote && <Card className="text-center"><FileText size={28} className="mx-auto text-[var(--xd-gold-active)]" /><h1 className="mt-4 text-[20px] font-bold">{t("quoteWorkflow.notFound")}</h1></Card>}
        </main>
      </div></Container>
    </div>
  );
}
