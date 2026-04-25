"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useEffect, useState } from "react";

type ResizableAppShellProps = {
  sidebar: ReactNode;
  children: ReactNode;
};

const SIDEBAR_WIDTH_KEY = "ascu.sidebarWidth";
const LEFT_FOLDERS_OPEN_KEY = "ascu.leftFoldersOpen";
const LEFT_NOTES_OPEN_KEY = "ascu.leftNotesOpen";
const LEFT_PANEL_EVENT = "atlas:left-panel";
const DEFAULT_SIDEBAR_WIDTH = 260;
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 340;
const RAIL_WIDTH = 48;
const RAIL_BUTTON_HEIGHT = 176;

export function ResizableAppShell({ sidebar, children }: ResizableAppShellProps) {
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [leftFoldersOpen, setLeftFoldersOpen] = useState(true);
  const [leftNotesOpen, setLeftNotesOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(SIDEBAR_WIDTH_KEY));
    if (Number.isFinite(stored) && stored >= MIN_SIDEBAR_WIDTH) setSidebarWidth(Math.min(MAX_SIDEBAR_WIDTH, stored));
  }, []);

  useEffect(() => {
    setLeftFoldersOpen(window.localStorage.getItem(LEFT_FOLDERS_OPEN_KEY) !== "false");
    setLeftNotesOpen(window.localStorage.getItem(LEFT_NOTES_OPEN_KEY) !== "false");
  }, []);

  useEffect(() => {
    function handleStorageChange(event: StorageEvent) {
      if (event.key === LEFT_FOLDERS_OPEN_KEY) {
        setLeftFoldersOpen(event.newValue !== "false");
      }
      if (event.key === LEFT_NOTES_OPEN_KEY) {
        setLeftNotesOpen(event.newValue !== "false");
      }
    }

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  useEffect(() => {
    function syncPanelState() {
      setLeftFoldersOpen(window.localStorage.getItem(LEFT_FOLDERS_OPEN_KEY) !== "false");
      setLeftNotesOpen(window.localStorage.getItem(LEFT_NOTES_OPEN_KEY) !== "false");
    }

    window.addEventListener(LEFT_PANEL_EVENT, syncPanelState);
    return () => window.removeEventListener(LEFT_PANEL_EVENT, syncPanelState);
  }, []);

  function setPanelState(key: string, value: boolean) {
    window.localStorage.setItem(key, value ? "true" : "false");
    window.dispatchEvent(new Event(LEFT_PANEL_EVENT));
  }

  function toggleFoldersPanel() {
    const next = !leftFoldersOpen;
    setLeftFoldersOpen(next);
    setPanelState(LEFT_FOLDERS_OPEN_KEY, next);
  }

  function toggleNotesPanel() {
    const next = !leftNotesOpen;
    setLeftNotesOpen(next);
    setPanelState(LEFT_NOTES_OPEN_KEY, next);
  }

  function beginResize(startEvent: ReactPointerEvent<HTMLDivElement>) {
    if (!leftFoldersOpen) return;
    startEvent.preventDefault();
    const startX = startEvent.clientX;
    const startWidth = sidebarWidth;

    function handleMove(moveEvent: PointerEvent) {
      const nextWidth = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, startWidth + moveEvent.clientX - startX));
      setSidebarWidth(nextWidth);
    }

    function handleUp() {
      window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    function syncSidebarState() {
      if (window.innerWidth >= 1024) setMobileSidebarOpen(false);
    }

    syncSidebarState();
    window.addEventListener("resize", syncSidebarState);
    return () => window.removeEventListener("resize", syncSidebarState);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      <div className="hidden shrink-0 lg:block" style={{ width: RAIL_WIDTH }} aria-hidden="true" />
      <div
        className={`relative z-10 hidden h-full min-h-0 shrink-0 overflow-hidden transition-all duration-200 ease-out lg:block ${leftFoldersOpen ? "border-r border-white/10 opacity-100" : "pointer-events-none opacity-0"}`}
        style={{
          width: leftFoldersOpen ? `${sidebarWidth}px` : "0px",
          minWidth: leftFoldersOpen ? `${MIN_SIDEBAR_WIDTH}px` : "0px",
          maxWidth: leftFoldersOpen ? `${MAX_SIDEBAR_WIDTH}px` : "0px",
          transform: leftFoldersOpen ? "translateX(0)" : "translateX(-12px)"
        }}
      >
        <div className="h-full min-h-0 overflow-hidden">{sidebar}</div>
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize folders"
        onPointerDown={beginResize}
        className={`hidden w-1 shrink-0 cursor-col-resize bg-white/5 transition hover:bg-[var(--signal)]/40 ${leftFoldersOpen ? "lg:block" : "lg:hidden"}`}
      />
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden" style={{ "--sidebar-width": `${leftFoldersOpen ? sidebarWidth : 0}px` } as CSSProperties}>
        <div className="border-b border-white/10 bg-black/35 px-3 py-2 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="inline-flex h-9 items-center rounded border border-white/10 px-3 text-xs font-bold uppercase tracking-[0.18em] text-stone-200 transition hover:bg-white/10 hover:text-white"
          >
            Folders
          </button>
        </div>
        {children}
      </div>
      <div className="pointer-events-none fixed bottom-0 left-0 top-16 z-40 hidden lg:flex" style={{ width: RAIL_WIDTH }}>
        <div className="flex h-full w-full flex-col gap-2 border-r border-white/10 bg-zinc-950/95 pt-4 shadow-[4px_0_18px_rgba(0,0,0,0.28)] backdrop-blur">
          <button
            type="button"
            onClick={toggleFoldersPanel}
            className={`pointer-events-auto flex w-full items-center justify-center rounded-r-md border-r border-y border-white/10 text-[0.72rem] font-bold uppercase tracking-[0.22em] transition [writing-mode:vertical-rl] rotate-180 ${leftFoldersOpen ? "bg-[var(--signal)]/12 text-white" : "text-stone-300 hover:bg-white/10 hover:text-white"}`}
            aria-label="Toggle folders panel"
            title="Toggle folders panel"
            style={{ height: RAIL_BUTTON_HEIGHT }}
          >
            Folders
          </button>
          <button
            type="button"
            onClick={toggleNotesPanel}
            className={`pointer-events-auto flex w-full items-center justify-center rounded-r-md border-r border-y border-white/10 text-[0.72rem] font-bold uppercase tracking-[0.22em] transition [writing-mode:vertical-rl] rotate-180 ${leftNotesOpen ? "bg-[var(--signal)]/12 text-white" : "text-stone-300 hover:bg-white/10 hover:text-white"}`}
            aria-label="Toggle notes panel"
            title="Toggle notes panel"
            style={{ height: RAIL_BUTTON_HEIGHT }}
          >
            Notes
          </button>
        </div>
      </div>
      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-50 bg-black/70 lg:hidden" onClick={() => setMobileSidebarOpen(false)}>
          <div className="h-full w-[min(22rem,86vw)] border-r border-white/10 bg-[#090909]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-400">Folders</p>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="h-8 rounded border border-white/10 px-3 text-xs font-bold text-stone-300 transition hover:bg-white/10 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="h-[calc(100dvh-3.5rem)] overflow-auto">{sidebar}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
