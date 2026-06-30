import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "wouter";
import {
  Eye,
  FileText,
  Headphones,
  PackageSearch,
  Phone,
  Plus,
  Search,
  ShoppingCart,
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
  type ProductRequest,
  type ProductRequestStatus,
} from "@/data/productRequests";
import { accountT, accountValue } from "@/lib/accountI18n";
import { cn } from "@/lib/utils";
import { createProductRequest, getMyProductRequests } from "@/services/productRequests";
import { toProductRequest } from "@/lib/productRequestAdapter";

type RequestTab = "active" | "history";
type StatusFilter = "all" | ProductRequestStatus;
type DateFilter = "30d" | "6m" | "all";
type SortOrder = "newest" | "oldest";

type NewProductRequestForm = {
  productName: string;
  brand: string;
  category: string;
  quantity: string;
  branch: string;
  notes: string;
};

const emptyProductRequest: NewProductRequestForm = {
  productName: "",
  brand: "",
  category: "Endodontics",
  quantity: "",
  branch: "Main Clinic",
  notes: "",
};

const inputClassName =
  "h-12 w-full rounded-[12px] border border-[#050505]/10 bg-white px-4 text-[14px] text-[#050505] outline-none transition placeholder:text-[#B3B4BD] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10";
const toolbarControlClassName =
  "h-12 w-full rounded-full border border-[#050505]/10 bg-white px-4 text-[14px] text-[#050505] outline-none transition placeholder:text-[#B3B4BD] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10";

function formatRequestDate(date: string) {
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

function StatusPill({ status }: { status: ProductRequestStatus }) {
  const { t } = useLanguage();
  const classes: Record<ProductRequestStatus, string> = {
    "Under Review": "bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-text)]",
    Available: "bg-[#16803C]/10 text-[#16803C]",
    "Searching Supplier": "bg-[var(--xd-info-bg)] text-[var(--xd-info-text)]",
    "Not Available": "bg-[#F44336]/10 text-[#F44336]",
    Canceled: "bg-[#050505]/10 text-[#6A6A6A]",
  };

  return (
    <span className={cn("rounded-full px-3 py-1 text-[11px] font-bold", classes[status])}>
      {accountValue(t, status)}
    </span>
  );
}

function ProductThumb({ request }: { request: ProductRequest }) {
  const [hasImageError, setHasImageError] = useState(false);
  const image = request.product?.image;

  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[15px] border border-[var(--xd-gold-active)]/[0.14] bg-[var(--xd-gold)]/[0.06] text-[var(--xd-gold-active)] sm:h-16 sm:w-16">
      {image && !hasImageError ? (
        <img
          src={image}
          alt={request.productName}
          width={2525}
          height={2582}
          loading="lazy"
          decoding="async"
          onError={() => setHasImageError(true)}
          className="h-full w-full object-contain p-2"
        />
      ) : (
        <PackageSearch size={24} strokeWidth={1.7} />
      )}
    </div>
  );
}

function RequestMeta({ request }: { request: ProductRequest }) {
  const { t } = useLanguage();
  const metaItems = [
    [accountT(t, "common.brand", "Brand"), request.brand],
    [accountT(t, "common.category", "Category"), accountValue(t, request.category)],
    [accountT(t, "common.qty", "Qty"), request.quantity],
    [accountT(t, "common.branch", "Branch"), accountValue(t, request.branch)],
  ];

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] leading-6 text-[#717182]">
      {metaItems.map(([label, value], index) => (
        <span key={label} className="inline-flex items-center gap-2">
          {index > 0 && <span className="text-[#C8C4B8]">·</span>}
          <span>
            <span className="font-semibold text-[#6A6A6A]">{label}: </span>
            <span>{value}</span>
          </span>
        </span>
      ))}
    </div>
  );
}

function RequestCard({
  request,
  onContactSupport,
  onAddToCart,
}: {
  request: ProductRequest;
  onContactSupport: () => void;
  onAddToCart: () => void;
}) {
  const { t } = useLanguage();

  return (
    <Card className="p-[22px] sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-[16px] font-bold text-[#050505]">
            {accountT(t, "productRequests.requestTitle", "Request {requestNumber}", { requestNumber: request.requestNumber })}
          </h2>
          <p className="mt-1 text-[12px] font-medium text-[#8A8D9A]">
            {formatRequestDate(request.createdAt)}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <StatusPill status={request.status} />
          {request.price && (
            <p className="text-[18px] font-bold text-[var(--xd-gold-active)]">
              EGP {request.price.toLocaleString()}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
        <ProductThumb request={request} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] font-bold leading-6 text-[#050505]">
            {request.productName}
          </h3>
          <RequestMeta request={request} />

          <div className="mt-3 inline-flex max-w-fit rounded-[13px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-active)]/[0.08] px-3.5 py-2.5 text-[13px] font-semibold leading-5 text-[#3A2600]">
            {accountValue(t, request.update)}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {request.status === "Available" ? (
          <>
            <Button
              type="button"
              onClick={onAddToCart}
              variant="primary"
              size="sm"
              className="h-10 gap-2 px-5 text-[13px]"
            >
              <ShoppingCart size={15} />
              {accountT(t, "common.addToCart", "Add to Cart")}
            </Button>
            <Button
              asChild
              variant="secondary"
              size="sm"
              className="h-10 gap-2 px-5 text-[13px] text-[var(--xd-gold-text)]"
            >
              <Link href="/products">
                <Eye size={15} />
                {accountT(t, "productRequests.viewProduct", "View Product")}
              </Link>
            </Button>
          </>
        ) : (
          <>
            <Button
              asChild
              variant="primary"
              size="sm"
              className="h-10 px-5 text-[13px]"
            >
              <Link href={`/account/product-requests/${request.id}`}>{accountT(t, "common.viewDetails", "View Details")}</Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              size="sm"
              className="h-10 gap-2 px-5 text-[13px] text-[var(--xd-gold-text)]"
            >
              <a href="tel:+201552229405" onClick={onContactSupport}>
                <Phone size={15} />
                {accountT(t, "dashboard.quickActionItems.support.title", "Contact Support")}
              </a>
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

function RequestProductModal({
  form,
  onChange,
  onClose,
  onSubmit,
}: {
  form: NewProductRequestForm;
  onChange: (form: NewProductRequestForm) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useLanguage();

  return (
    <div
      className="no-scrollbar fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[#050505]/40 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="request-product-title"
    >
      <form
        onSubmit={onSubmit}
        className="flex max-h-[calc(100vh-48px)] w-full max-w-[640px] flex-col overflow-hidden rounded-[28px] border border-[var(--xd-gold-border-soft)] bg-white shadow-[0_24px_70px_rgba(5,5,5,0.18)]"
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6 sm:px-8 sm:pt-8">
          <div>
            <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--xd-gold-active)]">
              {accountT(t, "productRequests.eyebrow", "Product Support")}
            </p>
            <h2 id="request-product-title" className="font-display text-[28px] font-bold text-[#050505]">
              {accountT(t, "productRequests.requestProduct", "Request Product")}
            </h2>
            <p className="mt-2 text-[14px] leading-6 text-[#8A8D9A]">
              {accountT(t, "productRequests.modalDescription", "Tell us what your clinic needs and we will check supplier availability.")}
            </p>
          </div>
          <Button
            type="button"
            onClick={onClose}
            variant="tertiary"
            size="icon"
            className="h-10 w-10 shrink-0"
            aria-label={accountT(t, "productRequests.closeForm", "Close product request form")}
          >
            <X size={18} />
          </Button>
        </div>

        <div className="no-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-6 sm:px-8">
          <label className="block">
            <span className="mb-2 block text-[13px] font-bold text-[#050505]">{accountT(t, "productRequests.productName", "Product Name")}</span>
            <input
              required
              value={form.productName}
              onChange={(event) => onChange({ ...form, productName: event.target.value })}
              placeholder={accountT(t, "productRequests.productNamePlaceholder", "Example: M3-Pro Gold Rotary Files Double")}
              className={inputClassName}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-[13px] font-bold text-[#050505]">{accountT(t, "common.brand", "Brand")}</span>
              <input
                value={form.brand}
                onChange={(event) => onChange({ ...form, brand: event.target.value })}
                placeholder={accountT(t, "productRequests.brandPlaceholder", "Brand or manufacturer")}
                className={inputClassName}
              />
            </label>

            <FieldSelect
              label={accountT(t, "common.category", "Category")}
              value={form.category}
              onChange={(value) => onChange({ ...form, category: value })}
              options={[
                { value: "Endodontics", label: accountValue(t, "Endodontics") },
                { value: "Restorative", label: accountValue(t, "Restorative") },
                { value: "Infection Control", label: accountValue(t, "Infection Control") },
                { value: "Orthodontics", label: accountValue(t, "Orthodontics") },
                { value: "Implantology", label: accountValue(t, "Implantology") },
                { value: "Dental Instruments", label: accountValue(t, "Dental Instruments") },
              ]}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-[13px] font-bold text-[#050505]">{accountT(t, "productRequests.quantityNeeded", "Quantity Needed")}</span>
              <input
                required
                value={form.quantity}
                onChange={(event) => onChange({ ...form, quantity: event.target.value })}
                placeholder={accountT(t, "productRequests.quantityPlaceholder", "2 packs")}
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
          </div>

          <label className="block">
            <span className="mb-2 block text-[13px] font-bold text-[#050505]">{accountT(t, "common.notes", "Notes")}</span>
            <textarea
              value={form.notes}
              onChange={(event) => onChange({ ...form, notes: event.target.value })}
              placeholder={accountT(t, "productRequests.notesPlaceholder", "Add product size, shade, files, or supplier preference.")}
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
            {accountT(t, "productRequests.submitRequest", "Submit Request")}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function AccountProductRequests() {
  const { addToCart, currentUser } = useStore();
  const { t } = useLanguage();
  const [requests, setRequests] = useState<ProductRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<RequestTab>("active");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("6m");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [newRequestForm, setNewRequestForm] = useState<NewProductRequestForm>(emptyProductRequest);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    getMyProductRequests()
      .then((items) => {
        if (active) setRequests(items.map((item) => toProductRequest(item, currentUser)));
      })
      .catch(() => {
        if (active) {
          setRequests([]);
          setStatusMessage(accountT(t, "productRequests.messages.loadFailed", "Failed to load product requests."));
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentUser, t]);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    const newestRequestTime = Math.max(
      ...requests.map((request) => new Date(`${request.createdAt}T00:00:00`).getTime())
    );
    const cutoff =
      dateFilter === "all"
        ? Number.NEGATIVE_INFINITY
        : newestRequestTime - (dateFilter === "30d" ? 30 : 183) * 24 * 60 * 60 * 1000;

    return requests
      .filter((request) =>
        activeTab === "active"
          ? request.status !== "Not Available" && request.status !== "Canceled"
          : request.status === "Not Available" || request.status === "Canceled"
      )
      .filter((request) => statusFilter === "all" || request.status === statusFilter)
      .filter((request) => new Date(`${request.createdAt}T00:00:00`).getTime() >= cutoff)
      .filter((request) => {
        if (!query) return true;

        return [
          request.requestNumber,
          request.productName,
          request.brand,
          request.category,
          request.quantity,
          request.branch,
          request.status,
          request.update,
        ].some((value) => value.toLowerCase().includes(query));
      })
      .sort((a, b) => {
        const aTime = new Date(`${a.createdAt}T00:00:00`).getTime();
        const bTime = new Date(`${b.createdAt}T00:00:00`).getTime();

        return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
      });
  }, [activeTab, dateFilter, requests, search, sortOrder, statusFilter]);

  const handleSubmitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage(null);
    try {
      const quantity = Number.parseInt(newRequestForm.quantity, 10);
      const result = await createProductRequest({
        productName: newRequestForm.productName,
        brand: newRequestForm.brand,
        category: newRequestForm.category,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
        branch: newRequestForm.branch,
        notes: newRequestForm.notes,
        message: newRequestForm.notes,
        source: "ACCOUNT_PAGE",
      });
      const createdRequest = toProductRequest(result.productRequest, currentUser);
      setRequests((current) => [createdRequest, ...current]);
      setActiveTab("active");
      setStatusFilter("all");
      setDateFilter("all");
      setSearch("");
      setNewRequestForm(emptyProductRequest);
      setIsRequestModalOpen(false);
      setStatusMessage(accountT(t, "productRequests.messages.submitted", "Request {requestNumber} submitted.", { requestNumber: createdRequest.requestNumber }));
    } catch {
      setStatusMessage(accountT(t, "productRequests.messages.submitFailed", "Failed to send request. Please try again."));
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
                  {accountT(t, "productRequests.eyebrow", "Product Support")}
                </p>
                <h1 className="font-display text-[36px] font-bold leading-none text-[#050505] sm:text-[44px]">
                  {accountT(t, "productRequests.title", "Product Requests")}
                </h1>
                <p className="mt-4 max-w-[760px] text-[15px] leading-6 text-[#8A8D9A]">
                  {accountT(t, "productRequests.description", "Request dental products that are not currently listed and track availability updates from our team.")}
                </p>
                <span className="mt-4 inline-flex rounded-full bg-[var(--xd-gold-bg-soft)] px-3 py-1 text-[12px] font-bold text-[var(--xd-gold-text)]">
                  {accountT(t, "productRequests.requestCount", "{count} requests", { count: requests.length })}
                </span>
              </div>

              <Button
                type="button"
                onClick={() => {
                  setStatusMessage(null);
                  setIsRequestModalOpen(true);
                }}
                variant="primary"
                className="h-11 w-full gap-2 px-5 text-[14px] sm:w-auto"
              >
                <Plus size={17} />
                {accountT(t, "productRequests.requestProduct", "Request Product")}
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

            {isLoading && (
              <div role="status" className="rounded-[14px] border border-[var(--xd-gold-border-soft)] bg-white/70 px-4 py-3 text-[13px] font-semibold text-[#717182]">
                {accountT(t, "common.loading", "Loading...")}
              </div>
            )}

            <section className="space-y-5">
              <AccountFilterToolbar className="sm:grid-cols-3 xl:grid-cols-[minmax(0,1fr)_160px_180px_180px]">
                <label className={cn(accountFilterSearchClassName, "sm:col-span-3 xl:col-span-1")}>
                  <span className="sr-only">{accountT(t, "productRequests.searchLabel", "Search product requests")}</span>
                  <Search
                    size={17}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8A8D9A]"
                  />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={accountT(t, "productRequests.searchPlaceholder", "Search by product name, brand, or category")}
                    className={cn(toolbarControlClassName, "pl-11")}
                  />
                </label>

                <SelectControl
                  className={accountFilterControlClassName}
                  label={accountT(t, "filters.statusFilter", "Filter by status")}
                  value={statusFilter}
                  onChange={(value) => setStatusFilter(value as StatusFilter)}
                  options={[
                    { value: "all", label: accountValue(t, "All Status") },
                    { value: "Under Review", label: accountValue(t, "Under Review") },
                    { value: "Available", label: accountValue(t, "Available") },
                    { value: "Searching Supplier", label: accountT(t, "statuses.searching", "Searching") },
                    { value: "Not Available", label: accountValue(t, "Not Available") },
                    { value: "Canceled", label: accountValue(t, "Canceled") },
                  ]}
                />

                <SelectControl
                  className={accountFilterControlClassName}
                  label={accountT(t, "filters.dateFilter", "Filter by date")}
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
                  label={accountT(t, "productRequests.sortLabel", "Sort product requests")}
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
                  ["active", accountValue(t, "Active Requests")],
                  ["history", accountT(t, "tabs.requestHistory", "Request History")],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setActiveTab(value as RequestTab);
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
                {filteredRequests.length > 0 ? (
                  filteredRequests.map((request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      onContactSupport={() =>
                        setStatusMessage(accountT(t, "productRequests.messages.callingSupport", "Calling support about Request {requestNumber}.", { requestNumber: request.requestNumber }))
                      }
                      onAddToCart={() => {
                        if (request.product) {
                          addToCart(request.product, 1);
                        }
                      }}
                    />
                  ))
                ) : (
                  <Card className="p-10 text-center">
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-active)]">
                      <FileText size={24} />
                    </span>
                    <h2 className="mt-4 text-[18px] font-bold text-[#050505]">{accountT(t, "productRequests.emptyTitle", "No requests found")}</h2>
                    <p className="mx-auto mt-2 max-w-[420px] text-[14px] leading-6 text-[#8A8D9A]">
                      {accountT(t, "productRequests.emptyDescription", "Adjust your filters or request a product that your clinic needs.")}
                    </p>
                    <Button
                      type="button"
                      onClick={() => setIsRequestModalOpen(true)}
                      variant="primary"
                      className="mt-5 gap-2 px-5 text-[14px]"
                    >
                      <Plus size={16} />
                      {accountT(t, "productRequests.requestProduct", "Request Product")}
                    </Button>
                  </Card>
                )}
              </div>
            </section>

            <Card className="p-[22px] sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-active)]">
                    <Headphones size={18} />
                  </span>
                  <div>
                    <h2 className="text-[16px] font-bold text-[#050505]">
                      {accountT(t, "productRequests.helpTitle", "Need help finding a product?")}
                    </h2>
                    <p className="mt-1 text-[13px] leading-5 text-[#8A8D9A]">
                      {accountT(t, "productRequests.helpDescription", "Support can help identify alternatives, compatible shades, or supplier options.")}
                    </p>
                  </div>
                </div>
                <Button
                  asChild
                  variant="secondary"
                  size="sm"
                  className="h-11 gap-2 px-5 text-[13px] text-[var(--xd-gold-text)]"
                >
                  <a
                    href="tel:+201552229405"
                    onClick={() => setStatusMessage(accountT(t, "productRequests.messages.callingSupportPhone", "Calling support at +20 15 52229405."))}
                  >
                    <Phone size={15} />
                    {accountT(t, "dashboard.quickActionItems.support.title", "Contact Support")}
                  </a>
                </Button>
              </div>
            </Card>
          </main>
        </div>
      </Container>

      {isRequestModalOpen && (
        <RequestProductModal
          form={newRequestForm}
          onChange={setNewRequestForm}
          onClose={() => {
            setIsRequestModalOpen(false);
            setNewRequestForm(emptyProductRequest);
          }}
          onSubmit={handleSubmitRequest}
        />
      )}
    </div>
  );
}
