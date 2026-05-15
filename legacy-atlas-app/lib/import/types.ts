export type ParsedAttachment = {
  sourcePath: string;
  resolvedPath?: string;
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
  checksum?: string;
  kind: string;
};

export type ParsedLink = {
  url: string;
  label?: string;
  kind: "URL" | "WIKI" | "INTERNAL_FILE" | "NOTE_REFERENCE";
};

export type ParsedEntity = {
  name: string;
  kind: string;
  confidence: number;
  source: "IMPORTED" | "INFERRED";
  evidence?: string;
};

export type ParsedWarning = {
  code: string;
  message: string;
  severity?: "info" | "warning" | "error";
};

export type ParsedNote = {
  absolutePath: string;
  relativePath: string;
  sourceFileName: string;
  sourceExtension: string;
  sourceChecksum: string;
  title: string;
  titleFingerprint: string;
  contentFingerprint: string;
  importedContent: string;
  plainTextContent: string;
  excerpt?: string;
  createdDate?: Date;
  updatedDate?: Date;
  folderName?: string;
  notebookName?: string;
  parseQuality: number;
  tags: string[];
  categories: string[];
  attachments: ParsedAttachment[];
  links: ParsedLink[];
  entities: ParsedEntity[];
  warnings: ParsedWarning[];
};

export type DiscoveredNoteFile = {
  absolutePath: string;
  relativePath: string;
  extension: string;
};

export type ImportRunResult = {
  importRunId: string;
  filesDiscovered: number;
  imported: number;
  updated: number;
  skipped: number;
  errored: number;
  warnings: number;
  duplicateReviews: number;
  durationMs: number;
};
