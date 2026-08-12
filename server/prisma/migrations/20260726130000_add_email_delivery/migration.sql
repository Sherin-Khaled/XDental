CREATE TYPE "EmailDeliveryStatus" AS ENUM ('DISABLED', 'PENDING', 'SENT', 'FAILED');

CREATE TYPE "EmailNotificationCategory" AS ENUM (
  'CONTACT',
  'NEWSLETTER',
  'QUOTE',
  'PRODUCT_REQUEST',
  'MACHINE_INQUIRY',
  'SUPPORT'
);

CREATE TABLE "EmailDelivery" (
  "id" TEXT NOT NULL,
  "category" "EmailNotificationCategory" NOT NULL,
  "entityId" TEXT NOT NULL,
  "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'DISABLED',
  "recipient" TEXT,
  "replyTo" TEXT,
  "subject" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMP(3),
  "lastRetryAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailDelivery_category_entityId_key"
ON "EmailDelivery"("category", "entityId");

CREATE INDEX "EmailDelivery_status_createdAt_idx"
ON "EmailDelivery"("status", "createdAt" DESC);

CREATE INDEX "EmailDelivery_category_createdAt_idx"
ON "EmailDelivery"("category", "createdAt" DESC);
