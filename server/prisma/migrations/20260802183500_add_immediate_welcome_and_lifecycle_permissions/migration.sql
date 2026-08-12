-- Additive-only Phase 6 correction. Historical loyalty transactions, balances,
-- orders, and account-action history remain unchanged.

ALTER TYPE "LoyaltyPointTransactionType" ADD VALUE IF NOT EXISTS 'WELCOME_GRANTED';
ALTER TYPE "LoyaltyPointTransactionType" ADD VALUE IF NOT EXISTS 'WELCOME_RESTORE';

ALTER TABLE "loyalty_program_settings"
ADD COLUMN "welcomeMinimumSubtotalEgp" DECIMAL(12,2) NOT NULL DEFAULT 500,
ADD COLUMN "welcomeExpiryDays" INTEGER NOT NULL DEFAULT 30;

ALTER TABLE "loyalty_program_settings"
ADD CONSTRAINT "loyalty_program_settings_welcome_rules_check"
CHECK (
  "welcomeMinimumSubtotalEgp" >= 0
  AND "welcomeExpiryDays" > 0
);

-- Dedicated lifecycle permissions are catalogued but intentionally not
-- assigned to any Support account or preset by this migration.
INSERT INTO "permissions" ("id", "key", "group", "description", "createdAt", "updatedAt")
VALUES
  ('perm_account_lifecycle_view', 'ACCOUNT_LIFECYCLE_VIEW', 'ACCOUNT_LIFECYCLE', 'View customer account lifecycle state and request history.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('perm_account_lifecycle_manage', 'ACCOUNT_LIFECYCLE_MANAGE', 'ACCOUNT_LIFECYCLE', 'Initiate and process audited customer account lifecycle actions.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
