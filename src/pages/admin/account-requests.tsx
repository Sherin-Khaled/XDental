import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { RefreshCw, Search, ShieldCheck, TriangleAlert, X } from "lucide-react";
import { useLocation } from "wouter";
import { AdminLayout } from "./_components/AdminLayout";
import {
  AdminPageHeader,
  AdminStatusBadge,
  AdminTableShell,
} from "./_components/admin-ui";
import { DentalSelect } from "@/components/dental/Select";
import { useLanguage } from "@/context/LanguageContext";
import { useStore } from "@/context/StoreContext";
import {
  applyAdminAccountAction,
  getAdminAccountActionRequest,
  getAdminAccountActionRequests,
  type AdminAccountAction,
  type AdminAccountActionRequest,
  type UserLifecycleState,
} from "@/services/adminAccountActionRequests";
import type {
  AccountActionRequestStatus,
  AccountActionRequestType,
} from "@/services/account";
import {
  ACCOUNT_REQUESTS_REFRESH_EVENT,
  availableAdminAccountRequestActions,
  completionActionTranslationKey,
  completionWarningTranslationPrefix,
  requestedAccountRequestId,
} from "@/lib/accountRequestWorkflow";

type FilterValue<T extends string> = T | "ALL";

const statusTone: Record<AccountActionRequestStatus, "amber" | "blue" | "green" | "red" | "slate"> = {
  PENDING: "amber",
  UNDER_REVIEW: "blue",
  APPROVED: "green",
  REJECTED: "red",
  CANCELED: "slate",
  COMPLETED: "green",
};

const statusKeys: Record<AccountActionRequestStatus, string> = {
  PENDING: "admin.accountRequests.statuses.pending",
  UNDER_REVIEW: "admin.accountRequests.statuses.underReview",
  APPROVED: "admin.accountRequests.statuses.approved",
  REJECTED: "admin.accountRequests.statuses.rejected",
  CANCELED: "admin.accountRequests.statuses.canceled",
  COMPLETED: "admin.accountRequests.statuses.completed",
};

const lifecycleKeys: Record<UserLifecycleState, string> = {
  ACTIVE: "admin.accountRequests.lifecycles.active",
  DELETION_REQUESTED: "admin.accountRequests.lifecycles.deletionRequested",
  DEACTIVATED: "admin.accountRequests.lifecycles.deactivated",
  DELETED: "admin.accountRequests.lifecycles.deleted",
};

const actionKeys: Record<AdminAccountAction, string> = {
  UNDER_REVIEW: "admin.accountRequests.underReviewAction",
  APPROVE: "admin.accountRequests.approveAction",
  REJECT: "admin.accountRequests.rejectAction",
  COMPLETE: "admin.accountRequests.completeAction",
  REACTIVATE: "admin.accountRequests.reactivateAction",
};

function actionConfirmation(action: AdminAccountAction) {
  if (action === "APPROVE") return "APPROVE" as const;
  if (action === "COMPLETE") return "COMPLETE" as const;
  if (action === "REACTIVATE") return "REACTIVATE" as const;
  return undefined;
}

function formatDate(value: string, language: "en" | "ar") {
  return new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(
  t: ReturnType<typeof useLanguage>["t"],
  status: AccountActionRequestStatus,
  type: AccountActionRequestType
) {
  if (status === "COMPLETED" && type === "DELETION") {
    return t("admin.accountRequests.permanentlyDeleted");
  }
  return t(statusKeys[status]);
}

function requestStatusTone(
  status: AccountActionRequestStatus,
  type: AccountActionRequestType
) {
  return status === "COMPLETED" && type === "DELETION"
    ? "red"
    : statusTone[status];
}

function ActionDialog({
  request,
  action,
  isSaving,
  returnFocus,
  onClose,
  onSubmit,
}: {
  request: AdminAccountActionRequest;
  action: AdminAccountAction;
  isSaving: boolean;
  returnFocus: HTMLButtonElement | null;
  onClose: () => void;
  onSubmit: (input: {
    customerResponse?: string;
    adminNote?: string;
    confirmation?: "APPROVE" | "COMPLETE" | "REACTIVATE";
  }) => void;
}) {
  const { t } = useLanguage();
  const [customerResponse, setCustomerResponse] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const confirmation = actionConfirmation(action);
  const actionLabel =
    action === "COMPLETE"
      ? t(
          `admin.accountRequests.${completionActionTranslationKey(request.type)}`
        )
      : t(actionKeys[action]);
  const completionWarningPrefix =
    action === "COMPLETE"
      ? completionWarningTranslationPrefix(request.type)
      : null;
  const isReactivation = action === "REACTIVATE";
  const requiresDocumentedDecision = [
    "APPROVE",
    "REJECT",
    "COMPLETE",
    "REACTIVATE",
  ].includes(action);
  const canSubmit =
    (!confirmation || confirmationText === confirmation)
    && (!requiresDocumentedDecision || customerResponse.trim().length > 0)
    && (!requiresDocumentedDecision || adminNote.trim().length > 0);

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open && !isSaving) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-[#050505]/55 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-[101] flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[640px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[20px] border border-[#EFE2BC] bg-white shadow-[0_28px_90px_rgba(5,5,5,0.32)] outline-none dark:border-[#D4A72C]/25 dark:bg-[#171714] sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:rounded-[24px]"
          aria-describedby="account-request-action-description"
          onEscapeKeyDown={(event) => {
            if (isSaving) event.preventDefault();
          }}
          onPointerDownOutside={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            closeButtonRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            if (!returnFocus) return;
            event.preventDefault();
            returnFocus.focus();
          }}
        >
          <header className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-4 border-b border-[#EFE2BC] bg-white px-5 py-4 dark:border-[#D4A72C]/20 dark:bg-[#171714] sm:px-6 sm:py-5">
            <div className="min-w-0">
              <p className="truncate font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[#B88A44]">
                {request.publicRequestNumber}
              </p>
              <DialogPrimitive.Title className="mt-1.5 text-xl font-black leading-tight text-[#050505] dark:text-[#F5F1E7] sm:text-2xl">
                {actionLabel}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description
                id="account-request-action-description"
                className="mt-1.5 text-sm font-semibold leading-5 text-[#717182] dark:text-[#B8B2A5]"
              >
                {t("admin.accountRequests.actionDialogTitle")}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close asChild>
              <button
                ref={closeButtonRef}
                type="button"
                disabled={isSaving}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#EFE2BC] bg-white text-[#717182] transition hover:border-[#D4A72C]/50 hover:bg-[#FFF9E8] hover:text-[#050505] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A72C]/45 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#D4A72C]/25 dark:bg-white/[0.04] dark:text-[#D3CEC2] dark:hover:bg-[#D4A72C]/10 dark:hover:text-[#F5F1E7]"
                aria-label={t("admin.accountRequests.cancelAction")}
              >
                <X size={18} />
              </button>
            </DialogPrimitive.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
            <div className="space-y-4">
          {action === "APPROVE" && (
            <div className="rounded-xl border border-[#D4A72C]/35 bg-[#FFF9E8] p-4 text-sm font-semibold leading-6 text-[#705A16]">
              {t("admin.accountRequests.approvalExplanation")}
            </div>
          )}
          {completionWarningPrefix && (
            <div
              className={
                request.type === "DELETION"
                  ? "rounded-xl border border-[#E19898] bg-[#FFF3F3] p-4 text-[#8E1D17]"
                  : "rounded-xl border border-[#E4C66A] bg-[#FFF9E8] p-4 text-[#705A16]"
              }
              role="alert"
            >
              <div className="flex items-start gap-3">
                <TriangleAlert size={20} className="mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-black">
                    {t(
                      `admin.accountRequests.${completionWarningPrefix}Title`
                    )}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6">
                    {t(
                      `admin.accountRequests.${completionWarningPrefix}Description`
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
          {isReactivation && (
            <div
              className="rounded-xl border border-[#D4A72C]/40 bg-[#FFF9E8] p-4 text-[#705A16] dark:bg-[#D4A72C]/10 dark:text-[#F2D77B]"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <ShieldCheck size={20} className="mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-black">
                    {t("admin.accountRequests.reactivationTitle")}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6">
                    {t("admin.accountRequests.reactivationDescription")}
                  </p>
                </div>
              </div>
            </div>
          )}
          <label className="block rounded-xl border border-[#EFE2BC] bg-[#FBFAF7] p-4 dark:border-[#D4A72C]/20 dark:bg-white/[0.03]">
            <span className="text-sm font-bold text-[#050505] dark:text-[#F5F1E7]">
              {t("admin.accountRequests.reviewerResponse")}
            </span>
            <span className="mt-1 block text-xs leading-5 text-[#8A8D9A] dark:text-[#AFA99C]">
              {t("admin.accountRequests.customerVisibleHelp")}
            </span>
            <textarea
              maxLength={1000}
              value={customerResponse}
              onChange={(event) => setCustomerResponse(event.target.value)}
              className="mt-2 min-h-[92px] w-full resize-y rounded-xl border border-[#EFE2BC] bg-white px-4 py-3 text-sm outline-none focus:border-[#D4A72C] focus:ring-4 focus:ring-[#D4A72C]/10"
            />
          </label>
          <label className="block rounded-xl border border-[#D4A72C]/25 bg-[#FFF9E8]/60 p-4 dark:bg-[#D4A72C]/[0.07]">
            <span className="text-sm font-bold text-[#050505] dark:text-[#F5F1E7]">
              {t("admin.accountRequests.privateNote")}
            </span>
            <textarea
              maxLength={2000}
              value={adminNote}
              onChange={(event) => setAdminNote(event.target.value)}
              className="mt-2 min-h-[92px] w-full resize-y rounded-xl border border-[#EFE2BC] bg-white px-4 py-3 text-sm outline-none focus:border-[#D4A72C] focus:ring-4 focus:ring-[#D4A72C]/10"
            />
            <span className="mt-1.5 block text-xs text-[#8A8D9A]">
              {t("admin.accountRequests.privateNoteHelp")}
            </span>
          </label>
          {confirmation && (
            <label className="block rounded-xl border border-[#F2C8C8] bg-[#FFF3F3] p-4">
              <span className="text-sm font-bold text-[#B42318]">
                {t("admin.accountRequests.confirmationLabel", {
                  values: { token: confirmation },
                })}
              </span>
              <input
                value={confirmationText}
                onChange={(event) => setConfirmationText(event.target.value)}
                autoComplete="off"
                className="mt-3 h-11 w-full rounded-lg border border-[#F2C8C8] bg-white px-3 text-sm font-semibold outline-none focus:border-[#B42318]"
              />
            </label>
          )}
            </div>
          </div>

          <footer className="sticky bottom-0 z-10 shrink-0 border-t border-[#EFE2BC] bg-white px-5 py-4 dark:border-[#D4A72C]/20 dark:bg-[#171714] sm:px-6">
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <DialogPrimitive.Close asChild>
                <button
                  type="button"
                  disabled={isSaving}
                  className="h-11 rounded-lg border border-[#EFE2BC] px-5 text-sm font-bold text-[#717182] transition hover:bg-[#FBFAF7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A72C]/40 dark:border-[#D4A72C]/25 dark:text-[#D3CEC2] dark:hover:bg-white/[0.04]"
                >
                  {t("admin.accountRequests.cancelAction")}
                </button>
              </DialogPrimitive.Close>
              <button
                type="button"
                disabled={!canSubmit || isSaving}
                onClick={() =>
                  onSubmit({
                    customerResponse: customerResponse.trim() || undefined,
                    adminNote: adminNote.trim() || undefined,
                    confirmation,
                  })
                }
                className={
                  action === "COMPLETE" && request.type === "DELETION"
                    ? "h-11 rounded-lg bg-[#B42318] px-6 text-sm font-black text-white transition hover:bg-[#971C16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B42318]/45 disabled:cursor-not-allowed disabled:opacity-50"
                    : "h-11 rounded-lg bg-[#F9DC5C] px-6 text-sm font-bold text-[#050505] transition hover:bg-[#F6D340] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A72C]/45 disabled:cursor-not-allowed disabled:opacity-50"
                }
              >
                {isSaving ? t("common.saving") : t("admin.accountRequests.submitAction")}
              </button>
            </div>
          </footer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export default function AdminAccountRequests() {
  const { language, t } = useLanguage();
  const { currentUser } = useStore();
  const [location] = useLocation();
  const [requests, setRequests] = useState<AdminAccountActionRequest[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<FilterValue<AccountActionRequestType>>("ALL");
  const [status, setStatus] = useState<FilterValue<AccountActionRequestStatus>>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<AdminAccountAction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const requestSequence = useRef(0);
  const actionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const deepLinkedRequestId = useMemo(
    () => requestedAccountRequestId(location),
    [location]
  );
  const canManage =
    currentUser?.role === "admin"
    || currentUser?.permissions?.includes("ACCOUNT_REQUESTS_MANAGE");

  useEffect(() => {
    const controller = new AbortController();
    const sequence = ++requestSequence.current;
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        let items = await getAdminAccountActionRequests({
          search,
          type: type === "ALL" ? undefined : type,
          status: status === "ALL" ? undefined : status,
          signal: controller.signal,
        });

        if (
          deepLinkedRequestId
          && !items.some((item) => item.id === deepLinkedRequestId)
        ) {
          try {
            const linkedRequest = await getAdminAccountActionRequest(
              deepLinkedRequestId,
              controller.signal
            );
            items = [
              linkedRequest,
              ...items.filter((item) => item.id !== linkedRequest.id),
            ];
          } catch {
            if (
              !controller.signal.aborted
              && sequence === requestSequence.current
            ) {
              setMessage({
                text: t("admin.accountRequests.deepLinkUnavailable"),
                error: true,
              });
            }
          }
        }

        if (
          !controller.signal.aborted
          && sequence === requestSequence.current
        ) {
          setRequests(items);
          setSelectedId((current) => {
            if (
              deepLinkedRequestId
              && items.some((item) => item.id === deepLinkedRequestId)
            ) {
              return deepLinkedRequestId;
            }
            return current && items.some((item) => item.id === current)
              ? current
              : null;
          });
        }
      } catch {
        if (
          !controller.signal.aborted
          && sequence === requestSequence.current
        ) {
          setMessage({
            text: t("admin.accountRequests.loadError"),
            error: true,
          });
        }
      } finally {
        if (
          !controller.signal.aborted
          && sequence === requestSequence.current
        ) {
          setIsLoading(false);
        }
      }
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [deepLinkedRequestId, refreshVersion, search, status, t, type]);

  const refreshRequests = useCallback(() => {
    setRefreshVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    const handleFocus = () => refreshRequests();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshRequests();
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener(ACCOUNT_REQUESTS_REFRESH_EVENT, handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(ACCOUNT_REQUESTS_REFRESH_EVENT, handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refreshRequests]);

  const selected = useMemo(
    () => requests.find((request) => request.id === selectedId) ?? null,
    [requests, selectedId]
  );

  const submitAction = async (input: {
    customerResponse?: string;
    adminNote?: string;
    confirmation?: "APPROVE" | "COMPLETE" | "REACTIVATE";
  }) => {
    if (!selected || !pendingAction || isSaving) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const updated = await applyAdminAccountAction(selected.id, {
        action: pendingAction,
        ...input,
      });
      setRequests((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      setPendingAction(null);
      setMessage({ text: t("admin.accountRequests.actionSuccess"), error: false });
      window.dispatchEvent(new Event(ACCOUNT_REQUESTS_REFRESH_EVENT));
    } catch {
      setMessage({ text: t("admin.accountRequests.actionError"), error: true });
    } finally {
      setIsSaving(false);
    }
  };

  const typeLabel = (value: AccountActionRequestType) =>
    value === "DELETION"
      ? t("admin.accountRequests.types.deletion")
      : t("admin.accountRequests.types.deactivation");

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminPageHeader
          title={t("admin.accountRequests.title")}
          description={t("admin.accountRequests.description")}
        />

        {message && (
          <div
            role={message.error ? "alert" : "status"}
            className={`rounded-lg border px-4 py-3 text-sm font-semibold ${
              message.error
                ? "border-[#F2C8C8] bg-[#FFF3F3] text-[#B42318]"
                : "border-[#CFE8D6] bg-[#F4FBF5] text-[#16803C]"
            }`}
          >
            {message.text}
          </div>
        )}

        <section className="grid gap-3 rounded-xl border border-[#EFE2BC] bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_210px_210px_auto]">
          <label className="flex h-[52px] items-center gap-3 rounded-[14px] border border-[#050505]/10 bg-white px-4">
            <Search size={17} className="text-[#B88A44]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("admin.accountRequests.searchPlaceholder")}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>
          <DentalSelect
            label={t("admin.accountRequests.type")}
            value={type}
            onChange={(value) => setType(value as FilterValue<AccountActionRequestType>)}
            options={[
              { value: "ALL", label: t("admin.accountRequests.allTypes") },
              { value: "DEACTIVATION", label: t("admin.accountRequests.types.deactivation") },
              { value: "DELETION", label: t("admin.accountRequests.types.deletion") },
            ]}
          />
          <DentalSelect
            label={t("admin.accountRequests.status")}
            value={status}
            onChange={(value) => setStatus(value as FilterValue<AccountActionRequestStatus>)}
            options={[
              { value: "ALL", label: t("admin.accountRequests.allStatuses") },
              ...Object.keys(statusKeys).map((value) => ({
                value,
                label: t(statusKeys[value as AccountActionRequestStatus]),
              })),
            ]}
          />
          <button
            type="button"
            onClick={refreshRequests}
            disabled={isLoading}
            className="flex h-[52px] items-center justify-center gap-2 self-end rounded-[14px] border border-[#D4A72C]/35 bg-[#FFF9E8] px-4 text-sm font-bold text-[#705A16] transition hover:border-[#D4A72C] hover:bg-[#FFF4C7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A72C]/45 disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={isLoading ? "animate-spin" : undefined}
            />
            {isLoading
              ? t("admin.accountRequests.refreshing")
              : t("admin.accountRequests.refresh")}
          </button>
        </section>

        <AdminTableShell>
          <div className="hidden grid-cols-[1.05fr_1.2fr_.85fr_.85fr_1fr] gap-4 border-b border-[#EFE2BC] bg-[#FFF9E8] px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#717182] md:grid">
            <span>{t("admin.accountRequests.request")}</span>
            <span>{t("admin.accountRequests.customer")}</span>
            <span>{t("admin.accountRequests.type")}</span>
            <span>{t("admin.accountRequests.status")}</span>
            <span>{t("admin.accountRequests.submitted")}</span>
          </div>
          {requests.map((request) => (
            <button
              key={request.id}
              type="button"
              onClick={() => setSelectedId(request.id)}
              className="grid w-full gap-3 border-b border-[#F3E8C8] px-5 py-4 text-start transition hover:bg-[#FFF9E8] md:grid-cols-[1.05fr_1.2fr_.85fr_.85fr_1fr] md:items-center md:gap-4"
              aria-label={`${t("admin.accountRequests.openDetails")} ${request.publicRequestNumber}`}
            >
              <span className="font-mono text-sm font-bold text-[#050505]">
                {request.publicRequestNumber}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-[#050505]">
                  {request.customer?.name}
                </span>
                <span className="block truncate text-xs text-[#8A8D9A]">
                  {request.customer?.email}
                </span>
              </span>
              <span className="text-sm font-semibold text-[#5F5F5F]">
                {typeLabel(request.type)}
              </span>
              <span>
                <AdminStatusBadge tone={requestStatusTone(request.status, request.type)}>
                  {statusLabel(t, request.status, request.type)}
                </AdminStatusBadge>
              </span>
              <span className="text-xs text-[#717182]">
                {formatDate(request.submittedAt, language)}
              </span>
            </button>
          ))}
          {isLoading && (
            <p className="p-6 text-sm font-semibold text-[#717182]">
              {t("admin.accountRequests.loading")}
            </p>
          )}
          {!isLoading && requests.length === 0 && (
            <p className="p-6 text-sm text-[#717182]">
              {t("admin.accountRequests.empty")}
            </p>
          )}
        </AdminTableShell>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#050505]/35" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0"
            aria-label={t("admin.accountRequests.closeDetails")}
            onClick={() => setSelectedId(null)}
          />
          <section className="relative z-10 h-full w-full max-w-2xl overflow-y-auto border-s border-[#EFE2BC] bg-[#FBFAF7] p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs font-bold text-[#D4A72C]">
                  {selected.publicRequestNumber}
                </p>
                <h2 className="mt-2 text-2xl font-bold text-[#050505]">
                  {typeLabel(selected.type)}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-lg border border-[#EFE2BC] bg-white p-2 text-[#717182]"
                aria-label={t("admin.accountRequests.closeDetails")}
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-[#EFE2BC] bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[#717182]">
                  {t("admin.accountRequests.customer")}
                </p>
                <p className="mt-2 font-bold text-[#050505]">{selected.customer?.name}</p>
                <p className="mt-1 break-all text-sm text-[#717182]">{selected.customer?.email}</p>
              </div>
              <div className="rounded-xl border border-[#EFE2BC] bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[#717182]">
                  {t("admin.accountRequests.lifecycle")}
                </p>
                <p className="mt-2 font-bold text-[#050505]">
                  {selected.customer
                    ? t(lifecycleKeys[selected.customer.lifecycleState])
                    : t("admin.accountRequests.noValue")}
                </p>
                <div className="mt-2">
                  <AdminStatusBadge tone={requestStatusTone(selected.status, selected.type)}>
                    {statusLabel(t, selected.status, selected.type)}
                  </AdminStatusBadge>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {[
                [t("admin.accountRequests.reason"), selected.customerReason],
                [t("admin.accountRequests.details"), selected.customerDetails],
              ].map(([label, value]) => (
                <section key={label} className="rounded-xl border border-[#EFE2BC] bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#717182]">{label}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#050505]">
                    {value || t("admin.accountRequests.noValue")}
                  </p>
                </section>
              ))}
              <section className="rounded-xl border border-[#EFE2BC] bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[#717182]">
                  {t("admin.accountRequests.reviewerResponse")}
                </p>
                <p className="mt-1 text-xs text-[#8A8D9A]">
                  {t("admin.accountRequests.customerVisibleHelp")}
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#050505]">
                  {selected.customerResponse || t("admin.accountRequests.noValue")}
                </p>
              </section>
              <section className="rounded-xl border border-[#D4A72C]/30 bg-[#FFF9E8]/70 p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={15} className="text-[#B88A44]" />
                  <p className="text-xs font-bold uppercase tracking-wide text-[#705A16]">
                    {t("admin.accountRequests.privateNote")}
                  </p>
                </div>
                <p className="mt-1 text-xs text-[#8A7435]">
                  {t("admin.accountRequests.privateNoteHelp")}
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#3A321F]">
                  {selected.reviewerNote || t("admin.accountRequests.noValue")}
                </p>
              </section>
            </div>

            {selected.status === "APPROVED" && (
              <div className="mt-5 rounded-xl border border-[#D4A72C]/35 bg-[#FFF9E8] p-4 text-sm font-semibold leading-6 text-[#705A16]">
                {t("admin.accountRequests.approvedStateExplanation")}
              </div>
            )}

            {canManage
              && availableAdminAccountRequestActions(selected).length > 0 && (
              <div className="mt-6 flex flex-wrap gap-3 border-t border-[#EFE2BC] pt-5">
                {availableAdminAccountRequestActions(selected).map((action) => (
                  <button
                    key={action}
                    type="button"
                    onClick={(event) => {
                      actionTriggerRef.current = event.currentTarget;
                      setPendingAction(action);
                    }}
                    className={
                      action === "REJECT"
                        ? "rounded-lg border border-[#F2C8C8] bg-white px-4 py-2.5 text-sm font-bold text-[#B42318]"
                        : action === "COMPLETE" && selected.type === "DELETION"
                          ? "rounded-lg border border-[#A92019] bg-[#B42318] px-4 py-2.5 text-sm font-black text-white shadow-sm"
                          : action === "COMPLETE"
                            ? "rounded-lg border border-[#C99513] bg-[#FFF3BF] px-4 py-2.5 text-sm font-black text-[#5D480D]"
                        : "rounded-lg bg-[#F9DC5C] px-4 py-2.5 text-sm font-bold text-[#050505]"
                    }
                  >
                    {action === "COMPLETE"
                      ? t(
                          `admin.accountRequests.${completionActionTranslationKey(selected.type)}`
                        )
                      : t(actionKeys[action])}
                  </button>
                ))}
              </div>
            )}

            <section className="mt-7">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-[#D4A72C]" />
                <h3 className="font-bold text-[#050505]">
                  {t("admin.accountRequests.history")}
                </h3>
              </div>
              <div className="mt-4 space-y-3">
                {selected.history.map((entry) => (
                  <article key={entry.id} className="rounded-xl border border-[#EFE2BC] bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-[#050505]">
                        {entry.eventType === "REACTIVATED"
                          ? t("admin.accountRequests.events.reactivated")
                          : t("admin.accountRequests.events.statusChange")}
                      </p>
                      <time className="text-xs text-[#8A8D9A]">
                        {formatDate(entry.createdAt, language)}
                      </time>
                    </div>
                    {entry.newStatus && (
                      <p className="mt-2 text-xs font-semibold text-[#717182]">
                        {entry.previousStatus
                          ? statusLabel(t, entry.previousStatus, selected.type)
                          : "—"}{" "}
                        → {statusLabel(t, entry.newStatus, selected.type)}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-[#8A8D9A]">
                      {entry.actor?.name ?? entry.actorRole}
                    </p>
                    {entry.customerNote && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-[#5F5F5F]">
                        {entry.customerNote}
                      </p>
                    )}
                    {entry.adminNote && (
                      <p className="mt-2 whitespace-pre-wrap rounded-lg bg-[#FFF9E8] px-3 py-2 text-xs font-semibold text-[#705A16]">
                        {entry.adminNote}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          </section>
        </div>
      )}

      {selected && pendingAction && (
        <ActionDialog
          request={selected}
          action={pendingAction}
          isSaving={isSaving}
          returnFocus={actionTriggerRef.current}
          onClose={() => setPendingAction(null)}
          onSubmit={(input) => void submitAction(input)}
        />
      )}
    </AdminLayout>
  );
}
