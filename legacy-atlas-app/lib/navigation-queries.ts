import { computeFullNavigationPath, type NavigationPathNode } from "@/lib/navigation-utils";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
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
  directNoteCount: number;
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
  const records = await getNavigationRecords();
  const tree = buildNavigationTree(records);
  return options.visibleOnly ? filterVisibleNavigationTree(tree) : tree;
}

export async function getNavigationNodeOptions() {
  const tree = await getNavigationTree();
  return flattenNavigationTree(tree);
}

export async function getNavigationNodeAndDescendantIds(nodeId: string) {
  const records = await getNavigationRecords();
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
  const supabase = await createSupabaseServerClient();
  const workspaceId = await getActiveWorkspaceId();
  const { count, error } = await supabase.from("Note").select("id", { count: "exact", head: true }).eq("workspaceId", workspaceId).is("navigationNodeId", null).is("deletedAt", null);
  if (error) throw error;
  return count ?? 0;
}

export async function getFullNavigationPath(nodeId: string) {
  const records = await getNavigationRecords();
  const pathNodesById = new Map<string, NavigationPathNode>(
    records.map((record) => [
      record.id,
      {
        id: record.id,
        parentId: record.parentId,
        slug: record.slug
      }
    ])
  );
  const node = pathNodesById.get(nodeId);
  return node ? computeFullNavigationPath(node, pathNodesById) : undefined;
}

export async function getNotesByNavigationNode(_nodeId: string, _options: { includeDescendants?: boolean } = {}) {
  return [];
}

async function getNavigationRecords(): Promise<NavigationRecord[]> {
  const supabase = await createSupabaseServerClient();
  const workspaceId = await getActiveWorkspaceId();
  const [{ data: nodes, error: nodesError }, { data: notes, error: notesError }] = await Promise.all([
    supabase.from("NavigationNode").select("id, parentId, slug, title, description, sortOrder, isVisible, createdAt, updatedAt").eq("workspaceId", workspaceId).order("sortOrder", { ascending: true }).order("title", { ascending: true }),
    supabase.from("Note").select("id, navigationNodeId").eq("workspaceId", workspaceId).is("deletedAt", null)
  ]);

  if (nodesError) throw nodesError;
  if (notesError) throw notesError;

  const noteCountByNodeId = new Map<string, number>();
  for (const note of notes) {
    if (!note.navigationNodeId) continue;
    noteCountByNodeId.set(note.navigationNodeId, (noteCountByNodeId.get(note.navigationNodeId) ?? 0) + 1);
  }

  return nodes.map((node) => ({
    id: node.id,
    parentId: node.parentId,
    slug: node.slug,
    title: node.title,
    description: node.description,
    sortOrder: node.sortOrder ?? 0,
    isVisible: node.isVisible ?? true,
    createdAt: new Date(node.createdAt),
    updatedAt: new Date(node.updatedAt),
    directNoteCount: noteCountByNodeId.get(node.id) ?? 0
  }));
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
      directNoteCount: record.directNoteCount,
      descendantNoteCount: record.directNoteCount,
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
