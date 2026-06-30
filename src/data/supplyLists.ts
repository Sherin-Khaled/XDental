export type SupplyListStatus = "Active" | "Shared" | "Archived";

export type SupplyListItem = {
  productId: string;
  quantity: number;
};

export type SupplyListDetailAvailability = "available" | "out-of-stock" | "needs-options";

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

export const supplyLists: SupplyList[] = [
  {
    id: "monthly-clinic-essentials",
    name: "Monthly Clinic Essentials",
    branch: "Main Clinic",
    description: "Reusable supplies for everyday clinic operations.",
    status: "Active",
    items: [
      { productId: "prod-1", quantity: 6 },
      { productId: "prod-3", quantity: 4 },
      { productId: "prod-4", quantity: 3 },
      { productId: "prod-6", quantity: 5 },
    ],
    productCount: 18,
    estimatedTotal: 4850,
    updatedDaysAgo: 2,
    availableCount: 16,
    outOfStockCount: 2,
    needsOptionsCount: 0,
    detailItems: [
      {
        id: "videya-k-file",
        productId: "supply-videya-k-file",
        name: "Videya K-File",
        brand: "Videya",
        sku: "VKF-25-K15",
        details: ["Length: 25mm", "Size: K15", "Pack: 1 Pack / 6 Pcs"],
        unitPrice: 220,
        quantity: 2,
        availability: "available",
        selectedOption: "25mm / K15",
        category: "Endodontics",
      },
      {
        id: "cheek-retractor",
        productId: "supply-cheek-retractor",
        name: "Cheek Retractor",
        brand: "X Dental",
        sku: "XDS-CR-001",
        details: ["Pack: 1 pcs"],
        unitPrice: 95,
        quantity: 1,
        availability: "available",
        category: "Clinic Essentials",
      },
      {
        id: "m3-pro-gold-rotary-files-double",
        productId: "supply-m3-pro-gold",
        name: "M3-Pro Gold Rotary Files Double",
        brand: "Denta Carts",
        sku: "M3-PRO-GLD-6",
        details: ["Pack: 6 pcs"],
        unitPrice: 280,
        quantity: 1,
        availability: "out-of-stock",
        category: "Endodontics",
      },
      {
        id: "quadrant-universal-composite-kit",
        productId: "supply-quadrant-composite-kit",
        name: "Quadrant Universal Composite Kit",
        brand: "Erzing Dental Supply",
        sku: "QUC-KIT",
        details: ["Shade required"],
        unitPrice: 3325,
        quantity: 1,
        availability: "needs-options",
        category: "Restorative Materials",
      },
    ],
  },
  {
    id: "endodontic-supplies",
    name: "Endodontic Supplies",
    branch: "General",
    description: "Files, irrigation tips, sealers, and endodontic essentials.",
    status: "Shared",
    items: [
      { productId: "prod-1", quantity: 4 },
      { productId: "prod-2", quantity: 2 },
      { productId: "prod-3", quantity: 3 },
    ],
    productCount: 9,
    estimatedTotal: 2340,
    updatedDaysAgo: 7,
    availableCount: 9,
    outOfStockCount: 0,
    needsOptionsCount: 0,
    detailItems: [
      {
        id: "wk-flex-k-file",
        productId: "prod-1",
        name: "WK-Flex K-File",
        brand: "Meta Biomed",
        sku: "MB-KFILE-01",
        details: ["Size: 15-40", "Pack: 1 Pack / 6 Pcs"],
        unitPrice: 150,
        quantity: 4,
        availability: "available",
        category: "Endodontics",
      },
      {
        id: "protaper-gold",
        productId: "prod-2",
        name: "ProTaper Gold",
        brand: "Dentsply Sirona",
        sku: "DPS-PTG-25",
        details: ["Length: 25mm", "Pack: SX-F3"],
        unitPrice: 1200,
        quantity: 2,
        availability: "available",
        category: "Endodontics",
      },
      {
        id: "filtek-z350",
        productId: "prod-3",
        name: "Filtek Z350 XT",
        brand: "3M",
        sku: "3M-Z350-A2",
        details: ["Shade: A2", "Pack: Single syringe"],
        unitPrice: 850,
        quantity: 3,
        availability: "available",
        category: "Composites & Bonding",
      },
    ],
  },
  {
    id: "infection-control-restock",
    name: "Infection Control Restock",
    branch: "Nasr City Branch",
    description: "Sterilization and infection control products for weekly restocking.",
    status: "Active",
    items: [
      { productId: "prod-4", quantity: 2 },
      { productId: "prod-5", quantity: 1 },
      { productId: "prod-6", quantity: 3 },
      { productId: "prod-7", quantity: 1 },
    ],
    productCount: 7,
    estimatedTotal: 1680,
    updatedDaysAgo: 3,
    availableCount: 6,
    outOfStockCount: 1,
    needsOptionsCount: 0,
    detailItems: [
      {
        id: "sterilization-pouch",
        productId: "supply-sterilization-pouch",
        name: "Sterilization Pouch",
        brand: "X Dental",
        sku: "XDS-SP-200",
        details: ["Size: Medium", "Pack: 200 pcs"],
        unitPrice: 240,
        quantity: 2,
        availability: "available",
        category: "Infection Control",
      },
      {
        id: "surface-disinfectant",
        productId: "supply-surface-disinfectant",
        name: "Surface Disinfectant",
        brand: "X Dental",
        sku: "XDS-SD-1L",
        details: ["Volume: 1L"],
        unitPrice: 185,
        quantity: 3,
        availability: "available",
        category: "Infection Control",
      },
      {
        id: "nitrile-gloves",
        productId: "supply-nitrile-gloves",
        name: "Nitrile Gloves",
        brand: "SafeDent",
        sku: "SD-GLOVE-M",
        details: ["Size: Medium", "Box: 100 pcs"],
        unitPrice: 165,
        quantity: 2,
        availability: "out-of-stock",
        category: "Infection Control",
      },
    ],
  },
];

export const SUPPLY_LISTS_STORAGE_KEY = "x-dental-supply-lists";

function cloneSupplyLists(lists: SupplyList[]): SupplyList[] {
  return JSON.parse(JSON.stringify(lists)) as SupplyList[];
}

function isSupplyListArray(value: unknown): value is SupplyList[] {
  return Array.isArray(value) && value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Partial<SupplyList>;
    return (
      typeof candidate.id === "string" &&
      typeof candidate.name === "string" &&
      Array.isArray(candidate.items) &&
      Array.isArray(candidate.detailItems)
    );
  });
}

export function summarizeSupplyList(list: SupplyList): SupplyList {
  const detailItems = list.detailItems.map((item) => ({
    ...item,
    quantity: Math.max(1, item.quantity),
  }));

  const productCount = detailItems.reduce((total, item) => total + item.quantity, 0);
  const estimatedTotal = detailItems.reduce(
    (total, item) => total + item.unitPrice * item.quantity,
    0
  );

  return {
    ...list,
    items: detailItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    })),
    detailItems,
    productCount,
    estimatedTotal,
    updatedDaysAgo: 0,
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

// Local persistence layer. Replace these helpers with API calls when the backend is added.
export function getSupplyLists(): SupplyList[] {
  if (typeof window === "undefined") {
    return cloneSupplyLists(supplyLists);
  }

  try {
    const stored = window.localStorage.getItem(SUPPLY_LISTS_STORAGE_KEY);
    if (!stored) return cloneSupplyLists(supplyLists);

    const parsed = JSON.parse(stored);
    return isSupplyListArray(parsed) ? cloneSupplyLists(parsed) : cloneSupplyLists(supplyLists);
  } catch {
    return cloneSupplyLists(supplyLists);
  }
}

export function saveSupplyLists(lists: SupplyList[]): SupplyList[] {
  const nextLists = cloneSupplyLists(lists);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(SUPPLY_LISTS_STORAGE_KEY, JSON.stringify(nextLists));
  }

  return nextLists;
}

export function getSupplyListById(id: string | undefined): SupplyList | null {
  if (!id) return null;
  return getSupplyLists().find((list) => list.id === id) ?? null;
}

export function updateSupplyList(
  id: string,
  update: Partial<SupplyList> | ((list: SupplyList) => SupplyList)
): SupplyList | null {
  const lists = getSupplyLists();
  const listIndex = lists.findIndex((list) => list.id === id);
  if (listIndex === -1) return null;

  const currentList = lists[listIndex];
  const nextList = typeof update === "function" ? update(currentList) : { ...currentList, ...update };
  const updatedList = summarizeSupplyList(nextList);
  const nextLists = lists.map((list, index) => (index === listIndex ? updatedList : list));

  saveSupplyLists(nextLists);
  return updatedList;
}

export function updateSupplyListItems(
  listId: string,
  detailItems: SupplyListDetailItem[]
): SupplyList | null {
  return updateSupplyList(listId, (list) => ({
    ...list,
    detailItems,
  }));
}
