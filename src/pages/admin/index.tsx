import { useEffect, useMemo, useState } from "react";
import { ClipboardList, PackageCheck } from "lucide-react";
import { getAdminBrands, type AdminBrand } from "@/services/adminBrands";
import {
  getAdminCategories,
  getAdminProducts,
  type AdminCategory,
  type AdminProduct,
} from "@/services/adminCatalog";
import { getAdminOrders, type AdminOrder } from "@/services/adminOrders";
import { getAdminProductRequests, type ApiProductRequest } from "@/services/productRequests";
import { getAdminQuotes, type Quote } from "@/services/quotes";
import { AdminLayout } from "./_components/AdminLayout";
import { AdminPageHeader, AdminPanel, AdminStatCard, AdminStatusBadge, AdminTableShell } from "./_components/admin-ui";
import type { StatusTone } from "./admin-data";

type DashboardSection = "products" | "brands" | "categories" | "orders" | "quotes" | "requests";

type DashboardData = {
  totalProducts: number;
  lowStockProducts: AdminProduct[];
  lowStockTotal: number;
  brands: AdminBrand[];
  categories: AdminCategory[];
  orders: AdminOrder[];
  quotes: Quote[];
  requests: ApiProductRequest[];
};

const EMPTY_DATA: DashboardData = {
  totalProducts: 0,
  lowStockProducts: [],
  lowStockTotal: 0,
  brands: [],
  categories: [],
  orders: [],
  quotes: [],
  requests: [],
};

export default function AdminOverview() {
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [failedSections, setFailedSections] = useState<Set<DashboardSection>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // Two small, bounded admin-product requests — a total count (limit 1)
    // and a bounded low-stock page — instead of downloading every product.
    Promise.allSettled([
      getAdminProducts({ limit: 1 }),
      getAdminProducts({ stockFilter: "lowStock", limit: 50 }),
      getAdminBrands(),
      getAdminCategories(),
      getAdminOrders(),
      getAdminQuotes(),
      getAdminProductRequests(),
    ]).then(([productsTotal, lowStock, brands, categories, orders, quotes, requests]) => {
      if (!active) return;

      const nextFailures = new Set<DashboardSection>();

      if (productsTotal.status === "rejected" || lowStock.status === "rejected") nextFailures.add("products");
      if (brands.status === "rejected") nextFailures.add("brands");
      if (categories.status === "rejected") nextFailures.add("categories");
      if (orders.status === "rejected") nextFailures.add("orders");
      if (quotes.status === "rejected") nextFailures.add("quotes");
      if (requests.status === "rejected") nextFailures.add("requests");

      setData({
        totalProducts: productsTotal.status === "fulfilled" ? productsTotal.value.pagination.total : 0,
        lowStockProducts: lowStock.status === "fulfilled" ? lowStock.value.products : [],
        lowStockTotal: lowStock.status === "fulfilled" ? lowStock.value.pagination.total : 0,
        brands: brands.status === "fulfilled" ? brands.value : [],
        categories: categories.status === "fulfilled" ? categories.value : [],
        orders: orders.status === "fulfilled" ? orders.value : [],
        quotes: quotes.status === "fulfilled" ? quotes.value : [],
        requests: requests.status === "fulfilled" ? requests.value : [],
      });
      setFailedSections(nextFailures);
      setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const pendingOrders = useMemo(() => data.orders.filter((order) => order.status === "PENDING_REVIEW"), [data.orders]);
  const pendingQuotes = useMemo(() => data.quotes.filter((quote) => quote.status === "PENDING"), [data.quotes]);
  const pendingRequests = useMemo(
    () => data.requests.filter((request) => request.status === "Under Review"),
    [data.requests]
  );
  const lowStockProducts = data.lowStockProducts;

  const metric = (section: DashboardSection, count: number, detail: string, unavailableDetail: string) => ({
    value: isLoading ? "…" : failedSections.has(section) ? "Unavailable" : String(count),
    detail: failedSections.has(section) ? unavailableDetail : detail,
  });

  const overviewMetrics: Array<{ label: string; value: string; detail: string; tone: StatusTone }> = [
    { label: "Total products", ...metric("products", data.totalProducts, "Backend catalog records", "Product count could not be loaded"), tone: "blue" },
    { label: "Total brands", ...metric("brands", data.brands.length, "Backend brand records", "Brand count could not be loaded"), tone: "purple" },
    { label: "Total categories", ...metric("categories", data.categories.length, "Backend category records", "Category count could not be loaded"), tone: "green" },
    { label: "Pending orders", ...metric("orders", pendingOrders.length, "Awaiting admin review", "Order count could not be loaded"), tone: "amber" },
    { label: "Pending quotes", ...metric("quotes", pendingQuotes.length, "Awaiting admin review", "Quote count could not be loaded"), tone: "amber" },
    { label: "Pending product requests", ...metric("requests", pendingRequests.length, "Under review", "Request count could not be loaded"), tone: "amber" },
    { label: "Low stock products", ...metric("products", data.lowStockTotal, "Marked low stock in the catalog", "Low-stock count could not be loaded"), tone: "red" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminPageHeader
          title="Dashboard Overview"
          description="Live catalog and operational counts from backend records."
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {overviewMetrics.map((item) => <AdminStatCard key={item.label} {...item} />)}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <AdminPanel title="Pending Work" description="Orders and quotes awaiting review.">
            <div className="grid gap-4 md:grid-cols-2">
              <PendingList
                title="Orders"
                icon={<ClipboardList size={18} className="text-[#D4A72C]" />}
                isLoading={isLoading}
                hasError={failedSections.has("orders")}
                emptyMessage="No pending orders."
                items={pendingOrders.slice(0, 3).map((order) => ({
                  id: order.id,
                  title: order.orderNumber,
                  subtitle: order.customer.name,
                }))}
              />
              <PendingList
                title="Quotes"
                icon={<PackageCheck size={18} className="text-[#B88A44]" />}
                isLoading={isLoading}
                hasError={failedSections.has("quotes")}
                emptyMessage="No pending quotes."
                items={pendingQuotes.slice(0, 3).map((quote) => ({
                  id: quote.id,
                  title: quote.quoteNumber,
                  subtitle: quote.customer.name,
                }))}
              />
            </div>
          </AdminPanel>

          <AdminPanel title="Low Stock Products" description="Products currently marked low stock in the backend catalog.">
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
                      <td className="px-4 py-3"><AdminStatusBadge tone="amber">Low stock</AdminStatusBadge></td>
                    </tr>
                  ))}
                  {isLoading && <EmptyTableRow message="Loading products…" />}
                  {!isLoading && failedSections.has("products") && <EmptyTableRow message="Low-stock products could not be loaded." error />}
                  {!isLoading && !failedSections.has("products") && lowStockProducts.length === 0 && <EmptyTableRow message="No low-stock products." />}
                </tbody>
              </table>
            </AdminTableShell>
          </AdminPanel>
        </div>
      </div>
    </AdminLayout>
  );
}

function PendingList({
  title,
  icon,
  items,
  isLoading,
  hasError,
  emptyMessage,
}: {
  title: string;
  icon: React.ReactNode;
  items: Array<{ id: string; title: string; subtitle: string }>;
  isLoading: boolean;
  hasError: boolean;
  emptyMessage: string;
}) {
  return (
    <div className="rounded-lg border border-[#EFE2BC] p-4">
      <div className="flex items-center gap-2 text-sm font-bold text-[#050505]">{icon}{title}</div>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-semibold text-[#050505]">{item.title}</p>
              <p className="truncate text-[#717182]">{item.subtitle}</p>
            </div>
            <AdminStatusBadge tone="amber">Pending</AdminStatusBadge>
          </div>
        ))}
        {isLoading && <p className="text-sm text-[#717182]">Loading…</p>}
        {!isLoading && hasError && <p className="text-sm text-[#B42318]">Data could not be loaded.</p>}
        {!isLoading && !hasError && items.length === 0 && <p className="text-sm text-[#717182]">{emptyMessage}</p>}
      </div>
    </div>
  );
}

function EmptyTableRow({ message, error = false }: { message: string; error?: boolean }) {
  return (
    <tr>
      <td colSpan={3} className={`px-4 py-8 text-center ${error ? "text-[#B42318]" : "text-[#717182]"}`}>
        {message}
      </td>
    </tr>
  );
}
