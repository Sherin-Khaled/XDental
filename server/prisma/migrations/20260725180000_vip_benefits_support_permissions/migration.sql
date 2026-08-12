CREATE TYPE "CustomerTier" AS ENUM ('STANDARD', 'VIP');
CREATE TYPE "CustomerBenefitType" AS ENUM ('FREE_SHIPPING', 'PERCENTAGE_DISCOUNT', 'FIXED_DISCOUNT', 'PROMO_CODE', 'CUSTOM');

ALTER TABLE "User"
  ADD COLUMN "customerTier" "CustomerTier" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "customer_benefits" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "CustomerBenefitType" NOT NULL,
  "titleEn" TEXT NOT NULL,
  "titleAr" TEXT NOT NULL,
  "descriptionEn" TEXT,
  "descriptionAr" TEXT,
  "discountPercent" DECIMAL(5,2),
  "discountAmount" DECIMAL(12,2),
  "promoCode" TEXT,
  "minimumOrderAmount" DECIMAL(12,2),
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "pausedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokedById" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "customer_benefits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "permissions" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "group" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_permissions" (
  "userId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  "grantedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("userId", "permissionId")
);

CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");
CREATE INDEX "permissions_group_idx" ON "permissions"("group");
CREATE INDEX "user_permissions_permissionId_idx" ON "user_permissions"("permissionId");
CREATE INDEX "user_permissions_grantedById_idx" ON "user_permissions"("grantedById");
CREATE INDEX "customer_benefits_userId_isActive_revokedAt_idx" ON "customer_benefits"("userId", "isActive", "revokedAt");
CREATE INDEX "customer_benefits_promoCode_idx" ON "customer_benefits"("promoCode");
CREATE INDEX "customer_benefits_startsAt_endsAt_idx" ON "customer_benefits"("startsAt", "endsAt");
CREATE INDEX "User_role_customerTier_idx" ON "User"("role", "customerTier");
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

ALTER TABLE "customer_benefits" ADD CONSTRAINT "customer_benefits_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_benefits" ADD CONSTRAINT "customer_benefits_revokedById_fkey"
  FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_benefits" ADD CONSTRAINT "customer_benefits_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permissionId_fkey"
  FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_grantedById_fkey"
  FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
