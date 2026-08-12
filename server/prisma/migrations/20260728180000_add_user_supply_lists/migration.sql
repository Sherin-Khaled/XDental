-- Add authenticated, account-owned reusable supply lists.
CREATE TYPE "SupplyListStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TABLE "supply_lists" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "description" TEXT,
    "status" "SupplyListStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supply_lists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supply_list_items" (
    "id" TEXT NOT NULL,
    "supplyListId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "selectedOptions" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supply_list_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "supply_lists_userId_updatedAt_idx"
ON "supply_lists"("userId", "updatedAt" DESC);

CREATE INDEX "supply_lists_userId_status_idx"
ON "supply_lists"("userId", "status");

CREATE UNIQUE INDEX "supply_list_items_supplyListId_productId_selectedOptions_key"
ON "supply_list_items"("supplyListId", "productId", "selectedOptions");

CREATE INDEX "supply_list_items_supplyListId_updatedAt_idx"
ON "supply_list_items"("supplyListId", "updatedAt" DESC);

CREATE INDEX "supply_list_items_productId_idx"
ON "supply_list_items"("productId");

ALTER TABLE "supply_lists"
ADD CONSTRAINT "supply_lists_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supply_list_items"
ADD CONSTRAINT "supply_list_items_supplyListId_fkey"
FOREIGN KEY ("supplyListId") REFERENCES "supply_lists"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supply_list_items"
ADD CONSTRAINT "supply_list_items_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
