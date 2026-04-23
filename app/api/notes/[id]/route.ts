import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getNoteDetail } from "@/lib/notes/queries";
import { updateNoteMetadata } from "@/lib/notes/mutations";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  if (!(await getCurrentUserId())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const note = await getNoteDetail(id);
  if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });
  return NextResponse.json(note);
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!(await getCurrentUserId())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  await updateNoteMetadata({
    noteId: id,
    displayTitle: typeof body.displayTitle === "string" ? body.displayTitle : undefined,
    summary: typeof body.summary === "string" ? body.summary : undefined,
    status: typeof body.status === "string" ? body.status : undefined,
    priority: typeof body.priority === "number" ? body.priority : null,
    entityType: typeof body.entityType === "string" ? body.entityType : undefined,
    notes: typeof body.notes === "string" ? body.notes : undefined,
    tags: Array.isArray(body.tags) ? body.tags : undefined,
    categories: Array.isArray(body.categories) ? body.categories : undefined
  });

  return NextResponse.json({ ok: true });
}
