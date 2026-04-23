export const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
export const hasSupabaseAuthEnv = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
