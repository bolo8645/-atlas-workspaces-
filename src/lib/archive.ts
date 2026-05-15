import { getCollection, type CollectionEntry } from "astro:content";
import { getSection, sections, type SectionSlug } from "@/data/sections";

export type ArchiveEntry =
  | CollectionEntry<"characters">
  | CollectionEntry<"cities">
  | CollectionEntry<"organizations">
  | CollectionEntry<"story-arcs">
  | CollectionEntry<"timeline">
  | CollectionEntry<"concepts">
  | CollectionEntry<"factions">
  | CollectionEntry<"materials">;

export type ArchiveEntryView = {
  entry: ArchiveEntry;
  title: string;
  slug: string;
  category: SectionSlug;
  categoryLabel: string;
  singularLabel: string;
  href: string;
  status: string;
  city: string;
  affiliations: string[];
  firstAppearance: string;
  tags: string[];
  summary: string;
  featuredImage: string;
  lastUpdated: string;
  relatedSlugs: string[];
  searchText: string;
};

export async function getEntriesBySection(sectionSlug: SectionSlug): Promise<ArchiveEntryView[]> {
  const entries = await getCollection(sectionSlug);

  return entries.map(toEntryView).sort(sortEntries);
}

export async function getAllEntries(): Promise<ArchiveEntryView[]> {
  const nestedEntries = await Promise.all(sections.map((section) => getEntriesBySection(section.slug)));

  return nestedEntries.flat().sort(sortEntries);
}

export function getEntryHref(entry: ArchiveEntry): string {
  const section = getSection(entry.data.category);
  const slug = getContentSlug(entry);

  if (!section.hasDetailPages) {
    return `${section.href}#${slug}`;
  }

  return `${section.href}${slug}/`;
}

export function toEntryView(entry: ArchiveEntry): ArchiveEntryView {
  const section = getSection(entry.data.category);
  const slug = getContentSlug(entry);
  const lastUpdated = entry.data.lastUpdated.toISOString().slice(0, 10);
  const searchText = [
    entry.data.title,
    section.label,
    entry.data.status,
    entry.data.city,
    entry.data.firstAppearance,
    entry.data.summary,
    entry.data.affiliations.join(" "),
    entry.data.tags.join(" ")
  ]
    .join(" ")
    .toLowerCase();

  return {
    entry,
    title: entry.data.title,
    slug,
    category: entry.data.category,
    categoryLabel: section.label,
    singularLabel: section.singularLabel,
    href: getEntryHref(entry),
    status: entry.data.status,
    city: entry.data.city,
    affiliations: entry.data.affiliations,
    firstAppearance: entry.data.firstAppearance,
    tags: entry.data.tags,
    summary: entry.data.summary,
    featuredImage: entry.data.featuredImage,
    lastUpdated,
    relatedSlugs: entry.data.relatedSlugs,
    searchText
  };
}

export function getRelatedEntries(entry: ArchiveEntryView, allEntries: ArchiveEntryView[], limit = 4): ArchiveEntryView[] {
  const explicitRelated = entry.relatedSlugs
    .map((slug) => allEntries.find((candidate) => candidate.slug === slug) ?? null)
    .filter((candidate): candidate is ArchiveEntryView => candidate !== null)
    .filter((candidate) => candidate.slug !== entry.slug);

  if (explicitRelated.length >= limit) {
    return explicitRelated.slice(0, limit);
  }

  const explicitSlugs = new Set(explicitRelated.map((candidate) => candidate.slug));
  const entryTags = new Set(entry.tags);
  const inferredRelated = allEntries
    .filter((candidate) => candidate.slug !== entry.slug && !explicitSlugs.has(candidate.slug))
    .map((candidate) => ({
      candidate,
      score:
        (candidate.category === entry.category ? 2 : 0) +
        (candidate.city && candidate.city === entry.city ? 2 : 0) +
        candidate.tags.filter((tag) => entryTags.has(tag)).length
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.title.localeCompare(b.candidate.title))
    .map((item) => item.candidate);

  return [...explicitRelated, ...inferredRelated].slice(0, limit);
}

export function getEntryBySlug(entries: ArchiveEntryView[], slug: string): ArchiveEntryView | undefined {
  return entries.find((entry) => entry.slug === slug);
}

function sortEntries(a: ArchiveEntryView, b: ArchiveEntryView): number {
  return b.lastUpdated.localeCompare(a.lastUpdated) || a.title.localeCompare(b.title);
}

function getContentSlug(entry: ArchiveEntry): string {
  return entry.id
    .replace(/\.(md|mdx)$/i, "")
    .replace(/\/index$/i, "")
    .split("/")
    .pop() ?? entry.id;
}
