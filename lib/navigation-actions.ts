"use server";

import { revalidatePath } from "next/cache";
import { createNavigationNode, deleteNavigationNode, findOrCreateNavigationFolder, moveNavigationNode, renameNavigationNode, updateNavigationNode } from "@/lib/navigation-mutations";
import { hasDatabaseUrl } from "@/lib/db-env";

export async function createNavigationNodeAction(formData: FormData) {
  if (!hasDatabaseUrl) return;

  await createNavigationNode({
    parentId: nullableString(formData, "parentId"),
    title: stringValue(formData, "title"),
    slug: stringValue(formData, "slug"),
    description: stringValue(formData, "description"),
    sortOrder: numberValue(formData, "sortOrder"),
    isVisible: booleanValue(formData, "isVisible")
  });

  revalidateNavigationPaths();
}

export async function createNavigationFolderAction(input: { title: string; parentId?: string | null }) {
  if (!hasDatabaseUrl) {
    const id = `mock-folder-${Date.now()}`;
    return {
      id,
      parentId: input.parentId ?? null,
      title: input.title,
      slug: input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      fullPath: input.title
    };
  }

  const node = await findOrCreateNavigationFolder({
    title: input.title,
    parentId: input.parentId
  });

  revalidateNavigationPaths();
  return node;
}

export async function updateNavigationNodeAction(formData: FormData) {
  if (!hasDatabaseUrl) return;

  await updateNavigationNode({
    id: requiredString(formData, "id"),
    parentId: nullableString(formData, "parentId"),
    title: stringValue(formData, "title"),
    slug: stringValue(formData, "slug"),
    description: stringValue(formData, "description"),
    sortOrder: numberValue(formData, "sortOrder"),
    isVisible: booleanValue(formData, "isVisible")
  });

  revalidateNavigationPaths();
}

export async function renameNavigationNodeAction(input: { id: string; title: string }) {
  if (!hasDatabaseUrl) return;

  await renameNavigationNode(input);
  revalidateNavigationPaths();
}

export async function moveNavigationNodeAction(formData: FormData) {
  if (!hasDatabaseUrl) return;

  await moveNavigationNode({
    id: requiredString(formData, "id"),
    parentId: nullableString(formData, "parentId"),
    sortOrder: numberValue(formData, "sortOrder")
  });

  revalidateNavigationPaths();
}

export async function moveNavigationNodeFromSidebarAction(input: { id: string; parentId?: string | null; sortOrder?: number | null }) {
  if (!hasDatabaseUrl) return;

  await moveNavigationNode(input);
  revalidateNavigationPaths();
}

export async function deleteNavigationNodeAction(formData: FormData) {
  if (!hasDatabaseUrl) return;

  await deleteNavigationNode(requiredString(formData, "id"));
  revalidateNavigationPaths();
}

function revalidateNavigationPaths() {
  revalidatePath("/");
  revalidatePath("/notes");
  revalidatePath("/admin/navigation");
}

function requiredString(formData: FormData, key: string) {
  const value = stringValue(formData, key);
  if (!value) throw new Error(`Missing ${key}`);
  return value;
}

function nullableString(formData: FormData, key: string) {
  return stringValue(formData, key) ?? null;
}

function stringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function numberValue(formData: FormData, key: string) {
  const value = stringValue(formData, key);
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function booleanValue(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}
