"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireCurrentUserId } from "@/lib/auth";
import { WORKSPACE_COOKIE_NAME } from "@/lib/workspace-constants";
import { createWorkspaceForUser } from "@/lib/workspace-db";
import { getWorkspaces } from "@/lib/workspaces";

export async function switchWorkspaceAction(formData: FormData) {
  const workspaceId = stringValue(formData, "workspaceId");
  if (!workspaceId) return;

  const workspaces = await getWorkspaces();
  if (!workspaces.some((workspace) => workspace.id === workspaceId)) return;

  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_COOKIE_NAME, workspaceId, {
    path: "/",
    sameSite: "lax"
  });
  revalidateWorkspacePaths();
}

export async function createWorkspaceAction(formData: FormData) {
  const name = stringValue(formData, "name");
  if (!name) return;
  const userId = await requireCurrentUserId();

  const workspace = await createWorkspaceForUser(userId, name);

  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_COOKIE_NAME, workspace.id, {
    path: "/",
    sameSite: "lax"
  });
  revalidateWorkspacePaths();
}

function revalidateWorkspacePaths() {
  revalidatePath("/");
  revalidatePath("/notes");
  revalidatePath("/admin/content");
  revalidatePath("/admin/navigation");
}

function stringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() || undefined : undefined;
}
