import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspaces";

type SearchParams = Record<string, string | string[] | undefined>;

type NoteRow = {
  id: string;
  updatedAt: string;
  lockedAt: string | null;
  entityId: string | null;
  navigationNodeId: string | null;
  title: string;
  excerpt: string | null;
  sortOrder: number | null;
  isPinned: boolean | null;
  noteType: string | null;
  isLocked: boolean | null;
  lockedBy: string | null;
  plainTextContent: string | null;
  curatedSummary: string | null;
};

type WorkspaceNoteRecord = {
  id: string;
  title: string;
  excerpt: string | null;
  updatedAt: Date;
  navigationNodeId: string | null;
  sortOrder: number;
  isPinned: boolean;
  noteType: string | null;
  isLocked: boolean;
  lockedAt: Date | null;
  lockedBy: string | null;
  plainTextContent: string;
  curatedSummary: string | null;
  entityId: string | null;
  metadataOverride: {
    displayTitle?: string | null;
    summary: string | null;
  } | null;
  navigationNode: {
    title: string;
  } | null;
  entity: {
    id: string;
    name: string;
    type: string;
    aliases: string[];
  } | null;
  tags: Array<{
    source: string;
    tag: {
      name: string;
    };
  }>;
};

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

type NotesWorkspaceResult = {
  nodeId: string | undefined;
  selectedNoteId: string | undefined;
  notes: WorkspaceNoteRecord[];
  searchNotes: WorkspaceNoteRecord[];
  selectedNote: WorkspaceNoteRecord | null;
  interconnectionsByEntityId: Record<string, InterconnectedRelationship[]>;
};

export async function getNotesWorkspaceData(searchParams: SearchParams = {}): Promise<NotesWorkspaceResult> {
  const selectedNoteId = readParam(searchParams, "note");
  const workspaceId = await getActiveWorkspaceId();
  const supabase = await createSupabaseServerClient();
  const nodeId = await resolveNodeId(supabase, workspaceId, readParam(searchParams, "node"));

  let notesQuery: any = supabase
    .from("Note")
    .select("id, title, excerpt, updatedAt, navigationNodeId, sortOrder, isPinned, noteType, isLocked, lockedAt, lockedBy, plainTextContent, curatedSummary, entityId")
    .eq("workspaceId", workspaceId)
    .is("deletedAt", null)
    .order("isPinned", { ascending: false })
    .order("sortOrder", { ascending: true })
    .order("updatedAt", { ascending: false })
    .order("title", { ascending: true });
  if (nodeId === "unassigned") {
    notesQuery = notesQuery.is("navigationNodeId", null);
  } else if (nodeId) {
    notesQuery = notesQuery.eq("navigationNodeId", nodeId);
  }
  notesQuery = notesQuery.limit(300);

  const searchNotesQuery = supabase
    .from("Note")
    .select("id, title, excerpt, updatedAt, navigationNodeId, sortOrder, isPinned, noteType, isLocked, lockedAt, lockedBy, plainTextContent, curatedSummary, entityId")
    .eq("workspaceId", workspaceId)
    .is("deletedAt", null)
    .order("isPinned", { ascending: false })
    .order("sortOrder", { ascending: true })
    .order("updatedAt", { ascending: false })
    .order("title", { ascending: true })
    .limit(1000);

  const [notesResult, searchNotesResult] = await Promise.all([notesQuery, searchNotesQuery]);
  if (notesResult.error) throw notesResult.error;
  if (searchNotesResult.error) throw searchNotesResult.error;

  const noteRows: NoteRow[] = (notesResult.data ?? []) as NoteRow[];
  const searchNoteRows: NoteRow[] = (searchNotesResult.data ?? []) as NoteRow[];
  const notesById = new Map<string, NoteRow>();
  for (const note of [...noteRows, ...searchNoteRows]) {
    notesById.set(note.id, note);
  }

  let selectedNoteRow = selectedNoteId ? notesById.get(selectedNoteId) ?? null : null;
  if (selectedNoteId && !selectedNoteRow) {
    const selectedResult = await supabase
      .from("Note")
      .select("id, title, excerpt, updatedAt, navigationNodeId, sortOrder, isPinned, noteType, isLocked, lockedAt, lockedBy, plainTextContent, curatedSummary, entityId")
      .eq("workspaceId", workspaceId)
      .eq("id", selectedNoteId)
      .is("deletedAt", null)
      .maybeSingle();
    if (selectedResult.error) throw selectedResult.error;
    selectedNoteRow = selectedResult.data ?? null;
    if (selectedNoteRow) {
      notesById.set(selectedNoteRow.id, selectedNoteRow);
    }
  }

  const hydratedById = await hydrateWorkspaceNotes(workspaceId, [...notesById.values()]);

  return {
    nodeId,
    selectedNoteId,
    notes: noteRows.map((note: NoteRow) => hydratedById.get(note.id)).filter((note: WorkspaceNoteRecord | undefined): note is WorkspaceNoteRecord => Boolean(note)),
    searchNotes: searchNoteRows.map((note: NoteRow) => hydratedById.get(note.id)).filter((note: WorkspaceNoteRecord | undefined): note is WorkspaceNoteRecord => Boolean(note)),
    selectedNote: selectedNoteRow ? hydratedById.get(selectedNoteRow.id) ?? null : null,
    interconnectionsByEntityId: {}
  };
}

async function hydrateWorkspaceNotes(workspaceId: string, notes: NoteRow[]) {
  if (notes.length === 0) return new Map<string, WorkspaceNoteRecord>();

  const supabase = await createSupabaseServerClient();
  const noteIds = notes.map((note) => note.id);
  const navigationNodeIds = uniqueStrings(notes.map((note) => note.navigationNodeId).filter((value): value is string => Boolean(value)));
  const entityIds = uniqueStrings(notes.map((note) => note.entityId).filter((value): value is string => Boolean(value)));

  const [metadataResult, noteTagsResult, navigationNodesResult, entitiesResult] = await Promise.all([
    supabase.from("MetadataOverride").select("noteId, summary").in("noteId", noteIds),
    noteIds.length > 0 ? supabase.from("NoteTag").select("noteId, tagId, source").in("noteId", noteIds) : Promise.resolve({ data: [], error: null }),
    navigationNodeIds.length > 0 ? supabase.from("NavigationNode").select("id, title").eq("workspaceId", workspaceId).in("id", navigationNodeIds) : Promise.resolve({ data: [], error: null }),
    entityIds.length > 0 ? supabase.from("Entity").select("id, name, type, aliases").eq("workspaceId", workspaceId).in("id", entityIds) : Promise.resolve({ data: [], error: null })
  ]);
  if (metadataResult.error) throw metadataResult.error;
  if (noteTagsResult.error) throw noteTagsResult.error;
  if (navigationNodesResult.error) throw navigationNodesResult.error;
  if (entitiesResult.error) throw entitiesResult.error;

  const tagIds = uniqueStrings((noteTagsResult.data ?? []).map((tag: { tagId: string }) => tag.tagId));
  const tagsResult = tagIds.length > 0 ? await supabase.from("Tag").select("id, name").in("id", tagIds) : { data: [], error: null };
  if (tagsResult.error) throw tagsResult.error;

  const metadataByNoteId = new Map<string, { summary: string | null; displayTitle?: string | null }>();
  for (const metadata of metadataResult.data ?? []) {
      metadataByNoteId.set(metadata.noteId, { summary: metadata.summary, displayTitle: null });
  }

  const navigationNodeById = new Map<string, { title: string }>();
  for (const node of navigationNodesResult.data ?? []) {
    navigationNodeById.set(node.id, { title: node.title });
  }

  const entityById = new Map<string, { id: string; name: string; type: string; aliases: string[] }>();
  for (const entity of entitiesResult.data ?? []) {
      entityById.set(entity.id, {
        id: entity.id,
        name: entity.name,
        type: entity.type,
        aliases: Array.isArray(entity.aliases) ? entity.aliases.filter((alias: unknown): alias is string => typeof alias === "string") : []
      });
  }

  const tagNameById = new Map<string, string>();
  for (const tag of tagsResult.data ?? []) {
    tagNameById.set(tag.id, tag.name);
  }

  const tagsByNoteId = new Map<string, WorkspaceNoteRecord["tags"]>();
  for (const noteTag of noteTagsResult.data ?? []) {
    const tagName = tagNameById.get(noteTag.tagId);
    if (!tagName) continue;
    tagsByNoteId.set(noteTag.noteId, [
      ...(tagsByNoteId.get(noteTag.noteId) ?? []),
      {
        source: noteTag.source,
        tag: {
          name: tagName
        }
      }
    ]);
  }

  return new Map(
    notes.map((note) => [
      note.id,
      {
        id: note.id,
        title: note.title,
        excerpt: note.excerpt,
        updatedAt: new Date(note.updatedAt),
        navigationNodeId: note.navigationNodeId,
        sortOrder: note.sortOrder ?? 0,
        isPinned: note.isPinned ?? false,
        noteType: note.noteType,
        isLocked: note.isLocked ?? false,
        lockedAt: note.lockedAt ? new Date(note.lockedAt) : null,
        lockedBy: note.lockedBy ?? null,
        plainTextContent: typeof note.plainTextContent === "string" ? note.plainTextContent : "",
        curatedSummary: note.curatedSummary,
        entityId: note.entityId,
        metadataOverride: metadataByNoteId.get(note.id) ?? null,
        navigationNode: note.navigationNodeId ? navigationNodeById.get(note.navigationNodeId) ?? null : null,
        entity: note.entityId ? entityById.get(note.entityId) ?? null : null,
        tags: tagsByNoteId.get(note.id) ?? []
      }
    ])
  );
}

function readParam(searchParams: SearchParams, key: string) {
  const value = searchParams[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

async function resolveNodeId(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, workspaceId: string, nodeId: string | undefined) {
  if (!nodeId || nodeId === "unassigned") return nodeId;

  const { data, error } = await supabase
    .from("NavigationNode")
    .select("id")
    .eq("workspaceId", workspaceId)
    .eq("id", nodeId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Navigation node load error:", JSON.stringify(serializeError(error), null, 2));
    return undefined;
  }

  return data?.id;
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }
  return error;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}
