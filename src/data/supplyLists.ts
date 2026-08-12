export type SupplyListStatus = "Active" | "Shared" | "Archived";

export type SupplyListItem = {
  productId: string;
  quantity: number;
  selectedOption?: string;
};

export type SupplyListDetailAvailability =
  | "available"
  | "out-of-stock"
  | "needs-options";

export type SupplyListDetailItem = {
  id: string;
  productId: string;
  name: string;
  brand: string;
  sku: string;
  details: string[];
  unitPrice: number;
  quantity: number;
  availability: SupplyListDetailAvailability;
  selectedOption?: string;
  category: string;
  image?: string;
  stockQuantity?: number | null;
  status?: "ACTIVE" | "LOW_STOCK" | "OUT_OF_STOCK";
  isAvailable?: boolean;
};

export type SupplyList = {
  id: string;
  name: string;
  branch: string;
  description: string;
  status: SupplyListStatus;
  items: SupplyListItem[];
  productCount: number;
  estimatedTotal: number;
  updatedDaysAgo: number;
  availableCount: number;
  outOfStockCount: number;
  needsOptionsCount: number;
  detailItems: SupplyListDetailItem[];
};

export function summarizeSupplyList(list: SupplyList): SupplyList {
  const detailItems = list.detailItems.map((item) => ({
    ...item,
    quantity: Math.max(1, item.quantity),
  }));

  const productCount = detailItems.reduce(
    (total, item) => total + item.quantity,
    0
  );
  const estimatedTotal = detailItems.reduce(
    (total, item) => total + item.unitPrice * item.quantity,
    0
  );

  return {
    ...list,
    items: detailItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      selectedOption: item.selectedOption,
    })),
    detailItems,
    productCount,
    estimatedTotal,
    updatedDaysAgo: list.updatedDaysAgo,
    availableCount: detailItems
      .filter((item) => item.availability === "available")
      .reduce((total, item) => total + item.quantity, 0),
    outOfStockCount: detailItems
      .filter((item) => item.availability === "out-of-stock")
      .reduce((total, item) => total + item.quantity, 0),
    needsOptionsCount: detailItems
      .filter((item) => item.availability === "needs-options")
      .reduce((total, item) => total + item.quantity, 0),
  };
}
