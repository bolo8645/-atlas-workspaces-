import type { Prisma } from "@prisma/client";
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

export async function getNotesWorkspaceData(searchParams: SearchParams = {}) {
  const nodeId = readParam(searchParams, "node");
  const selectedNoteId = readParam(searchParams, "note");
  if (!hasDatabaseUrl) {
    return {
      nodeId,
      selectedNoteId,
      notes: [],
      searchNotes: [],
      selectedNote: null
    };
  }

  const workspaceId = await getActiveWorkspaceId();
  const where = await buildWorkspaceWhere(workspaceId, nodeId);
  const noteInclude = {
    metadataOverride: true,
    navigationNode: true,
    entity: true
  } satisfies Prisma.NoteInclude;
  const noteOrderBy = [{ isPinned: "desc" }, { sortOrder: "asc" }, { updatedAt: "desc" }, { title: "asc" }] satisfies Prisma.NoteOrderByWithRelationInput[];

  const [notes, searchNotes, selectedNote] = await Promise.all([
    prisma.note.findMany({
      where,
      orderBy: noteOrderBy,
      take: 300,
      include: noteInclude
    }),
    prisma.note.findMany({
      orderBy: noteOrderBy,
      where: { workspaceId },
      take: 1000,
      include: noteInclude
    }),
    selectedNoteId
      ? prisma.note.findUnique({
          where: { id: selectedNoteId, workspaceId },
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
        entityId: { in: relatedEntityIds }
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
  if (!nodeId) return { workspaceId };
  if (nodeId === "unassigned") return { workspaceId, navigationNodeId: null };

  return { workspaceId, navigationNodeId: nodeId };
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
