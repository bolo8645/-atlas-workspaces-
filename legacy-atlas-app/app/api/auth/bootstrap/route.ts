import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, userId });
}
