import { Prisma } from "@prisma/client";
import { hasDatabaseUrl } from "@/lib/db-env";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/workspaces";

type SearchParams = Record<string, string | string[] | undefined>;

export type NotesWorkspaceData = Awaited<ReturnType<typeof getNotesWorkspaceData>>;
export type InterconnectedRelationship = {
  id: string;
  type: string;
  relationshipType: {
    id: string;
    name: string;
    isSystem: boolean;
  };
  description: string | null;
  otherEntity: {
    id: string;
    name: string;
    type: string;
    noteId: string | null;
  };
};

const noteSupportsDeletedAt = Prisma.dmmf.datamodel.models
  .find((model) => model.name === "Note")
  ?.fields.some((field) => field.name === "deletedAt") ?? false;

const noteSupportsPinnedState = Prisma.dmmf.datamodel.models
  .find((model) => model.name === "Note")
  ?.fields.some((field) => field.name === "isPinned") ?? false;

export async function getNotesWorkspaceData(searchParams: SearchParams = {}) {
  const nodeId = readParam(searchParams, "node");
  const selectedNoteId = readParam(searchParams, "note");
  const emptyResult = {
    nodeId,
    selectedNoteId,
    notes: [],
    searchNotes: [],
    selectedNote: null,
    interconnectionsByEntityId: {}
  };
  if (!hasDatabaseUrl) {
    return emptyResult;
  }

  try {
    const workspaceId = await getActiveWorkspaceId();
    const where = await buildWorkspaceWhere(workspaceId, nodeId);
    const noteInclude = {
      metadataOverride: true,
      navigationNode: true,
      entity: true,
      tags: { include: { tag: true }, orderBy: { tag: { name: "asc" } } }
    } satisfies Prisma.NoteInclude;
    const noteOrderBy = [
      ...(noteSupportsPinnedState ? ([{ isPinned: "desc" }] satisfies Prisma.NoteOrderByWithRelationInput[]) : []),
      { sortOrder: "asc" },
      { updatedAt: "desc" },
      { title: "asc" }
    ] satisfies Prisma.NoteOrderByWithRelationInput[];

    const [notes, searchNotes, selectedNote] = await Promise.all([
      prisma.note.findMany({
        where,
        orderBy: noteOrderBy,
        take: 300,
        include: noteInclude
      }),
      prisma.note.findMany({
        orderBy: noteOrderBy,
        where: {
          workspaceId,
          ...(noteSupportsDeletedAt ? { deletedAt: null } : {})
        },
        take: 1000,
        include: noteInclude
      }),
      selectedNoteId
        ? prisma.note.findFirst({
            where: {
              id: selectedNoteId,
              workspaceId,
              ...(noteSupportsDeletedAt ? { deletedAt: null } : {})
            },
            include: noteInclude
          })
        : null
    ]);
    const entityIds = uniqueEntityIds([...notes, ...searchNotes, ...(selectedNote ? [selectedNote] : [])]);
    const interconnectionsByEntityId = await getInterconnectionsByEntityId(workspaceId, entityIds);

    return {
      nodeId,
      selectedNoteId,
      notes,
      searchNotes,
      selectedNote,
      interconnectionsByEntityId
    };
  } catch (error) {
    if (isPrismaValidationError(error)) {
      console.warn("Notes workspace query is out of sync with the current Prisma client/runtime. Regenerate Prisma Client and restart the dev server.");
      return emptyResult;
    }
    throw error;
  }
}

async function getInterconnectionsByEntityId(workspaceId: string, entityIds: string[]) {
  if (entityIds.length === 0) return {} as Record<string, InterconnectedRelationship[]>;

  const relationships = await prisma.relationship.findMany({
    where: {
      workspaceId,
      OR: [{ entityAId: { in: entityIds } }, { entityBId: { in: entityIds } }]
    },
    orderBy: [{ relationshipType: { name: "asc" } }, { createdAt: "asc" }],
    select: {
      id: true,
      entityAId: true,
      entityBId: true,
      type: true,
      relationshipType: {
        select: {
          id: true,
          name: true,
          isSystem: true
        }
      },
      description: true
    }
  });

  const relatedEntityIds = uniqueStrings(relationships.flatMap((relationship) => [relationship.entityAId, relationship.entityBId]));
  const [entities, notes] = await Promise.all([
    prisma.entity.findMany({
      where: {
        workspaceId,
        id: { in: relatedEntityIds }
      },
      select: {
        id: true,
        name: true,
        type: true,
        aliases: true
      }
    }),
    prisma.note.findMany({
      where: {
        workspaceId,
        entityId: { in: relatedEntityIds },
        ...(noteSupportsDeletedAt ? { deletedAt: null } : {})
      },
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        entityId: true
      }
    })
  ]);

  const entitiesById = new Map(entities.map((entity) => [entity.id, entity]));
  const noteIdByEntityId = new Map<string, string>();
  for (const note of notes) {
    if (note.entityId && !noteIdByEntityId.has(note.entityId)) noteIdByEntityId.set(note.entityId, note.id);
  }

  const requestedEntityIds = new Set(entityIds);
  const result: Record<string, InterconnectedRelationship[]> = {};
  for (const relationship of relationships) {
    for (const currentEntityId of [relationship.entityAId, relationship.entityBId]) {
      if (!requestedEntityIds.has(currentEntityId)) continue;
      const otherEntityId = relationship.entityAId === currentEntityId ? relationship.entityBId : relationship.entityAId;
      const otherEntity = entitiesById.get(otherEntityId);
      if (!otherEntity) continue;
      const connection: InterconnectedRelationship = {
        id: relationship.id,
        type: relationship.type,
        relationshipType: relationship.relationshipType,
        description: relationship.description,
        otherEntity: {
          id: otherEntity.id,
          name: otherEntity.name,
          type: otherEntity.type,
          noteId: noteIdByEntityId.get(otherEntity.id) ?? null
        }
      };
      result[currentEntityId] = [...(result[currentEntityId] ?? []), connection];
    }
  }

  return result;
}

async function buildWorkspaceWhere(workspaceId: string, nodeId: string | undefined): Promise<Prisma.NoteWhereInput> {
  if (!nodeId) return { workspaceId, ...(noteSupportsDeletedAt ? { deletedAt: null } : {}) };
  if (nodeId === "unassigned") return { workspaceId, navigationNodeId: null, ...(noteSupportsDeletedAt ? { deletedAt: null } : {}) };

  return { workspaceId, navigationNodeId: nodeId, ...(noteSupportsDeletedAt ? { deletedAt: null } : {}) };
}

function readParam(searchParams: SearchParams, key: string) {
  const value = searchParams[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

function uniqueEntityIds(notes: Array<{ entityId: string | null }>) {
  return uniqueStrings(notes.map((note) => note.entityId).filter((id): id is string => Boolean(id)));
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function isPrismaValidationError(error: unknown) {
  return error instanceof Prisma.PrismaClientValidationError;
}
