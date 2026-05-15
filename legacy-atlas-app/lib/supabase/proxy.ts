import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_PATHNAME_HEADER, isPublicPath, sanitizeNextPath } from "@/lib/auth/shared";
import { hasSupabaseAuthEnv } from "@/lib/db-env";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(AUTH_PATHNAME_HEADER, request.nextUrl.pathname);

  let response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });

  if (!hasSupabaseAuthEnv) return response;
  const env = getSupabasePublicEnv();
  if (!env) return response;

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

        response = NextResponse.next({
          request: {
            headers: requestHeaders
          }
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const next = sanitizeNextPath(`${pathname}${request.nextUrl.search}`);

  if (!user && !isPublicPath(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    if (next) redirectUrl.searchParams.set("next", next);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isPublicPath(pathname) && !pathname.startsWith("/auth/confirm")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = sanitizeNextPath(request.nextUrl.searchParams.get("next")) ?? "/notes";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
