import { useMemo } from "react";
import { useSearch } from "wouter";
import { AdminLayout } from "./_components/AdminLayout";
import { AdminPageHeader, AdminStatusBadge, AdminTableShell } from "./_components/admin-ui";
import { adminOrders } from "./admin-data";

export default function AdminOrders() {
  const search = useSearch();
  const orderSearchQuery = useMemo(() => {
    return new URLSearchParams(search).get("search")?.trim() ?? "";
  }, [search]);
  const filteredOrders = useMemo(() => {
    const normalizedQuery = orderSearchQuery.toLowerCase();
    if (!normalizedQuery) return adminOrders;

    return adminOrders.filter((order) => {
      return [order.id, order.status, order.customer].some((field) =>
        field.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [orderSearchQuery]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminPageHeader
          title="Orders"
          description="Prepared order management view using mock rows only. Fulfillment actions will be wired later."
        />

        <AdminTableShell>
          <table className="min-w-full divide-y divide-[#EFE2BC] text-sm">
            <thead className="bg-[#FFF9E8] text-left text-xs uppercase tracking-wide text-[#717182]">
              <tr>
                <th className="px-5 py-3 font-bold">Order</th>
                <th className="px-5 py-3 font-bold">Customer</th>
                <th className="px-5 py-3 font-bold">Items</th>
                <th className="px-5 py-3 font-bold">Total</th>
                <th className="px-5 py-3 font-bold">Date</th>
                <th className="px-5 py-3 font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3E8C8]">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-[#FBFAF7]">
                  <td className="px-5 py-4 font-semibold text-[#050505]">{order.id}</td>
                  <td className="px-5 py-4 text-[#717182]">{order.customer}</td>
                  <td className="px-5 py-4 text-[#717182]">{order.items}</td>
                  <td className="px-5 py-4 font-semibold text-[#050505]">{order.total}</td>
                  <td className="px-5 py-4 text-[#717182]">{order.date}</td>
                  <td className="px-5 py-4">
                    <AdminStatusBadge tone={order.tone}>{order.status}</AdminStatusBadge>
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm font-medium text-[#717182]">
                    No orders found for this search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </AdminTableShell>
      </div>
    </AdminLayout>
  );
}
