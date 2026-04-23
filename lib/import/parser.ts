import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { DiscoveredNoteFile, ParsedAttachment, ParsedEntity, ParsedLink, ParsedNote, ParsedWarning } from "./types";
import { excerpt, hashText, makeContentFingerprint, makeTitleFingerprint, normalizeWhitespace, toPosixPath, uniqueStrings } from "./text";

const ASSET_EXTENSIONS = new Set([
  ".apng",
  ".avif",
  ".gif",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".svg",
  ".pdf",
  ".mp3",
  ".m4a",
  ".wav",
  ".mp4",
  ".mov",
  ".csv",
  ".json",
  ".txt"
]);

type ParsedMetadata = {
  data: Record<string, string | string[]>;
  body: string;
  warnings: ParsedWarning[];
};

export async function parseNoteFile(file: DiscoveredNoteFile): Promise<ParsedNote> {
  const warnings: ParsedWarning[] = [];
  const buffer = await readFile(file.absolutePath);
  const importedContent = buffer.toString("utf8");
  const metadata = parseFrontmatter(importedContent);
  warnings.push(...metadata.warnings);

  const sourceExtension = file.extension.replace(/^\./, "");
  const isHtml = sourceExtension === "html" || sourceExtension === "htm";
  const bodyForText = isHtml ? htmlToText(metadata.body) : markdownToText(metadata.body);
  const plainTextContent = normalizeWhitespace(bodyForText);
  const title = inferTitle(metadata.data, metadata.body, plainTextContent, file.absolutePath, isHtml, warnings);
  const parsedDates = await inferDates(metadata.data, file.absolutePath, warnings);
  const pathParts = toPosixPath(path.dirname(file.relativePath))
    .split("/")
    .filter((part) => part && part !== ".");
  const folderName = pathParts.at(-1);
  const notebookName = pathParts.at(0);
  const tags = uniqueStrings([...metadataList(metadata.data, "tags"), ...metadataList(metadata.data, "tag"), ...extractLabelList(bodyForText, "tags"), ...extractLabelList(bodyForText, "tag"), ...extractHashtags(metadata.body)]);
  const folderCategories = folderName ? [folderName] : [];
  const categories = uniqueStrings([...metadataList(metadata.data, "categories"), ...metadataList(metadata.data, "category"), ...extractLabelList(bodyForText, "categories"), ...extractLabelList(bodyForText, "category"), ...folderCategories]);
  const links = uniqueLinks(extractLinks(metadata.body, isHtml));
  const attachments = await extractAttachments(links, metadata.body, isHtml, file.absolutePath);
  const entities = uniqueEntities(extractEntities(metadata.data, metadata.body, links));

  if (tags.length === 0) {
    warnings.push({ code: "missing-tags", message: "No tags were found in frontmatter or note body.", severity: "info" });
  }

  if (categories.length === 0) {
    warnings.push({ code: "missing-categories", message: "No category or folder-derived category was found.", severity: "info" });
  }

  const parseQuality = Math.max(30, 100 - warnings.filter((warning) => warning.severity !== "info").length * 15 - warnings.filter((warning) => warning.severity === "info").length * 5);

  return {
    absolutePath: file.absolutePath,
    relativePath: file.relativePath,
    sourceFileName: path.basename(file.absolutePath),
    sourceExtension,
    sourceChecksum: hashText(buffer),
    title,
    titleFingerprint: makeTitleFingerprint(title),
    contentFingerprint: makeContentFingerprint(plainTextContent),
    importedContent,
    plainTextContent,
    excerpt: excerpt(plainTextContent),
    createdDate: parsedDates.createdDate,
    updatedDate: parsedDates.updatedDate,
    folderName,
    notebookName,
    parseQuality,
    tags,
    categories,
    attachments,
    links,
    entities,
    warnings
  };
}

function parseFrontmatter(raw: string): ParsedMetadata {
  if (!raw.startsWith("---")) return parseLooseHeader(raw);

  const lines = raw.split(/\r?\n/);
  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (closingIndex === -1) {
    return {
      data: {},
      body: raw,
      warnings: [{ code: "frontmatter-open", message: "Frontmatter started with --- but did not include a closing ---.", severity: "warning" }]
    };
  }

  const block = lines.slice(1, closingIndex);
  const data: Record<string, string | string[]> = {};

  for (let index = 0; index < block.length; index += 1) {
    const line = block[index];
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;

    const key = match[1].trim().toLowerCase();
    const rawValue = match[2].trim();

    if (!rawValue) {
      const values: string[] = [];
      while (index + 1 < block.length) {
        const next = block[index + 1];
        const listMatch = next.match(/^\s*-\s+(.+)$/);
        if (!listMatch) break;
        values.push(cleanMetadataValue(listMatch[1]));
        index += 1;
      }
      data[key] = values;
      continue;
    }

    data[key] = parseMetadataValue(rawValue);
  }

  return { data, body: lines.slice(closingIndex + 1).join("\n").trim(), warnings: [] };
}

function parseLooseHeader(raw: string): ParsedMetadata {
  const lines = raw.split(/\r?\n/);
  const allowedKeys = new Set(["title", "name", "tags", "tag", "categories", "category", "created", "createddate", "created_at", "updated", "updateddate", "updated_at", "modified", "date", "entities", "entitytype", "entity_type", "type"]);
  const data: Record<string, string | string[]> = {};
  let index = 0;

  for (; index < Math.min(lines.length, 20); index += 1) {
    const line = lines[index];
    if (!line.trim()) break;
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/);
    if (!match) break;
    const key = match[1].trim().toLowerCase();
    if (!allowedKeys.has(key)) break;
    data[key] = parseMetadataValue(match[2].trim());
  }

  if (Object.keys(data).length === 0 || index >= lines.length || lines[index].trim()) {
    return { data: {}, body: raw, warnings: [] };
  }

  return { data, body: lines.slice(index + 1).join("\n").trim(), warnings: [] };
}

function parseMetadataValue(value: string) {
  const clean = cleanMetadataValue(value);
  if (clean.startsWith("[") && clean.endsWith("]")) {
    return clean
      .slice(1, -1)
      .split(",")
      .map(cleanMetadataValue)
      .filter(Boolean);
  }

  return clean;
}

function cleanMetadataValue(value: string) {
  return value.trim().replace(/^["']|["']$/g, "");
}

function metadataList(data: Record<string, string | string[]>, key: string) {
  const value = data[key.toLowerCase()];
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function metadataString(data: Record<string, string | string[]>, ...keys: string[]) {
  for (const key of keys) {
    const value = data[key.toLowerCase()];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function inferTitle(data: Record<string, string | string[]>, body: string, plainTextContent: string, filePath: string, isHtml: boolean, warnings: ParsedWarning[]) {
  const metadataTitle = metadataString(data, "title", "name");
  if (metadataTitle) return metadataTitle;

  if (isHtml) {
    const htmlTitle = body.match(/<title[^>]*>(.*?)<\/title>/is)?.[1] || body.match(/<h1[^>]*>(.*?)<\/h1>/is)?.[1];
    if (htmlTitle) return normalizeWhitespace(htmlToText(htmlTitle));
  }

  const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading;

  const firstLine = plainTextContent.split(/[.!?\n]/)[0]?.trim();
  if (firstLine && firstLine.length <= 90) return firstLine;

  warnings.push({ code: "title-fallback", message: "No title metadata or first heading was found; the file name was used.", severity: "info" });
  return path.basename(filePath, path.extname(filePath)).replace(/[-_]+/g, " ");
}

async function inferDates(data: Record<string, string | string[]>, filePath: string, warnings: ParsedWarning[]) {
  const fileStat = await stat(filePath);
  const createdDate = parseDateValue(metadataString(data, "created", "createddate", "created_at", "date"), "created date", warnings) ?? fileStat.birthtime;
  const updatedDate = parseDateValue(metadataString(data, "updated", "updateddate", "updated_at", "modified"), "updated date", warnings) ?? fileStat.mtime;
  return { createdDate, updatedDate };
}

function parseDateValue(value: string | undefined, label: string, warnings: ParsedWarning[]) {
  if (!value) return undefined;
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date;
  warnings.push({ code: "invalid-date", message: `Could not parse ${label}: ${value}`, severity: "warning" });
  return undefined;
}

function markdownToText(value: string) {
  return decodeEntities(
    value
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^>\s?/gm, "")
      .replace(/[*_~]/g, "")
  );
}

function htmlToText(value: string) {
  return decodeEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<(br|hr)\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|section|article|li|h1|h2|h3|h4|h5|h6)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  );
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractHashtags(value: string) {
  const tags: string[] = [];
  const matches = value.matchAll(/(^|\s)#([A-Za-z0-9][A-Za-z0-9_-]{1,60})\b/g);
  for (const match of matches) tags.push(match[2]);
  return tags;
}

function extractLabelList(value: string, label: string) {
  const expression = new RegExp(`(^|\\n)\\s*${label}:\\s*([^\\n]+)`, "gi");
  const values: string[] = [];
  for (const match of value.matchAll(expression)) {
    values.push(...match[2].split(",").map((item) => item.trim()));
  }
  return values;
}

function extractLinks(value: string, isHtml: boolean): ParsedLink[] {
  const links: ParsedLink[] = [];

  for (const match of value.matchAll(/(!?)\[([^\]]*)\]\(([^)]+)\)/g)) {
    const url = match[3].trim();
    links.push({ url, label: match[2].trim() || undefined, kind: isLocalAsset(url) ? "INTERNAL_FILE" : "URL" });
  }

  for (const match of value.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const label = match[1].trim();
    links.push({ url: label, label, kind: "WIKI" });
  }

  for (const match of value.matchAll(/\bhttps?:\/\/[^\s<>)"']+/g)) {
    links.push({ url: match[0], kind: "URL" });
  }

  if (isHtml) {
    for (const match of value.matchAll(/\s(?:href|src)=["']([^"']+)["']/gi)) {
      const url = match[1].trim();
      links.push({ url, kind: isLocalAsset(url) ? "INTERNAL_FILE" : "URL" });
    }
  }

  return links;
}

async function extractAttachments(links: ParsedLink[], body: string, isHtml: boolean, notePath: string): Promise<ParsedAttachment[]> {
  const linkedAssetPaths = links.filter((link) => isLocalAsset(link.url)).map((link) => link.url);

  if (isHtml) {
    for (const match of body.matchAll(/\ssrc=["']([^"']+)["']/gi)) {
      if (isLocalAsset(match[1])) linkedAssetPaths.push(match[1]);
    }
  }

  const attachments: ParsedAttachment[] = [];
  const noteDir = path.dirname(notePath);

  for (const sourcePath of uniqueStrings(linkedAssetPaths)) {
    const resolvedPath = path.resolve(noteDir, sourcePath);
    const attachment: ParsedAttachment = {
      sourcePath: toPosixPath(sourcePath),
      resolvedPath,
      fileName: path.basename(sourcePath),
      kind: attachmentKind(sourcePath),
      mimeType: mimeType(sourcePath)
    };

    try {
      await access(resolvedPath);
      const fileStat = await stat(resolvedPath);
      attachment.sizeBytes = Number(fileStat.size);
    } catch {
      attachment.resolvedPath = undefined;
    }

    attachments.push(attachment);
  }

  return attachments;
}

function isLocalAsset(url: string) {
  if (!url || url.startsWith("#")) return false;
  if (/^(https?:|mailto:|tel:|data:)/i.test(url)) return false;
  return ASSET_EXTENSIONS.has(path.extname(url.split(/[?#]/)[0]).toLowerCase());
}

function attachmentKind(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif", ".apng"].includes(extension)) return "image";
  if (extension === ".pdf") return "pdf";
  if ([".mp3", ".m4a", ".wav"].includes(extension)) return "audio";
  if ([".mp4", ".mov"].includes(extension)) return "video";
  return "file";
}

function mimeType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".json": "application/json",
    ".csv": "text/csv"
  };
  return types[extension];
}

function extractEntities(data: Record<string, string | string[]>, body: string, links: ParsedLink[]): ParsedEntity[] {
  const entities: ParsedEntity[] = [];
  const configuredKind = metadataString(data, "entityType", "entity_type", "type");

  for (const name of metadataList(data, "entities")) {
    entities.push({ name, kind: configuredKind || "OTHER", confidence: 0.75, source: "IMPORTED", evidence: "frontmatter entities" });
  }

  for (const match of body.matchAll(/^(Character|Team|Location|Organization|Story Arc|Artifact|Event|Family|Power System|Threat):\s*(.+)$/gim)) {
    entities.push({ name: match[2].trim(), kind: match[1], confidence: 0.85, source: "IMPORTED", evidence: match[0].trim() });
  }

  for (const link of links) {
    if (link.kind === "WIKI" && link.label) {
      entities.push({ name: link.label, kind: "OTHER", confidence: 0.55, source: "INFERRED", evidence: `Wiki link: ${link.label}` });
    }
  }

  return entities;
}

function uniqueLinks(links: ParsedLink[]) {
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.kind}:${link.url}:${link.label ?? ""}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueEntities(entities: ParsedEntity[]) {
  const seen = new Set<string>();
  return entities.filter((entity) => {
    const key = `${entity.kind}:${entity.name}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
