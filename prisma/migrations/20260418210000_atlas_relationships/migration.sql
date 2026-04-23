-- Additive Atlas Workspace relationship layer.
ALTER TABLE "Note" ADD COLUMN "noteType" TEXT NOT NULL DEFAULT 'draft';

CREATE TABLE "Relationship" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "entityAId" TEXT NOT NULL,
    "entityBId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Relationship_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Note_noteType_idx" ON "Note"("noteType");
CREATE INDEX "Relationship_workspaceId_idx" ON "Relationship"("workspaceId");
CREATE INDEX "Relationship_entityAId_idx" ON "Relationship"("entityAId");
CREATE INDEX "Relationship_entityBId_idx" ON "Relationship"("entityBId");
CREATE INDEX "Relationship_type_idx" ON "Relationship"("type");
CREATE UNIQUE INDEX "Relationship_workspaceId_entityAId_entityBId_type_key" ON "Relationship"("workspaceId", "entityAId", "entityBId", "type");

ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
