import { hasDatabaseUrl } from "@/lib/db-env";
import { isValidEntityName, normalizeEntityName, normalizeEntityType } from "@/lib/entities";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/workspaces";

export type EntityIndexEntry = {
  id: string;
  title: string;
  type: string;
  matchKey: string;
  alias?: string;
};

export type RelationshipTypeOption = {
  id: string;
  name: string;
  isSystem: boolean;
};

export async function getEntityIndexForActiveWorkspace(): Promise<EntityIndexEntry[]> {
  if (!hasDatabaseUrl) return [];

  const workspaceId = await getActiveWorkspaceId();
  const [entities, noteEntityLinks] = await Promise.all([
    prisma.entity.findMany({
      where: { workspaceId },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
        kind: true,
        aliases: true
      }
    }),
    prisma.noteEntity.findMany({
      where: {
        note: { workspaceId },
        evidence: { not: null }
      },
      select: {
        entityId: true,
        evidence: true
      }
    })
  ]);
  const evidenceByEntityId = new Map<string, string[]>();
  for (const link of noteEntityLinks) {
    if (!link.evidence?.trim()) continue;
    evidenceByEntityId.set(link.entityId, [...(evidenceByEntityId.get(link.entityId) ?? []), link.evidence]);
  }

  return entities.flatMap((entity) => {
    const title = entity.name.trim();
    if (!isValidEntityName(title)) return [];
    const type = normalizeEntityType(entity.type || entity.kind);
    const keys = [title, ...entity.aliases, ...(evidenceByEntityId.get(entity.id) ?? [])].map((key) => key.trim()).filter(Boolean);
    const seen = new Set<string>();

    return keys.flatMap((key) => {
      const normalized = normalizeEntityKey(key);
      if (!normalized || seen.has(normalized)) return [];
      seen.add(normalized);
      return [
        {
          id: entity.id,
          title,
          type,
          matchKey: key,
          alias: key === title ? undefined : key
        }
      ];
    });
  });
}

export async function getRelationshipTypesForActiveWorkspace(): Promise<RelationshipTypeOption[]> {
  if (!hasDatabaseUrl) return [];
  const workspaceId = await getActiveWorkspaceId();
  await ensureSystemRelationshipTypes(workspaceId);
  return prisma.relationshipType.findMany({
    where: { workspaceId },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      isSystem: true
    }
  });
}

export async function createRelationshipType(name: string): Promise<RelationshipTypeOption> {
  if (!hasDatabaseUrl) return { id: `mock-relationship-type-${Date.now()}`, name: normalizeRelationshipTypeName(name), isSystem: false };
  const workspaceId = await getActiveWorkspaceId();
  const normalizedName = normalizeRelationshipTypeName(name);
  if (!normalizedName) throw new Error("Relationship type name is required.");
  return prisma.relationshipType.upsert({
    where: {
      workspaceId_name: {
        workspaceId,
        name: normalizedName
      }
    },
    update: {},
    create: {
      workspaceId,
      name: normalizedName,
      isSystem: false
    },
    select: {
      id: true,
      name: true,
      isSystem: true
    }
  });
}

export async function createRelationship(input: { entityAId: string; entityBId: string; relationshipTypeId?: string | null; relationshipTypeName?: string | null; type?: string; description?: string | null }) {
  if (!hasDatabaseUrl) return null;
  if (input.entityAId === input.entityBId) throw new Error("A relationship needs two distinct entities.");

  const workspaceId = await getActiveWorkspaceId();
  await ensureSystemRelationshipTypes(workspaceId);
  const [entityA, entityB] = await Promise.all([
    prisma.entity.findUnique({ where: { id: input.entityAId, workspaceId }, select: { id: true, name: true } }),
    prisma.entity.findUnique({ where: { id: input.entityBId, workspaceId }, select: { id: true, name: true } })
  ]);
  if (!entityA || !entityB) throw new Error("Both entities must exist in the active workspace.");
  if (!isValidEntityName(entityA.name) || !isValidEntityName(entityB.name)) throw new Error("Repair unnamed entities before creating relationships.");
  const relationshipType = await resolveRelationshipType(workspaceId, input);

  const [entityAId, entityBId] = [input.entityAId, input.entityBId].sort();
  return prisma.$transaction(async (tx) => {
    const existing = await tx.relationship.findUnique({
      where: {
        workspaceId_entityAId_entityBId: {
          workspaceId,
          entityAId,
          entityBId
        }
      },
      select: {
        id: true,
        description: true
      }
    });

    if (existing) {
      return tx.relationship.update({
        where: { id: existing.id },
        data: {
          relationshipTypeId: relationshipType.id,
          type: relationshipType.name,
          description: clean(input.description) ?? existing.description
        },
        include: {
          relationshipType: true
        }
      });
    }

    return tx.relationship.create({
      data: {
        workspaceId,
        entityAId,
        entityBId,
        relationshipTypeId: relationshipType.id,
        type: relationshipType.name,
        description: clean(input.description)
      },
      include: {
        relationshipType: true
      }
    });
  });
}

export async function updateRelationship(input: { relationshipId: string; relationshipTypeId?: string | null; relationshipTypeName?: string | null; description?: string | null }) {
  if (!hasDatabaseUrl) return null;
  const workspaceId = await getActiveWorkspaceId();
  await ensureSystemRelationshipTypes(workspaceId);
  const existing = await prisma.relationship.findUnique({
    where: { id: input.relationshipId },
    select: { id: true, workspaceId: true }
  });
  if (!existing || existing.workspaceId !== workspaceId) throw new Error("Relationship not found.");
  const relationshipType = await resolveRelationshipType(workspaceId, input);
  return prisma.relationship.update({
    where: { id: input.relationshipId },
    data: {
      relationshipTypeId: relationshipType.id,
      type: relationshipType.name,
      description: clean(input.description)
    },
    include: {
      relationshipType: true
    }
  });
}

export async function deleteRelationship(relationshipId: string) {
  if (!hasDatabaseUrl) return;
  const workspaceId = await getActiveWorkspaceId();
  const existing = await prisma.relationship.findUnique({
    where: { id: relationshipId },
    select: { id: true, workspaceId: true }
  });
  if (!existing || existing.workspaceId !== workspaceId) throw new Error("Relationship not found.");
  await prisma.relationship.delete({ where: { id: relationshipId } });
}

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function normalizeEntityKey(value: string) {
  return normalizeEntityName(value);
}

async function resolveRelationshipType(workspaceId: string, input: { relationshipTypeId?: string | null; relationshipTypeName?: string | null; type?: string }) {
  const relationshipTypeId = clean(input.relationshipTypeId);
  if (relationshipTypeId) {
    const existing = await prisma.relationshipType.findUnique({
      where: { id: relationshipTypeId },
      select: { id: true, workspaceId: true, name: true }
    });
    if (!existing || existing.workspaceId !== workspaceId) throw new Error("Relationship type not found.");
    return { id: existing.id, name: existing.name };
  }

  const name = normalizeRelationshipTypeName(input.relationshipTypeName ?? input.type ?? "related_to");
  const relationshipType = await prisma.relationshipType.upsert({
    where: {
      workspaceId_name: {
        workspaceId,
        name
      }
    },
    update: {},
    create: {
      workspaceId,
      name,
      isSystem: false
    },
    select: {
      id: true,
      name: true
    }
  });
  return relationshipType;
}

async function ensureSystemRelationshipTypes(workspaceId: string) {
  const names = ["affiliated_with", "hostile_to", "member_of", "leader_of", "located_in", "created", "related_to"];
  await prisma.$transaction(
    names.map((name) =>
      prisma.relationshipType.upsert({
        where: {
          workspaceId_name: {
            workspaceId,
            name
          }
        },
        update: {
          isSystem: true
        },
        create: {
          workspaceId,
          name,
          isSystem: true
        }
      })
    )
  );
}

function normalizeRelationshipTypeName(value: string | null | undefined) {
  return (
    clean(value)
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "related_to"
  );
}
