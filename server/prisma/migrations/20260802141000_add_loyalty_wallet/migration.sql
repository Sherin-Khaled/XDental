-- Phase 5 is additive: historical users receive zero balances and historical
-- orders are not recalculated. New-customer welcome points are created only by
-- the registration flow after this migration is active.

CREATE TYPE "LoyaltyPointTransactionType" AS ENUM (
  'WELCOME_PENDING',
  'WELCOME_ACTIVATED',
  'ORDER_EARN',
  'REDEMPTION',
  'RESTORE',
  'REVERSAL',
  'EXPIRATION',
  'ADMIN_ADJUSTMENT'
);

CREATE TYPE "LoyaltyPointTransactionStatus" AS ENUM (
  'PENDING',
  'ACTIVE',
  'REVERSED',
  'EXPIRED'
);

CREATE TYPE "WalletTransactionType" AS ENUM (
  'REFUND_CREDIT',
  'PROMOTIONAL_CREDIT',
  'ADMIN_CREDIT',
  'ADMIN_DEBIT',
  'ORDER_PAYMENT',
  'RESTORE'
);

CREATE TABLE "loyalty_accounts" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "availablePoints" INTEGER NOT NULL DEFAULT 0,
  "pendingPoints" INTEGER NOT NULL DEFAULT 0,
  "lifetimeEarnedPoints" INTEGER NOT NULL DEFAULT 0,
  "lifetimeRedeemedPoints" INTEGER NOT NULL DEFAULT 0,
  "walletBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "loyalty_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "loyalty_accounts_nonnegative_pending_check" CHECK ("pendingPoints" >= 0),
  CONSTRAINT "loyalty_accounts_nonnegative_lifetime_earned_check" CHECK ("lifetimeEarnedPoints" >= 0),
  CONSTRAINT "loyalty_accounts_nonnegative_lifetime_redeemed_check" CHECK ("lifetimeRedeemedPoints" >= 0),
  CONSTRAINT "loyalty_accounts_nonnegative_wallet_check" CHECK ("walletBalance" >= 0)
);

CREATE TABLE "loyalty_point_transactions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orderId" TEXT,
  "actorUserId" TEXT,
  "type" "LoyaltyPointTransactionType" NOT NULL,
  "points" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "status" "LoyaltyPointTransactionStatus" NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "description" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "loyalty_point_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "loyalty_point_transactions_nonzero_points_check" CHECK ("points" <> 0)
);

CREATE TABLE "wallet_transactions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orderId" TEXT,
  "actorUserId" TEXT,
  "type" "WalletTransactionType" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "balanceAfter" DECIMAL(12,2) NOT NULL,
  "description" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "wallet_transactions_nonzero_amount_check" CHECK ("amount" <> 0)
);

CREATE TABLE "loyalty_program_settings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "standardPointsPerEgp10" INTEGER NOT NULL DEFAULT 1,
  "vipPointsPerEgp10" INTEGER NOT NULL DEFAULT 2,
  "pointsPerRedemptionUnit" INTEGER NOT NULL DEFAULT 100,
  "redemptionValueEgp" DECIMAL(12,2) NOT NULL DEFAULT 10,
  "welcomePoints" INTEGER NOT NULL DEFAULT 200,
  "minimumRedemptionPoints" INTEGER NOT NULL DEFAULT 100,
  "maximumRedemptionPercent" DECIMAL(5,2) NOT NULL DEFAULT 20,
  "expiryMonths" INTEGER NOT NULL DEFAULT 12,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "loyalty_program_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "loyalty_program_settings_positive_rates_check" CHECK (
    "standardPointsPerEgp10" > 0
    AND "vipPointsPerEgp10" > 0
    AND "pointsPerRedemptionUnit" > 0
    AND "redemptionValueEgp" > 0
    AND "welcomePoints" >= 0
    AND "minimumRedemptionPoints" > 0
    AND "maximumRedemptionPercent" >= 0
    AND "maximumRedemptionPercent" <= 100
    AND "expiryMonths" > 0
  )
);

ALTER TABLE "Order"
ADD COLUMN "pointsRedeemed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "pointsRedemptionValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "walletCreditUsed" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "remainingCodAmount" DECIMAL(12,2);

CREATE UNIQUE INDEX "loyalty_accounts_userId_key"
ON "loyalty_accounts"("userId");

CREATE UNIQUE INDEX "loyalty_point_transactions_idempotencyKey_key"
ON "loyalty_point_transactions"("idempotencyKey");
CREATE INDEX "loyalty_point_transactions_userId_createdAt_idx"
ON "loyalty_point_transactions"("userId", "createdAt" DESC);
CREATE INDEX "loyalty_point_transactions_userId_expiresAt_idx"
ON "loyalty_point_transactions"("userId", "expiresAt");
CREATE INDEX "loyalty_point_transactions_orderId_idx"
ON "loyalty_point_transactions"("orderId");
CREATE INDEX "loyalty_point_transactions_actorUserId_idx"
ON "loyalty_point_transactions"("actorUserId");

CREATE UNIQUE INDEX "wallet_transactions_idempotencyKey_key"
ON "wallet_transactions"("idempotencyKey");
CREATE INDEX "wallet_transactions_userId_createdAt_idx"
ON "wallet_transactions"("userId", "createdAt" DESC);
CREATE INDEX "wallet_transactions_orderId_idx"
ON "wallet_transactions"("orderId");
CREATE INDEX "wallet_transactions_actorUserId_idx"
ON "wallet_transactions"("actorUserId");

ALTER TABLE "loyalty_accounts"
ADD CONSTRAINT "loyalty_accounts_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "loyalty_point_transactions"
ADD CONSTRAINT "loyalty_point_transactions_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "loyalty_point_transactions_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "loyalty_point_transactions_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wallet_transactions"
ADD CONSTRAINT "wallet_transactions_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "wallet_transactions_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "wallet_transactions_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing customers start at exactly zero. This does not grant points or
-- recalculate any historical order.
INSERT INTO "loyalty_accounts" (
  "id", "userId", "availablePoints", "pendingPoints",
  "lifetimeEarnedPoints", "lifetimeRedeemedPoints", "walletBalance",
  "createdAt", "updatedAt"
)
SELECT
  'loyalty_' || SUBSTRING(MD5("id") FROM 1 FOR 20),
  "id", 0, 0, 0, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User"
WHERE "role" = 'CUSTOMER';

INSERT INTO "loyalty_program_settings" (
  "id", "enabled", "standardPointsPerEgp10", "vipPointsPerEgp10",
  "pointsPerRedemptionUnit", "redemptionValueEgp", "welcomePoints",
  "minimumRedemptionPoints", "maximumRedemptionPercent", "expiryMonths",
  "createdAt", "updatedAt"
)
VALUES ('default', true, 1, 2, 100, 10, 200, 100, 20, 12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- New permissions are catalogued but intentionally not granted to Support.
INSERT INTO "permissions" ("id", "key", "group", "description", "createdAt", "updatedAt")
VALUES
  ('perm_loyalty_view', 'LOYALTY_VIEW', 'LOYALTY', 'View loyalty balances and immutable transaction history.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_loyalty_manage', 'LOYALTY_MANAGE', 'LOYALTY', 'Create audited loyalty and wallet adjustments.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- Ledger rows are append-only. Corrections, reversals and expirations must be
-- represented by compensating rows instead of UPDATE or DELETE statements.
CREATE FUNCTION prevent_loyalty_ledger_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Loyalty transaction ledgers are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER loyalty_point_transactions_immutable
BEFORE UPDATE OR DELETE ON "loyalty_point_transactions"
FOR EACH ROW EXECUTE FUNCTION prevent_loyalty_ledger_mutation();

CREATE TRIGGER wallet_transactions_immutable
BEFORE UPDATE OR DELETE ON "wallet_transactions"
FOR EACH ROW EXECUTE FUNCTION prevent_loyalty_ledger_mutation();
