-- Stage 1 launch workflow: migrate legacy order states to the internal-delivery lifecycle.
CREATE TYPE "OrderStatus_new" AS ENUM (
  'PENDING_REVIEW',
  'CONFIRMED',
  'PREPARING',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'REJECTED',
  'CANCELED'
);

ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order"
  ALTER COLUMN "status" TYPE "OrderStatus_new"
  USING (
    CASE "status"::text
      WHEN 'PENDING' THEN 'PENDING_REVIEW'
      WHEN 'SENT_TO_OWNER_SYSTEM' THEN 'CONFIRMED'
      ELSE "status"::text
    END
  )::"OrderStatus_new";

DROP TYPE "OrderStatus";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'PENDING_REVIEW';

CREATE TYPE "PaymentStatus" AS ENUM ('PENDING_COLLECTION', 'PAID');
ALTER TABLE "Order"
  ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING_COLLECTION';

CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");
