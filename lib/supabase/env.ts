export type SupabasePublicEnv = {
  url: string;
  publishableKey: string;
};

export function getSupabasePublicEnv(): SupabasePublicEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) return null;

  return {
    url,
    publishableKey
  };
}

export function getSupabasePublicEnvError() {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (missing.length === 0) return null;
  return `Supabase Auth is not configured for this environment. Set ${missing.join(" and ")} before using login or signup.`;
}
