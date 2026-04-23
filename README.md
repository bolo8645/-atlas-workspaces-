# Atlas Workspaces

Atlas Workspaces turns exported Apple Notes files into a structured relational database application. Apple Notes stays the capture layer only; the application imports exported files, parses them, stores preserved source content in PostgreSQL through Prisma, and lets you add searchable database-level metadata without overwriting the original import.

## Architecture

- **Import layer:** `scripts/import-notes.ts` runs the importer against `IMPORT_NOTES_DIR`.
- **Parsing layer:** `lib/import/parser.ts` supports Markdown, plain text, and basic HTML exports with defensive metadata, tag, category, attachment, link, and entity extraction.
- **Deduplication layer:** `lib/import/importer.ts` upserts by source identity, checksum, title fingerprint, and token similarity. Ambiguous matches become review items.
- **Data layer:** `prisma/schema.prisma` defines notes, tags, categories, attachments, links, entities, relationships, import runs, import errors, parse warnings, review items, saved searches, and ASCU-ready domain entities.
- **Backend layer:** `lib/notes/queries.ts`, `lib/notes/mutations.ts`, server actions, and JSON route handlers expose notes, imports, metadata edits, review updates, and importer triggers.
- **Frontend layer:** Next.js App Router pages provide dashboard, notes list, note detail, import history, tags, categories, attachments, and review queue.

## Folder Structure

- `app/`: App Router UI and API routes.
- `app/api/notes`: JSON notes list and note detail/update endpoints.
- `app/api/imports`: import history and server-side import trigger endpoint.
- `components/`: shared navigation, search, shells, and display components.
- `lib/import/`: scanner, parser, fingerprinting, dedupe, upsert, import logging, and inferred relationships.
- `lib/notes/`: query, mutation, server-action, and display helpers for the app.
- `prisma/`: database schema and seed entry point.
- `sample-imports/`: importable sample Markdown, text, HTML, and asset files.
- `scripts/import-notes.ts`: command-line importer.

## Database Model

Primary notes schema:

- `Note`
- `MetadataOverride`
- `Tag`
- `NoteTag`
- `Category`
- `NoteCategory`
- `Attachment`
- `Link`
- `Entity`
- `NoteEntity`
- `RelatedNote`
- `SourceCollection`
- `ImportRun`
- `NoteImportEvent`
- `ImportError`
- `ParseWarning`
- `ReviewItem`
- `SavedSearch`

The schema also keeps ASCU-oriented structured models such as `Character`, `City`, `Faction`, `PowerSystem`, `StoryArc`, and `TimelineEvent` so generic notes can later connect to a full comic-universe codex without a rebuild.

## Environment

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Required values:

```bash
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres?schema=public&sslmode=require"
IMPORT_NOTES_DIR="./sample-imports"
NEXT_PUBLIC_APP_NAME="Atlas Workspaces"
NEXT_PUBLIC_SUPABASE_URL="https://[YOUR-PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_[YOUR-KEY]"
```

Optional:

```bash
ADMIN_IMPORT_SECRET=""
```

When `ADMIN_IMPORT_SECRET` is set, `POST /api/imports` requires either `x-admin-secret` or `Authorization: Bearer <secret>`.

## Local Setup

Install dependencies:

```bash
npm install
```

Start local PostgreSQL:

```bash
docker compose up -d
```

Generate Prisma client:

```bash
npm run db:generate
```

Create or update tables:

```bash
npm run db:migrate -- --name notes_codex_init
```

Run the importer:

```bash
npm run import-notes
```

Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Authentication

- Supabase Auth provides email/password sign-up and sign-in.
- All application routes are protected. Unauthenticated requests redirect to `/login`.
- Sessions are stored in cookies and refreshed through `proxy.ts` using `@supabase/ssr`.
- Workspace ownership is scoped by Supabase Auth user ID. Notes, folders, entities, and relationships remain scoped through their workspace.

## Local Auth Setup

`.env.local` must exist in the project root for local login and signup.

Create it from `.env.local.example`:

```bash
cp .env.local.example .env.local
```

Set these browser-safe variables in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://wwzqqtjxsiswwwmzatdi.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="your-supabase-publishable-key"
```

Where to get them:

- Supabase project URL: Supabase dashboard -> Project Settings -> API -> Project URL
- Supabase publishable key: Supabase dashboard -> Project Settings -> API -> Publishable key

Server-only values stay separate:

- `DATABASE_URL` is server-only and should stay in `.env` or your deployment environment, not in browser code.

Local login and signup depend on those two `NEXT_PUBLIC_` variables. After changing `.env.local`, restart the Next.js dev server so it reloads the environment variables.

## Deploying On Vercel

1. Create a Supabase project.
2. Use the Supabase Postgres connection string for `DATABASE_URL`.
3. Add these Vercel environment variables:
   - `DATABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `IMPORT_NOTES_DIR` if you need server-side imports in production
   - `ADMIN_IMPORT_SECRET` if you want to keep the import endpoint separately locked
4. Configure Supabase Auth redirect URLs to include your deployed origin plus `/auth/confirm`.
5. Deploy to Vercel. `postinstall` runs `prisma generate` automatically during install.

## Import Flow

1. Export Apple Notes into files or folders.
2. Point `IMPORT_NOTES_DIR` to that export folder.
3. Run `npm run import-notes` or use the Import History page button.
4. The importer scans supported files, parses content, fingerprints source text, upserts notes, syncs imported tags/categories/assets/links/entities, records warnings/errors, creates duplicate review items, and rebuilds inferred relationships.
5. Re-run imports as often as needed. Matching source paths and checksums update or skip existing notes instead of creating duplicate chaos.

Supported note formats for MVP:

- `.md`
- `.markdown`
- `.txt`
- `.html`
- `.htm`

Local asset references in Markdown and HTML are tracked as `Attachment` records. Files stay in the export folder for the MVP.

## UI Routes

- `/`: dashboard with totals, recent imports, missing metadata, warnings, top tags, top categories, attachments, and orphan notes.
- `/notes`: searchable, filterable notes list.
- `/notes/[id]`: preserved source text, clean extracted text, metadata editing, tags, categories, attachments, links, entities, warnings, import history, and manual relationships.
- `/imports`: import history and importer trigger.
- `/tags`: tag index.
- `/categories`: category index.
- `/attachments`: attachment browser.
- `/review`: duplicate, parse warning, import error, and missing metadata review queue.

## Search And Filters

The notes list supports:

- keyword search across title, source path, excerpt, body, and curated metadata
- title-only search
- body-only search
- tag filter
- category filter
- entity filter
- status filter
- import status filter through the API/query layer
- imported date range
- notes with attachments
- notes missing metadata
- notes with parse warnings

Keyword and body search use PostgreSQL full-text matching through `to_tsvector`/`plainto_tsquery`, with Prisma `contains` filters kept as a defensive fallback for partial matches and metadata fields. A dedicated search engine can later be added behind `lib/notes/queries.ts` without moving search logic into the frontend.

## Preservation Rules

- `Note.importedContent` stores the raw exported source.
- `Note.plainTextContent` stores parser-normalized text for search and reading.
- User edits go into `MetadataOverride`, manual tag/category joins, and relationship tables.
- Metadata editing does not mutate the original imported source text.

## MVP Next Improvements

- Add real PostgreSQL full-text `tsvector` indexes and ranking migrations.
- Add a background job runner for long imports instead of running inside a request.
- Add richer HTML sanitization and rendered Markdown.
- Add entity promotion workflows for characters, teams, locations, organizations, story arcs, artifacts, events, families, power systems, and threat classifications.
- Add duplicate merge tools with side-by-side comparison.
- Add graph and timeline views from `RelatedNote`, `Entity`, and timeline-ready date fields.
- Add AI summaries and entity extraction behind explicit jobs.
- Add multi-user accounts, roles, public/private note flags, and cloud file storage.
