-- Additive account preference and authenticated-session storage.
CREATE TYPE "AccountLanguage" AS ENUM ('EN', 'AR');
CREATE TYPE "AccountCountry" AS ENUM ('EGYPT');
CREATE TYPE "AccountCurrency" AS ENUM ('EGP');

CREATE TABLE "account_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderUpdates" BOOLEAN NOT NULL DEFAULT true,
    "quoteUpdates" BOOLEAN NOT NULL DEFAULT true,
    "productRequestUpdates" BOOLEAN NOT NULL DEFAULT true,
    "backInStockUpdates" BOOLEAN NOT NULL DEFAULT true,
    "supportReplyUpdates" BOOLEAN NOT NULL DEFAULT true,
    "personalizedRecommendations" BOOLEAN NOT NULL DEFAULT false,
    "saveBrowsingActivity" BOOLEAN NOT NULL DEFAULT false,
    "useOrderHistoryForSuggestions" BOOLEAN NOT NULL DEFAULT false,
    "weeklyOffers" BOOLEAN NOT NULL DEFAULT false,
    "newArrivals" BOOLEAN NOT NULL DEFAULT false,
    "clinicSupplyOffers" BOOLEAN NOT NULL DEFAULT false,
    "marketingBackInStock" BOOLEAN NOT NULL DEFAULT false,
    "language" "AccountLanguage" NOT NULL DEFAULT 'EN',
    "country" "AccountCountry" NOT NULL DEFAULT 'EGYPT',
    "currency" "AccountCurrency" NOT NULL DEFAULT 'EGP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_preferences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceSummary" TEXT NOT NULL,
    "ipAddressHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "account_preferences_userId_key" ON "account_preferences"("userId");
CREATE INDEX "auth_sessions_userId_idx" ON "auth_sessions"("userId");
CREATE INDEX "auth_sessions_userId_revokedAt_expiresAt_idx" ON "auth_sessions"("userId", "revokedAt", "expiresAt");
CREATE INDEX "auth_sessions_expiresAt_idx" ON "auth_sessions"("expiresAt");

ALTER TABLE "account_preferences" ADD CONSTRAINT "account_preferences_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
