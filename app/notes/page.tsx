import { NotesWorkspace, type WorkspaceNoteListItem, type WorkspaceSelectedNote } from "@/components/NotesWorkspace";
import { getNavigationNodeOptions } from "@/lib/navigation-queries";
import { displayNoteTitle } from "@/lib/notes/display";
import { getNotesWorkspaceData, type InterconnectedRelationship } from "@/lib/notes/workspace-queries";
import { getEntityIndexForActiveWorkspace, getRelationshipTypesForActiveWorkspace } from "@/lib/relationships";

type NotesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type WorkspaceNote = Awaited<ReturnType<typeof getNotesWorkspaceData>>["notes"][number];

export default async function NotesPage({ searchParams }: NotesPageProps) {
  const params = await searchParams;
  const [data, navigationOptions, entityIndex, relationshipTypes] = await Promise.all([getNotesWorkspaceData(params), getNavigationNodeOptions(), getEntityIndexForActiveWorkspace(), getRelationshipTypesForActiveWorkspace()]);
  const navigationPathById = new Map(navigationOptions.map((option) => [option.id, option.fullPath]));
  const interconnectionsByEntityId = data.interconnectionsByEntityId ?? {};
  const createParentId = data.nodeId && data.nodeId !== "unassigned" && navigationPathById.has(data.nodeId) ? data.nodeId : null;

  return (
    <NotesWorkspace
      nodeId={data.nodeId}
      notes={data.notes.map((note) => toListItem(note, navigationPathById, interconnectionsByEntityId))}
      searchNotes={data.searchNotes.map((note) => toListItem(note, navigationPathById, interconnectionsByEntityId))}
      selectedNote={data.selectedNote ? toSelectedNote(data.selectedNote, navigationPathById, interconnectionsByEntityId) : null}
      navigationOptions={navigationOptions}
      entityIndex={entityIndex}
      entityOptions={dedupeEntityOptions(entityIndex, [...data.notes, ...data.searchNotes, ...(data.selectedNote ? [data.selectedNote] : [])])}
      relationshipTypes={relationshipTypes}
      createParentId={createParentId}
    />
  );
}

function toListItem(note: WorkspaceNote, navigationPathById: Map<string, string>, interconnectionsByEntityId: Record<string, InterconnectedRelationship[]>): WorkspaceNoteListItem {
  const entity = note.entity ? { id: note.entity.id, name: note.entity.name, type: note.entity.type, aliases: note.entity.aliases } : null;
  return {
    id: note.id,
    title: displayNoteTitle(note),
    content: editableContent(note),
    preview: firstLine(editableContent(note)) || note.excerpt || "",
    updatedAt: note.updatedAt.toISOString(),
    navigationNodeId: note.navigationNodeId,
    navigationLabel: navigationLabel(note, navigationPathById),
    sortOrder: note.sortOrder,
    isPinned: note.isPinned,
    noteType: note.noteType || "draft",
    entity,
    interconnections: entity ? interconnectionsByEntityId[entity.id] ?? [] : []
  };
}

function toSelectedNote(note: WorkspaceNote, navigationPathById: Map<string, string>, interconnectionsByEntityId: Record<string, InterconnectedRelationship[]>): WorkspaceSelectedNote {
  const entity = note.entity ? { id: note.entity.id, name: note.entity.name, type: note.entity.type, aliases: note.entity.aliases } : null;
  return {
    id: note.id,
    title: displayNoteTitle(note),
    content: editableContent(note),
    updatedAt: note.updatedAt.toISOString(),
    navigationNodeId: note.navigationNodeId,
    navigationLabel: navigationLabel(note, navigationPathById),
    sortOrder: note.sortOrder,
    isPinned: note.isPinned,
    noteType: note.noteType || "draft",
    entity,
    interconnections: entity ? interconnectionsByEntityId[entity.id] ?? [] : []
  };
}

function navigationLabel(note: WorkspaceNote, navigationPathById: Map<string, string>) {
  return note.navigationNodeId ? navigationPathById.get(note.navigationNodeId) ?? note.navigationNode?.title ?? "Unknown folder" : "Unassigned";
}

function editableContent(note: WorkspaceNote) {
  if (note.metadataOverride) return note.metadataOverride.summary ?? "";
  return note.curatedSummary?.trim() ? note.curatedSummary : note.plainTextContent ?? "";
}

function firstLine(value: string) {
  return stripHtml(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
}

function stripHtml(value: string) {
  return value.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "");
}

function dedupeEntityOptions(entityIndex: Awaited<ReturnType<typeof getEntityIndexForActiveWorkspace>>, notes: WorkspaceNote[]) {
  const options = new Map<string, { id: string; name: string; type: string; noteId: string | null }>();
  for (const note of notes) {
    if (note.entity && !options.has(note.entity.id)) {
      options.set(note.entity.id, { id: note.entity.id, name: note.entity.name, type: note.entity.type, noteId: note.id });
    }
  }
  for (const entity of entityIndex) {
    if (!options.has(entity.id)) options.set(entity.id, { id: entity.id, name: entity.title, type: entity.type, noteId: null });
  }
  return [...options.values()].sort((left, right) => left.name.localeCompare(right.name));
}
