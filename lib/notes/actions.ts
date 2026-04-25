"use server";

import { revalidatePath } from "next/cache";
import { ReviewStatus } from "@prisma/client";
import { runNotesImport } from "@/lib/import/importer";
import { hasDatabaseUrl } from "@/lib/db-env";
import { bulkUpdateNoteNavigationAssignment, createEditorNote, createManualRelationship, deleteEditorNote, duplicateEditorNote, lockNote, moveNoteToNavigationNode, reorderNotes, toggleNotePinned, unlockNote, updateEditorNote, updateNoteEntityLink, updateNoteMetadata, updateNoteNavigationAssignment, updateNoteTags, updateReviewItemStatus, verifyNotePasscode } from "@/lib/notes/mutations";

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
    return { id: `mock-note-${Date.now()}`, entity: null };
  }

  const note = await createEditorNote(input);

  revalidatePath("/");
  revalidatePath("/notes");
  revalidatePath("/admin/content");
  revalidatePath("/admin/navigation");

  return note;
}

export async function updateEditorNoteAction(input: { noteId: string; title?: string | null; content?: string | null; noteType?: string | null }) {
  if (!hasDatabaseUrl) return null;

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
  if (!hasDatabaseUrl) return;

  await deleteEditorNote(noteId);

  revalidatePath("/");
  revalidatePath("/notes");
  revalidatePath("/admin/content");
  revalidatePath("/admin/navigation");
}

export async function duplicateEditorNoteAction(noteId: string) {
  if (!hasDatabaseUrl) return null;

  const note = await duplicateEditorNote(noteId);

  revalidatePath("/");
  revalidatePath("/notes");
  revalidatePath(`/notes/${noteId}`);

  return note;
}

export async function toggleNotePinnedAction(input: { noteId: string; isPinned: boolean }) {
  if (!hasDatabaseUrl) return;

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
  if (!hasDatabaseUrl) return;

  await reorderNotes(input);

  revalidatePath("/");
  revalidatePath("/notes");
}

export async function moveNoteToNavigationNodeAction(input: { noteId: string; navigationNodeId?: string | null }) {
  if (!hasDatabaseUrl) return;

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
