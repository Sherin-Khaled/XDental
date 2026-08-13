ALTER TABLE "user_clinic_locations"
ADD COLUMN "label" TEXT,
ADD COLUMN "addressLine" TEXT,
ADD COLUMN "governorate" TEXT,
ADD COLUMN "cityArea" TEXT,
ADD COLUMN "buildingNumber" TEXT,
ADD COLUMN "apartmentFloor" TEXT,
ADD COLUMN "postalCode" TEXT,
ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

WITH ranked_locations AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "userId"
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS location_rank
  FROM "user_clinic_locations"
)
UPDATE "user_clinic_locations" AS location
SET "isDefault" = true
FROM ranked_locations
WHERE location."id" = ranked_locations."id"
  AND ranked_locations.location_rank = 1;

CREATE INDEX "user_clinic_locations_userId_isDefault_idx"
ON "user_clinic_locations"("userId", "isDefault");
