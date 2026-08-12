-- CreateTable
CREATE TABLE "cart_items" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "selectedOptions" TEXT NOT NULL DEFAULT '',
  "quantity" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_userId_productId_selectedOptions_key"
ON "cart_items"("userId", "productId", "selectedOptions");

-- CreateIndex
CREATE INDEX "cart_items_userId_updatedAt_idx"
ON "cart_items"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "cart_items_productId_idx"
ON "cart_items"("productId");

-- AddForeignKey
ALTER TABLE "cart_items"
ADD CONSTRAINT "cart_items_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items"
ADD CONSTRAINT "cart_items_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
