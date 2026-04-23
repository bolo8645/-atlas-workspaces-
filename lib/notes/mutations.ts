import { randomUUID } from "node:crypto";
import { EntityKind, MetadataSource, NoteStatus, RelatedNoteSource, ReviewStatus, type Prisma, type PrismaClient } from "@prisma/client";
import type { CanonicalEntitySummary } from "@/lib/entities";
import { computeFullNavigationPath, normalizeNavigationSlug, type NavigationPathNode } from "@/lib/navigation-utils";
import { prisma } from "@/lib/prisma";
import { excerpt, hashText, makeContentFingerprint, makeTitleFingerprint, slugify } from "@/lib/import/text";
import { getActiveWorkspaceId } from "@/lib/workspaces";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type UpdateNoteMetadataInput = {
  noteId: string;
  displayTitle?: string;
  summary?: string;
  status?: string;
  priority?: number | null;
  entityType?: string;
  notes?: string;
  tags?: string[];
  categories?: string[];
};

export type NavigationAssignmentInput = {
  navigationNodeId?: string | null;
  createNavigationNodeTitle?: string | null;
  createParentId?: string | null;
};

export type NavigationAssignmentTarget = {
  id: string;
  parentId: string | null;
  title: string;
  slug: string;
  fullPath: string;
};

export type UpdateEditorNoteInput = {
  noteId: string;
  title?: string | null;
  content?: string | null;
  noteType?: string | null;
};

export type EditorEntitySummary = CanonicalEntitySummary | null;

export type ReorderNotesInput = {
  navigationNodeId?: string | null;
  noteIds: string[];
};

export type MoveNoteInput = {
  noteId: string;
  navigationNodeId?: string | null;
};

export type EntityLinkInput = {
  noteId: string;
  entityId?: string | null;
};

export async function updateNoteMetadata(input: UpdateNoteMetadataInput) {
  const status = coerceEnum(NoteStatus, input.status);
  const entityType = coerceEnum(EntityKind, input.entityType);
  const priority = typeof input.priority === "number" && Number.isFinite(input.priority) ? input.priority : null;
  const workspaceId = await getActiveWorkspaceId();

  await prisma.$transaction(async (tx) => {
    const note = await tx.note.findUnique({
      where: { id: input.noteId, workspaceId },
      select: { id: true }
    });
    if (!note) throw new Error("Note not found.");

    await tx.metadataOverride.upsert({
      where: { noteId: input.noteId },
      update: {
        displayTitle: clean(input.displayTitle),
        summary: clean(input.summary),
        status,
        priority,
        entityType,
        notes: clean(input.notes)
      },
      create: {
        noteId: input.noteId,
        displayTitle: clean(input.displayTitle),
        summary: clean(input.summary),
        status,
        priority,
        entityType,
        notes: clean(input.notes)
      }
    });

    await tx.note.update({
      where: { id: input.noteId },
      data: {
        status: status ?? undefined,
        priority,
        entityType,
        curatedSummary: clean(input.summary),
        metadataNotes: clean(input.notes)
      }
    });

    if (input.tags) await syncManualTags(tx, input.noteId, input.tags);
    if (input.categories) await syncManualCategories(tx, input.noteId, input.categories);
  });
}

export async function createManualRelationship(input: { noteId: string; targetNoteId: string; relationType?: string; reason?: string }) {
  if (input.noteId === input.targetNoteId) throw new Error("A note cannot be related to itself.");
  const relationType = clean(input.relationType) || "manual";
  const workspaceId = await getActiveWorkspaceId();

  const notes = await prisma.note.findMany({
    where: {
      workspaceId,
      id: { in: [input.noteId, input.targetNoteId] }
    },
    select: { id: true }
  });
  if (notes.length !== 2) throw new Error("Both notes must exist in the active workspace.");

  await prisma.relatedNote.upsert({
    where: {
      fromNoteId_toNoteId_relationType: {
        fromNoteId: input.noteId,
        toNoteId: input.targetNoteId,
        relationType
      }
    },
    update: {
      reason: clean(input.reason),
      confidence: 1,
      source: RelatedNoteSource.MANUAL
    },
    create: {
      fromNoteId: input.noteId,
      toNoteId: input.targetNoteId,
      relationType,
      reason: clean(input.reason),
      confidence: 1,
      source: RelatedNoteSource.MANUAL
    }
  });
}

export async function updateReviewItemStatus(id: string, status: ReviewStatus) {
  await prisma.reviewItem.update({
    where: { id },
    data: {
      status,
      resolvedAt: status === ReviewStatus.OPEN ? null : new Date()
    }
  });
}

export async function updateNoteNavigationAssignment(input: { noteId: string } & NavigationAssignmentInput) {
  const workspaceId = await getActiveWorkspaceId();
  return prisma.$transaction(async (tx) => {
    const target = await resolveNavigationAssignmentTarget(tx, workspaceId, input);

    await tx.note.update({
      where: { id: input.noteId, workspaceId },
      data: { navigationNodeId: target?.id ?? null }
    });

    return target ? serializeNavigationTarget(tx, workspaceId, target.id) : null;
  });
}

export async function bulkUpdateNoteNavigationAssignment(input: { noteIds: string[] } & NavigationAssignmentInput) {
  const workspaceId = await getActiveWorkspaceId();
  const noteIds = normalizeLabels(input.noteIds);
  if (noteIds.length === 0) throw new Error("Select at least one note.");

  await prisma.$transaction(async (tx) => {
    const target = await resolveNavigationAssignmentTarget(tx, workspaceId, input);

    await tx.note.updateMany({
      where: { workspaceId, id: { in: noteIds } },
      data: { navigationNodeId: target?.id ?? null }
    });
  });
}

export async function createEditorNote(input: { navigationNodeId?: string | null; title?: string | null; content?: string | null; noteType?: string | null }) {
  const workspaceId = await getActiveWorkspaceId();
  const id = randomUUID();
  const title = clean(input.title) ?? "Untitled Note";
  const content = input.content ?? "";
  const noteType = clean(input.noteType);
  const navigationNodeId = clean(input.navigationNodeId) ?? null;
  if (navigationNodeId) await assertNavigationNodeExists(prisma, workspaceId, navigationNodeId);
  const sortOrder = await nextNoteSortOrder(prisma, workspaceId, navigationNodeId);

  return prisma.note.create({
    data: {
      id,
      workspaceId,
      navigationNodeId,
      sortOrder,
      sourceIdentity: `manual:${id}`,
      sourcePath: `manual/${id}.md`,
      sourceFileName: title,
      sourceExtension: ".md",
      sourceChecksum: hashText(`manual:${id}`),
      contentFingerprint: makeContentFingerprint(content),
      title,
      titleFingerprint: makeTitleFingerprint(`${title}-${id}`),
      importedContent: "",
      plainTextContent: content,
      excerpt: excerpt(content || title),
      status: NoteStatus.ACTIVE,
      parseQuality: 100,
      curatedSummary: content,
      noteType: noteType ?? undefined,
      metadataOverride: {
        create: {
          displayTitle: title,
          summary: content,
          status: NoteStatus.ACTIVE
        }
      }
    },
    select: {
      id: true,
      entity: {
        select: {
          id: true,
          name: true,
          type: true,
          aliases: true
        }
      }
    }
  });
}

export async function updateEditorNote(input: UpdateEditorNoteInput): Promise<EditorEntitySummary> {
  const workspaceId = await getActiveWorkspaceId();
  const title = clean(input.title) ?? "Untitled Note";
  const hasContent = input.content !== undefined;
  const content = input.content ?? "";

  return prisma.$transaction(async (tx) => {
    const existingNote = await tx.note.findUnique({
      where: { id: input.noteId, workspaceId },
      select: {
        entityId: true,
        entity: {
          select: {
            id: true,
            name: true,
            type: true,
            aliases: true
          }
        }
      }
    });
    if (!existingNote) throw new Error("Note not found.");

    await tx.metadataOverride.upsert({
      where: { noteId: input.noteId },
      update: {
        displayTitle: title,
        summary: hasContent ? content : undefined
      },
      create: {
        noteId: input.noteId,
        displayTitle: title,
        summary: hasContent ? content : undefined
      }
    });

    await tx.note.update({
      where: { id: input.noteId, workspaceId },
      data: {
        noteType: clean(input.noteType) ?? undefined,
        curatedSummary: hasContent ? content : undefined,
        excerpt: hasContent ? excerpt(content || title) : undefined,
        updatedDate: new Date()
      }
    });

    return existingNote.entity
      ? {
          id: existingNote.entity.id,
          name: existingNote.entity.name,
          type: existingNote.entity.type,
          aliases: existingNote.entity.aliases
        }
      : null;
  });
}

export async function updateNoteEntityLink(input: EntityLinkInput): Promise<EditorEntitySummary> {
  const workspaceId = await getActiveWorkspaceId();
  const entityId = clean(input.entityId);
  if (entityId) {
    const entity = await prisma.entity.findUnique({
      where: { id: entityId },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        type: true,
        aliases: true
      }
    });
    if (!entity || entity.workspaceId !== workspaceId) throw new Error("Entity not found.");
    await prisma.note.update({
      where: { id: input.noteId, workspaceId },
      data: { entityId }
    });
    return {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      aliases: entity.aliases
    };
  }

  await prisma.note.update({
    where: { id: input.noteId, workspaceId },
    data: { entityId: null }
  });
  return null;
}

export async function deleteEditorNote(noteId: string) {
  const workspaceId = await getActiveWorkspaceId();
  await prisma.note.delete({
    where: { id: noteId, workspaceId }
  });
}

export async function toggleNotePinned(input: { noteId: string; isPinned: boolean }) {
  const workspaceId = await getActiveWorkspaceId();
  await prisma.note.update({
    where: { id: input.noteId, workspaceId },
    data: { isPinned: input.isPinned }
  });
}

export async function reorderNotes(input: ReorderNotesInput) {
  const workspaceId = await getActiveWorkspaceId();
  const noteIds = normalizeLabels(input.noteIds);
  if (noteIds.length === 0) return;
  const navigationNodeId = clean(input.navigationNodeId) ?? null;
  if (navigationNodeId) await assertNavigationNodeExists(prisma, workspaceId, navigationNodeId);

  await prisma.$transaction(
    noteIds.map((id, index) =>
      prisma.note.update({
        where: { id, workspaceId },
        data: {
          navigationNodeId,
          sortOrder: (index + 1) * 10
        }
      })
    )
  );
}

export async function moveNoteToNavigationNode(input: MoveNoteInput) {
  const workspaceId = await getActiveWorkspaceId();
  const navigationNodeId = clean(input.navigationNodeId) ?? null;
  if (navigationNodeId) await assertNavigationNodeExists(prisma, workspaceId, navigationNodeId);
  const sortOrder = await nextNoteSortOrder(prisma, workspaceId, navigationNodeId);

  await prisma.note.update({
    where: { id: input.noteId, workspaceId },
    data: {
      navigationNodeId,
      sortOrder
    }
  });
}

async function resolveNavigationAssignmentTarget(db: DbClient, workspaceId: string, input: NavigationAssignmentInput) {
  const createTitle = clean(input.createNavigationNodeTitle);
  if (createTitle) return findOrCreateNavigationNode(db, workspaceId, createTitle, clean(input.createParentId) ?? null);

  const navigationNodeId = clean(input.navigationNodeId);
  if (!navigationNodeId) return null;

  const node = await db.navigationNode.findUnique({
    where: { id: navigationNodeId },
    select: { id: true, workspaceId: true }
  });
  if (!node || node.workspaceId !== workspaceId) throw new Error("Navigation node not found.");
  return node;
}

async function nextNoteSortOrder(db: DbClient, workspaceId: string, navigationNodeId: string | null) {
  const note = await db.note.findFirst({
    where: { workspaceId, navigationNodeId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true }
  });

  return (note?.sortOrder ?? 0) + 10;
}

async function findOrCreateNavigationNode(db: DbClient, workspaceId: string, title: string, parentId: string | null) {
  if (parentId) await assertNavigationNodeExists(db, workspaceId, parentId);

  const slug = normalizeNavigationSlug(title);
  const existing = await db.navigationNode.findFirst({
    where: {
      workspaceId,
      parentId,
      slug
    },
    select: { id: true }
  });
  if (existing) return existing;

  const sibling = await db.navigationNode.findFirst({
    where: { workspaceId, parentId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true }
  });

  return db.navigationNode.create({
    data: {
      workspaceId,
      parentId,
      title,
      slug,
      sortOrder: (sibling?.sortOrder ?? 0) + 10,
      isVisible: true
    },
    select: { id: true }
  });
}

async function serializeNavigationTarget(db: DbClient, workspaceId: string, id: string): Promise<NavigationAssignmentTarget> {
  const records = await db.navigationNode.findMany({
    where: { workspaceId },
    select: {
      id: true,
      parentId: true,
      slug: true,
      title: true
    }
  });
  const nodesById = new Map<string, NavigationPathNode>(records.map((record) => [record.id, record]));
  const target = records.find((record) => record.id === id);
  if (!target) throw new Error("Navigation node not found.");

  return {
    id: target.id,
    parentId: target.parentId,
    title: target.title,
    slug: target.slug,
    fullPath: computeFullNavigationPath(target, nodesById)
  };
}

async function syncManualTags(db: DbClient, noteId: string, tags: string[]) {
  await db.noteTag.deleteMany({ where: { noteId, source: MetadataSource.MANUAL } });

  for (const name of normalizeLabels(tags)) {
    const tag = await db.tag.upsert({
      where: { slug: slugify(name) },
      update: { name },
      create: { slug: slugify(name), name }
    });

    await db.noteTag.upsert({
      where: { noteId_tagId: { noteId, tagId: tag.id } },
      update: {},
      create: { noteId, tagId: tag.id, source: MetadataSource.MANUAL }
    });
  }
}

async function syncManualCategories(db: DbClient, noteId: string, categories: string[]) {
  await db.noteCategory.deleteMany({ where: { noteId, source: MetadataSource.MANUAL } });

  for (const name of normalizeLabels(categories)) {
    const category = await db.category.upsert({
      where: { slug: slugify(name) },
      update: { name },
      create: { slug: slugify(name), name }
    });

    await db.noteCategory.upsert({
      where: { noteId_categoryId: { noteId, categoryId: category.id } },
      update: {},
      create: { noteId, categoryId: category.id, source: MetadataSource.MANUAL }
    });
  }
}

function normalizeLabels(values: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const cleanValue = clean(value);
    if (!cleanValue) continue;
    const key = cleanValue.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(cleanValue);
  }

  return normalized;
}

async function assertNavigationNodeExists(db: DbClient, workspaceId: string, navigationNodeId: string) {
  const node = await db.navigationNode.findUnique({
    where: { id: navigationNodeId },
    select: { id: true, workspaceId: true }
  });
  if (!node || node.workspaceId !== workspaceId) throw new Error("Navigation node not found.");
}

function clean(value: string | undefined | null) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function coerceEnum<T extends Record<string, string>>(enumObject: T, value: string | undefined) {
  if (!value) return undefined;
  const values = Object.values(enumObject) as string[];
  return values.includes(value) ? (value as T[keyof T]) : undefined;
}
