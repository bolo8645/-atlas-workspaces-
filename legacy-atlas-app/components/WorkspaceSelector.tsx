"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createWorkspaceAction, switchWorkspaceAction } from "@/lib/workspace-actions";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import type { WorkspaceSummary } from "@/lib/workspace-db";

type WorkspaceSelectorProps = {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string;
};

export function WorkspaceSelector({ workspaces, activeWorkspaceId }: WorkspaceSelectorProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const switchFormRef = useRef<HTMLFormElement | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm font-black tracking-[0.18em] text-white">Atlas Workspaces</p>
      <form ref={switchFormRef} action={switchWorkspaceAction} className="flex items-center gap-2">
        <label className="sr-only" htmlFor="workspace-selector">
          Workspace
        </label>
        <select
          id="workspace-selector"
          name="workspaceId"
          defaultValue={activeWorkspaceId}
          onChange={() => {
            const form = switchFormRef.current;
            if (!form) return;
            startTransition(async () => {
              await switchWorkspaceAction(new FormData(form));
              router.push("/notes");
              router.refresh();
            });
          }}
          className="h-8 rounded border border-white/10 bg-black/40 px-2 text-xs font-bold text-stone-100 outline-none transition hover:border-white/20 focus:border-[var(--signal)]/50"
        >
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>
      </form>
      {isCreating ? (
        <form
          action={(formData) => {
            startTransition(async () => {
              await createWorkspaceAction(formData);
              setIsCreating(false);
              router.push("/notes");
              router.refresh();
            });
          }}
          className="flex items-center gap-2"
        >
          <input
            autoFocus
            name="name"
            placeholder="New workspace"
            className="h-8 w-40 rounded border border-white/10 bg-black/40 px-2 text-xs text-white outline-none placeholder:text-stone-600 focus:border-[var(--signal)]/50"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setIsCreating(false);
              }
            }}
          />
          <button type="submit" disabled={isPending} className="h-8 rounded border border-white/10 px-2 text-xs font-bold text-stone-200 transition hover:bg-white/10 hover:text-white disabled:opacity-60">
            Create
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setIsCreating(true)} className="h-8 rounded border border-white/10 px-2 text-xs font-bold text-stone-300 transition hover:bg-white/10 hover:text-white">
          + Workspace
        </button>
      )}
      <button
        type="button"
        disabled={isSigningOut}
        onClick={async () => {
          setIsSigningOut(true);
          const supabase = createSupabaseClient();
          await supabase.auth.signOut();
          router.push("/login");
          router.refresh();
          setIsSigningOut(false);
        }}
        className="h-8 rounded border border-white/10 px-2 text-xs font-bold text-stone-300 transition hover:bg-white/10 hover:text-white disabled:opacity-60"
      >
        Sign out
      </button>
    </div>
  );
}
