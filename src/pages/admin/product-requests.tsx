import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { AdminLayout } from "./_components/AdminLayout";
import { AdminPageHeader, AdminStatusBadge, AdminTableShell } from "./_components/admin-ui";
import { DentalSelect } from "@/components/dental/Select";
import {
  getAdminProductRequests,
  updateAdminProductRequestStatus,
  type ApiProductRequest,
  type ProductRequestStatus,
} from "@/services/productRequests";
import type { EmailDeliveryStatus } from "@/services/emailDeliveries";

const statuses: ProductRequestStatus[] = ["Under Review", "Searching Supplier", "Available", "Not Available", "Canceled"];
const statusOptions = statuses.map((status) => ({ value: status, label: status }));

function statusTone(status: ProductRequestStatus) {
  if (status === "Available") return "green" as const;
  if (status === "Not Available" || status === "Canceled") return "red" as const;
  if (status === "Searching Supplier") return "amber" as const;
  return "blue" as const;
}

function emailStatusTone(status: EmailDeliveryStatus) {
  if (status === "SENT") return "green" as const;
  if (status === "FAILED") return "red" as const;
  if (status === "PENDING") return "amber" as const;
  return "slate" as const;
}

export default function AdminProductRequests() {
  const search = useSearch();
  const [requests, setRequests] = useState<ApiProductRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const requestSearchQuery = useMemo(() => new URLSearchParams(search).get("search")?.trim() ?? "", [search]);

  useEffect(() => {
    let active = true;
    getAdminProductRequests()
      .then((items) => active && setRequests(items))
      .catch(() => active && setMessage("Failed to load product requests."))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const filteredRequests = useMemo(() => {
    const query = requestSearchQuery.toLowerCase();
    if (!query) return requests;
    return requests.filter((request) => [request.requestNumber, request.productName, request.status, request.user?.name ?? "", request.brand].some((field) => field.toLowerCase().includes(query)));
  }, [requestSearchQuery, requests]);

  const changeStatus = async (request: ApiProductRequest, status: ProductRequestStatus) => {
    setMessage(null);
    try {
      const updated = await updateAdminProductRequestStatus(request.id, status);
      setRequests((current) =>
        current.map((item) =>
          item.id === updated.id
            ? { ...updated, emailDelivery: updated.emailDelivery ?? item.emailDelivery ?? null }
            : item
        )
      );
      setMessage(`${request.requestNumber} updated to ${status}.`);
    } catch {
      setMessage("Failed to update product request status.");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminPageHeader title="Product Requests" description="Review customer product requests, update availability, and open the linked support conversation." />
        {message && <div role="status" className="rounded-lg border border-[#EFE2BC] bg-[#FFF9E8] px-4 py-3 text-sm font-semibold text-[#5F5F5F]">{message}</div>}
        <AdminTableShell>
          <table className="min-w-full divide-y divide-[#EFE2BC] text-sm">
            <thead className="bg-[#FFF9E8] text-left text-xs uppercase tracking-wide text-[#717182]">
              <tr>
                <th className="px-5 py-3 font-bold">Request</th>
                <th className="px-5 py-3 font-bold">Customer</th>
                <th className="px-5 py-3 font-bold">Product Need</th>
                <th className="px-5 py-3 font-bold">Status</th>
                <th className="px-5 py-3 font-bold">Email</th>
                <th className="px-5 py-3 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3E8C8]">
              {filteredRequests.map((request) => (
                <tr key={request.id} className="hover:bg-[#FBFAF7] dark:hover:bg-white/[0.04]">
                  <td className="px-5 py-4 font-semibold text-[#050505]">{request.requestNumber}</td>
                  <td className="px-5 py-4 text-[#717182]">{request.user?.name ?? "Customer"}</td>
                  <td className="min-w-56 px-5 py-4 text-[#717182]">
                    <p className="font-semibold text-[#050505]">{request.productName}</p>
                    <p className="mt-1 text-xs">{[request.brand, request.sku].filter(Boolean).join(" · ")}</p>
                  </td>
                  <td className="px-5 py-4"><AdminStatusBadge tone={statusTone(request.status)}>{request.status}</AdminStatusBadge></td>
                  <td className="px-5 py-4">
                    {request.emailDelivery ? (
                      <AdminStatusBadge tone={emailStatusTone(request.emailDelivery.status)}>
                        {request.emailDelivery.status}
                      </AdminStatusBadge>
                    ) : "—"}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <DentalSelect
                        label={`Update ${request.requestNumber} status`}
                        value={request.status}
                        onChange={(value) => void changeStatus(request, value as ProductRequestStatus)}
                        options={statusOptions}
                        className="w-[190px]"
                        triggerClassName="h-9 rounded-lg border-[#EFE2BC] px-3 text-xs"
                        contentClassName="rounded-xl"
                        itemClassName="py-2 text-xs"
                      />
                      {request.chatThread && (
                        <Link href={`/admin/support?thread=${request.chatThread.id}`} className="inline-flex h-9 items-center rounded-lg border border-[#EFE2BC] px-3 text-xs font-bold text-[#8A6A1F] hover:bg-[#FFF9E8] dark:hover:border-[#D4A72C]/40 dark:hover:bg-white/[0.05] dark:hover:text-[#F6D85D]">
                          Open Chat
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && filteredRequests.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm font-medium text-[#717182]">No product requests found.</td></tr>
              )}
              {isLoading && <tr><td colSpan={6} className="px-5 py-10 text-center text-sm font-medium text-[#717182]">Loading product requests...</td></tr>}
            </tbody>
          </table>
        </AdminTableShell>
      </div>
    </AdminLayout>
  );
}
