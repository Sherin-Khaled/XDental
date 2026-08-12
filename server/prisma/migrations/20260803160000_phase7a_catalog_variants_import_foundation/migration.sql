-- Phase 7A is intentionally additive. Existing simple products, legacy text
-- taxonomy, imageUrl values, carts, and order snapshots are left untouched.

CREATE TYPE "CatalogImportBatchStatus" AS ENUM ('PREVIEW', 'APPLIED', 'FAILED');
CREATE TYPE "CatalogImportRowAction" AS ENUM ('CREATE', 'UPDATE', 'SKIP', 'CONFLICT', 'ERROR');
CREATE TYPE "CatalogImportEntityType" AS ENUM ('PRODUCTS', 'VARIANTS', 'PRODUCT_OPTIONS', 'OPTION_VALUES', 'VARIANT_OPTION_VALUES', 'BRANDS', 'CATEGORIES', 'IMAGES', 'INVENTORY');

ALTER TABLE "Product"
  ADD COLUMN "brandId" TEXT,
  ADD COLUMN "categoryId" TEXT;

ALTER TABLE "Brand"
  ADD COLUMN "externalBrandId" TEXT,
  ADD COLUMN "sourceSystem" TEXT;

ALTER TABLE "Category"
  ADD COLUMN "externalCategoryId" TEXT,
  ADD COLUMN "sourceSystem" TEXT;

ALTER TABLE "cart_items"
  ADD COLUMN "variantId" TEXT;

ALTER TABLE "OrderItem"
  ADD COLUMN "variantId" TEXT,
  ADD COLUMN "externalVariantId" TEXT,
  ADD COLUMN "variantSku" TEXT,
  ADD COLUMN "variantBarcode" TEXT,
  ADD COLUMN "selectedOptions" TEXT,
  ADD COLUMN "variantUnitPrice" DECIMAL(12,2);

CREATE TABLE "product_options" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "nameAr" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_options_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_option_values" (
  "id" TEXT NOT NULL,
  "optionId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "valueEn" TEXT NOT NULL,
  "valueAr" TEXT,
  "displayHex" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_option_values_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_variants" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "externalVariantId" TEXT,
  "sourceSystem" TEXT,
  "sku" TEXT,
  "barcode" TEXT,
  "nameEn" TEXT,
  "nameAr" TEXT,
  "priceOverride" DECIMAL(12,2),
  "stockQuantity" INTEGER NOT NULL DEFAULT 0,
  "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
  "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
  "isAvailable" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_variant_option_values" (
  "variantId" TEXT NOT NULL,
  "optionId" TEXT NOT NULL,
  "optionValueId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_variant_option_values_pkey" PRIMARY KEY ("variantId", "optionValueId")
);

CREATE TABLE "product_images" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT,
  "url" TEXT NOT NULL,
  "altEn" TEXT,
  "altAr" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "sourceSystem" TEXT,
  "sourceUrl" TEXT,
  "rightsConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "rightsNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "catalog_import_batches" (
  "id" TEXT NOT NULL,
  "sourceSystem" TEXT NOT NULL,
  "filename" TEXT,
  "status" "CatalogImportBatchStatus" NOT NULL DEFAULT 'PREVIEW',
  "dryRun" BOOLEAN NOT NULL DEFAULT true,
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "validRows" INTEGER NOT NULL DEFAULT 0,
  "warningRows" INTEGER NOT NULL DEFAULT 0,
  "errorRows" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "appliedAt" TIMESTAMP(3),
  CONSTRAINT "catalog_import_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "catalog_import_rows" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "entityType" "CatalogImportEntityType" NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "externalId" TEXT,
  "sku" TEXT,
  "action" "CatalogImportRowAction" NOT NULL,
  "validationMessages" JSONB NOT NULL DEFAULT '[]',
  "normalizedPayload" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "catalog_import_rows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Brand_sourceSystem_externalBrandId_key" ON "Brand"("sourceSystem", "externalBrandId");
CREATE UNIQUE INDEX "Category_sourceSystem_externalCategoryId_key" ON "Category"("sourceSystem", "externalCategoryId");
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX "cart_items_variantId_idx" ON "cart_items"("variantId");
CREATE INDEX "OrderItem_variantId_idx" ON "OrderItem"("variantId");
CREATE INDEX "OrderItem_externalVariantId_idx" ON "OrderItem"("externalVariantId");
CREATE UNIQUE INDEX "product_options_productId_code_key" ON "product_options"("productId", "code");
CREATE INDEX "product_options_productId_sortOrder_idx" ON "product_options"("productId", "sortOrder");
CREATE UNIQUE INDEX "product_option_values_optionId_code_key" ON "product_option_values"("optionId", "code");
CREATE INDEX "product_option_values_optionId_sortOrder_idx" ON "product_option_values"("optionId", "sortOrder");
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");
CREATE UNIQUE INDEX "product_variants_barcode_key" ON "product_variants"("barcode");
CREATE UNIQUE INDEX "product_variants_sourceSystem_externalVariantId_key" ON "product_variants"("sourceSystem", "externalVariantId");
CREATE INDEX "product_variants_productId_sortOrder_idx" ON "product_variants"("productId", "sortOrder");
CREATE INDEX "product_variants_productId_status_isAvailable_idx" ON "product_variants"("productId", "status", "isAvailable");
CREATE UNIQUE INDEX "product_variant_option_values_variantId_optionId_key" ON "product_variant_option_values"("variantId", "optionId");
CREATE INDEX "product_variant_option_values_optionValueId_idx" ON "product_variant_option_values"("optionValueId");
CREATE INDEX "product_images_productId_variantId_sortOrder_idx" ON "product_images"("productId", "variantId", "sortOrder");
-- PostgreSQL partial unique indexes enforce one primary image in each scope.
CREATE UNIQUE INDEX "product_images_primary_product_scope_key" ON "product_images"("productId") WHERE "variantId" IS NULL AND "isPrimary" = true;
CREATE UNIQUE INDEX "product_images_primary_variant_scope_key" ON "product_images"("variantId") WHERE "variantId" IS NOT NULL AND "isPrimary" = true;
CREATE INDEX "catalog_import_batches_sourceSystem_createdAt_idx" ON "catalog_import_batches"("sourceSystem", "createdAt");
CREATE INDEX "catalog_import_batches_status_createdAt_idx" ON "catalog_import_batches"("status", "createdAt");
CREATE INDEX "catalog_import_rows_batchId_entityType_rowNumber_idx" ON "catalog_import_rows"("batchId", "entityType", "rowNumber");
CREATE INDEX "catalog_import_rows_batchId_action_idx" ON "catalog_import_rows"("batchId", "action");

ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_options" ADD CONSTRAINT "product_options_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_option_values" ADD CONSTRAINT "product_option_values_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "product_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_variant_option_values" ADD CONSTRAINT "product_variant_option_values_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_variant_option_values" ADD CONSTRAINT "product_variant_option_values_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "product_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_variant_option_values" ADD CONSTRAINT "product_variant_option_values_optionValueId_fkey" FOREIGN KEY ("optionValueId") REFERENCES "product_option_values"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catalog_import_batches" ADD CONSTRAINT "catalog_import_batches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "catalog_import_rows" ADD CONSTRAINT "catalog_import_rows_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "catalog_import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
