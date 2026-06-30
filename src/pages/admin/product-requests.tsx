import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { AdminLayout } from "./_components/AdminLayout";
import { AdminPageHeader, AdminStatusBadge, AdminTableShell } from "./_components/admin-ui";
import {
  getAdminProductRequests,
  updateAdminProductRequestStatus,
  type ApiProductRequest,
  type ProductRequestStatus,
} from "@/services/productRequests";

const statuses: ProductRequestStatus[] = ["Under Review", "Searching Supplier", "Available", "Not Available", "Canceled"];

function statusTone(status: ProductRequestStatus) {
  if (status === "Available") return "green" as const;
  if (status === "Not Available" || status === "Canceled") return "red" as const;
  if (status === "Searching Supplier") return "amber" as const;
  return "blue" as const;
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
      setRequests((current) => current.map((item) => item.id === updated.id ? updated : item));
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
                <th className="px-5 py-3 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3E8C8]">
              {filteredRequests.map((request) => (
                <tr key={request.id} className="hover:bg-[#FBFAF7]">
                  <td className="px-5 py-4 font-semibold text-[#050505]">{request.requestNumber}</td>
                  <td className="px-5 py-4 text-[#717182]">{request.user?.name ?? "Customer"}</td>
                  <td className="min-w-56 px-5 py-4 text-[#717182]">
                    <p className="font-semibold text-[#050505]">{request.productName}</p>
                    <p className="mt-1 text-xs">{[request.brand, request.sku].filter(Boolean).join(" · ")}</p>
                  </td>
                  <td className="px-5 py-4"><AdminStatusBadge tone={statusTone(request.status)}>{request.status}</AdminStatusBadge></td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={request.status}
                        onChange={(event) => void changeStatus(request, event.target.value as ProductRequestStatus)}
                        className="h-9 rounded-lg border border-[#EFE2BC] bg-white px-3 text-xs font-semibold text-[#050505] outline-none focus:border-[#D4A72C]"
                        aria-label={`Update ${request.requestNumber} status`}
                      >
                        {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                      {request.chatThread && (
                        <Link href={`/admin/support?thread=${request.chatThread.id}`} className="inline-flex h-9 items-center rounded-lg border border-[#EFE2BC] px-3 text-xs font-bold text-[#8A6A1F] hover:bg-[#FFF9E8]">
                          Open Chat
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && filteredRequests.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-sm font-medium text-[#717182]">No product requests found.</td></tr>
              )}
              {isLoading && <tr><td colSpan={5} className="px-5 py-10 text-center text-sm font-medium text-[#717182]">Loading product requests...</td></tr>}
            </tbody>
          </table>
        </AdminTableShell>
      </div>
    </AdminLayout>
  );
}
