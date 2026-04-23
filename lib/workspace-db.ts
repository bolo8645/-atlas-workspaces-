import { Prisma } from "@prisma/client";
import { hasDatabaseUrl } from "@/lib/db-env";
import { prisma } from "@/lib/prisma";
import { DEFAULT_WORKSPACE_ID } from "@/lib/workspace-constants";

export type WorkspaceSummary = {
  id: string;
  name: string;
};

const workspaceSupportsUserOwnership = Prisma.dmmf.datamodel.models
  .find((model) => model.name === "Workspace")
  ?.fields.some((field) => field.name === "userId");

export async function ensureDefaultWorkspace() {
  if (!hasDatabaseUrl) return { id: DEFAULT_WORKSPACE_ID, name: "ASCU" };

  const existing = await prisma.workspace.findFirst({
    where: {
      OR: workspaceSupportsUserOwnership ? [{ id: DEFAULT_WORKSPACE_ID }, { userId: null, name: "ASCU" }] : [{ id: DEFAULT_WORKSPACE_ID }, { name: "ASCU" }]
    },
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      name: true
    }
  });

  if (existing) return existing;

  return prisma.workspace.create({
    data: {
      id: DEFAULT_WORKSPACE_ID,
      name: "ASCU"
    },
    select: {
      id: true,
      name: true
    }
  });
}

export async function getWorkspaceSummaries(userId: string): Promise<WorkspaceSummary[]> {
  if (!hasDatabaseUrl) return [{ id: DEFAULT_WORKSPACE_ID, name: "ASCU" }];

  await bootstrapWorkspacesForUser(userId);

  return prisma.workspace.findMany({
    where: workspaceSupportsUserOwnership ? { userId } : undefined,
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true
    }
  });
}

export async function bootstrapWorkspacesForUser(userId: string) {
  if (!workspaceSupportsUserOwnership) {
    await ensureDefaultWorkspace();
    return;
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.workspace.findFirst({
      where: { userId },
      select: { id: true }
    });
    if (existing) return;

    const orphanWorkspaces = await tx.workspace.findMany({
      where: { userId: null },
      orderBy: [{ createdAt: "asc" }],
      select: { id: true }
    });

    if (orphanWorkspaces.length > 0) {
      await tx.workspace.updateMany({
        where: {
          id: { in: orphanWorkspaces.map((workspace) => workspace.id) }
        },
        data: { userId }
      });
      return;
    }

    await tx.workspace.create({
      data: {
        name: "ASCU",
        userId
      }
    });
  });
}

export function canScopeWorkspacesToUser() {
  return Boolean(workspaceSupportsUserOwnership);
}
