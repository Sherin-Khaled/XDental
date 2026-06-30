import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "wouter";
import {
  Check,
  Clock3,
  FileQuestion,
  PackageSearch,
  Paperclip,
  Phone,
  SquarePen,
  Upload,
} from "lucide-react";
import { DirectionalIcon } from "@/components/DirectionalIcon";
import { AccountSidebar } from "@/components/dental/AccountSidebar";
import { Button } from "@/components/dental/Button";
import { Container } from "@/components/dental/Container";
import { useLanguage } from "@/context/LanguageContext";
import { useStore } from "@/context/StoreContext";
import {
  type ProductRequest,
  type ProductRequestStatus,
  type ProductRequestStepStatus,
} from "@/data/productRequests";
import { accountT, accountValue } from "@/lib/accountI18n";
import { cn } from "@/lib/utils";
import { cancelMyProductRequest, getMyProductRequest, updateMyProductRequestDetails } from "@/services/productRequests";
import { toProductRequest } from "@/lib/productRequestAdapter";

function formatLongDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatShortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
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

function StatusPill({ status }: { status: ProductRequestStatus }) {
  const { t } = useLanguage();
  const classes: Record<ProductRequestStatus, string> = {
    "Under Review": "bg-[var(--xd-gold-bg-soft)] text-[#A67800]",
    Available: "bg-[#16803C]/10 text-[#16803C]",
    "Searching Supplier": "bg-[var(--xd-info-bg)] text-[var(--xd-info-text)]",
    "Not Available": "bg-[#F44336]/10 text-[#F44336]",
    Canceled: "bg-[#050505]/10 text-[#6A6A6A]",
  };

  return (
    <span className={cn("inline-flex rounded-full px-3 py-1 text-[11px] font-bold", classes[status])}>
      {accountValue(t, status)}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] font-medium text-[#6A6A6A]">{label}</dt>
      <dd className="mt-1 text-[14px] font-bold leading-5 text-[#050505]">{value}</dd>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-[13px]">
      <dt className="text-[#6A6A6A]">{label}</dt>
      <dd className="max-w-[150px] text-right font-bold text-[#050505]">{value}</dd>
    </div>
  );
}

function StepIcon({
  status,
  label,
}: {
  status: ProductRequestStepStatus;
  label: string;
}) {
  if (status === "completed") {
    return <Check size={17} strokeWidth={2} />;
  }

  if (status === "current") {
    return <Clock3 size={17} strokeWidth={2} />;
  }

  if (label.toLowerCase().includes("search")) {
    return <FileQuestion size={17} strokeWidth={1.8} />;
  }

  return <Check size={17} strokeWidth={1.8} />;
}

function StatusStep({
  label,
  note,
  status,
}: {
  label: string;
  note: string;
  status: ProductRequestStepStatus;
}) {
  const { t } = useLanguage();
  const isCurrent = status === "current";
  const isCompleted = status === "completed";

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
        <StepIcon label={label} status={status} />
      </span>
      <div className="min-w-0">
        <p
          className={cn(
            "text-[13px] font-bold leading-5",
            isCurrent ? "text-[var(--xd-gold-active)]" : isCompleted ? "text-[#050505]" : "text-[#6A6A6A]"
          )}
        >
          {accountValue(t, label)}
        </p>
        <p className={cn("text-[11px] font-medium", isCurrent ? "text-[var(--xd-gold-active)]" : "text-[#8A8D9A]")}>
          {accountValue(t, note)}
        </p>
      </div>
    </div>
  );
}

function RequestDetailsCard({
  request,
  uploadedFiles,
  notes,
}: {
  request: ProductRequest;
  uploadedFiles: string[];
  notes: string[];
}) {
  const { t } = useLanguage();

  return (
    <Card className="p-6 sm:p-7">
      <h2 className="text-[18px] font-bold text-[#050505]">{accountT(t, "productRequests.detail.requestedProductDetails", "Requested Product Details")}</h2>
      <p className="mt-2 text-[13px] leading-5 text-[#6A6A6A]">
        {accountT(t, "productRequests.detail.requestedProductDetailsDescription", "Information submitted with this product request.")}
      </p>

      <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="flex h-[112px] w-[112px] shrink-0 items-center justify-center rounded-[16px] border border-[#050505]/[0.06] bg-[#F3F2EF] text-[var(--xd-gold-active)]">
          <PackageSearch size={30} strokeWidth={1.6} />
        </div>

        <dl className="grid min-w-0 flex-1 gap-4">
          <DetailRow label={accountT(t, "productRequests.productName", "Product Name")} value={request.productName} />
          <DetailRow label={accountT(t, "common.brand", "Brand")} value={request.brand} />
          <DetailRow label={accountT(t, "common.category", "Category")} value={accountValue(t, request.category)} />
          <DetailRow label={accountT(t, "productRequests.quantityNeeded", "Quantity Needed")} value={request.quantity} />
          <DetailRow label={accountT(t, "productRequests.detail.productLink", "Product Link")} value={request.productLinkProvided ? accountT(t, "productRequests.detail.provided", "Provided") : accountT(t, "productRequests.detail.notProvided", "Not provided")} />
          {uploadedFiles.length > 0 && (
            <DetailRow
              label={uploadedFiles.length === 1 ? accountT(t, "productRequests.detail.uploadedFile", "Uploaded File") : accountT(t, "productRequests.detail.uploadedFiles", "Uploaded Files")}
              value={
                <span className="flex flex-wrap gap-2">
                  {uploadedFiles.map((fileName) => (
                    <span
                      key={fileName}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[var(--xd-gold-bg-soft)] px-3 py-1 text-[12px]"
                    >
                      <Paperclip size={13} />
                      <span className="truncate">{fileName}</span>
                    </span>
                  ))}
                </span>
              }
            />
          )}
          {notes.length > 0 && (
            <DetailRow
              label={accountT(t, "common.notes", "Notes")}
              value={
                <span className="grid gap-2">
                  {notes.map((note, index) => (
                    <span key={`${note}-${index}`}>{note}</span>
                  ))}
                </span>
              }
            />
          )}
        </dl>
      </div>
    </Card>
  );
}

function TeamUpdatesCard({ request }: { request: ProductRequest }) {
  const { t } = useLanguage();

  return (
    <Card className="p-6 sm:p-7">
      <h2 className="text-[17px] font-bold text-[#050505]">{accountT(t, "productRequests.detail.teamUpdates", "Team Updates")}</h2>
      <div className="mt-5 space-y-4">
        {request.teamUpdates.map((update) => (
          <div key={`${update.title}-${update.date}`} className="flex gap-3">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--xd-gold-active)]" />
            <div>
              <p className="text-[13px] font-semibold text-[#050505]">{accountValue(t, update.title)}</p>
              <p className="mt-0.5 text-[11px] text-[#6A6A6A]">{formatShortDate(update.date)}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function AccountProductRequestDetail() {
  const { id } = useParams();
  const { currentUser } = useStore();
  const { t } = useLanguage();
  const [request, setRequest] = useState<ProductRequest | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isCanceled, setIsCanceled] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");

  useEffect(() => {
    let active = true;
    if (!id) {
      setIsLoading(false);
      setLoadError(true);
      return;
    }
    getMyProductRequest(id)
      .then((item) => {
        if (!active) return;
        const nextRequest = toProductRequest(item, currentUser);
        setRequest(nextRequest);
        setUploadedFiles(nextRequest.uploadedFile ? [nextRequest.uploadedFile] : []);
        setNotes(nextRequest.notes ? [nextRequest.notes] : []);
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentUser, id]);

  if (isLoading || !request) {
    return (
      <div className="bg-[var(--xd-bg)] pb-14 pt-10 lg:pb-20 lg:pt-14">
        <Container className="overflow-x-clip">
          <div className="grid min-w-0 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:gap-7">
            <AccountSidebar />
            <main className="min-w-0">
              <Link
                href="/account/product-requests"
                className="mb-5 inline-flex h-10 items-center gap-2 rounded-full text-[13px] font-bold text-[#717182] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
              >
                <DirectionalIcon direction="back" size={16} />
                {accountT(t, "productRequests.backToProductRequests", "Back to Product Requests")}
              </Link>
              <Card className="p-8 text-center">
                <h1 className="text-[24px] font-bold text-[#050505]">
                  {isLoading ? accountT(t, "common.loading", "Loading...") : accountT(t, "productRequests.detail.notFoundTitle", "Request not found")}
                </h1>
                <p className="mx-auto mt-2 max-w-[420px] text-[14px] leading-6 text-[#717182]">
                  {!isLoading && (loadError
                    ? accountT(t, "productRequests.messages.loadFailed", "Failed to load product request.")
                    : accountT(t, "productRequests.detail.notFoundDescription", "This product request is not available in the current account data."))}
                </p>
              </Card>
            </main>
          </div>
        </Container>
      </div>
    );
  }

  const requestedDate = formatLongDate(request.createdAt);
  const lastUpdatedDate = formatLongDate(request.lastUpdatedAt);
  const displayStatus: ProductRequestStatus = isCanceled ? "Canceled" : request.status;
  const latestUpdate = isCanceled
    ? "This request has been canceled. Supplier availability checks are no longer active."
    : request.update;
  const statusSteps = isCanceled
    ? request.statusSteps.map((step) =>
        step.status === "current"
          ? { ...step, note: "Canceled", status: "pending" as const }
          : step
      )
    : request.statusSteps;

  const handleCancelRequest = async () => {
    try {
      await cancelMyProductRequest(request.id);
      setIsCanceled(true);
      setStatusMessage(accountT(t, "productRequests.detail.messages.canceled", "Request {requestNumber} has been canceled.", { requestNumber: request.requestNumber }));
    } catch {
      setStatusMessage(accountT(t, "productRequests.detail.messages.cancelFailed", "Failed to cancel this request."));
    }
  };

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.currentTarget.files ?? []);

    if (selectedFiles.length === 0) return;

    try {
      await updateMyProductRequestDetails(request.id, { attachments: selectedFiles.map((file) => ({ name: file.name, mimeType: file.type, size: file.size })) });
      setUploadedFiles((currentFiles) => [...currentFiles, ...selectedFiles.map((file) => file.name)]);
      setStatusMessage(selectedFiles.length === 1
        ? accountT(t, "productRequests.detail.messages.fileAttached", "{fileName} has been attached to this request.", { fileName: selectedFiles[0].name })
        : accountT(t, "productRequests.detail.messages.filesAttached", "{count} images have been attached to this request.", { count: selectedFiles.length }));
    } catch {
      setStatusMessage(accountT(t, "productRequests.detail.messages.detailsFailed", "Failed to update request details."));
    }
    event.currentTarget.value = "";
  };

  const handleAddNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedNote = noteDraft.trim();
    if (!trimmedNote) return;

    try {
      await updateMyProductRequestDetails(request.id, { note: trimmedNote });
      setNotes((currentNotes) => [...currentNotes, trimmedNote]);
      setNoteDraft("");
      setIsNoteOpen(false);
      setStatusMessage(accountT(t, "productRequests.detail.messages.noteAdded", "Your note has been added to this request."));
    } catch {
      setStatusMessage(accountT(t, "productRequests.detail.messages.detailsFailed", "Failed to update request details."));
    }
  };

  return (
    <div className="bg-[var(--xd-bg)] pb-14 pt-10 lg:pb-20 lg:pt-14">
      <Container className="overflow-x-clip">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:gap-7">
          <AccountSidebar />

          <main className="min-w-0 space-y-6">
            <Link
              href="/account/product-requests"
              className="inline-flex h-10 items-center gap-2 rounded-full text-[13px] font-bold text-[#717182] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
            >
              <DirectionalIcon direction="back" size={16} />
              {accountT(t, "productRequests.backToProductRequests", "Back to Product Requests")}
            </Link>

            <Card className="p-6 sm:p-8">
              <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <h1 className="font-display text-[30px] font-bold leading-tight text-[#050505] sm:text-[34px]">
                    {accountT(t, "productRequests.requestTitle", "Request {requestNumber}", { requestNumber: request.requestNumber })}
                  </h1>
                  <p className="mt-3 text-[13px] font-medium text-[#6A6A6A]">
                    {accountT(t, "productRequests.detail.requestedMeta", "Requested on {date} - {branch}", { date: requestedDate, branch: accountValue(t, request.branch) })}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <StatusPill status={displayStatus} />
                    <span className="inline-flex rounded-full bg-[#050505]/[0.06] px-3 py-1 text-[11px] font-bold text-[#6A6A6A]">
                      {accountValue(t, request.category)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 md:justify-end">
                  {request.chatThreadId && (
                    <Link
                      href={`/account/support?thread=${request.chatThreadId}`}
                      className="inline-flex h-10 items-center justify-center rounded-full border border-[var(--xd-gold-border-soft)] px-4 text-[13px] font-bold text-[var(--xd-gold-text)] transition-colors hover:bg-[var(--xd-gold-bg-soft)]"
                    >
                      {accountT(t, "productRequests.detail.openSupportChat", "Open Support Chat")}
                    </Link>
                  )}
                  <a
                    href="tel:+201552229405"
                    aria-label={accountT(t, "productRequests.detail.callSupportPhone", "Call support at +20 15 52229405")}
                    className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-[13px] font-bold text-[#717182] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
                  >
                    <Phone size={15} />
                    {accountT(t, "dashboard.quickActionItems.support.title", "Contact Support")}
                  </a>
                  <button
                    type="button"
                    onClick={handleCancelRequest}
                    disabled={isCanceled}
                    className="inline-flex h-10 items-center justify-center rounded-full px-3 text-[13px] font-bold text-[#DA2B1E] transition-colors hover:text-[#B42318] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DA2B1E]/30 disabled:text-[#8A8D9A]"
                  >
                    {isCanceled ? accountT(t, "productRequests.detail.requestCanceled", "Request Canceled") : accountT(t, "productRequests.detail.cancelRequest", "Cancel Request")}
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

            <div className="flex flex-col gap-4 rounded-[22px] border border-[var(--xd-gold-border-soft)] bg-[#F8F2E3] p-5 sm:flex-row">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-active)]">
                <Clock3 size={18} />
              </span>
              <div className="min-w-0">
                <h2 className="text-[14px] font-bold text-[#050505]">{accountT(t, "productRequests.detail.latestUpdate", "Latest update")}</h2>
                <p className="mt-1 max-w-full break-words text-[13px] leading-5 text-[#6A6A6A] [overflow-wrap:anywhere]">
                  <span className="hidden sm:inline">{accountValue(t, latestUpdate)}</span>
                  <span className="sm:hidden">
                    {isCanceled
                      ? accountT(t, "productRequests.detail.mobileCanceledUpdate", "Request canceled. Supplier checks are no longer active.")
                      : accountT(t, "productRequests.detail.mobileCheckingUpdate", "Checking supplier availability. Updates will appear after confirmation.")}
                  </span>
                </p>
              </div>
            </div>

            <Card className="p-6 sm:p-7">
              <h2 className="text-[18px] font-bold text-[#050505]">{accountT(t, "productRequests.detail.statusTitle", "Request Status")}</h2>
              <div className="relative mt-7">
                <div className="absolute left-[12.5%] right-[12.5%] top-5 hidden h-px bg-[#050505]/10 md:block" />
                <div className="grid gap-5 md:grid-cols-4">
                  {statusSteps.map((step) => (
                    <StatusStep
                      key={step.label}
                      label={step.label}
                      note={step.note}
                      status={step.status}
                    />
                  ))}
                </div>
              </div>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,0.95fr)]">
              <div className="min-w-0 space-y-6">
                <RequestDetailsCard request={request} uploadedFiles={uploadedFiles} notes={notes} />
                <TeamUpdatesCard request={request} />

                <Card className="p-6 sm:p-7">
                  <h2 className="text-[17px] font-bold text-[#050505]">{accountT(t, "productRequests.detail.addMoreDetailsTitle", "Need to add more details?")}</h2>
                  <p className="mt-2 text-[13px] leading-5 text-[#6A6A6A]">
                    {accountT(t, "productRequests.detail.addMoreDetailsDescription", "Upload another image, product code, or link to help our team find the exact product.")}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      variant="secondary"
                      size="sm"
                      className="h-10 gap-2 px-5 text-[13px]"
                      disabled={isCanceled}
                    >
                      <Upload size={15} />
                      {accountT(t, "productRequests.detail.uploadImage", "Upload Image")}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleImageUpload}
                    />
                    <button
                      type="button"
                      onClick={() => setIsNoteOpen((current) => !current)}
                      disabled={isCanceled}
                      className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-bold text-[#717182] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)] disabled:text-[#B3B4BD]"
                    >
                      <SquarePen size={15} />
                      {accountT(t, "productRequests.detail.addNote", "Add Note")}
                    </button>
                  </div>
                  {isCanceled && (
                    <p className="mt-4 text-[13px] font-semibold text-[#8A8D9A]">
                      {accountT(t, "productRequests.detail.canceledNoDetails", "This request is canceled, so new details cannot be added.")}
                    </p>
                  )}
                  {isNoteOpen && !isCanceled && (
                    <form onSubmit={handleAddNote} className="mt-5 space-y-3">
                      <label className="block">
                        <span className="sr-only">{accountT(t, "productRequests.detail.addNoteLabel", "Add note to product request")}</span>
                        <textarea
                          value={noteDraft}
                          onChange={(event) => setNoteDraft(event.target.value)}
                          placeholder={accountT(t, "productRequests.detail.addNotePlaceholder", "Add product code, supplier reference, size, or extra details")}
                          className="min-h-[104px] w-full resize-none rounded-[14px] border border-[#050505]/10 bg-white px-4 py-3 text-[14px] text-[#050505] outline-none transition placeholder:text-[#B3B4BD] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10"
                        />
                      </label>
                      <div className="flex flex-wrap gap-3">
                        <Button
                          type="submit"
                          variant="primary"
                          size="sm"
                          className="h-10 px-5 text-[13px]"
                          disabled={!noteDraft.trim()}
                        >
                          {accountT(t, "productRequests.detail.saveNote", "Save Note")}
                        </Button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsNoteOpen(false);
                            setNoteDraft("");
                          }}
                          className="inline-flex h-10 items-center justify-center rounded-full px-4 text-[13px] font-bold text-[#717182] transition-colors hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-border)]"
                        >
                          {accountT(t, "common.cancel", "Cancel")}
                        </button>
                      </div>
                    </form>
                  )}
                </Card>
              </div>

              <aside className="min-w-0 space-y-6">
                <Card className="p-6">
                  <h2 className="text-[17px] font-bold text-[#050505]">{accountT(t, "productRequests.detail.summaryTitle", "Request Summary")}</h2>
                  <dl className="mt-5 space-y-4">
                    <SummaryRow label={accountT(t, "productRequests.detail.requestNumber", "Request Number")} value={request.requestNumber} />
                    <SummaryRow label={accountT(t, "common.status", "Status")} value={<StatusPill status={displayStatus} />} />
                    <SummaryRow label={accountT(t, "quotes.requestedDateLabel", "Requested Date")} value={requestedDate} />
                    <SummaryRow label={accountT(t, "productRequests.detail.lastUpdated", "Last Updated")} value={lastUpdatedDate} />
                    <SummaryRow label={accountT(t, "productRequests.detail.preferredBranch", "Preferred Branch")} value={accountValue(t, request.branch)} />
                    <SummaryRow label={accountT(t, "common.category", "Category")} value={accountValue(t, request.category)} />
                  </dl>
                </Card>

                <Card className="p-6">
                  <h2 className="text-[17px] font-bold text-[#050505]">{accountT(t, "productRequests.detail.contactDetails", "Contact Details")}</h2>
                  <div className="mt-5 space-y-2 text-[13px] leading-5">
                    <p className="font-bold text-[#050505]">{request.contact.name}</p>
                    <p className="text-[#6A6A6A]">{request.contact.phone}</p>
                    <p className="text-[#6A6A6A]">{request.contact.email}</p>
                    <p className="text-[#6A6A6A]">{request.contact.branch}</p>
                  </div>
                  <Link
                    href="/account"
                    className="mt-4 text-[13px] font-bold text-[var(--xd-gold-active)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)]"
                  >
                    {accountT(t, "productRequests.detail.editContactDetails", "Edit contact details")}
                  </Link>
                </Card>

                <Card className="p-6">
                  <h2 className="text-[17px] font-bold text-[#050505]">{accountT(t, "productRequests.detail.availabilityResult", "Availability Result")}</h2>
                  <div className="mt-5 rounded-[14px] bg-[#F3F2EF] p-5 text-center text-[13px] font-medium leading-5 text-[#6A6A6A]">
                    {request.availabilityResult
                      ? accountValue(t, request.availabilityResult)
                      : accountT(t, "productRequests.detail.availabilityPending", "Availability result will appear here once our team receives supplier confirmation.")}
                  </div>
                </Card>
              </aside>
            </div>
          </main>
        </div>
      </Container>
    </div>
  );
}
