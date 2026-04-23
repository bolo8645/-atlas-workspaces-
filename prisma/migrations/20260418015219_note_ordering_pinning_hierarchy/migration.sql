-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parentNoteId" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Note_parentNoteId_idx" ON "Note"("parentNoteId");

-- CreateIndex
CREATE INDEX "Note_isPinned_idx" ON "Note"("isPinned");

-- CreateIndex
CREATE INDEX "Note_sortOrder_idx" ON "Note"("sortOrder");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_parentNoteId_fkey" FOREIGN KEY ("parentNoteId") REFERENCES "Note"("id") ON DELETE SET NULL ON UPDATE CASCADE;
