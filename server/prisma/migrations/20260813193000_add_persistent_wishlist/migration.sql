CREATE TABLE "wishlist_items" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wishlist_items_userId_productId_key"
ON "wishlist_items"("userId", "productId");

CREATE INDEX "wishlist_items_userId_createdAt_idx"
ON "wishlist_items"("userId", "createdAt" DESC);

CREATE INDEX "wishlist_items_productId_idx"
ON "wishlist_items"("productId");

ALTER TABLE "wishlist_items"
ADD CONSTRAINT "wishlist_items_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wishlist_items"
ADD CONSTRAINT "wishlist_items_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
