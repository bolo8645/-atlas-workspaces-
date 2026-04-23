-- CreateEnum
CREATE TYPE "Alignment" AS ENUM ('HERO', 'ANTIHERO', 'VILLAIN', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "EventScale" AS ENUM ('STREET', 'CITY', 'REGIONAL', 'GLOBAL', 'COSMIC');

-- CreateEnum
CREATE TYPE "NoteStatus" AS ENUM ('NEW', 'TRIAGED', 'ACTIVE', 'NEEDS_REVIEW', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MetadataSource" AS ENUM ('IMPORTED', 'MANUAL', 'INFERRED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ImportFileStatus" AS ENUM ('IMPORTED', 'UPDATED', 'SKIPPED', 'ERRORED', 'DUPLICATE_REVIEW');

-- CreateEnum
CREATE TYPE "ReviewItemType" AS ENUM ('DUPLICATE', 'PARSE_WARNING', 'IMPORT_ERROR', 'MISSING_METADATA');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "LinkKind" AS ENUM ('URL', 'WIKI', 'INTERNAL_FILE', 'NOTE_REFERENCE');

-- CreateEnum
CREATE TYPE "EntityKind" AS ENUM ('CHARACTER', 'TEAM', 'LOCATION', 'ORGANIZATION', 'STORY_ARC', 'ARTIFACT', 'EVENT', 'FAMILY', 'POWER_SYSTEM', 'THREAT', 'OTHER');

-- CreateEnum
CREATE TYPE "RelatedNoteSource" AS ENUM ('MANUAL', 'INFERRED');

-- CreateTable
CREATE TABLE "SourceCollection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rootPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "sourceCollectionId" TEXT,
    "sourceIdentity" TEXT NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "sourceFileName" TEXT NOT NULL,
    "sourceExtension" TEXT NOT NULL,
    "sourceChecksum" TEXT NOT NULL,
    "contentFingerprint" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleFingerprint" TEXT NOT NULL,
    "importedContent" TEXT NOT NULL,
    "plainTextContent" TEXT NOT NULL,
    "excerpt" TEXT,
    "createdDate" TIMESTAMP(3),
    "updatedDate" TIMESTAMP(3),
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "folderName" TEXT,
    "notebookName" TEXT,
    "status" "NoteStatus" NOT NULL DEFAULT 'NEW',
    "priority" INTEGER,
    "entityType" "EntityKind",
    "parseQuality" INTEGER NOT NULL DEFAULT 100,
    "metadataNotes" TEXT,
    "curatedSummary" TEXT,
    "publicVisibility" BOOLEAN NOT NULL DEFAULT false,
    "timelineStartDate" TIMESTAMP(3),
    "timelineEndDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetadataOverride" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "displayTitle" TEXT,
    "summary" TEXT,
    "status" "NoteStatus",
    "priority" INTEGER,
    "entityType" "EntityKind",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetadataOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteTag" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "source" "MetadataSource" NOT NULL DEFAULT 'IMPORTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteCategory" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "source" "MetadataSource" NOT NULL DEFAULT 'IMPORTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "resolvedPath" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "checksum" TEXT,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Link" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "targetNoteId" TEXT,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "kind" "LinkKind" NOT NULL DEFAULT 'URL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "EntityKind" NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "canonicalTable" TEXT,
    "canonicalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteEntity" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "source" "MetadataSource" NOT NULL DEFAULT 'INFERRED',
    "evidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelatedNote" (
    "id" TEXT NOT NULL,
    "fromNoteId" TEXT NOT NULL,
    "toNoteId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "source" "RelatedNoteSource" NOT NULL DEFAULT 'MANUAL',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelatedNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRun" (
    "id" TEXT NOT NULL,
    "sourceCollectionId" TEXT,
    "importDirectory" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "filesDiscovered" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "erroredCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateReviewCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "summary" TEXT,

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteImportEvent" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "importRunId" TEXT NOT NULL,
    "status" "ImportFileStatus" NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "checksum" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteImportEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportError" (
    "id" TEXT NOT NULL,
    "importRunId" TEXT NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParseWarning" (
    "id" TEXT NOT NULL,
    "noteId" TEXT,
    "importRunId" TEXT,
    "sourcePath" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParseWarning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewItem" (
    "id" TEXT NOT NULL,
    "type" "ReviewItemType" NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'OPEN',
    "noteId" TEXT,
    "candidateNoteId" TEXT,
    "importRunId" TEXT,
    "sourcePath" TEXT,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "queryJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "biography" TEXT NOT NULL,
    "firstAppearance" TEXT NOT NULL,
    "alignment" "Alignment" NOT NULL DEFAULT 'NEUTRAL',
    "portraitUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "homeCityId" TEXT,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterRelation" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,

    CONSTRAINT "CharacterRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "imageUrl" TEXT,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faction" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ideology" TEXT NOT NULL,
    "emblemUrl" TEXT,

    CONSTRAINT "Faction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactionLocation" (
    "id" TEXT NOT NULL,
    "factionId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "FactionLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PowerSystem" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "limitations" TEXT NOT NULL,

    CONSTRAINT "PowerSystem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterPower" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "powerId" TEXT NOT NULL,
    "mastery" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "CharacterPower_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterFaction" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "factionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "CharacterFaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryArc" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "issueRange" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "coverUrl" TEXT,

    CONSTRAINT "StoryArc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterStoryArc" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "storyArcId" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "CharacterStoryArc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactionStoryArc" (
    "id" TEXT NOT NULL,
    "factionId" TEXT NOT NULL,
    "storyArcId" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "FactionStoryArc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineEvent" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "era" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER,
    "scale" "EventScale" NOT NULL DEFAULT 'CITY',
    "storyArcId" TEXT,
    "cityId" TEXT,

    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsPost" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "NewsPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SourceCollection_rootPath_key" ON "SourceCollection"("rootPath");

-- CreateIndex
CREATE INDEX "SourceCollection_name_idx" ON "SourceCollection"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Note_sourceIdentity_key" ON "Note"("sourceIdentity");

-- CreateIndex
CREATE INDEX "Note_contentFingerprint_idx" ON "Note"("contentFingerprint");

-- CreateIndex
CREATE INDEX "Note_folderName_idx" ON "Note"("folderName");

-- CreateIndex
CREATE INDEX "Note_importedAt_idx" ON "Note"("importedAt");

-- CreateIndex
CREATE INDEX "Note_lastSeenAt_idx" ON "Note"("lastSeenAt");

-- CreateIndex
CREATE INDEX "Note_sourceChecksum_idx" ON "Note"("sourceChecksum");

-- CreateIndex
CREATE INDEX "Note_status_idx" ON "Note"("status");

-- CreateIndex
CREATE INDEX "Note_title_idx" ON "Note"("title");

-- CreateIndex
CREATE INDEX "Note_titleFingerprint_idx" ON "Note"("titleFingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "MetadataOverride_noteId_key" ON "MetadataOverride"("noteId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "Tag_name_idx" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "NoteTag_tagId_idx" ON "NoteTag"("tagId");

-- CreateIndex
CREATE INDEX "NoteTag_source_idx" ON "NoteTag"("source");

-- CreateIndex
CREATE UNIQUE INDEX "NoteTag_noteId_tagId_key" ON "NoteTag"("noteId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_name_idx" ON "Category"("name");

-- CreateIndex
CREATE INDEX "NoteCategory_categoryId_idx" ON "NoteCategory"("categoryId");

-- CreateIndex
CREATE INDEX "NoteCategory_source_idx" ON "NoteCategory"("source");

-- CreateIndex
CREATE UNIQUE INDEX "NoteCategory_noteId_categoryId_key" ON "NoteCategory"("noteId", "categoryId");

-- CreateIndex
CREATE INDEX "Attachment_fileName_idx" ON "Attachment"("fileName");

-- CreateIndex
CREATE INDEX "Attachment_kind_idx" ON "Attachment"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_noteId_sourcePath_key" ON "Attachment"("noteId", "sourcePath");

-- CreateIndex
CREATE INDEX "Link_kind_idx" ON "Link"("kind");

-- CreateIndex
CREATE INDEX "Link_targetNoteId_idx" ON "Link"("targetNoteId");

-- CreateIndex
CREATE INDEX "Link_url_idx" ON "Link"("url");

-- CreateIndex
CREATE INDEX "Entity_name_idx" ON "Entity"("name");

-- CreateIndex
CREATE INDEX "Entity_kind_idx" ON "Entity"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "Entity_slug_kind_key" ON "Entity"("slug", "kind");

-- CreateIndex
CREATE INDEX "NoteEntity_entityId_idx" ON "NoteEntity"("entityId");

-- CreateIndex
CREATE INDEX "NoteEntity_source_idx" ON "NoteEntity"("source");

-- CreateIndex
CREATE UNIQUE INDEX "NoteEntity_noteId_entityId_key" ON "NoteEntity"("noteId", "entityId");

-- CreateIndex
CREATE INDEX "RelatedNote_source_idx" ON "RelatedNote"("source");

-- CreateIndex
CREATE INDEX "RelatedNote_toNoteId_idx" ON "RelatedNote"("toNoteId");

-- CreateIndex
CREATE UNIQUE INDEX "RelatedNote_fromNoteId_toNoteId_relationType_key" ON "RelatedNote"("fromNoteId", "toNoteId", "relationType");

-- CreateIndex
CREATE INDEX "ImportRun_startedAt_idx" ON "ImportRun"("startedAt");

-- CreateIndex
CREATE INDEX "ImportRun_status_idx" ON "ImportRun"("status");

-- CreateIndex
CREATE INDEX "NoteImportEvent_status_idx" ON "NoteImportEvent"("status");

-- CreateIndex
CREATE UNIQUE INDEX "NoteImportEvent_noteId_importRunId_key" ON "NoteImportEvent"("noteId", "importRunId");

-- CreateIndex
CREATE INDEX "ImportError_sourcePath_idx" ON "ImportError"("sourcePath");

-- CreateIndex
CREATE INDEX "ParseWarning_code_idx" ON "ParseWarning"("code");

-- CreateIndex
CREATE INDEX "ParseWarning_noteId_idx" ON "ParseWarning"("noteId");

-- CreateIndex
CREATE INDEX "ParseWarning_severity_idx" ON "ParseWarning"("severity");

-- CreateIndex
CREATE INDEX "ReviewItem_status_idx" ON "ReviewItem"("status");

-- CreateIndex
CREATE INDEX "ReviewItem_type_idx" ON "ReviewItem"("type");

-- CreateIndex
CREATE INDEX "SavedSearch_name_idx" ON "SavedSearch"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Character_slug_key" ON "Character"("slug");

-- CreateIndex
CREATE INDEX "Character_name_idx" ON "Character"("name");

-- CreateIndex
CREATE INDEX "Character_alias_idx" ON "Character"("alias");

-- CreateIndex
CREATE INDEX "Character_homeCityId_idx" ON "Character"("homeCityId");

-- CreateIndex
CREATE INDEX "CharacterRelation_toId_idx" ON "CharacterRelation"("toId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterRelation_fromId_toId_relation_key" ON "CharacterRelation"("fromId", "toId", "relation");

-- CreateIndex
CREATE UNIQUE INDEX "City_slug_key" ON "City"("slug");

-- CreateIndex
CREATE INDEX "City_name_idx" ON "City"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Faction_slug_key" ON "Faction"("slug");

-- CreateIndex
CREATE INDEX "Faction_name_idx" ON "Faction"("name");

-- CreateIndex
CREATE INDEX "FactionLocation_cityId_idx" ON "FactionLocation"("cityId");

-- CreateIndex
CREATE UNIQUE INDEX "FactionLocation_factionId_cityId_key" ON "FactionLocation"("factionId", "cityId");

-- CreateIndex
CREATE UNIQUE INDEX "PowerSystem_slug_key" ON "PowerSystem"("slug");

-- CreateIndex
CREATE INDEX "PowerSystem_name_idx" ON "PowerSystem"("name");

-- CreateIndex
CREATE INDEX "CharacterPower_powerId_idx" ON "CharacterPower"("powerId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterPower_characterId_powerId_key" ON "CharacterPower"("characterId", "powerId");

-- CreateIndex
CREATE INDEX "CharacterFaction_factionId_idx" ON "CharacterFaction"("factionId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterFaction_characterId_factionId_key" ON "CharacterFaction"("characterId", "factionId");

-- CreateIndex
CREATE UNIQUE INDEX "StoryArc_slug_key" ON "StoryArc"("slug");

-- CreateIndex
CREATE INDEX "StoryArc_title_idx" ON "StoryArc"("title");

-- CreateIndex
CREATE INDEX "StoryArc_order_idx" ON "StoryArc"("order");

-- CreateIndex
CREATE INDEX "CharacterStoryArc_storyArcId_idx" ON "CharacterStoryArc"("storyArcId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterStoryArc_characterId_storyArcId_key" ON "CharacterStoryArc"("characterId", "storyArcId");

-- CreateIndex
CREATE INDEX "FactionStoryArc_storyArcId_idx" ON "FactionStoryArc"("storyArcId");

-- CreateIndex
CREATE UNIQUE INDEX "FactionStoryArc_factionId_storyArcId_key" ON "FactionStoryArc"("factionId", "storyArcId");

-- CreateIndex
CREATE UNIQUE INDEX "TimelineEvent_slug_key" ON "TimelineEvent"("slug");

-- CreateIndex
CREATE INDEX "TimelineEvent_year_month_idx" ON "TimelineEvent"("year", "month");

-- CreateIndex
CREATE INDEX "TimelineEvent_storyArcId_idx" ON "TimelineEvent"("storyArcId");

-- CreateIndex
CREATE INDEX "TimelineEvent_cityId_idx" ON "TimelineEvent"("cityId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsPost_slug_key" ON "NewsPost"("slug");

-- CreateIndex
CREATE INDEX "NewsPost_publishedAt_idx" ON "NewsPost"("publishedAt");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_sourceCollectionId_fkey" FOREIGN KEY ("sourceCollectionId") REFERENCES "SourceCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetadataOverride" ADD CONSTRAINT "MetadataOverride_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteTag" ADD CONSTRAINT "NoteTag_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteTag" ADD CONSTRAINT "NoteTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteCategory" ADD CONSTRAINT "NoteCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteCategory" ADD CONSTRAINT "NoteCategory_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Link" ADD CONSTRAINT "Link_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Link" ADD CONSTRAINT "Link_targetNoteId_fkey" FOREIGN KEY ("targetNoteId") REFERENCES "Note"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteEntity" ADD CONSTRAINT "NoteEntity_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteEntity" ADD CONSTRAINT "NoteEntity_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelatedNote" ADD CONSTRAINT "RelatedNote_fromNoteId_fkey" FOREIGN KEY ("fromNoteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelatedNote" ADD CONSTRAINT "RelatedNote_toNoteId_fkey" FOREIGN KEY ("toNoteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRun" ADD CONSTRAINT "ImportRun_sourceCollectionId_fkey" FOREIGN KEY ("sourceCollectionId") REFERENCES "SourceCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteImportEvent" ADD CONSTRAINT "NoteImportEvent_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteImportEvent" ADD CONSTRAINT "NoteImportEvent_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportError" ADD CONSTRAINT "ImportError_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParseWarning" ADD CONSTRAINT "ParseWarning_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParseWarning" ADD CONSTRAINT "ParseWarning_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItem" ADD CONSTRAINT "ReviewItem_candidateNoteId_fkey" FOREIGN KEY ("candidateNoteId") REFERENCES "Note"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItem" ADD CONSTRAINT "ReviewItem_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewItem" ADD CONSTRAINT "ReviewItem_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_homeCityId_fkey" FOREIGN KEY ("homeCityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterRelation" ADD CONSTRAINT "CharacterRelation_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterRelation" ADD CONSTRAINT "CharacterRelation_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactionLocation" ADD CONSTRAINT "FactionLocation_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "Faction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactionLocation" ADD CONSTRAINT "FactionLocation_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterPower" ADD CONSTRAINT "CharacterPower_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterPower" ADD CONSTRAINT "CharacterPower_powerId_fkey" FOREIGN KEY ("powerId") REFERENCES "PowerSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterFaction" ADD CONSTRAINT "CharacterFaction_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterFaction" ADD CONSTRAINT "CharacterFaction_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "Faction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterStoryArc" ADD CONSTRAINT "CharacterStoryArc_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterStoryArc" ADD CONSTRAINT "CharacterStoryArc_storyArcId_fkey" FOREIGN KEY ("storyArcId") REFERENCES "StoryArc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactionStoryArc" ADD CONSTRAINT "FactionStoryArc_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "Faction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactionStoryArc" ADD CONSTRAINT "FactionStoryArc_storyArcId_fkey" FOREIGN KEY ("storyArcId") REFERENCES "StoryArc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_storyArcId_fkey" FOREIGN KEY ("storyArcId") REFERENCES "StoryArc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
