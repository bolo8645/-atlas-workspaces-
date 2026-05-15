import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getNotesList } from "@/lib/notes/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await getCurrentUserId())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const searchParams = Object.fromEntries(url.searchParams.entries());
  const result = await getNotesList(searchParams);
  return NextResponse.json(result);
}
