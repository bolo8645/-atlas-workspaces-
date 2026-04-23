import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { getAdminImportSecret } from "@/lib/config";
import { runNotesImport } from "@/lib/import/importer";
import { getImportHistory } from "@/lib/notes/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!(await getCurrentUserId())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await getImportHistory());
}

export async function POST(request: Request) {
  if (!(await getCurrentUserId())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = getAdminImportSecret();
  if (secret) {
    const provided = request.headers.get("x-admin-secret") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (provided !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runNotesImport();
  return NextResponse.json(result);
}
