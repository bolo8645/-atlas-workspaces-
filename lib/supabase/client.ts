import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv, getSupabasePublicEnvError } from "@/lib/supabase/env";

export function createClient() {
  const env = getSupabasePublicEnv();
  if (!env) throw new Error(getSupabasePublicEnvError() ?? "Supabase Auth is not configured.");
  return createBrowserClient(env.url, env.publishableKey);
}
