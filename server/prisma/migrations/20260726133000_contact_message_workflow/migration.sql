ALTER TABLE "ContactMessage"
ADD COLUMN "internalNotes" TEXT,
ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "ContactMessage_archivedAt_idx" ON "ContactMessage"("archivedAt");
