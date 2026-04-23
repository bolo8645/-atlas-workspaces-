"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { MouseEvent, ReactNode } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createNavigationFolderAction, deleteNavigationNodeAction, moveNavigationNodeFromSidebarAction, renameNavigationNodeAction } from "@/lib/navigation-actions";
import { NOTES_DND_END_EVENT, type NotesDndEndDetail } from "@/components/NotesDndProvider";

export type SidebarNavigationNode = {
  id: string;
  parentId: string | null;
  title: string;
  sortOrder: number;
  fullPath: string;
  directNoteCount: number;
  descendantNoteCount: number;
  children: SidebarNavigationNode[];
};

type NavigationSidebarClientProps = {
  tree: SidebarNavigationNode[];
  unassignedCount: number;
  showDescendantCounts?: boolean;
};

const EXPANDED_STORAGE_KEY = "ascu.expandedNavigationNodes";
const FOLDER_COLORS_STORAGE_KEY = "ascu.folderColors";
const PRESET_FOLDER_COLORS = [
  { id: "teal", label: "Teal", value: "#2dd4bf" },
  { id: "gold", label: "Gold", value: "#f1c75b" },
  { id: "red", label: "Red", value: "#f87171" },
  { id: "green", label: "Green", value: "#86efac" },
  { id: "blue", label: "Blue", value: "#93c5fd" },
  { id: "none", label: "No color", value: "" }
] as const;

type ContextMenuState = {
  node: SidebarNavigationNode;
  x: number;
  y: number;
} | null;

type FolderDropTarget =
  | { kind: "inside"; parentId: string | null }
  | { kind: "before"; targetId: string }
  | { kind: "after"; targetId: string };

type NavigationNodeBranchProps = {
  node: SidebarNavigationNode;
  activeNodeId: string | null;
  creatingParentId: string | null | "root";
  folderName: string;
  isPending: boolean;
  expandedIds: Set<string>;
  depth?: number;
  onBeginCreate: (parentId: string | null) => void;
  onQuickCreate: (parentId: string | null) => void;
  onBeginRename: (node: SidebarNavigationNode) => void;
  onCancelCreate: () => void;
  onCancelRename: () => void;
  onFolderNameChange: (value: string) => void;
  onRenameTitleChange: (value: string) => void;
  onSubmitCreate: (parentId: string | null) => void;
  onSubmitRename: (node: SidebarNavigationNode) => void;
  onToggle: (id: string) => void;
  onMoveFolder: (nodeId: string, target: FolderDropTarget) => Promise<void>;
  onContextMenu: (node: SidebarNavigationNode, event: MouseEvent<HTMLDivElement>) => void;
  folderColors: Record<string, string>;
  onSetFolderColor: (nodeId: string, color: string) => void;
  showDescendantCounts: boolean;
  renamingNodeId: string | null;
  renameTitle: string;
};

export function NavigationSidebarClient({ tree, unassignedCount, showDescendantCounts = true }: NavigationSidebarClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeNodeId = searchParams.get("node");
  const [localTree, setLocalTree] = useState(tree);
  const activeTrail = useMemo(() => (activeNodeId ? findNodeTrail(localTree, activeNodeId) : []), [activeNodeId, localTree]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => initialExpandedIds(tree, activeNodeId ? findNodeTrail(tree, activeNodeId) : []));
  const [creatingParentId, setCreatingParentId] = useState<string | null | "root">(null);
  const [folderName, setFolderName] = useState("");
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [folderColors, setFolderColors] = useState<Record<string, string>>({});
  const [folderColorsLoaded, setFolderColorsLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isBusy = isCreating || isMoving || isPending;
  const allNotesActive = pathname === "/notes" && !activeNodeId;
  const unassignedActive = pathname === "/notes" && activeNodeId === "unassigned";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setLocalTree(tree);
  }, [tree]);

  useEffect(() => {
    setExpandedIds((current) => {
      const next = new Set(current);
      for (const id of initialExpandedIds(localTree, activeTrail)) next.add(id);
      return next;
    });
  }, [activeTrail, localTree]);

  useEffect(() => {
    const stored = readStoredExpandedIds();
    if (stored.size === 0) return;
    setExpandedIds((current) => new Set([...current, ...stored]));
  }, []);

  useEffect(() => {
    if (activeTrail.length === 0) return;
    setExpandedIds((current) => {
      const next = new Set(current);
      for (const id of activeTrail) next.add(id);
      return next;
    });
  }, [activeTrail]);

  useEffect(() => {
    writeStoredExpandedIds(expandedIds);
  }, [expandedIds]);

  useEffect(() => {
    setFolderColors(readStoredFolderColors());
    setFolderColorsLoaded(true);
  }, []);

  useEffect(() => {
    if (!folderColorsLoaded) return;
    window.localStorage.setItem(FOLDER_COLORS_STORAGE_KEY, JSON.stringify(folderColors));
  }, [folderColors, folderColorsLoaded]);

  useEffect(() => {
    function handleClick() {
      setContextMenu(null);
    }

    window.addEventListener("click", handleClick);
    window.addEventListener("scroll", handleClick, true);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("scroll", handleClick, true);
    };
  }, []);

  useEffect(() => {
    function handleDndEnd(event: Event) {
      if (!mounted) return;
      const detail = (event as CustomEvent<NotesDndEndDetail>).detail;
      if (!detail?.activeId?.startsWith("nav:") || !detail.overId) return;
      const nodeId = detail.activeId.replace("nav:", "");
      if (detail.overId === "nav-root") {
        void moveFolder(nodeId, { kind: "inside", parentId: null });
        return;
      }
      if (detail.overId.startsWith("folder:")) {
        void moveFolder(nodeId, { kind: "inside", parentId: detail.overId.replace("folder:", "") });
        return;
      }
      if (detail.overId.startsWith("nav-before:")) {
        void moveFolder(nodeId, { kind: "before", targetId: detail.overId.replace("nav-before:", "") });
        return;
      }
      if (detail.overId.startsWith("nav-after:")) {
        void moveFolder(nodeId, { kind: "after", targetId: detail.overId.replace("nav-after:", "") });
      }
    }

    window.addEventListener(NOTES_DND_END_EVENT, handleDndEnd);
    return () => window.removeEventListener(NOTES_DND_END_EVENT, handleDndEnd);
  }, [localTree, mounted]);

  function toggleNode(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function beginCreate(parentId: string | null) {
    setCreatingParentId(parentId ?? "root");
    setFolderName("");
    setContextMenu(null);
    setError(null);
    if (parentId) {
      setExpandedIds((current) => new Set([...current, parentId]));
    }
  }

  function beginRename(node: SidebarNavigationNode) {
    setRenamingNodeId(node.id);
    setRenameTitle(node.title);
    setContextMenu(null);
    setError(null);
  }

  function setFolderColor(nodeId: string, color: string) {
    setFolderColors((current) => {
      const next = { ...current };
      if (color) next[nodeId] = color;
      else delete next[nodeId];
      return next;
    });
  }

  async function submitRename(node: SidebarNavigationNode) {
    const title = renameTitle.trim();
    setRenamingNodeId(null);
    if (!title || title === node.title) return;

    const previousTree = localTree;
    setLocalTree((current) => updateNodeInTree(current, node.id, { title }));
    try {
      await renameNavigationNodeAction({
        id: node.id,
        title
      });
    } catch (caught) {
      setLocalTree(previousTree);
      setError(caught instanceof Error ? caught.message : "Folder rename failed.");
    }
  }

  async function quickCreateFolder(parentId: string | null) {
    if (isBusy) return;
    const title = nextUntitledFolderTitle(localTree, parentId);
    setError(null);
    setIsCreating(true);
    if (parentId) setExpandedIds((current) => new Set([...current, parentId]));
    try {
      const created = await createNavigationFolderAction({
        title,
        parentId
      });
      setLocalTree((current) => addNodeToTree(current, folderResultToSidebarNode(created, parentId, nextSortOrderForParent(current, parentId))));
      setRenamingNodeId(created.id);
      setRenameTitle(created.title);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Folder creation failed.");
    } finally {
      setIsCreating(false);
    }
  }

  async function submitCreate(parentId: string | null) {
    const title = folderName.trim();
    if (!title || isBusy) return;

    setError(null);
    setIsCreating(true);
    try {
      const created = await createNavigationFolderAction({
        title,
        parentId
      });

      if (!created) throw new Error("Folder was not created.");

      setExpandedIds((current) => new Set(parentId ? [...current, parentId] : [...current, created.id]));
      setCreatingParentId(null);
      setFolderName("");
      setLocalTree((current) => addNodeToTree(current, folderResultToSidebarNode(created, parentId, nextSortOrderForParent(current, parentId))));

      startTransition(() => {
        router.push(`/notes?node=${created.id}`);
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Folder creation failed.");
    } finally {
      setIsCreating(false);
    }
  }

  async function moveFolder(nodeId: string, target: FolderDropTarget) {
    if (isMoving) return;
    const node = findNode(localTree, nodeId);
    if (!node) return;
    const targetNode = target.kind === "inside" ? null : findNode(localTree, target.targetId);
    if (target.kind !== "inside" && !targetNode) return;
    const nextParentId = target.kind === "inside" ? target.parentId : targetNode?.parentId ?? null;
    if (nextParentId === node.id) return;
    if (nextParentId && isDescendant(localTree, node.id, nextParentId)) return;
    if (target.kind !== "inside" && target.targetId === node.id) return;

    const sortOrder = target.kind === "inside" ? nextSortOrderForParent(localTree, nextParentId) : sortOrderForSiblingDrop(localTree, target.targetId, target.kind, node.id);
    if (node.parentId === nextParentId && node.sortOrder === sortOrder) return;

    const previousTree = localTree;
    setError(null);
    setIsMoving(true);
    setLocalTree((current) => moveNodeInTree(current, node.id, nextParentId, sortOrder));
    try {
      await moveNavigationNodeFromSidebarAction({
        id: node.id,
        parentId: nextParentId,
        sortOrder
      });
      if (nextParentId) setExpandedIds((current) => new Set([...current, nextParentId]));
    } catch (caught) {
      setLocalTree(previousTree);
      setError(caught instanceof Error ? caught.message : "Folder move failed.");
    } finally {
      setIsMoving(false);
    }
  }

  async function deleteFolder(node: SidebarNavigationNode) {
    setContextMenu(null);
    setError(null);
    if (node.children.length > 0) {
      setError("Move or delete child folders before deleting this folder.");
      return;
    }
    if (node.directNoteCount > 0) {
      setError("Reassign notes before deleting this folder.");
      return;
    }
    if (!window.confirm(`Delete "${node.title}"? This cannot be undone.`)) return;

    const previousTree = localTree;
    setLocalTree((current) => removeNodeFromTree(current, node.id).tree);
    try {
      const formData = new FormData();
      formData.set("id", node.id);
      await deleteNavigationNodeAction(formData);
    } catch (caught) {
      setLocalTree(previousTree);
      setError(caught instanceof Error ? caught.message : "Folder delete failed.");
    }
  }

  return (
    <aside className="h-full min-h-0 border-b border-white/10 bg-black/35 lg:border-b-0 lg:border-r">
      <div className="h-full min-h-0 overflow-y-auto px-4 py-5 [scroll-behavior:smooth]">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">Folders</p>
            <p className="mt-1 text-xs text-stone-500">Notes and subfolders</p>
          </div>
        </div>

        <nav className="space-y-1 text-sm">
          <StaticSidebarLink href="/notes" label="All notes" count={undefined} isActive={allNotesActive} isStrong />
          {mounted ? (
            <DraggableSidebarLink href="/notes?node=unassigned" label="Unassigned" count={unassignedCount} isActive={unassignedActive} dropId="folder:unassigned" />
          ) : (
            <StaticSidebarLink href="/notes?node=unassigned" label="Unassigned" count={unassignedCount} isActive={unassignedActive} />
          )}
          {creatingParentId === "root" ? (
            <FolderCreateInput value={folderName} disabled={isBusy} onChange={setFolderName} onCancel={() => setCreatingParentId(null)} onSubmit={() => submitCreate(null)} />
          ) : (
            <button type="button" onClick={() => beginCreate(null)} className="flex w-full items-center justify-between gap-3 rounded border border-dashed border-white/10 px-3 py-2 text-left text-xs font-bold text-stone-400 transition hover:border-[var(--signal)]/40 hover:bg-white/10 hover:text-white">
              <span>+ New Folder</span>
            </button>
          )}
          {error ? <p className="rounded border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</p> : null}
          {localTree.length > 0 ? (
            <TreeRootList mounted={mounted}>
              {localTree.map((node) => (
                <NavigationNodeBranch
                  key={node.id}
                  mounted={mounted}
                  node={node}
                  activeNodeId={activeNodeId}
                  creatingParentId={creatingParentId}
                  folderName={folderName}
                  isPending={isBusy}
                  expandedIds={expandedIds}
                  onBeginCreate={beginCreate}
                  onQuickCreate={quickCreateFolder}
                  onBeginRename={beginRename}
                  onCancelCreate={() => setCreatingParentId(null)}
                  onCancelRename={() => setRenamingNodeId(null)}
                  onFolderNameChange={setFolderName}
                  onRenameTitleChange={setRenameTitle}
                  onSubmitCreate={submitCreate}
                  onSubmitRename={submitRename}
                  onToggle={toggleNode}
                  onMoveFolder={moveFolder}
                  onContextMenu={(node, event) => {
                    event.preventDefault();
                    setContextMenu({ node, x: event.clientX, y: event.clientY });
                  }}
                  folderColors={folderColors}
                  onSetFolderColor={setFolderColor}
                  showDescendantCounts={showDescendantCounts}
                  renamingNodeId={renamingNodeId}
                  renameTitle={renameTitle}
                />
              ))}
            </TreeRootList>
          ) : (
            <p className="rounded border border-white/10 px-3 py-3 text-sm text-stone-500">No navigation nodes yet.</p>
          )}
          {contextMenu ? (
            <SidebarContextMenu
              state={contextMenu}
              onNewFolder={(node) => beginCreate(node.id)}
              onRename={beginRename}
              onSetFolderColor={setFolderColor}
              onDelete={deleteFolder}
            />
          ) : null}
        </nav>
      </div>
    </aside>
  );
}

function NavigationNodeBranch({ mounted, ...props }: NavigationNodeBranchProps & { mounted: boolean }) {
  return mounted ? <DraggableNavigationNodeBranch {...props} /> : <StaticNavigationNodeBranch {...props} />;
}

function StaticNavigationNodeBranch({
  node,
  activeNodeId,
  creatingParentId,
  folderName,
  isPending,
  expandedIds,
  depth = 0,
  onBeginCreate,
  onQuickCreate,
  onBeginRename,
  onCancelCreate,
  onCancelRename,
  onFolderNameChange,
  onRenameTitleChange,
  onSubmitCreate,
  onSubmitRename,
  onToggle,
  onMoveFolder,
  onContextMenu,
  folderColors,
  onSetFolderColor,
  showDescendantCounts,
  renamingNodeId,
  renameTitle
}: NavigationNodeBranchProps) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isActive = activeNodeId === node.id;
  const href = `/notes?node=${node.id}`;
  const isRenaming = renamingNodeId === node.id;
  const folderColor = folderColors[node.id];

  return (
    <li>
      <div className="h-1 rounded transition" />
      <div
        onContextMenu={(event) => onContextMenu(node, event)}
        style={{ paddingLeft: `${depth * 0.75}rem`, borderLeftColor: folderColor || "transparent" }}
        className={`group flex items-center rounded border border-l-2 transition ${isActive ? "border-[var(--signal)]/45 bg-[var(--signal)]/15 text-white shadow-[inset_0_0_0_1px_rgba(45,212,191,0.18)]" : "border-transparent text-stone-400 hover:bg-white/10 hover:text-stone-200"}`}
      >
        {isRenaming ? (
          <input
            autoFocus
            value={renameTitle}
            onChange={(event) => onRenameTitleChange(event.target.value)}
            onBlur={() => onSubmitRename(node)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSubmitRename(node);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                onCancelRename();
              }
            }}
            className="mx-2 h-8 min-w-0 flex-1 rounded border border-[var(--signal)]/30 bg-black/50 px-2 text-xs text-white outline-none"
          />
        ) : (
          <Link
            href={href}
            title={node.fullPath}
            onDoubleClick={(event) => {
              event.preventDefault();
              onBeginRename(node);
            }}
            className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)]/40"
          >
            <span className={`min-w-0 truncate ${depth === 0 ? "text-sm font-medium" : "text-xs"}`}>{node.title}</span>
            <NodeCountBadge directCount={node.directNoteCount} descendantCount={node.descendantNoteCount} showDescendantCount={showDescendantCounts} />
          </Link>
        )}
        <button type="button" aria-label={`Move ${node.title}`} className="grid h-7 w-6 shrink-0 place-items-center rounded text-xs text-stone-600 opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100">
          ::
        </button>
        <button type="button" onClick={() => onQuickCreate(node.id)} aria-label={`Create subfolder in ${node.title}`} className="grid h-7 w-7 place-items-center rounded text-xs font-bold text-stone-500 opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100">
          +
        </button>
        {hasChildren ? (
          <button type="button" onClick={() => onToggle(node.id)} aria-label={`${isExpanded ? "Collapse" : "Expand"} ${node.title}`} aria-expanded={isExpanded} className="mr-1 grid h-7 w-7 place-items-center rounded text-[0.62rem] text-stone-500 transition hover:bg-white/10 hover:text-stone-200">
            <span className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}>{">"}</span>
          </button>
        ) : null}
      </div>

      {hasChildren && isExpanded ? (
        <ul className="ml-4 mt-1 space-y-1 overflow-hidden border-l border-white/10 transition-all duration-200">
          {node.children.map((child) => (
            <NavigationNodeBranch
              key={child.id}
              mounted={false}
              node={child}
              activeNodeId={activeNodeId}
              creatingParentId={creatingParentId}
              folderName={folderName}
              isPending={isPending}
              expandedIds={expandedIds}
              depth={depth + 1}
              onBeginCreate={onBeginCreate}
              onQuickCreate={onQuickCreate}
              onBeginRename={onBeginRename}
              onCancelCreate={onCancelCreate}
              onCancelRename={onCancelRename}
              onFolderNameChange={onFolderNameChange}
              onRenameTitleChange={onRenameTitleChange}
              onSubmitCreate={onSubmitCreate}
              onSubmitRename={onSubmitRename}
              onToggle={onToggle}
              onMoveFolder={onMoveFolder}
              onContextMenu={onContextMenu}
              folderColors={folderColors}
              onSetFolderColor={onSetFolderColor}
              showDescendantCounts={showDescendantCounts}
              renamingNodeId={renamingNodeId}
              renameTitle={renameTitle}
            />
          ))}
          {creatingParentId === node.id ? <FolderCreateInput value={folderName} disabled={isPending} onChange={onFolderNameChange} onCancel={onCancelCreate} onSubmit={() => onSubmitCreate(node.id)} /> : null}
        </ul>
      ) : null}
      {creatingParentId === node.id && (!hasChildren || !isExpanded) ? <div className="ml-4 mt-1"><FolderCreateInput value={folderName} disabled={isPending} onChange={onFolderNameChange} onCancel={onCancelCreate} onSubmit={() => onSubmitCreate(node.id)} /></div> : null}
      <div className="h-1 rounded transition" />
    </li>
  );
}

function DraggableNavigationNodeBranch({
  node,
  activeNodeId,
  creatingParentId,
  folderName,
  isPending,
  expandedIds,
  depth = 0,
  onBeginCreate,
  onQuickCreate,
  onBeginRename,
  onCancelCreate,
  onCancelRename,
  onFolderNameChange,
  onRenameTitleChange,
  onSubmitCreate,
  onSubmitRename,
  onToggle,
  onMoveFolder,
  onContextMenu,
  folderColors,
  onSetFolderColor,
  showDescendantCounts,
  renamingNodeId,
  renameTitle
}: NavigationNodeBranchProps) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isActive = activeNodeId === node.id;
  const href = `/notes?node=${node.id}`;
  const { isOver: isBeforeOver, setNodeRef: setBeforeDropRef } = useDroppable({ id: `nav-before:${node.id}` });
  const { isOver: isAfterOver, setNodeRef: setAfterDropRef } = useDroppable({ id: `nav-after:${node.id}` });
  const { isOver, setNodeRef } = useDroppable({ id: `folder:${node.id}` });
  const { attributes, isDragging, listeners, setNodeRef: setDraggableRef, transform } = useDraggable({ id: `nav:${node.id}` });
  const isRenaming = renamingNodeId === node.id;
  const folderColor = folderColors[node.id];

  useEffect(() => {
    if (!isOver || !hasChildren || isExpanded) return;
    const timeout = window.setTimeout(() => onToggle(node.id), 500);
    return () => window.clearTimeout(timeout);
  }, [hasChildren, isExpanded, isOver, node.id, onToggle]);

  return (
    <li>
      <div ref={setBeforeDropRef} className={`h-1 rounded transition ${isBeforeOver ? "bg-[var(--signal)]" : ""}`} />
      <div
        ref={(element) => {
          setNodeRef(element);
          setDraggableRef(element);
        }}
        onContextMenu={(event) => onContextMenu(node, event)}
        style={{
          paddingLeft: `${depth * 0.75}rem`,
          transform: CSS.Translate.toString(transform),
          borderLeftColor: folderColor || "transparent"
        }}
        className={`group flex items-center rounded border border-l-2 transition ${isDragging ? "opacity-60" : ""} ${isOver ? "border-[var(--signal)]/50 bg-[var(--signal)]/15 text-white" : isActive ? "border-[var(--signal)]/45 bg-[var(--signal)]/15 text-white shadow-[inset_0_0_0_1px_rgba(45,212,191,0.18)]" : "border-transparent text-stone-400 hover:bg-white/10 hover:text-stone-200"}`}
      >
        {isRenaming ? (
          <input
            autoFocus
            value={renameTitle}
            onChange={(event) => onRenameTitleChange(event.target.value)}
            onBlur={() => onSubmitRename(node)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSubmitRename(node);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                onCancelRename();
              }
            }}
            className="mx-2 h-8 min-w-0 flex-1 rounded border border-[var(--signal)]/30 bg-black/50 px-2 text-xs text-white outline-none"
          />
        ) : (
          <Link
            href={href}
            title={node.fullPath}
            onDoubleClick={(event) => {
              event.preventDefault();
              onBeginRename(node);
            }}
            className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)]/40"
          >
            <span className={`min-w-0 truncate ${depth === 0 ? "text-sm font-medium" : "text-xs"}`}>{node.title}</span>
            <NodeCountBadge directCount={node.directNoteCount} descendantCount={node.descendantNoteCount} showDescendantCount={showDescendantCounts} />
          </Link>
        )}
        <button type="button" {...attributes} {...listeners} aria-label={`Move ${node.title}`} className="grid h-7 w-6 shrink-0 cursor-grab place-items-center rounded text-xs text-stone-600 opacity-0 transition hover:bg-white/10 hover:text-white active:cursor-grabbing group-hover:opacity-100">
          ::
        </button>
        <button type="button" onClick={() => onQuickCreate(node.id)} aria-label={`Create subfolder in ${node.title}`} className="grid h-7 w-7 place-items-center rounded text-xs font-bold text-stone-500 opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100">
          +
        </button>
        {hasChildren ? (
          <button type="button" onClick={() => onToggle(node.id)} aria-label={`${isExpanded ? "Collapse" : "Expand"} ${node.title}`} aria-expanded={isExpanded} className="mr-1 grid h-7 w-7 place-items-center rounded text-[0.62rem] text-stone-500 transition hover:bg-white/10 hover:text-stone-200">
            <span className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}>{">"}</span>
          </button>
        ) : null}
      </div>

      {hasChildren && isExpanded ? (
        <ul className="ml-4 mt-1 space-y-1 overflow-hidden border-l border-white/10 transition-all duration-200">
          {node.children.map((child) => (
            <NavigationNodeBranch
              key={child.id}
              mounted
              node={child}
              activeNodeId={activeNodeId}
              creatingParentId={creatingParentId}
              folderName={folderName}
              isPending={isPending}
              expandedIds={expandedIds}
              depth={depth + 1}
              onBeginCreate={onBeginCreate}
              onQuickCreate={onQuickCreate}
              onBeginRename={onBeginRename}
              onCancelCreate={onCancelCreate}
              onCancelRename={onCancelRename}
              onFolderNameChange={onFolderNameChange}
              onRenameTitleChange={onRenameTitleChange}
              onSubmitCreate={onSubmitCreate}
              onSubmitRename={onSubmitRename}
              onToggle={onToggle}
              onMoveFolder={onMoveFolder}
              onContextMenu={onContextMenu}
              folderColors={folderColors}
              onSetFolderColor={onSetFolderColor}
              showDescendantCounts={showDescendantCounts}
              renamingNodeId={renamingNodeId}
              renameTitle={renameTitle}
            />
          ))}
          {creatingParentId === node.id ? <FolderCreateInput value={folderName} disabled={isPending} onChange={onFolderNameChange} onCancel={onCancelCreate} onSubmit={() => onSubmitCreate(node.id)} /> : null}
        </ul>
      ) : null}
      {creatingParentId === node.id && (!hasChildren || !isExpanded) ? <div className="ml-4 mt-1"><FolderCreateInput value={folderName} disabled={isPending} onChange={onFolderNameChange} onCancel={onCancelCreate} onSubmit={() => onSubmitCreate(node.id)} /></div> : null}
      <div ref={setAfterDropRef} className={`h-1 rounded transition ${isAfterOver ? "bg-[var(--signal)]" : ""}`} />
    </li>
  );
}

function TreeRootList({ mounted, children }: { mounted: boolean; children: ReactNode }) {
  return mounted ? <DraggableRootDropList>{children}</DraggableRootDropList> : <StaticRootDropList>{children}</StaticRootDropList>;
}

function StaticRootDropList({ children }: { children: ReactNode }) {
  return (
    <ul className="mt-2 space-y-1 rounded border border-transparent transition">
      {children}
    </ul>
  );
}

function DraggableRootDropList({ children }: { children: ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: "nav-root" });

  return (
    <ul ref={setNodeRef} className={`mt-2 space-y-1 rounded border border-transparent transition ${isOver ? "border-[var(--signal)]/40 bg-[var(--signal)]/10" : ""}`}>
      {children}
    </ul>
  );
}

function SidebarContextMenu({
  state,
  onNewFolder,
  onRename,
  onSetFolderColor,
  onDelete
}: {
  state: NonNullable<ContextMenuState>;
  onNewFolder: (node: SidebarNavigationNode) => void;
  onRename: (node: SidebarNavigationNode) => void;
  onSetFolderColor: (nodeId: string, color: string) => void;
  onDelete: (node: SidebarNavigationNode) => void;
}) {
  return (
    <div
      onClick={(event) => event.stopPropagation()}
      className="fixed z-50 min-w-36 rounded border border-white/10 bg-zinc-950 py-1 text-sm text-stone-200 shadow-xl"
      style={{ left: state.x, top: state.y }}
    >
      <button type="button" onClick={() => onNewFolder(state.node)} className="block w-full px-3 py-2 text-left hover:bg-white/10">
        New Folder
      </button>
      <button type="button" onClick={() => onRename(state.node)} className="block w-full px-3 py-2 text-left hover:bg-white/10">
        Rename
      </button>
      <div className="border-y border-white/10 px-3 py-2">
        <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-stone-500">Color</p>
        <div className="flex gap-1">
          {PRESET_FOLDER_COLORS.map((color) => (
            <button
              key={color.id}
              type="button"
              aria-label={color.label}
              title={color.label}
              onClick={() => onSetFolderColor(state.node.id, color.value)}
              className="grid h-6 w-6 place-items-center rounded border border-white/10 hover:border-white/40"
            >
              <span className="h-3 w-3 rounded-sm border border-white/10" style={{ backgroundColor: color.value || "transparent" }} />
            </button>
          ))}
        </div>
      </div>
      <button type="button" onClick={() => onDelete(state.node)} className="block w-full px-3 py-2 text-left text-red-200 hover:bg-red-500/10">
        Delete
      </button>
    </div>
  );
}

function FolderCreateInput({ value, disabled, onChange, onCancel, onSubmit }: { value: string; disabled: boolean; onChange: (value: string) => void; onCancel: () => void; onSubmit: () => void }) {
  return (
    <input
      autoFocus
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => {
        if (!value.trim()) onCancel();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onSubmit();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
      placeholder="Folder name"
      className="h-9 w-full rounded border border-[var(--signal)]/30 bg-black/50 px-3 text-xs text-white outline-none placeholder:text-stone-600 focus:border-[var(--signal)]"
    />
  );
}

function DraggableSidebarLink({ href, label, count, isActive, isStrong = false, dropId }: { href: string; label: string; count?: number; isActive: boolean; isStrong?: boolean; dropId?: string }) {
  const { isOver, setNodeRef } = useDroppable({
    id: dropId ?? `link:${href}`,
    disabled: !dropId
  });

  return (
    <Link ref={setNodeRef} href={href} className={`flex items-center justify-between gap-3 rounded border px-3 py-2 outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--signal)]/40 ${isOver ? "border-[var(--signal)]/50 bg-[var(--signal)]/15 text-white" : isActive ? "border-[var(--signal)]/45 bg-[var(--signal)]/15 text-white shadow-[inset_0_0_0_1px_rgba(45,212,191,0.18)]" : "border-transparent text-stone-300 hover:bg-white/10 hover:text-white"} ${isStrong ? "font-bold" : ""}`}>
      <span>{label}</span>
      {typeof count === "number" ? <span className="shrink-0 rounded border border-white/10 px-1.5 py-0.5 text-[0.68rem] text-stone-500">{count}</span> : null}
    </Link>
  );
}

function StaticSidebarLink({ href, label, count, isActive, isStrong = false }: { href: string; label: string; count?: number; isActive: boolean; isStrong?: boolean }) {
  return (
    <Link href={href} className={`flex items-center justify-between gap-3 rounded border px-3 py-2 outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--signal)]/40 ${isActive ? "border-[var(--signal)]/45 bg-[var(--signal)]/15 text-white shadow-[inset_0_0_0_1px_rgba(45,212,191,0.18)]" : "border-transparent text-stone-300 hover:bg-white/10 hover:text-white"} ${isStrong ? "font-bold" : ""}`}>
      <span>{label}</span>
      {typeof count === "number" ? <span className="shrink-0 rounded border border-white/10 px-1.5 py-0.5 text-[0.68rem] text-stone-500">{count}</span> : null}
    </Link>
  );
}

function NodeCountBadge({ directCount, descendantCount, showDescendantCount }: { directCount: number; descendantCount: number; showDescendantCount: boolean }) {
  const title = showDescendantCount ? `${directCount} directly assigned, ${descendantCount} including descendants` : `${directCount} directly assigned`;
  const label = showDescendantCount && descendantCount !== directCount ? `${directCount}/${descendantCount}` : String(directCount);

  return (
    <span title={title} className="shrink-0 rounded border border-white/10 px-1.5 py-0.5 text-[0.68rem] text-stone-500">
      {label}
    </span>
  );
}

function initialExpandedIds(tree: SidebarNavigationNode[], activeTrail: string[]) {
  const ids = new Set<string>(activeTrail);
  for (const root of tree) ids.add(root.id);
  return ids;
}

function readStoredExpandedIds() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(EXPANDED_STORAGE_KEY) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function writeStoredExpandedIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify([...ids]));
}

function readStoredFolderColors() {
  if (typeof window === "undefined") return {};
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(FOLDER_COLORS_STORAGE_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string")
    );
  } catch {
    return {};
  }
}

function findNodeTrail(nodes: SidebarNavigationNode[], nodeId: string, trail: string[] = []): string[] {
  for (const node of nodes) {
    const nextTrail = [...trail, node.id];
    if (node.id === nodeId) return nextTrail;
    const childTrail = findNodeTrail(node.children, nodeId, nextTrail);
    if (childTrail.length > 0) return childTrail;
  }

  return [];
}

function findNode(nodes: SidebarNavigationNode[], nodeId: string): SidebarNavigationNode | undefined {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    const child = findNode(node.children, nodeId);
    if (child) return child;
  }

  return undefined;
}

function isDescendant(nodes: SidebarNavigationNode[], ancestorId: string, possibleDescendantId: string) {
  const ancestor = findNode(nodes, ancestorId);
  if (!ancestor) return false;
  return Boolean(findNode(ancestor.children, possibleDescendantId));
}

function nextSortOrderForParent(nodes: SidebarNavigationNode[], parentId: string | null) {
  const siblings = parentId ? findNode(nodes, parentId)?.children ?? [] : nodes;
  const maxSortOrder = siblings.reduce((max, node) => Math.max(max, node.sortOrder), 0);
  return maxSortOrder + 10;
}

function sortOrderForSiblingDrop(nodes: SidebarNavigationNode[], targetId: string, position: "before" | "after", movingNodeId: string) {
  const target = findNode(nodes, targetId);
  if (!target) return 0;
  const siblings = childrenForParent(nodes, target.parentId)
    .filter((node) => node.id !== movingNodeId)
    .sort(compareNavigationNodes);
  const targetIndex = siblings.findIndex((node) => node.id === targetId);
  if (targetIndex < 0) return target.sortOrder;

  if (position === "before") {
    const previous = siblings[targetIndex - 1];
    if (!previous) return target.sortOrder - 10;
    return midpointSortOrder(previous.sortOrder, target.sortOrder, target.sortOrder - 1);
  }

  const next = siblings[targetIndex + 1];
  if (!next) return target.sortOrder + 10;
  return midpointSortOrder(target.sortOrder, next.sortOrder, target.sortOrder + 1);
}

function midpointSortOrder(lower: number, upper: number, fallback: number) {
  const midpoint = Math.floor((lower + upper) / 2);
  return midpoint > lower && midpoint < upper ? midpoint : fallback;
}

function childrenForParent(nodes: SidebarNavigationNode[], parentId: string | null) {
  return parentId ? findNode(nodes, parentId)?.children ?? [] : nodes;
}

function addNodeToTree(nodes: SidebarNavigationNode[], node: SidebarNavigationNode): SidebarNavigationNode[] {
  if (findNode(nodes, node.id)) return updateNodeInTree(nodes, node.id, node);

  const insert = (items: SidebarNavigationNode[]): SidebarNavigationNode[] => {
    if (!node.parentId) return sortTree([...items, node]);
    return sortTree(
      items.map((item) =>
        item.id === node.parentId
          ? {
              ...item,
              children: sortTree([...item.children, node])
            }
          : {
              ...item,
              children: insert(item.children)
            }
      )
    );
  };

  return recomputeFullPaths(insert(nodes));
}

function updateNodeInTree(nodes: SidebarNavigationNode[], nodeId: string, updates: Partial<SidebarNavigationNode>): SidebarNavigationNode[] {
  return recomputeFullPaths(
    sortTree(
      nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              ...updates,
              children: updates.children ?? node.children
            }
          : {
              ...node,
              children: updateNodeInTree(node.children, nodeId, updates)
            }
      )
    )
  );
}

function removeNodeFromTree(nodes: SidebarNavigationNode[], nodeId: string): { tree: SidebarNavigationNode[]; node?: SidebarNavigationNode } {
  let removed: SidebarNavigationNode | undefined;
  const tree = nodes.flatMap((node) => {
    if (node.id === nodeId) {
      removed = node;
      return [];
    }
    const childResult = removeNodeFromTree(node.children, nodeId);
    if (childResult.node) removed = childResult.node;
    return [
      {
        ...node,
        children: childResult.tree
      }
    ];
  });

  return {
    tree: recomputeFullPaths(sortTree(tree)),
    node: removed
  };
}

function moveNodeInTree(nodes: SidebarNavigationNode[], nodeId: string, parentId: string | null, sortOrder: number) {
  const result = removeNodeFromTree(nodes, nodeId);
  if (!result.node) return nodes;
  return addNodeToTree(result.tree, {
    ...result.node,
    parentId,
    sortOrder
  });
}

function sortTree(nodes: SidebarNavigationNode[]): SidebarNavigationNode[] {
  return [...nodes]
    .sort(compareNavigationNodes)
    .map((node) => ({
      ...node,
      children: sortTree(node.children)
    }));
}

function compareNavigationNodes(left: SidebarNavigationNode, right: SidebarNavigationNode) {
  return left.sortOrder - right.sortOrder || left.title.localeCompare(right.title);
}

function recomputeFullPaths(nodes: SidebarNavigationNode[], parentPath = ""): SidebarNavigationNode[] {
  return nodes.map((node) => {
    const fullPath = parentPath ? `${parentPath} / ${node.title}` : node.title;
    return {
      ...node,
      fullPath,
      children: recomputeFullPaths(node.children, fullPath)
    };
  });
}

function folderResultToSidebarNode(
  folder: {
    id: string;
    parentId?: string | null;
    title: string;
    fullPath: string;
  },
  fallbackParentId: string | null,
  sortOrder: number
): SidebarNavigationNode {
  return {
    id: folder.id,
    parentId: folder.parentId === undefined ? fallbackParentId : folder.parentId,
    title: folder.title,
    sortOrder,
    fullPath: folder.fullPath,
    directNoteCount: 0,
    descendantNoteCount: 0,
    children: []
  };
}

function nextUntitledFolderTitle(nodes: SidebarNavigationNode[], parentId: string | null) {
  const titles = new Set(childrenForParent(nodes, parentId).map((node) => node.title));
  if (!titles.has("Untitled Folder")) return "Untitled Folder";

  let index = 2;
  while (titles.has(`Untitled Folder ${index}`)) index += 1;
  return `Untitled Folder ${index}`;
}
