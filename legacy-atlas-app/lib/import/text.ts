import { createHash } from "node:crypto";

export function toPosixPath(value: string) {
  return value.replaceAll("\\", "/");
}

export function hashText(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

export function slugify(value: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);

  return slug || "untitled";
}

export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function makeTitleFingerprint(value: string) {
  return slugify(value).replaceAll("-", "");
}

export function makeContentFingerprint(value: string) {
  return hashText(normalizeWhitespace(value).toLowerCase());
}

export function excerpt(value: string, length = 260) {
  const clean = normalizeWhitespace(value);
  if (clean.length <= length) return clean;
  return `${clean.slice(0, length - 1).trim()}...`;
}

export function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const clean = normalizeWhitespace(value).replace(/^#/, "");
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }

  return result;
}

export function tokenSimilarity(left: string, right: string) {
  const leftTokens = new Set(tokens(left));
  const rightTokens = new Set(tokens(right));
  if (leftTokens.size === 0 && rightTokens.size === 0) return 1;
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }

  return intersection / (leftTokens.size + rightTokens.size - intersection);
}

function tokens(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}
