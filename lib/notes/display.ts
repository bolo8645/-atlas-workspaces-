export type NoteTitleLike = {
  title: string;
  metadataOverride?: { displayTitle?: string | null } | null;
};

export function displayNoteTitle(note: NoteTitleLike) {
  return note.metadataOverride?.displayTitle?.trim() || note.title;
}

export function formatDate(value?: Date | string | null) {
  if (!value) return "Not set";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(value?: Date | string | null) {
  if (!value) return "Not set";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
