import { mapProduct, type PublicCatalogProduct } from "./catalog";
import { apiRequest } from "./http";
import type { CartItem } from "@/types/product";

export type CartItemInput = {
  productId: string;
  quantity: number;
  selectedOptions?: string | null;
};

type CartApiItem = {
  id: string;
  quantity: number;
  selectedOptions: string | null;
  product: PublicCatalogProduct;
  createdAt: string;
  updatedAt: string;
  stockIssue: {
    code: "PRODUCT_UNAVAILABLE" | "INSUFFICIENT_STOCK";
    requestedQuantity: number;
    availableQuantity: number | null;
    productId: string;
    productName: string;
  } | null;
};

type CartResponse = {
  cart: {
    items: CartApiItem[];
  };
};

function mapCart(response: CartResponse): CartItem[] {
  return response.cart.items.map((item) => ({
    id: item.id,
    product: mapProduct(item.product),
    quantity: item.quantity,
    selectedOptions: item.selectedOptions,
    stockIssue: item.stockIssue,
  }));
}

export async function fetchMyCart(signal?: AbortSignal) {
  return mapCart(await apiRequest<CartResponse>("/cart", { signal }));
}

export async function addMyCartItem(input: CartItemInput) {
  return mapCart(await apiRequest<CartResponse>("/cart/items", {
    method: "POST",
    body: JSON.stringify(input),
  }));
}

export async function updateMyCartItem(input: CartItemInput) {
  return mapCart(await apiRequest<CartResponse>(
    `/cart/items/${encodeURIComponent(input.productId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        quantity: input.quantity,
        selectedOptions: input.selectedOptions,
      }),
    }
  ));
}

export async function removeMyCartItem(
  productId: string,
  selectedOptions?: string | null
) {
  const query = new URLSearchParams();
  if (selectedOptions?.trim()) query.set("selectedOptions", selectedOptions.trim());
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return mapCart(await apiRequest<CartResponse>(
    `/cart/items/${encodeURIComponent(productId)}${suffix}`,
    { method: "DELETE" }
  ));
}

export async function mergeMyCart(items: CartItemInput[]) {
  return mapCart(await apiRequest<CartResponse>("/cart/merge", {
    method: "POST",
    body: JSON.stringify({ items }),
  }));
}

export async function clearMyCart() {
  return mapCart(await apiRequest<CartResponse>("/cart", { method: "DELETE" }));
}
