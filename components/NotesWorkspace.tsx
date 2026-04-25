"use client";

import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties, FormEvent as ReactFormEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode, TouchEvent as ReactTouchEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { NoteNavigationAssignmentControl } from "@/components/NoteNavigationAssignmentControl";
import { NOTES_DND_END_EVENT, type NotesDndEndDetail } from "@/components/NotesDndProvider";
import { RichTextEditor, type EditorRelationshipSuggestion, type RichTextEditorActions } from "@/components/RichTextEditor";
import { attachNoteEntityAction, createEntityAction, findEntityByNameAction, linkTextSelectionToEntityAction, mergeEntityAction, removeNoteEntityLinkAction, updateEntityAction } from "@/lib/entity-actions";
import type { NavigationNodeOption } from "@/lib/navigation-queries";
import { createEditorNoteAction, deleteEditorNoteAction, duplicateEditorNoteAction, lockNoteAction, moveNoteToNavigationNodeAction, reorderNotesAction, toggleNotePinnedAction, unlockNoteAction, updateEditorNoteAction, updateNoteTagsAction, verifyNotePasscodeAction } from "@/lib/notes/actions";
import { formatDateTime } from "@/lib/notes/display";
import type { InterconnectedRelationship } from "@/lib/notes/workspace-queries";
import { createRelationshipAction, createRelationshipTypeAction, deleteRelationshipAction, updateRelationshipAction } from "@/lib/relationship-actions";
import type { EntityIndexEntry, RelationshipTypeOption } from "@/lib/relationships";

type LinkedEntitySummary = {
  id: string;
  name: string;
  type: string;
  aliases: string[];
} | null;

type EntityOption = {
  id: string;
  name: string;
  type: string;
  noteId: string | null;
};

type EntityRecord = EntityOption & {
  aliases: string[];
  description?: string | null;
};

export type WorkspaceNoteListItem = {
  id: string;
  title: string;
  content: string;
  preview: string;
  updatedAt: string;
  navigationNodeId: string | null;
  navigationLabel: string;
  sortOrder: number;
  isPinned: boolean;
  manualTags: string[];
  isLocked: boolean;
  lockedAt: string | null;
  lockedBy: string | null;
  noteType: string;
  entity: LinkedEntitySummary;
  interconnections: InterconnectedRelationship[];
};

export type WorkspaceSelectedNote = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
  navigationNodeId: string | null;
  navigationLabel: string;
  sortOrder: number;
  isPinned: boolean;
  manualTags: string[];
  isLocked: boolean;
  lockedAt: string | null;
  lockedBy: string | null;
  noteType: string;
  entity: LinkedEntitySummary;
  interconnections: InterconnectedRelationship[];
};

type NotesWorkspaceProps = {
  nodeId?: string;
  notes: WorkspaceNoteListItem[];
  searchNotes: WorkspaceNoteListItem[];
  selectedNote: WorkspaceSelectedNote | null;
  navigationOptions: NavigationNodeOption[];
  entityIndex: EntityIndexEntry[];
  entityOptions: EntityOption[];
  relationshipTypes: RelationshipTypeOption[];
  createParentId?: string | null;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const LEFT_PANEL_WIDTH_KEY = "ascu.leftPanelWidth";
const NOTE_COLORS_STORAGE_KEY = "ascu.noteColors";
const LEFT_NOTES_OPEN_KEY = "ascu.leftNotesOpen";
const RIGHT_ENTITY_OPEN_KEY = "ascu.rightEntityOpen";
const RIGHT_INTERCON_OPEN_KEY = "ascu.rightInterconOpen";
const LEFT_PANEL_EVENT = "atlas:left-panel";
const DEFAULT_LEFT_PANEL_WIDTH = 280;
const PANEL_MIN = 220;
const PANEL_MAX = 340;
const RIGHT_PANEL_WIDTH_KEY = "ascu.rightPanelWidth";
const DEFAULT_RIGHT_PANEL_WIDTH = 240;
const MIN_RIGHT_PANEL_WIDTH = 220;
const MAX_RIGHT_PANEL_WIDTH = 260;
const UNLOCKED_NOTES_SESSION_KEY = "atlas.unlockedNotes";
const RIGHT_RAIL_WIDTH = 44;
const RAIL_BUTTON_HEIGHT = 176;
const NOTE_TYPES = ["draft", "character", "location", "organization", "story"] as const;
const NOTE_COLORS = [
  { id: "teal", label: "Teal", value: "#2dd4bf" },
  { id: "gold", label: "Gold", value: "#f1c75b" },
  { id: "red", label: "Red", value: "#f87171" },
  { id: "green", label: "Green", value: "#86efac" },
  { id: "blue", label: "Blue", value: "#93c5fd" },
  { id: "none", label: "No color", value: "" }
] as const;
type NoteContextMenuState = {
  note: WorkspaceNoteListItem;
  x: number;
  y: number;
} | null;

type NoteTagsDialogState = {
  noteId: string;
  title: string;
  tags: string[];
} | null;

type NoteLockDialogState = {
  mode: "set" | "remove" | "unlock";
  noteId: string;
  title: string;
} | null;

type RelationshipPopoverState = {
  suggestion: EditorRelationshipSuggestion;
  type: string;
  description: string;
} | null;

type ConnectionModalState = {
  mode: "quick" | "manual";
  targetEntityId?: string;
  title: string;
} | null;

type EntityModalState = {
  mode: "create" | "attach" | "repair" | "merge" | "create-from-selection" | "link-selection";
  selectedText?: string;
} | null;

type SelectionMenuState = {
  text: string;
  x: number;
  y: number;
} | null;

const ENTITY_TYPES = ["character", "organization", "location", "story", "technology", "concept", "other"] as const;

export function NotesWorkspace({ nodeId, notes, searchNotes, selectedNote, navigationOptions, entityIndex, entityOptions, relationshipTypes, createParentId = null }: NotesWorkspaceProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [localNotes, setLocalNotes] = useState(notes);
  const [localSearchNotes, setLocalSearchNotes] = useState(searchNotes);
  const [searchQuery, setSearchQuery] = useState("");
  const [leftNotesOpen, setLeftNotesOpen] = useState(true);
  const [leftPanelWidth, setLeftPanelWidth] = useState(DEFAULT_LEFT_PANEL_WIDTH);
  const [rightPanelWidth, setRightPanelWidth] = useState(DEFAULT_RIGHT_PANEL_WIDTH);
  const [rightEntityOpen, setRightEntityOpen] = useState(true);
  const [rightInterconOpen, setRightInterconOpen] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"notes" | "editor">(selectedNote ? "editor" : "notes");
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editorFindOpen, setEditorFindOpen] = useState(false);
  const [editorReplaceOpen, setEditorReplaceOpen] = useState(false);
  const [editorFindQuery, setEditorFindQuery] = useState("");
  const [editorReplacement, setEditorReplacement] = useState("");
  const [editorActions, setEditorActions] = useState<RichTextEditorActions | null>(null);
  const [editorControlsOpen, setEditorControlsOpen] = useState(false);
  const [entityLinkMenuOpen, setEntityLinkMenuOpen] = useState(false);
  const [relationshipSuggestions, setRelationshipSuggestions] = useState<EditorRelationshipSuggestion[]>([]);
  const [relationshipPopover, setRelationshipPopover] = useState<RelationshipPopoverState>(null);
  const [localRelationshipTypes, setLocalRelationshipTypes] = useState(relationshipTypes);
  const [localEntityIndex, setLocalEntityIndex] = useState(entityIndex);
  const [connectionModal, setConnectionModal] = useState<ConnectionModalState>(null);
  const [entityModal, setEntityModal] = useState<EntityModalState>(null);
  const [selectionMenu, setSelectionMenu] = useState<SelectionMenuState>(null);
  const [noteContextMenu, setNoteContextMenu] = useState<NoteContextMenuState>(null);
  const [noteTagsDialog, setNoteTagsDialog] = useState<NoteTagsDialogState>(null);
  const [noteLockDialog, setNoteLockDialog] = useState<NoteLockDialogState>(null);
  const [keyboardNoteId, setKeyboardNoteId] = useState<string | null>(selectedNote?.id ?? null);
  const [noteColors, setNoteColors] = useState<Record<string, string>>({});
  const [noteColorsLoaded, setNoteColorsLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sessionUnlockedNoteIds, setSessionUnlockedNoteIds] = useState<string[]>([]);
  const [activeNote, setActiveNote] = useState<WorkspaceSelectedNote | null>(selectedNote);
  const [title, setTitle] = useState(selectedNote?.title ?? "");
  const [content, setContent] = useState(selectedNote?.content ?? "");
  const [noteType, setNoteType] = useState(selectedNote?.noteType ?? "draft");
  const [linkedEntity, setLinkedEntity] = useState<LinkedEntitySummary>(selectedNote?.entity ?? null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [folderAssignment, setFolderAssignment] = useState({
    id: selectedNote?.navigationNodeId ?? null,
    label: selectedNote?.navigationLabel ?? "Unassigned"
  });
  const baselineRef = useRef({ noteId: selectedNote?.id ?? null, title: selectedNote?.title ?? "", content: selectedNote?.content ?? "" });
  const focusNoteIdRef = useRef<string | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const latestEditorRef = useRef({ title: selectedNote?.title ?? "", content: selectedNote?.content ?? "" });
  const trimmedSearchQuery = searchQuery.trim();
  const isSearching = trimmedSearchQuery.length > 0;
  const displayNotes = useMemo(() => {
    if (!isSearching) return localNotes;
    return sortWorkspaceNotes(localSearchNotes.filter((note) => noteMatchesSearch(note, trimmedSearchQuery)));
  }, [isSearching, localNotes, localSearchNotes, trimmedSearchQuery]);
  const visibleNoteIds = useMemo(() => displayNotes.map((note) => `note:${note.id}`), [displayNotes]);
  const optionById = useMemo(() => new Map(navigationOptions.map((option) => [option.id, option])), [navigationOptions]);

  const folderLabel = useMemo(() => {
    if (!nodeId) return "All notes";
    if (nodeId === "unassigned") return "Unassigned";
    return selectedNote?.navigationLabel || localNotes.find((note) => note.navigationNodeId === nodeId)?.navigationLabel || "Selected folder";
  }, [nodeId, localNotes, selectedNote]);

  const selectedNoteId = activeNote?.id ?? null;
  const focusedNoteId = keyboardNoteId ?? selectedNoteId;
  const activeNoteRequiresUnlock = Boolean(activeNote?.isLocked && !sessionUnlockedNoteIds.includes(activeNote.id));
  const editorMatchCount = useMemo(() => countTextMatches(stripHtml(content), editorFindQuery), [content, editorFindQuery]);
  const entityRecords = useMemo(() => buildEntityRecords(entityOptions, localEntityIndex), [entityOptions, localEntityIndex]);

  useEffect(() => {
    setMounted(true);
    setLeftNotesOpen(window.localStorage.getItem(LEFT_NOTES_OPEN_KEY) !== "false");
    setRightEntityOpen(window.localStorage.getItem(RIGHT_ENTITY_OPEN_KEY) !== "false");
    setRightInterconOpen(window.localStorage.getItem(RIGHT_INTERCON_OPEN_KEY) === "true");
  }, []);

  useEffect(() => {
    function syncLeftPanelState() {
      setLeftNotesOpen(window.localStorage.getItem(LEFT_NOTES_OPEN_KEY) !== "false");
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === LEFT_NOTES_OPEN_KEY) syncLeftPanelState();
    }

    window.addEventListener(LEFT_PANEL_EVENT, syncLeftPanelState);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(LEFT_PANEL_EVENT, syncLeftPanelState);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const syncLayout = () => setIsMobileLayout(mediaQuery.matches);
    syncLayout();
    mediaQuery.addEventListener("change", syncLayout);
    return () => mediaQuery.removeEventListener("change", syncLayout);
  }, []);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(LEFT_PANEL_WIDTH_KEY));
    if (Number.isFinite(stored) && stored >= PANEL_MIN) setLeftPanelWidth(Math.min(PANEL_MAX, stored));
  }, []);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(RIGHT_PANEL_WIDTH_KEY));
    if (Number.isFinite(stored) && stored >= MIN_RIGHT_PANEL_WIDTH) setRightPanelWidth(Math.min(MAX_RIGHT_PANEL_WIDTH, stored));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LEFT_PANEL_WIDTH_KEY, String(leftPanelWidth));
  }, [leftPanelWidth]);

  useEffect(() => {
    window.localStorage.setItem(RIGHT_PANEL_WIDTH_KEY, String(rightPanelWidth));
  }, [rightPanelWidth]);

  useEffect(() => {
    window.localStorage.setItem(RIGHT_ENTITY_OPEN_KEY, rightEntityOpen ? "true" : "false");
  }, [rightEntityOpen]);

  useEffect(() => {
    window.localStorage.setItem(RIGHT_INTERCON_OPEN_KEY, rightInterconOpen ? "true" : "false");
  }, [rightInterconOpen]);

  useEffect(() => {
    setNoteColors(readStoredNoteColors());
    setNoteColorsLoaded(true);
  }, []);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(UNLOCKED_NOTES_SESSION_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setSessionUnlockedNoteIds(parsed.filter((value): value is string => typeof value === "string"));
    } catch {
      setSessionUnlockedNoteIds([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(UNLOCKED_NOTES_SESSION_KEY, JSON.stringify(sessionUnlockedNoteIds));
    } catch {}
  }, [sessionUnlockedNoteIds]);

  useEffect(() => {
    if (!noteColorsLoaded) return;
    window.localStorage.setItem(NOTE_COLORS_STORAGE_KEY, JSON.stringify(noteColors));
  }, [noteColors, noteColorsLoaded]);

  useEffect(() => {
    setLocalNotes(sortWorkspaceNotes(notes));
  }, [notes]);

  useEffect(() => {
    setLocalSearchNotes(sortWorkspaceNotes(searchNotes));
  }, [searchNotes]);

  useEffect(() => {
    setLocalRelationshipTypes(relationshipTypes);
  }, [relationshipTypes]);

  useEffect(() => {
    setLocalEntityIndex(entityIndex);
  }, [entityIndex]);

  useEffect(() => {
    const nextTitle = selectedNote?.title ?? "";
    const nextContent = selectedNote?.content ?? "";
    setActiveNote(selectedNote);
    setTitle(nextTitle);
    setContent(nextContent);
    setNoteType(selectedNote?.noteType ?? "draft");
    setLinkedEntity(selectedNote?.entity ?? null);
    setRelationshipSuggestions([]);
    setRelationshipPopover(null);
    setEditorControlsOpen(false);
    setEntityLinkMenuOpen(false);
    latestEditorRef.current = {
      title: nextTitle,
      content: nextContent
    };
    setSaveState("idle");
    setSaveError(null);
    baselineRef.current = {
      noteId: selectedNote?.id ?? null,
      title: nextTitle,
      content: nextContent
    };
    setFolderAssignment({
      id: selectedNote?.navigationNodeId ?? null,
      label: selectedNote?.navigationLabel ?? "Unassigned"
    });
    if (selectedNote?.id) setKeyboardNoteId(selectedNote.id);

    if (selectedNote?.id && focusNoteIdRef.current === selectedNote.id) {
      focusNoteIdRef.current = null;
      window.setTimeout(() => {
        titleRef.current?.focus();
        titleRef.current?.select();
      }, 0);
    }
  }, [selectedNote?.id, selectedNote?.title, selectedNote?.content, selectedNote?.navigationLabel, selectedNote?.navigationNodeId, selectedNote?.noteType, selectedNote?.entity]);

  useEffect(() => {
    if (!isMobileLayout) return;
    setMobilePanel(activeNote ? "editor" : "notes");
  }, [activeNote, isMobileLayout]);

  useEffect(() => {
    latestEditorRef.current = {
      title,
      content
    };
  }, [content, title]);

  useEffect(() => {
    if (!activeNote) return;
    const updatedAt = new Date().toISOString();
    updateNoteCollections((note) =>
      note.id === activeNote.id
        ? {
            ...note,
            title: title.trim() || "Untitled Note",
            content,
            noteType,
            entity: linkedEntity,
            preview: firstLine(content) || "No content yet.",
            updatedAt
          }
        : note
    );
    setActiveNote((current) =>
      current?.id === activeNote.id
        ? {
            ...current,
            title: title.trim() || "Untitled Note",
            content,
            noteType,
            entity: linkedEntity,
            updatedAt
          }
        : current
    );
  }, [activeNote?.id, content, linkedEntity, noteType, title]);

  useEffect(() => {
    if (!activeNote || isTemporaryNoteId(activeNote.id)) return;
    const baseline = baselineRef.current;
    const hasChanges = baseline.noteId === activeNote.id && (baseline.title !== title || baseline.content !== content);
    if (!hasChanges) return;

    setSaveState("saving");
    setSaveError(null);
    const timeout = window.setTimeout(async () => {
      try {
        await updateEditorNoteAction({
          noteId: activeNote.id,
          title,
          content
        });
        baselineRef.current = {
          noteId: activeNote.id,
          title,
          content
        };
        setSaveState("saved");
      } catch (caught) {
        setSaveState("error");
        setSaveError(caught instanceof Error ? caught.message : "Autosave failed.");
      }
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [activeNote, content, title]);

  useEffect(() => {
    async function handleDndEnd(event: Event) {
      const detail = (event as CustomEvent<NotesDndEndDetail>).detail;
      if (!detail?.activeId?.startsWith("note:") || !detail.overId || detail.activeId === detail.overId) return;

      const noteId = detail.activeId.replace("note:", "");
      if (detail.overId.startsWith("folder:")) {
        await moveNoteToFolder(noteId, detail.overId.replace("folder:", ""));
        return;
      }

      if (detail.overId.startsWith("note:")) {
        await reorderNote(noteId, detail.overId.replace("note:", ""));
      }
    }

    window.addEventListener(NOTES_DND_END_EVENT, handleDndEnd);
    return () => window.removeEventListener(NOTES_DND_END_EVENT, handleDndEnd);
  }, [localNotes, optionById]);

  useEffect(() => {
    if (displayNotes.length === 0) {
      setKeyboardNoteId(null);
      return;
    }
    if (keyboardNoteId && displayNotes.some((note) => note.id === keyboardNoteId)) return;
    if (selectedNoteId && displayNotes.some((note) => note.id === selectedNoteId)) {
      setKeyboardNoteId(selectedNoteId);
      return;
    }
    setKeyboardNoteId(displayNotes[0]?.id ?? null);
  }, [displayNotes, keyboardNoteId, selectedNoteId]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const usesCommandKey = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (usesCommandKey && key === "n") {
        event.preventDefault();
        void createNote();
        return;
      }

      if (usesCommandKey && key === "f" && activeNote) {
        event.preventDefault();
        setEditorControlsOpen(true);
        setEditorFindOpen(true);
        setEditorReplaceOpen(event.shiftKey);
        return;
      }

      if (usesCommandKey && (event.key === "Backspace" || event.key === "Delete")) {
        const targetNote = findWorkspaceNoteById(keyboardNoteId, localNotes, localSearchNotes) ?? activeNote;
        if (!targetNote) return;
        event.preventDefault();
        void deleteNoteById(targetNote);
        return;
      }

      if (isEditableTarget(event.target)) return;

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (displayNotes.length === 0) return;
        event.preventDefault();
        const currentIndex = Math.max(0, displayNotes.findIndex((note) => note.id === (keyboardNoteId ?? selectedNoteId)));
        const direction = event.key === "ArrowDown" ? 1 : -1;
        const nextIndex = Math.min(displayNotes.length - 1, Math.max(0, currentIndex + direction));
        setKeyboardNoteId(displayNotes[nextIndex]?.id ?? null);
        return;
      }

      if (event.key === "Enter" && keyboardNoteId && editingTitleId !== keyboardNoteId) {
        const targetNote = displayNotes.find((note) => note.id === keyboardNoteId);
        if (!targetNote) return;
        event.preventDefault();
        openNote(targetNote);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeNote, displayNotes, editingTitleId, keyboardNoteId, localNotes, localSearchNotes, selectedNoteId]);

  useEffect(() => {
    function closeContextMenu() {
      setNoteContextMenu(null);
    }

    window.addEventListener("click", closeContextMenu);
    window.addEventListener("scroll", closeContextMenu, true);
    return () => {
      window.removeEventListener("click", closeContextMenu);
      window.removeEventListener("scroll", closeContextMenu, true);
    };
  }, []);

  useEffect(() => {
    function closeSelectionMenu() {
      setSelectionMenu(null);
    }

    window.addEventListener("click", closeSelectionMenu);
    window.addEventListener("scroll", closeSelectionMenu, true);
    return () => {
      window.removeEventListener("click", closeSelectionMenu);
      window.removeEventListener("scroll", closeSelectionMenu, true);
    };
  }, []);

  function showNoteContextMenu(note: WorkspaceNoteListItem, x: number, y: number) {
    setKeyboardNoteId(note.id);
    setNoteContextMenu({
      note,
      x: clampContextMenuX(x),
      y: clampContextMenuY(y)
    });
  }

  async function createNote(input: { title?: string; content?: string; noteType?: string } = {}) {
    if (isCreating) return;
    const nextTitle = input.title?.trim() || "Untitled";
    const nextContent = input.content ?? "";
    const nextType = input.noteType ?? "draft";
    const navigationNodeId = nodeId && nodeId !== "unassigned" ? nodeId : null;
    const navigationLabel = navigationNodeId ? optionById.get(navigationNodeId)?.fullPath ?? folderLabel : "Unassigned";
    const tempId = `temp:${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const optimisticNote: WorkspaceNoteListItem = {
      id: tempId,
      title: nextTitle,
      content: nextContent,
      preview: firstLine(nextContent) || "No content yet.",
      updatedAt: now,
      navigationNodeId,
      navigationLabel,
      sortOrder: nextSortOrder(localNotes, navigationNodeId),
      isPinned: false,
      manualTags: [],
      isLocked: false,
      lockedAt: null,
      lockedBy: null,
      noteType: nextType,
      entity: null,
      interconnections: []
    };
    const optimisticSelectedNote: WorkspaceSelectedNote = {
      id: tempId,
      title: nextTitle,
      content: nextContent,
      updatedAt: now,
      navigationNodeId,
      navigationLabel,
      sortOrder: optimisticNote.sortOrder,
      isPinned: false,
      manualTags: [],
      isLocked: false,
      lockedAt: null,
      lockedBy: null,
      noteType: nextType,
      entity: null,
      interconnections: []
    };

    setLocalNotes((current) => sortWorkspaceNotes([optimisticNote, ...current]));
    setLocalSearchNotes((current) => sortWorkspaceNotes([optimisticNote, ...current]));
    setActiveNote(optimisticSelectedNote);
    setMobilePanel("editor");
    setKeyboardNoteId(tempId);
    setTitle(nextTitle);
    setContent(nextContent);
    setNoteType(nextType);
    setLinkedEntity(null);
    setFolderAssignment({
      id: navigationNodeId,
      label: navigationLabel
    });
    baselineRef.current = {
      noteId: tempId,
      title: nextTitle,
      content: nextContent
    };
    focusNoteIdRef.current = tempId;
    window.setTimeout(() => {
      titleRef.current?.focus();
      titleRef.current?.select();
    }, 0);

    setIsCreating(true);
    try {
      const note = await createEditorNoteAction({ navigationNodeId, title: nextTitle, content: nextContent, noteType: nextType });
      const latest = latestEditorRef.current;
      const realId = note.id;
      const entity = note.entity ?? null;
      replaceHistoryNote(realId);
      updateNoteCollections((item) =>
        item.id === tempId
          ? {
              ...item,
              id: realId,
              title: latest.title.trim() || nextTitle,
              content: latest.content,
              noteType: nextType,
              manualTags: [],
              isLocked: false,
              lockedAt: null,
              lockedBy: null,
              entity,
              interconnections: [],
              preview: firstLine(latest.content) || "No content yet."
            }
          : item
      );
      setActiveNote((current) =>
        current?.id === tempId
          ? {
              ...current,
              id: realId,
              title: latest.title.trim() || nextTitle,
              content: latest.content,
              noteType: nextType,
              manualTags: [],
              isLocked: false,
              lockedAt: null,
              lockedBy: null,
              entity,
              interconnections: []
            }
          : current
      );
      setLinkedEntity(entity);
      setKeyboardNoteId(realId);
      focusNoteIdRef.current = note.id;
      baselineRef.current = {
        noteId: realId,
        title: nextTitle,
        content: nextContent
      };
      if (latest.title !== nextTitle || latest.content !== nextContent) {
        setSaveState("saving");
      }
    } catch (caught) {
      setLocalNotes((current) => current.filter((note) => note.id !== tempId));
      setLocalSearchNotes((current) => current.filter((note) => note.id !== tempId));
      setActiveNote(null);
      setKeyboardNoteId(null);
      setTitle("");
      setContent("");
      setNoteType("draft");
      setSaveState("error");
      setSaveError(caught instanceof Error ? caught.message : "Note creation failed.");
    } finally {
      setIsCreating(false);
    }
  }

  function openNote(note: WorkspaceNoteListItem) {
    const nextNote: WorkspaceSelectedNote = {
      id: note.id,
      title: note.title,
      content: note.content,
      updatedAt: note.updatedAt,
      navigationNodeId: note.navigationNodeId,
      navigationLabel: note.navigationLabel,
      sortOrder: note.sortOrder,
      isPinned: note.isPinned,
      manualTags: note.manualTags,
      isLocked: note.isLocked,
      lockedAt: note.lockedAt,
      lockedBy: note.lockedBy,
      noteType: note.noteType,
      entity: note.entity,
      interconnections: note.interconnections
    };
    setActiveNote(nextNote);
    setMobilePanel("editor");
    setKeyboardNoteId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setNoteType(note.noteType || "draft");
    setLinkedEntity(note.entity);
    setSaveState("idle");
    setSaveError(null);
    setFolderAssignment({
      id: note.navigationNodeId,
      label: note.navigationLabel
    });
    baselineRef.current = {
      noteId: note.id,
      title: note.title,
      content: note.content
    };
    replaceHistoryNote(note.id);
  }

  function handleAssignmentChange(assignment: { id: string | null; label: string }) {
    setFolderAssignment(assignment);
    if (!activeNote) return;

    setActiveNote((current) =>
      current
        ? {
            ...current,
            navigationNodeId: assignment.id,
            navigationLabel: assignment.label
          }
        : current
    );
    updateNoteCollections((note) =>
      note.id === activeNote.id
        ? {
            ...note,
            navigationNodeId: assignment.id,
            navigationLabel: assignment.label
          }
        : note
    );
    replaceHistoryFolder(assignment.id, activeNote.id);
  }

  async function saveInlineTitle(noteId: string) {
    const nextTitle = editingTitle.trim() || "Untitled Note";
    const previousNotes = localNotes;
    const previousSearchNotes = localSearchNotes;
    setEditingTitleId(null);
    updateNoteCollections((note) => (note.id === noteId ? { ...note, title: nextTitle } : note));
    if (activeNote?.id === noteId) setTitle(nextTitle);

    try {
      await updateEditorNoteAction({ noteId, title: nextTitle });
    } catch {
      setLocalNotes(previousNotes);
      setLocalSearchNotes(previousSearchNotes);
    }
  }

  async function deleteNoteById(note: WorkspaceNoteListItem | WorkspaceSelectedNote) {
    if (isDeleting || isTemporaryNoteId(note.id)) return;
    const confirmed = window.confirm(`Delete "${note.title.trim() || "Untitled Note"}"?`);
    if (!confirmed) return;

    const previousNotes = localNotes;
    const previousSearchNotes = localSearchNotes;
    const previousActiveNote = activeNote;
    setIsDeleting(true);
    setLocalNotes((current) => current.filter((item) => item.id !== note.id));
    setLocalSearchNotes((current) => current.filter((item) => item.id !== note.id));
    setSessionUnlockedNoteIds((current) => current.filter((id) => id !== note.id));
    if (activeNote?.id === note.id) {
      setActiveNote(null);
      setKeyboardNoteId(null);
      setTitle("");
      setContent("");
      replaceHistoryNote(null);
    }
    try {
      await deleteEditorNoteAction(note.id);
    } catch (caught) {
      setLocalNotes(previousNotes);
      setLocalSearchNotes(previousSearchNotes);
      if (previousActiveNote) {
        setActiveNote(previousActiveNote);
        setKeyboardNoteId(previousActiveNote.id);
        setTitle(previousActiveNote.title);
        setContent(previousActiveNote.content);
        setNoteType(previousActiveNote.noteType || "draft");
        setLinkedEntity(previousActiveNote.entity);
      }
      setSaveState("error");
      setSaveError(caught instanceof Error ? caught.message : "Note delete failed.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function togglePinned(noteId: string) {
    const target = localNotes.find((note) => note.id === noteId) ?? localSearchNotes.find((note) => note.id === noteId);
    if (!target) return;
    const nextPinned = !target.isPinned;
    const previousNotes = localNotes;
    const previousSearchNotes = localSearchNotes;
    updateNoteCollections((note) => (note.id === noteId ? { ...note, isPinned: nextPinned } : note));
    try {
      await toggleNotePinnedAction({ noteId, isPinned: nextPinned });
    } catch {
      setLocalNotes(previousNotes);
      setLocalSearchNotes(previousSearchNotes);
    }
  }

  async function duplicateNoteById(noteId: string) {
    const source = localNotes.find((note) => note.id === noteId) ?? localSearchNotes.find((note) => note.id === noteId);
    if (!source || isTemporaryNoteId(source.id)) return;
    try {
      const duplicated = await duplicateEditorNoteAction(noteId);
      if (!duplicated) return;
      const duplicatedNote: WorkspaceNoteListItem = {
        id: duplicated.id,
        title: duplicated.title,
        content: source.content,
        preview: firstLine(source.content) || "No content yet.",
        updatedAt: duplicated.updatedAt.toISOString(),
        navigationNodeId: source.navigationNodeId,
        navigationLabel: source.navigationLabel,
        sortOrder: source.sortOrder + 1,
        isPinned: duplicated.isPinned,
        manualTags: [...source.manualTags],
        isLocked: duplicated.isLocked,
        lockedAt: duplicated.lockedAt?.toISOString() ?? null,
        lockedBy: duplicated.lockedBy ?? null,
        noteType: source.noteType,
        entity: duplicated.entity ?? source.entity,
        interconnections: []
      };
      setLocalNotes((current) => sortWorkspaceNotes([duplicatedNote, ...current]));
      setLocalSearchNotes((current) => sortWorkspaceNotes([duplicatedNote, ...current]));
    } catch (caught) {
      setSaveState("error");
      setSaveError(caught instanceof Error ? caught.message : "Note duplication failed.");
    }
  }

  async function updateNoteTagsForId(noteId: string, tags: string[]) {
    const previousNotes = localNotes;
    const previousSearchNotes = localSearchNotes;
    const previousActiveNote = activeNote;

    updateNoteCollections((note) => (note.id === noteId ? { ...note, manualTags: tags } : note));
    setActiveNote((current) => (current?.id === noteId ? { ...current, manualTags: tags } : current));

    try {
      await updateNoteTagsAction({ noteId, tags });
    } catch (caught) {
      setLocalNotes(previousNotes);
      setLocalSearchNotes(previousSearchNotes);
      setActiveNote(previousActiveNote);
      setSaveState("error");
      setSaveError(caught instanceof Error ? caught.message : "Tags could not be updated.");
      throw caught;
    }
  }

  async function lockNoteById(noteId: string, passcode: string) {
    const previousNotes = localNotes;
    const previousSearchNotes = localSearchNotes;
    const previousActiveNote = activeNote;
    const lockedAt = new Date().toISOString();

    updateNoteCollections((note) =>
      note.id === noteId
        ? {
            ...note,
            isLocked: true,
            lockedAt,
            lockedBy: previousActiveNote?.lockedBy ?? null
          }
        : note
    );
    setActiveNote((current) => (current?.id === noteId ? { ...current, isLocked: true, lockedAt, lockedBy: current.lockedBy ?? null } : current));
    setSessionUnlockedNoteIds((current) => [...new Set([...current, noteId])]);

    try {
      const summary = await lockNoteAction({ noteId, passcode });
      updateNoteCollections((note) =>
        note.id === noteId
          ? {
              ...note,
              isLocked: summary.isLocked,
              lockedAt: summary.lockedAt ? new Date(summary.lockedAt).toISOString() : null,
              lockedBy: summary.lockedBy
            }
          : note
      );
      setActiveNote((current) =>
        current?.id === noteId
          ? {
              ...current,
              isLocked: summary.isLocked,
              lockedAt: summary.lockedAt ? new Date(summary.lockedAt).toISOString() : null,
              lockedBy: summary.lockedBy
            }
          : current
      );
    } catch (caught) {
      setLocalNotes(previousNotes);
      setLocalSearchNotes(previousSearchNotes);
      setActiveNote(previousActiveNote);
      setSessionUnlockedNoteIds((current) => current.filter((id) => id !== noteId));
      setSaveState("error");
      setSaveError(caught instanceof Error ? caught.message : "Note lock failed.");
      throw caught;
    }
  }

  async function removeLockFromNote(noteId: string, passcode: string) {
    const previousNotes = localNotes;
    const previousSearchNotes = localSearchNotes;
    const previousActiveNote = activeNote;

    updateNoteCollections((note) => (note.id === noteId ? { ...note, isLocked: false, lockedAt: null, lockedBy: null } : note));
    setActiveNote((current) => (current?.id === noteId ? { ...current, isLocked: false, lockedAt: null, lockedBy: null } : current));
    setSessionUnlockedNoteIds((current) => current.filter((id) => id !== noteId));

    try {
      await unlockNoteAction({ noteId, passcode });
    } catch (caught) {
      setLocalNotes(previousNotes);
      setLocalSearchNotes(previousSearchNotes);
      setActiveNote(previousActiveNote);
      setSaveState("error");
      setSaveError(caught instanceof Error ? caught.message : "Note unlock failed.");
      throw caught;
    }
  }

  async function unlockNoteForSession(noteId: string, passcode: string) {
    const verified = await verifyNotePasscodeAction({ noteId, passcode });
    if (!verified) throw new Error("Incorrect passcode.");
    setSessionUnlockedNoteIds((current) => [...new Set([...current, noteId])]);
  }

  async function reorderNote(noteId: string, overNoteId: string) {
    if (isReordering) return;
    const activeIndex = localNotes.findIndex((note) => note.id === noteId);
    const overIndex = localNotes.findIndex((note) => note.id === overNoteId);
    if (activeIndex < 0 || overIndex < 0) return;

    const draggedNote = localNotes[activeIndex];
    const overNote = localNotes[overIndex];
    const nextNavigationNodeId = overNote.navigationNodeId;
    const nextNavigationLabel = overNote.navigationLabel;
    const moved = {
      ...draggedNote,
      navigationNodeId: nextNavigationNodeId,
      navigationLabel: nextNavigationLabel
    };
    const withoutActive = localNotes.filter((note) => note.id !== noteId);
    const insertIndex = withoutActive.findIndex((note) => note.id === overNoteId);
    const nextNotes = [...withoutActive.slice(0, insertIndex), moved, ...withoutActive.slice(insertIndex)];
    const groupIds = nextNotes.filter((note) => note.navigationNodeId === nextNavigationNodeId).map((note) => note.id);
    const sortOrderById = new Map(groupIds.map((id, index) => [id, (index + 1) * 10]));
    const renumberedNotes = nextNotes.map((note) => (sortOrderById.has(note.id) ? { ...note, sortOrder: sortOrderById.get(note.id) ?? note.sortOrder } : note));

    setIsReordering(true);
    const previousNotes = localNotes;
    const previousSearchNotes = localSearchNotes;
    setLocalNotes(sortWorkspaceNotes(renumberedNotes));
    setLocalSearchNotes((current) =>
      sortWorkspaceNotes(
        current.map((note) => {
          const updated = renumberedNotes.find((item) => item.id === note.id);
          return updated ?? note;
        })
      )
    );
    if (activeNote?.id === noteId) {
      setFolderAssignment({
        id: nextNavigationNodeId,
        label: nextNavigationLabel
      });
    }
    try {
      await reorderNotesAction({
        navigationNodeId: nextNavigationNodeId,
        noteIds: groupIds
      });
    } catch {
      setLocalNotes(previousNotes);
      setLocalSearchNotes(previousSearchNotes);
    } finally {
      setIsReordering(false);
    }
  }

  async function moveNoteToFolder(noteId: string, rawFolderId: string) {
    if (isReordering) return;
    const navigationNodeId = rawFolderId === "unassigned" ? null : rawFolderId;
    const navigationLabel = navigationNodeId ? optionById.get(navigationNodeId)?.fullPath ?? "Selected folder" : "Unassigned";

    setIsReordering(true);
    const previousNotes = localNotes;
    const previousSearchNotes = localSearchNotes;
    updateNoteCollections((note) =>
      note.id === noteId
        ? {
            ...note,
            navigationNodeId,
            navigationLabel
          }
        : note
    );
    if (activeNote?.id === noteId) {
      setFolderAssignment({
        id: navigationNodeId,
        label: navigationLabel
      });
      setActiveNote((current) =>
        current?.id === noteId
          ? {
              ...current,
              navigationNodeId,
              navigationLabel
            }
          : current
      );
    }
    try {
      await moveNoteToNavigationNodeAction({ noteId, navigationNodeId });
      if (activeNote?.id === noteId) replaceHistoryFolder(navigationNodeId, noteId);
    } catch {
      setLocalNotes(previousNotes);
      setLocalSearchNotes(previousSearchNotes);
    } finally {
      setIsReordering(false);
    }
  }

  function updateNoteCollections(updater: (note: WorkspaceNoteListItem) => WorkspaceNoteListItem) {
    setLocalNotes((current) => sortWorkspaceNotes(current.map(updater)));
    setLocalSearchNotes((current) => sortWorkspaceNotes(current.map(updater)));
  }

  function replaceOneMatch() {
    if (!editorActions || !editorFindQuery.trim()) return;
    editorActions.replaceOne(editorFindQuery, editorReplacement);
  }

  function replaceAllMatches() {
    if (!editorActions || !editorFindQuery.trim()) return;
    editorActions.replaceAll(editorFindQuery, editorReplacement);
  }

  function setNoteColor(noteId: string, color: string) {
    setNoteColors((current) => {
      const next = { ...current };
      if (color) next[noteId] = color;
      else delete next[noteId];
      return next;
    });
    setNoteContextMenu(null);
  }

  async function changeNoteType(nextType: string) {
    if (!activeNote || isTemporaryNoteId(activeNote.id)) return;
    const previousType = noteType;
    const previousEntity = linkedEntity;
    setNoteType(nextType);
    setActiveNote((current) => (current ? { ...current, noteType: nextType } : current));
    updateNoteCollections((note) => (note.id === activeNote.id ? { ...note, noteType: nextType } : note));
    try {
      const entity = await updateEditorNoteAction({ noteId: activeNote.id, title, noteType: nextType });
      if (entity) {
        setLinkedEntity(entity);
        setActiveNote((current) => (current ? { ...current, entity } : current));
        updateNoteCollections((note) => (note.id === activeNote.id ? { ...note, entity } : note));
      }
    } catch (caught) {
      setNoteType(previousType);
      setLinkedEntity(previousEntity);
      setActiveNote((current) => (current ? { ...current, noteType: previousType, entity: previousEntity } : current));
      updateNoteCollections((note) => (note.id === activeNote.id ? { ...note, noteType: previousType, entity: previousEntity } : note));
      setSaveState("error");
      setSaveError(caught instanceof Error ? caught.message : "Note type update failed.");
    }
  }

  async function confirmRelationship() {
    if (!relationshipPopover) return;
    const current = relationshipPopover;
    setRelationshipPopover(null);
    try {
      const relationship = await createRelationshipAction({
        entityAId: current.suggestion.entityA.id,
        entityBId: current.suggestion.entityB.id,
        relationshipTypeName: current.type,
        description: current.description
      });
      applySavedRelationship(relationship, {
        id: current.suggestion.entityA.id,
        name: current.suggestion.entityA.title,
        type: current.suggestion.entityA.type,
        noteId: null
      }, {
        id: current.suggestion.entityB.id,
        name: current.suggestion.entityB.title,
        type: current.suggestion.entityB.type,
        noteId: null
      });
    } catch (caught) {
      setSaveState("error");
      setSaveError(caught instanceof Error ? caught.message : "Relationship creation failed.");
    }
  }

  async function addManualRelationship(input: { entityId: string; relationshipTypeId?: string | null; relationshipTypeName?: string | null; description?: string | null }) {
    if (!activeNote?.entity) return;
    const otherEntity = entityOptions.find((entity) => entity.id === input.entityId);
    if (!otherEntity) return;
    let relationshipTypeId = input.relationshipTypeId ?? null;
    if (!relationshipTypeId && input.relationshipTypeName) {
      const createdType = await createRelationshipTypeAction(input.relationshipTypeName);
      setLocalRelationshipTypes((current) => mergeRelationshipTypes(current, createdType));
      relationshipTypeId = createdType.id;
    }
    const relationship = await createRelationshipAction({
      entityAId: activeNote.entity.id,
      entityBId: otherEntity.id,
      relationshipTypeId,
      description: input.description
    });
    applySavedRelationship(relationship, activeNote.entity, otherEntity);
  }

  async function createRelationshipBetweenEntities(input: { sourceEntity: EntityRecord; targetEntityId: string; relationshipTypeId?: string | null; relationshipTypeName?: string | null; description?: string | null }) {
    const targetEntity = entityRecords.find((entity) => entity.id === input.targetEntityId) ?? entityOptions.find((entity) => entity.id === input.targetEntityId);
    if (!targetEntity) return;
    let relationshipTypeId = input.relationshipTypeId ?? null;
    if (!relationshipTypeId && input.relationshipTypeName) {
      const createdType = await createRelationshipTypeAction(input.relationshipTypeName);
      setLocalRelationshipTypes((current) => mergeRelationshipTypes(current, createdType));
      relationshipTypeId = createdType.id;
    }
    const relationship = await createRelationshipAction({
      entityAId: input.sourceEntity.id,
      entityBId: targetEntity.id,
      relationshipTypeId,
      description: input.description
    });
    if (!relationship || !activeNote?.entity) return;
    applySavedRelationship(
      relationship,
      { id: input.sourceEntity.id, name: input.sourceEntity.name, type: input.sourceEntity.type, noteId: input.sourceEntity.noteId },
      { id: targetEntity.id, name: targetEntity.name, type: targetEntity.type, noteId: targetEntity.noteId }
    );
  }

  async function attachEntityToActiveNote(entityId: string) {
    if (!activeNote || isTemporaryNoteId(activeNote.id)) return;
    const entity = await attachNoteEntityAction({ noteId: activeNote.id, entityId });
    if (!entity) return;
    setLinkedEntity(entity);
    setActiveNote((current) => (current ? { ...current, entity } : current));
    updateNoteCollections((note) => (note.id === activeNote.id ? { ...note, entity } : note));
  }

  async function removeActiveEntityLink() {
    if (!activeNote || isTemporaryNoteId(activeNote.id)) return;
    await removeNoteEntityLinkAction(activeNote.id);
    setLinkedEntity(null);
    setActiveNote((current) => (current ? { ...current, entity: null, interconnections: [] } : current));
    updateNoteCollections((note) => (note.id === activeNote.id ? { ...note, entity: null, interconnections: [] } : note));
  }

  async function createEntityAndMaybeAttach(input: { name: string; type: string; aliases: string[]; allowDuplicate?: boolean; attachToNote?: boolean; selectedText?: string | null }) {
    const entity = await createEntityAction({ name: input.name, type: input.type, aliases: input.aliases, allowDuplicate: input.allowDuplicate });
    if (!entity) return null;
    setLocalEntityIndex((current) => mergeEntityIndexEntries(current, entity, [entity.name, ...entity.aliases, input.selectedText ?? ""].filter(Boolean)));
    if (input.attachToNote && activeNote && !isTemporaryNoteId(activeNote.id)) await attachEntityToActiveNote(entity.id);
    if (input.selectedText && activeNote && !isTemporaryNoteId(activeNote.id)) await linkTextSelectionToEntityAction({ noteId: activeNote.id, entityId: entity.id, text: input.selectedText });
    return entity;
  }

  async function linkSelectionToEntity(entityId: string, selectedText: string) {
    if (!activeNote || isTemporaryNoteId(activeNote.id)) return;
    await linkTextSelectionToEntityAction({ noteId: activeNote.id, entityId, text: selectedText });
    const entity = entityOptions.find((option) => option.id === entityId);
    if (entity) setLocalEntityIndex((current) => mergeEntityIndexEntries(current, entity, [selectedText]));
  }

  async function repairEntity(input: { entityId: string; name: string; type: string; aliases: string[] }) {
    const entity = await updateEntityAction(input);
    if (!entity) return;
    setLinkedEntity(entity);
    setActiveNote((current) => (current ? { ...current, entity } : current));
    updateNoteCollections((note) => (note.id === activeNote?.id ? { ...note, entity } : note));
  }

  async function mergeActiveEntityInto(targetEntityId: string) {
    if (!activeNote?.entity) return;
    const entity = await mergeEntityAction({ sourceEntityId: activeNote.entity.id, targetEntityId });
    if (!entity) return;
    await attachEntityToActiveNote(entity.id);
  }

  async function editRelationship(input: { relationshipId: string; relationshipTypeId?: string | null; relationshipTypeName?: string | null; description?: string | null }) {
    if (!activeNote?.entity) return;
    const relationship = await updateRelationshipAction(input);
    if (!relationship) return;
    const existing = activeNote.interconnections.find((connection) => connection.id === input.relationshipId);
    if (!existing) return;
    const nextConnection = {
      ...existing,
      type: relationship.type,
      relationshipType: relationship.relationshipType,
      description: relationship.description
    };
    setActiveNote((current) => (current ? { ...current, interconnections: mergeInterconnections(current.interconnections, nextConnection) } : current));
    updateNoteCollections((note) => (note.id === activeNote.id ? { ...note, interconnections: mergeInterconnections(note.interconnections, nextConnection) } : note));
  }

  async function deleteRelationshipById(relationshipId: string) {
    if (!activeNote) return;
    const confirmed = window.confirm("Delete this relationship? Entities will remain intact.");
    if (!confirmed) return;
    await deleteRelationshipAction(relationshipId);
    setActiveNote((current) => (current ? { ...current, interconnections: current.interconnections.filter((connection) => connection.id !== relationshipId) } : current));
    updateNoteCollections((note) => (note.id === activeNote.id ? { ...note, interconnections: note.interconnections.filter((connection) => connection.id !== relationshipId) } : note));
  }

  function applySavedRelationship(
    relationship: Awaited<ReturnType<typeof createRelationshipAction>>,
    entityA: { id: string; name: string; type: string; noteId?: string | null },
    entityB: { id: string; name: string; type: string; noteId?: string | null }
  ) {
    if (!relationship || !activeNote?.entity) return;
    const currentEntityId = activeNote.entity.id;
    if (relationship.entityAId !== currentEntityId && relationship.entityBId !== currentEntityId) return;
    const other = relationship.entityAId === currentEntityId ? entityB : entityA;
    const nextConnection: InterconnectedRelationship = {
      id: relationship.id,
      type: relationship.type,
      relationshipType: relationship.relationshipType,
      description: relationship.description,
      otherEntity: {
        id: other.id,
        name: other.name,
        type: other.type,
        noteId: other.noteId ?? null
      }
    };

    setActiveNote((current) => (current ? { ...current, interconnections: mergeInterconnections(current.interconnections, nextConnection) } : current));
    updateNoteCollections((note) => (note.id === activeNote.id ? { ...note, interconnections: mergeInterconnections(note.interconnections, nextConnection) } : note));
  }

  function beginNotesListResize(startEvent: ReactPointerEvent<HTMLDivElement>) {
    startEvent.preventDefault();
    const startX = startEvent.clientX;
    const startWidth = leftPanelWidth;

    function handleMove(moveEvent: PointerEvent) {
      setLeftPanelWidth(Math.min(PANEL_MAX, Math.max(PANEL_MIN, startWidth + moveEvent.clientX - startX)));
    }

    function handleUp() {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  function beginRightPanelResize(startEvent: ReactPointerEvent<HTMLDivElement>) {
    startEvent.preventDefault();
    const startX = startEvent.clientX;
    const startWidth = rightPanelWidth;

    function handleMove(moveEvent: PointerEvent) {
      setRightPanelWidth(Math.min(MAX_RIGHT_PANEL_WIDTH, Math.max(MIN_RIGHT_PANEL_WIDTH, startWidth - (moveEvent.clientX - startX))));
    }

    function handleUp() {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  return (
    <>
    <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-black/20 lg:flex-row">
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2 lg:hidden">
        <button
          type="button"
          onClick={() => setMobilePanel("notes")}
          className={`h-9 rounded border px-3 text-xs font-bold uppercase tracking-[0.16em] transition ${mobilePanel === "notes" ? "border-[var(--signal)]/40 bg-[var(--signal)]/10 text-white" : "border-white/10 text-stone-300 hover:bg-white/10 hover:text-white"}`}
        >
          Notes
        </button>
        <button
          type="button"
          onClick={() => setMobilePanel("editor")}
          className={`h-9 rounded border px-3 text-xs font-bold uppercase tracking-[0.16em] transition ${mobilePanel === "editor" ? "border-[var(--signal)]/40 bg-[var(--signal)]/10 text-white" : "border-white/10 text-stone-300 hover:bg-white/10 hover:text-white"}`}
        >
          Editor
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRightEntityOpen((open) => !open)}
            className={`h-9 rounded border px-3 text-xs font-bold uppercase tracking-[0.16em] transition ${rightEntityOpen ? "border-[var(--signal)]/40 bg-[var(--signal)]/10 text-white" : "border-white/10 text-stone-300 hover:bg-white/10 hover:text-white"}`}
          >
            Entity
          </button>
          <button
            type="button"
            onClick={() => setRightInterconOpen((open) => !open)}
            className={`h-9 rounded border px-3 text-xs font-bold uppercase tracking-[0.16em] transition ${rightInterconOpen ? "border-[var(--signal)]/40 bg-[var(--signal)]/10 text-white" : "border-white/10 text-stone-300 hover:bg-white/10 hover:text-white"}`}
          >
            Links
          </button>
        </div>
      </div>
      <div
        className={`relative h-full min-h-0 shrink-0 overflow-hidden transition-all duration-200 ease-out ${mobilePanel === "notes" ? "flex w-full" : "hidden"} lg:block`}
        style={{
          width: !isMobileLayout ? (leftNotesOpen ? `${leftPanelWidth}px` : "0px") : undefined,
          minWidth: !isMobileLayout ? (leftNotesOpen ? `${PANEL_MIN}px` : "0px") : undefined,
          maxWidth: !isMobileLayout ? (leftNotesOpen ? `${PANEL_MAX}px` : "0px") : undefined,
          transform: !isMobileLayout ? (leftNotesOpen ? "translateX(0)" : "translateX(-12px)") : undefined
        }}
      >
        <section
          className={`h-full min-h-0 min-w-0 w-full flex-col overflow-hidden border-b border-white/10 transition-opacity duration-200 lg:border-b-0 lg:border-r ${leftNotesOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"} ${mobilePanel === "notes" ? "flex" : "hidden"} lg:flex`}
          data-notes-list-width
        >
          <header className="flex min-w-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="max-w-full truncate whitespace-nowrap text-xs font-bold uppercase tracking-[0.2em] text-[var(--signal)]">{folderLabel}</p>
              <h1 className="mt-1 text-2xl font-black text-white">Notes</h1>
            </div>
            <button type="button" onClick={() => createNote()} disabled={isCreating} className="h-9 shrink-0 rounded border border-white/10 px-3 text-xs font-bold text-stone-200 transition hover:border-[var(--signal)]/40 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60">
              {isCreating ? "Creating..." : "New Note"}
            </button>
          </header>

          <div className="border-b border-white/10 px-4 py-3">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search all notes"
              className="h-10 w-full rounded border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-stone-600 focus:border-[var(--signal)]/50"
            />
          </div>

          <div className="flex min-w-0 items-center justify-between gap-4 border-b border-white/10 px-4 py-3 text-sm text-stone-400">
            <p className="shrink-0">{displayNotes.length} notes</p>
            <p className="min-w-0 truncate whitespace-nowrap">{isSearching ? "Searching all notes" : "Filtered by folder"}</p>
          </div>

          <div className="panel-scroll min-w-0 flex-1">
            <div className="min-w-0 divide-y divide-white/10">
              {mounted ? (
                <SortableContext items={visibleNoteIds} strategy={verticalListSortingStrategy}>
                  {displayNotes.map((note, index) => {
                    const isSelected = focusedNoteId === note.id;
                    const startsPinned = note.isPinned && !displayNotes[index - 1]?.isPinned;
                    const startsUnpinned = !note.isPinned && displayNotes[index - 1]?.isPinned;

                    return (
                      <div key={note.id}>
                        {startsPinned ? <p className="bg-black/20 px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">Pinned</p> : null}
                        {startsUnpinned ? <p className="bg-black/20 px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-stone-500">Notes</p> : null}
                        <SortableNoteItem
                          note={note}
                          isSelected={isSelected}
                          color={noteColors[note.id]}
                          onOpen={() => openNote(note)}
                          isEditingTitle={editingTitleId === note.id}
                          editingTitle={editingTitle}
                          onBeginTitleEdit={() => {
                            setKeyboardNoteId(note.id);
                            setEditingTitleId(note.id);
                            setEditingTitle(note.title);
                          }}
                          onEditingTitleChange={setEditingTitle}
                          onSaveTitle={() => saveInlineTitle(note.id)}
                          onCancelTitleEdit={() => setEditingTitleId(null)}
                          onTogglePinned={togglePinned}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            showNoteContextMenu(note, event.clientX, event.clientY);
                          }}
                          onLongPressContextMenu={(position) => showNoteContextMenu(note, position.x, position.y)}
                        />
                      </div>
                    );
                  })}
                </SortableContext>
              ) : (
                <>
                  {displayNotes.map((note, index) => {
                    const isSelected = focusedNoteId === note.id;
                    const startsPinned = note.isPinned && !displayNotes[index - 1]?.isPinned;
                    const startsUnpinned = !note.isPinned && displayNotes[index - 1]?.isPinned;

                    return (
                      <div key={note.id}>
                        {startsPinned ? <p className="bg-black/20 px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">Pinned</p> : null}
                        {startsUnpinned ? <p className="bg-black/20 px-4 py-2 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-stone-500">Notes</p> : null}
                        <StaticNoteItem
                          note={note}
                          isSelected={isSelected}
                          color={noteColors[note.id]}
                          onOpen={() => openNote(note)}
                          isEditingTitle={editingTitleId === note.id}
                          editingTitle={editingTitle}
                          onBeginTitleEdit={() => {
                            setKeyboardNoteId(note.id);
                            setEditingTitleId(note.id);
                            setEditingTitle(note.title);
                          }}
                          onEditingTitleChange={setEditingTitle}
                          onSaveTitle={() => saveInlineTitle(note.id)}
                          onCancelTitleEdit={() => setEditingTitleId(null)}
                          onTogglePinned={togglePinned}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            showNoteContextMenu(note, event.clientX, event.clientY);
                          }}
                          onLongPressContextMenu={(position) => showNoteContextMenu(note, position.x, position.y)}
                        />
                      </div>
                    );
                  })}
                </>
              )}
              {displayNotes.length === 0 ? (
                <div className="px-4 py-16 text-center">
                  <p className="text-lg font-black text-white">{isSearching ? "No matches." : "No notes here yet."}</p>
                  {!isSearching ? (
                    <button type="button" onClick={() => createNote()} disabled={isCreating} className="mt-4 h-9 rounded border border-white/10 px-3 text-xs font-bold text-stone-200 transition hover:border-[var(--signal)]/40 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60">
                      Create one
                    </button>
                  ) : null}
                </div>
              ) : null}
              {noteContextMenu ? (
                <NoteContextMenu
                  state={noteContextMenu}
                  onTogglePinned={(note) => {
                    setNoteContextMenu(null);
                    void togglePinned(note.id);
                  }}
                  onTag={(note) => {
                    setNoteContextMenu(null);
                    setNoteTagsDialog({ noteId: note.id, title: note.title, tags: note.manualTags });
                  }}
                  onDuplicate={(note) => {
                    setNoteContextMenu(null);
                    void duplicateNoteById(note.id);
                  }}
                  onRename={(note) => {
                    setKeyboardNoteId(note.id);
                    setEditingTitleId(note.id);
                    setEditingTitle(note.title);
                    setNoteContextMenu(null);
                  }}
                  onMove={(note, navigationNodeId) => {
                    setNoteContextMenu(null);
                    void moveNoteToFolder(note.id, navigationNodeId ?? "unassigned");
                  }}
                  onDelete={(note) => {
                    setNoteContextMenu(null);
                    void deleteNoteById(note);
                  }}
                  onToggleLock={(note) => {
                    setNoteContextMenu(null);
                    setNoteLockDialog({
                      mode: note.isLocked ? "remove" : "set",
                      noteId: note.id,
                      title: note.title
                    });
                  }}
                  onSetColor={setNoteColor}
                  navigationOptions={navigationOptions}
                />
              ) : null}
            </div>
          </div>
        </section>
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize notes list"
        onPointerDown={beginNotesListResize}
        className={`hidden w-1 shrink-0 cursor-col-resize bg-white/5 transition hover:bg-[var(--signal)]/40 ${leftNotesOpen ? "lg:block" : "lg:hidden"}`}
      />

      <section className={`${mobilePanel === "editor" ? "flex" : "hidden"} h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex lg:min-w-[400px]`}>
        {activeNote ? (
          <>
            <div className="sticky top-0 z-30 border-b border-white/10 bg-black/90 backdrop-blur">
              <div className="flex h-11 items-center justify-between gap-3 pl-5 pr-4 text-xs text-stone-500">
                <div className="flex min-w-0 items-center gap-3 overflow-hidden">
                  {linkedEntity ? (
                    <>
                      <span className="truncate font-black text-white">{linkedEntity.name}</span>
                      <span className="rounded border border-white/10 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.14em] text-stone-500">{linkedEntity.type}</span>
                    </>
                  ) : (
                    <>
                      <span className="truncate font-black text-stone-300">{title.trim() || "Untitled"}</span>
                      <span className="rounded border border-white/10 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.14em] text-stone-600">{noteType}</span>
                    </>
                  )}
                  <span className="hidden text-stone-700 sm:inline">/</span>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setEntityLinkMenuOpen((open) => !open)}
                      disabled={!activeNote || isTemporaryNoteId(activeNote.id)}
                      className="rounded border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-stone-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {linkedEntity ? `Linked: ${linkedEntity.name}` : "No Entity Linked"}
                    </button>
                    {entityLinkMenuOpen ? (
                      <div className="absolute left-0 top-8 z-50 grid min-w-48 gap-1 rounded border border-white/10 bg-zinc-950 p-1 text-sm shadow-2xl">
                        <button type="button" onClick={() => { setEntityLinkMenuOpen(false); setEntityModal({ mode: "attach" }); }} className="rounded px-3 py-2 text-left text-stone-200 transition hover:bg-white/10 hover:text-white">
                          {linkedEntity ? "Change linked entity" : "Attach entity"}
                        </button>
                        {linkedEntity ? (
                          <button type="button" onClick={() => { setEntityLinkMenuOpen(false); void removeActiveEntityLink(); }} className="rounded px-3 py-2 text-left text-stone-400 transition hover:bg-white/10 hover:text-white">
                            Remove link
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  {saveState === "saving" ? <span className="text-stone-300">Saving...</span> : null}
                  {saveState === "saved" ? <span className="text-[var(--signal)]">Saved</span> : null}
                  {saveState === "error" ? <span className="text-red-300">{saveError}</span> : null}
                </div>
                <div className="mr-1 flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={() => setEditorControlsOpen((open) => !open)}
                    aria-label="Toggle editor controls"
                    aria-expanded={editorControlsOpen}
                    className={`h-8 w-8 rounded border border-white/10 text-lg font-black leading-none transition hover:bg-white/10 hover:text-white ${editorControlsOpen ? "bg-white/10 text-white" : "text-stone-400"}`}
                  >
                    ⋯
                  </button>
                </div>
              </div>
              {editorControlsOpen ? (
                <div className="flex items-center justify-between gap-3 border-t border-white/10 pl-5 pr-4 py-2">
                  <div className="flex min-w-0 max-w-[60%] shrink items-center gap-2">
                    <NoteNavigationAssignmentControl
                      noteId={activeNote.id}
                      options={navigationOptions}
                      defaultValue={folderAssignment.id ?? ""}
                      defaultLabel={folderAssignment.label}
                      createParentId={createParentId}
                      compact
                      className="inline-flex min-w-0 max-w-full"
                      onAssignmentChange={handleAssignmentChange}
                    />
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button type="button" onClick={() => setEditorFindOpen((open) => !open)} className="h-8 rounded border border-white/10 px-3 text-xs font-bold text-stone-200 transition hover:bg-white/10 hover:text-white">
                      Find
                    </button>
                    <ExportMenu
                      note={{
                        id: activeNote.id,
                        title: title.trim() || "Untitled Note",
                        content,
                        updatedAt: activeNote.updatedAt,
                        navigationNodeId: folderAssignment.id,
                        navigationLabel: folderAssignment.label,
                        isPinned: activeNote.isPinned,
                        sortOrder: activeNote.sortOrder
                      }}
                    />
                    <EditorToolbar actions={editorActions} />
                  </div>
                </div>
              ) : null}
            </div>

            {editorFindOpen ? (
              <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-black/40 px-5 py-3 text-xs text-stone-400">
                <input
                  autoFocus
                  value={editorFindQuery}
                  onChange={(event) => setEditorFindQuery(event.target.value)}
                  placeholder="Find in note"
                  className="h-8 w-44 rounded border border-white/10 bg-black/40 px-2 text-sm text-white outline-none placeholder:text-stone-600 focus:border-[var(--signal)]/50"
                />
                {editorReplaceOpen ? (
                  <input
                    value={editorReplacement}
                    onChange={(event) => setEditorReplacement(event.target.value)}
                    placeholder="Replace with"
                    className="h-8 w-44 rounded border border-white/10 bg-black/40 px-2 text-sm text-white outline-none placeholder:text-stone-600 focus:border-[var(--signal)]/50"
                  />
                ) : null}
                <span>{editorFindQuery.trim() ? `${editorMatchCount} matches` : "Cmd/Ctrl+F"}</span>
                <button type="button" onClick={() => setEditorReplaceOpen((open) => !open)} className="h-8 rounded border border-white/10 px-2 font-bold text-stone-300 transition hover:bg-white/10 hover:text-white">
                  Replace
                </button>
                {editorReplaceOpen ? (
                  <>
                    <button type="button" onClick={replaceOneMatch} className="h-8 rounded border border-white/10 px-2 font-bold text-stone-300 transition hover:bg-white/10 hover:text-white">
                      One
                    </button>
                    <button type="button" onClick={replaceAllMatches} className="h-8 rounded border border-white/10 px-2 font-bold text-stone-300 transition hover:bg-white/10 hover:text-white">
                      All
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setEditorFindOpen(false);
                    setEditorFindQuery("");
                  }}
                  className="ml-auto h-8 rounded border border-white/10 px-2 font-bold text-stone-500 transition hover:bg-white/10 hover:text-white"
                >
                  Close
                </button>
              </div>
            ) : null}

            <div className="panel-scroll flex-1">
              <div className="flex min-h-full flex-col px-5 py-5">
                {activeNoteRequiresUnlock ? (
                  <LockedNotePanel
                    note={activeNote}
                    onUnlock={(passcode) => unlockNoteForSession(activeNote.id, passcode)}
                    onRemoveLock={() =>
                      setNoteLockDialog({
                        mode: "remove",
                        noteId: activeNote.id,
                        title: activeNote.title
                      })
                    }
                  />
                ) : (
                  <>
                    {linkedEntity && isInvalidEntityName(linkedEntity.name) ? (
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                        <span>This entity needs a name.</span>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setEntityModal({ mode: "repair" })} className="h-8 rounded border border-red-200/20 px-3 text-xs font-bold transition hover:bg-red-200/10">
                            Rename entity
                          </button>
                          <button type="button" onClick={() => setEntityModal({ mode: "merge" })} className="h-8 rounded border border-red-200/20 px-3 text-xs font-bold transition hover:bg-red-200/10">
                            Merge entity
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {linkedEntity ? <EntityHeaderBar entity={linkedEntity} relationships={activeNote.interconnections} /> : null}
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                      {activeNote.manualTags.length > 0 ? activeNote.manualTags.map((tag) => (
                        <span key={tag} className="rounded border border-white/10 bg-white/[0.03] px-2 py-1 text-stone-300">
                          #{tag}
                        </span>
                      )) : null}
                      {activeNote.isLocked ? (
                        <span className="rounded border border-white/10 bg-white/[0.03] px-2 py-1 text-stone-400">
                          Locked
                        </span>
                      ) : null}
                    </div>
                    <input ref={titleRef} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Untitled" className="w-full rounded border-0 bg-transparent text-4xl font-black tracking-tight text-white outline-none placeholder:text-stone-700 focus-visible:ring-2 focus-visible:ring-[var(--signal)]/35" />
                    <div className="-mx-5 mt-5 flex min-h-0 flex-1 flex-col border-t border-white/10 transition focus-within:ring-1 focus-within:ring-[var(--signal)]/35">
                      <RichTextEditor
                        value={content}
                        onChange={setContent}
                        findQuery={editorFindOpen ? editorFindQuery : ""}
                        currentNoteId={activeNote.id}
                        entityIndex={localEntityIndex}
                        onActionsReady={setEditorActions}
                        onEntityClick={(entity) => {
                          if (!activeNote.entity || entity.id === activeNote.entity.id) return;
                          setConnectionModal({
                            mode: "quick",
                            targetEntityId: entity.id,
                            title: `Create connection with ${entity.title}`
                          });
                        }}
                        onSelectionContextMenu={(selection) => setSelectionMenu(selection)}
                        onRelationshipSuggestionsChange={setRelationshipSuggestions}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="grid flex-1 place-items-center px-6 text-center">
            <div>
              <p className="text-2xl font-black text-white">Select a note</p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-stone-400">Choose a note from the list or create a new one in the selected folder.</p>
            </div>
          </div>
        )}
      </section>
      {!isMobileLayout ? (
        <>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize right panels"
            onPointerDown={beginRightPanelResize}
            className={`hidden w-1 shrink-0 cursor-col-resize bg-white/5 transition hover:bg-[var(--signal)]/40 ${(rightEntityOpen || rightInterconOpen) ? "lg:block" : "lg:hidden"}`}
          />
          <SlidingSidePanel open={rightEntityOpen} width={rightPanelWidth} minWidth={MIN_RIGHT_PANEL_WIDTH} side="right">
            <EntityDrawer
              entities={entityRecords}
              currentEntity={linkedEntity}
              relationshipTypes={localRelationshipTypes}
              relationships={activeNote?.interconnections ?? []}
              onCreateEntity={createEntityAndMaybeAttach}
              onSelectAttach={activeNote && !isTemporaryNoteId(activeNote.id) ? attachEntityToActiveNote : undefined}
              onRepair={repairEntity}
              onMerge={mergeActiveEntityInto}
              onCreateRelationship={createRelationshipBetweenEntities}
              onEditRelationship={editRelationship}
              onDeleteRelationship={(relationshipId) => void deleteRelationshipById(relationshipId)}
            />
          </SlidingSidePanel>
          <SlidingSidePanel open={rightInterconOpen} width={rightPanelWidth} minWidth={MIN_RIGHT_PANEL_WIDTH} side="right">
            <InterconnectedPanel
              activeNote={activeNote}
              suggestions={relationshipSuggestions}
              popover={relationshipPopover}
              onOpenSuggestion={(suggestion) =>
                setRelationshipPopover({
                  suggestion,
                  type: suggestion.suggestedType,
                  description: suggestion.snippet
                })
              }
              onChangeSuggestionType={(type) => setRelationshipPopover((current) => (current ? { ...current, type } : current))}
              onChangeSuggestionDescription={(description) => setRelationshipPopover((current) => (current ? { ...current, description } : current))}
              onConfirmSuggestion={() => void confirmRelationship()}
              onCloseSuggestion={() => setRelationshipPopover(null)}
              relationshipTypes={localRelationshipTypes}
              onEditRelationship={editRelationship}
              onDeleteRelationship={(relationshipId) => void deleteRelationshipById(relationshipId)}
            />
          </SlidingSidePanel>
          <div className="hidden shrink-0 lg:block" style={{ width: RIGHT_RAIL_WIDTH }} aria-hidden="true" />
        </>
      ) : null}
      <RightEdgeTabs
        entityOpen={rightEntityOpen}
        interconOpen={rightInterconOpen}
        onToggleEntity={() => setRightEntityOpen((open) => !open)}
        onToggleIntercon={() => setRightInterconOpen((open) => !open)}
      />
      {isMobileLayout && (rightEntityOpen || rightInterconOpen) ? (
        <aside className="absolute inset-x-0 bottom-0 top-[3.5rem] z-30 flex min-h-0 flex-col overflow-hidden border-t border-white/10 bg-[#080808]">
          {rightEntityOpen ? (
            <div className={`min-h-0 ${rightInterconOpen ? "flex-1 border-b border-white/10" : "flex-1"}`}>
              <EntityDrawer
                entities={entityRecords}
                currentEntity={linkedEntity}
                relationshipTypes={localRelationshipTypes}
                relationships={activeNote?.interconnections ?? []}
                onCreateEntity={createEntityAndMaybeAttach}
                onSelectAttach={activeNote && !isTemporaryNoteId(activeNote.id) ? attachEntityToActiveNote : undefined}
                onRepair={repairEntity}
                onMerge={mergeActiveEntityInto}
                onCreateRelationship={createRelationshipBetweenEntities}
                onEditRelationship={editRelationship}
                onDeleteRelationship={(relationshipId) => void deleteRelationshipById(relationshipId)}
              />
            </div>
          ) : null}
          {rightInterconOpen ? (
            <div className="min-h-0 flex-1">
              <InterconnectedPanel
                activeNote={activeNote}
                suggestions={relationshipSuggestions}
                popover={relationshipPopover}
                onOpenSuggestion={(suggestion) =>
                  setRelationshipPopover({
                    suggestion,
                    type: suggestion.suggestedType,
                    description: suggestion.snippet
                  })
                }
                onChangeSuggestionType={(type) => setRelationshipPopover((current) => (current ? { ...current, type } : current))}
                onChangeSuggestionDescription={(description) => setRelationshipPopover((current) => (current ? { ...current, description } : current))}
                onConfirmSuggestion={() => void confirmRelationship()}
                onCloseSuggestion={() => setRelationshipPopover(null)}
                relationshipTypes={localRelationshipTypes}
                onEditRelationship={editRelationship}
                onDeleteRelationship={(relationshipId) => void deleteRelationshipById(relationshipId)}
              />
            </div>
          ) : null}
        </aside>
      ) : null}
      {selectionMenu ? (
        <SelectionEntityMenu
          state={selectionMenu}
          onCreateEntity={(text) => {
            setSelectionMenu(null);
            setEntityModal({ mode: "create-from-selection", selectedText: text });
          }}
          onLinkEntity={(text) => {
            setSelectionMenu(null);
            setEntityModal({ mode: "link-selection", selectedText: text });
          }}
        />
      ) : null}
      {activeNote?.entity && connectionModal ? (
        <ConnectionModal
          state={connectionModal}
          currentEntityName={activeNote.entity.name}
          entityOptions={entityOptions}
          relationshipTypes={localRelationshipTypes}
          onClose={() => setConnectionModal(null)}
          onSave={async (input) => {
            await addManualRelationship(input);
            setConnectionModal(null);
          }}
        />
      ) : null}
      {entityModal ? (
        <EntityModal
          state={entityModal}
          currentEntity={linkedEntity}
          entityOptions={entityOptions}
          onClose={() => setEntityModal(null)}
          onCreate={createEntityAndMaybeAttach}
          onAttach={attachEntityToActiveNote}
          onRepair={repairEntity}
          onMerge={mergeActiveEntityInto}
          onLinkSelection={linkSelectionToEntity}
          onFindExisting={findEntityByNameAction}
        />
      ) : null}
      {noteTagsDialog ? (
        <NoteTagsDialog
          state={noteTagsDialog}
          onClose={() => setNoteTagsDialog(null)}
          onSave={async (tags) => {
            await updateNoteTagsForId(noteTagsDialog.noteId, tags);
            setNoteTagsDialog(null);
          }}
        />
      ) : null}
      {noteLockDialog ? (
        <NoteLockDialog
          state={noteLockDialog}
          onClose={() => setNoteLockDialog(null)}
          onSubmit={async (passcode) => {
            if (noteLockDialog.mode === "set") await lockNoteById(noteLockDialog.noteId, passcode);
            else await removeLockFromNote(noteLockDialog.noteId, passcode);
            setNoteLockDialog(null);
          }}
        />
      ) : null}
    </main>
    </>
  );
}

function EntityHeaderBar({ entity, relationships }: { entity: NonNullable<LinkedEntitySummary>; relationships: InterconnectedRelationship[] }) {
  const primaryLocation = relationships.find((relationship) => normalizeInterconnectedType(relationship.otherEntity.type) === "location" && /located|based|operates/i.test(relationship.relationshipType.name));
  const keyAffiliation = relationships.find((relationship) => normalizeInterconnectedType(relationship.otherEntity.type) === "organization" && /member|leader|affiliated/i.test(relationship.relationshipType.name));

  return (
    <div className="mb-4 rounded border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-stone-300">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-black text-white">{entity.name}</span>
        <span className="rounded border border-white/10 px-2 py-0.5 text-xs uppercase tracking-[0.14em] text-stone-500">{entity.type}</span>
        {primaryLocation ? <span>Primary location: <span className="text-stone-100">{primaryLocation.otherEntity.name}</span></span> : null}
        {keyAffiliation ? <span>Key affiliation: <span className="text-stone-100">{keyAffiliation.otherEntity.name}</span></span> : null}
      </div>
      {entity.aliases.length > 0 ? <p className="mt-2 text-xs text-stone-500">Aliases: {entity.aliases.join(", ")}</p> : null}
    </div>
  );
}

function ConnectionModal({
  state,
  currentEntityName,
  entityOptions,
  relationshipTypes,
  onClose,
  onSave
}: {
  state: NonNullable<ConnectionModalState>;
  currentEntityName: string;
  entityOptions: EntityOption[];
  relationshipTypes: RelationshipTypeOption[];
  onClose: () => void;
  onSave: (input: { entityId: string; relationshipTypeId?: string | null; relationshipTypeName?: string | null; description?: string | null }) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [targetEntityId, setTargetEntityId] = useState(state.targetEntityId ?? "");
  const [relationshipTypeId, setRelationshipTypeId] = useState(relationshipTypes[0]?.id ?? "");
  const [newRelationshipTypeName, setNewRelationshipTypeName] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const availableEntities = entityOptions
    .filter((entity) => !normalizedQuery || entity.name.toLowerCase().includes(normalizedQuery) || entity.type.toLowerCase().includes(normalizedQuery))
    .slice(0, 80);
  const targetEntity = entityOptions.find((entity) => entity.id === targetEntityId);

  async function handleSubmit(event: ReactFormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!targetEntityId) {
      setError("Choose an entity.");
      return;
    }
    if (!relationshipTypeId && !newRelationshipTypeName.trim()) {
      setError("Choose or create a relationship type.");
      return;
    }
    setIsSaving(true);
    try {
      await onSave({ entityId: targetEntityId, relationshipTypeId: relationshipTypeId || null, relationshipTypeName: newRelationshipTypeName, description });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Connection could not be saved.");
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="connection-modal-title">
      <form onSubmit={handleSubmit} className="w-full max-w-xl rounded border border-white/10 bg-zinc-950 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="connection-modal-title" className="text-lg font-black text-white">{state.title}</h2>
            <p className="mt-1 text-sm text-stone-500">
              {currentEntityName}
              {targetEntity ? ` -> ${targetEntity.name}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded px-2 py-1 text-sm font-bold text-stone-500 transition hover:bg-white/10 hover:text-white">
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          {!state.targetEntityId ? (
            <>
              <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search entities" className="h-10 rounded border border-white/10 bg-black/40 px-3 text-sm text-white outline-none placeholder:text-stone-600 focus:border-[var(--signal)]/50" />
              <select value={targetEntityId} onChange={(event) => setTargetEntityId(event.target.value)} className="h-10 rounded border border-white/10 bg-black/40 px-3 text-sm text-white outline-none focus:border-[var(--signal)]/50">
                <option value="">Select entity</option>
                {availableEntities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name} ({entity.type})
                  </option>
                ))}
              </select>
            </>
          ) : targetEntity ? (
            <div className="rounded border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-stone-300">
              Connecting to <span className="font-bold text-white">{targetEntity.name}</span> <span className="text-stone-500">({targetEntity.type})</span>
            </div>
          ) : null}

          <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
            Relationship Type
            <select value={relationshipTypeId} onChange={(event) => setRelationshipTypeId(event.target.value)} className="h-10 rounded border border-white/10 bg-black/40 px-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--signal)]/50">
              <option value="">Create new...</option>
              {relationshipTypes.map((relationshipType) => (
                <option key={relationshipType.id} value={relationshipType.id}>
                  {formatRelationshipTypeName(relationshipType.name)}
                </option>
              ))}
            </select>
          </label>
          {!relationshipTypeId ? (
            <input value={newRelationshipTypeName} onChange={(event) => setNewRelationshipTypeName(event.target.value)} placeholder="created, member_of, located_in" className="h-10 rounded border border-white/10 bg-black/40 px-3 text-sm text-white outline-none placeholder:text-stone-600 focus:border-[var(--signal)]/50" />
          ) : null}
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Description (optional)" className="rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-stone-600 focus:border-[var(--signal)]/50" />
          {error ? <p className="text-xs text-red-300">{error}</p> : null}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded border border-white/10 px-3 text-xs font-bold text-stone-400 transition hover:bg-white/10 hover:text-white">
            Cancel
          </button>
          <button type="submit" disabled={isSaving} className="h-9 rounded border border-[var(--signal)]/40 bg-[var(--signal)]/10 px-3 text-xs font-bold text-white transition hover:bg-[var(--signal)]/20 disabled:cursor-not-allowed disabled:opacity-60">
            {isSaving ? "Saving..." : "Create connection"}
          </button>
        </div>
      </form>
    </div>
  );
}

function SelectionEntityMenu({ state, onCreateEntity, onLinkEntity }: { state: NonNullable<SelectionMenuState>; onCreateEntity: (text: string) => void; onLinkEntity: (text: string) => void }) {
  return (
    <div style={{ left: state.x, top: state.y }} className="fixed z-50 grid min-w-44 gap-1 rounded border border-white/10 bg-zinc-950 p-1 text-sm shadow-2xl">
      <button type="button" onClick={() => onCreateEntity(state.text)} className="rounded px-3 py-2 text-left text-stone-200 transition hover:bg-white/10 hover:text-white">
        Create Entity
      </button>
      <button type="button" onClick={() => onLinkEntity(state.text)} className="rounded px-3 py-2 text-left text-stone-200 transition hover:bg-white/10 hover:text-white">
        Link to Entity
      </button>
    </div>
  );
}

function EntityModal({
  state,
  currentEntity,
  entityOptions,
  onClose,
  onCreate,
  onAttach,
  onRepair,
  onMerge,
  onLinkSelection,
  onFindExisting
}: {
  state: NonNullable<EntityModalState>;
  currentEntity: LinkedEntitySummary;
  entityOptions: EntityOption[];
  onClose: () => void;
  onCreate: (input: { name: string; type: string; aliases: string[]; allowDuplicate?: boolean; attachToNote?: boolean; selectedText?: string | null }) => Promise<unknown>;
  onAttach: (entityId: string) => Promise<void>;
  onRepair: (input: { entityId: string; name: string; type: string; aliases: string[] }) => Promise<void>;
  onMerge: (targetEntityId: string) => Promise<void>;
  onLinkSelection: (entityId: string, selectedText: string) => Promise<void>;
  onFindExisting: (input: { name: string; type?: string | null }) => Promise<{ id: string; name: string; type: string; aliases: string[] } | null>;
}) {
  const [name, setName] = useState(state.selectedText ?? (state.mode === "repair" ? currentEntity?.name ?? "" : ""));
  const [type, setType] = useState(state.mode === "repair" ? currentEntity?.type ?? "other" : "character");
  const [aliases, setAliases] = useState(state.mode === "repair" ? currentEntity?.aliases.join(", ") ?? "" : "");
  const [query, setQuery] = useState("");
  const [targetEntityId, setTargetEntityId] = useState("");
  const [existingEntity, setExistingEntity] = useState<{ id: string; name: string; type: string; aliases: string[] } | null>(null);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filteredEntities = entityOptions
    .filter((entity) => entity.id !== currentEntity?.id)
    .filter((entity) => !query.trim() || entity.name.toLowerCase().includes(query.trim().toLowerCase()) || entity.type.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 80);
  const isAttachMode = state.mode === "attach" || state.mode === "link-selection" || state.mode === "merge";
  const title = state.mode === "repair" ? "Repair Entity" : state.mode === "merge" ? "Merge Entity" : state.mode === "link-selection" ? "Link Selection to Entity" : state.mode === "create-from-selection" ? "Create Entity from Selection" : state.mode === "attach" ? "Attach Existing Entity" : "New Entity";

  async function submitCreate(event: ReactFormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      const aliasList = aliases.split(",").map((alias) => alias.trim()).filter(Boolean);
      if (state.mode === "repair" && currentEntity) {
        await onRepair({ entityId: currentEntity.id, name, type, aliases: aliasList });
      } else {
        const found = !allowDuplicate ? await onFindExisting({ name, type }) : null;
        if (found) {
          setExistingEntity(found);
          setIsSaving(false);
          return;
        }
        await onCreate({ name, type, aliases: aliasList, allowDuplicate, attachToNote: state.mode !== "create-from-selection", selectedText: state.selectedText ?? null });
      }
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Entity could not be saved.");
      setIsSaving(false);
    }
  }

  async function submitTarget(event: ReactFormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!targetEntityId) {
      setError("Choose an entity.");
      return;
    }
    setIsSaving(true);
    try {
      if (state.mode === "merge") await onMerge(targetEntityId);
      else if (state.mode === "link-selection" && state.selectedText) await onLinkSelection(targetEntityId, state.selectedText);
      else await onAttach(targetEntityId);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Entity action failed.");
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="entity-modal-title">
      <div className="w-full max-w-xl rounded border border-white/10 bg-zinc-950 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="entity-modal-title" className="text-lg font-black text-white">{title}</h2>
            {state.selectedText ? <p className="mt-1 text-sm text-stone-500">"{state.selectedText}"</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded px-2 py-1 text-sm font-bold text-stone-500 transition hover:bg-white/10 hover:text-white">Close</button>
        </div>

        {isAttachMode ? (
          <form onSubmit={submitTarget} className="mt-5 grid gap-3">
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search entities" className="h-10 rounded border border-white/10 bg-black/40 px-3 text-sm text-white outline-none placeholder:text-stone-600 focus:border-[var(--signal)]/50" />
            <select value={targetEntityId} onChange={(event) => setTargetEntityId(event.target.value)} className="h-10 rounded border border-white/10 bg-black/40 px-3 text-sm text-white outline-none focus:border-[var(--signal)]/50">
              <option value="">Select entity</option>
              {filteredEntities.map((entity) => (
                <option key={entity.id} value={entity.id}>{entity.name} ({entity.type})</option>
              ))}
            </select>
            {error ? <p className="text-xs text-red-300">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="h-9 rounded border border-white/10 px-3 text-xs font-bold text-stone-400 transition hover:bg-white/10 hover:text-white">Cancel</button>
              <button type="submit" disabled={isSaving} className="h-9 rounded border border-[var(--signal)]/40 bg-[var(--signal)]/10 px-3 text-xs font-bold text-white transition hover:bg-[var(--signal)]/20 disabled:opacity-60">{isSaving ? "Saving..." : state.mode === "merge" ? "Merge" : "Link"}</button>
            </div>
          </form>
        ) : (
          <form onSubmit={submitCreate} className="mt-5 grid gap-3">
            <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Entity name" className="h-10 rounded border border-white/10 bg-black/40 px-3 text-sm text-white outline-none placeholder:text-stone-600 focus:border-[var(--signal)]/50" />
            <select value={type} onChange={(event) => setType(event.target.value)} className="h-10 rounded border border-white/10 bg-black/40 px-3 text-sm text-white outline-none focus:border-[var(--signal)]/50">
              {ENTITY_TYPES.map((entityType) => <option key={entityType} value={entityType}>{entityType}</option>)}
            </select>
            <input value={aliases} onChange={(event) => setAliases(event.target.value)} placeholder="Aliases, comma separated" className="h-10 rounded border border-white/10 bg-black/40 px-3 text-sm text-white outline-none placeholder:text-stone-600 focus:border-[var(--signal)]/50" />
            {existingEntity ? (
              <div className="rounded border border-[var(--signal)]/30 bg-[var(--signal)]/10 p-3 text-sm text-stone-200">
                <p className="font-bold text-white">Entity already exists: {existingEntity.name}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => state.selectedText ? onLinkSelection(existingEntity.id, state.selectedText).then(onClose) : onAttach(existingEntity.id).then(onClose)} className="h-8 rounded border border-[var(--signal)]/40 px-3 text-xs font-bold text-white hover:bg-[var(--signal)]/20">Link existing</button>
                  <button type="button" onClick={() => { setAllowDuplicate(true); setExistingEntity(null); }} className="h-8 rounded border border-white/10 px-3 text-xs font-bold text-stone-300 hover:bg-white/10">Create new anyway</button>
                </div>
              </div>
            ) : null}
            {error ? <p className="text-xs text-red-300">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="h-9 rounded border border-white/10 px-3 text-xs font-bold text-stone-400 transition hover:bg-white/10 hover:text-white">Cancel</button>
              <button type="submit" disabled={isSaving} className="h-9 rounded border border-[var(--signal)]/40 bg-[var(--signal)]/10 px-3 text-xs font-bold text-white transition hover:bg-[var(--signal)]/20 disabled:opacity-60">{isSaving ? "Saving..." : "Save Entity"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function SlidingSidePanel({
  open,
  width,
  minWidth,
  side,
  children
}: {
  open: boolean;
  width: number;
  minWidth: number;
  side: "left" | "right";
  children: ReactNode;
}) {
  return (
    <div
      className={`relative z-10 hidden h-full min-h-0 shrink-0 overflow-hidden transition-all duration-200 ease-out lg:block ${open ? "border-l border-white/10 opacity-100" : "pointer-events-none opacity-0"}`}
      style={{
        width: open ? `${width}px` : "0px",
        minWidth: open ? `${minWidth}px` : "0px",
        maxWidth: open ? `${width}px` : "0px",
        transform: open ? "translateX(0)" : side === "right" ? "translateX(12px)" : "translateX(-12px)"
      }}
    >
      <div className="h-full min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

function RightEdgeTabs({
  entityOpen,
  interconOpen,
  onToggleEntity,
  onToggleIntercon
}: {
  entityOpen: boolean;
  interconOpen: boolean;
  onToggleEntity: () => void;
  onToggleIntercon: () => void;
}) {
  return (
    <div className="pointer-events-none fixed bottom-0 right-0 top-16 z-40 hidden lg:flex" style={{ width: RIGHT_RAIL_WIDTH }}>
      <div className="flex h-full w-full flex-col gap-2 border-l border-white/10 bg-zinc-950/95 pt-4 shadow-[-4px_0_18px_rgba(0,0,0,0.28)] backdrop-blur">
      <button
        type="button"
        onClick={onToggleEntity}
        className={`pointer-events-auto flex w-full items-center justify-center rounded-l-md border-l border-y border-white/10 text-[0.72rem] font-bold uppercase tracking-[0.22em] transition [writing-mode:vertical-rl] rotate-180 ${entityOpen ? "bg-[var(--signal)]/15 text-white" : "text-stone-300 hover:bg-white/5 hover:text-white"}`}
        style={{ height: RAIL_BUTTON_HEIGHT }}
      >
        Entity
      </button>
      <button
        type="button"
        onClick={onToggleIntercon}
        className={`pointer-events-auto flex w-full items-center justify-center rounded-l-md border-l border-y border-white/10 text-[0.72rem] font-bold uppercase tracking-[0.22em] transition [writing-mode:vertical-rl] rotate-180 ${interconOpen ? "bg-[var(--signal)]/15 text-white" : "text-stone-300 hover:bg-white/5 hover:text-white"}`}
        style={{ height: RAIL_BUTTON_HEIGHT }}
      >
        Intercon
      </button>
      </div>
    </div>
  );
}

function EntityDrawer({
  entities,
  currentEntity,
  relationships,
  relationshipTypes,
  onCreateEntity,
  onSelectAttach,
  onRepair,
  onMerge,
  onCreateRelationship,
  onEditRelationship,
  onDeleteRelationship
}: {
  entities: EntityRecord[];
  currentEntity: LinkedEntitySummary;
  relationships: InterconnectedRelationship[];
  relationshipTypes: RelationshipTypeOption[];
  onCreateEntity: (input: { name: string; type: string; aliases: string[]; allowDuplicate?: boolean; attachToNote?: boolean; selectedText?: string | null }) => Promise<unknown>;
  onSelectAttach?: (entityId: string) => Promise<void>;
  onRepair: (input: { entityId: string; name: string; type: string; aliases: string[] }) => Promise<void>;
  onMerge: (targetEntityId: string) => Promise<void>;
  onCreateRelationship: (input: { sourceEntity: EntityRecord; targetEntityId: string; relationshipTypeId?: string | null; relationshipTypeName?: string | null; description?: string | null }) => Promise<void>;
  onEditRelationship: (input: { relationshipId: string; relationshipTypeId?: string | null; relationshipTypeName?: string | null; description?: string | null }) => Promise<void>;
  onDeleteRelationship: (relationshipId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [mode, setMode] = useState<"browse" | "new" | "edit">("browse");
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(currentEntity?.id ?? null);
  const selectedEntity = entities.find((entity) => entity.id === selectedEntityId) ?? null;
  const filteredEntities = entities.filter((entity) => {
    const matchesQuery = !query.trim() || entity.name.toLowerCase().includes(query.trim().toLowerCase()) || entity.aliases.some((alias) => alias.toLowerCase().includes(query.trim().toLowerCase()));
    const matchesType = !typeFilter || entity.type === typeFilter;
    return matchesQuery && matchesType;
  });
  const typeOptions = [...new Set(entities.map((entity) => entity.type).filter(Boolean))].sort();

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-white/10 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">Entity</h2>
          <button type="button" onClick={() => { setMode("new"); setSelectedEntityId(null); }} className="h-8 rounded border border-white/10 px-3 text-xs font-bold text-stone-200 transition hover:bg-white/10 hover:text-white">
            + New Entity
          </button>
        </div>
        <div className="mt-3 grid gap-2">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search entities" className="h-9 rounded border border-white/10 bg-black/40 px-3 text-sm text-white outline-none placeholder:text-stone-600 focus:border-[var(--signal)]/50" />
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-9 rounded border border-white/10 bg-black/40 px-3 text-sm text-white outline-none focus:border-[var(--signal)]/50">
            <option value="">All types</option>
            {typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
      </div>
      <div className="panel-scroll flex-1 px-4 py-4">
        {mode === "browse" ? (
          <div className="grid gap-2">
            {currentEntity ? <p className="mb-2 rounded border border-[var(--signal)]/25 bg-[var(--signal)]/10 px-3 py-2 text-xs text-stone-200">Current: <span className="font-bold text-white">{currentEntity.name}</span></p> : null}
            {filteredEntities.map((entity) => (
              <button
                key={entity.id}
                type="button"
                onClick={() => { setSelectedEntityId(entity.id); setMode("edit"); }}
                className={`rounded border px-3 py-3 text-left transition ${currentEntity?.id === entity.id ? "border-[var(--signal)]/45 bg-[var(--signal)]/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"}`}
              >
                <span className="block font-bold text-white">{entity.name}</span>
                <span className="mt-1 block text-xs uppercase tracking-[0.14em] text-stone-500">{entity.type}</span>
              </button>
            ))}
          </div>
        ) : (
          <EntityDrawerEditor
            mode={mode}
            entity={selectedEntity}
            entities={entities}
            currentEntity={currentEntity}
            relationships={selectedEntity?.id === currentEntity?.id ? relationships : []}
            relationshipTypes={relationshipTypes}
            onBack={() => setMode("browse")}
            onCreateEntity={onCreateEntity}
            onSelectAttach={onSelectAttach}
            onRepair={onRepair}
            onMerge={onMerge}
            onCreateRelationship={onCreateRelationship}
            onEditRelationship={onEditRelationship}
            onDeleteRelationship={onDeleteRelationship}
          />
        )}
      </div>
    </section>
  );
}

function EntityDrawerEditor({
  mode,
  entity,
  entities,
  currentEntity,
  relationships,
  relationshipTypes,
  onBack,
  onCreateEntity,
  onSelectAttach,
  onRepair,
  onMerge,
  onCreateRelationship,
  onEditRelationship,
  onDeleteRelationship
}: {
  mode: "new" | "edit";
  entity: EntityRecord | null;
  entities: EntityRecord[];
  currentEntity: LinkedEntitySummary;
  relationships: InterconnectedRelationship[];
  relationshipTypes: RelationshipTypeOption[];
  onBack: () => void;
  onCreateEntity: (input: { name: string; type: string; aliases: string[]; allowDuplicate?: boolean; attachToNote?: boolean; selectedText?: string | null }) => Promise<unknown>;
  onSelectAttach?: (entityId: string) => Promise<void>;
  onRepair: (input: { entityId: string; name: string; type: string; aliases: string[] }) => Promise<void>;
  onMerge: (targetEntityId: string) => Promise<void>;
  onCreateRelationship: (input: { sourceEntity: EntityRecord; targetEntityId: string; relationshipTypeId?: string | null; relationshipTypeName?: string | null; description?: string | null }) => Promise<void>;
  onEditRelationship: (input: { relationshipId: string; relationshipTypeId?: string | null; relationshipTypeName?: string | null; description?: string | null }) => Promise<void>;
  onDeleteRelationship: (relationshipId: string) => void;
}) {
  const [name, setName] = useState(entity?.name ?? "");
  const [type, setType] = useState(entity?.type ?? "character");
  const [aliases, setAliases] = useState(entity?.aliases.join(", ") ?? "");
  const [description, setDescription] = useState(entity?.description ?? "");
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [connectionTargetId, setConnectionTargetId] = useState("");
  const [connectionTypeId, setConnectionTypeId] = useState(relationshipTypes[0]?.id ?? "");
  const [connectionTypeName, setConnectionTypeName] = useState("");
  const [connectionDescription, setConnectionDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(entity?.name ?? "");
    setType(entity?.type ?? "character");
    setAliases(entity?.aliases.join(", ") ?? "");
    setDescription(entity?.description ?? "");
  }, [entity?.id, entity?.name, entity?.type, entity?.aliases, entity?.description]);

  async function saveEntity(event: ReactFormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      const aliasList = aliases.split(",").map((alias) => alias.trim()).filter(Boolean);
      if (mode === "new") await onCreateEntity({ name, type, aliases: aliasList, attachToNote: false });
      else if (entity) await onRepair({ entityId: entity.id, name, type, aliases: aliasList });
      onBack();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Entity could not be saved.");
      setIsSaving(false);
    }
  }

  async function addConnection(event: ReactFormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!entity || !connectionTargetId) return;
    setError(null);
    setIsSaving(true);
    try {
      await onCreateRelationship({
        sourceEntity: entity,
        targetEntityId: connectionTargetId,
        relationshipTypeId: connectionTypeId || null,
        relationshipTypeName: connectionTypeName,
        description: connectionDescription
      });
      setConnectionTargetId("");
      setConnectionTypeName("");
      setConnectionDescription("");
      setIsSaving(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Connection could not be saved.");
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-5">
      <button type="button" onClick={onBack} className="w-fit text-xs font-bold uppercase tracking-[0.14em] text-stone-500 transition hover:text-white">Back</button>
      <form onSubmit={saveEntity} className="grid gap-3">
        <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} required className="h-10 rounded border border-white/10 bg-black/40 px-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--signal)]/50" />
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
          Type
          <select value={type} onChange={(event) => setType(event.target.value)} className="h-10 rounded border border-white/10 bg-black/40 px-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--signal)]/50">
            {ENTITY_TYPES.map((entityType) => <option key={entityType} value={entityType}>{entityType}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
          Aliases
          <input value={aliases} onChange={(event) => setAliases(event.target.value)} placeholder="Comma separated" className="h-10 rounded border border-white/10 bg-black/40 px-3 text-sm normal-case tracking-normal text-white outline-none placeholder:text-stone-600 focus:border-[var(--signal)]/50" />
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
          Description
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="Entity description" className="rounded border border-white/10 bg-black/40 px-3 py-2 text-sm normal-case tracking-normal text-white outline-none placeholder:text-stone-600 focus:border-[var(--signal)]/50" />
        </label>
        {error ? <p className="text-xs text-red-300">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={isSaving} className="h-9 rounded border border-[var(--signal)]/40 bg-[var(--signal)]/10 px-3 text-xs font-bold text-white transition hover:bg-[var(--signal)]/20 disabled:opacity-60">{isSaving ? "Saving..." : "Save"}</button>
          {entity && onSelectAttach ? <button type="button" onClick={() => void onSelectAttach(entity.id)} className="h-9 rounded border border-white/10 px-3 text-xs font-bold text-stone-300 transition hover:bg-white/10 hover:text-white">Attach to note</button> : null}
          {entity ? <button type="button" disabled title="Delete entity requires a backend action and is intentionally disabled in this UI-only pass." className="h-9 rounded border border-white/10 px-3 text-xs font-bold text-stone-600 opacity-60">Delete Entity</button> : null}
        </div>
      </form>

      {entity ? (
        <>
          <div className="border-t border-white/10 pt-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">Relationships</h3>
            {relationships.length === 0 ? <p className="mt-2 text-sm text-stone-500">{currentEntity?.id === entity.id ? "No connections yet." : "Open this entity's note to view contextual connections."}</p> : null}
            <div className="mt-3 grid gap-3">
              {relationships.map((relationship) => (
                <RelationshipRowEditor key={relationship.id} currentEntityName={entity.name} relationship={relationship} relationshipTypes={relationshipTypes} onEditRelationship={onEditRelationship} onDeleteRelationship={onDeleteRelationship} />
              ))}
            </div>
          </div>

          <form onSubmit={addConnection} className="grid gap-3 border-t border-white/10 pt-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">+ Add Connection</h3>
            <select value={connectionTargetId} onChange={(event) => setConnectionTargetId(event.target.value)} className="h-10 rounded border border-white/10 bg-black/40 px-3 text-sm text-white outline-none focus:border-[var(--signal)]/50">
              <option value="">Target entity</option>
              {entities.filter((option) => option.id !== entity.id).map((option) => <option key={option.id} value={option.id}>{option.name} ({option.type})</option>)}
            </select>
            <select value={connectionTypeId} onChange={(event) => setConnectionTypeId(event.target.value)} className="h-10 rounded border border-white/10 bg-black/40 px-3 text-sm text-white outline-none focus:border-[var(--signal)]/50">
              <option value="">Create new relationship type</option>
              {relationshipTypes.map((relationshipType) => <option key={relationshipType.id} value={relationshipType.id}>{formatRelationshipTypeName(relationshipType.name)}</option>)}
            </select>
            {!connectionTypeId ? <input value={connectionTypeName} onChange={(event) => setConnectionTypeName(event.target.value)} placeholder="ally_of, created, located_in" className="h-10 rounded border border-white/10 bg-black/40 px-3 text-sm text-white outline-none placeholder:text-stone-600 focus:border-[var(--signal)]/50" /> : null}
            <textarea value={connectionDescription} onChange={(event) => setConnectionDescription(event.target.value)} rows={3} placeholder="Description" className="rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-stone-600 focus:border-[var(--signal)]/50" />
            <button type="submit" disabled={!connectionTargetId || isSaving} className="h-9 rounded border border-[var(--signal)]/40 bg-[var(--signal)]/10 px-3 text-xs font-bold text-white transition hover:bg-[var(--signal)]/20 disabled:opacity-60">Add Connection</button>
          </form>

          <div className="border-t border-white/10 pt-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">Merge Entity</h3>
            <div className="mt-3 grid gap-2">
              <select value={mergeTargetId} onChange={(event) => setMergeTargetId(event.target.value)} className="h-10 rounded border border-white/10 bg-black/40 px-3 text-sm text-white outline-none focus:border-[var(--signal)]/50">
                <option value="">Merge into...</option>
                {entities.filter((option) => option.id !== entity.id).map((option) => <option key={option.id} value={option.id}>{option.name} ({option.type})</option>)}
              </select>
              <button type="button" disabled={!mergeTargetId} onClick={() => void onMerge(mergeTargetId)} className="h-9 rounded border border-white/10 px-3 text-xs font-bold text-stone-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50">Merge Entity</button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function RelationshipRowEditor({ currentEntityName, relationship, relationshipTypes, onEditRelationship, onDeleteRelationship }: { currentEntityName: string; relationship: InterconnectedRelationship; relationshipTypes: RelationshipTypeOption[]; onEditRelationship: (input: { relationshipId: string; relationshipTypeId?: string | null; relationshipTypeName?: string | null; description?: string | null }) => Promise<void>; onDeleteRelationship: (relationshipId: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [typeId, setTypeId] = useState(relationship.relationshipType.id);
  const [description, setDescription] = useState(relationship.description ?? "");
  const [error, setError] = useState<string | null>(null);

  if (editing) {
    return (
      <form
        className="grid gap-2 rounded border border-white/10 bg-black/25 p-2"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          onEditRelationship({ relationshipId: relationship.id, relationshipTypeId: typeId, description })
            .then(() => setEditing(false))
            .catch((caught) => setError(caught instanceof Error ? caught.message : "Relationship could not be updated."));
        }}
      >
        <select value={typeId} onChange={(event) => setTypeId(event.target.value)} className="h-8 rounded border border-white/10 bg-black/40 px-2 text-xs text-white outline-none focus:border-[var(--signal)]/50">
          {relationshipTypes.map((relationshipType) => <option key={relationshipType.id} value={relationshipType.id}>{formatRelationshipTypeName(relationshipType.name)}</option>)}
        </select>
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white outline-none focus:border-[var(--signal)]/50" />
        {error ? <p className="text-xs text-red-300">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setEditing(false)} className="h-7 rounded border border-white/10 px-2 text-xs font-bold text-stone-400 hover:bg-white/10">Cancel</button>
          <button type="submit" className="h-7 rounded border border-[var(--signal)]/40 px-2 text-xs font-bold text-white hover:bg-[var(--signal)]/10">Save</button>
        </div>
      </form>
    );
  }

  return (
    <div className="rounded border border-white/10 bg-white/[0.03] p-2 text-sm text-stone-300">
      <span className="font-bold text-stone-100">{currentEntityName}</span>
      <span className="text-stone-500"> {"->"} {formatRelationshipTypeName(relationship.relationshipType.name)} {"->"} </span>
      <span className="font-bold text-stone-100">{relationship.otherEntity.name}</span>
      {relationship.description ? <p className="mt-1 text-xs leading-5 text-stone-500">{relationship.description}</p> : null}
      <div className="mt-1 flex gap-2">
        <button type="button" onClick={() => setEditing(true)} className="text-xs font-bold text-stone-500 transition hover:text-white">Edit</button>
        <button type="button" onClick={() => onDeleteRelationship(relationship.id)} className="text-xs font-bold text-stone-500 transition hover:text-red-300">Delete</button>
      </div>
    </div>
  );
}

function InterconnectedPanel({
  activeNote,
  suggestions,
  popover,
  relationshipTypes,
  onOpenSuggestion,
  onChangeSuggestionType,
  onChangeSuggestionDescription,
  onConfirmSuggestion,
  onCloseSuggestion,
  onEditRelationship,
  onDeleteRelationship
}: {
  activeNote: WorkspaceSelectedNote | null;
  suggestions: EditorRelationshipSuggestion[];
  popover: RelationshipPopoverState;
  relationshipTypes: RelationshipTypeOption[];
  onOpenSuggestion: (suggestion: EditorRelationshipSuggestion) => void;
  onChangeSuggestionType: (type: string) => void;
  onChangeSuggestionDescription: (description: string) => void;
  onConfirmSuggestion: () => void;
  onCloseSuggestion: () => void;
  onEditRelationship: (input: { relationshipId: string; relationshipTypeId?: string | null; relationshipTypeName?: string | null; description?: string | null }) => Promise<void>;
  onDeleteRelationship: (relationshipId: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTypeId, setEditTypeId] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const currentEntityName = activeNote?.entity?.name ?? "";
  const relationships = activeNote?.interconnections ?? [];
  const grouped = groupInterconnections(relationships);
  const sections = [
    { title: "Organizations", relationships: grouped.organization },
    { title: "Characters", relationships: grouped.character },
    { title: "Locations", relationships: grouped.location },
    { title: "Concepts", relationships: grouped.concept }
  ].filter((section) => section.relationships.length > 0);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-white/10 px-4 py-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">Interconnected</h2>
        {activeNote?.entity ? <p className="mt-1 text-sm font-bold text-white">{activeNote.entity.name}</p> : null}
      </div>
      <div className="panel-scroll flex-1 px-4 py-4">
        {!activeNote ? <p className="text-sm leading-6 text-stone-500">Select a note to view relationships</p> : null}
        {activeNote && !activeNote.entity ? <p className="text-sm leading-6 text-stone-500">No entity linked to this note</p> : null}
        {activeNote?.entity && suggestions.length > 0 ? (
          <RelationshipSuggestions
            suggestions={suggestions}
            popover={popover}
            onOpen={onOpenSuggestion}
            onChangeType={onChangeSuggestionType}
            onChangeDescription={onChangeSuggestionDescription}
            onConfirm={onConfirmSuggestion}
            onClose={onCloseSuggestion}
          />
        ) : null}
        {activeNote?.entity && sections.length === 0 ? <p className="text-sm leading-6 text-stone-500">Start building connections by mentioning other entities in your notes.</p> : null}
        <div className="grid gap-6">
        {sections.map((section) => (
          <div key={section.title}>
            <h3 className="text-sm font-black text-white">{section.title}</h3>
            <ul className="mt-2 grid gap-2">
              {section.relationships.map((relationship) => (
                <li key={relationship.id} className="text-sm text-stone-300">
                  {editingId === relationship.id ? (
                    <form
                      className="grid gap-2 rounded border border-white/10 bg-black/25 p-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        setEditError(null);
                        onEditRelationship({ relationshipId: relationship.id, relationshipTypeId: editTypeId, description: editDescription })
                          .then(() => setEditingId(null))
                          .catch((caught) => setEditError(caught instanceof Error ? caught.message : "Relationship could not be updated."));
                      }}
                    >
                      <select value={editTypeId} onChange={(event) => setEditTypeId(event.target.value)} className="h-8 rounded border border-white/10 bg-black/40 px-2 text-xs text-white outline-none focus:border-[var(--signal)]/50">
                        {relationshipTypes.map((relationshipType) => (
                          <option key={relationshipType.id} value={relationshipType.id}>
                            {formatRelationshipTypeName(relationshipType.name)}
                          </option>
                        ))}
                      </select>
                      <textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value)} rows={2} className="rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white outline-none focus:border-[var(--signal)]/50" />
                      {editError ? <p className="text-xs text-red-300">{editError}</p> : null}
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setEditingId(null)} className="h-7 rounded border border-white/10 px-2 text-xs font-bold text-stone-400 hover:bg-white/10">Cancel</button>
                        <button type="submit" className="h-7 rounded border border-[var(--signal)]/40 px-2 text-xs font-bold text-white hover:bg-[var(--signal)]/10">Save</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <span className="font-bold text-stone-100">{currentEntityName}</span>
                      <span className="text-stone-500"> {"->"} {formatRelationshipTypeName(relationship.relationshipType.name)} {"->"} </span>
                      {relationship.otherEntity.noteId ? (
                        <a href={`/notes?note=${relationship.otherEntity.noteId}`} className="font-bold text-stone-100 transition hover:text-[var(--signal)]">
                          {relationship.otherEntity.name}
                        </a>
                      ) : (
                        <span className="font-bold text-stone-100">{relationship.otherEntity.name}</span>
                      )}
                      {relationship.description ? <p className="mt-1 text-xs leading-5 text-stone-500">{relationship.description}</p> : null}
                      <div className="mt-1 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(relationship.id);
                            setEditTypeId(relationship.relationshipType.id);
                            setEditDescription(relationship.description ?? "");
                            setEditError(null);
                          }}
                          className="text-xs font-bold text-stone-500 transition hover:text-white"
                        >
                          Edit
                        </button>
                        <button type="button" onClick={() => onDeleteRelationship(relationship.id)} className="text-xs font-bold text-stone-500 transition hover:text-red-300">
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
        </div>
      </div>
    </section>
  );
}

function groupInterconnections(relationships: InterconnectedRelationship[]) {
  const grouped = {
    character: [] as InterconnectedRelationship[],
    organization: [] as InterconnectedRelationship[],
    location: [] as InterconnectedRelationship[],
    concept: [] as InterconnectedRelationship[]
  };

  for (const relationship of relationships) {
    const type = normalizeInterconnectedType(relationship.otherEntity.type);
    if (type === "character" || type === "organization" || type === "location" || type === "concept") grouped[type].push(relationship);
  }

  for (const values of Object.values(grouped)) {
    values.sort((left, right) => left.otherEntity.name.localeCompare(right.otherEntity.name) || left.relationshipType.name.localeCompare(right.relationshipType.name));
  }

  return grouped;
}

function normalizeInterconnectedType(value: string) {
  const type = value.toLowerCase().trim().replace(/_/g, "-");
  if (type === "team") return "organization";
  return type;
}

function formatRelationshipTypeName(value: string) {
  return value.replace(/_/g, " ");
}

function isInvalidEntityName(value: string | null | undefined) {
  const name = value?.trim();
  if (!name) return true;
  return /^untitled(\s+(character|organization|location|story|entity|note))?$/i.test(name) || /^unknown(\s+entity)?$/i.test(name);
}

function mergeRelationshipTypes(current: RelationshipTypeOption[], nextType: RelationshipTypeOption) {
  if (current.some((relationshipType) => relationshipType.id === nextType.id || relationshipType.name === nextType.name)) return current;
  return [...current, nextType].sort((left, right) => Number(right.isSystem) - Number(left.isSystem) || left.name.localeCompare(right.name));
}

function buildEntityRecords(entityOptions: EntityOption[], entityIndex: EntityIndexEntry[]): EntityRecord[] {
  const aliasesById = new Map<string, string[]>();
  for (const entry of entityIndex) {
    if (!entry.alias) continue;
    aliasesById.set(entry.id, [...(aliasesById.get(entry.id) ?? []), entry.alias]);
  }
  return entityOptions.map((entity) => ({
    ...entity,
    aliases: [...new Set(aliasesById.get(entity.id) ?? [])],
    description: null
  }));
}

function mergeEntityIndexEntries(current: EntityIndexEntry[], entity: { id: string; name: string; type: string; aliases?: string[] }, keys: string[]) {
  const existingKeys = new Set(current.map((entry) => `${entry.id}:${normalizeEntityMatchKey(entry.matchKey)}`));
  const additions = keys.flatMap((key) => {
    const clean = key.trim();
    if (!clean) return [];
    const dedupeKey = `${entity.id}:${normalizeEntityMatchKey(clean)}`;
    if (existingKeys.has(dedupeKey)) return [];
    existingKeys.add(dedupeKey);
    return [{
      id: entity.id,
      title: entity.name,
      type: entity.type,
      matchKey: clean,
      alias: clean === entity.name ? undefined : clean
    }];
  });
  return [...current, ...additions];
}

function normalizeEntityMatchKey(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function mergeInterconnections(current: InterconnectedRelationship[], nextConnection: InterconnectedRelationship) {
  const existing = current.find((relationship) => relationship.id === nextConnection.id || relationship.otherEntity.id === nextConnection.otherEntity.id);
  if (!existing) return [...current, nextConnection];
  return current.map((relationship) =>
    relationship === existing
      ? {
          ...relationship,
          relationshipType: nextConnection.relationshipType,
          type: nextConnection.type,
          description: nextConnection.description ?? relationship.description
        }
      : relationship
  );
}

function StaticNoteItem({
  note,
  isSelected,
  color,
  onOpen,
  isEditingTitle,
  editingTitle,
  onBeginTitleEdit,
  onEditingTitleChange,
  onSaveTitle,
  onCancelTitleEdit,
  onTogglePinned,
  onContextMenu,
  onLongPressContextMenu
}: {
  note: WorkspaceNoteListItem;
  isSelected: boolean;
  color?: string;
  onOpen: () => void;
  isEditingTitle: boolean;
  editingTitle: string;
  onBeginTitleEdit: () => void;
  onEditingTitleChange: (value: string) => void;
  onSaveTitle: () => void;
  onCancelTitleEdit: () => void;
  onTogglePinned: (noteId: string) => void;
  onContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onLongPressContextMenu: (position: { x: number; y: number }) => void;
}) {
  return (
    <div>
      <NoteItemContent
        note={note}
        isSelected={isSelected}
        color={color}
        isDragging={false}
        isEditingTitle={isEditingTitle}
        editingTitle={editingTitle}
        onOpen={onOpen}
        onBeginTitleEdit={onBeginTitleEdit}
        onEditingTitleChange={onEditingTitleChange}
        onSaveTitle={onSaveTitle}
        onCancelTitleEdit={onCancelTitleEdit}
        onTogglePinned={onTogglePinned}
        onContextMenu={onContextMenu}
        onLongPressContextMenu={onLongPressContextMenu}
      />
    </div>
  );
}

type ExportableNote = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
  navigationNodeId: string | null;
  navigationLabel: string;
  isPinned: boolean;
  sortOrder: number;
};

function ExportMenu({ note }: { note: ExportableNote }) {
  const [open, setOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  async function runExport(format: "markdown" | "pdf" | "docx" | "json") {
    setOpen(false);
    setIsExporting(true);
    try {
      if (format === "markdown") exportMarkdown(note);
      if (format === "json") exportJson(note);
      if (format === "pdf") exportPdf(note);
      if (format === "docx") await exportDocx(note);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((current) => !current)} disabled={isExporting} className="h-9 rounded border border-white/10 px-3 text-xs font-bold text-stone-200 transition hover:bg-white/10 hover:text-white disabled:opacity-60">
        {isExporting ? "Exporting..." : "Export"}
      </button>
      {open ? (
        <div className="absolute right-0 top-10 z-40 min-w-44 rounded border border-white/10 bg-zinc-950 py-1 text-sm text-stone-200 shadow-xl">
          <ExportButton label="Markdown (.md)" onClick={() => runExport("markdown")} />
          <ExportButton label="PDF (.pdf)" onClick={() => runExport("pdf")} />
          <ExportButton label="Word (.docx)" onClick={() => runExport("docx")} />
          <ExportButton label="JSON (.json)" onClick={() => runExport("json")} />
        </div>
      ) : null}
    </div>
  );
}

function ExportButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="block w-full px-3 py-2 text-left hover:bg-white/10">
      {label}
    </button>
  );
}

function EditorToolbar({ actions }: { actions: RichTextEditorActions | null }) {
  return (
    <div className="flex items-center gap-1 rounded border border-white/10 bg-white/[0.03] p-1">
      <select
        aria-label="Text style"
        defaultValue="body"
        onChange={(event) => actions?.setTextStyle(event.target.value as "title" | "heading" | "subheading" | "body")}
        disabled={!actions}
        className="h-7 rounded border border-white/10 bg-black/40 px-2 text-xs font-bold text-stone-200 outline-none disabled:opacity-50"
      >
        <option value="title">Title</option>
        <option value="heading">Heading</option>
        <option value="subheading">Subheading</option>
        <option value="body">Body</option>
      </select>
      <span className="mx-1 h-5 w-px bg-white/10" />
      <EditorToolbarButton label="B" title="Bold" onClick={() => actions?.toggleBold()} disabled={!actions} />
      <EditorToolbarButton label="I" title="Italic" onClick={() => actions?.toggleItalic()} disabled={!actions} italic />
      <EditorToolbarButton label="U" title="Underline" onClick={() => actions?.toggleUnderline()} disabled={!actions} underline />
      <span className="mx-1 h-5 w-px bg-white/10" />
      <EditorToolbarButton label="•" title="Bullet List" onClick={() => actions?.toggleBulletList()} disabled={!actions} />
      <EditorToolbarButton label="1." title="Number List" onClick={() => actions?.toggleOrderedList()} disabled={!actions} />
      <EditorToolbarButton label="Table" title="Insert Table" onClick={() => actions?.insertTable()} disabled={!actions} />
    </div>
  );
}

function EditorToolbarButton({ label, title, onClick, disabled, italic, underline }: { label: string; title: string; onClick: () => void; disabled?: boolean; italic?: boolean; underline?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`h-7 min-w-7 rounded px-2 text-xs font-bold text-stone-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 ${italic ? "italic" : ""} ${underline ? "underline" : ""}`}
    >
      {label}
    </button>
  );
}

function RelationshipSuggestions({
  suggestions,
  popover,
  onOpen,
  onChangeType,
  onChangeDescription,
  onConfirm,
  onClose
}: {
  suggestions: EditorRelationshipSuggestion[];
  popover: RelationshipPopoverState;
  onOpen: (suggestion: EditorRelationshipSuggestion) => void;
  onChangeType: (type: string) => void;
  onChangeDescription: (description: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="relative mt-4 flex flex-wrap items-center gap-2 text-xs">
      <span className="font-bold uppercase tracking-[0.16em] text-stone-500">Suggested links</span>
      {suggestions.map((suggestion) => (
        <button key={suggestion.id} type="button" onClick={() => onOpen(suggestion)} className="rounded border border-white/10 bg-white/[0.03] px-2 py-1 text-stone-300 transition hover:border-[var(--signal)]/40 hover:bg-[var(--signal)]/10 hover:text-white">
          {suggestion.entityA.title} ↔ {suggestion.entityB.title} <span className="text-[var(--signal)]">[+]</span>
        </button>
      ))}
      {popover ? (
        <div className="absolute left-0 top-9 z-40 min-w-80 max-w-md rounded border border-white/10 bg-zinc-950 p-3 text-stone-200 shadow-xl">
          <p className="text-sm font-black text-white">
            {popover.suggestion.entityA.title} ↔ {popover.suggestion.entityB.title}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            {popover.suggestion.entityA.type} / {popover.suggestion.entityB.type}
          </p>
          <label className="mt-3 block text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
            Relationship
            <select value={popover.type} onChange={(event) => onChangeType(event.target.value)} className="mt-1 h-9 w-full rounded border border-white/10 bg-black/40 px-2 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--signal)]/50">
              {popover.suggestion.typeOptions.map((type) => (
                <option key={type} value={type}>
                  {formatRelationshipTypeName(type)}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
            Description
            <textarea value={popover.description} onChange={(event) => onChangeDescription(event.target.value)} rows={3} className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-2 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--signal)]/50" />
          </label>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="h-8 rounded border border-white/10 px-3 text-xs font-bold text-stone-400 transition hover:bg-white/10 hover:text-white">
              Ignore
            </button>
            <button type="button" onClick={onConfirm} className="h-8 rounded border border-[var(--signal)]/40 bg-[var(--signal)]/10 px-3 text-xs font-bold text-white transition hover:bg-[var(--signal)]/20">
              Confirm
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NoteContextMenu({
  state,
  onTogglePinned,
  onTag,
  onDuplicate,
  onRename,
  onMove,
  onDelete,
  onToggleLock,
  onSetColor,
  navigationOptions
}: {
  state: NonNullable<NoteContextMenuState>;
  onTogglePinned: (note: WorkspaceNoteListItem) => void;
  onTag: (note: WorkspaceNoteListItem) => void;
  onDuplicate: (note: WorkspaceNoteListItem) => void;
  onRename: (note: WorkspaceNoteListItem) => void;
  onMove: (note: WorkspaceNoteListItem, navigationNodeId: string | null) => void;
  onDelete: (note: WorkspaceNoteListItem) => void;
  onToggleLock: (note: WorkspaceNoteListItem) => void;
  onSetColor: (noteId: string, color: string) => void;
  navigationOptions: NavigationNodeOption[];
}) {
  const [moveOpen, setMoveOpen] = useState(false);

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      className="fixed z-50 min-w-52 rounded border border-white/10 bg-zinc-950 py-1 text-sm text-stone-200 shadow-xl"
      style={{ left: state.x, top: state.y }}
    >
      <button type="button" onClick={() => onTogglePinned(state.note)} className="block w-full px-3 py-2 text-left hover:bg-white/10">
        {state.note.isPinned ? "Unpin" : "Pin"}
      </button>
      <button type="button" onClick={() => onTag(state.note)} className="block w-full px-3 py-2 text-left hover:bg-white/10">
        Tag
      </button>
      <button type="button" onClick={() => onDuplicate(state.note)} className="block w-full px-3 py-2 text-left hover:bg-white/10">
        Duplicate
      </button>
      <button type="button" onClick={() => onRename(state.note)} className="block w-full px-3 py-2 text-left hover:bg-white/10">
        Rename
      </button>
      <button type="button" onClick={() => setMoveOpen((open) => !open)} className="block w-full px-3 py-2 text-left hover:bg-white/10">
        Move to...
      </button>
      {moveOpen ? (
        <div className="border-y border-white/10 px-3 py-2">
          <select
            autoFocus
            defaultValue={state.note.navigationNodeId ?? "unassigned"}
            onChange={(event) => onMove(state.note, event.target.value === "unassigned" ? null : event.target.value)}
            className="h-8 w-full rounded border border-white/10 bg-black/50 px-2 text-xs text-stone-100 outline-none focus:border-[var(--signal)]/50"
          >
            <option value="unassigned">Unassigned</option>
            {navigationOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.fullPath}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="border-y border-white/10 px-3 py-2">
        <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-stone-500">Change Color</p>
        <div className="flex gap-1">
          {NOTE_COLORS.map((color) => (
            <button
              key={color.id}
              type="button"
              aria-label={color.label}
              title={color.label}
              onClick={() => onSetColor(state.note.id, color.value)}
              className="grid h-6 w-6 place-items-center rounded border border-white/10 hover:border-white/40"
            >
              <span className="h-3 w-3 rounded-sm border border-white/10" style={{ backgroundColor: color.value || "transparent" }} />
            </button>
          ))}
        </div>
      </div>
      <button type="button" onClick={() => onToggleLock(state.note)} className="block w-full px-3 py-2 text-left hover:bg-white/10">
        {state.note.isLocked ? "Unlock" : "Lock"}
      </button>
      <button type="button" onClick={() => onDelete(state.note)} className="block w-full px-3 py-2 text-left text-red-200 hover:bg-red-500/10">
        Delete
      </button>
    </div>
  );
}

function SortableNoteItem({
  note,
  isSelected,
  color,
  onOpen,
  isEditingTitle,
  editingTitle,
  onBeginTitleEdit,
  onEditingTitleChange,
  onSaveTitle,
  onCancelTitleEdit,
  onTogglePinned,
  onContextMenu,
  onLongPressContextMenu
}: {
  note: WorkspaceNoteListItem;
  isSelected: boolean;
  color?: string;
  onOpen: () => void;
  isEditingTitle: boolean;
  editingTitle: string;
  onBeginTitleEdit: () => void;
  onEditingTitleChange: (value: string) => void;
  onSaveTitle: () => void;
  onCancelTitleEdit: () => void;
  onTogglePinned: (noteId: string) => void;
  onContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onLongPressContextMenu: (position: { x: number; y: number }) => void;
}) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({ id: `note:${note.id}` });

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={isDragging ? "opacity-60" : undefined}>
      <NoteItemContent
        note={note}
        isSelected={isSelected}
        color={color}
        isDragging={isDragging}
        dragAttributes={attributes}
        dragListeners={listeners}
        isEditingTitle={isEditingTitle}
        editingTitle={editingTitle}
        onOpen={onOpen}
        onBeginTitleEdit={onBeginTitleEdit}
        onEditingTitleChange={onEditingTitleChange}
        onSaveTitle={onSaveTitle}
        onCancelTitleEdit={onCancelTitleEdit}
        onTogglePinned={onTogglePinned}
        onContextMenu={onContextMenu}
        onLongPressContextMenu={onLongPressContextMenu}
      />
    </div>
  );
}

function NoteItemContent({
  note,
  isSelected,
  color,
  isDragging,
  dragAttributes,
  dragListeners,
  isEditingTitle,
  editingTitle,
  onOpen,
  onBeginTitleEdit,
  onEditingTitleChange,
  onSaveTitle,
  onCancelTitleEdit,
  onTogglePinned,
  onContextMenu,
  onLongPressContextMenu
}: {
  note: WorkspaceNoteListItem;
  isSelected: boolean;
  color?: string;
  isDragging: boolean;
  dragAttributes?: DraggableAttributes;
  dragListeners?: DraggableSyntheticListeners;
  isEditingTitle: boolean;
  editingTitle: string;
  onOpen: () => void;
  onBeginTitleEdit: () => void;
  onEditingTitleChange: (value: string) => void;
  onSaveTitle: () => void;
  onCancelTitleEdit: () => void;
  onTogglePinned: (noteId: string) => void;
  onContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onLongPressContextMenu: (position: { x: number; y: number }) => void;
}) {
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  function clearLongPressTimer() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function handleTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];
    if (!touch || isEditingTitle) return;
    longPressTriggeredRef.current = false;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      onLongPressContextMenu({ x: touch.clientX, y: touch.clientY });
    }, 500);
  }

  function handleTouchMove(event: ReactTouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];
    const origin = touchStartRef.current;
    if (!touch || !origin) return;
    if (Math.abs(touch.clientX - origin.x) > 10 || Math.abs(touch.clientY - origin.y) > 10) clearLongPressTimer();
  }

  function handleTouchEnd(event: ReactTouchEvent<HTMLDivElement>) {
    clearLongPressTimer();
    touchStartRef.current = null;
    if (!longPressTriggeredRef.current) return;
    event.preventDefault();
    event.stopPropagation();
  }

  useEffect(() => () => clearLongPressTimer(), []);

  return (
    <div
      {...dragAttributes}
      {...dragListeners}
      onClick={(event) => {
        if (longPressTriggeredRef.current) {
          event.preventDefault();
          event.stopPropagation();
          longPressTriggeredRef.current = false;
          return;
        }
        onOpen();
      }}
      onContextMenu={onContextMenu}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      style={{ borderLeftColor: color || "transparent", backgroundColor: color && !isSelected ? `${color}12` : undefined }}
      className={`group flex min-w-0 cursor-pointer overflow-hidden border-l-2 ${isDragging ? "cursor-grab active:cursor-grabbing" : ""} items-stretch transition ${isSelected ? "border-[var(--signal)] bg-[var(--signal)]/15 shadow-[inset_0_0_0_1px_rgba(45,212,191,0.24)]" : "hover:bg-white/[0.04]"}`}
    >
      <div className="grid w-8 shrink-0 place-items-center text-stone-600 transition group-hover:text-stone-300" aria-hidden="true">
        ::
      </div>
      <div className="block min-w-0 flex-1 py-4 pr-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-start justify-between gap-3">
            {isEditingTitle ? (
              <input
                autoFocus
                value={editingTitle}
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                onChange={(event) => onEditingTitleChange(event.target.value)}
                onBlur={onSaveTitle}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onSaveTitle();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    onCancelTitleEdit();
                  }
                }}
                className="min-w-0 flex-1 rounded border border-[var(--signal)]/30 bg-black/40 px-2 py-1 text-base font-black text-white outline-none"
              />
            ) : (
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  if (longPressTriggeredRef.current) {
                    event.preventDefault();
                    event.stopPropagation();
                    longPressTriggeredRef.current = false;
                    return;
                  }
                  event.stopPropagation();
                  onOpen();
                }}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onBeginTitleEdit();
                }}
                className={`min-w-0 flex-1 truncate text-left text-base font-black outline-none transition hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--signal)]/40 ${isSelected ? "text-white" : "text-stone-100"}`}
              >
                {note.title}
              </button>
            )}
            <p className="shrink-0 text-xs text-stone-500">{formatDateTime(note.updatedAt)}</p>
          </div>
          <button
            type="button"
            onClick={(event) => {
              if (longPressTriggeredRef.current) {
                event.preventDefault();
                event.stopPropagation();
                longPressTriggeredRef.current = false;
                return;
              }
              event.stopPropagation();
              onOpen();
            }}
            className="mt-1 block min-w-0 max-w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--signal)]/40"
          >
            <span className="line-clamp-2 text-sm leading-6 text-stone-400">{note.preview || "No content yet."}</span>
            <span className="mt-2 block min-w-0 max-w-full truncate whitespace-nowrap text-xs text-[var(--signal)]">{note.navigationLabel}</span>
            <span className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-[0.7rem] text-stone-500">
              {note.isLocked ? <span className="rounded border border-white/10 px-1.5 py-0.5 text-stone-400">Locked</span> : null}
              {note.manualTags.slice(0, 3).map((tag) => (
                <span key={tag} className="rounded border border-white/10 px-1.5 py-0.5 text-stone-400">
                  #{tag}
                </span>
              ))}
            </span>
          </button>
        </div>
      </div>
      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          if (longPressTriggeredRef.current) {
            event.preventDefault();
            event.stopPropagation();
            longPressTriggeredRef.current = false;
            return;
          }
          event.stopPropagation();
          onTogglePinned(note.id);
        }}
        aria-label={`${note.isPinned ? "Unpin" : "Pin"} ${note.title}`}
        className={`w-10 shrink-0 text-lg transition ${note.isPinned ? "text-[var(--gold)]" : "text-stone-600 hover:text-stone-300"}`}
      >
        {note.isPinned ? "★" : "☆"}
      </button>
    </div>
  );
}

function sortWorkspaceNotes(notes: WorkspaceNoteListItem[]) {
  return [...notes].sort((left, right) => Number(right.isPinned) - Number(left.isPinned) || left.sortOrder - right.sortOrder || new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime() || left.title.localeCompare(right.title));
}

function NoteTagsDialog({
  state,
  onClose,
  onSave
}: {
  state: NonNullable<NoteTagsDialogState>;
  onClose: () => void;
  onSave: (tags: string[]) => Promise<void>;
}) {
  const [value, setValue] = useState(state.tags.join(", "));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: ReactFormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      const tags = [...new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean))];
      await onSave(tags);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Tags could not be updated.");
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="note-tags-title">
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded border border-white/10 bg-zinc-950 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="note-tags-title" className="text-lg font-black text-white">Edit Tags</h2>
            <p className="mt-1 text-sm text-stone-500">{state.title}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded px-2 py-1 text-sm font-bold text-stone-500 transition hover:bg-white/10 hover:text-white">
            Close
          </button>
        </div>
        <label className="mt-5 grid gap-2 text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
          Tags
          <input
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="story, continuity, draft"
            className="h-10 rounded border border-white/10 bg-black/40 px-3 text-sm normal-case tracking-normal text-white outline-none placeholder:text-stone-600 focus:border-[var(--signal)]/50"
          />
        </label>
        <p className="mt-2 text-xs text-stone-500">Use commas to add or remove tags.</p>
        {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded border border-white/10 px-3 text-xs font-bold text-stone-400 transition hover:bg-white/10 hover:text-white">
            Cancel
          </button>
          <button type="submit" disabled={isSaving} className="h-9 rounded border border-[var(--signal)]/40 bg-[var(--signal)]/10 px-3 text-xs font-bold text-white transition hover:bg-[var(--signal)]/20 disabled:opacity-60">
            {isSaving ? "Saving..." : "Save tags"}
          </button>
        </div>
      </form>
    </div>
  );
}

function NoteLockDialog({
  state,
  onClose,
  onSubmit
}: {
  state: NonNullable<NoteLockDialogState>;
  onClose: () => void;
  onSubmit: (passcode: string) => Promise<void>;
}) {
  const [passcode, setPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSetting = state.mode === "set";

  async function handleSubmit(event: ReactFormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const nextPasscode = passcode.trim();
    if (!nextPasscode) {
      setError("Enter a passcode.");
      return;
    }
    if (isSetting && nextPasscode !== confirmPasscode.trim()) {
      setError("Passcodes do not match.");
      return;
    }
    setIsSaving(true);
    try {
      await onSubmit(nextPasscode);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Lock action failed.");
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="note-lock-title">
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded border border-white/10 bg-zinc-950 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="note-lock-title" className="text-lg font-black text-white">{isSetting ? "Lock Note" : "Unlock Note"}</h2>
            <p className="mt-1 text-sm text-stone-500">{state.title}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded px-2 py-1 text-sm font-bold text-stone-500 transition hover:bg-white/10 hover:text-white">
            Close
          </button>
        </div>
        <label className="mt-5 grid gap-2 text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
          Passcode
          <input
            autoFocus
            type="password"
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            className="h-10 rounded border border-white/10 bg-black/40 px-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--signal)]/50"
          />
        </label>
        {isSetting ? (
          <label className="mt-3 grid gap-2 text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
            Confirm Passcode
            <input
              type="password"
              value={confirmPasscode}
              onChange={(event) => setConfirmPasscode(event.target.value)}
              className="h-10 rounded border border-white/10 bg-black/40 px-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--signal)]/50"
            />
          </label>
        ) : null}
        {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded border border-white/10 px-3 text-xs font-bold text-stone-400 transition hover:bg-white/10 hover:text-white">
            Cancel
          </button>
          <button type="submit" disabled={isSaving} className="h-9 rounded border border-[var(--signal)]/40 bg-[var(--signal)]/10 px-3 text-xs font-bold text-white transition hover:bg-[var(--signal)]/20 disabled:opacity-60">
            {isSaving ? "Saving..." : isSetting ? "Lock note" : "Remove lock"}
          </button>
        </div>
      </form>
    </div>
  );
}

function LockedNotePanel({
  note,
  onUnlock,
  onRemoveLock
}: {
  note: WorkspaceSelectedNote;
  onUnlock: (passcode: string) => Promise<void>;
  onRemoveLock: () => void;
}) {
  const [passcode, setPasscode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: ReactFormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await onUnlock(passcode);
      setPasscode("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unlock failed.");
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(false);
  }

  return (
    <div className="grid min-h-[50vh] flex-1 place-items-center">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded border border-white/10 bg-white/[0.03] p-5 shadow-xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">Locked Note</p>
        <h2 className="mt-2 text-2xl font-black text-white">{note.title}</h2>
        <p className="mt-2 text-sm leading-6 text-stone-400">This note is locked. Enter the passcode to unlock it for this session.</p>
        {note.lockedAt ? <p className="mt-2 text-xs text-stone-500">Locked {formatDateTime(note.lockedAt)}</p> : null}
        <label className="mt-5 grid gap-2 text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
          Passcode
          <input
            autoFocus
            type="password"
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            className="h-10 rounded border border-white/10 bg-black/40 px-3 text-sm normal-case tracking-normal text-white outline-none focus:border-[var(--signal)]/50"
          />
        </label>
        {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onRemoveLock} className="h-9 rounded border border-white/10 px-3 text-xs font-bold text-stone-300 transition hover:bg-white/10 hover:text-white">
            Remove lock
          </button>
          <button type="submit" disabled={isSubmitting} className="h-9 rounded border border-[var(--signal)]/40 bg-[var(--signal)]/10 px-3 text-xs font-bold text-white transition hover:bg-[var(--signal)]/20 disabled:opacity-60">
            {isSubmitting ? "Unlocking..." : "Unlock note"}
          </button>
        </div>
      </form>
    </div>
  );
}

function nextSortOrder(notes: WorkspaceNoteListItem[], navigationNodeId: string | null) {
  const matchingNotes = notes.filter((note) => note.navigationNodeId === navigationNodeId);
  return matchingNotes.reduce((max, note) => Math.max(max, note.sortOrder), 0) + 10;
}

function isTemporaryNoteId(noteId: string) {
  return noteId.startsWith("temp:");
}

function replaceHistoryNote(noteId: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (noteId) url.searchParams.set("note", noteId);
  else url.searchParams.delete("note");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
}

function replaceHistoryFolder(navigationNodeId: string | null, noteId: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("includeDescendants");
  url.searchParams.set("node", navigationNodeId ?? "unassigned");
  url.searchParams.set("note", noteId);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
}

function clampContextMenuX(x: number) {
  if (typeof window === "undefined") return x;
  return Math.max(12, Math.min(x, window.innerWidth - 236));
}

function clampContextMenuY(y: number) {
  if (typeof window === "undefined") return y;
  return Math.max(12, Math.min(y, window.innerHeight - 360));
}

function firstLine(value: string) {
  return stripHtml(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
}

function noteMatchesSearch(note: WorkspaceNoteListItem, query: string) {
  const normalizedQuery = query.toLowerCase();
  return [note.title, note.preview, stripHtml(note.content), note.navigationLabel].some((value) => value.toLowerCase().includes(normalizedQuery));
}

function findWorkspaceNoteById(noteId: string | null, notes: WorkspaceNoteListItem[], searchNotes: WorkspaceNoteListItem[]) {
  if (!noteId) return null;
  return notes.find((note) => note.id === noteId) ?? searchNotes.find((note) => note.id === noteId) ?? null;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function stripHtml(value: string) {
  return value.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "");
}

function countTextMatches(text: string, query: string) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return 0;
  const escapedQuery = escapeRegExp(trimmedQuery);
  return text.match(new RegExp(escapedQuery, "gi"))?.length ?? 0;
}

function exportMarkdown(note: ExportableNote) {
  const markdown = `# ${note.title}\n\n${htmlToMarkdown(note.content)}`;
  downloadBlob(markdown, `${safeFileName(note.title)}.md`, "text/markdown;charset=utf-8");
}

function exportJson(note: ExportableNote) {
  downloadBlob(JSON.stringify(note, null, 2), `${safeFileName(note.title)}.json`, "application/json;charset=utf-8");
}

function exportPdf(note: ExportableNote) {
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) return;
  printWindow.document.write(`<!doctype html>
<html>
  <head>
    <title>${escapeHtml(note.title)}</title>
    <style>
      body { color: #111; font-family: Arial, sans-serif; line-height: 1.55; margin: 48px; }
      h1 { font-size: 28px; margin-bottom: 24px; }
      h2 { font-size: 22px; }
      h3 { font-size: 18px; }
      ul, ol { margin-left: 22px; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(note.title)}</h1>
    ${sanitizeExportHtml(note.content)}
  </body>
</html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

async function exportDocx(note: ExportableNote) {
  const docx = await import("docx");
  const paragraphs = htmlToDocxParagraphs(note.content, docx);
  const document = new docx.Document({
    sections: [
      {
        children: [
          new docx.Paragraph({
            text: note.title,
            heading: docx.HeadingLevel.TITLE
          }),
          ...paragraphs
        ]
      }
    ]
  });
  const blob = await docx.Packer.toBlob(document);
  downloadBlob(blob, `${safeFileName(note.title)}.docx`, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
}

function htmlToMarkdown(html: string) {
  const document = new DOMParser().parseFromString(sanitizeExportHtml(html), "text/html");
  return Array.from(document.body.childNodes)
    .map((node) => markdownFromNode(node).trim())
    .filter(Boolean)
    .join("\n\n");
}

function markdownFromNode(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof HTMLElement)) return "";

  const content = Array.from(node.childNodes).map(markdownFromNode).join("");
  if (node.tagName === "H1") return `# ${content}`;
  if (node.tagName === "H2") return `## ${content}`;
  if (node.tagName === "H3") return `### ${content}`;
  if (node.tagName === "STRONG" || node.tagName === "B") return `**${content}**`;
  if (node.tagName === "EM" || node.tagName === "I") return `_${content}_`;
  if (node.tagName === "U") return content;
  if (node.tagName === "BR") return "\n";
  if (node.tagName === "LI") return `- ${content}`;
  if (node.tagName === "UL") return Array.from(node.children).map((child) => markdownFromNode(child)).join("\n");
  if (node.tagName === "OL") return Array.from(node.children).map((child, index) => `${index + 1}. ${Array.from(child.childNodes).map(markdownFromNode).join("")}`).join("\n");
  return content;
}

function htmlToDocxParagraphs(html: string, docx: typeof import("docx")) {
  const document = new DOMParser().parseFromString(sanitizeExportHtml(html), "text/html");
  const paragraphs: InstanceType<typeof docx.Paragraph>[] = [];

  for (const node of Array.from(document.body.childNodes)) {
    appendDocxParagraphs(node, docx, paragraphs);
  }

  return paragraphs.length > 0 ? paragraphs : [new docx.Paragraph({ text: "" })];
}

function appendDocxParagraphs(node: ChildNode, docx: typeof import("docx"), paragraphs: InstanceType<typeof docx.Paragraph>[]) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim();
    if (text) paragraphs.push(new docx.Paragraph({ children: [new docx.TextRun(text)] }));
    return;
  }
  if (!(node instanceof HTMLElement)) return;

  if (node.tagName === "UL" || node.tagName === "OL") {
    Array.from(node.children).forEach((child, index) => {
      const prefix = node.tagName === "OL" ? `${index + 1}. ` : "• ";
      paragraphs.push(new docx.Paragraph({ children: [new docx.TextRun(prefix), ...docxRunsFromNode(child, docx, {})] }));
    });
    return;
  }

  const heading = node.tagName === "H1" ? docx.HeadingLevel.HEADING_1 : node.tagName === "H2" ? docx.HeadingLevel.HEADING_2 : node.tagName === "H3" ? docx.HeadingLevel.HEADING_3 : undefined;
  paragraphs.push(
    new docx.Paragraph({
      heading,
      children: docxRunsFromNode(node, docx, {})
    })
  );
}

function docxRunsFromNode(node: ChildNode, docx: typeof import("docx"), marks: { bold?: boolean; italics?: boolean; underline?: boolean }): InstanceType<typeof docx.TextRun>[] {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ? [new docx.TextRun({ text: node.textContent, bold: marks.bold, italics: marks.italics, underline: marks.underline ? {} : undefined })] : [];
  }
  if (!(node instanceof HTMLElement)) return [];
  if (node.tagName === "BR") return [new docx.TextRun({ break: 1 })];

  const nextMarks = {
    bold: marks.bold || node.tagName === "STRONG" || node.tagName === "B",
    italics: marks.italics || node.tagName === "EM" || node.tagName === "I",
    underline: marks.underline || node.tagName === "U"
  };

  return Array.from(node.childNodes).flatMap((child) => docxRunsFromNode(child, docx, nextMarks));
}

function sanitizeExportHtml(value: string) {
  return value.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
}

function downloadBlob(content: BlobPart | Blob, fileName: string, type: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function safeFileName(value: string) {
  return (value.trim() || "Untitled Note").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function readStoredNoteColors() {
  if (typeof window === "undefined") return {};
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(NOTE_COLORS_STORAGE_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string")
    );
  } catch {
    return {};
  }
}
