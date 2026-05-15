# ATLAS_BUILD_PLAN

## 1. Current App Diagnosis

### What is currently broken

#### Local
- `/notes` has been failing with `PrismaClientValidationError` in the navigation loader path.
- The failing path has been:
  - `lib/navigation-queries.ts`
  - `getNavigationRecords()`
  - `getNavigationTree()`
- The visible symptom has been a `prisma.navigationNode.findMany()` failure using `workspaceId: "default-ascu"`.

#### Production
- `/notes` reaches the authenticated app, but then fails with:
  - `The table public.Workspace does not exist in the current database.`
- This indicates production auth is mostly working, but production database migrations are not fully applied.

### Why `/notes` is failing

#### Local failure type
This is not primarily a seed-data failure.

Current repo inspection shows:
- `default-ascu` is an intentional workspace constant.
- It is seeded locally.
- Local DB contains a real `default-ascu` workspace with navigation nodes and notes.
- The current local issue is therefore a combination of:
  - loader/query assumptions that were too brittle
  - Prisma runtime/schema drift during recent note-actions changes
  - fallback workspace resolution that was previously too loose

#### Production failure type
This is not primarily an auth failure.

It is:
- a migration/deploy sequencing problem
- or a production database mismatch
- or both

Production is missing required Prisma-created tables. The app code expects `Workspace`, but the production DB does not currently have it.

### Is the issue schema, migration, seed data, query logic, or deployment related?

#### Local
- Schema: present in repo
- Migration: likely applied locally
- Seed data: present locally for `default-ascu`
- Query logic: yes, part of the failure
- Generated Prisma/runtime consistency: yes, part of the failure
- Deployment: not the local blocker

#### Production
- Schema: present in repo
- Migration: missing or not applied in production
- Seed data: may also be missing, but the first blocker is missing tables
- Query logic: secondary
- Deployment: yes, this is the main production blocker

### What must be fixed before any new features are added

1. Reliable workspace resolution
2. Safe navigation loading
3. Safe notes workspace loading
4. Prisma schema/client/runtime consistency
5. Production migration application
6. Controlled fallbacks instead of raw Prisma crash screens

No new note-actions work should continue until those are verified.

---

## 2. Stabilization Plan

### Local app

1. Lock workspace resolution to one DB-backed path
   - Authenticated user resolves to active workspace
   - If no owned workspace exists, bootstrap one safely
   - Fallback workspace must be DB-backed, not fabricated in memory

2. Harden `/notes` loader chain
   - `getNavigationTree()` must return an empty tree if navigation is unavailable
   - notes workspace loading must return empty results rather than crash on validation mismatch
   - page-level composition must not let one panel query kill the entire workspace render

3. Audit note-actions schema assumptions
   - confirm all new fields used in shared note loaders exist in schema
   - ensure any stale-client-sensitive fields are guarded during stabilization
   - keep note-actions behavior out of the critical `/notes` boot path until stability is confirmed

4. Verify local data state
   - confirm seeded workspace exists
   - confirm seeded navigation nodes exist
   - confirm notes exist in active workspace
   - confirm user login reaches `/notes`

5. Restart and verify running dev runtime
   - stale dev Prisma runtime must not be treated as app truth
   - after regenerate/build checks, local browser flow must be re-verified

### Production app

1. Confirm production database target
   - verify Vercel runtime uses the intended Supabase/Postgres database
   - verify the deployed project is not pointing at an empty or wrong DB

2. Apply production-safe migrations
   - use `prisma migrate deploy`
   - do not use `prisma migrate dev` in production
   - confirm `Workspace`, `NavigationNode`, `Note`, `Entity`, `Relationship`, `RelationshipType`, `Tag`, and relevant join tables exist

3. Re-deploy with migration-capable build
   - Vercel build must execute:
     - `prisma generate`
     - `prisma migrate deploy`
     - `next build`

4. Post-deploy verification
   - login works
   - `/notes` loads
   - workspace bootstrap succeeds
   - navigation loads
   - no `Workspace` missing-table error remains

### Prisma migration strategy

- Use forward-only migrations
- No destructive renames or down-migrations during stabilization
- Every schema change must land with a migration
- Local development:
  - `npx prisma generate`
  - `npm run db:migrate` or `npx prisma migrate dev` only when new schema changes are intentionally created
- Production:
  - `npx prisma migrate deploy`
- If a migration fails in production, prefer a corrective forward migration over rollback SQL

### Supabase production database strategy

- Treat Supabase Postgres as the source of truth
- Use pooled runtime connection for app traffic
- Use direct/session connection for Prisma CLI/migrations
- Require both:
  - `DATABASE_URL`
  - `DIRECT_URL`
- Never use service role or browser-unsafe keys in frontend code
- Before future risky migrations:
  - create a database backup or Supabase branch/snapshot

### Vercel deployment strategy

- Keep `build` or `vercel-build` responsible for:
  - `prisma generate`
  - `prisma migrate deploy`
  - `next build`
- Ensure Vercel is actually using that build command, not plain `next build`
- Confirm all runtime env vars exist in Vercel before redeploy
- Do not change env variable names unless required by Prisma or Supabase integration

### Rollback plan

1. Before any future schema change
   - capture a production DB snapshot/backup
   - note current deployed commit SHA

2. If code deploy fails but schema is unchanged
   - redeploy last known good commit

3. If migration partially applies
   - stop further deploys
   - inspect `_prisma_migrations`
   - fix with a forward corrective migration
   - do not manually hack tables unless the DB is already backed up and the intervention is documented

4. If note-actions reintroduction causes regressions
   - disable the UI/action entry points first
   - keep core note loading path stable
   - do not revert user content

---

## 3. Target Product Architecture

### Workspaces
- Each authenticated user has one or more workspaces
- Each workspace owns:
  - navigation nodes
  - notes
  - entities
  - relationships
  - relationship types
  - tags
  - future imports/inbox state
- Workspace selection is explicit and cookie/session-backed

### Notes
- Notes remain the central authoring object
- A note belongs to one workspace
- A note may optionally belong to:
  - one navigation node
  - one primary entity
- Imported content remains preserved
- User-curated overlays remain separate where practical
- Notes support:
  - soft delete
  - pinning
  - tags
  - lock state
  - future import source tracking

### Navigation folders/nodes
- NavigationNode is the structured folder tree
- It is workspace-scoped
- It can safely render empty
- Missing navigation data must not crash `/notes`

### Entities
- Entities are workspace-scoped structured codex objects
- They are not interchangeable with notes
- Notes may map to entities, but the system must support notes without entity records

### Relationships
- Relationships are workspace-scoped and connect entities
- Relationship types are workspace-scoped and explicit
- The right-side interconnection panel should read from these, not infer everything ad hoc

### Tags
- Tags should be workspace-scoped in the target architecture
- Keep join-table design (`NoteTag`) rather than flattening tags into free text
- Manual and imported tag sources remain distinguishable

### Import inbox / staging area
- Imported notes first land in an Inbox or Staging node/folder
- Imports must retain:
  - source
  - importedAt
  - original title/source path where available
- Imported notes should be reviewable before heavy classification

### Note actions
Target note actions:
1. Delete
2. Duplicate
3. Pin / Unpin
4. Tag
5. Lock / Unlock

These must be reintroduced incrementally, with schema and data layer verified before UI behavior is expanded.

### Locking approach
- v1 lock is UI/session-gated access, not encryption
- Passcodes must never be stored in plain text
- If passcode hashing is implemented, it must be explicit and correct
- Unlock state may be session-based
- This should not be marketed as content encryption

### Future offline support
- Deferred until server-state model is stable
- Future direction:
  - local cache + sync queue
  - background reconciliation
  - conflict-aware note editing
- Do not begin offline/local-first work until:
  - auth
  - workspace scoping
  - note actions
  - imports
  - production deploy flow
  are stable

---

## 4. Database Model Plan

This section defines the intended target data model. It does not authorize immediate schema changes.

### User / profile ownership
Recommended target:
- Add a dedicated `UserProfile` model keyed to Supabase Auth user ID
- Use that as the ownership root for app-level data

Target shape:
- `UserProfile`
  - `id` = Supabase auth user id
  - profile metadata as needed later
- `Workspace`
  - `ownerId` -> `UserProfile.id`

Reason:
- avoids leaving workspace ownership as an unstructured nullable string
- makes ownership explicit and query-safe

### Workspace
Required target fields:
- `id`
- `ownerId`
- `name`
- `createdAt`
- `updatedAt`

Optional future:
- `slug`
- `isArchived`
- `defaultNavigationNodeId`

### Note
Target fields:
- `id`
- `workspaceId`
- `navigationNodeId?`
- `entityId?`
- `title`
- `importedContent`
- `plainTextContent`
- `curatedSummary?`
- `metadataNotes?`
- `sourceIdentity`
- `sourcePath`
- `sourceChecksum`
- `contentFingerprint`
- `sortOrder`
- `status`
- `isPinned`
- `deletedAt?`
- `isLocked`
- `lockedAt?`
- `lockedBy?`
- `lockPasscodeHash?` only if hashing is correctly implemented
- import metadata fields already present should remain explicit

### NavigationNode
Target fields:
- `id`
- `workspaceId`
- `parentId?`
- `slug`
- `title`
- `description?`
- `sortOrder`
- `isVisible`

### Entity
Target fields:
- `id`
- `workspaceId`
- `slug`
- `name`
- `type`
- `kind`
- `aliases`
- `description?`

### Relationship
Target fields:
- `id`
- `workspaceId`
- `entityAId`
- `entityBId`
- `relationshipTypeId`
- `type`
- `description?`
- `createdAt`

### Tags
Recommended target:
- `Tag` becomes workspace-scoped
- Keep `NoteTag` join table

Target shape:
- `Tag`
  - `id`
  - `workspaceId`
  - `slug`
  - `name`
  - `description?`
- `NoteTag`
  - `noteId`
  - `tagId`
  - `source`
  - `createdAt`

### Soft delete
Use:
- `Note.deletedAt`
- Normal note lists exclude deleted notes
- Restore/permanent delete can come later
- Do not hard-delete by default in v1 action rollout

### Pinning
Use:
- `Note.isPinned`
- Ordering rule:
  - pinned first
  - then existing note sort order
  - then updated/title fallback

### Locking
Use:
- `Note.isLocked`
- `Note.lockedAt?`
- `Note.lockedBy?`
- `Note.lockPasscodeHash?` only if implemented safely

### Import metadata
Keep explicit import lineage:
- `SourceCollection`
- `ImportRun`
- `NoteImportEvent`
- `ImportError`
- `ParseWarning`
- `ReviewItem`

Future addition:
- explicit import inbox/staging ownership at workspace level if needed

---

## 5. Feature Roadmap

### Phase 1: Restore app stability
- Fix workspace resolution
- Fix `/notes` loader safety
- Confirm local schema/client/runtime consistency
- Confirm production migration status
- No new feature behavior

### Phase 2: Fix scrolling globally
- Make all major panels scroll independently
- Do not change side rail behavior or layout structure

### Phase 3: Note actions UI only
- Add menu shell only
- No destructive behavior yet
- Desktop right-click, mobile long-press, visible mobile `...`

### Phase 4: Note delete
- Soft delete only
- Confirmation required
- Exclude deleted notes from normal lists

### Phase 5: Note duplicate
- Duplicate title/content/workspace/folder placement
- New note ID
- `(Copy)` suffix
- No lock-state carryover by default

### Phase 6: Pin / Unpin
- Toggle pinned state
- Keep existing ordering behavior after pinned grouping

### Phase 7: Tags
- Manual tags through existing/updated tag model
- Comma-separated input acceptable initially
- Workspace-scoped tags preferred target

### Phase 8: Lock / Unlock
- Session-based unlock gate
- Hashed passcode only if implemented correctly
- No fake encryption claims

### Phase 9: Import center
- Manual import / paste workflow
- Inbox/Staging destination
- Safe repeated import handling

### Phase 10: Production hardening
- migration discipline
- deploy verification
- runtime diagnostics
- better failure handling around workspace bootstrap

### Phase 11: Mobile polish
- menu triggers
- touch behavior
- panel usability
- no layout redesign

### Phase 12: Offline / local-first support later
- plan only after server model is stable
- do not mix with current stabilization work

---

## 6. Verification Checklist

### Phase 1: Stability

**Likely files**
- `lib/workspaces.ts`
- `lib/workspace-db.ts`
- `lib/navigation-queries.ts`
- `lib/notes/workspace-queries.ts`
- `app/notes/page.tsx`
- `app/layout.tsx`

**Commands**
- `npm run typecheck`
- `npm run build`
- `npm run db:generate`
- `curl -I http://localhost:3000/login`
- `curl -I http://localhost:3000/notes`
- local authenticated browser verification
- `npm run db:migrate:deploy` against production target during deploy verification

**Success criteria**
- login works
- local `/notes` loads
- navigation tree loads
- workspace bootstrap works
- no raw Prisma crash screen
- production migration state is clear

**Must not change**
- side rails
- panel sizing behavior
- main visual layout

### Phase 2: Scrolling

**Likely files**
- `app/layout.tsx`
- `app/globals.css`
- `components/ResizableAppShell.tsx`
- `components/NotesWorkspace.tsx`
- `components/NavigationSidebarClient.tsx`
- `components/RichTextEditor.tsx`

**Commands**
- `npm run typecheck`
- `npm run build`
- manual desktop scroll verification
- manual mobile/touch scroll verification

**Success criteria**
- left panel scrolls
- notes list scrolls
- editor scrolls
- right panels scroll
- body is not the only scroll container

**Must not change**
- rail shape/placement
- expand/collapse behavior

### Phase 3: Note actions UI only

**Likely files**
- `components/NotesWorkspace.tsx`
- small supporting UI component for context menu if needed

**Commands**
- `npm run typecheck`
- `npm run build`
- manual right-click test
- manual long-press test
- manual mobile `...` trigger test

**Success criteria**
- action menu opens on desktop and mobile
- no data mutation yet
- no loading regressions

**Must not change**
- data schema
- note persistence logic
- layout structure

### Phase 4: Delete

**Likely files**
- `lib/notes/actions.ts`
- `lib/notes/mutations.ts`
- `lib/notes/workspace-queries.ts`
- `components/NotesWorkspace.tsx`
- Prisma schema/migration if soft delete field changes are needed

**Commands**
- `npm run db:generate`
- `npm run db:migrate` if schema changes
- `npm run typecheck`
- `npm run build`

**Success criteria**
- soft delete works
- deleted notes disappear from normal lists
- app still loads cleanly

**Must not change**
- unrelated auth/deploy code
- imported note content

### Phase 5: Duplicate

**Likely files**
- `lib/notes/actions.ts`
- `lib/notes/mutations.ts`
- `components/NotesWorkspace.tsx`

**Commands**
- `npm run typecheck`
- `npm run build`

**Success criteria**
- duplicate note created safely
- correct workspace/folder retained
- `(Copy)` appended
- no lock/deleted carryover by default

**Must not change**
- note source lineage fields unless intentionally copied

### Phase 6: Pin / Unpin

**Likely files**
- `lib/notes/actions.ts`
- `lib/notes/workspace-queries.ts`
- note ordering utilities
- `components/NotesWorkspace.tsx`

**Commands**
- `npm run typecheck`
- `npm run build`

**Success criteria**
- pin toggles
- pinned notes surface first
- existing sort remains sensible

**Must not change**
- unrelated list filtering behavior

### Phase 7: Tags

**Likely files**
- Prisma schema/migration if tag scoping changes
- `lib/notes/actions.ts`
- tag query helpers
- `components/NotesWorkspace.tsx`

**Commands**
- `npm run db:generate`
- `npm run db:migrate` if schema changes
- `npm run typecheck`
- `npm run build`

**Success criteria**
- manual tag add/remove works
- tags persist
- lists still load
- no cross-workspace leakage in target model

**Must not change**
- note body content
- import data lineage

### Phase 8: Lock / Unlock

**Likely files**
- `lib/notes/actions.ts`
- `lib/notes/mutations.ts`
- `components/NotesWorkspace.tsx`
- auth/session helper if needed for unlock state only

**Commands**
- `npm run typecheck`
- `npm run build`

**Success criteria**
- locked notes require unlock flow
- no plain-text passcode storage
- app load remains stable

**Must not change**
- auth foundation unless required for unlock session handling

### Phase 9: Import center

**Likely files**
- import action UI component
- note creation/import helpers
- staging/inbox resolution helpers
- maybe `app/notes/page.tsx` or notes toolbar entrypoint

**Commands**
- `npm run typecheck`
- `npm run build`
- manual import test

**Success criteria**
- notes can be imported/pasted safely
- imported notes land in Inbox/Staging
- metadata retained

**Must not change**
- existing imported content preservation rules

### Phase 10: Production hardening

**Likely files**
- `package.json`
- `prisma/schema.prisma`
- deploy docs
- migration wrapper scripts if needed

**Commands**
- `npm run db:generate`
- `npm run db:migrate:deploy`
- `npm run build`
- Vercel redeploy verification

**Success criteria**
- production DB has required tables
- `/login` and `/notes` work in production
- no missing Workspace table

**Must not change**
- env var names unless absolutely required

### Phase 11: Mobile polish

**Likely files**
- `components/NotesWorkspace.tsx`
- small action/menu components
- minimal utility styles

**Commands**
- `npm run typecheck`
- `npm run build`
- device-width manual verification

**Success criteria**
- mobile note actions are discoverable
- touch interactions are reliable
- no layout regressions

**Must not change**
- panel model
- desktop rail behavior

### Phase 12: Offline / local-first later

**Likely files**
- future storage/sync subsystem
- note mutation layer
- client caching layer

**Commands**
- TBD after architecture decision

**Success criteria**
- to be defined only after server-state stabilization

**Must not change**
- existing stable online behavior without explicit migration plan

---

## 7. Zero-Tolerance Rules

- Do not modify side rail layout unless explicitly asked
- Do not break panel expand/collapse
- Do not change auth unless required for the current failure
- Do not change env variable names unless absolutely required
- Do not delete ASCU content
- Do not remove imported notes or lore files
- Do not implement database changes without migrations
- Do not claim success unless local `/notes` loads and production migration status is clear
- Do not continue note-actions work until stability is verified
- Do not hide production-breaking DB errors behind fake success states

---

## Current Repo Facts That Matter

- `Workspace` exists in current Prisma schema
- `NavigationNode.workspaceId` exists in current Prisma schema
- current schema already includes note-actions-related fields on `Note`
- migrations exist through `20260423033308_note_actions_context_menu`
- build script already runs:
  - `db:generate`
  - `db:migrate:deploy`
  - `next build`
- direct Prisma CLI checks need `DIRECT_URL`; the existing wrapper script should be used for normal project migration commands
- production screenshot indicates missing migrated tables, not missing auth wiring

## Approval Boundary

After plan approval, the first implementation pass should be Phase 1 only:
- stabilize local `/notes`
- verify local login -> `/notes`
- confirm production migration status and deploy path
- stop before reintroducing note-actions behavior
