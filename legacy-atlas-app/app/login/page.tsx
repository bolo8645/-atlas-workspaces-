import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { getCurrentUserId, sanitizeNextPath } from "@/lib/auth";
import { getSupabasePublicEnvError } from "@/lib/supabase/env";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(typeof params.next === "string" ? params.next : undefined);
  const error = typeof params.error === "string" ? params.error : null;

  if (await getCurrentUserId()) {
    redirect(nextPath ?? "/notes");
  }

  return <AuthForm mode="sign-in" nextPath={nextPath} initialError={error} configError={getSupabasePublicEnvError()} />;
}
