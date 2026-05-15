import { readdir } from "node:fs/promises";
import path from "node:path";
import type { DiscoveredNoteFile } from "./types";
import { toPosixPath } from "./text";

const SUPPORTED_NOTE_EXTENSIONS = new Set([".md", ".markdown", ".txt", ".html", ".htm"]);
const SKIPPED_DIRECTORIES = new Set([".git", ".next", "node_modules", ".DS_Store"]);

export async function discoverNoteFiles(rootDir: string): Promise<DiscoveredNoteFile[]> {
  const root = path.resolve(rootDir);
  const files: DiscoveredNoteFile[] = [];

  async function walk(currentDir: string) {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith(".") || SKIPPED_DIRECTORIES.has(entry.name)) continue;
      const absolutePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) continue;
      const extension = path.extname(entry.name).toLowerCase();
      if (!SUPPORTED_NOTE_EXTENSIONS.has(extension)) continue;

      files.push({
        absolutePath,
        relativePath: toPosixPath(path.relative(root, absolutePath)),
        extension
      });
    }
  }

  await walk(root);
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export function isSupportedNotePath(filePath: string) {
  return SUPPORTED_NOTE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}
