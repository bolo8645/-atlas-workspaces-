import { hasDatabaseUrl } from "@/lib/db-env";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/workspaces";

export async function getContentManagerNotes() {
  if (!hasDatabaseUrl) return [];

  const workspaceId = await getActiveWorkspaceId();
  return prisma.note.findMany({
    where: { workspaceId },
    orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
    include: {
      metadataOverride: true,
      navigationNode: true,
      _count: {
        select: {
          attachments: true,
          parseWarnings: true
        }
      }
    }
  });
}
