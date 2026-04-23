-- Additive aliases for entity detection. Existing notes default to no aliases.
ALTER TABLE "Note" ADD COLUMN "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
