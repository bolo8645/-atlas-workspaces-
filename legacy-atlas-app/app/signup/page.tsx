import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { getCurrentUserId, sanitizeNextPath } from "@/lib/auth";
import { getSupabasePublicEnvError } from "@/lib/supabase/env";

type SignupPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(typeof params.next === "string" ? params.next : undefined);

  if (await getCurrentUserId()) {
    redirect(nextPath ?? "/notes");
  }

  return <AuthForm mode="sign-up" nextPath={nextPath} configError={getSupabasePublicEnvError()} />;
}
