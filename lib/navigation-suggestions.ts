import type { NavigationNodeOption } from "@/lib/navigation-queries";
import { normalizeNavigationSlug } from "@/lib/navigation-utils";

type SuggestionNote = {
  navigationNodeId: string | null;
  importedContent: string;
  plainTextContent: string;
};

export type NavigationAssignmentSuggestion = {
  navigationNodeId: string;
  navigationNodeTitle: string;
  fullPath: string;
  reason: string;
  evidence: string;
};

const LOCATION_LABEL_PATTERN = /(?:^|\n)\s*(Location|City):\s*([^\n\r]+)/gi;

export function getNavigationAssignmentSuggestions(note: SuggestionNote, options: NavigationNodeOption[]) {
  const suggestions: NavigationAssignmentSuggestion[] = [];
  const optionsBySlug = new Map(options.map((option) => [normalizeNavigationSlug(option.title), option]));
  const text = `${note.importedContent}\n${note.plainTextContent}`;
  const seen = new Set<string>();

  for (const match of text.matchAll(LOCATION_LABEL_PATTERN)) {
    const label = match[1];
    const rawValue = cleanSuggestionValue(match[2]);
    const option = optionsBySlug.get(normalizeNavigationSlug(rawValue));
    if (!option || option.id === note.navigationNodeId || seen.has(option.id)) continue;

    seen.add(option.id);
    suggestions.push({
      navigationNodeId: option.id,
      navigationNodeTitle: option.title,
      fullPath: option.fullPath,
      reason: `${label} label matches a navigation node.`,
      evidence: `${label}: ${rawValue}`
    });
  }

  return suggestions;
}

function cleanSuggestionValue(value: string) {
  return value
    .split(/[;,.]/)[0]
    .replace(/\s+#\w+$/, "")
    .trim();
}
