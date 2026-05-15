"use server";

import { revalidatePath } from "next/cache";
import { attachNoteToEntity, createExplicitEntity, findEntityByName, linkTextSelectionToEntity, mergeEntityIntoTarget, removeNoteEntityLink, updateExplicitEntity } from "@/lib/entities";

export async function createEntityAction(input: { name: string; type: string; aliases?: string[]; allowDuplicate?: boolean }) {
  const entity = await createExplicitEntity(input);
  revalidatePath("/notes");
  return entity;
}

export async function findEntityByNameAction(input: { name: string; type?: string | null }) {
  return findEntityByName(input);
}

export async function updateEntityAction(input: { entityId: string; name?: string | null; type?: string | null; aliases?: string[] | null }) {
  const entity = await updateExplicitEntity(input);
  revalidatePath("/notes");
  return entity;
}

export async function attachNoteEntityAction(input: { noteId: string; entityId: string }) {
  const entity = await attachNoteToEntity(input);
  revalidatePath("/notes");
  revalidatePath(`/notes/${input.noteId}`);
  return entity;
}

export async function removeNoteEntityLinkAction(noteId: string) {
  const entity = await removeNoteEntityLink(noteId);
  revalidatePath("/notes");
  revalidatePath(`/notes/${noteId}`);
  return entity;
}

export async function linkTextSelectionToEntityAction(input: { noteId: string; entityId: string; text: string }) {
  const entity = await linkTextSelectionToEntity(input);
  revalidatePath("/notes");
  revalidatePath(`/notes/${input.noteId}`);
  return entity;
}

export async function mergeEntityAction(input: { sourceEntityId: string; targetEntityId: string }) {
  const entity = await mergeEntityIntoTarget(input);
  revalidatePath("/notes");
  return entity;
}
