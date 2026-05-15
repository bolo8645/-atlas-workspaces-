"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { ReviewStatus } from "@prisma/client";
import { requireCurrentUserId } from "@/lib/auth";
import { excerpt, hashText, makeContentFingerprint, makeTitleFingerprint } from "@/lib/import/text";
import { runNotesImport } from "@/lib/import/importer";
import { hasDatabaseUrl } from "@/lib/db-env";
import { bulkUpdateNoteNavigationAssignment, createEditorNote, createManualRelationship, deleteEditorNote, duplicateEditorNote, lockNote, moveNoteToNavigationNode, reorderNotes, toggleNotePinned, unlockNote, updateEditorNote, updateNoteEntityLink, updateNoteMetadata, updateNoteNavigationAssignment, updateNoteTags, updateReviewItemStatus, verifyNotePasscode } from "@/lib/notes/mutations";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspaces";

export async function updateNoteMetadataAction(formData: FormData) {
  if (!hasDatabaseUrl) return;

  const noteId = requiredString(formData, "noteId");
  await updateNoteMetadata({
    noteId,
    displayTitle: stringValue(formData, "displayTitle"),
    summary: stringValue(formData, "summary"),
    status: stringValue(formData, "status"),
    priority: numberValue(formData, "priority"),
    entityType: stringValue(formData, "entityType"),
    notes: stringValue(formData, "notes"),
    tags: listValue(formData, "tags"),
    categories: listValue(formData, "categories")
  });

  revalidatePath("/notes");
  revalidatePath(`/notes/${noteId}`);
}

export async function createManualRelationshipAction(formData: FormData) {
  if (!hasDatabaseUrl) return;

  const noteId = requiredString(formData, "noteId");
  await createManualRelationship({
    noteId,
    targetNoteId: requiredString(formData, "targetNoteId"),
    relationType: stringValue(formData, "relationType"),
    reason: stringValue(formData, "reason")
  });

  revalidatePath(`/notes/${noteId}`);
}

export async function updateNoteNavigationAssignmentAction(formData: FormData) {
  if (!hasDatabaseUrl) return;

  const noteId = requiredString(formData, "noteId");
  await updateNoteNavigationAssignment({
    noteId,
    navigationNodeId: nullableString(formData, "navigationNodeId"),
    createNavigationNodeTitle: nullableString(formData, "createNavigationNodeTitle"),
    createParentId: nullableString(formData, "createParentId")
  });

  revalidatePath("/");
  revalidatePath("/notes");
  revalidatePath(`/notes/${noteId}`);
  revalidatePath("/admin/content");
  revalidatePath("/admin/navigation");
}

export async function bulkUpdateNoteNavigationAssignmentAction(formData: FormData) {
  if (!hasDatabaseUrl) return;

  await bulkUpdateNoteNavigationAssignment({
    noteIds: listValues(formData, "noteIds"),
    navigationNodeId: nullableString(formData, "navigationNodeId"),
    createNavigationNodeTitle: nullableString(formData, "createNavigationNodeTitle"),
    createParentId: nullableString(formData, "createParentId")
  });

  revalidatePath("/");
  revalidatePath("/notes");
  revalidatePath("/admin/content");
  revalidatePath("/admin/navigation");
}

export async function assignNoteNavigationNodeAction(input: { noteId: string; navigationNodeId?: string | null; createNavigationNodeTitle?: string | null; createParentId?: string | null }) {
  if (!hasDatabaseUrl) {
    if (!input.createNavigationNodeTitle) return input.navigationNodeId ? { id: input.navigationNodeId, parentId: null, title: "Selected folder", slug: "selected-folder", fullPath: "Selected folder" } : null;
    const title = input.createNavigationNodeTitle;
    return {
      id: `mock-folder-${Date.now()}`,
      parentId: input.createParentId ?? null,
      title,
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      fullPath: title
    };
  }

  const result = await updateNoteNavigationAssignment(input);

  revalidatePath("/");
  revalidatePath("/notes");
  revalidatePath(`/notes/${input.noteId}`);
  revalidatePath("/admin/content");
  revalidatePath("/admin/navigation");

  return result;
}

export async function createEditorNoteAction(input: { navigationNodeId?: string | null; title?: string | null; content?: string | null; noteType?: string | null }) {
  if (!hasDatabaseUrl) {
    await requireCurrentUserId();
    const supabase = await createSupabaseServerClient();
    const workspaceId = await getActiveWorkspaceId();
    const noteId = randomUUID();
    const now = new Date().toISOString();
    const title = cleanTitle(input.title);
    const content = cleanContent(input.content);
    const noteType = cleanNoteType(input.noteType);
    const sourceIdentity = `manual:${workspaceId}:${noteId}`;
    const sourcePath = `manual/${noteId}.md`;
    const sourceChecksum = hashText(content);
    const navigationNodeId = cleanNavigationNodeId(input.navigationNodeId);
    const sortOrder = await getNextSortOrder(supabase, workspaceId, navigationNodeId);
    const { error } = await supabase.from("Note").insert({
      id: noteId,
      workspaceId,
      sourceIdentity,
      sourcePath,
      sourceFileName: `${noteId}.md`,
      sourceExtension: "md",
      sourceChecksum,
      contentFingerprint: makeContentFingerprint(content),
      title,
      titleFingerprint: makeTitleFingerprint(title),
      importedContent: content,
      plainTextContent: content,
      excerpt: excerpt(content),
      status: "NEW",
      parseQuality: 100,
      curatedSummary: content,
      noteType,
      isPinned: false,
      isLocked: false,
      navigationNodeId,
      sortOrder,
      updatedAt: now
    });
    if (error) throw error;

    return {
      id: noteId,
      entity: null,
      content
    };
  }

  const note = await createEditorNote(input);

  revalidatePath("/");
  revalidatePath("/notes");
  revalidatePath("/admin/content");
  revalidatePath("/admin/navigation");

  return {
    ...note,
    content: typeof input.content === "string" ? input.content : ""
  };
}

export async function updateEditorNoteAction(input: { noteId: string; title?: string | null; content?: string | null; noteType?: string | null }) {
  if (!hasDatabaseUrl) {
    await requireCurrentUserId();
    const supabase = await createSupabaseServerClient();
    const existingResult = await supabase.from("Note").select("id, title, plainTextContent, noteType").eq("id", input.noteId).maybeSingle();
    if (existingResult.error) throw existingResult.error;
    if (!existingResult.data) return null;

    const title = cleanTitle(input.title ?? existingResult.data.title);
    const content = cleanContent(input.content ?? existingResult.data.plainTextContent);
    const noteType = cleanNoteType(input.noteType ?? existingResult.data.noteType);
    const { error } = await supabase
      .from("Note")
      .update({
        title,
        titleFingerprint: makeTitleFingerprint(title),
        plainTextContent: content,
        curatedSummary: content,
        importedContent: content,
        excerpt: excerpt(content),
        sourceChecksum: hashText(content),
        contentFingerprint: makeContentFingerprint(content),
        noteType,
        updatedAt: new Date().toISOString()
      })
      .eq("id", input.noteId);
    if (error) throw error;

    return null;
  }

  const entity = await updateEditorNote(input);

  revalidatePath("/");
  revalidatePath("/notes");
  revalidatePath(`/notes/${input.noteId}`);
  revalidatePath("/admin/content");

  return entity;
}

export async function updateNoteEntityLinkAction(input: { noteId: string; entityId?: string | null }) {
  if (!hasDatabaseUrl) return null;

  const entity = await updateNoteEntityLink(input);

  revalidatePath("/");
  revalidatePath("/notes");
  revalidatePath(`/notes/${input.noteId}`);
  revalidatePath("/admin/content");

  return entity;
}

export async function deleteEditorNoteAction(noteId: string) {
  if (!hasDatabaseUrl) {
    await requireCurrentUserId();
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("Note").update({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).eq("id", noteId);
    if (error) throw error;
    revalidatePath("/");
    revalidatePath("/notes");
    revalidatePath("/admin/content");
    revalidatePath("/admin/navigation");
    return;
  }

  await deleteEditorNote(noteId);

  revalidatePath("/");
  revalidatePath("/notes");
  revalidatePath("/admin/content");
  revalidatePath("/admin/navigation");
}

export async function duplicateEditorNoteAction(noteId: string) {
  if (!hasDatabaseUrl) {
    await requireCurrentUserId();
    const supabase = await createSupabaseServerClient();
    const existingResult = await supabase
      .from("Note")
      .select("title, plainTextContent, noteType, navigationNodeId")
      .eq("id", noteId)
      .maybeSingle();
    if (existingResult.error) throw existingResult.error;
    if (!existingResult.data) return null;

    const created = await createEditorNoteAction({
      title: `${cleanTitle(existingResult.data.title)} Copy`,
      content: cleanContent(existingResult.data.plainTextContent),
      noteType: cleanNoteType(existingResult.data.noteType),
      navigationNodeId: existingResult.data.navigationNodeId
    });

    revalidatePath("/");
    revalidatePath("/notes");
    revalidatePath(`/notes/${noteId}`);

    return {
      id: created.id,
      title: `${cleanTitle(existingResult.data.title)} Copy`,
      updatedAt: new Date(),
      isPinned: false,
      isLocked: false,
      lockedAt: null,
      lockedBy: null,
      navigationNodeId: cleanNavigationNodeId(existingResult.data.navigationNodeId),
      noteType: cleanNoteType(existingResult.data.noteType),
      entity: created.entity,
      content: created.content
    };
  }

  const note = await duplicateEditorNote(noteId);

  revalidatePath("/");
  revalidatePath("/notes");
  revalidatePath(`/notes/${noteId}`);

  return note;
}

export async function toggleNotePinnedAction(input: { noteId: string; isPinned: boolean }) {
  if (!hasDatabaseUrl) {
    await requireCurrentUserId();
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("Note").update({ isPinned: input.isPinned, updatedAt: new Date().toISOString() }).eq("id", input.noteId);
    if (error) throw error;
    revalidatePath("/");
    revalidatePath("/notes");
    revalidatePath(`/notes/${input.noteId}`);
    return;
  }

  await toggleNotePinned(input);

  revalidatePath("/");
  revalidatePath("/notes");
  revalidatePath(`/notes/${input.noteId}`);
}

export async function updateNoteTagsAction(input: { noteId: string; tags: string[] }) {
  if (!hasDatabaseUrl) return;

  await updateNoteTags(input);

  revalidatePath("/");
  revalidatePath("/notes");
  revalidatePath(`/notes/${input.noteId}`);
}

export async function lockNoteAction(input: { noteId: string; passcode: string }) {
  if (!hasDatabaseUrl) return { isLocked: true, lockedAt: new Date(), lockedBy: null };

  const note = await lockNote(input);

  revalidatePath("/");
  revalidatePath("/notes");
  revalidatePath(`/notes/${input.noteId}`);

  return note;
}

export async function unlockNoteAction(input: { noteId: string; passcode: string }) {
  if (!hasDatabaseUrl) return { isLocked: false, lockedAt: null, lockedBy: null };

  const note = await unlockNote(input);

  revalidatePath("/");
  revalidatePath("/notes");
  revalidatePath(`/notes/${input.noteId}`);

  return note;
}

export async function verifyNotePasscodeAction(input: { noteId: string; passcode: string }) {
  if (!hasDatabaseUrl) return false;
  return verifyNotePasscode(input);
}

export async function reorderNotesAction(input: { navigationNodeId?: string | null; noteIds: string[] }) {
  if (!hasDatabaseUrl) {
    await requireCurrentUserId();
    const supabase = await createSupabaseServerClient();
    const navigationNodeId = cleanNavigationNodeId(input.navigationNodeId);
    await Promise.all(
      input.noteIds.map((noteId, index) =>
        supabase
          .from("Note")
          .update({
            navigationNodeId,
            sortOrder: index,
            updatedAt: new Date().toISOString()
          })
          .eq("id", noteId)
          .then(({ error }) => {
            if (error) throw error;
          })
      )
    );
    revalidatePath("/");
    revalidatePath("/notes");
    return;
  }

  await reorderNotes(input);

  revalidatePath("/");
  revalidatePath("/notes");
}

export async function moveNoteToNavigationNodeAction(input: { noteId: string; navigationNodeId?: string | null }) {
  if (!hasDatabaseUrl) {
    await requireCurrentUserId();
    const supabase = await createSupabaseServerClient();
    const workspaceId = await getActiveWorkspaceId();
    const navigationNodeId = cleanNavigationNodeId(input.navigationNodeId);
    const sortOrder = await getNextSortOrder(supabase, workspaceId, navigationNodeId);
    const { error } = await supabase
      .from("Note")
      .update({
        navigationNodeId,
        sortOrder,
        updatedAt: new Date().toISOString()
      })
      .eq("id", input.noteId);
    if (error) throw error;

    revalidatePath("/");
    revalidatePath("/notes");
    revalidatePath(`/notes/${input.noteId}`);
    revalidatePath("/admin/content");
    revalidatePath("/admin/navigation");
    return;
  }

  await moveNoteToNavigationNode(input);

  revalidatePath("/");
  revalidatePath("/notes");
  revalidatePath(`/notes/${input.noteId}`);
  revalidatePath("/admin/content");
  revalidatePath("/admin/navigation");
}

export async function resolveReviewItemAction(formData: FormData) {
  if (!hasDatabaseUrl) return;

  const id = requiredString(formData, "reviewItemId");
  const status = stringValue(formData, "status") === ReviewStatus.DISMISSED ? ReviewStatus.DISMISSED : ReviewStatus.RESOLVED;
  await updateReviewItemStatus(id, status);
  revalidatePath("/review");
}

export async function runImportAction() {
  if (!hasDatabaseUrl) return;

  await runNotesImport();
  revalidatePath("/");
  revalidatePath("/imports");
  revalidatePath("/notes");
  revalidatePath("/review");
}

function requiredString(formData: FormData, key: string) {
  const value = stringValue(formData, key);
  if (!value) throw new Error(`Missing ${key}`);
  return value;
}

function stringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : undefined;
}

function nullableString(formData: FormData, key: string) {
  return stringValue(formData, key) ?? null;
}

function numberValue(formData: FormData, key: string) {
  const value = stringValue(formData, key);
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function listValue(formData: FormData, key: string) {
  const value = stringValue(formData, key);
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function listValues(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function cleanTitle(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : "Untitled";
}

function cleanContent(value: string | null | undefined) {
  return typeof value === "string" ? value : "";
}

function cleanNoteType(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : "draft";
}

function cleanNavigationNodeId(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function getNextSortOrder(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, workspaceId: string, navigationNodeId: string | null) {
  let query = supabase.from("Note").select("sortOrder").eq("workspaceId", workspaceId).is("deletedAt", null).order("sortOrder", { ascending: false }).limit(1);
  query = navigationNodeId ? query.eq("navigationNodeId", navigationNodeId) : query.is("navigationNodeId", null);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return typeof data?.sortOrder === "number" ? data.sortOrder + 1 : 0;
}
