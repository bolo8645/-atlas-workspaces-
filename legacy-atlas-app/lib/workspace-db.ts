import { randomUUID } from "node:crypto";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_WORKSPACE_ID } from "@/lib/workspace-constants";

export type WorkspaceSummary = {
  id: string;
  name: string;
};

const DEFAULT_WORKSPACE_NAME = "ASCU";

export async function ensureDefaultWorkspace() {
  return {
    id: DEFAULT_WORKSPACE_ID,
    name: DEFAULT_WORKSPACE_NAME
  };
}

export async function getWorkspaceSummaries(userId: string): Promise<WorkspaceSummary[]> {
  let workspace = await ensureDefaultWorkspaceForUser(userId);

  if (!workspace) {
    workspace = {
      id: DEFAULT_WORKSPACE_ID,
      name: DEFAULT_WORKSPACE_NAME
    };
  }

  return [workspace];
}

export async function createWorkspaceForUser(userId: string, name: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("Workspace")
    .insert({
      id: randomUUID(),
      userId,
      name
    })
    .select("id, name")
    .maybeSingle();

  if (error) {
    console.error("Workspace load error:", JSON.stringify(serializeError(error), null, 2));
  }

  return data ?? { id: DEFAULT_WORKSPACE_ID, name };
}

export function canScopeWorkspacesToUser() {
  return true;
}

async function ensureDefaultWorkspaceForUser(userId: string): Promise<WorkspaceSummary | null> {
  try {
    const supabase = await createSupabaseServerClient();
    let workspace: WorkspaceSummary | null = null;
    const { data, error } = await supabase
      .from("Workspace")
      .select("*")
      .eq("userId", userId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Workspace load error:", JSON.stringify(serializeError(error), null, 2));
    } else {
      workspace = data ? { id: data.id, name: data.name } : null;
    }

    if (workspace === null && !error) {
      const { data: newWorkspace, error: createError } = await supabase
        .from("Workspace")
        .insert({
          id: randomUUID(),
          userId,
          name: DEFAULT_WORKSPACE_NAME
        })
        .select()
        .maybeSingle();

      if (createError) {
        console.error("Workspace load error:", JSON.stringify(serializeError(createError), null, 2));
      } else {
        workspace = newWorkspace ? { id: newWorkspace.id, name: newWorkspace.name } : null;
      }
    }

    if (!workspace) {
      workspace = {
        id: DEFAULT_WORKSPACE_ID,
        name: DEFAULT_WORKSPACE_NAME
      };
    }

    return workspace;
  } catch (error) {
    console.error("Workspace load error:", JSON.stringify(serializeError(error), null, 2));
    return {
      id: DEFAULT_WORKSPACE_ID,
      name: DEFAULT_WORKSPACE_NAME
    };
  }
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
