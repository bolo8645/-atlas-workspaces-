import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { sanitizeNextPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextPath = sanitizeNextPath(searchParams.get("next")) ?? "/notes";
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = nextPath;
  redirectUrl.search = "";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash
    });

    if (!error) return NextResponse.redirect(redirectUrl);
  }

  redirectUrl.pathname = "/login";
  redirectUrl.search = "";
  redirectUrl.searchParams.set("error", "Could not verify your email. Please sign in again.");
  return NextResponse.redirect(redirectUrl);
}
