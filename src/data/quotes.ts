import type { CartItem } from "@/types/product";

export type QuoteStatus = "Pending Review" | "Approved" | "Accepted" | "Expired";
export type QuoteTab = "active" | "history";
export type QuoteStepStatus = "completed" | "current" | "pending";
export type QuoteProductStatus = "Available" | "Limited Stock" | "Backordered";

export type QuoteSummary = {
  id: string;
  quoteNumber: string;
  requestedAt: string;
  productCount: number;
  previewCount: number;
  source: string;
  branch: string;
  status: QuoteStatus;
  total: number;
  expiresAt?: string;
  approvedAt?: string;
  acceptedAt?: string;
  previousOrder?: string;
  tab: QuoteTab;
  isVisible?: boolean;
};

export type QuoteProduct = {
  id: string;
  name: string;
  supplier: string;
  meta: string;
  requestedQty: number;
  originalPrice: number;
  quotedPrice: number;
  lineTotal: number;
  savings: number;
  status: QuoteProductStatus;
};

export type QuoteStatusStep = {
  label: string;
  date?: string;
  note?: string;
  status: QuoteStepStatus;
};

export type QuoteActivity = {
  title: string;
  date: string;
  status?: QuoteStepStatus;
};

export type QuoteDetail = QuoteSummary & {
  quotedSubtotal: number;
  originalSubtotal: number;
  quoteDiscount: number;
  shippingEstimate: number;
  taxNote: string;
  customerRequest: string;
  requestSource: string;
  salesNotes: string;
  preparedBy: string;
  products: QuoteProduct[];
  statusSteps: QuoteStatusStep[];
  activity: QuoteActivity[];
  contact: {
    name: string;
    phone: string;
    email: string;
    branch: string;
    address: string;
  };
};

export type StoredQuoteRequestItem = {
  productId: string;
  name: string;
  image?: string;
  brand: string;
  category: string;
  sku?: string;
  option?: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type StoredQuoteDiscount = {
  code: string;
  label: string;
  type: string;
  value: number;
  amount: number;
};

type StoredQuoteStatus = QuoteStatus | "Pending";

export type StoredQuoteRequest = {
  id: string;
  quoteNumber: string;
  userId?: string;
  items: StoredQuoteRequestItem[];
  subtotal: number;
  shipping: number;
  discount?: StoredQuoteDiscount;
  estimatedTotal: number;
  status: StoredQuoteStatus;
  createdAt: string;
  requestedAt: string;
};

const QUOTE_REQUESTS_STORAGE_KEY = "x-dental-quote-requests";

export const quoteSummaries: QuoteSummary[] = [
  {
    id: "xq-2041",
    quoteNumber: "XQ-2041",
    requestedAt: "2025-07-24",
    productCount: 12,
    previewCount: 9,
    source: "Monthly Clinic Essentials",
    branch: "Main Clinic",
    status: "Pending Review",
    total: 4850,
    tab: "active",
  },
  {
    id: "xq-2038",
    quoteNumber: "XQ-2038",
    requestedAt: "2025-07-20",
    productCount: 4,
    previewCount: 1,
    source: "Manual Request",
    branch: "Dokki Branch",
    status: "Approved",
    total: 9210,
    approvedAt: "2025-07-22",
    expiresAt: "2025-07-30",
    tab: "active",
  },
  {
    id: "xq-2034",
    quoteNumber: "XQ-2034",
    requestedAt: "2025-07-18",
    productCount: 6,
    previewCount: 3,
    source: "Clinic Restock",
    branch: "Main Clinic",
    status: "Pending Review",
    total: 2760,
    tab: "active",
    isVisible: false,
  },
  {
    id: "xq-2029",
    quoteNumber: "XQ-2029",
    requestedAt: "2025-07-10",
    productCount: 15,
    previewCount: 9,
    source: "Previous Order",
    previousOrder: "#XD-10212",
    branch: "Main Clinic",
    status: "Accepted",
    total: 7150,
    acceptedAt: "2025-07-12",
    tab: "history",
  },
  {
    id: "xq-2018",
    quoteNumber: "XQ-2018",
    requestedAt: "2025-07-20",
    productCount: 8,
    previewCount: 5,
    source: "Wishlist",
    branch: "General",
    status: "Expired",
    total: 2950,
    expiresAt: "2025-07-05",
    tab: "history",
  },
];

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readStoredQuoteRequests(): StoredQuoteRequest[] {
  if (!canUseStorage()) return [];

  try {
    const storedValue = window.localStorage.getItem(QUOTE_REQUESTS_STORAGE_KEY);
    const parsedValue = storedValue ? JSON.parse(storedValue) : [];

    if (!Array.isArray(parsedValue)) return [];

    return parsedValue.filter((quote): quote is StoredQuoteRequest => {
      return (
        quote &&
        typeof quote.id === "string" &&
        typeof quote.quoteNumber === "string" &&
        Array.isArray(quote.items) &&
        typeof quote.estimatedTotal === "number" &&
        typeof quote.createdAt === "string"
      );
    });
  } catch {
    return [];
  }
}

function writeStoredQuoteRequests(quotes: StoredQuoteRequest[]) {
  if (!canUseStorage()) return;

  try {
    window.localStorage.setItem(QUOTE_REQUESTS_STORAGE_KEY, JSON.stringify(quotes));
  } catch {
    // Ignore storage failures; the current page state can still show feedback.
  }
}

function parseQuoteNumber(quoteNumber: string) {
  const value = Number(quoteNumber.replace(/^XQ-/i, ""));
  return Number.isFinite(value) ? value : 0;
}

function getNextQuoteNumber(storedQuotes: StoredQuoteRequest[]) {
  const highestQuoteNumber = Math.max(
    2041,
    ...quoteSummaries.map((quote) => parseQuoteNumber(quote.quoteNumber)),
    ...storedQuotes.map((quote) => parseQuoteNumber(quote.quoteNumber))
  );

  return `XQ-${highestQuoteNumber + 1}`;
}

function quoteBelongsToUser(quote: StoredQuoteRequest, userId?: string) {
  return !userId || quote.userId === userId;
}

function storedStatusToQuoteStatus(status: StoredQuoteStatus): QuoteStatus {
  return status === "Pending" ? "Pending Review" : status;
}

function storedQuoteToSummary(quote: StoredQuoteRequest): QuoteSummary {
  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    requestedAt: quote.requestedAt,
    productCount: quote.items.reduce((total, item) => total + item.quantity, 0),
    previewCount: Math.min(quote.items.length, 3),
    source: "Cart Request",
    branch: "Main Clinic",
    status: storedStatusToQuoteStatus(quote.status),
    total: quote.estimatedTotal,
    tab: "active",
  };
}

function storedQuoteToDetail(quote: StoredQuoteRequest): QuoteDetail {
  const discount = quote.discount?.amount ?? 0;
  const hasShippingDiscount = quote.discount?.type === "free_shipping";
  const quotedSubtotal = hasShippingDiscount ? quote.subtotal : Math.max(quote.subtotal - discount, 0);
  const shippingEstimate = hasShippingDiscount ? Math.max(quote.shipping - discount, 0) : quote.shipping;
  const products: QuoteProduct[] = quote.items.map((item) => ({
    id: item.productId,
    name: item.name,
    supplier: item.brand,
    meta: [item.category, item.sku, item.option].filter(Boolean).join(" - "),
    requestedQty: item.quantity,
    originalPrice: item.unitPrice,
    quotedPrice: item.unitPrice,
    lineTotal: item.subtotal,
    savings: 0,
    status: "Available",
  }));

  return {
    ...storedQuoteToSummary(quote),
    originalSubtotal: quote.subtotal,
    quotedSubtotal,
    quoteDiscount: discount,
    shippingEstimate,
    taxNote: "Calculated if applicable",
    customerRequest: "Quote request created from cart items.",
    requestSource: "Cart Request",
    salesNotes: "Sales team will review quantities, availability, and clinic pricing before approval.",
    preparedBy: "Sales Team",
    products,
    statusSteps: [
      { label: "Submitted", date: quote.requestedAt, status: "completed" },
      { label: "Under Review", note: "Current", status: "current" },
      { label: "Approved", note: "Pending", status: "pending" },
      { label: "Accepted", note: "Pending", status: "pending" },
    ],
    activity: [
      { title: "Quote request submitted", date: quote.requestedAt, status: "completed" },
      { title: "Sales team review pending", date: quote.requestedAt, status: "current" },
    ],
    contact: {
      name: "Dental Professional",
      phone: "",
      email: "",
      branch: "Main Clinic",
      address: "Main Clinic, Cairo",
    },
  };
}

export function getStoredQuoteSummaries(userId?: string) {
  return readStoredQuoteRequests()
    .filter((quote) => quoteBelongsToUser(quote, userId))
    .map(storedQuoteToSummary);
}

export function getStoredQuoteDetail(id?: string, userId?: string) {
  if (!id) return undefined;

  const normalizedId = id.toLowerCase();
  const storedQuote = readStoredQuoteRequests().find(
    (quote) =>
      quoteBelongsToUser(quote, userId) &&
      (quote.id.toLowerCase() === normalizedId ||
        quote.quoteNumber.toLowerCase() === normalizedId)
  );

  return storedQuote ? storedQuoteToDetail(storedQuote) : undefined;
}

export function saveCartQuoteRequest({
  userId,
  items,
  subtotal,
  shipping,
  discount,
  estimatedTotal,
}: {
  userId?: string;
  items: CartItem[];
  subtotal: number;
  shipping: number;
  discount?: StoredQuoteDiscount;
  estimatedTotal: number;
}) {
  const storedQuotes = readStoredQuoteRequests();
  const quoteNumber = getNextQuoteNumber(storedQuotes);
  const createdAt = new Date().toISOString();
  const quote: StoredQuoteRequest = {
    id: quoteNumber.toLowerCase(),
    quoteNumber,
    userId,
    items: items.map((item) => ({
      productId: item.product.id,
      name: item.product.name,
      image: item.product.image,
      brand: item.product.brand,
      category: item.product.category,
      sku: item.product.sku ?? undefined,
      option: item.selectedOptions ?? undefined,
      quantity: item.quantity,
      unitPrice: item.product.currentPrice,
      subtotal: item.product.currentPrice * item.quantity,
    })),
    subtotal,
    shipping,
    discount,
    estimatedTotal,
    status: "Pending",
    createdAt,
    requestedAt: createdAt.slice(0, 10),
  };

  writeStoredQuoteRequests([quote, ...storedQuotes]);
  return quote;
}

const quotedProducts: QuoteProduct[] = [
  {
    id: "quadrant-composite-kit",
    name: "Quadrant Universal Composite Kit",
    supplier: "Erzing Dental Supply",
    meta: "Shade A2 - Pack: Kit",
    requestedQty: 2,
    originalPrice: 3325,
    quotedPrice: 3050,
    lineTotal: 6100,
    savings: 550,
    status: "Available",
  },
  {
    id: "videya-k-file",
    name: "Videya K-File",
    supplier: "Videya",
    meta: "Length: 25mm - Size: K15 - Pack: 1 Pack / 6 Pcs",
    requestedQty: 4,
    originalPrice: 229,
    quotedPrice: 200,
    lineTotal: 800,
    savings: 80,
    status: "Available",
  },
  {
    id: "sterilization-pouches",
    name: "Sterilization Pouches",
    supplier: "X Dental",
    meta: "Pack: 200 pcs",
    requestedQty: 3,
    originalPrice: 240,
    quotedPrice: 225,
    lineTotal: 675,
    savings: 45,
    status: "Available",
  },
  {
    id: "m3-pro-rotary-files",
    name: "M3-Pro Gold Rotary Files Double",
    supplier: "Denta Carts",
    meta: "Pack: 6 pcs",
    requestedQty: 2,
    originalPrice: 280,
    quotedPrice: 260,
    lineTotal: 520,
    savings: 40,
    status: "Limited Stock",
  },
];

const approvedSteps: QuoteStatusStep[] = [
  { label: "Submitted", date: "2025-07-20", status: "completed" },
  { label: "Under Review", date: "2025-07-21", status: "completed" },
  { label: "Approved", date: "2025-07-22", status: "current" },
  { label: "Accepted", note: "Pending", status: "pending" },
];

const defaultActivity: QuoteActivity[] = [
  { title: "Quote request submitted", date: "2025-07-20", status: "completed" },
  { title: "Sales team reviewed your request", date: "2025-07-21", status: "completed" },
  { title: "Quote approved", date: "2025-07-22", status: "current" },
  { title: "Quote expires", date: "2025-07-30", status: "pending" },
];

function createDetail(summary: QuoteSummary): QuoteDetail {
  const isPending = summary.status === "Pending Review";
  const isAccepted = summary.status === "Accepted";
  const isExpired = summary.status === "Expired";
  const quotedSubtotal = summary.id === "xq-2038" ? 9130 : Math.max(summary.total - 80, 0);
  const discount = summary.id === "xq-2038" ? 720 : Math.round(quotedSubtotal * 0.08);

  return {
    ...summary,
    productCount: summary.id === "xq-2038" ? 4 : summary.productCount,
    originalSubtotal: summary.id === "xq-2038" ? 9850 : quotedSubtotal + discount,
    quotedSubtotal,
    quoteDiscount: discount,
    shippingEstimate: summary.total > 0 ? 80 : 0,
    taxNote: "Calculated if applicable",
    customerRequest:
      "Need bulk pricing for restorative materials and monthly clinic essentials. Preferred delivery within one week.",
    requestSource: summary.source,
    salesNotes:
      "We applied clinic pricing for the selected quantities. Some items may require confirmation before shipping.",
    preparedBy: "Sales Team",
    products: quotedProducts,
    statusSteps: isPending
      ? [
          { label: "Submitted", date: summary.requestedAt, status: "completed" },
          { label: "Under Review", note: "Current", status: "current" },
          { label: "Approved", note: "Pending", status: "pending" },
          { label: "Accepted", note: "Pending", status: "pending" },
        ]
      : isAccepted
        ? [
            { label: "Submitted", date: summary.requestedAt, status: "completed" },
            { label: "Under Review", date: "2025-07-11", status: "completed" },
            { label: "Approved", date: "2025-07-12", status: "completed" },
            { label: "Accepted", date: summary.acceptedAt, status: "current" },
          ]
        : isExpired
          ? [
              { label: "Submitted", date: summary.requestedAt, status: "completed" },
              { label: "Under Review", date: "2025-07-21", status: "completed" },
              { label: "Approved", date: "2025-07-22", status: "completed" },
              { label: "Expired", date: summary.expiresAt, status: "current" },
            ]
          : approvedSteps,
    activity: defaultActivity,
    contact: {
      name: "Dr. Sarah Khaled",
      phone: "+20 111 222 3333",
      email: "sarah@example.com",
      branch: summary.branch,
      address: summary.branch === "Dokki Branch" ? "22 Tahrir Street, Floor 3, Giza" : "Main Clinic, Cairo",
    },
  };
}

export function getQuoteDetail(
  id?: string,
  userId?: string,
  includeMockQuotes = true
): QuoteDetail | undefined {
  if (!id) return undefined;

  const normalizedId = id.toLowerCase();
  const storedQuote = getStoredQuoteDetail(id, userId);

  if (storedQuote) return storedQuote;
  if (!includeMockQuotes) return undefined;

  const summary = quoteSummaries.find(
    (quote) =>
      quote.id.toLowerCase() === normalizedId ||
      quote.quoteNumber.toLowerCase() === normalizedId
  );

  if (summary) return createDetail(summary);

  if (/^xq-\d+$/.test(normalizedId)) {
    return createDetail({
      id: normalizedId,
      quoteNumber: normalizedId.toUpperCase(),
      requestedAt: new Date().toISOString().slice(0, 10),
      productCount: 1,
      previewCount: 1,
      source: "Manual Request",
      branch: "Main Clinic",
      status: "Pending Review",
      total: 0,
      tab: "active",
    });
  }

  return undefined;
}
