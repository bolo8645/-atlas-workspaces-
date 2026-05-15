import "server-only";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { hasSupabaseAuthEnv } from "@/lib/db-env";
import { AUTH_PATHNAME_HEADER, isAuthPath, isPublicPath, sanitizeNextPath } from "@/lib/auth/shared";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export { AUTH_PATHNAME_HEADER, isAuthPath, isPublicPath, sanitizeNextPath };

export const getCurrentUser = cache(async (): Promise<User | null> => {
  if (!hasSupabaseAuthEnv) return null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user ?? null;
});

export async function getCurrentUserId() {
  return (await getCurrentUser())?.id ?? null;
}

export async function requireCurrentUserId() {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}
