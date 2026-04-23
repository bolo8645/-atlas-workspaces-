import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import "./globals.css";
import NavigationSidebar from "../components/NavigationSidebar";
import { NotesDndProvider } from "@/components/NotesDndProvider";
import { ResizableAppShell } from "@/components/ResizableAppShell";
import { WorkspaceSelector } from "@/components/WorkspaceSelector";
import { AUTH_PATHNAME_HEADER, getCurrentUserId, isPublicPath } from "@/lib/auth";
import { getActiveWorkspace, getWorkspaces } from "@/lib/workspaces";

export const metadata: Metadata = {
  title: "Atlas Workspaces",
  description: "Your personal Atlas workspace system",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg"
  }
};

export const viewport: Viewport = {
  themeColor: "#070707"
};

export default async function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  const headerStore = await headers();
  const pathname = headerStore.get(AUTH_PATHNAME_HEADER);
  const userId = await getCurrentUserId();

  if (isPublicPath(pathname) || !userId) {
    if (pathname && !isPublicPath(pathname) && !userId) {
      redirect(`/login?next=${encodeURIComponent(pathname)}`);
    }

    return (
      <html lang="en" data-scroll-behavior="smooth">
        <body className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">{children}</body>
      </html>
    );
  }

  let workspaces: Awaited<ReturnType<typeof getWorkspaces>> = [];
  let activeWorkspace: Awaited<ReturnType<typeof getActiveWorkspace>> | null = null;
  let workspaceError: string | null = null;

  try {
    [workspaces, activeWorkspace] = await Promise.all([getWorkspaces(), getActiveWorkspace()]);
  } catch (error) {
    workspaceError = error instanceof Error ? error.message : "Unable to load your workspace.";
  }

  if (workspaceError || !activeWorkspace) {
    return (
      <html lang="en" data-scroll-behavior="smooth">
        <body className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
          <div className="flex min-h-dvh items-center justify-center px-4 py-10">
            <div className="w-full max-w-md rounded-lg border border-white/10 bg-black/70 p-6 shadow-2xl shadow-black/30">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--signal)]">Atlas Workspaces</p>
              <h1 className="mt-2 text-2xl font-semibold text-white">Workspace unavailable</h1>
              <p className="mt-3 text-sm text-stone-300">{workspaceError ?? "Unable to load your workspace right now."}</p>
              <div className="mt-5 flex items-center gap-3">
                <a href={pathname ?? "/notes"} className="inline-flex h-10 items-center rounded border border-white/10 px-4 text-sm font-semibold text-stone-100 transition hover:bg-white/10 hover:text-white">
                  Retry
                </a>
                <a href="/login" className="inline-flex h-10 items-center rounded border border-white/10 px-4 text-sm font-semibold text-stone-300 transition hover:bg-white/10 hover:text-white">
                  Back to login
                </a>
              </div>
            </div>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="min-h-dvh overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
        <NotesDndProvider>
          <div className="flex min-h-dvh flex-col overflow-hidden">
            <header className="sticky top-0 z-50 shrink-0 border-b border-white/10 bg-black/[0.88] px-4 py-3 backdrop-blur-xl sm:px-5">
              <WorkspaceSelector workspaces={workspaces} activeWorkspaceId={activeWorkspace.id} />
            </header>
            <ResizableAppShell
              sidebar={
                <Suspense fallback={<div className="p-4 text-sm text-stone-500">Loading folders...</div>}>
                  <NavigationSidebar />
                </Suspense>
              }
            >
              {children}
            </ResizableAppShell>
          </div>
        </NotesDndProvider>
      </body>
    </html>
  );
}
