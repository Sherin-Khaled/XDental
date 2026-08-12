-- CreateEnum
CREATE TYPE "CategoryStatus" AS ENUM ('ACTIVE', 'DRAFT', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'LOW_STOCK', 'OUT_OF_STOCK', 'DRAFT', 'INACTIVE');

-- AlterTable
ALTER TABLE "Product"
ADD COLUMN "slug" TEXT,
ADD COLUMN "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;

-- Give existing imported products stable unique slugs without changing their IDs.
UPDATE "Product"
SET "slug" = COALESCE(
  NULLIF(TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER("name"), '[^a-z0-9]+', '-', 'g')), ''),
  'product'
) || '-' || SUBSTRING(MD5("id"), 1, 8);

UPDATE "Product"
SET "status" = CASE
  WHEN "isAvailable" = false THEN 'INACTIVE'::"ProductStatus"
  WHEN "stockQuantity" = 0 THEN 'OUT_OF_STOCK'::"ProductStatus"
  WHEN "stockQuantity" BETWEEN 1 AND 5 THEN 'LOW_STOCK'::"ProductStatus"
  ELSE 'ACTIVE'::"ProductStatus"
END;

ALTER TABLE "Product" ALTER COLUMN "slug" SET NOT NULL;

-- CreateTable
CREATE TABLE "Category" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- Backfill real category records from any existing imported products.
WITH existing_categories AS (
  SELECT MIN(TRIM("category")) AS "name"
  FROM "Product"
  WHERE "category" IS NOT NULL AND TRIM("category") <> ''
  GROUP BY LOWER(TRIM("category"))
)
INSERT INTO "Category" ("id", "name", "slug", "status")
SELECT
  'cat_' || SUBSTRING(MD5(LOWER("name")), 1, 20),
  "name",
  COALESCE(
    NULLIF(TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER("name"), '[^a-z0-9]+', '-', 'g')), ''),
    'category'
  ) || '-' || SUBSTRING(MD5(LOWER("name")), 1, 8),
  'ACTIVE'::"CategoryStatus"
FROM existing_categories;

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Product_status_idx" ON "Product"("status");
CREATE INDEX "Product_featured_idx" ON "Product"("featured");
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_status_idx" ON "Category"("status");
