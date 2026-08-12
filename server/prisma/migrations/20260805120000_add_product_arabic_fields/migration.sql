-- Adds bilingual (Arabic) product fields alongside the existing English ones.
-- All nullable additive columns; no existing data or columns are touched.
ALTER TABLE "Product" ADD COLUMN "nameAr" TEXT;
ALTER TABLE "Product" ADD COLUMN "descriptionAr" TEXT;
ALTER TABLE "Product" ADD COLUMN "shortDescription" TEXT;
ALTER TABLE "Product" ADD COLUMN "shortDescriptionAr" TEXT;
