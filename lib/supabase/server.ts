import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv, getSupabasePublicEnvError } from "@/lib/supabase/env";

export async function createClient() {
  const env = getSupabasePublicEnv();
  if (!env) throw new Error(getSupabasePublicEnvError() ?? "Supabase Auth is not configured.");

  const cookieStore = await cookies();

  return createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies directly.
        }
      }
    }
  });
}
