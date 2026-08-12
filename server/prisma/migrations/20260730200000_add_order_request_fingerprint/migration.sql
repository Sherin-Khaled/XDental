-- AddColumn
-- Nullable for compatibility with every existing order. No existing row is
-- rewritten, and the deployed (userId, idempotencyKey) uniqueness rule remains
-- the final concurrent-request barrier.
ALTER TABLE "Order"
ADD COLUMN "requestFingerprint" TEXT;
