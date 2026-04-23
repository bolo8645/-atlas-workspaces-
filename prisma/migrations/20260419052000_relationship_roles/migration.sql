-- Consolidate confirmed relationships to one row per entity pair.
ALTER TABLE "Relationship" ADD COLUMN "roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "Relationship"
SET "roles" = ARRAY["type"]
WHERE cardinality("roles") = 0 AND "type" IS NOT NULL AND "type" <> '';

CREATE TEMP TABLE "_relationship_normalized" AS
SELECT
  "id",
  "workspaceId",
  LEAST("entityAId", "entityBId") AS "entityAId",
  GREATEST("entityAId", "entityBId") AS "entityBId"
FROM "Relationship";

CREATE TEMP TABLE "_relationship_keepers" AS
SELECT
  "workspaceId",
  "entityAId",
  "entityBId",
  MIN("id") AS "keepId"
FROM "_relationship_normalized"
GROUP BY "workspaceId", "entityAId", "entityBId";

WITH merged AS (
  SELECT
    n."workspaceId",
    n."entityAId",
    n."entityBId",
    k."keepId",
    ARRAY_AGG(DISTINCT role ORDER BY role) FILTER (WHERE role IS NOT NULL AND role <> '') AS "roles",
    STRING_AGG(DISTINCT r."description", E'\n\n') FILTER (WHERE r."description" IS NOT NULL AND r."description" <> '') AS "description",
    MIN(r."type") AS "type"
  FROM "_relationship_normalized" n
  JOIN "_relationship_keepers" k
    ON k."workspaceId" = n."workspaceId"
    AND k."entityAId" = n."entityAId"
    AND k."entityBId" = n."entityBId"
  JOIN "Relationship" r ON r."id" = n."id"
  LEFT JOIN LATERAL UNNEST(r."roles") AS role ON TRUE
  GROUP BY n."workspaceId", n."entityAId", n."entityBId", k."keepId"
)
UPDATE "Relationship" r
SET
  "entityAId" = m."entityAId",
  "entityBId" = m."entityBId",
  "roles" = COALESCE(m."roles", ARRAY[m."type"]::TEXT[]),
  "type" = COALESCE(m."type", 'Related'),
  "description" = m."description"
FROM merged m
WHERE r."id" = m."keepId";

DELETE FROM "Relationship" r
USING "_relationship_normalized" n
JOIN "_relationship_keepers" k
  ON k."workspaceId" = n."workspaceId"
  AND k."entityAId" = n."entityAId"
  AND k."entityBId" = n."entityBId"
WHERE r."id" = n."id"
  AND r."id" <> k."keepId";

DROP TABLE "_relationship_normalized";
DROP TABLE "_relationship_keepers";

ALTER TABLE "Relationship" DROP CONSTRAINT IF EXISTS "Relationship_workspaceId_entityAId_entityBId_type_key";
DROP INDEX IF EXISTS "Relationship_workspaceId_entityAId_entityBId_type_key";
CREATE UNIQUE INDEX "Relationship_workspaceId_entityAId_entityBId_key" ON "Relationship"("workspaceId", "entityAId", "entityBId");
