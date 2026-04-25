-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lockPasscodeHash" TEXT,
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "lockedBy" TEXT;

-- CreateIndex
CREATE INDEX "Note_isLocked_idx" ON "Note"("isLocked");

-- CreateIndex
CREATE INDEX "Note_deletedAt_idx" ON "Note"("deletedAt");
