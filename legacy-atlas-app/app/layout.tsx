import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import "./globals.css";
import NavigationSidebar from "../components/NavigationSidebar";
import { AuthSessionGuard } from "@/components/auth/AuthSessionGuard";
import { NotesDndProvider } from "@/components/NotesDndProvider";
import { ResizableAppShell } from "@/components/ResizableAppShell";
import { WorkspaceSelector } from "@/components/WorkspaceSelector";
import { AUTH_PATHNAME_HEADER, getCurrentUserId, isPublicPath } from "@/lib/auth";
import { getActiveWorkspace, getWorkspaces } from "@/lib/workspaces";
import { DEFAULT_WORKSPACE_ID } from "@/lib/workspace-constants";

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
  const fallbackWorkspace = {
    id: DEFAULT_WORKSPACE_ID,
    name: "ASCU"
  };

  try {
    [workspaces, activeWorkspace] = await Promise.all([getWorkspaces(), getActiveWorkspace()]);
  } catch {
    workspaces = [fallbackWorkspace];
    activeWorkspace = fallbackWorkspace;
  }

  if (!activeWorkspace) {
    activeWorkspace = fallbackWorkspace;
  }

  if (workspaces.length === 0) {
    workspaces = [activeWorkspace];
  }

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="h-dvh min-h-dvh overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
        <AuthSessionGuard />
        <NotesDndProvider>
          <div className="flex h-dvh min-h-dvh min-w-0 flex-col overflow-hidden">
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
