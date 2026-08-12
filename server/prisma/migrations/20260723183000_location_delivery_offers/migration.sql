-- CreateEnum
CREATE TYPE "DeliveryOfferType" AS ENUM (
    'SAME_DAY_DELIVERY',
    'FREE_DELIVERY',
    'DISCOUNTED_DELIVERY',
    'CUSTOM'
);

-- CreateEnum
CREATE TYPE "DeliveryRecurrenceType" AS ENUM (
    'WEEKLY',
    'SPECIFIC_DATE',
    'DATE_RANGE'
);

-- CreateTable
CREATE TABLE "delivery_zones" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_clinic_locations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deliveryZoneId" TEXT NOT NULL,
    "customArea" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_clinic_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_offers" (
    "id" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "descriptionAr" TEXT NOT NULL,
    "offerType" "DeliveryOfferType" NOT NULL,
    "recurrenceType" "DeliveryRecurrenceType" NOT NULL,
    "weekdays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "specificDate" DATE,
    "startDate" DATE,
    "endDate" DATE,
    "cutoffTime" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Cairo',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_offer_zones" (
    "deliveryOfferId" TEXT NOT NULL,
    "deliveryZoneId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_offer_zones_pkey" PRIMARY KEY ("deliveryOfferId", "deliveryZoneId")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_zones_slug_key" ON "delivery_zones"("slug");

-- CreateIndex
CREATE INDEX "delivery_zones_isActive_displayOrder_idx" ON "delivery_zones"("isActive", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "user_clinic_locations_userId_deliveryZoneId_key" ON "user_clinic_locations"("userId", "deliveryZoneId");

-- CreateIndex
CREATE INDEX "user_clinic_locations_deliveryZoneId_idx" ON "user_clinic_locations"("deliveryZoneId");

-- CreateIndex
CREATE INDEX "delivery_offers_isActive_recurrenceType_idx" ON "delivery_offers"("isActive", "recurrenceType");

-- CreateIndex
CREATE INDEX "delivery_offer_zones_deliveryZoneId_idx" ON "delivery_offer_zones"("deliveryZoneId");

-- AddForeignKey
ALTER TABLE "user_clinic_locations"
ADD CONSTRAINT "user_clinic_locations_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_clinic_locations"
ADD CONSTRAINT "user_clinic_locations_deliveryZoneId_fkey"
FOREIGN KEY ("deliveryZoneId") REFERENCES "delivery_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_offer_zones"
ADD CONSTRAINT "delivery_offer_zones_deliveryOfferId_fkey"
FOREIGN KEY ("deliveryOfferId") REFERENCES "delivery_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_offer_zones"
ADD CONSTRAINT "delivery_offer_zones_deliveryZoneId_fkey"
FOREIGN KEY ("deliveryZoneId") REFERENCES "delivery_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Initial selectable delivery zones. IDs and slugs are stable and language-neutral.
INSERT INTO "delivery_zones"
    ("id", "slug", "nameEn", "nameAr", "isActive", "displayOrder", "createdAt", "updatedAt")
VALUES
    ('zone-new-cairo', 'new-cairo', 'New Cairo', 'القاهرة الجديدة', true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('zone-nasr-city', 'nasr-city', 'Nasr City', 'مدينة نصر', true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('zone-heliopolis', 'heliopolis', 'Heliopolis', 'مصر الجديدة', true, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('zone-maadi', 'maadi', 'Maadi', 'المعادي', true, 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('zone-dokki', 'dokki', 'Dokki', 'الدقي', true, 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('zone-mohandessin', 'mohandessin', 'Mohandessin', 'المهندسين', true, 60, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('zone-sixth-october', '6th-of-october', '6th of October', 'السادس من أكتوبر', true, 70, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('zone-sheikh-zayed', 'sheikh-zayed', 'Sheikh Zayed', 'الشيخ زايد', true, 80, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('zone-other', 'other', 'Other', 'أخرى', true, 90, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
