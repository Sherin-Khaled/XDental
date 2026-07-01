-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'ADMIN', 'SUPPORT');

-- CreateEnum
CREATE TYPE "ProductRequestStatus" AS ENUM ('UNDER_REVIEW', 'AVAILABLE', 'SEARCHING_SUPPLIER', 'NOT_AVAILABLE', 'CANCELED');

-- CreateEnum
CREATE TYPE "ProductRequestSource" AS ENUM ('PRODUCT_PAGE', 'ACCOUNT_PAGE', 'CHAT');

-- CreateEnum
CREATE TYPE "SupportThreadType" AS ENUM ('PRODUCT_REQUEST', 'GENERAL_SUPPORT', 'ORDER', 'QUOTE');

-- CreateEnum
CREATE TYPE "SupportThreadStatus" AS ENUM ('OPEN', 'WAITING_FOR_SUPPORT', 'WAITING_FOR_CUSTOMER', 'RESOLVED');

-- CreateEnum
CREATE TYPE "SupportPriority" AS ENUM ('NORMAL', 'URGENT');

-- CreateEnum
CREATE TYPE "SupportSenderRole" AS ENUM ('CUSTOMER', 'SUPPORT', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PRODUCT_REQUEST', 'SUPPORT_MESSAGE', 'PRODUCT_AVAILABLE', 'ORDER_UPDATE', 'QUOTE_UPDATE', 'ACCOUNT');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'SENT_TO_OWNER_SYSTEM', 'CONFIRMED', 'REJECTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "SyncDirection" AS ENUM ('OWNER_TO_WEBSITE', 'WEBSITE_TO_OWNER');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "professionalRole" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "externalProductId" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "sku" TEXT,
    "category" TEXT,
    "description" TEXT,
    "price" DECIMAL(12,2),
    "stockQuantity" INTEGER,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "sourceSystem" TEXT,
    "externalStatus" TEXT,
    "syncStatus" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT,
    "externalProductId" TEXT,
    "productName" TEXT NOT NULL,
    "brand" TEXT,
    "sku" TEXT,
    "category" TEXT,
    "quantity" INTEGER,
    "branch" TEXT,
    "message" TEXT,
    "notes" TEXT,
    "status" "ProductRequestStatus" NOT NULL DEFAULT 'UNDER_REVIEW',
    "source" "ProductRequestSource" NOT NULL DEFAULT 'ACCOUNT_PAGE',
    "supportThreadId" TEXT,
    "teamUpdates" JSONB NOT NULL DEFAULT '[]',
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "sourceSystem" TEXT,
    "externalStatus" TEXT,
    "syncStatus" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportThread" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productRequestId" TEXT,
    "subject" TEXT NOT NULL,
    "type" "SupportThreadType" NOT NULL DEFAULT 'GENERAL_SUPPORT',
    "related" TEXT,
    "status" "SupportThreadStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "SupportPriority" NOT NULL DEFAULT 'NORMAL',
    "assignedToId" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupportThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderId" TEXT,
    "senderRole" "SupportSenderRole" NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(12,2),
    "shipping" DECIMAL(12,2),
    "discount" DECIMAL(12,2),
    "total" DECIMAL(12,2),
    "customerName" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "shippingAddress" TEXT,
    "paymentMethod" TEXT,
    "sourceSystem" TEXT,
    "externalOrderId" TEXT,
    "externalStatus" TEXT,
    "syncStatus" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "externalProductId" TEXT,
    "productName" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2),
    "total" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "direction" "SyncDirection" NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "sourceSystem" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE UNIQUE INDEX "Product_externalProductId_key" ON "Product"("externalProductId");
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
CREATE INDEX "Product_externalProductId_idx" ON "Product"("externalProductId");
CREATE INDEX "Product_brand_idx" ON "Product"("brand");
CREATE INDEX "Product_category_idx" ON "Product"("category");
CREATE UNIQUE INDEX "ProductRequest_requestNumber_key" ON "ProductRequest"("requestNumber");
CREATE UNIQUE INDEX "ProductRequest_supportThreadId_key" ON "ProductRequest"("supportThreadId");
CREATE INDEX "ProductRequest_userId_createdAt_idx" ON "ProductRequest"("userId", "createdAt" DESC);
CREATE INDEX "ProductRequest_status_idx" ON "ProductRequest"("status");
CREATE INDEX "ProductRequest_externalProductId_idx" ON "ProductRequest"("externalProductId");
CREATE UNIQUE INDEX "SupportThread_ticketNumber_key" ON "SupportThread"("ticketNumber");
CREATE UNIQUE INDEX "SupportThread_productRequestId_key" ON "SupportThread"("productRequestId");
CREATE INDEX "SupportThread_userId_lastMessageAt_idx" ON "SupportThread"("userId", "lastMessageAt" DESC);
CREATE INDEX "SupportThread_status_idx" ON "SupportThread"("status");
CREATE INDEX "SupportThread_assignedToId_idx" ON "SupportThread"("assignedToId");
CREATE INDEX "SupportMessage_threadId_createdAt_idx" ON "SupportMessage"("threadId", "createdAt");
CREATE INDEX "SupportMessage_senderId_idx" ON "SupportMessage"("senderId");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt" DESC);
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE UNIQUE INDEX "Order_externalOrderId_key" ON "Order"("externalOrderId");
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt" DESC);
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_externalProductId_idx" ON "OrderItem"("externalProductId");
CREATE INDEX "SyncLog_entityType_entityId_idx" ON "SyncLog"("entityType", "entityId");
CREATE INDEX "SyncLog_status_createdAt_idx" ON "SyncLog"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ProductRequest" ADD CONSTRAINT "ProductRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductRequest" ADD CONSTRAINT "ProductRequest_supportThreadId_fkey" FOREIGN KEY ("supportThreadId") REFERENCES "SupportThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportThread" ADD CONSTRAINT "SupportThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportThread" ADD CONSTRAINT "SupportThread_productRequestId_fkey" FOREIGN KEY ("productRequestId") REFERENCES "ProductRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportThread" ADD CONSTRAINT "SupportThread_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "SupportThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
