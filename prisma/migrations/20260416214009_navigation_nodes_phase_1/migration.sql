-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "navigationNodeId" TEXT;

-- CreateTable
CREATE TABLE "NavigationNode" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NavigationNode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NavigationNode_parentId_idx" ON "NavigationNode"("parentId");

-- CreateIndex
CREATE INDEX "NavigationNode_sortOrder_idx" ON "NavigationNode"("sortOrder");

-- CreateIndex
CREATE INDEX "NavigationNode_isVisible_idx" ON "NavigationNode"("isVisible");

-- CreateIndex
CREATE UNIQUE INDEX "NavigationNode_parentId_slug_key" ON "NavigationNode"("parentId", "slug");

-- CreateIndex
CREATE INDEX "Note_navigationNodeId_idx" ON "Note"("navigationNodeId");

-- AddForeignKey
ALTER TABLE "NavigationNode" ADD CONSTRAINT "NavigationNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "NavigationNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_navigationNodeId_fkey" FOREIGN KEY ("navigationNodeId") REFERENCES "NavigationNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
