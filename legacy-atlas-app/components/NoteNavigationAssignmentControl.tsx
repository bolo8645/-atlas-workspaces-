"use client";

import { useEffect, useMemo, useState } from "react";
import { NavigationNodeSelect, type NavigationNodeSelection } from "@/components/NavigationNodeSelect";
import type { NavigationNodeOption } from "@/lib/navigation-queries";
import { assignNoteNavigationNodeAction } from "@/lib/notes/actions";
import type { NavigationAssignmentTarget } from "@/lib/notes/mutations";

type NoteNavigationAssignmentControlProps = {
  noteId: string;
  options: NavigationNodeOption[];
  defaultValue?: string | null;
  defaultLabel?: string;
  createParentId?: string | null;
  emptyLabel?: string;
  className?: string;
  compact?: boolean;
  onAssignmentChange?: (assignment: { id: string | null; label: string }) => void;
};

export function NoteNavigationAssignmentControl({
  noteId,
  options: initialOptions,
  defaultValue = "",
  defaultLabel,
  createParentId = null,
  emptyLabel = "Unassigned",
  className,
  compact = false,
  onAssignmentChange
}: NoteNavigationAssignmentControlProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [localOptions, setLocalOptions] = useState<NavigationNodeOption[]>([]);
  const [selectedId, setSelectedId] = useState(defaultValue ?? "");
  const [selectedLabel, setSelectedLabel] = useState(defaultLabel ?? emptyLabel);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(() => {
    const merged = new Map<string, NavigationNodeOption>();
    for (const option of initialOptions) merged.set(option.id, option);
    for (const option of localOptions) merged.set(option.id, option);
    return [...merged.values()];
  }, [initialOptions, localOptions]);
  const createParent = createParentId ? options.find((option) => option.id === createParentId) : undefined;
  const disabled = isSaving;

  useEffect(() => {
    setSelectedId(defaultValue ?? "");
    setSelectedLabel(defaultLabel ?? emptyLabel);
  }, [defaultLabel, defaultValue, emptyLabel]);

  async function handleSelect(selection: NavigationNodeSelection) {
    if (disabled) return;

    const previousId = selectedId;
    const previousLabel = selectedLabel;
    setError(null);

    if (selection.type === "none") {
      setSelectedId("");
      setSelectedLabel(emptyLabel);
    } else if (selection.type === "existing") {
      setSelectedId(selection.navigationNodeId);
      setSelectedLabel(selection.label);
    } else {
      setSelectedId("");
      setSelectedLabel(`Creating: ${selection.title}`);
    }

    setIsSaving(true);
    try {
      const target = await assignNoteNavigationNodeAction({
        noteId,
        navigationNodeId: selection.type === "existing" ? selection.navigationNodeId : null,
        createNavigationNodeTitle: selection.type === "create" ? selection.title : null,
        createParentId: selection.type === "create" ? selection.parentId : null
      });

      if (target) {
        const option = optionFromTarget(target, options);
        setLocalOptions((current) => [...current.filter((item) => item.id !== option.id), option]);
        setSelectedId(target.id);
        setSelectedLabel(target.fullPath);
        onAssignmentChange?.({ id: target.id, label: target.fullPath });
      } else {
        setSelectedId("");
        setSelectedLabel(emptyLabel);
        onAssignmentChange?.({ id: null, label: emptyLabel });
      }
    } catch (caught) {
      setSelectedId(previousId);
      setSelectedLabel(previousLabel);
      setError(caught instanceof Error ? caught.message : "Assignment failed.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={className}>
      <NavigationNodeSelect
        options={options}
        value={selectedId}
        selectedLabel={selectedLabel}
        emptyLabel={emptyLabel}
        allowCreate
        createParentId={createParentId}
        createParentLabel={createParent?.fullPath}
        disabled={disabled}
        compact={compact}
        onSelect={handleSelect}
      />
      {compact && !error && !disabled ? null : <p className={`mt-1 text-xs ${error ? "text-red-300" : "text-stone-500"}`}>{error ?? (disabled ? "Saving assignment..." : `Current: ${selectedLabel}`)}</p>}
    </div>
  );
}

function optionFromTarget(target: NavigationAssignmentTarget, options: NavigationNodeOption[]): NavigationNodeOption {
  const parent = target.parentId ? options.find((option) => option.id === target.parentId) : undefined;

  return {
    id: target.id,
    parentId: target.parentId,
    title: target.title,
    slug: target.slug,
    fullPath: target.fullPath,
    depth: parent ? parent.depth + 1 : 0,
    directNoteCount: 1,
    descendantNoteCount: 1
  };
}
