import { isValidId } from "../utils/records.js";

export const MAX_WISHLIST_ITEMS = 100;
const PUBLIC_PRODUCT_STATUSES = ["ACTIVE", "LOW_STOCK", "OUT_OF_STOCK"];

export class WishlistRequestError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "WishlistRequestError";
    this.statusCode = statusCode;
  }
}

function parseProductId(value) {
  const productId = typeof value === "string" ? value.trim() : "";
  if (!isValidId(productId)) throw new WishlistRequestError(400, "A valid product is required.");
  return productId;
}

const publicProductWhere = {
  status: { in: PUBLIC_PRODUCT_STATUSES },
  price: { not: null },
};

export async function getUserWishlist(database, userId) {
  const items = await database.wishlistItem.findMany({
    where: { userId, product: publicProductWhere },
    select: { productId: true },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
  return items.map(({ productId }) => productId);
}

export async function addUserWishlistItem(database, userId, input) {
  const productId = parseProductId(input?.productId);
  await database.$transaction(async (transaction) => {
    const product = await transaction.product.findFirst({
      where: { id: productId, ...publicProductWhere },
      select: { id: true },
    });
    if (!product) throw new WishlistRequestError(404, "Product not found.");
    const existing = await transaction.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
      select: { id: true },
    });
    if (existing) return;
    const count = await transaction.wishlistItem.count({ where: { userId } });
    if (count >= MAX_WISHLIST_ITEMS) {
      throw new WishlistRequestError(409, `A wishlist cannot contain more than ${MAX_WISHLIST_ITEMS} products.`);
    }
    await transaction.wishlistItem.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: {},
    });
  });
}

export async function removeUserWishlistItem(database, userId, rawProductId) {
  const productId = parseProductId(rawProductId);
  await database.wishlistItem.deleteMany({ where: { userId, productId } });
}

export async function clearUserWishlist(database, userId) {
  await database.wishlistItem.deleteMany({ where: { userId } });
}

export async function mergeUserWishlist(database, userId, values) {
  if (!Array.isArray(values) || values.length > MAX_WISHLIST_ITEMS) {
    throw new WishlistRequestError(400, `A wishlist merge must contain no more than ${MAX_WISHLIST_ITEMS} products.`);
  }
  const productIds = [...new Set(values.map(parseProductId))];
  if (productIds.length === 0) return;
  await database.$transaction(async (transaction) => {
    const products = await transaction.product.findMany({
      where: { id: { in: productIds }, ...publicProductWhere },
      select: { id: true },
    });
    const existing = await transaction.wishlistItem.findMany({
      where: { userId },
      select: { productId: true },
    });
    const existingIds = new Set(existing.map(({ productId }) => productId));
    const additions = products.filter(({ id }) => !existingIds.has(id));
    if (existing.length + additions.length > MAX_WISHLIST_ITEMS) {
      throw new WishlistRequestError(409, `A wishlist cannot contain more than ${MAX_WISHLIST_ITEMS} products.`);
    }
    if (additions.length > 0) {
      await transaction.wishlistItem.createMany({
        data: additions.map(({ id: productId }) => ({ userId, productId })),
        skipDuplicates: true,
      });
    }
  });
}
