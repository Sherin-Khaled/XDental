import {
  summarizeSupplyList,
  type SupplyList,
  type SupplyListDetailAvailability,
} from "@/data/supplyLists";
import { mapProduct, type PublicCatalogProduct } from "./catalog";
import { ApiError, apiRequest } from "./http";

export type SupplyListItemInput = {
  productId: string;
  quantity: number;
  selectedOptions?: string | null;
};

export type CreateSupplyListInput = {
  name: string;
  branch: string;
  description?: string | null;
  items?: SupplyListItemInput[];
};

type SupplyListApiItem = {
  id: string;
  quantity: number;
  selectedOptions: string | null;
  createdAt: string;
  updatedAt: string;
  product: PublicCatalogProduct;
};

type SupplyListApiRecord = {
  id: string;
  name: string;
  branch: string;
  description: string | null;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
  items: SupplyListApiItem[];
};

type SupplyListResponse = {
  supplyList: SupplyListApiRecord;
};

type SupplyListsResponse = {
  supplyLists: SupplyListApiRecord[];
};

function updatedDaysAgo(updatedAt: string) {
  const timestamp = new Date(updatedAt).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
}

function availabilityForProduct(
  available: boolean
): SupplyListDetailAvailability {
  return available ? "available" : "out-of-stock";
}

function mapSupplyList(record: SupplyListApiRecord): SupplyList {
  const detailItems = record.items.map((item) => {
    const product = mapProduct(item.product);
    const selectedOption = item.selectedOptions?.trim() || undefined;
    return {
      id: item.id,
      productId: product.id,
      name: product.name,
      brand: product.brand,
      sku: product.sku ?? `SKU-${product.id}`,
      details: [
        selectedOption ? `Option: ${selectedOption}` : product.category,
      ],
      unitPrice: product.currentPrice,
      quantity: item.quantity,
      availability: availabilityForProduct(Boolean(product.available)),
      selectedOption,
      category: product.category,
      image: product.image,
      stockQuantity: product.stockQuantity,
      status: product.status,
      isAvailable: product.available,
    };
  });

  return summarizeSupplyList({
    id: record.id,
    name: record.name,
    branch: record.branch,
    description: record.description ?? "",
    status: record.status === "ARCHIVED" ? "Archived" : "Active",
    items: detailItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      selectedOption: item.selectedOption,
    })),
    productCount: 0,
    estimatedTotal: 0,
    updatedDaysAgo: updatedDaysAgo(record.updatedAt),
    availableCount: 0,
    outOfStockCount: 0,
    needsOptionsCount: 0,
    detailItems,
  });
}

export async function fetchSupplyLists(signal?: AbortSignal) {
  const response = await apiRequest<SupplyListsResponse>("/supply-lists", {
    signal,
  });
  return response.supplyLists.map(mapSupplyList);
}

export async function fetchSupplyList(
  id: string,
  signal?: AbortSignal
): Promise<SupplyList | null> {
  try {
    const response = await apiRequest<SupplyListResponse>(
      `/supply-lists/${encodeURIComponent(id)}`,
      { signal }
    );
    return mapSupplyList(response.supplyList);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function createSupplyList(input: CreateSupplyListInput) {
  const response = await apiRequest<SupplyListResponse>("/supply-lists", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return mapSupplyList(response.supplyList);
}

export async function duplicateSupplyList(id: string, name: string) {
  const response = await apiRequest<SupplyListResponse>(
    `/supply-lists/${encodeURIComponent(id)}/duplicate`,
    {
      method: "POST",
      body: JSON.stringify({ name }),
    }
  );
  return mapSupplyList(response.supplyList);
}

export async function replaceSupplyListItems(
  id: string,
  items: SupplyListItemInput[]
) {
  const response = await apiRequest<SupplyListResponse>(
    `/supply-lists/${encodeURIComponent(id)}/items`,
    {
      method: "PUT",
      body: JSON.stringify({ items }),
    }
  );
  return mapSupplyList(response.supplyList);
}

export async function mergeSupplyListItems(
  id: string,
  items: SupplyListItemInput[]
) {
  const response = await apiRequest<SupplyListResponse>(
    `/supply-lists/${encodeURIComponent(id)}/items/merge`,
    {
      method: "POST",
      body: JSON.stringify({ items }),
    }
  );
  return mapSupplyList(response.supplyList);
}

export async function deleteSupplyList(id: string) {
  await apiRequest(`/supply-lists/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
