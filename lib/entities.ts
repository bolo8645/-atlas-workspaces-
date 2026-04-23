import { EntityKind, MetadataSource } from "@prisma/client";
import { hasDatabaseUrl } from "@/lib/db-env";
import { slugify } from "@/lib/import/text";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/workspaces";

export type CanonicalEntitySummary = {
  id: string;
  name: string;
  type: string;
  aliases: string[];
};

export async function createExplicitEntity(input: { name: string; type: string; aliases?: string[]; allowDuplicate?: boolean }) {
  if (!hasDatabaseUrl) return null;
  const workspaceId = await getActiveWorkspaceId();
  const name = validateEntityName(input.name);
  const type = normalizeEntityType(input.type);
  const kind = noteTypeToEntityKind(type);
  const aliases = normalizeAliases(input.aliases ?? []);
  const slug = await uniqueEntitySlug(workspaceId, name, kind, Boolean(input.allowDuplicate));

  return prisma.entity.create({
    data: {
      workspaceId,
      slug,
      name,
      type,
      kind,
      aliases
    },
    select: entitySummarySelect()
  });
}

export async function findEntityByName(input: { name: string; type?: string | null }) {
  if (!hasDatabaseUrl) return null;
  const workspaceId = await getActiveWorkspaceId();
  const normalizedName = normalizeEntityName(input.name);
  if (!normalizedName) return null;
  const entities = await prisma.entity.findMany({
    where: {
      workspaceId,
      ...(input.type ? { type: normalizeEntityType(input.type) } : {})
    },
    select: entitySummarySelect()
  });
  return entities.find((entity) => [entity.name, ...entity.aliases].some((key) => normalizeEntityName(key) === normalizedName)) ?? null;
}

export async function updateExplicitEntity(input: { entityId: string; name?: string | null; type?: string | null; aliases?: string[] | null }) {
  if (!hasDatabaseUrl) return null;
  const workspaceId = await getActiveWorkspaceId();
  const existing = await prisma.entity.findUnique({ where: { id: input.entityId }, select: { id: true, workspaceId: true, kind: true } });
  if (!existing || existing.workspaceId !== workspaceId) throw new Error("Entity not found.");
  const name = input.name === undefined ? undefined : validateEntityName(input.name);
  const type = input.type === undefined || input.type === null ? undefined : normalizeEntityType(input.type);
  const kind = type ? noteTypeToEntityKind(type) : undefined;
  const aliases = input.aliases === undefined || input.aliases === null ? undefined : normalizeAliases(input.aliases);
  const slug = name ? await uniqueEntitySlug(workspaceId, name, kind ?? existing.kind, false, input.entityId) : undefined;

  return prisma.entity.update({
    where: { id: input.entityId },
    data: {
      name,
      slug,
      type,
      kind,
      aliases
    },
    select: entitySummarySelect()
  });
}

export async function attachNoteToEntity(input: { noteId: string; entityId: string }) {
  if (!hasDatabaseUrl) return null;
  const workspaceId = await getActiveWorkspaceId();
  const entity = await assertEntityInWorkspace(workspaceId, input.entityId);
  await prisma.note.update({
    where: { id: input.noteId, workspaceId },
    data: { entityId: entity.id }
  });
  return entity;
}

export async function removeNoteEntityLink(noteId: string) {
  if (!hasDatabaseUrl) return null;
  const workspaceId = await getActiveWorkspaceId();
  await prisma.note.update({
    where: { id: noteId, workspaceId },
    data: { entityId: null }
  });
  return null;
}

export async function linkTextSelectionToEntity(input: { noteId: string; entityId: string; text: string }) {
  if (!hasDatabaseUrl) return null;
  const workspaceId = await getActiveWorkspaceId();
  const entity = await assertEntityInWorkspace(workspaceId, input.entityId);
  const text = clean(input.text);
  if (!text) throw new Error("Select text before linking an entity.");
  const note = await prisma.note.findUnique({ where: { id: input.noteId, workspaceId }, select: { id: true } });
  if (!note) throw new Error("Note not found.");
  await prisma.noteEntity.upsert({
    where: {
      noteId_entityId: {
        noteId: input.noteId,
        entityId: entity.id
      }
    },
    update: {
      evidence: text,
      source: MetadataSource.MANUAL,
      confidence: 1
    },
    create: {
      noteId: input.noteId,
      entityId: entity.id,
      evidence: text,
      source: MetadataSource.MANUAL,
      confidence: 1
    }
  });
  return entity;
}

export async function mergeEntityIntoTarget(input: { sourceEntityId: string; targetEntityId: string }) {
  if (!hasDatabaseUrl) return null;
  if (input.sourceEntityId === input.targetEntityId) throw new Error("Choose a different target entity.");
  const workspaceId = await getActiveWorkspaceId();
  const source = await assertEntityInWorkspace(workspaceId, input.sourceEntityId, true);
  const target = await assertEntityInWorkspace(workspaceId, input.targetEntityId);

  await prisma.$transaction(async (tx) => {
    await tx.note.updateMany({
      where: { workspaceId, entityId: source.id },
      data: { entityId: target.id }
    });

    const sourceLinks = await tx.noteEntity.findMany({
      where: { entityId: source.id },
      select: { noteId: true, evidence: true }
    });
    for (const link of sourceLinks) {
      await tx.noteEntity.upsert({
        where: {
          noteId_entityId: {
            noteId: link.noteId,
            entityId: target.id
          }
        },
        update: {
          evidence: link.evidence ?? undefined,
          source: MetadataSource.MANUAL,
          confidence: 1
        },
        create: {
          noteId: link.noteId,
          entityId: target.id,
          evidence: link.evidence,
          source: MetadataSource.MANUAL,
          confidence: 1
        }
      });
    }
    await tx.noteEntity.deleteMany({ where: { entityId: source.id } });

    const relationships = await tx.relationship.findMany({
      where: {
        workspaceId,
        OR: [{ entityAId: source.id }, { entityBId: source.id }]
      }
    });
    for (const relationship of relationships) {
      const otherId = relationship.entityAId === source.id ? relationship.entityBId : relationship.entityAId;
      if (otherId === target.id) {
        await tx.relationship.delete({ where: { id: relationship.id } });
        continue;
      }
      const [entityAId, entityBId] = [target.id, otherId].sort();
      const existing = await tx.relationship.findUnique({
        where: {
          workspaceId_entityAId_entityBId: {
            workspaceId,
            entityAId,
            entityBId
          }
        },
        select: { id: true, description: true }
      });
      if (existing) {
        await tx.relationship.update({
          where: { id: existing.id },
          data: {
            description: existing.description ?? relationship.description
          }
        });
        await tx.relationship.delete({ where: { id: relationship.id } });
        continue;
      }
      await tx.relationship.update({
        where: { id: relationship.id },
        data: {
          entityAId,
          entityBId
        }
      });
    }

    await tx.entity.delete({ where: { id: source.id } });
  });

  return target;
}

export function normalizeEntityName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, "")
    .replace(/\s+/g, " ")
    .replace(/^(the|a|an)\s+/i, "");
}

export function isValidEntityName(value: string | null | undefined) {
  const name = clean(value);
  if (!name) return false;
  return !/^untitled(\s+(character|organization|location|story|entity|note))?$/i.test(name) && !/^unknown(\s+entity)?$/i.test(name);
}

export function normalizeEntityType(value: string) {
  return value.toLowerCase().trim().replace(/_/g, "-") || "other";
}

export function noteTypeToEntityKind(value: string) {
  const type = normalizeEntityType(value);
  if (type === "character") return EntityKind.CHARACTER;
  if (type === "organization") return EntityKind.ORGANIZATION;
  if (type === "location") return EntityKind.LOCATION;
  if (type === "story") return EntityKind.STORY_ARC;
  return EntityKind.OTHER;
}

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function validateEntityName(value: string | null | undefined) {
  const name = clean(value);
  if (!isValidEntityName(name)) throw new Error("Entity name is required and cannot be Untitled or Unknown.");
  return name as string;
}

function normalizeAliases(values: string[]) {
  const seen = new Set<string>();
  const aliases: string[] = [];
  for (const value of values) {
    const alias = clean(value);
    if (!alias) continue;
    const key = normalizeEntityName(alias);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    aliases.push(alias);
  }
  return aliases;
}

async function assertEntityInWorkspace(workspaceId: string, entityId: string, allowInvalid = false) {
  const entity = await prisma.entity.findUnique({
    where: { id: entityId },
    select: {
      id: true,
      name: true,
      type: true,
      aliases: true,
      workspaceId: true
    }
  });
  if (!entity || entity.workspaceId !== workspaceId) throw new Error("Entity not found.");
  if (!allowInvalid && !isValidEntityName(entity.name)) throw new Error("Repair this entity before using it.");
  return entity;
}

async function uniqueEntitySlug(workspaceId: string, name: string, kind: EntityKind, allowDuplicate: boolean, ignoreEntityId?: string) {
  const baseSlug = slugify(name) || "entity";
  if (!allowDuplicate) {
    const existing = await prisma.entity.findFirst({
      where: {
        workspaceId,
        slug: baseSlug,
        kind,
        ...(ignoreEntityId ? { id: { not: ignoreEntityId } } : {})
      },
      select: { id: true }
    });
    if (existing) throw new Error("Entity already exists.");
    return baseSlug;
  }

  let nextSlug = baseSlug;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const existing = await prisma.entity.findFirst({
      where: { workspaceId, slug: nextSlug, kind },
      select: { id: true }
    });
    if (!existing) return nextSlug;
    nextSlug = `${baseSlug}-${suffix}`;
  }
  throw new Error("Could not create a unique entity slug.");
}

function entitySummarySelect(extra?: Record<string, boolean>) {
  return {
    id: true,
    name: true,
    type: true,
    aliases: true,
    ...(extra ?? {})
  };
}
