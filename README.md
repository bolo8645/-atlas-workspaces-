# ASCU Official Archive

Static Phase 1 archive site for the Altered Skies Comics Universe.

This project is intentionally Astro-first and static-only. It does not use Next.js, React, Supabase, Prisma, auth, databases, server actions, CMS services, or external APIs.

## Stack

- Astro
- HTML
- CSS
- Astro Content Collections
- Local Markdown content files
- Static output

## Project Structure

```text
src/
  components/          Reusable archive HUD components
  content/             Local Markdown entries grouped by section
  content/config.ts    Astro Content Collections schema
  data/sections.ts     Navigation and section metadata
  lib/archive.ts       Static content helpers
  pages/               Real static routes
  styles/global.css    Global archive visual system
```

## Content

Archive entries live in `src/content/<section>/`.

Reusable entry templates live in `content-templates/`. These files are not published by Astro; copy one into the correct `src/content/<section>/` folder when you are ready to create a real archive entry.

Required frontmatter:

```yaml
title: "Sample Placeholder"
slug: sample-placeholder
category: characters
status: "Status: Verified"
city: "Sample Placeholder"
affiliations: ["Sample Placeholder"]
firstAppearance: "Sample Placeholder"
tags: ["Sample Placeholder"]
summary: "Placeholder only."
featuredImage: ""
lastUpdated: 2026-05-15
relatedSlugs: ["another-entry"]
```

Timeline entries build into `/timeline/#entry-slug`. Timeline detail pages are not generated unless a future phase explicitly adds them.

## How to Add ASCU Content

1. Choose the matching template from `content-templates/`.
2. Copy it into the correct content folder.
3. Rename the copied file to the final route slug, using lowercase words separated by hyphens.
4. Update the frontmatter and every `EDIT:` section.
5. Keep `category` exactly matched to the destination folder.
6. Do not create custom pages or layouts for individual entries. Every new entry must use the existing archive shell by living as a Markdown file in `src/content/<section>/`.
7. Run `npm run build` before publishing.

The filename controls the deployed route. For example:

```text
src/content/characters/atlas-operative.md
```

builds:

```text
/characters/atlas-operative/
```

The `slug` frontmatter field is kept for editorial clarity, but Astro derives the actual static route from the Markdown filename. Keep the frontmatter `slug` and filename aligned to avoid confusion.

Section index pages automatically link to detail pages using normal static anchors. For example, `src/content/characters/atlas-operative.md` appears on `/characters/` as a link to `/characters/atlas-operative/`.

Timeline entries are the exception: they appear on `/timeline/` and link to an anchor such as `/timeline/#atlas-operative-event`, not a separate detail page.

Template destinations:

- Character profile: copy `content-templates/character-profile.md` to `src/content/characters/<slug>.md`
- City profile: copy `content-templates/city-profile.md` to `src/content/cities/<slug>.md`
- Organization profile: copy `content-templates/organization-profile.md` to `src/content/organizations/<slug>.md`
- Story arc profile: copy `content-templates/story-arc-profile.md` to `src/content/story-arcs/<slug>.md`
- Timeline entry: copy `content-templates/timeline-entry.md` to `src/content/timeline/<slug>.md`
- Concept/lore entry: copy `content-templates/concept-lore-entry.md` to `src/content/concepts/<slug>.md`
- Faction profile: copy `content-templates/faction-profile.md` to `src/content/factions/<slug>.md`
- Material/artifact profile: copy `content-templates/material-artifact-profile.md` to `src/content/materials/<slug>.md`

Do not leave `EDIT:` placeholders in published entries. Use clearly sourced ASCU material only; do not invent lore to fill a section.

### Frontmatter Rules

- `title`: display title shown across the archive.
- `slug`: editorial slug; keep it aligned with the filename.
- `category`: must be one of `characters`, `cities`, `organizations`, `story-arcs`, `timeline`, `concepts`, `factions`, or `materials`.
- `status`: short archive status, such as `Status: Draft`, `Status: Verified`, or `Status: Monitoring`.
- `city`: primary city or `Not specified`.
- `affiliations`: YAML array of related groups or `["Not specified"]`.
- `firstAppearance`: issue, document, date, or `Not specified`.
- `tags`: YAML array used by static search and related-entry matching.
- `summary`: concise list/search summary.
- `featuredImage`: leave empty unless a deployment-safe public image path is added.
- `lastUpdated`: date in `YYYY-MM-DD` format.
- `relatedSlugs`: YAML array of filenames without `.md`, such as `["sample-city-entry"]`.

## Commands

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Build static output:

```bash
npm run build
```

Preview the built site:

```bash
npm run preview
```

## Deploy

This is a static Astro site. It does not need a running local terminal server after deployment.

The deployment settings are:

- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: none

After a successful build, Astro writes the deployable site into `dist/`.

### Vercel

Use Vercel's project import flow and select this repository.

Recommended settings:

- Framework preset: `Astro`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: none

The repository includes `vercel.json` with the same build command and output directory.

Vercel will run the build and serve the generated static files from `dist/`. No serverless functions, API routes, database, auth, or runtime environment variables are required for Phase 1.

### Netlify

Use Netlify's "Add new site" flow and connect this repository.

Recommended settings:

- Build command: `npm run build`
- Publish directory: `dist`
- Environment variables: none

The repository includes `netlify.toml` with the same build command and publish directory.

Netlify will run the build and publish the static files from `dist/`. No Netlify Functions, database, auth, CMS, or runtime environment variables are required for Phase 1.

### Static Host

Any static host can serve this site by uploading the contents of `dist/` after running:

```bash
npm run build
```

Internal navigation uses root-relative links such as `/characters/` and `/search/`, so deployed routes work without client-side routing.

## Routes

- `/`
- `/characters/`
- `/characters/[slug]/`
- `/cities/`
- `/cities/[slug]/`
- `/organizations/`
- `/organizations/[slug]/`
- `/story-arcs/`
- `/story-arcs/[slug]/`
- `/timeline/`
- `/concepts/`
- `/concepts/[slug]/`
- `/factions/`
- `/factions/[slug]/`
- `/materials/`
- `/materials/[slug]/`
- `/search/`
