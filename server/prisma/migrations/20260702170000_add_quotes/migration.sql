-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('PENDING', 'SUPPLIER_REVIEW', 'DRAFT_RESPONSE', 'SENT', 'ACCEPTED', 'REJECTED', 'CANCELED');

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'PENDING',
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "notes" TEXT,
    "adminResponse" TEXT,
    "quotedPrice" DECIMAL(12,2),
    "supportThreadId" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteItem" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "brand" TEXT,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL,
    "selectedOptions" TEXT,
    "requestedPrice" DECIMAL(12,2),
    "quotedPrice" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quote_quoteNumber_key" ON "Quote"("quoteNumber");
CREATE UNIQUE INDEX "Quote_supportThreadId_key" ON "Quote"("supportThreadId");
CREATE INDEX "Quote_userId_createdAt_idx" ON "Quote"("userId", "createdAt" DESC);
CREATE INDEX "Quote_status_idx" ON "Quote"("status");
CREATE INDEX "QuoteItem_quoteId_idx" ON "QuoteItem"("quoteId");
CREATE INDEX "QuoteItem_productId_idx" ON "QuoteItem"("productId");

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_supportThreadId_fkey" FOREIGN KEY ("supportThreadId") REFERENCES "SupportThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
