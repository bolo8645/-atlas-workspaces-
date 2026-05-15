"use client";

import { useEffect } from "react";
import { isPublicPath } from "@/lib/auth/shared";
import { getBrowserSession, signOutAndRedirectToLogin } from "@/lib/supabase/auth-client";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

export function AuthSessionGuard() {
  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseClient();

    void getBrowserSession().then((session) => {
      if (cancelled || session || isPublicPath(window.location.pathname)) return;
      void signOutAndRedirectToLogin();
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session || isPublicPath(window.location.pathname)) return;
      void signOutAndRedirectToLogin();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
