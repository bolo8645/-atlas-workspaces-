-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "Workspace_userId_idx" ON "Workspace"("userId");
