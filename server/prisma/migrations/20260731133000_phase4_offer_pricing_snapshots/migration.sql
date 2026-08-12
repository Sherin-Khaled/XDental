-- CreateEnum
CREATE TYPE "DeliveryDiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- AlterTable: additive Delivery Offer pricing rules. Defaults preserve every
-- existing offer without activating or changing its current behavior.
ALTER TABLE "delivery_offers"
ADD COLUMN "discountType" "DeliveryDiscountType",
ADD COLUMN "discountValue" DECIMAL(12,2),
ADD COLUMN "minimumOrderAmount" DECIMAL(12,2),
ADD COLUMN "appliesToStandard" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "appliesToFast" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: nullable historical pricing snapshots for new orders only.
ALTER TABLE "Order"
ADD COLUMN "shippingBeforeDiscount" DECIMAL(12,2),
ADD COLUMN "shippingDiscount" DECIMAL(12,2),
ADD COLUMN "productPromotionSavings" DECIMAL(12,2),
ADD COLUMN "scheduledPromotionDiscount" DECIMAL(12,2),
ADD COLUMN "couponDiscount" DECIMAL(12,2),
ADD COLUMN "vipDiscount" DECIMAL(12,2),
ADD COLUMN "pricingBreakdown" JSONB;

-- AlterTable: nullable item-level promotion snapshots for new orders only.
ALTER TABLE "OrderItem"
ADD COLUMN "originalUnitPrice" DECIMAL(12,2),
ADD COLUMN "promotionDiscount" DECIMAL(12,2),
ADD COLUMN "promotionSourceType" TEXT,
ADD COLUMN "promotionSourceId" TEXT,
ADD COLUMN "promotionTitleEn" TEXT,
ADD COLUMN "promotionTitleAr" TEXT;

-- CreateIndex: coupon codes are unique after trimming and case normalization.
-- PostgreSQL continues to permit multiple NULL values.
CREATE UNIQUE INDEX "scheduled_promotions_coupon_code_normalized_key"
ON "scheduled_promotions" (UPPER(BTRIM("couponCode")))
WHERE "couponCode" IS NOT NULL;
