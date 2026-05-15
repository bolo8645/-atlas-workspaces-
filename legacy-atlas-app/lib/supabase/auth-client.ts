"use client";

import { AuthApiError, type Session } from "@supabase/supabase-js";
import { isPublicPath, sanitizeNextPath } from "@/lib/auth/shared";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

let sessionRequest: Promise<Session | null> | null = null;
let logoutRequest: Promise<void> | null = null;

export async function getBrowserSession() {
  if (sessionRequest) return sessionRequest;

  const supabase = createSupabaseClient();
  sessionRequest = supabase.auth
    .getSession()
    .then(async ({ data, error }) => {
      if (error) {
        await handleSupabaseAuthError(error);
        return null;
      }

      return data.session ?? null;
    })
    .finally(() => {
      sessionRequest = null;
    });

  return sessionRequest;
}

export async function requireBrowserSession() {
  const session = await getBrowserSession();
  if (session) return session;

  if (!isPublicPath(window.location.pathname)) {
    await signOutAndRedirectToLogin();
  }

  return null;
}

export async function handleSupabaseAuthError(error: unknown) {
  if (!isInvalidRefreshTokenError(error)) return false;
  await signOutAndRedirectToLogin();
  return true;
}

function isInvalidRefreshTokenError(error: unknown) {
  return error instanceof AuthApiError && /invalid refresh token|refresh token not found/i.test(error.message);
}

export async function signOutAndRedirectToLogin() {
  if (logoutRequest) return logoutRequest;

  logoutRequest = (async () => {
    const supabase = createSupabaseClient();

    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Ignore sign-out failures while clearing invalid local auth state.
    }

    clearStoredSupabaseSession();

    const next = sanitizeNextPath(`${window.location.pathname}${window.location.search}`);
    const redirectUrl = new URL("/login", window.location.origin);
    if (next && !isPublicPath(window.location.pathname)) {
      redirectUrl.searchParams.set("next", next);
    }

    window.location.replace(redirectUrl.toString());
  })().finally(() => {
    logoutRequest = null;
  });

  return logoutRequest;
}

function clearStoredSupabaseSession() {
  const storage = window.localStorage;
  const keysToRemove: string[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key) continue;
    if (key === "supabase.auth.token" || /^sb-.*-auth-token$/.test(key)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => storage.removeItem(key));
}
