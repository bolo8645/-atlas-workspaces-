import type { User } from "@supabase/supabase-js";
import { hasSupabaseAuthEnv } from "@/lib/db-env";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export const AUTH_PATHNAME_HEADER = "x-atlas-pathname";

const PUBLIC_PATH_PREFIXES = ["/login", "/signup", "/auth/confirm", "/auth/sign-in", "/auth/sign-up"];

export function isAuthPath(pathname: string | null | undefined) {
  return Boolean(pathname && pathname.startsWith("/auth"));
}

export function isPublicPath(pathname: string | null | undefined) {
  if (!pathname) return false;
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function sanitizeNextPath(value: string | null | undefined) {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  return value;
}

export async function getCurrentUser(): Promise<User | null> {
  if (!hasSupabaseAuthEnv) return null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user ?? null;
}

export async function getCurrentUserId() {
  return (await getCurrentUser())?.id ?? null;
}

export async function requireCurrentUserId() {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}
