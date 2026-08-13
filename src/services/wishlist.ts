import { apiRequest } from "./http";

type WishlistResponse = {
  wishlist: { productIds: string[] };
};

function ids(response: WishlistResponse) {
  return response.wishlist.productIds;
}

export async function fetchMyWishlist(signal?: AbortSignal) {
  return ids(await apiRequest<WishlistResponse>("/wishlist", { signal }));
}

export async function addMyWishlistItem(productId: string) {
  return ids(await apiRequest<WishlistResponse>("/wishlist/items", {
    method: "POST",
    body: JSON.stringify({ productId }),
  }));
}

export async function removeMyWishlistItem(productId: string) {
  return ids(await apiRequest<WishlistResponse>(
    `/wishlist/items/${encodeURIComponent(productId)}`,
    { method: "DELETE" }
  ));
}

export async function mergeMyWishlist(productIds: string[]) {
  return ids(await apiRequest<WishlistResponse>("/wishlist/merge", {
    method: "POST",
    body: JSON.stringify({ productIds }),
  }));
}

export async function clearMyWishlist() {
  return ids(await apiRequest<WishlistResponse>("/wishlist", { method: "DELETE" }));
}
