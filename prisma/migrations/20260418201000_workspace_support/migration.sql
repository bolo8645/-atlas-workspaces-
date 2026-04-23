-- Add workspaces without dropping or rewriting existing note/navigation data.
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Workspace" ("id", "name", "createdAt", "updatedAt")
VALUES ('default-ascu', 'ASCU', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "NavigationNode" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Note" ADD COLUMN "workspaceId" TEXT;

UPDATE "NavigationNode"
SET "workspaceId" = 'default-ascu'
WHERE "workspaceId" IS NULL;

UPDATE "Note"
SET "workspaceId" = 'default-ascu'
WHERE "workspaceId" IS NULL;

ALTER TABLE "NavigationNode" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Note" ALTER COLUMN "workspaceId" SET NOT NULL;

CREATE INDEX "Workspace_name_idx" ON "Workspace"("name");
CREATE INDEX "NavigationNode_workspaceId_idx" ON "NavigationNode"("workspaceId");
CREATE INDEX "Note_workspaceId_idx" ON "Note"("workspaceId");
CREATE UNIQUE INDEX "NavigationNode_workspaceId_parentId_slug_key" ON "NavigationNode"("workspaceId", "parentId", "slug");

ALTER TABLE "NavigationNode" ADD CONSTRAINT "NavigationNode_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Note" ADD CONSTRAINT "Note_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
