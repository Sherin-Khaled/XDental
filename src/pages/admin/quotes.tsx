import { useEffect, useMemo, useState } from "react";
import { FileText, MessageSquareText, Package, RefreshCw, Search, X } from "lucide-react";
import { Link, useSearch } from "wouter";
import { DentalSelect } from "@/components/dental/Select";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import {
  getAdminQuote,
  getAdminQuotes,
  respondToAdminQuote,
  updateAdminQuoteStatus,
  type Quote,
  type QuoteStatus,
} from "@/services/quotes";
import { AdminLayout } from "./_components/AdminLayout";
import { AdminPageHeader, AdminStatusBadge, AdminTableShell } from "./_components/admin-ui";
import type { StatusTone } from "./admin-data";
import type { EmailDeliveryStatus } from "@/services/emailDeliveries";

const STATUSES: QuoteStatus[] = ["PENDING", "SUPPLIER_REVIEW", "DRAFT_RESPONSE", "SENT", "ACCEPTED", "REJECTED", "CANCELED"];
const STATUS_TONES: Record<QuoteStatus, StatusTone> = {
  PENDING: "amber",
  SUPPLIER_REVIEW: "amber",
  DRAFT_RESPONSE: "slate",
  SENT: "green",
  ACCEPTED: "green",
  REJECTED: "red",
  CANCELED: "red",
};

function QuoteBadge({ status }: { status: QuoteStatus }) {
  const { t } = useLanguage();
  return <AdminStatusBadge tone={STATUS_TONES[status]}>{t(`quoteWorkflow.statuses.${status.toLowerCase()}`)}</AdminStatusBadge>;
}

function EmailBadge({ status }: { status: EmailDeliveryStatus }) {
  const tone =
    status === "SENT" ? "green" : status === "FAILED" ? "red" : status === "PENDING" ? "amber" : "slate";
  return <AdminStatusBadge tone={tone}>{status}</AdminStatusBadge>;
}

function formatDate(value: string, language: string) {
  return new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function QuoteDetailDrawer({
  quote,
  isLoading,
  error,
  onClose,
  onUpdated,
}: {
  quote: Quote | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onUpdated: (quote: Quote) => void;
}) {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [response, setResponse] = useState("");
  const [quotedPrice, setQuotedPrice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setResponse(quote?.adminResponse ?? "");
    setQuotedPrice(quote?.quotedPrice === null || quote?.quotedPrice === undefined ? "" : String(quote.quotedPrice));
    setActionError(null);
  }, [quote?.id, quote?.adminResponse, quote?.quotedPrice]);

  const saveResponse = async (status: "DRAFT_RESPONSE" | "SENT") => {
    if (!quote || !response.trim()) {
      setActionError(t("quoteWorkflow.responseRequired"));
      return;
    }
    setIsSaving(true);
    setActionError(null);
    try {
      const updated = await respondToAdminQuote(quote.id, {
        adminResponse: response.trim(),
        ...(quotedPrice.trim() ? { quotedPrice: Number(quotedPrice) } : {}),
        status,
      });
      onUpdated(updated);
      toast({ title: status === "SENT" ? t("quoteWorkflow.responseSent") : t("quoteWorkflow.draftSaved") });
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : t("quoteWorkflow.updateError"));
    } finally {
      setIsSaving(false);
    }
  };

  const changeStatus = async (status: QuoteStatus) => {
    if (!quote) return;
    setIsSaving(true);
    setActionError(null);
    try {
      const updated = await updateAdminQuoteStatus(quote.id, status);
      onUpdated(updated);
      toast({ title: t("quoteWorkflow.statusUpdated") });
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : t("quoteWorkflow.updateError"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#050505]/35" role="dialog" aria-modal="true" aria-label={t("quoteWorkflow.quoteDetails")}>
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label={t("common.close", { fallback: "Close" })} />
      <section className="relative z-10 h-full w-full max-w-2xl overflow-y-auto border-l border-[#EFE2BC] bg-[#FBFAF7] p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#D4A72C]">{t("quoteWorkflow.adminReview")}</p><h2 className="mt-2 text-2xl font-bold text-[#050505]">{quote?.quoteNumber ?? t("quoteWorkflow.quoteDetails")}</h2></div><button type="button" onClick={onClose} className="rounded-lg border border-[#EFE2BC] bg-white p-2 text-[#717182] hover:bg-[#FFF7D6]" aria-label={t("common.close", { fallback: "Close" })}><X size={18} /></button></div>
        {isLoading && <p className="mt-8 text-sm font-semibold text-[#717182]">{t("quoteWorkflow.loadingDetails")}</p>}
        {error && <div role="alert" className="mt-6 rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] p-4 text-sm font-semibold text-[#B42318]">{error}</div>}
        {quote && <div className="mt-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#EFE2BC] bg-white p-4"><div className="flex items-center gap-2"><QuoteBadge status={quote.status} />{quote.emailDelivery && <EmailBadge status={quote.emailDelivery.status} />}</div><p className="text-sm text-[#717182]">{formatDate(quote.createdAt, language)}</p></div>
          <section className="rounded-lg border border-[#EFE2BC] bg-white p-4"><h3 className="font-bold text-[#050505]">{t("quoteWorkflow.customer")}</h3><div className="mt-3 space-y-1 text-sm text-[#717182]"><p className="font-semibold text-[#050505]">{quote.customer.name}</p><p>{quote.customer.email}</p><p>{quote.customer.phone || t("quoteWorkflow.notProvided")}</p></div></section>
          <section className="rounded-lg border border-[#EFE2BC] bg-white p-4"><h3 className="flex items-center gap-2 font-bold text-[#050505]"><Package size={17} className="text-[#D4A72C]" />{t("quoteWorkflow.requestedItems")}</h3><div className="mt-3 divide-y divide-[#F3E8C8]">{quote.items.map((item) => <div key={item.id} className="py-3 first:pt-0 last:pb-0"><div className="flex justify-between gap-3"><p className="font-semibold text-[#050505]">{item.productName}</p><p className="shrink-0 text-sm text-[#717182]">{t("quoteWorkflow.quantityValue", { values: { quantity: item.quantity } })}</p></div>{item.selectedOptions && <p className="mt-1 text-xs text-[#717182]">{item.selectedOptions}</p>}{item.sku && <p className="mt-1 text-xs text-[#8A8D9A]">{item.sku}</p>}</div>)}</div></section>
          <section className="rounded-lg border border-[#EFE2BC] bg-white p-4"><h3 className="font-bold text-[#050505]">{t("quoteWorkflow.customerMessage")}</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#717182]">{quote.notes || t("quoteWorkflow.notProvided")}</p></section>
          {quote.supportThreadId && <Link href={`/admin/support?thread=${quote.supportThreadId}`} className="flex items-center justify-between rounded-lg border border-[#EFE2BC] bg-white p-4 text-sm font-bold text-[#050505] hover:bg-[#FFF9E8]"><span className="flex items-center gap-2"><MessageSquareText size={17} className="text-[#D4A72C]" />{t("quoteWorkflow.openSupportChat")}</span><span className="text-xs text-[#717182]">{quote.supportThread?.ticketNumber}</span></Link>}
          <form onSubmit={(event) => { event.preventDefault(); void saveResponse("SENT"); }} className="rounded-lg border border-[#EFE2BC] bg-white p-4"><h3 className="font-bold text-[#050505]">{t("quoteWorkflow.adminResponse")}</h3><label className="mt-4 block"><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#717182]">{t("quoteWorkflow.responseMessage")}</span><textarea value={response} onChange={(event) => setResponse(event.target.value)} maxLength={4000} className="min-h-[130px] w-full resize-none rounded-lg border border-[#050505]/10 px-3 py-3 text-sm outline-none focus:border-[#D4A72C] focus:ring-4 focus:ring-[#D4A72C]/10" /></label><label className="mt-4 block"><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#717182]">{t("quoteWorkflow.quotedPrice")}</span><input type="number" min={0} step="0.01" value={quotedPrice} onChange={(event) => setQuotedPrice(event.target.value)} className="h-11 w-full rounded-lg border border-[#050505]/10 px-3 text-sm outline-none focus:border-[#D4A72C]" /></label>{actionError && <p role="alert" className="mt-3 rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] p-3 text-sm font-semibold text-[#B42318]">{actionError}</p>}<div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={isSaving} onClick={() => void saveResponse("DRAFT_RESPONSE")} className="h-10 rounded-lg border border-[#EFE2BC] bg-white px-4 text-sm font-bold text-[#050505] hover:bg-[#FFF9E8] disabled:opacity-60">{t("quoteWorkflow.saveDraftResponse")}</button><button type="submit" disabled={isSaving} className="h-10 rounded-lg bg-[#F9DC5C] px-4 text-sm font-bold text-[#050505] hover:bg-[#D4A72C] disabled:opacity-60">{t("quoteWorkflow.sendQuoteResponse")}</button></div></form>
          <section className="rounded-lg border border-[#EFE2BC] bg-white p-4"><h3 className="font-bold text-[#050505]">{t("quoteWorkflow.statusActions")}</h3><div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={isSaving} onClick={() => void changeStatus("SUPPLIER_REVIEW")} className="h-9 rounded-lg border border-[#F9DC5C]/70 bg-[#FFF7D6] px-3 text-xs font-bold text-[#B88A44]">{t("quoteWorkflow.supplierReview")}</button><button type="button" disabled={isSaving} onClick={() => void changeStatus("REJECTED")} className="h-9 rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] px-3 text-xs font-bold text-[#B42318]">{t("quoteWorkflow.statuses.rejected")}</button><button type="button" disabled={isSaving} onClick={() => void changeStatus("CANCELED")} className="h-9 rounded-lg border border-[#F2C8C8] bg-white px-3 text-xs font-bold text-[#B42318]">{t("quoteWorkflow.statuses.canceled")}</button></div></section>
        </div>}
      </section>
    </div>
  );
}

export default function AdminQuotes() {
  const queryString = useSearch();
  const { t, language } = useLanguage();
  const query = useMemo(() => new URLSearchParams(queryString), [queryString]);
  const initialSearch = query.get("search") ?? "";
  const requestedQuoteId = query.get("quote");
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState<QuoteStatus | "all">("all");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => { setSearch(initialSearch); }, [initialSearch]);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      setIsLoading(true); setLoadError(null);
      getAdminQuotes({ search, status: status === "all" ? undefined : status }).then((items) => {
        if (!active) return;
        setQuotes(items);
        if (requestedQuoteId && items.some((item) => item.id === requestedQuoteId)) setSelectedId(requestedQuoteId);
      }).catch(() => active && setLoadError(t("quoteWorkflow.loadError"))).finally(() => active && setIsLoading(false));
    }, 250);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [refreshVersion, requestedQuoteId, search, status, t]);

  useEffect(() => {
    if (!selectedId) { setSelectedQuote(null); return; }
    let active = true; setDetailLoading(true); setDetailError(null);
    getAdminQuote(selectedId).then((item) => active && setSelectedQuote(item)).catch(() => active && setDetailError(t("quoteWorkflow.detailLoadError"))).finally(() => active && setDetailLoading(false));
    return () => { active = false; };
  }, [selectedId, t]);

  const applyUpdated = (updated: Quote) => {
    const next = {
      ...updated,
      emailDelivery: updated.emailDelivery ?? selectedQuote?.emailDelivery ?? null,
    };
    setSelectedQuote(next);
    setQuotes((current) =>
      current.map((quote) =>
        quote.id === updated.id
          ? { ...next, emailDelivery: next.emailDelivery ?? quote.emailDelivery ?? null }
          : quote
      )
    );
  };

  return <AdminLayout><div className="space-y-6">
    <AdminPageHeader title={t("quoteWorkflow.quotes")} description={t("quoteWorkflow.adminDescription")} />
    <section className="grid gap-3 rounded-lg border border-[#EFE2BC] bg-white p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-end"><label><span className="text-xs font-bold uppercase tracking-wide text-[#717182]">{t("quoteWorkflow.searchQuotes")}</span><span className="mt-2 flex h-11 items-center gap-2 rounded-lg border border-[#050505]/10 bg-[#FBFAF7] px-3"><Search size={16} className="text-[#D4A72C]" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></span></label><div><span className="text-xs font-bold uppercase tracking-wide text-[#717182]">{t("quoteWorkflow.filterStatus")}</span><DentalSelect label={t("quoteWorkflow.filterStatus")} value={status} onChange={(value) => setStatus(value as QuoteStatus | "all")} options={[{ value: "all", label: t("quoteWorkflow.allStatuses") }, ...STATUSES.map((value) => ({ value, label: t(`quoteWorkflow.statuses.${value.toLowerCase()}`) }))]} triggerClassName="mt-2 h-11 rounded-lg bg-[#FBFAF7]" /></div><button type="button" onClick={() => setRefreshVersion((value) => value + 1)} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#EFE2BC] px-4 text-sm font-semibold text-[#717182] hover:bg-[#FFF9E8]"><RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />{t("quoteWorkflow.refresh")}</button></section>
    {loadError && <div role="alert" className="rounded-lg border border-[#F2C8C8] bg-[#FFF3F3] p-4 text-sm font-semibold text-[#B42318]">{loadError}</div>}
    <AdminTableShell><table className="min-w-full divide-y divide-[#EFE2BC] text-sm"><thead className="bg-[#FFF9E8] text-xs uppercase tracking-wide text-[#717182]"><tr><th className="px-5 py-3 text-start font-bold">{t("quoteWorkflow.quote")}</th><th className="px-5 py-3 text-start font-bold">{t("quoteWorkflow.customer")}</th><th className="px-5 py-3 text-start font-bold">{t("quoteWorkflow.products")}</th><th className="px-5 py-3 text-start font-bold">{t("quoteWorkflow.owner")}</th><th className="px-5 py-3 text-start font-bold">{t("quoteWorkflow.date")}</th><th className="px-5 py-3 text-start font-bold">{t("quoteWorkflow.status")}</th></tr></thead><tbody className="divide-y divide-[#F3E8C8]">{quotes.map((quote) => <tr key={quote.id} onClick={() => setSelectedId(quote.id)} className="cursor-pointer hover:bg-[#FBFAF7]" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(quote.id); } }}><td className="px-5 py-4 font-semibold text-[#050505]">{quote.quoteNumber}</td><td className="px-5 py-4"><p className="font-semibold text-[#050505]">{quote.customer.name}</p><p className="mt-1 text-xs text-[#717182]">{quote.customer.email}</p></td><td className="px-5 py-4 text-[#717182]">{quote.items.map((item) => item.productName).join(", ")}</td><td className="px-5 py-4 text-[#717182]">{t("quoteWorkflow.supportTeam")}</td><td className="whitespace-nowrap px-5 py-4 text-[#717182]">{formatDate(quote.createdAt, language)}</td><td className="px-5 py-4"><QuoteBadge status={quote.status} /></td></tr>)}{isLoading && quotes.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-[#717182]">{t("quoteWorkflow.loading")}</td></tr>}{!isLoading && !loadError && quotes.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center"><FileText size={28} className="mx-auto text-[#D4A72C]" /><p className="mt-3 font-medium text-[#717182]">{t("quoteWorkflow.noQuotes")}</p></td></tr>}</tbody></table></AdminTableShell>
  </div>{selectedId && <QuoteDetailDrawer quote={selectedQuote} isLoading={detailLoading} error={detailError} onClose={() => setSelectedId(null)} onUpdated={applyUpdated} />}</AdminLayout>;
}
