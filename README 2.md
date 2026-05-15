# Altered Skies Comics Universe Archive

Phase 1 is a static-first official lore website for the Altered Skies Comics Universe. It is intentionally simple under the hood: Next.js App Router, TypeScript, Tailwind CSS, and local Markdown content files.

No database, auth, CMS, server actions, external search, random APIs, or environment variables are required.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Local Markdown files with frontmatter
- Static generation and static export
- Vercel-ready build command: `npm run build`

## Commands

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
npm run preview
```

Open the development site at `http://localhost:3000`.

## Folder Structure

```text
app/
  page.tsx
  layout.tsx
  globals.css
  characters/
  cities/
  organizations/
  story-arcs/
  timeline/
  concepts/
  factions/
  materials/
  search/
components/
  MainLayout.tsx
  Header.tsx
  Sidebar.tsx
  ContentCard.tsx
  MetadataPanel.tsx
  TagPill.tsx
  SearchBar.tsx
  EntryHero.tsx
  RelatedLinks.tsx
  StatusBadge.tsx
content/
  characters/
  cities/
  organizations/
  story-arcs/
  timeline/
  concepts/
  factions/
  materials/
lib/
  content.ts
  markdown.tsx
  sections.ts
legacy-atlas-app/
  Previous database-backed workspace app, archived out of the active build.
```

## Routes

- `/`
- `/characters`
- `/characters/[slug]`
- `/cities`
- `/cities/[slug]`
- `/organizations`
- `/organizations/[slug]`
- `/story-arcs`
- `/story-arcs/[slug]`
- `/timeline`
- `/concepts`
- `/concepts/[slug]`
- `/search`

The required content folders also have static route support for `/factions`, `/factions/[slug]`, `/materials`, and `/materials/[slug]`.

## Editing Content

Add or edit Markdown files inside `content/<section>/`.

Supported sections:

- `characters`
- `cities`
- `organizations`
- `story-arcs`
- `timeline`
- `concepts`
- `factions`
- `materials`

Use one file per archive entry. File names should match the slug, for example:

```text
content/characters/sample-character-entry.md
content/cities/sample-city-entry.mdx
```

Markdown (`.md`) and MDX (`.mdx`) files are both accepted. Phase 1 treats MDX as Markdown-compatible content; do not add JSX components inside lore files.

Each file must start with frontmatter:

```md
---
title: "Sample Placeholder: Character Entry"
slug: sample-character-entry
category: characters
status: Sample Placeholder
city: Sample Placeholder
affiliations: ["Sample Placeholder"]
firstAppearance: Sample Placeholder
tags: ["sample-placeholder", "character-format"]
summary: "Placeholder only. Replace this with approved ASCU canon."
featuredImage: ""
lastUpdated: 2026-05-15
relatedSlugs: ["sample-city-entry"]
---

# Sample Placeholder

This body supports basic Markdown headings, paragraphs, lists, links, inline code, and bold text.
```

Rules:

- `slug` must be unique across the archive.
- `category` must match the folder name.
- `status`, `city`, `firstAppearance`, `summary`, `featuredImage`, `lastUpdated`, `affiliations`, `tags`, and `relatedSlugs` are optional, but keeping them filled improves search and metadata panels.
- Missing optional text fields fall back to safe archive labels such as `Not specified` or a generated summary.
- `relatedSlugs` links entries by slug. Missing related slugs are ignored by the UI so one bad relationship does not break a page.
- `featuredImage` can be left empty or set to a public image path such as `/images/example.jpg`.
- Keep sample placeholder content clearly labeled until real ASCU canon is supplied.

Required frontmatter fields:

| Field | Required | Notes |
| --- | --- | --- |
| `title` | Yes | Public title shown on cards and detail pages. |
| `slug` | Yes | Lowercase letters, numbers, and hyphens only. Must be unique. |
| `category` | Yes | Must match the content folder. |
| `status` | No | Example: `Sample Placeholder`, `Draft`, `Approved`. |
| `city` | No | Use `Sample Placeholder` until real canon exists. |
| `affiliations` | No | Use an array: `["Sample Placeholder"]`. |
| `firstAppearance` | No | Use source reference text when known. |
| `tags` | No | Use lowercase stable tags. |
| `summary` | No | Short card/search description. |
| `featuredImage` | No | Public image path or empty string. |
| `lastUpdated` | No | ISO date recommended: `YYYY-MM-DD`. |
| `relatedSlugs` | No | Slugs of related entries. |

Validation behavior:

- Broken frontmatter fails the build with a file-specific error.
- Unknown categories fail the build.
- Duplicate slugs fail the build.
- Timeline entries do not create detail pages; their links point to anchors on `/timeline`.

## Static Search

Search is implemented in `components/SearchExperience.tsx`.

It receives a static search index from `lib/content.ts` and filters in the browser over:

- title
- category
- status
- city
- affiliations
- first appearance
- tags
- summary

There is no external search service.

## Vercel Deployment

1. Push the repository to GitHub.
2. Import it into Vercel as a Next.js project.
3. Use the default install command: `npm install`.
4. Use the build command: `npm run build`.
5. No environment variables are needed for Phase 1.

The Next config uses `output: "export"` so the build produces a static `out/` directory.

## Content Policy

Phase 1 includes sample placeholder entries only. Do not publish invented ASCU canon in this repository unless approved lore has been provided.
