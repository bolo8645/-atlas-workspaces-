import { cookies } from "next/headers";
import { getCurrentUserId } from "@/lib/auth";
import { DEFAULT_WORKSPACE_ID, WORKSPACE_COOKIE_NAME } from "@/lib/workspace-constants";
import { ensureDefaultWorkspace, getWorkspaceSummaries, type WorkspaceSummary } from "@/lib/workspace-db";
export { DEFAULT_WORKSPACE_ID, WORKSPACE_COOKIE_NAME } from "@/lib/workspace-constants";
export type { WorkspaceSummary } from "@/lib/workspace-db";

export async function getWorkspaces(): Promise<WorkspaceSummary[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  return getWorkspaceSummaries(userId);
}

export async function getActiveWorkspace() {
  const workspaces = await getWorkspaces();
  if (workspaces.length === 0) return ensureDefaultWorkspace();

  let requestedId: string | undefined;
  try {
    const cookieStore = await cookies();
    requestedId = cookieStore.get(WORKSPACE_COOKIE_NAME)?.value;
  } catch {
    requestedId = undefined;
  }
  return workspaces.find((workspace) => workspace.id === requestedId) ?? workspaces.find((workspace) => workspace.id === DEFAULT_WORKSPACE_ID) ?? workspaces[0];
}

export async function getActiveWorkspaceId() {
  return (await getActiveWorkspace()).id;
}
