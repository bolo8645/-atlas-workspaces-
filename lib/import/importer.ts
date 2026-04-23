import path from "node:path";
import {
  EntityKind,
  ImportFileStatus,
  LinkKind,
  MetadataSource,
  NoteStatus,
  RelatedNoteSource,
  ReviewItemType,
  ReviewStatus,
  type Prisma,
  type PrismaClient
} from "@prisma/client";
import { getImportNotesDir } from "../config";
import { prisma } from "../prisma";
import { discoverNoteFiles } from "./scanner";
import { parseNoteFile } from "./parser";
import type { ImportRunResult, ParsedEntity, ParsedLink, ParsedNote, ParsedWarning } from "./types";
import { hashText, makeTitleFingerprint, slugify, tokenSimilarity } from "./text";
import { ensureDefaultWorkspace } from "@/lib/workspace-db";

type ImportContext = {
  db: PrismaClient;
  importRunId: string;
  sourceCollectionId: string;
  sourceCollectionRoot: string;
};

type PersistResult = {
  noteId?: string;
  status: ImportFileStatus;
  warnings: number;
  duplicateReview: boolean;
};

export async function runNotesImport(options: { importDir?: string; db?: PrismaClient } = {}): Promise<ImportRunResult> {
  const db = options.db ?? prisma;
  const importDirectory = path.resolve(process.cwd(), options.importDir || getImportNotesDir());
  const startedAt = Date.now();
  const collection = await db.sourceCollection.upsert({
    where: { rootPath: importDirectory },
    update: { name: path.basename(importDirectory) || "Imported Notes" },
    create: {
      name: path.basename(importDirectory) || "Imported Notes",
      rootPath: importDirectory
    }
  });

  const importRun = await db.importRun.create({
    data: {
      sourceCollectionId: collection.id,
      importDirectory,
      status: "RUNNING"
    }
  });

  const stats = {
    filesDiscovered: 0,
    imported: 0,
    updated: 0,
    skipped: 0,
    errored: 0,
    warnings: 0,
    duplicateReviews: 0
  };

  try {
    const files = await discoverNoteFiles(importDirectory);
    stats.filesDiscovered = files.length;
    await db.importRun.update({ where: { id: importRun.id }, data: { filesDiscovered: files.length } });

    for (const file of files) {
      try {
        const parsed = await parseNoteFile(file);
        const result = await persistParsedNote(parsed, {
          db,
          importRunId: importRun.id,
          sourceCollectionId: collection.id,
          sourceCollectionRoot: collection.rootPath
        });

        stats.warnings += result.warnings;
        if (result.duplicateReview) stats.duplicateReviews += 1;
        if (result.status === ImportFileStatus.IMPORTED) stats.imported += 1;
        if (result.status === ImportFileStatus.UPDATED) stats.updated += 1;
        if (result.status === ImportFileStatus.SKIPPED) stats.skipped += 1;
        if (result.status === ImportFileStatus.DUPLICATE_REVIEW) stats.imported += 1;
      } catch (error) {
        stats.errored += 1;
        await recordImportError(db, importRun.id, file.relativePath, error);
      }
    }

    // Confirmed Relationship records are now the source of truth for interconnected data.
    // Keep imported notes/entities intact, but do not create inferred note relationships during import.

    const durationMs = Date.now() - startedAt;
    await db.importRun.update({
      where: { id: importRun.id },
      data: {
        completedAt: new Date(),
        durationMs,
        filesDiscovered: stats.filesDiscovered,
        importedCount: stats.imported,
        updatedCount: stats.updated,
        skippedCount: stats.skipped,
        erroredCount: stats.errored,
        warningCount: stats.warnings,
        duplicateReviewCount: stats.duplicateReviews,
        status: stats.errored > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
        summary: `Imported ${stats.imported}, updated ${stats.updated}, skipped ${stats.skipped}, errored ${stats.errored}.`
      }
    });

    return {
      importRunId: importRun.id,
      durationMs,
      ...stats
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    await db.importRun.update({
      where: { id: importRun.id },
      data: {
        completedAt: new Date(),
        durationMs,
        status: "FAILED",
        summary: error instanceof Error ? error.message : "Import failed."
      }
    });
    throw error;
  }
}

async function persistParsedNote(parsed: ParsedNote, context: ImportContext): Promise<PersistResult> {
  const { db, importRunId, sourceCollectionId, sourceCollectionRoot } = context;
  const defaultWorkspace = await ensureDefaultWorkspace();
  const sourceIdentity = makeSourceIdentity(sourceCollectionRoot, parsed.relativePath);
  const dedupe = await findDedupeTarget(db, parsed, sourceIdentity);
  const existing = dedupe.note;
  const duplicateReview = Boolean(dedupe.ambiguousNote);
  const currentStatus = parsed.warnings.some((warning) => warning.severity !== "info") ? NoteStatus.NEEDS_REVIEW : NoteStatus.NEW;

  const noteData = {
    workspaceId: defaultWorkspace.id,
    sourceCollectionId: existing && dedupe.strategy !== "source-path" ? existing.sourceCollectionId : sourceCollectionId,
    sourceIdentity: existing && dedupe.strategy !== "source-path" ? existing.sourceIdentity : sourceIdentity,
    sourcePath: existing && dedupe.strategy !== "source-path" ? existing.sourcePath : parsed.relativePath,
    sourceFileName: parsed.sourceFileName,
    sourceExtension: parsed.sourceExtension,
    sourceChecksum: parsed.sourceChecksum,
    contentFingerprint: parsed.contentFingerprint,
    title: parsed.title,
    titleFingerprint: parsed.titleFingerprint,
    importedContent: parsed.importedContent,
    plainTextContent: parsed.plainTextContent,
    excerpt: parsed.excerpt,
    createdDate: parsed.createdDate,
    updatedDate: parsed.updatedDate,
    folderName: parsed.folderName,
    notebookName: parsed.notebookName,
    parseQuality: parsed.parseQuality,
    lastSeenAt: new Date()
  };

  const note = existing
    ? await db.note.update({
        where: { id: existing.id },
        data: {
          ...noteData,
          status: existing.status === NoteStatus.NEW && currentStatus === NoteStatus.NEEDS_REVIEW ? NoteStatus.NEEDS_REVIEW : existing.status
        }
      })
    : await db.note.create({
        data: {
          ...noteData,
          status: duplicateReview ? NoteStatus.NEEDS_REVIEW : currentStatus
        }
      });

  const fileStatus = inferFileStatus(existing, parsed, duplicateReview);

  if (fileStatus !== ImportFileStatus.SKIPPED) {
    await syncExtractedData(db, note.id, parsed);
  }

  await recordNoteImportEvent(db, note.id, importRunId, fileStatus, parsed);
  await recordParseWarnings(db, note.id, importRunId, parsed.relativePath, parsed.warnings);

  if (duplicateReview && dedupe.ambiguousNote) {
    await createReviewItemOnce(db, {
      type: ReviewItemType.DUPLICATE,
      noteId: dedupe.ambiguousNote.id,
      candidateNoteId: note.id,
      importRunId,
      sourcePath: parsed.relativePath,
      title: "Possible duplicate note",
      detail: `The imported file "${parsed.relativePath}" is similar to existing note "${dedupe.ambiguousNote.title}" with ${(dedupe.confidence * 100).toFixed(0)}% token overlap.`,
      confidence: dedupe.confidence
    });
  }

  if (parsed.tags.length === 0 || parsed.categories.length === 0) {
    await createReviewItemOnce(db, {
      type: ReviewItemType.MISSING_METADATA,
      noteId: note.id,
      importRunId,
      sourcePath: parsed.relativePath,
      title: "Missing metadata",
      detail: "This note is missing imported tags or categories. Add database-level metadata without changing the original source content.",
      confidence: 1
    });
  }

  return {
    noteId: note.id,
    status: fileStatus,
    warnings: parsed.warnings.length,
    duplicateReview
  };
}

async function findDedupeTarget(db: PrismaClient, parsed: ParsedNote, sourceIdentity: string) {
  const bySource = await db.note.findUnique({ where: { sourceIdentity } });
  if (bySource) return { note: bySource, strategy: "source-path", confidence: 1, ambiguousNote: undefined };

  const byChecksum = await db.note.findFirst({ where: { sourceChecksum: parsed.sourceChecksum } });
  if (byChecksum) return { note: byChecksum, strategy: "checksum", confidence: 1, ambiguousNote: undefined };

  const candidates = await db.note.findMany({
    where: { titleFingerprint: parsed.titleFingerprint },
    select: { id: true, title: true, plainTextContent: true, sourceChecksum: true, sourceIdentity: true, sourcePath: true, sourceCollectionId: true, status: true }
  });

  let best: (typeof candidates)[number] | undefined;
  let bestScore = 0;

  for (const candidate of candidates) {
    const score = tokenSimilarity(parsed.plainTextContent, candidate.plainTextContent);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  if (best && bestScore >= 0.92) return { note: best, strategy: "similar-content", confidence: bestScore, ambiguousNote: undefined };
  if (best && bestScore >= 0.68) return { note: undefined, strategy: "ambiguous", confidence: bestScore, ambiguousNote: best };
  return { note: undefined, strategy: "new", confidence: 0, ambiguousNote: undefined };
}

function inferFileStatus(existing: { sourceChecksum: string } | undefined, parsed: ParsedNote, duplicateReview: boolean) {
  if (duplicateReview) return ImportFileStatus.DUPLICATE_REVIEW;
  if (!existing) return ImportFileStatus.IMPORTED;
  return existing.sourceChecksum === parsed.sourceChecksum ? ImportFileStatus.SKIPPED : ImportFileStatus.UPDATED;
}

async function syncExtractedData(db: PrismaClient, noteId: string, parsed: ParsedNote) {
  await syncTags(db, noteId, parsed.tags);
  await syncCategories(db, noteId, parsed.categories);
  await syncAttachments(db, noteId, parsed.attachments);
  await syncLinks(db, noteId, parsed.links);
  await syncEntities(db, noteId, parsed.entities);
}

async function syncTags(db: PrismaClient, noteId: string, tags: string[]) {
  await db.noteTag.deleteMany({ where: { noteId, source: { in: [MetadataSource.IMPORTED, MetadataSource.INFERRED] } } });

  for (const name of tags) {
    const tag = await db.tag.upsert({
      where: { slug: slugify(name) },
      update: { name },
      create: { slug: slugify(name), name }
    });

    await db.noteTag.upsert({
      where: { noteId_tagId: { noteId, tagId: tag.id } },
      update: {},
      create: { noteId, tagId: tag.id, source: MetadataSource.IMPORTED }
    });
  }
}

async function syncCategories(db: PrismaClient, noteId: string, categories: string[]) {
  await db.noteCategory.deleteMany({ where: { noteId, source: { in: [MetadataSource.IMPORTED, MetadataSource.INFERRED] } } });

  for (const name of categories) {
    const category = await db.category.upsert({
      where: { slug: slugify(name) },
      update: { name },
      create: { slug: slugify(name), name }
    });

    await db.noteCategory.upsert({
      where: { noteId_categoryId: { noteId, categoryId: category.id } },
      update: {},
      create: { noteId, categoryId: category.id, source: MetadataSource.IMPORTED }
    });
  }
}

async function syncAttachments(db: PrismaClient, noteId: string, attachments: ParsedNote["attachments"]) {
  await db.attachment.deleteMany({ where: { noteId } });

  for (const attachment of attachments) {
    await db.attachment.upsert({
      where: { noteId_sourcePath: { noteId, sourcePath: attachment.sourcePath } },
      update: {
        resolvedPath: attachment.resolvedPath,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        checksum: attachment.checksum,
        kind: attachment.kind
      },
      create: {
        noteId,
        sourcePath: attachment.sourcePath,
        resolvedPath: attachment.resolvedPath,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        checksum: attachment.checksum,
        kind: attachment.kind
      }
    });
  }
}

async function syncLinks(db: PrismaClient, noteId: string, links: ParsedLink[]) {
  await db.link.deleteMany({ where: { noteId } });

  for (const link of links) {
    const targetNote = link.kind === "WIKI" && link.label ? await db.note.findFirst({ where: { titleFingerprint: makeTitleFingerprint(link.label) } }) : undefined;

    await db.link.create({
      data: {
        noteId,
        targetNoteId: targetNote?.id,
        url: link.url,
        label: link.label,
        kind: coerceLinkKind(link.kind)
      }
    });
  }
}

async function syncEntities(db: PrismaClient, noteId: string, entities: ParsedEntity[]) {
  await db.noteEntity.deleteMany({ where: { noteId, source: { in: [MetadataSource.IMPORTED, MetadataSource.INFERRED] } } });
  const note = await db.note.findUnique({ where: { id: noteId }, select: { workspaceId: true } });
  const workspaceId = note?.workspaceId ?? "default-ascu";

  for (const parsedEntity of entities) {
    const kind = coerceEntityKind(parsedEntity.kind);
    const type = entityKindToType(kind);
    const entity = await db.entity.upsert({
      where: { slug_kind: { slug: slugify(parsedEntity.name), kind } },
      update: { name: parsedEntity.name, type },
      create: { workspaceId, slug: slugify(parsedEntity.name), name: parsedEntity.name, kind, type }
    });

    await db.noteEntity.upsert({
      where: { noteId_entityId: { noteId, entityId: entity.id } },
      update: {
        confidence: parsedEntity.confidence,
        source: parsedEntity.source === "IMPORTED" ? MetadataSource.IMPORTED : MetadataSource.INFERRED,
        evidence: parsedEntity.evidence
      },
      create: {
        noteId,
        entityId: entity.id,
        confidence: parsedEntity.confidence,
        source: parsedEntity.source === "IMPORTED" ? MetadataSource.IMPORTED : MetadataSource.INFERRED,
        evidence: parsedEntity.evidence
      }
    });
  }
}

function entityKindToType(kind: EntityKind) {
  if (kind === EntityKind.CHARACTER) return "character";
  if (kind === EntityKind.ORGANIZATION || kind === EntityKind.TEAM) return "organization";
  if (kind === EntityKind.LOCATION) return "location";
  if (kind === EntityKind.STORY_ARC) return "story";
  return "other";
}

async function recordNoteImportEvent(db: PrismaClient, noteId: string, importRunId: string, status: ImportFileStatus, parsed: ParsedNote) {
  await db.noteImportEvent.upsert({
    where: { noteId_importRunId: { noteId, importRunId } },
    update: {
      status,
      sourcePath: parsed.relativePath,
      checksum: parsed.sourceChecksum
    },
    create: {
      noteId,
      importRunId,
      status,
      sourcePath: parsed.relativePath,
      checksum: parsed.sourceChecksum
    }
  });
}

async function recordParseWarnings(db: PrismaClient, noteId: string, importRunId: string, sourcePath: string, warnings: ParsedWarning[]) {
  for (const warning of warnings) {
    await db.parseWarning.create({
      data: {
        noteId,
        importRunId,
        sourcePath,
        code: warning.code,
        message: warning.message,
        severity: warning.severity || "warning"
      }
    });

    if (warning.severity !== "info") {
      await createReviewItemOnce(db, {
        type: ReviewItemType.PARSE_WARNING,
        noteId,
        importRunId,
        sourcePath,
        title: `Parse warning: ${warning.code}`,
        detail: warning.message,
        confidence: 1
      });
    }
  }
}

async function recordImportError(db: PrismaClient, importRunId: string, sourcePath: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown import error";
  const stack = error instanceof Error ? error.stack : undefined;

  await db.importError.create({
    data: {
      importRunId,
      sourcePath,
      message,
      stack
    }
  });

  await createReviewItemOnce(db, {
    type: ReviewItemType.IMPORT_ERROR,
    importRunId,
    sourcePath,
    title: "Import error",
    detail: message,
    confidence: 1
  });
}

async function createReviewItemOnce(
  db: PrismaClient,
  data: Pick<Prisma.ReviewItemCreateInput, "title" | "detail" | "confidence" | "sourcePath"> & {
    type: ReviewItemType;
    noteId?: string;
    candidateNoteId?: string;
    importRunId?: string;
  }
) {
  const existing = await db.reviewItem.findFirst({
    where: {
      type: data.type,
      status: ReviewStatus.OPEN,
      noteId: data.noteId,
      candidateNoteId: data.candidateNoteId,
      sourcePath: data.sourcePath,
      title: data.title
    }
  });

  if (existing) return existing;

  return db.reviewItem.create({
    data: {
      type: data.type,
      status: ReviewStatus.OPEN,
      title: data.title,
      detail: data.detail,
      confidence: data.confidence,
      sourcePath: data.sourcePath,
      note: data.noteId ? { connect: { id: data.noteId } } : undefined,
      candidateNote: data.candidateNoteId ? { connect: { id: data.candidateNoteId } } : undefined,
      importRun: data.importRunId ? { connect: { id: data.importRunId } } : undefined
    }
  });
}

async function rebuildInferredRelationships(db: PrismaClient, sourceCollectionId: string) {
  const notes = await db.note.findMany({
    where: { sourceCollectionId },
    include: {
      tags: { include: { tag: true } },
      entities: { include: { entity: true } }
    }
  });

  const noteIds = notes.map((note) => note.id);
  await db.relatedNote.deleteMany({
    where: {
      source: RelatedNoteSource.INFERRED,
      fromNoteId: { in: noteIds }
    }
  });

  const relationMap = new Map<string, { fromNoteId: string; toNoteId: string; relationType: string; confidence: number; reason: string }>();

  function addRelation(leftId: string, rightId: string, relationType: string, reason: string, confidence: number) {
    if (leftId === rightId) return;
    const [fromNoteId, toNoteId] = [leftId, rightId].sort();
    const key = `${fromNoteId}:${toNoteId}:${relationType}`;
    const existing = relationMap.get(key);
    if (!existing || confidence > existing.confidence) {
      relationMap.set(key, { fromNoteId, toNoteId, relationType, confidence, reason });
    }
  }

  const notesByTag = new Map<string, string[]>();
  const notesByEntity = new Map<string, string[]>();

  for (const note of notes) {
    for (const noteTag of note.tags) {
      const existing = notesByTag.get(noteTag.tag.slug) ?? [];
      existing.push(note.id);
      notesByTag.set(noteTag.tag.slug, existing);
    }

    for (const noteEntity of note.entities) {
      const key = `${noteEntity.entity.kind}:${noteEntity.entity.slug}`;
      const existing = notesByEntity.get(key) ?? [];
      existing.push(note.id);
      notesByEntity.set(key, existing);
    }
  }

  for (const [tag, ids] of notesByTag) {
    for (const [left, right] of pairs(ids.slice(0, 100))) {
      addRelation(left, right, "shared-tag", `Shared tag: ${tag}`, 0.55);
    }
  }

  for (const [entity, ids] of notesByEntity) {
    for (const [left, right] of pairs(ids.slice(0, 100))) {
      addRelation(left, right, "shared-entity", `Shared entity: ${entity}`, 0.72);
    }
  }

  if (relationMap.size === 0) return;

  await db.relatedNote.createMany({
    data: [...relationMap.values()].map((relation) => ({
      ...relation,
      source: RelatedNoteSource.INFERRED
    })),
    skipDuplicates: true
  });
}

function pairs(ids: string[]) {
  const result: Array<[string, string]> = [];
  for (let left = 0; left < ids.length; left += 1) {
    for (let right = left + 1; right < ids.length; right += 1) {
      result.push([ids[left], ids[right]]);
    }
  }
  return result;
}

function makeSourceIdentity(rootPath: string, relativePath: string) {
  return `${hashText(rootPath).slice(0, 14)}:${relativePath}`;
}

function coerceEntityKind(value: string) {
  const normalized = value.toUpperCase().replace(/[\s-]+/g, "_");
  if (normalized in EntityKind) return EntityKind[normalized as keyof typeof EntityKind];
  return EntityKind.OTHER;
}

function coerceLinkKind(value: string) {
  if (value in LinkKind) return LinkKind[value as keyof typeof LinkKind];
  return LinkKind.URL;
}
