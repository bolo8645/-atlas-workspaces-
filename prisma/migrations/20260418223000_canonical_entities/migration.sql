-- Add canonical workspace-aware entities without deleting existing entity data.
INSERT INTO "Workspace" ("id", "name", "createdAt", "updatedAt")
VALUES ('default-ascu', 'ASCU', NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "Entity" ADD COLUMN "workspaceId" TEXT NOT NULL DEFAULT 'default-ascu';
ALTER TABLE "Entity" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'other';
ALTER TABLE "Entity" ADD COLUMN "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "Entity"
SET "type" = LOWER("kind"::TEXT)
WHERE "type" = 'other' AND "kind" IS NOT NULL;

ALTER TABLE "Note" ADD COLUMN "entityId" TEXT;

CREATE UNIQUE INDEX "Entity_workspaceId_slug_kind_key" ON "Entity"("workspaceId", "slug", "kind");
CREATE INDEX "Entity_workspaceId_idx" ON "Entity"("workspaceId");
CREATE INDEX "Entity_type_idx" ON "Entity"("type");
CREATE INDEX "Note_entityId_idx" ON "Note"("entityId");

ALTER TABLE "Entity" ADD CONSTRAINT "Entity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Note" ADD CONSTRAINT "Note_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
