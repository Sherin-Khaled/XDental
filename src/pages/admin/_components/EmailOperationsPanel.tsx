import { useEffect, useMemo, useState } from "react";
import { RefreshCw, RotateCcw } from "lucide-react";
import { DentalSelect } from "@/components/dental/Select";
import { AdminStatusBadge } from "./admin-ui";
import { getAdminNewsletterSubscribers, type AdminNewsletterSubscriber } from "@/services/contact";
import {
  getAdminEmailDeliveries,
  retryAdminEmailDelivery,
  type EmailDelivery,
  type EmailDeliveryStatus,
} from "@/services/emailDeliveries";

const STATUS_TONES: Record<EmailDeliveryStatus, "slate" | "amber" | "green" | "red"> = {
  DISABLED: "slate",
  PENDING: "amber",
  SENT: "green",
  FAILED: "red",
};

export function EmailOperationsPanel() {
  const [deliveries, setDeliveries] = useState<EmailDelivery[]>([]);
  const [subscribers, setSubscribers] = useState<AdminNewsletterSubscriber[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<EmailDeliveryStatus | "ALL">("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setMessage(null);
    Promise.all([
      getAdminEmailDeliveries(),
      getAdminNewsletterSubscribers(),
    ])
      .then(([emailDeliveries, newsletterSubscribers]) => {
        if (!active) return;
        setDeliveries(emailDeliveries);
        setSubscribers(newsletterSubscribers);
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : "Email operations could not be loaded.");
      })
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [refreshVersion]);

  const filteredDeliveries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return deliveries.filter((delivery) => {
      if (status !== "ALL" && delivery.status !== status) return false;
      if (!query) return true;
      return [
        delivery.category,
        delivery.subject ?? "",
        delivery.recipient ?? "",
        delivery.entityId,
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [deliveries, search, status]);

  const retry = async (delivery: EmailDelivery) => {
    setRetryingId(delivery.id);
    setMessage(null);
    try {
      const updated = await retryAdminEmailDelivery(delivery.id);
      setDeliveries((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      setMessage("Email notification retried.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Email notification retry failed.");
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[#EFE2BC] bg-white shadow-sm dark:border-white/10 dark:bg-[#121212]">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#EFE2BC] px-5 py-4 dark:border-white/10">
          <div>
            <h2 className="font-bold text-[#050505] dark:text-white">Company email notifications</h2>
            <p className="mt-1 text-xs text-[#717182] dark:text-white/60">
              Delivery state is persisted independently from each form workflow.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRefreshVersion((value) => value + 1)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#EFE2BC] px-3 text-xs font-semibold text-[#717182] hover:bg-[#FFF9E8] dark:border-white/15 dark:text-white/70 dark:hover:bg-white/5"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        </header>

        <div className="grid gap-3 border-b border-[#EFE2BC] p-4 sm:grid-cols-[minmax(0,1fr)_180px] dark:border-white/10">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search subject, recipient, or reference"
            className="h-10 rounded-lg border border-[#EFE2BC] bg-[#FBFAF7] px-3 text-sm outline-none focus:border-[#D4A72C] dark:border-white/15 dark:bg-white/5 dark:text-white"
          />
          <DentalSelect
            label="Delivery state"
            value={status}
            onChange={(value) => setStatus(value as EmailDeliveryStatus | "ALL")}
            options={[
              { value: "ALL", label: "All delivery states" },
              { value: "DISABLED", label: "Disabled" },
              { value: "PENDING", label: "Pending" },
              { value: "SENT", label: "Sent" },
              { value: "FAILED", label: "Failed" },
            ]}
            triggerClassName="h-10 rounded-lg bg-[#FBFAF7]"
          />
        </div>

        {message && (
          <p role="status" className="mx-4 mt-4 rounded-lg border border-[#EFE2BC] bg-[#FFF9E8] px-4 py-3 text-sm font-semibold text-[#5F5F5F] dark:border-white/10 dark:bg-white/5 dark:text-white/75">
            {message}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#EFE2BC] text-sm dark:divide-white/10">
            <thead className="bg-[#FFF9E8] text-xs uppercase tracking-wide text-[#717182] dark:bg-white/5 dark:text-white/55">
              <tr>
                <th className="px-5 py-3 text-start">Category</th>
                <th className="px-5 py-3 text-start">Notification</th>
                <th className="px-5 py-3 text-start">Status</th>
                <th className="px-5 py-3 text-start">Attempts</th>
                <th className="px-5 py-3 text-start">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3E8C8] dark:divide-white/10">
              {filteredDeliveries.map((delivery) => (
                <tr key={delivery.id}>
                  <td className="px-5 py-4 font-semibold text-[#050505] dark:text-white">{delivery.category}</td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-[#3A3A3A] dark:text-white/80">{delivery.subject}</p>
                    <p className="mt-1 text-xs text-[#8A8D9A]">{delivery.recipient || "Recipient not configured"}</p>
                    {delivery.errorMessage && <p className="mt-1 max-w-xl text-xs text-[#B42318]">{delivery.errorMessage}</p>}
                  </td>
                  <td className="px-5 py-4"><AdminStatusBadge tone={STATUS_TONES[delivery.status]}>{delivery.status}</AdminStatusBadge></td>
                  <td className="px-5 py-4 text-[#717182] dark:text-white/60">{delivery.retryCount}</td>
                  <td className="px-5 py-4">
                    {delivery.status !== "SENT" && (
                      <button
                        type="button"
                        disabled={retryingId === delivery.id}
                        onClick={() => void retry(delivery)}
                        className="inline-flex h-8 items-center gap-2 rounded-md border border-[#EFE2BC] px-3 text-xs font-semibold text-[#8A6A1F] hover:bg-[#FFF9E8] disabled:opacity-50 dark:border-white/15 dark:text-[#F6D85D] dark:hover:bg-white/5"
                      >
                        <RotateCcw size={13} />
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!isLoading && filteredDeliveries.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-[#717182]">No matching email delivery records.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-[#EFE2BC] bg-white shadow-sm dark:border-white/10 dark:bg-[#121212]">
        <header className="border-b border-[#EFE2BC] px-5 py-4 dark:border-white/10">
          <h2 className="font-bold text-[#050505] dark:text-white">Newsletter subscribers</h2>
          <p className="mt-1 text-xs text-[#717182] dark:text-white/60">{subscribers.length} persisted subscribers</p>
        </header>
        <div className="max-h-80 overflow-auto divide-y divide-[#F3E8C8] dark:divide-white/10">
          {subscribers.map((subscriber) => (
            <div key={subscriber.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
              <span dir="ltr" className="font-medium text-[#050505] dark:text-white">{subscriber.email}</span>
              <div className="flex items-center gap-2 text-xs text-[#717182] dark:text-white/60">
                <span>{subscriber.source || "unknown"}</span>
                <span>{subscriber.locale || "—"}</span>
                {subscriber.emailDelivery && (
                  <AdminStatusBadge tone={STATUS_TONES[subscriber.emailDelivery.status]}>
                    {subscriber.emailDelivery.status}
                  </AdminStatusBadge>
                )}
              </div>
            </div>
          ))}
          {!isLoading && subscribers.length === 0 && <p className="px-5 py-8 text-center text-sm text-[#717182]">No newsletter subscribers yet.</p>}
        </div>
      </section>
    </div>
  );
}
