import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Eye,
  Package,
  RefreshCw,
  Search,
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
import { StatusBadge } from "@/components/dental/StatusBadge";
import { useLanguage } from "@/context/LanguageContext";
import { useStore } from "@/context/StoreContext";
import { mockOrders } from "@/data/orders";
import { cn } from "@/lib/utils";
import { accountT, accountValue } from "@/lib/accountI18n";
import { formatCurrency } from "@/utils";

type Order = (typeof mockOrders)[number];
type OrderItem = Order["items"][number];
type OrderTab = "current" | "history";
type OrderDisplayStatus =
  | "Delivered"
  | "Shipped"
  | "Processing"
  | "Out for Delivery"
  | "Pending Payment"
  | "Cancelled"
  | "Refunded";
type StatusFilter = "all" | OrderDisplayStatus;
type DateFilter = "30d" | "6m" | "all";
type SortOrder = "newest" | "oldest";

const controlClassName =
  "h-12 rounded-full border border-[#050505]/[0.08] bg-white/70 text-[14px] text-[#050505] shadow-none backdrop-blur outline-none transition placeholder:text-[#B3B4BD] focus:border-[var(--xd-gold-border-hover)] focus:ring-4 focus:ring-[var(--xd-gold-active)]/10";

const statusBadgeClasses: Record<OrderDisplayStatus, string> = {
  Delivered: "border-[#16803C]/20 bg-[#16803C]/10 text-[#16803C]",
  Shipped: "border-[#25B8C7]/20 bg-[#25B8C7]/10 text-[#178A96]",
  Processing: "border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-text)]",
  "Out for Delivery": "border-[#25B8C7]/20 bg-[#25B8C7]/10 text-[#178A96]",
  "Pending Payment": "border-[var(--xd-gold-border-soft)] bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-text)]",
  Cancelled: "border-[#F44336]/20 bg-[#F44336]/10 text-[#B42318]",
  Refunded: "border-[#F44336]/20 bg-[#F44336]/10 text-[#B42318]",
};

function formatCompactOrderDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDisplayStatus(order: Order): OrderDisplayStatus {
  if (order.status === "Cancelled" || order.status === "Refunded") {
    return order.status;
  }

  if (order.paymentStatus.toLowerCase() === "pending") {
    return "Pending Payment";
  }

  if (
    order.status === "Delivered" ||
    order.status === "Shipped" ||
    order.status === "Processing" ||
    order.status === "Out for Delivery" ||
    order.status === "Cancelled" ||
    order.status === "Refunded"
  ) {
    return order.status;
  }

  return "Processing";
}

function isHistoryOrder(order: Order) {
  return (
    order.status === "Delivered" ||
    order.status === "Cancelled" ||
    order.status === "Refunded"
  );
}

function getReferenceTime(orders: Order[]) {
  return Math.max(...orders.map((order) => new Date(order.date).getTime()));
}

function isInsideDateFilter(order: Order, filter: DateFilter, referenceTime: number) {
  if (filter === "all") return true;

  const days = filter === "30d" ? 30 : 183;
  const cutoff = referenceTime - days * 24 * 60 * 60 * 1000;

  return new Date(order.date).getTime() >= cutoff;
}

function getProductPreview(order: Order) {
  const [firstItem] = order.items;
  const extraItemCount = Math.max(order.items.length - 1, 0);

  if (!firstItem) {
    return {
      firstProductName: "",
      extraItemCount: 0,
    };
  }

  return {
    firstProductName: firstItem.product.name,
    extraItemCount,
  };
}

function getStatusOptions(t: ReturnType<typeof useLanguage>["t"]): DentalSelectOption[] {
  return [
    { value: "all", label: accountValue(t, "All Statuses") },
    { value: "Delivered", label: accountValue(t, "Delivered") },
    { value: "Shipped", label: accountValue(t, "Shipped") },
    { value: "Processing", label: accountValue(t, "Processing") },
    { value: "Out for Delivery", label: accountValue(t, "Out for Delivery") },
    { value: "Pending Payment", label: accountValue(t, "Pending Payment") },
    { value: "Cancelled", label: accountValue(t, "Cancelled") },
    { value: "Refunded", label: accountValue(t, "Refunded") },
  ];
}

function getDateOptions(t: ReturnType<typeof useLanguage>["t"]): DentalSelectOption[] {
  return [
    { value: "6m", label: accountValue(t, "Last 6 months") },
    { value: "30d", label: accountValue(t, "Last 30 days") },
    { value: "all", label: accountValue(t, "All time") },
  ];
}

function getSortOptions(t: ReturnType<typeof useLanguage>["t"]): DentalSelectOption[] {
  return [
    { value: "newest", label: accountValue(t, "Newest First") },
    { value: "oldest", label: accountT(t, "filters.oldestFirst", "Oldest First") },
  ];
}

function getMetadataLine(order: Order, t: ReturnType<typeof useLanguage>["t"]) {
  return [
    accountT(t, "orders.placedOn", "Placed {date}", { date: formatCompactOrderDate(order.date) }),
    accountT(t, "common.itemsCount", "{count} items", { count: order.itemCount }),
    accountValue(t, order.paymentStatus),
    accountValue(t, order.deliveryStatus),
  ].join(" \u00b7 ");
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
        "border-[#050505]/[0.08] bg-white/70 lg:text-[14px]",
        triggerClassName
      )}
    />
  );
}

function OrderStatusBadge({ status }: { status: OrderDisplayStatus }) {
  return (
    <StatusBadge
      status={status}
      className={cn(
        "h-7 rounded-full px-3 py-0 text-[13px] font-semibold",
        statusBadgeClasses[status]
      )}
    />
  );
}

function ProductThumb({ item }: { item: OrderItem }) {
  const [hasError, setHasError] = useState(false);
  const image = item.product.image;

  return (
    <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-[13px] border border-[var(--xd-gold-border-soft)] bg-white/75 shadow-[0_8px_18px_rgba(5,5,5,0.05)]">
      {image && !hasError ? (
        <img
          src={image}
          alt={item.product.name}
          width={2525}
          height={2582}
          loading="lazy"
          decoding="async"
          onError={() => setHasError(true)}
          className="h-full w-full object-contain p-1.5"
        />
      ) : (
        <Package size={21} className="text-[var(--xd-gold-active)]" />
      )}
    </span>
  );
}

function ExtraItemTile({ count }: { count: number }) {
  return (
    <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[13px] border border-[var(--xd-gold-border-soft)] bg-[var(--xd-bg)] text-[12px] font-bold text-[#717182] shadow-[0_8px_18px_rgba(5,5,5,0.05)]">
      +{count}
    </span>
  );
}

function OrderActions({
  order,
  status,
}: {
  order: Order;
  status: OrderDisplayStatus;
}) {
  const { t } = useLanguage();
  const isPendingPayment = status === "Pending Payment";
  const canTrack =
    order.paymentStatus.toLowerCase() !== "pending" &&
    (status === "Shipped" ||
      status === "Processing" ||
      status === "Out for Delivery");
  const isDelivered = status === "Delivered";
  const isCancelled = status === "Cancelled" || status === "Refunded";

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
      {isPendingPayment && (
        <Button
          asChild
          size="sm"
          className="h-10 w-full px-4 text-[13px] text-[#050505] sm:w-auto"
        >
          <Link href={`/checkout?order=${order.id}`}>{accountT(t, "orders.completePayment", "Complete Payment")}</Link>
        </Button>
      )}

      {canTrack && (
        <Button
          asChild
          size="sm"
          className="h-10 w-full px-4 text-[13px] text-[#050505] sm:w-auto"
        >
          <Link href={`/account/orders/${order.id}#tracking`}>{accountT(t, "orders.trackOrder", "Track Order")}</Link>
        </Button>
      )}

      {isDelivered && (
        <Button
          asChild
          size="sm"
          className="h-10 w-full gap-2 px-4 text-[13px] text-[#050505] sm:w-auto"
        >
          <Link href="/products">
            <RefreshCw size={15} />
            {accountT(t, "orders.reorder", "Reorder")}
          </Link>
        </Button>
      )}

      {(isPendingPayment || canTrack || isDelivered || isCancelled) && (
        <Button
          asChild
          variant="secondary"
          size="sm"
          className="h-10 w-full gap-2 px-4 text-[13px] sm:w-auto"
        >
          <Link href={`/account/orders/${order.id}`}>
            <Eye size={15} />
            {accountT(t, "common.viewDetails", "View Details")}
          </Link>
        </Button>
      )}
    </div>
  );
}

function OrderCard({ order }: { order: Order }) {
  const { t } = useLanguage();
  const status = getDisplayStatus(order);
  const { firstProductName, extraItemCount } = getProductPreview(order);
  const metadata = getMetadataLine(order, t);
  const firstItem = order.items[0];

  return (
    <article className="rounded-[24px] border border-[var(--xd-gold-border-soft)] bg-white/70 p-5 shadow-[0_12px_32px_rgba(5,5,5,0.05)] backdrop-blur transition hover:border-[var(--xd-gold-border-hover)] sm:p-[22px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-[20px] font-bold leading-tight text-[#050505] sm:text-[22px]">
              {order.orderNumber}
            </h2>
            <OrderStatusBadge status={status} />
          </div>
          <p className="mt-2 text-[14px] font-medium leading-6 text-[#717182]">
            {metadata}
          </p>
        </div>

        <div className="shrink-0 sm:text-right">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#8A8D9A]">
            {accountT(t, "common.total", "Total")}
          </p>
          <p className="mt-1 font-display text-[24px] font-bold leading-none text-[#050505]">
            {formatCurrency(order.total)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-[#050505]/[0.06] pt-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="flex gap-2">
            {firstItem && <ProductThumb item={firstItem} />}
            {extraItemCount > 0 && <ExtraItemTile count={extraItemCount} />}
          </div>

          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold text-[#050505]">
              {firstProductName || accountT(t, "orders.noProducts", "No products")}
            </p>
            {extraItemCount > 0 && (
              <p className="mt-0.5 text-[12px] font-semibold text-[#8A8D9A]">
                {accountT(
                  t,
                  extraItemCount === 1 ? "orders.moreItem" : "orders.moreItems",
                  extraItemCount === 1 ? "+{count} more item" : "+{count} more items",
                  { count: extraItemCount }
                )}
              </p>
            )}
            <p className="mt-1 text-[13px] font-medium text-[#8A8D9A]">
              {accountValue(t, order.deliveryMethod)} - {accountValue(t, order.paymentMethod)}
            </p>
          </div>
        </div>

        <OrderActions order={order} status={status} />
      </div>
    </article>
  );
}

export default function AccountOrders() {
  const { t } = useLanguage();
  const { currentUser } = useStore();
  const accountOrders = currentUser?.isDemo ? mockOrders : [];
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("6m");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [activeTab, setActiveTab] = useState<OrderTab>("current");

  const referenceTime = useMemo(() => getReferenceTime(accountOrders), [accountOrders]);

  const filteredOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return accountOrders
      .filter((order) => (activeTab === "history" ? isHistoryOrder(order) : !isHistoryOrder(order)))
      .filter((order) => {
        if (!normalizedSearch) return true;

        const searchable = [
          order.orderNumber,
          order.paymentStatus,
          order.deliveryStatus,
          order.items.map((item) => item.product.name).join(" "),
          order.items.map((item) => item.product.brand).join(" "),
        ]
          .join(" ")
          .toLowerCase();

        return searchable.includes(normalizedSearch);
      })
      .filter((order) => statusFilter === "all" || getDisplayStatus(order) === statusFilter)
      .filter((order) => isInsideDateFilter(order, dateFilter, referenceTime))
      .sort((a, b) => {
        const aTime = new Date(a.date).getTime();
        const bTime = new Date(b.date).getTime();

        return sortOrder === "newest" ? bTime - aTime : aTime - bTime;
      });
  }, [accountOrders, activeTab, dateFilter, referenceTime, search, sortOrder, statusFilter]);

  return (
    <div className="bg-[var(--xd-bg)] pb-14 pt-10 lg:pb-20 lg:pt-14">
      <Container className="overflow-x-clip">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:gap-7">
          <AccountSidebar />

          <main className="min-w-0">
            <div>
              <h1 className="font-display text-[36px] font-bold leading-none text-[#050505] sm:text-[44px]">
                {accountT(t, "orders.title", "My Orders")}
              </h1>
              <p className="mt-4 max-w-[760px] text-[15px] leading-6 text-[#8A8D9A]">
                {accountT(t, "orders.description", "Track current orders, review previous purchases, and reorder clinic essentials quickly.")}
              </p>
            </div>

            <AccountFilterToolbar className="mt-8 sm:grid-cols-3 lg:grid-cols-[minmax(280px,1fr)_160px_160px_160px]">
              <label className={cn(accountFilterSearchClassName, "sm:col-span-3 lg:col-span-1")}>
                <span className="sr-only">{accountT(t, "orders.searchLabel", "Search orders")}</span>
                <Search
                  size={17}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8A8D9A]"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={accountT(t, "orders.searchPlaceholder", "Search by order number or product name")}
                  className={cn(controlClassName, "w-full pl-11 pr-4")}
                />
              </label>

              <SelectControl
                className={accountFilterControlClassName}
                label={accountT(t, "orders.statusFilterLabel", "Filter orders by status")}
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as StatusFilter)}
                options={getStatusOptions(t)}
              />

              <SelectControl
                className={accountFilterControlClassName}
                label={accountT(t, "orders.dateFilterLabel", "Filter orders by date")}
                value={dateFilter}
                onChange={(value) => setDateFilter(value as DateFilter)}
                options={getDateOptions(t)}
              />

              <SelectControl
                className={accountFilterControlClassName}
                label={accountT(t, "orders.sortLabel", "Sort orders")}
                value={sortOrder}
                onChange={(value) => setSortOrder(value as SortOrder)}
                options={getSortOptions(t)}
              />
            </AccountFilterToolbar>

            <div className="mt-4 inline-flex max-w-full rounded-full border border-[var(--xd-gold-border-soft)] bg-white/65 p-1 shadow-[0_8px_24px_rgba(5,5,5,0.03)] backdrop-blur">
              {[
                ["current", accountT(t, "orders.tabs.current", "Current Orders")],
                ["history", accountT(t, "orders.tabs.history", "Order History")],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setActiveTab(value as OrderTab);
                    setStatusFilter("all");
                  }}
                  className={cn(
                    "h-10 rounded-full px-5 text-[13px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)] sm:h-11",
                    activeTab === value
                      ? "bg-[var(--xd-gold-active)] text-white shadow-[0_8px_20px_rgba(212,167,44,0.18)]"
                      : "text-[var(--xd-gold-text)] hover:bg-[var(--xd-gold-active)]/[0.08] hover:text-[#050505]"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-6 space-y-4">
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))
              ) : (
                <section className="rounded-[26px] border border-[var(--xd-gold-border-soft)] bg-white/70 p-8 text-center shadow-[0_12px_32px_rgba(5,5,5,0.05)] backdrop-blur">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--xd-gold-bg-soft)] text-[var(--xd-gold-active)]">
                    <Package size={24} />
                  </span>
                  <h2 className="mt-4 text-[18px] font-bold text-[#050505]">
                    {accountT(t, "orders.emptyTitle", "No orders found")}
                  </h2>
                  <p className="mx-auto mt-2 max-w-[420px] text-[14px] leading-6 text-[#8A8D9A]">
                    {accountT(t, "orders.emptyDescription", "Try adjusting your search, status, or date filters.")}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("all");
                      setDateFilter("6m");
                      setSortOrder("newest");
                    }}
                    className="mt-5 h-10 px-5 text-[13px]"
                  >
                    {accountT(t, "common.resetFilters", "Reset Filters")}
                  </Button>
                </section>
              )}
            </div>
          </main>
        </div>
      </Container>
    </div>
  );
}
