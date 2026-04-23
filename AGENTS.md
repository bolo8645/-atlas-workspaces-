# AGENTS.md

## Project Purpose

This repository is a production-minded notes-to-database application.

Its purpose is to ingest exported Apple Notes files and turn them into a structured, searchable, relational application. Apple Notes is only the capture layer. It is never the database, never the backend, and never the long-term source of truth for application logic.

The system must preserve imported source content, support repeated imports, avoid duplicate chaos, and provide a foundation for a long-term creative codex and database.

---

## Core Product Rules

1. Apple Notes is the input source, not the application architecture.
2. Imported source content must be preserved.
3. User-edited metadata must remain separate from imported source content where practical.
4. Re-importing notes must be safe and repeatable.
5. The system must respect existing note organization, folder hierarchy, and naming conventions.
6. Do not flatten structured notes into generic blobs if meaningful structure can be preserved.
7. Build for maintainability and future scale, not demo theatrics.

---

## Engineering Standards

### General Approach

- Act like a production-minded engineer working in an existing codebase.
- Read relevant files before making changes.
- Understand local patterns before introducing new ones.
- Prefer small, high-confidence changes over sweeping speculative rewrites.
- When larger changes are necessary, briefly explain the rationale before implementing them.
- Do not generate fake implementations, placeholder workflows, or decorative architecture.

### Code Quality

- Write clear, readable, maintainable code.
- Use strong typing where possible.
- Prefer explicit logic over hidden behavior.
- Keep modules focused and reasonably small.
- Avoid duplication when logic can be centralized cleanly.
- Avoid vague names, magical behavior, and silent assumptions.
- Do not leave dead code behind.

### Dependencies

- Do not add dependencies casually.
- Every dependency must have a clear purpose.
- Prefer built-in platform tools or existing project dependencies when sufficient.
- If you add a dependency, state why it is necessary.

---

## Workflow Expectations

For each meaningful task:

1. Inspect the relevant files and local context first.
2. State the approach briefly.
3. Implement the change.
4. Run the narrowest useful checks first, then broader checks if needed.
5. Summarize:
   - what changed
   - what was verified
   - what still needs attention

Do not claim code works unless it was actually verified through:
- tests
- linting
- type-checking
- builds
- direct execution
- or clearly described manual inspection

If something could not be verified, say so explicitly.

---

## Notes Import and Parsing Rules

This project depends on real-world note exports, which means input may be inconsistent.

### Importer Requirements

- Build importers defensively.
- Expect malformed, incomplete, or inconsistent files.
- One bad file must not kill the entire import run.
- Log errors and warnings per file where possible.
- Preserve enough source metadata to trace imports back to original files.
- Track import runs explicitly.

### Re-import Behavior

- Re-imports must be repeatable.
- Avoid creating duplicates when the same content is imported again.
- Prefer upsert-style behavior where confidence is high.
- Use source path, checksums, fingerprints, IDs, titles, or content comparison as appropriate.
- Ambiguous duplicate cases should be flagged for review instead of guessed silently.

### Preservation Rules

- Preserve imported source content.
- Do not silently overwrite original imported text.
- If users edit metadata, store it separately from imported source content when practical.
- If editable content is ever introduced, keep imported content and curated/app-authored content distinct.

---

## Database and Schema Rules

Treat the database as a real product layer, not a dumping ground.

### Schema Design

- Use explicit, readable field names.
- Normalize where appropriate.
- Keep core entities separate and intentional.
- Design for repeatable imports and future extensibility.
- Prefer schemas that support search, relationships, and metadata layering cleanly.

### Important Data Principles

- Imported source content is not the same thing as user-curated metadata.
- Source-of-truth fields should be identifiable.
- Derived fields should be clearly separated from imported fields when practical.
- Avoid schema decisions that make future migration painful.

### Migration Discipline

- Be conservative with schema changes.
- Avoid destructive migrations unless clearly justified.
- Where possible, prefer reversible or low-risk changes.
- Do not casually rename or destroy important columns or tables without checking downstream impact.

---

## Frontend Rules

- Do not bury business logic inside UI components if it belongs elsewhere.
- Keep UI state explicit and readable.
- Handle loading, empty, and error states intentionally.
- Favor usability and maintainability over flashy behavior.
- Preserve accessibility where possible.
- Build interfaces that help users work, not interfaces that merely look busy.

---

## Backend Rules

- Keep data flow explicit.
- Validate inputs.
- Handle errors intentionally.
- Do not swallow exceptions silently.
- Separate parsing, validation, transformation, persistence, and presentation logic where reasonable.
- Keep backend behavior predictable.

---

## Search and Relationship Expectations

This application is meant to be more than a flat note viewer.

- Search should be treated as a first-class feature.
- Filtering should be explicit and useful.
- Relationships between notes should be supported intentionally.
- Manual links and inferred links should be modeled cleanly.
- Design so that graph views, entity extraction, and continuity tools can be added later without rebuilding everything.

---

## Documentation Rules

- Update documentation when setup, commands, workflows, architecture, or environment requirements materially change.
- Write comments only when they add real value.
- Do not narrate obvious code.
- Document assumptions, edge cases, and operational constraints where useful.

---

## Git and Change Discipline

- Keep changes logically grouped.
- Make changes that would make sense in a reviewable pull request.
- Avoid unrelated cleanup unless it directly helps the task.
- If you notice something out of scope that matters, mention it separately instead of mixing it into the main work.

---

## Communication Style

- Be concise but concrete.
- Do not pad responses with generic praise or filler.
- State assumptions clearly.
- Flag uncertainty clearly.
- Distinguish between verified facts and reasonable inference.

---

## Definition of Done

A task is not done just because code was written.

A task is done when:
- the implementation is coherent
- the change fits the project architecture
- the relevant checks were run if available
- the result is summarized clearly
- and any remaining risks or follow-ups are stated explicitly

---

## Project-Specific Domain Guidance

This system may eventually support a large structured creative codex, including but not limited to:

- characters
- teams
- locations
- organizations
- story arcs
- events
- families
- power systems
- artifacts
- threat classifications

Because of that:

- Do not design the data layer as if everything is just an undifferentiated note.
- Preserve enough structure so notes can later connect to richer domain entities.
- Prefer models that can evolve into a codex, editorial dashboard, continuity tracker, and relationship engine.
- Build with future structure in mind, even when implementing generic note functionality.

---

## Explicit Anti-Patterns

Do not do the following:

- Do not treat Apple Notes as the database.
- Do not overwrite imported content with metadata edits.
- Do not flatten everything into opaque text blobs without structure.
- Do not skip deduplication logic.
- Do not hide parse failures.
- Do not fake working features with placeholder code and present them as complete.
- Do not introduce architecture that only works on one machine unless the constraint is explicitly intended.
- Do not make broad destructive changes without justification.
- Do not claim something was tested if it was not.

---

## Operational Priority Order

When making decisions, prioritize in this order:

1. correctness
2. data preservation
3. maintainability
4. repeatable imports
5. clarity
6. performance
7. convenience
8. cleverness

If forced to choose, cleverness loses first.