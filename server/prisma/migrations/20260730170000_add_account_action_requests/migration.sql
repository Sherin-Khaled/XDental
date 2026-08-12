-- Additive, non-destructive account lifecycle and reviewed action-request workflow.
CREATE TYPE "UserLifecycleState" AS ENUM (
    'ACTIVE',
    'DELETION_REQUESTED',
    'DEACTIVATED',
    'DELETED'
);

CREATE TYPE "AccountActionRequestType" AS ENUM (
    'DEACTIVATION',
    'DELETION'
);

CREATE TYPE "AccountActionRequestStatus" AS ENUM (
    'PENDING',
    'UNDER_REVIEW',
    'APPROVED',
    'REJECTED',
    'CANCELED',
    'COMPLETED'
);

CREATE TYPE "AccountActionEventType" AS ENUM (
    'STATUS_CHANGE',
    'REACTIVATED'
);

ALTER TABLE "User"
    ADD COLUMN "lifecycleState" "UserLifecycleState" NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN "lifecycleUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "anonymizedIdentityHash" TEXT;

CREATE TABLE "account_action_requests" (
    "id" TEXT NOT NULL,
    "publicRequestNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AccountActionRequestType" NOT NULL,
    "status" "AccountActionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "customerReason" TEXT,
    "customerDetails" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "customerResponse" TEXT,
    "reviewerNote" TEXT,
    "completedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "completionReference" TEXT,

    CONSTRAINT "account_action_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "account_action_request_history" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "eventType" "AccountActionEventType" NOT NULL DEFAULT 'STATUS_CHANGE',
    "previousStatus" "AccountActionRequestStatus",
    "newStatus" "AccountActionRequestStatus",
    "previousLifecycle" "UserLifecycleState",
    "newLifecycle" "UserLifecycleState",
    "actorUserId" TEXT,
    "actorRole" TEXT NOT NULL,
    "customerNote" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_action_request_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_anonymizedIdentityHash_key"
    ON "User"("anonymizedIdentityHash");
CREATE INDEX "User_role_lifecycleState_idx"
    ON "User"("role", "lifecycleState");

CREATE UNIQUE INDEX "account_action_requests_publicRequestNumber_key"
    ON "account_action_requests"("publicRequestNumber");
CREATE UNIQUE INDEX "account_action_requests_completionReference_key"
    ON "account_action_requests"("completionReference");
CREATE INDEX "account_action_requests_userId_idx"
    ON "account_action_requests"("userId");
CREATE INDEX "account_action_requests_userId_type_status_idx"
    ON "account_action_requests"("userId", "type", "status");
CREATE INDEX "account_action_requests_type_idx"
    ON "account_action_requests"("type");
CREATE INDEX "account_action_requests_status_idx"
    ON "account_action_requests"("status");
CREATE INDEX "account_action_requests_submittedAt_idx"
    ON "account_action_requests"("submittedAt" DESC);
CREATE INDEX "account_action_requests_reviewedByUserId_idx"
    ON "account_action_requests"("reviewedByUserId");

-- Backend duplicate checks provide friendly responses; this partial unique
-- index remains the authoritative race-safe guarantee.
CREATE UNIQUE INDEX "account_action_requests_one_active_type_per_user"
    ON "account_action_requests"("userId", "type")
    WHERE "status" IN ('PENDING', 'UNDER_REVIEW', 'APPROVED');

CREATE INDEX "account_action_request_history_requestId_createdAt_idx"
    ON "account_action_request_history"("requestId", "createdAt");
CREATE INDEX "account_action_request_history_actorUserId_idx"
    ON "account_action_request_history"("actorUserId");

ALTER TABLE "account_action_requests"
    ADD CONSTRAINT "account_action_requests_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "account_action_requests"
    ADD CONSTRAINT "account_action_requests_reviewedByUserId_fkey"
    FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "account_action_request_history"
    ADD CONSTRAINT "account_action_request_history_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "account_action_requests"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account_action_request_history"
    ADD CONSTRAINT "account_action_request_history_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Dedicated permissions are intentionally excluded from support presets.
INSERT INTO "permissions" ("id", "key", "group", "createdAt", "updatedAt")
VALUES
    ('perm_account_requests_view', 'ACCOUNT_REQUESTS_VIEW', 'ACCOUNT_REQUESTS', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('perm_account_requests_manage', 'ACCOUNT_REQUESTS_MANAGE', 'ACCOUNT_REQUESTS', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET
    "group" = EXCLUDED."group",
    "updatedAt" = CURRENT_TIMESTAMP;
