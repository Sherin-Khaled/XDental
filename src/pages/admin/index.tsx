import { AlertTriangle, ClipboardList, PackageCheck } from "lucide-react";
import { AdminLayout } from "./_components/AdminLayout";
import { AdminPageHeader, AdminPanel, AdminStatCard, AdminStatusBadge, AdminTableShell } from "./_components/admin-ui";
import { adminMetrics, adminOrders, adminProducts, adminQuotes } from "./admin-data";

export default function AdminOverview() {
  const lowStockProducts = adminProducts.filter((product) => product.stock <= 5);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminPageHeader
          title="Dashboard Overview"
          description="A mock operational view for X Dental Store. Metrics and tables are placeholders prepared for future backend integration."
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {adminMetrics.map((metric) => (
            <AdminStatCard key={metric.label} {...metric} />
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <AdminPanel
            title="Pending Work"
            description="Mock queues for orders and quotes that will later connect to backend workflows."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-[#EFE2BC] p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-[#050505]">
                  <ClipboardList size={18} className="text-[#D4A72C]" />
                  Orders
                </div>
                <div className="mt-4 space-y-3">
                  {adminOrders.slice(0, 2).map((order) => (
                    <div key={order.id} className="flex items-center justify-between gap-3 text-sm">
                      <div>
                        <p className="font-semibold text-[#050505]">{order.id}</p>
                        <p className="text-[#717182]">{order.customer}</p>
                      </div>
                      <AdminStatusBadge tone={order.tone}>{order.status}</AdminStatusBadge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-[#EFE2BC] p-4">
                <div className="flex items-center gap-2 text-sm font-bold text-[#050505]">
                  <PackageCheck size={18} className="text-[#B88A44]" />
                  Quotes
                </div>
                <div className="mt-4 space-y-3">
                  {adminQuotes.slice(0, 2).map((quote) => (
                    <div key={quote.id} className="flex items-center justify-between gap-3 text-sm">
                      <div>
                        <p className="font-semibold text-[#050505]">{quote.id}</p>
                        <p className="text-[#717182]">{quote.clinic}</p>
                      </div>
                      <AdminStatusBadge tone={quote.tone}>{quote.status}</AdminStatusBadge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </AdminPanel>

          <AdminPanel
            title="Low Stock Products"
            description="Inventory flags are static mock values in this scaffold."
          >
            <AdminTableShell>
              <table className="min-w-full divide-y divide-[#EFE2BC] text-sm">
                <thead className="bg-[#FFF9E8] text-left text-xs uppercase tracking-wide text-[#717182]">
                  <tr>
                    <th className="px-4 py-3 font-bold">Product</th>
                    <th className="px-4 py-3 font-bold">Stock</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3E8C8]">
                  {lowStockProducts.map((product) => (
                    <tr key={product.id}>
                      <td className="px-4 py-3 font-semibold text-[#050505]">{product.name}</td>
                      <td className="px-4 py-3 text-[#717182]">{product.stock}</td>
                      <td className="px-4 py-3">
                        <AdminStatusBadge tone={product.tone}>{product.status}</AdminStatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminTableShell>
            {lowStockProducts.length === 0 && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#EFE2BC] bg-[#FFF9E8] p-3 text-sm text-[#B88A44]">
                <AlertTriangle size={16} />
                No low stock products in the current mock data.
              </div>
            )}
          </AdminPanel>
        </div>
      </div>
    </AdminLayout>
  );
}
