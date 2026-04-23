-- Move relationships from free-form role arrays into workspace-scoped relationship types.
CREATE TABLE "RelationshipType" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RelationshipType_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RelationshipType"
  ADD CONSTRAINT "RelationshipType_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "RelationshipType_workspaceId_name_key" ON "RelationshipType"("workspaceId", "name");
CREATE INDEX "RelationshipType_workspaceId_idx" ON "RelationshipType"("workspaceId");
CREATE INDEX "RelationshipType_name_idx" ON "RelationshipType"("name");
CREATE INDEX "RelationshipType_isSystem_idx" ON "RelationshipType"("isSystem");

INSERT INTO "RelationshipType" ("id", "workspaceId", "name", "isSystem")
SELECT 'system-' || w."id" || '-affiliated-with', w."id", 'affiliated_with', true FROM "Workspace" w
ON CONFLICT ("workspaceId", "name") DO NOTHING;

INSERT INTO "RelationshipType" ("id", "workspaceId", "name", "isSystem")
SELECT 'system-' || w."id" || '-hostile-to', w."id", 'hostile_to', true FROM "Workspace" w
ON CONFLICT ("workspaceId", "name") DO NOTHING;

INSERT INTO "RelationshipType" ("id", "workspaceId", "name", "isSystem")
SELECT 'system-' || w."id" || '-member-of', w."id", 'member_of', true FROM "Workspace" w
ON CONFLICT ("workspaceId", "name") DO NOTHING;

INSERT INTO "RelationshipType" ("id", "workspaceId", "name", "isSystem")
SELECT 'system-' || w."id" || '-leader-of', w."id", 'leader_of', true FROM "Workspace" w
ON CONFLICT ("workspaceId", "name") DO NOTHING;

INSERT INTO "RelationshipType" ("id", "workspaceId", "name", "isSystem")
SELECT 'system-' || w."id" || '-located-in', w."id", 'located_in', true FROM "Workspace" w
ON CONFLICT ("workspaceId", "name") DO NOTHING;

INSERT INTO "RelationshipType" ("id", "workspaceId", "name", "isSystem")
SELECT 'system-' || w."id" || '-created', w."id", 'created', true FROM "Workspace" w
ON CONFLICT ("workspaceId", "name") DO NOTHING;

INSERT INTO "RelationshipType" ("id", "workspaceId", "name", "isSystem")
SELECT 'system-' || w."id" || '-related-to', w."id", 'related_to', true FROM "Workspace" w
ON CONFLICT ("workspaceId", "name") DO NOTHING;

ALTER TABLE "Relationship" ADD COLUMN "relationshipTypeId" TEXT;

UPDATE "Relationship" r
SET "relationshipTypeId" = rt."id",
    "type" = rt."name"
FROM "RelationshipType" rt
WHERE rt."workspaceId" = r."workspaceId"
  AND rt."name" = CASE
    WHEN EXISTS (SELECT 1 FROM unnest(r."roles") AS role WHERE lower(role) = 'ally') THEN 'affiliated_with'
    WHEN EXISTS (SELECT 1 FROM unnest(r."roles") AS role WHERE lower(role) = 'enemy') THEN 'hostile_to'
    WHEN EXISTS (SELECT 1 FROM unnest(r."roles") AS role WHERE lower(role) = 'member') THEN 'member_of'
    WHEN EXISTS (SELECT 1 FROM unnest(r."roles") AS role WHERE lower(role) = 'leader') THEN 'leader_of'
    WHEN lower(r."type") = 'ally' THEN 'affiliated_with'
    WHEN lower(r."type") = 'enemy' THEN 'hostile_to'
    WHEN lower(r."type") = 'member' THEN 'member_of'
    WHEN lower(r."type") = 'leader' THEN 'leader_of'
    ELSE 'related_to'
  END;

UPDATE "Relationship" r
SET "relationshipTypeId" = rt."id",
    "type" = rt."name"
FROM "RelationshipType" rt
WHERE r."relationshipTypeId" IS NULL
  AND rt."workspaceId" = r."workspaceId"
  AND rt."name" = 'related_to';

ALTER TABLE "Relationship" ALTER COLUMN "relationshipTypeId" SET NOT NULL;

ALTER TABLE "Relationship"
  ADD CONSTRAINT "Relationship_relationshipTypeId_fkey"
  FOREIGN KEY ("relationshipTypeId") REFERENCES "RelationshipType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Relationship_type_idx";
CREATE INDEX "Relationship_relationshipTypeId_idx" ON "Relationship"("relationshipTypeId");
CREATE INDEX "Relationship_type_idx" ON "Relationship"("type");

ALTER TABLE "Relationship" DROP COLUMN "roles";
