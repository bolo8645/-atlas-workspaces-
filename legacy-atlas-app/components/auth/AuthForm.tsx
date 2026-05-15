"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

type AuthFormProps = {
  mode: "sign-in" | "sign-up";
  nextPath: string | null;
  initialError?: string | null;
  configError?: string | null;
};

export function AuthForm({ mode, nextPath, initialError = null, configError = null }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? configError);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSignIn = mode === "sign-in";
  const submitLabel = isSignIn ? "Sign in" : "Create account";
  const alternateHref = isSignIn ? "/signup" : "/login";
  const alternateLabel = isSignIn ? "Create an account" : "Sign in instead";
  const redirectPath = useMemo(() => nextPath ?? "/notes", [nextPath]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (configError) {
      setError(configError);
      return;
    }

    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      const supabase = createSupabaseClient();

      if (isSignIn) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (signInError) {
          setError(signInError.message);
          return;
        }

        router.replace(redirectPath);
        router.refresh();
        return;
      }

      const confirmUrl = new URL("/auth/confirm", window.location.origin);
      if (nextPath) confirmUrl.searchParams.set("next", nextPath);

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: confirmUrl.toString()
        }
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.session) {
        router.replace(redirectPath);
        router.refresh();
        return;
      }

      setMessage("Check your email to confirm your account, then sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[radial-gradient(circle_at_top,#0f172a_0%,#020617_40%,#020617_100%)] px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-lg border border-white/10 bg-black/60 p-6 shadow-2xl shadow-black/40 backdrop-blur">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--signal)]">Atlas Workspaces</p>
          <h1 className="text-2xl font-semibold">{isSignIn ? "Sign in" : "Create your account"}</h1>
          <p className="text-sm text-stone-400">{isSignIn ? "Private access to your notes and worldbuilding workspace." : "Create a private workspace account with email and password."}</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-stone-400">Email</span>
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 w-full rounded-md border border-white/10 bg-black/50 px-3 text-sm text-white outline-none transition focus:border-[var(--signal)]/50"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-stone-400">Password</span>
            <input
              required
              minLength={8}
              type="password"
              autoComplete={isSignIn ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 w-full rounded-md border border-white/10 bg-black/50 px-3 text-sm text-white outline-none transition focus:border-[var(--signal)]/50"
            />
          </label>

          {error ? <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p> : null}
          {message ? <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting || Boolean(configError)}
            className="h-11 w-full rounded-md bg-[var(--signal)] px-4 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Working..." : submitLabel}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-stone-400">
          <Link href={alternateHref + (nextPath ? `?next=${encodeURIComponent(nextPath)}` : "")} className="transition hover:text-white">
            {alternateLabel}
          </Link>
          <span>{isSignIn ? "Email/password" : "Confirmation email required"}</span>
        </div>
      </div>
    </div>
  );
}
