import { prisma } from "../config/db.js";
import {
  WishlistRequestError,
  addUserWishlistItem,
  clearUserWishlist,
  getUserWishlist,
  mergeUserWishlist,
  removeUserWishlistItem,
} from "../services/wishlist.service.js";

function wishlistError(response, error) {
  if (!(error instanceof WishlistRequestError)) return false;
  response.status(error.statusCode).json({ message: error.message });
  return true;
}

async function sendWishlist(response, userId) {
  return response.json({ wishlist: { productIds: await getUserWishlist(prisma, userId) } });
}

export async function getMyWishlist(request, response) {
  return sendWishlist(response, request.user.id);
}

export async function addMyWishlistItem(request, response) {
  try {
    await addUserWishlistItem(prisma, request.user.id, request.body);
    return sendWishlist(response, request.user.id);
  } catch (error) {
    if (wishlistError(response, error)) return;
    throw error;
  }
}

export async function removeMyWishlistItem(request, response) {
  try {
    await removeUserWishlistItem(prisma, request.user.id, request.params.productId);
    return sendWishlist(response, request.user.id);
  } catch (error) {
    if (wishlistError(response, error)) return;
    throw error;
  }
}

export async function mergeMyWishlist(request, response) {
  try {
    await mergeUserWishlist(prisma, request.user.id, request.body?.productIds);
    return sendWishlist(response, request.user.id);
  } catch (error) {
    if (wishlistError(response, error)) return;
    throw error;
  }
}

export async function clearMyWishlist(request, response) {
  await clearUserWishlist(prisma, request.user.id);
  return response.json({ wishlist: { productIds: [] } });
}
