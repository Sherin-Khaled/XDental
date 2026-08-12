-- Add a draft/publish lifecycle while preserving the existing published JSON.
CREATE TYPE "HeroSlideStatus" AS ENUM ('DRAFT', 'PUBLISHED');

ALTER TABLE "hero_slides"
ADD COLUMN "slotNumber" INTEGER,
ADD COLUMN "status" "HeroSlideStatus" NOT NULL DEFAULT 'PUBLISHED',
ADD COLUMN "draftData" JSONB,
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "updatedById" TEXT;

-- Existing rows are the currently visible, published slides.
UPDATE "hero_slides"
SET
  "slotNumber" = CASE
    WHEN "order" BETWEEN 1 AND 3 THEN "order"
    ELSE ranked."position"
  END,
  "publishedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP)
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "order", "createdAt", "id")::INTEGER AS "position"
  FROM "hero_slides"
) AS ranked
WHERE "hero_slides"."id" = ranked."id";

ALTER TABLE "hero_slides" ALTER COLUMN "slotNumber" SET NOT NULL;

CREATE UNIQUE INDEX "hero_slides_slotNumber_key" ON "hero_slides"("slotNumber");
CREATE UNIQUE INDEX "hero_slides_order_key" ON "hero_slides"("order");
CREATE INDEX "hero_slides_publishedAt_isActive_order_idx" ON "hero_slides"("publishedAt", "isActive", "order");
CREATE INDEX "hero_slides_updatedById_idx" ON "hero_slides"("updatedById");

ALTER TABLE "hero_slides"
ADD CONSTRAINT "hero_slides_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
