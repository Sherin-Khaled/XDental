ALTER TABLE "User"
  ADD COLUMN "permissionsUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "permissionsUpdatedById" TEXT;

CREATE INDEX "User_permissionsUpdatedById_idx" ON "User"("permissionsUpdatedById");

ALTER TABLE "User" ADD CONSTRAINT "User_permissionsUpdatedById_fkey"
  FOREIGN KEY ("permissionsUpdatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
