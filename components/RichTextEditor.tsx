"use client";

import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo, useRef } from "react";
import type { EntityIndexEntry } from "@/lib/relationships";

export type RichTextEditorActions = {
  replaceOne: (find: string, replacement: string) => number;
  replaceAll: (find: string, replacement: string) => number;
  setTextStyle: (style: "title" | "heading" | "subheading" | "body") => void;
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleUnderline: () => void;
  toggleBulletList: () => void;
  toggleOrderedList: () => void;
  insertTable: () => void;
};

export type EditorEntityMatch = {
  start: number;
  end: number;
  entity: EntityIndexEntry;
};

export type EditorRelationshipSuggestion = {
  id: string;
  entityA: EntityIndexEntry;
  entityB: EntityIndexEntry;
  suggestedType: string;
  typeOptions: string[];
  snippet: string;
};

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  findQuery?: string;
  currentNoteId?: string | null;
  entityIndex?: EntityIndexEntry[];
  onActionsReady?: (actions: RichTextEditorActions | null) => void;
  onEntityClick?: (entity: EntityIndexEntry) => void;
  onSelectionContextMenu?: (input: { text: string; x: number; y: number }) => void;
  onRelationshipSuggestionsChange?: (suggestions: EditorRelationshipSuggestion[]) => void;
};

type EditorDetectionSection = {
  text: string;
  charToDoc: number[];
};

type EntityMatchIndex = {
  entries: Map<string, EntityIndexEntry>;
  maxWords: number;
};

const searchHighlightPluginKey = new PluginKey<string>("ascuSearchHighlight");
const entityHighlightPluginKey = new PluginKey<EditorEntityMatch[]>("atlasEntityHighlight");

const SearchHighlight = Extension.create({
  name: "ascuSearchHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin<string>({
        key: searchHighlightPluginKey,
        state: {
          init: () => "",
          apply(transaction, previous) {
            const nextQuery = transaction.getMeta(searchHighlightPluginKey);
            return typeof nextQuery === "string" ? nextQuery : previous;
          }
        },
        props: {
          decorations(state) {
            const query = searchHighlightPluginKey.getState(state);
            if (!query) return DecorationSet.empty;
            const decorations = collectSearchMatches(state.doc, query).map((match) => Decoration.inline(match.from, match.to, { class: "ascu-search-match" }));
            return DecorationSet.create(state.doc, decorations);
          }
        }
      })
    ];
  }
});

const EntityHighlight = Extension.create({
  name: "atlasEntityHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin<EditorEntityMatch[]>({
        key: entityHighlightPluginKey,
        state: {
          init: () => [],
          apply(transaction, previous) {
            const nextMatches = transaction.getMeta(entityHighlightPluginKey);
            return Array.isArray(nextMatches) ? nextMatches : previous;
          }
        },
        props: {
          decorations(state) {
            const matches = entityHighlightPluginKey.getState(state) ?? [];
            if (matches.length === 0) return DecorationSet.empty;
            const decorations = matches.map((match) =>
              Decoration.inline(match.start, match.end, {
                class: "atlas-entity-match",
                "data-atlas-entity-id": match.entity.id,
                title: match.entity.alias ? `${match.entity.title} (${match.entity.type}) - alias: ${match.entity.alias}` : `${match.entity.title} (${match.entity.type})`
              })
            );
            return DecorationSet.create(state.doc, decorations);
          }
        }
      })
    ];
  }
});

export function RichTextEditor({ value, onChange, findQuery = "", currentNoteId = null, entityIndex = [], onActionsReady, onEntityClick, onSelectionContextMenu, onRelationshipSuggestionsChange }: RichTextEditorProps) {
  const entityMatchIndex = useMemo(() => buildEntityMatchIndex(entityIndex), [entityIndex]);
  const entityById = useMemo(() => new Map(entityIndex.map((entity) => [entity.id, entity])), [entityIndex]);
  const detectionTimeoutRef = useRef<number | null>(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Table.configure({
        resizable: true
      }),
      TableRow,
      TableHeader,
      TableCell,
      SearchHighlight,
      EntityHighlight
    ],
    content: normalizeEditorContent(value),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "min-h-full outline-none"
      },
      handleClick: (_view, _position, event) => {
        const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("[data-atlas-entity-id]") : null;
        if (!target) return false;
        const entityId = target.dataset.atlasEntityId;
        const entity = entityId ? entityById.get(entityId) : null;
        if (!entity) return false;
        onEntityClick?.(entity);
        return true;
      },
      handleDOMEvents: {
        contextmenu: (view, event) => {
          const selection = view.state.selection;
          if (selection.empty || !onSelectionContextMenu) return false;
          const text = view.state.doc.textBetween(selection.from, selection.to, " ").trim();
          if (!text) return false;
          event.preventDefault();
          onSelectionContextMenu({ text, x: event.clientX, y: event.clientY });
          return true;
        }
      }
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    }
  });

  useEffect(() => {
    if (!editor) return;
    const nextContent = normalizeEditorContent(value);
    if (editor.getHTML() === nextContent) return;
    editor.commands.setContent(nextContent, { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(editor.state.tr.setMeta(searchHighlightPluginKey, findQuery));
  }, [editor, findQuery]);

  useEffect(() => {
    if (!editor) return;
    const activeEditor = editor;

    function runDetection() {
      const section = getActiveEntitySection(activeEditor);
      if (!section || entityMatchIndex.entries.size === 0) {
        activeEditor.view.dispatch(activeEditor.state.tr.setMeta(entityHighlightPluginKey, []));
        onRelationshipSuggestionsChange?.([]);
        return;
      }

      const matches = detectEntitiesInSection(section, entityMatchIndex, currentNoteId);
      debugEntityMatches(matches);
      activeEditor.view.dispatch(activeEditor.state.tr.setMeta(entityHighlightPluginKey, matches));
      const suggestions = relationshipSuggestionsFromMatches(matches, section.text);
      debugRelationshipSuggestions(suggestions);
      onRelationshipSuggestionsChange?.(suggestions);
    }

    function scheduleDetection() {
      if (detectionTimeoutRef.current) window.clearTimeout(detectionTimeoutRef.current);
      detectionTimeoutRef.current = window.setTimeout(runDetection, 250);
    }

    activeEditor.on("update", scheduleDetection);
    activeEditor.on("selectionUpdate", scheduleDetection);
    scheduleDetection();

    return () => {
      if (detectionTimeoutRef.current) window.clearTimeout(detectionTimeoutRef.current);
      activeEditor.off("update", scheduleDetection);
      activeEditor.off("selectionUpdate", scheduleDetection);
    };
  }, [currentNoteId, editor, entityMatchIndex, onRelationshipSuggestionsChange, value]);

  useEffect(() => {
    if (!editor || !onActionsReady) return;
    onActionsReady({
      replaceOne(find, replacement) {
        return replaceOne(editor, find, replacement);
      },
      replaceAll(find, replacement) {
        return replaceAll(editor, find, replacement);
      },
      setTextStyle(style) {
        if (style === "title") editor.chain().focus().setHeading({ level: 1 }).run();
        if (style === "heading") editor.chain().focus().setHeading({ level: 2 }).run();
        if (style === "subheading") editor.chain().focus().setHeading({ level: 3 }).run();
        if (style === "body") editor.chain().focus().setParagraph().run();
      },
      toggleBold() {
        editor.chain().focus().toggleBold().run();
      },
      toggleItalic() {
        editor.chain().focus().toggleItalic().run();
      },
      toggleUnderline() {
        editor.chain().focus().toggleUnderline().run();
      },
      toggleBulletList() {
        editor.chain().focus().toggleBulletList().run();
      },
      toggleOrderedList() {
        editor.chain().focus().toggleOrderedList().run();
      },
      insertTable() {
        editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: false }).run();
      }
    });

    return () => onActionsReady(null);
  }, [editor, onActionsReady]);

  if (!editor) return <div className="min-h-0 flex-1" />;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <EditorContent editor={editor} className="ascu-rich-editor min-h-0 flex-1 px-5 py-5 text-base leading-8 text-stone-200" />
    </div>
  );
}

function buildEntityMatchIndex(entityIndex: EntityIndexEntry[]): EntityMatchIndex {
  const entries = new Map<string, EntityIndexEntry>();
  let maxWords = 1;
  for (const entity of entityIndex) {
    const key = normalizeEntityText(entity.matchKey || entity.title);
    if (!key || entries.has(key)) continue;
    entries.set(key, entity);
    maxWords = Math.max(maxWords, countWords(key));
  }
  return { entries, maxWords };
}

function getActiveEntitySection(editor: Editor): EditorDetectionSection | null {
  const { $from } = editor.state.selection;
  if (!$from.parent.isTextblock) return null;

  for (let depth = 1; depth <= $from.depth; depth += 1) {
    const node = $from.node(depth);
    if (node.type.name === "bulletList" || node.type.name === "orderedList") {
      return collectTextSection(node, $from.start(depth));
    }
  }

  return collectTextSection($from.parent, $from.start());
}

function collectTextSection(node: ProseMirrorNode, basePosition: number): EditorDetectionSection | null {
  let text = "";
  const charToDoc: number[] = [];

  node.descendants((child, position) => {
    if (!child.isText || !child.text) return;
    if (text.length > 0) {
      text += " ";
      charToDoc.push(basePosition + position);
    }
    for (let index = 0; index < child.text.length; index += 1) {
      text += child.text[index];
      charToDoc.push(basePosition + position + index);
    }
  });

  if (!text.trim()) return null;
  return {
    text,
    charToDoc
  };
}

function detectEntitiesInSection(section: EditorDetectionSection, entityMatchIndex: EntityMatchIndex, currentNoteId: string | null): EditorEntityMatch[] {
  const words = Array.from(section.text.matchAll(/\b[\p{L}\p{N}'-]+\b/gu)).map((match) => ({
    text: match[0],
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length
  }));
  const candidates: EditorEntityMatch[] = [];

  for (let index = 0; index < words.length; index += 1) {
    for (let size = 1; size <= entityMatchIndex.maxWords && index + size <= words.length; size += 1) {
      const slice = words.slice(index, index + size);
      const phrase = normalizeEntityText(slice.map((word) => word.text).join(" "));
      const entity = entityMatchIndex.entries.get(phrase);
      if (!entity || entity.id === currentNoteId) continue;
      const start = section.charToDoc[slice[0].start];
      const end = section.charToDoc[slice[slice.length - 1].end - 1] + 1;
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      candidates.push({
        start,
        end,
        entity
      });
    }
  }

  const selected: EditorEntityMatch[] = [];
  for (const candidate of candidates.sort((left, right) => right.end - right.start - (left.end - left.start) || left.start - right.start)) {
    if (selected.some((match) => rangesOverlap(match, candidate))) continue;
    selected.push(candidate);
  }

  return selected.sort((left, right) => left.start - right.start);
}

function relationshipSuggestionsFromMatches(matches: EditorEntityMatch[], paragraphText: string): EditorRelationshipSuggestion[] {
  const distinct = new Map<string, EntityIndexEntry>();
  for (const match of matches) distinct.set(match.entity.id, match.entity);
  const entities = [...distinct.values()];
  if (entities.length < 2) return [];

  const suggestions: EditorRelationshipSuggestion[] = [];
  for (let left = 0; left < entities.length; left += 1) {
    for (let right = left + 1; right < entities.length; right += 1) {
      const typeOptions = relationshipTypesFor(entities[left].type, entities[right].type);
      if (typeOptions.length === 0) continue;
      suggestions.push({
        id: [entities[left].id, entities[right].id].sort().join(":"),
        entityA: entities[left],
        entityB: entities[right],
        suggestedType: typeOptions[0],
        typeOptions,
        snippet: paragraphText.slice(0, 240)
      });
    }
  }
  return suggestions;
}

function relationshipTypesFor(leftType: string, rightType: string) {
  const left = normalizeNoteType(leftType);
  const right = normalizeNoteType(rightType);
  if (left === "character" && right === "character") return ["affiliated_with", "hostile_to", "related_to"];
  if (left === "character" && right === "organization") return ["member_of", "leader_of", "affiliated_with"];
  if (left === "organization" && right === "character") return ["member_of", "leader_of", "affiliated_with"];
  if (left === "character" && right === "location") return ["located_in", "related_to"];
  if (left === "location" && right === "character") return ["located_in", "related_to"];
  if (left === "organization" && right === "organization") return ["affiliated_with", "hostile_to", "related_to"];
  return [];
}

function normalizeNoteType(value: string) {
  const type = value.toLowerCase().trim().replace(/_/g, "-");
  if (type === "team") return "organization";
  return type || "draft";
}

function normalizeEntityText(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, "")
    .replace(/\s+/g, " ")
    .replace(/^(the|a|an)\s+/i, "");
}

function rangesOverlap(left: EditorEntityMatch, right: EditorEntityMatch) {
  return left.start < right.end && right.start < left.end;
}

function countWords(value: string) {
  return Array.from(value.matchAll(/\b[\p{L}\p{N}'-]+\b/gu)).length || 1;
}

function debugEntityMatches(matches: EditorEntityMatch[]) {
  console.debug(
    "[Atlas entity detection]",
    matches.map((match) => ({
      id: match.entity.id,
      name: match.entity.title,
      type: match.entity.type,
      alias: match.entity.alias ?? null,
      range: [match.start, match.end]
    }))
  );
}

function debugRelationshipSuggestions(suggestions: EditorRelationshipSuggestion[]) {
  console.debug(
    "[Atlas relationship suggestions]",
    suggestions.map((suggestion) => ({
      entities: [suggestion.entityA.title, suggestion.entityB.title],
      types: suggestion.typeOptions
    }))
  );
}

function normalizeEditorContent(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return value;
  return value
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function replaceOne(editor: Editor, find: string, replacement: string) {
  const matches = collectSearchMatches(editor.state.doc, find);
  if (matches.length === 0) return 0;
  const selectionFrom = editor.state.selection.from;
  const target = matches.find((match) => match.to >= selectionFrom) ?? matches[0];
  editor.chain().focus().insertContentAt({ from: target.from, to: target.to }, replacement).setTextSelection(target.from + replacement.length).run();
  return matches.length;
}

function replaceAll(editor: Editor, find: string, replacement: string) {
  const matches = collectSearchMatches(editor.state.doc, find);
  if (matches.length === 0) return 0;
  let transaction = editor.state.tr;
  for (const match of [...matches].reverse()) {
    transaction = transaction.insertText(replacement, match.from, match.to);
  }
  editor.view.dispatch(transaction);
  editor.commands.focus();
  return matches.length;
}

function collectSearchMatches(doc: ProseMirrorNode, query: string) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];
  const normalizedQuery = trimmedQuery.toLowerCase();
  const matches: Array<{ from: number; to: number }> = [];

  doc.descendants((node, position) => {
    if (!node.isText || !node.text) return;
    const normalizedText = node.text.toLowerCase();
    let index = normalizedText.indexOf(normalizedQuery);
    while (index >= 0) {
      matches.push({
        from: position + index,
        to: position + index + trimmedQuery.length
      });
      index = normalizedText.indexOf(normalizedQuery, index + trimmedQuery.length);
    }
  });

  return matches;
}
