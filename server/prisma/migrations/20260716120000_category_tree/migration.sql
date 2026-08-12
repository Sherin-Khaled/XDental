-- Category hierarchy: optional parent (self-relation), display ordering, and
-- optional icon/imageUrl presentation fields. Existing flat categories keep
-- working with parentId = NULL (main categories).

-- AlterTable
ALTER TABLE "Category" ADD COLUMN "icon" TEXT;
ALTER TABLE "Category" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "Category" ADD COLUMN "parentId" TEXT;
ALTER TABLE "Category" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Category_displayOrder_idx" ON "Category"("displayOrder");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
