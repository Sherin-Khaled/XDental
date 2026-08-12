-- CreateEnum
CREATE TYPE "BrandStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'NEEDS_LOGO');

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "country" TEXT,
    "logoUrl" TEXT,
    "description" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "status" "BrandStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- Backfill distinct brand names already referenced by products.
INSERT INTO "Brand" ("id", "name", "slug", "status", "createdAt", "updatedAt")
SELECT
    'brand_' || md5(lower(btrim(MIN("brand")))),
    btrim(MIN("brand")),
    COALESCE(NULLIF(trim(both '-' from regexp_replace(lower(btrim(MIN("brand"))), '[^a-z0-9]+', '-', 'g')), ''), 'brand') || '-' || substr(md5(lower(btrim(MIN("brand")))), 1, 6),
    'NEEDS_LOGO'::"BrandStatus",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Product"
WHERE "brand" IS NOT NULL AND btrim("brand") <> ''
GROUP BY lower(btrim("brand"));

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");
CREATE INDEX "Brand_status_idx" ON "Brand"("status");
CREATE INDEX "Brand_featured_idx" ON "Brand"("featured");
CREATE INDEX "Brand_country_idx" ON "Brand"("country");
