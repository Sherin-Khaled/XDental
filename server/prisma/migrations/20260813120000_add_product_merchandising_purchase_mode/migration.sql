CREATE TYPE "ProductPurchaseMode" AS ENUM ('STANDARD', 'INQUIRY', 'QUOTE');

ALTER TABLE "Product"
ADD COLUMN "isWeeklyOffer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isBestSeller" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isNewArrival" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isHotDeal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isFastDelivery" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "purchaseMode" "ProductPurchaseMode" NOT NULL DEFAULT 'STANDARD';

CREATE INDEX "Product_isWeeklyOffer_idx" ON "Product"("isWeeklyOffer");
CREATE INDEX "Product_isBestSeller_idx" ON "Product"("isBestSeller");
CREATE INDEX "Product_isNewArrival_idx" ON "Product"("isNewArrival");
CREATE INDEX "Product_isHotDeal_idx" ON "Product"("isHotDeal");
CREATE INDEX "Product_isFastDelivery_idx" ON "Product"("isFastDelivery");
CREATE INDEX "Product_purchaseMode_idx" ON "Product"("purchaseMode");
