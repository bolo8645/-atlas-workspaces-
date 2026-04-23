import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeFullNavigationPath, normalizeNavigationSlug, type NavigationPathNode } from "@/lib/navigation-utils";
import { getActiveWorkspaceId } from "@/lib/workspaces";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type CreateNavigationNodeInput = {
  parentId?: string | null;
  title?: string | null;
  slug?: string | null;
  description?: string | null;
  sortOrder?: number | null;
  isVisible?: boolean;
};

export type UpdateNavigationNodeInput = CreateNavigationNodeInput & {
  id: string;
};

export type NavigationFolderResult = {
  id: string;
  parentId: string | null;
  title: string;
  slug: string;
  fullPath: string;
};

export async function createNavigationNode(input: CreateNavigationNodeInput) {
  const workspaceId = await getActiveWorkspaceId();
  const title = requiredClean(input.title, "title");
  const parentId = clean(input.parentId) ?? null;
  const slug = normalizeNavigationSlug(clean(input.slug) || title);
  const sortOrder = input.sortOrder ?? (await nextSortOrder(workspaceId, parentId));

  await assertParentExists(prisma, workspaceId, parentId);
  await assertUniqueSiblingSlug(prisma, workspaceId, parentId, slug);

  return prisma.navigationNode.create({
    data: {
      workspaceId,
      parentId,
      title,
      slug,
      description: clean(input.description),
      sortOrder,
      isVisible: input.isVisible ?? true
    }
  });
}

export async function findOrCreateNavigationFolder(input: { parentId?: string | null; title?: string | null }) {
  const workspaceId = await getActiveWorkspaceId();
  const title = requiredClean(input.title, "title");
  const parentId = clean(input.parentId) ?? null;
  const slug = normalizeNavigationSlug(title);

  await assertParentExists(prisma, workspaceId, parentId);

  const existing = await prisma.navigationNode.findFirst({
    where: {
      workspaceId,
      parentId,
      slug
    },
    select: { id: true }
  });

  const node = existing
    ? existing
    : await prisma.navigationNode.create({
        data: {
          workspaceId,
          parentId,
          title,
          slug,
          sortOrder: await nextSortOrder(workspaceId, parentId),
          isVisible: true
        },
        select: { id: true }
      });

  return serializeNavigationFolder(workspaceId, node.id);
}

export async function updateNavigationNode(input: UpdateNavigationNodeInput) {
  const workspaceId = await getActiveWorkspaceId();
  const title = requiredClean(input.title, "title");
  const parentId = clean(input.parentId) ?? null;
  const slug = normalizeNavigationSlug(clean(input.slug) || title);
  const sortOrder = input.sortOrder ?? 0;

  await assertParentExists(prisma, workspaceId, parentId);
  await assertValidMove(workspaceId, input.id, parentId);
  await assertUniqueSiblingSlug(prisma, workspaceId, parentId, slug, input.id);

  return prisma.navigationNode.update({
    where: { id: input.id, workspaceId },
    data: {
      parentId,
      title,
      slug,
      description: clean(input.description),
      sortOrder,
      isVisible: input.isVisible ?? true
    }
  });
}

export async function renameNavigationNode(input: { id: string; title?: string | null }) {
  const workspaceId = await getActiveWorkspaceId();
  const title = requiredClean(input.title, "title");
  const node = await prisma.navigationNode.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      parentId: true,
      workspaceId: true
    }
  });
  if (!node || node.workspaceId !== workspaceId) throw new Error("Navigation node not found.");

  const slug = normalizeNavigationSlug(title);
  await assertUniqueSiblingSlug(prisma, workspaceId, node.parentId, slug, input.id);

  return prisma.navigationNode.update({
    where: { id: input.id, workspaceId },
    data: {
      title,
      slug
    }
  });
}

export async function moveNavigationNode(input: { id: string; parentId?: string | null; sortOrder?: number | null }) {
  const workspaceId = await getActiveWorkspaceId();
  const node = await prisma.navigationNode.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      slug: true,
      workspaceId: true
    }
  });
  if (!node || node.workspaceId !== workspaceId) throw new Error("Navigation node not found.");

  const parentId = clean(input.parentId) ?? null;
  await assertParentExists(prisma, workspaceId, parentId);
  await assertValidMove(workspaceId, input.id, parentId);
  await assertUniqueSiblingSlug(prisma, workspaceId, parentId, node.slug, input.id);

  return prisma.navigationNode.update({
    where: { id: input.id, workspaceId },
    data: {
      parentId,
      sortOrder: input.sortOrder ?? undefined
    }
  });
}

export async function deleteNavigationNode(id: string) {
  const workspaceId = await getActiveWorkspaceId();
  const node = await prisma.navigationNode.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          children: true,
          notes: true
        }
      }
    }
  });
  if (!node || node.workspaceId !== workspaceId) throw new Error("Navigation node not found.");
  if (node._count.children > 0) throw new Error("Move or delete child nodes before deleting this node.");
  if (node._count.notes > 0) throw new Error("Reassign notes before deleting this node.");

  await prisma.navigationNode.delete({
    where: { id, workspaceId }
  });
}

async function nextSortOrder(workspaceId: string, parentId: string | null) {
  const sibling = await prisma.navigationNode.findFirst({
    where: { workspaceId, parentId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true }
  });

  return (sibling?.sortOrder ?? 0) + 10;
}

async function assertParentExists(db: DbClient, workspaceId: string, parentId: string | null) {
  if (!parentId) return;
  const parent = await db.navigationNode.findUnique({
    where: { id: parentId },
    select: { id: true, workspaceId: true }
  });
  if (!parent || parent.workspaceId !== workspaceId) throw new Error("Parent navigation node not found.");
}

async function assertUniqueSiblingSlug(db: DbClient, workspaceId: string, parentId: string | null, slug: string, excludeId?: string) {
  const existing = await db.navigationNode.findFirst({
    where: {
      workspaceId,
      parentId,
      slug,
      id: excludeId ? { not: excludeId } : undefined
    },
    select: { id: true }
  });

  if (existing) throw new Error("A sibling navigation node already uses this slug.");
}

async function assertValidMove(workspaceId: string, nodeId: string, parentId: string | null) {
  if (!parentId) return;
  if (nodeId === parentId) throw new Error("A navigation node cannot be its own parent.");

  const records = await prisma.navigationNode.findMany({
    where: { workspaceId },
    select: {
      id: true,
      parentId: true
    }
  });
  const childrenByParent = new Map<string | null, string[]>();
  for (const record of records) {
    const children = childrenByParent.get(record.parentId) ?? [];
    children.push(record.id);
    childrenByParent.set(record.parentId, children);
  }

  const stack = [...(childrenByParent.get(nodeId) ?? [])];
  while (stack.length > 0) {
    const currentId = stack.pop();
    if (!currentId) continue;
    if (currentId === parentId) throw new Error("A navigation node cannot be moved under one of its descendants.");
    stack.push(...(childrenByParent.get(currentId) ?? []));
  }
}

async function serializeNavigationFolder(workspaceId: string, id: string): Promise<NavigationFolderResult> {
  const records = await prisma.navigationNode.findMany({
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

function requiredClean(value: string | null | undefined, fieldName: string) {
  const cleaned = clean(value);
  if (!cleaned) throw new Error(`Navigation ${fieldName} is required.`);
  return cleaned;
}

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}
