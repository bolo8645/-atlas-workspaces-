"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { NavigationNodeOption } from "@/lib/navigation-queries";
import { normalizeNavigationSlug } from "@/lib/navigation-utils";

const RECENT_STORAGE_KEY = "ascu.recentNavigationNodes";
const MAX_RECENT_NODES = 5;

export type NavigationNodeSelection =
  | {
      type: "existing";
      navigationNodeId: string;
      label: string;
    }
  | {
      type: "none";
      label: string;
    }
  | {
      type: "create";
      title: string;
      parentId: string | null;
      label: string;
    };

export function NavigationNodeSelect({
  name = "navigationNodeId",
  options,
  defaultValue = "",
  value,
  selectedLabel,
  emptyLabel = "Unassigned",
  allowCreate = false,
  createParentId = null,
  createParentLabel,
  disabled = false,
  className,
  compact = false,
  onSelect
}: {
  name?: string;
  options: NavigationNodeOption[];
  defaultValue?: string | null;
  value?: string | null;
  selectedLabel?: string;
  emptyLabel?: string;
  allowCreate?: boolean;
  createParentId?: string | null;
  createParentLabel?: string;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
  onSelect?: (selection: NavigationNodeSelection) => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const isControlled = value !== undefined;
  const [internalSelectedId, setInternalSelectedId] = useState(defaultValue ?? "");
  const [createTitle, setCreateTitle] = useState("");
  const [query, setQuery] = useState("");
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const selectedId = isControlled ? value ?? "" : internalSelectedId;
  const optionById = useMemo(() => new Map(options.map((option) => [option.id, option])), [options]);
  const selectedOption = selectedId ? optionById.get(selectedId) : undefined;
  const displayLabel = selectedLabel ?? (selectedOption ? optionLabel(selectedOption) : createTitle ? `Create new: ${createTitle}` : emptyLabel);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? options.filter((option) => `${option.title} ${option.slug} ${option.fullPath}`.toLowerCase().includes(normalizedQuery))
    : options;
  const recentOptions = recentIds.map((id) => optionById.get(id)).filter((option): option is NavigationNodeOption => Boolean(option));
  const trimmedQuery = query.trim();
  const hasExactMatch = useMemo(() => {
    if (!trimmedQuery) return false;
    const querySlug = normalizeNavigationSlug(trimmedQuery);
    return options.some((option) => option.slug === querySlug || normalizeNavigationSlug(option.title) === querySlug || option.fullPath.toLowerCase() === trimmedQuery.toLowerCase());
  }, [options, trimmedQuery]);
  const canCreate = allowCreate && trimmedQuery.length > 0 && !hasExactMatch;

  useEffect(() => {
    setRecentIds(readRecentNodeIds());
  }, []);

  useEffect(() => {
    if (!isControlled) setInternalSelectedId(defaultValue ?? "");
  }, [defaultValue, isControlled]);

  function chooseNode(nextId: string) {
    if (!isControlled) setInternalSelectedId(nextId);
    setCreateTitle("");
    if (nextId) {
      const nextRecentIds = [nextId, ...recentIds.filter((id) => id !== nextId)].slice(0, MAX_RECENT_NODES);
      setRecentIds(nextRecentIds);
      writeRecentNodeIds(nextRecentIds);
    }

    const option = nextId ? optionById.get(nextId) : undefined;
    onSelect?.(
      nextId && option
        ? {
            type: "existing",
            navigationNodeId: nextId,
            label: option.fullPath
          }
        : {
            type: "none",
            label: emptyLabel
          }
    );
    setQuery("");
    detailsRef.current?.removeAttribute("open");
  }

  function chooseCreate() {
    if (!canCreate) return;
    const title = trimmedQuery;
    if (!isControlled) setInternalSelectedId("");
    setCreateTitle(title);
    onSelect?.({
      type: "create",
      title,
      parentId: createParentId,
      label: `Create new: ${title}`
    });
    setQuery("");
    detailsRef.current?.removeAttribute("open");
  }

  return (
    <div className={className}>
      <input type="hidden" name={name} value={selectedId} />
      {createTitle ? <input type="hidden" name="createNavigationNodeTitle" value={createTitle} /> : null}
      {createTitle && createParentId ? <input type="hidden" name="createParentId" value={createParentId} /> : null}
      <details ref={detailsRef} className="relative">
        <summary className={`flex list-none items-center justify-start gap-2 rounded border border-white/[0.12] bg-black/30 outline-none transition ${compact ? "h-8 max-w-full px-2 text-xs text-stone-400" : "h-10 justify-between gap-3 px-3 text-sm text-stone-200"} ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-white/10"}`}>
          <span className={`min-w-0 overflow-hidden truncate whitespace-nowrap ${compact ? "max-w-[min(34rem,60vw)]" : ""}`}>{displayLabel}</span>
          <span className={`shrink-0 ${compact ? "text-stone-500" : "text-stone-500"}`}>{disabled ? "Saving" : "Change"}</span>
        </summary>
        <div className={`absolute z-40 mt-2 min-w-[18rem] rounded border border-white/10 bg-[#101010] p-3 shadow-2xl shadow-black/40 ${compact ? "w-80" : "w-full"}`}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canCreate) {
                event.preventDefault();
                chooseCreate();
              }
            }}
            disabled={disabled}
            placeholder={allowCreate ? "Search or create node" : "Search nodes"}
            className="h-9 w-full rounded border border-white/[0.12] bg-black/40 px-3 text-sm text-white outline-none focus:border-[var(--signal)]"
          />

          <div className="mt-3 max-h-72 overflow-auto">
            <NodeChoice disabled={disabled} isSelected={!selectedId && !createTitle} label={emptyLabel} meta="No navigation node" onChoose={() => chooseNode("")} />

            {canCreate ? (
              <section className="mt-3 border-t border-white/10 pt-3">
                <NodeChoice disabled={disabled} isSelected={false} label={`Create new: ${trimmedQuery}`} meta={createParentLabel ? `Under ${createParentLabel}` : "At root"} onChoose={chooseCreate} />
              </section>
            ) : null}

            {recentOptions.length > 0 ? (
              <section className="mt-3 border-t border-white/10 pt-3">
                <p className="mb-1 text-xs uppercase tracking-[0.16em] text-stone-500">Recently Used</p>
                {recentOptions.map((option) => (
                  <NodeChoice disabled={disabled} key={`recent-${option.id}`} isSelected={selectedId === option.id} label={optionLabel(option)} meta={option.fullPath} onChoose={() => chooseNode(option.id)} />
                ))}
              </section>
            ) : null}

            <section className="mt-3 border-t border-white/10 pt-3">
              <p className="mb-1 text-xs uppercase tracking-[0.16em] text-stone-500">All Nodes</p>
              {filteredOptions.map((option) => (
                <NodeChoice disabled={disabled} key={option.id} isSelected={selectedId === option.id} label={optionLabel(option)} meta={option.fullPath} onChoose={() => chooseNode(option.id)} />
              ))}
              {filteredOptions.length === 0 ? <p className="px-2 py-3 text-sm text-stone-500">No nodes match this search.</p> : null}
            </section>
          </div>
        </div>
      </details>
    </div>
  );
}

function NodeChoice({ label, meta, isSelected, disabled = false, onChoose }: { label: string; meta: string; isSelected: boolean; disabled?: boolean; onChoose: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onChoose} className={`block w-full rounded px-2 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${isSelected ? "bg-[var(--signal)]/15 text-white" : "text-stone-300 hover:bg-white/10 hover:text-white"}`}>
      <span className="block truncate text-sm font-bold">{label}</span>
      <span className="block truncate text-xs text-stone-500">{meta}</span>
    </button>
  );
}

function optionLabel(option: NavigationNodeOption) {
  return `${"  ".repeat(option.depth)}${option.title}`;
}

function readRecentNodeIds() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string").slice(0, MAX_RECENT_NODES) : [];
  } catch {
    return [];
  }
}

function writeRecentNodeIds(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_RECENT_NODES)));
}
