import { prisma } from "@/lib/prisma";
import { hasDatabaseUrl } from "@/lib/db-env";
import { computeFullNavigationPath, type NavigationPathNode } from "@/lib/navigation-utils";
import { getActiveWorkspaceId } from "@/lib/workspaces";

type NavigationRecord = {
  id: string;
  parentId: string | null;
  slug: string;
  title: string;
  description: string | null;
  sortOrder: number;
  isVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    notes: number;
  };
};

export type NavigationTreeNode = {
  id: string;
  parentId: string | null;
  slug: string;
  title: string;
  description: string | null;
  sortOrder: number;
  isVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
  directNoteCount: number;
  descendantNoteCount: number;
  fullPath: string;
  children: NavigationTreeNode[];
};

export type NavigationNodeOption = {
  id: string;
  parentId: string | null;
  title: string;
  slug: string;
  fullPath: string;
  depth: number;
  directNoteCount: number;
  descendantNoteCount: number;
};

export async function getNavigationTree(options: { visibleOnly?: boolean } = {}) {
  if (!hasDatabaseUrl) return [];

  const records = await getNavigationRecords();
  const tree = buildNavigationTree(records);
  return options.visibleOnly ? filterVisibleNavigationTree(tree) : tree;
}

export async function getNavigationNodeOptions() {
  const tree = await getNavigationTree();
  return flattenNavigationTree(tree);
}

export async function getNavigationNodeAndDescendantIds(nodeId: string) {
  if (!hasDatabaseUrl) return [];

  const workspaceId = await getActiveWorkspaceId();
  const records = await prisma.navigationNode.findMany({
    where: { workspaceId },
    select: {
      id: true,
      parentId: true
    }
  });
  const idsByParent = new Map<string | null, string[]>();
  const nodeIds = new Set(records.map((record) => record.id));

  for (const record of records) {
    const siblings = idsByParent.get(record.parentId) ?? [];
    siblings.push(record.id);
    idsByParent.set(record.parentId, siblings);
  }

  if (!nodeIds.has(nodeId)) return [];

  const result: string[] = [];
  const stack = [nodeId];
  while (stack.length > 0) {
    const currentId = stack.pop();
    if (!currentId) continue;
    result.push(currentId);
    stack.push(...(idsByParent.get(currentId) ?? []));
  }

  return result;
}

export async function getUnassignedNoteCount() {
  if (!hasDatabaseUrl) return 0;

  const workspaceId = await getActiveWorkspaceId();
  return prisma.note.count({
    where: {
      workspaceId,
      navigationNodeId: null
    }
  });
}

export async function getFullNavigationPath(nodeId: string) {
  if (!hasDatabaseUrl) return undefined;

  const workspaceId = await getActiveWorkspaceId();
  const records = await prisma.navigationNode.findMany({
    where: { workspaceId },
    select: {
      id: true,
      parentId: true,
      slug: true
    }
  });
  const nodesById = new Map<string, NavigationPathNode>(records.map((record) => [record.id, record]));
  const node = nodesById.get(nodeId);
  return node ? computeFullNavigationPath(node, nodesById) : undefined;
}

export async function getNotesByNavigationNode(nodeId: string, options: { includeDescendants?: boolean } = {}) {
  if (!hasDatabaseUrl) return [];

  const workspaceId = await getActiveWorkspaceId();
  const nodeIds = options.includeDescendants === true ? await getNavigationNodeAndDescendantIds(nodeId) : [nodeId];
  if (nodeIds.length === 0) return [];

  return prisma.note.findMany({
    where: {
      workspaceId,
      navigationNodeId: { in: nodeIds }
    },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      metadataOverride: true,
      tags: { include: { tag: true }, orderBy: { tag: { name: "asc" } } },
      categories: { include: { category: true }, orderBy: { category: { name: "asc" } } }
    }
  });
}

async function getNavigationRecords() {
  if (!hasDatabaseUrl) return [];

  const workspaceId = await getActiveWorkspaceId();
  return prisma.navigationNode.findMany({
    where: { workspaceId },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: {
      _count: {
        select: {
          notes: true
        }
      }
    }
  });
}

function buildNavigationTree(records: NavigationRecord[]) {
  const nodesById = new Map<string, NavigationTreeNode>();
  const pathNodesById = new Map<string, NavigationPathNode>();

  for (const record of records) {
    nodesById.set(record.id, {
      id: record.id,
      parentId: record.parentId,
      slug: record.slug,
      title: record.title,
      description: record.description,
      sortOrder: record.sortOrder,
      isVisible: record.isVisible,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      directNoteCount: record._count.notes,
      descendantNoteCount: record._count.notes,
      fullPath: "",
      children: []
    });
    pathNodesById.set(record.id, {
      id: record.id,
      parentId: record.parentId,
      slug: record.slug
    });
  }

  const roots: NavigationTreeNode[] = [];
  for (const node of nodesById.values()) {
    if (node.parentId && nodesById.has(node.parentId)) {
      nodesById.get(node.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }

  for (const node of nodesById.values()) {
    const pathNode = pathNodesById.get(node.id);
    node.fullPath = pathNode ? computeFullNavigationPath(pathNode, pathNodesById) : `/${node.slug}`;
  }

  sortNavigationNodes(roots);
  for (const root of roots) computeDescendantNoteCount(root);
  return roots;
}

function sortNavigationNodes(nodes: NavigationTreeNode[]) {
  nodes.sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title));
  for (const node of nodes) sortNavigationNodes(node.children);
}

function computeDescendantNoteCount(node: NavigationTreeNode) {
  let count = node.directNoteCount;
  for (const child of node.children) {
    count += computeDescendantNoteCount(child);
  }
  node.descendantNoteCount = count;
  return count;
}

function filterVisibleNavigationTree(nodes: NavigationTreeNode[]): NavigationTreeNode[] {
  return nodes
    .filter((node) => node.isVisible)
    .map((node) => ({
      ...node,
      children: filterVisibleNavigationTree(node.children)
    }));
}

function flattenNavigationTree(nodes: NavigationTreeNode[], depth = 0): NavigationNodeOption[] {
  return nodes.flatMap((node) => [
    {
      id: node.id,
      parentId: node.parentId,
      title: node.title,
      slug: node.slug,
      fullPath: node.fullPath,
      depth,
      directNoteCount: node.directNoteCount,
      descendantNoteCount: node.descendantNoteCount
    },
    ...flattenNavigationTree(node.children, depth + 1)
  ]);
}
