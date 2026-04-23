export type NavigationPathNode = {
  id: string;
  parentId: string | null;
  slug: string;
};

const NON_ALPHANUMERIC = /[^a-z0-9]+/g;
const DASH_BOUNDARY = /^-+|-+$/g;

export function normalizeNavigationSlug(value: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, "-")
    .replace(DASH_BOUNDARY, "");

  return slug || "node";
}

export function computeFullNavigationPath(node: NavigationPathNode, nodesById: Map<string, NavigationPathNode>) {
  const parts: string[] = [node.slug];
  let currentParentId = node.parentId;
  const visited = new Set<string>([node.id]);

  while (currentParentId) {
    if (visited.has(currentParentId)) break;
    visited.add(currentParentId);

    const parent = nodesById.get(currentParentId);
    if (!parent) break;
    parts.unshift(parent.slug);
    currentParentId = parent.parentId;
  }

  return `/${parts.join("/")}`;
}
