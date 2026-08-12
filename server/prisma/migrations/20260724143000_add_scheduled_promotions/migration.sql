-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM (
  'INFORMATIONAL',
  'PERCENTAGE_DISCOUNT',
  'FIXED_DISCOUNT',
  'COUPON',
  'FREE_DELIVERY',
  'CUSTOM'
);

-- CreateEnum
CREATE TYPE "PromotionScheduleType" AS ENUM (
  'ONE_TIME_DATE',
  'DATE_RANGE',
  'WEEKLY_RECURRING',
  'ALWAYS_ACTIVE'
);

-- CreateEnum
CREATE TYPE "PromotionDisplayPlacement" AS ENUM (
  'ANNOUNCEMENT_BANNER',
  'NOTIFICATION_CENTER',
  'HOMEPAGE_PROMOTION_CARD',
  'ACCOUNT_DASHBOARD',
  'POPUP'
);

-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM (
  'DRAFT',
  'SCHEDULED',
  'ACTIVE',
  'PAUSED',
  'EXPIRED',
  'ARCHIVED'
);

-- CreateTable
CREATE TABLE "scheduled_promotions" (
  "id" TEXT NOT NULL,
  "titleEn" TEXT NOT NULL,
  "titleAr" TEXT NOT NULL,
  "descriptionEn" TEXT NOT NULL,
  "descriptionAr" TEXT NOT NULL,
  "badgeEn" TEXT,
  "badgeAr" TEXT,
  "imageUrl" TEXT,
  "promotionType" "PromotionType" NOT NULL,
  "discountPercent" DECIMAL(5,2),
  "discountAmount" DECIMAL(12,2),
  "couponCode" TEXT,
  "minimumOrderAmount" DECIMAL(12,2),
  "targetUrl" TEXT,
  "buttonTextEn" TEXT,
  "buttonTextAr" TEXT,
  "scheduleType" "PromotionScheduleType" NOT NULL,
  "weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  "startAt" TIMESTAMP(3),
  "endAt" TIMESTAMP(3),
  "startTime" TEXT,
  "endTime" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'Africa/Cairo',
  "displayPlacement" "PromotionDisplayPlacement" NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "isDismissible" BOOLEAN NOT NULL DEFAULT true,
  "status" "PromotionStatus" NOT NULL DEFAULT 'DRAFT',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "scheduled_promotions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scheduled_promotions_isActive_status_displayPlacement_priority_idx"
ON "scheduled_promotions"("isActive", "status", "displayPlacement", "priority");

-- CreateIndex
CREATE INDEX "scheduled_promotions_scheduleType_startAt_endAt_idx"
ON "scheduled_promotions"("scheduleType", "startAt", "endAt");
