import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { bootstrapWorkspacesForUser } from "@/lib/workspace-db";

export const dynamic = "force-dynamic";

export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await bootstrapWorkspacesForUser(userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Workspace bootstrap failed."
      },
      { status: 500 }
    );
  }
}
