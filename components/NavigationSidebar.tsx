import { getNavigationTree, getUnassignedNoteCount, type NavigationTreeNode } from "@/lib/navigation-queries";
import { NavigationSidebarClient, type SidebarNavigationNode } from "@/components/NavigationSidebarClient";

export default async function NavigationSidebar() {
  const [tree, unassignedCount] = await Promise.all([getNavigationTree({ visibleOnly: true }), getUnassignedNoteCount()]);

  const sidebarTree = tree.map(toSidebarNode);

  return <NavigationSidebarClient tree={sidebarTree} unassignedCount={unassignedCount} />;
}

function toSidebarNode(node: NavigationTreeNode): SidebarNavigationNode {
  return (
    {
      id: node.id,
      parentId: node.parentId,
      title: node.title,
      sortOrder: node.sortOrder,
      fullPath: node.fullPath,
      directNoteCount: node.directNoteCount,
      descendantNoteCount: node.descendantNoteCount,
      children: node.children.map(toSidebarNode)
    }
  );
}
