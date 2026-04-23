import { EntityKind, NoteStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { NoteNavigationAssignmentControl } from "@/components/NoteNavigationAssignmentControl";
import { PageShell } from "@/components/PageShell";
import { getNavigationNodeOptions } from "@/lib/navigation-queries";
import { getNavigationAssignmentSuggestions } from "@/lib/navigation-suggestions";
import { createManualRelationshipAction, updateNoteMetadataAction, updateNoteNavigationAssignmentAction } from "@/lib/notes/actions";
import { displayNoteTitle, formatDateTime } from "@/lib/notes/display";
import { getNoteDetail, getRelationshipTargets } from "@/lib/notes/queries";

type NoteDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NoteDetailPage({ params, searchParams }: NoteDetailPageProps) {
  const { id } = await params;
  const queryParams = await searchParams;
  const note = await getNoteDetail(id);
  if (!note) notFound();

  const [relationshipTargets, navigationNodes] = await Promise.all([getRelationshipTargets(note.id), getNavigationNodeOptions()]);
  const title = displayNoteTitle(note);
  const navigationPathById = new Map(navigationNodes.map((node) => [node.id, node.fullPath]));
  const requestedNodeId = readParam(queryParams, "node");
  const createParentId = requestedNodeId && navigationPathById.has(requestedNodeId) ? requestedNodeId : note.navigationNodeId;
  const assignmentLabel = note.navigationNodeId ? navigationPathById.get(note.navigationNodeId) ?? note.navigationNode?.title ?? "Unknown node" : "Unassigned";
  const navigationSuggestions = getNavigationAssignmentSuggestions(note, navigationNodes);
  const manualTags = note.tags.filter((item) => item.source === "MANUAL").map((item) => item.tag.name);
  const manualCategories = note.categories.filter((item) => item.source === "MANUAL").map((item) => item.category.name);
  const relatedNotes = [
    ...note.relatedFrom.map((relationship) => ({ note: relationship.toNote, relationship })),
    ...note.relatedTo.map((relationship) => ({ note: relationship.fromNote, relationship }))
  ];

  return (
    <PageShell eyebrow={note.sourcePath} title={title} intro={note.excerpt || "Imported source note with editable database metadata."}>
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <section className="rounded border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-black text-white">Clean View</h2>
              <span className="rounded border border-white/10 px-2 py-1 text-xs uppercase tracking-[0.14em] text-stone-400">{note.sourceExtension}</span>
            </div>
            <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-stone-200">{note.plainTextContent || "No readable text extracted."}</div>
          </section>

          <section className="rounded border border-white/10 bg-black/30 p-5">
            <h2 className="text-2xl font-black text-white">Original Imported Source</h2>
            <pre className="mt-4 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded border border-white/10 bg-black/50 p-4 text-xs leading-6 text-stone-300">{note.importedContent}</pre>
          </section>

          <section className="rounded border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-2xl font-black text-white">Related Notes</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {relatedNotes.map(({ note: related, relationship }) => (
                <a key={`${relationship.id}-${related.id}`} href={`/notes/${related.id}`} className="rounded border border-white/10 bg-black/25 p-4 transition hover:border-[var(--signal)]/60">
                  <p className="text-xs uppercase tracking-[0.16em] text-stone-500">{relationship.relationType}</p>
                  <h3 className="mt-2 font-black text-white">{displayNoteTitle(related)}</h3>
                  <p className="mt-2 text-sm text-stone-400">{relationship.reason || `${relationship.source.toLowerCase()} relationship`}</p>
                </a>
              ))}
              {relatedNotes.length === 0 ? <p className="text-stone-400">No relationships yet.</p> : null}
            </div>

            <form action={createManualRelationshipAction} className="mt-5 grid gap-3 rounded border border-white/10 bg-black/25 p-4 md:grid-cols-[1fr_1fr_auto]">
              <input type="hidden" name="noteId" value={note.id} />
              <select name="targetNoteId" className="h-11 rounded border border-white/[0.12] bg-black/30 px-3 text-sm outline-none focus:border-[var(--signal)]" required>
                <option value="">Choose note</option>
                {relationshipTargets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {displayNoteTitle(target)}
                  </option>
                ))}
              </select>
              <input name="relationType" placeholder="Relation type" className="h-11 rounded border border-white/[0.12] bg-black/30 px-3 text-sm outline-none focus:border-[var(--signal)]" />
              <button className="h-11 rounded bg-[var(--ember)] px-4 text-sm font-bold text-white transition hover:bg-[#b73525]">Link</button>
              <input name="reason" placeholder="Reason or note" className="h-11 rounded border border-white/[0.12] bg-black/30 px-3 text-sm outline-none focus:border-[var(--signal)] md:col-span-3" />
            </form>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-xl font-black text-white">Navigation Assignment</h2>
            <p className="mt-2 text-sm text-stone-400">Choose an existing node or type a new node name to create and assign it immediately.</p>
            <NoteNavigationAssignmentControl className="mt-4" noteId={note.id} options={navigationNodes} defaultValue={note.navigationNodeId ?? ""} defaultLabel={assignmentLabel} createParentId={createParentId} />
            {navigationSuggestions.length > 0 ? (
              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Suggestions</p>
                <div className="mt-2 space-y-2">
                  {navigationSuggestions.map((suggestion) => (
                    <form key={suggestion.navigationNodeId} action={updateNoteNavigationAssignmentAction} className="rounded border border-white/10 bg-black/25 p-3">
                      <input type="hidden" name="noteId" value={note.id} />
                      <input type="hidden" name="navigationNodeId" value={suggestion.navigationNodeId} />
                      <p className="font-bold text-white">{suggestion.navigationNodeTitle}</p>
                      <p className="mt-1 text-xs text-stone-500">{suggestion.fullPath}</p>
                      <p className="mt-2 text-sm text-stone-400">{suggestion.reason}</p>
                      <p className="mt-1 text-xs text-[var(--signal)]">{suggestion.evidence}</p>
                      <button className="mt-3 h-9 rounded border border-white/10 px-3 text-sm font-bold text-stone-300 transition hover:bg-white/10 hover:text-white">Confirm Assignment</button>
                    </form>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-xl font-black text-white">Metadata</h2>
            <form action={updateNoteMetadataAction} className="mt-4 space-y-3">
              <input type="hidden" name="noteId" value={note.id} />
              <Field label="Display title">
                <input name="displayTitle" defaultValue={note.metadataOverride?.displayTitle || ""} className="h-10 w-full rounded border border-white/[0.12] bg-black/30 px-3 text-sm outline-none focus:border-[var(--signal)]" />
              </Field>
              <Field label="Status">
                <select name="status" defaultValue={note.metadataOverride?.status || note.status} className="h-10 w-full rounded border border-white/[0.12] bg-black/30 px-3 text-sm outline-none focus:border-[var(--signal)]">
                  {Object.values(NoteStatus).map((status) => (
                    <option key={status} value={status}>
                      {label(status)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Priority">
                <input name="priority" type="number" min="0" max="10" defaultValue={note.metadataOverride?.priority ?? note.priority ?? ""} className="h-10 w-full rounded border border-white/[0.12] bg-black/30 px-3 text-sm outline-none focus:border-[var(--signal)]" />
              </Field>
              <Field label="Entity type">
                <select name="entityType" defaultValue={note.metadataOverride?.entityType || note.entityType || ""} className="h-10 w-full rounded border border-white/[0.12] bg-black/30 px-3 text-sm outline-none focus:border-[var(--signal)]">
                  <option value="">None</option>
                  {Object.values(EntityKind).map((kind) => (
                    <option key={kind} value={kind}>
                      {label(kind)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Manual tags">
                <input name="tags" defaultValue={manualTags.join(", ")} placeholder="comma, separated" className="h-10 w-full rounded border border-white/[0.12] bg-black/30 px-3 text-sm outline-none focus:border-[var(--signal)]" />
              </Field>
              <Field label="Manual categories">
                <input name="categories" defaultValue={manualCategories.join(", ")} placeholder="comma, separated" className="h-10 w-full rounded border border-white/[0.12] bg-black/30 px-3 text-sm outline-none focus:border-[var(--signal)]" />
              </Field>
              <Field label="Curated summary">
                <textarea name="summary" defaultValue={note.metadataOverride?.summary || note.curatedSummary || ""} rows={4} className="w-full rounded border border-white/[0.12] bg-black/30 px-3 py-2 text-sm outline-none focus:border-[var(--signal)]" />
              </Field>
              <Field label="Notes about note">
                <textarea name="notes" defaultValue={note.metadataOverride?.notes || note.metadataNotes || ""} rows={4} className="w-full rounded border border-white/[0.12] bg-black/30 px-3 py-2 text-sm outline-none focus:border-[var(--signal)]" />
              </Field>
              <button className="h-11 w-full rounded bg-[var(--ember)] px-4 text-sm font-bold text-white transition hover:bg-[#b73525]">Save Metadata</button>
            </form>
          </section>

          <InfoPanel title="Imported Metadata">
            <Meta label="Source path" value={note.sourcePath} />
            <Meta label="Checksum" value={note.sourceChecksum.slice(0, 16)} />
            <Meta label="Imported" value={formatDateTime(note.importedAt)} />
            <Meta label="Last seen" value={formatDateTime(note.lastSeenAt)} />
            <Meta label="Source updated" value={formatDateTime(note.updatedDate)} />
            <Meta label="Parse quality" value={`${note.parseQuality}%`} />
          </InfoPanel>

          <InfoPanel title="Tags & Categories">
            <div className="flex flex-wrap gap-2">
              {note.tags.map(({ tag, source }) => (
                <span key={tag.id} className="rounded bg-[var(--signal)]/10 px-2 py-1 text-xs text-[var(--signal)]">
                  #{tag.name} <span className="text-stone-500">{source.toLowerCase()}</span>
                </span>
              ))}
              {note.categories.map(({ category, source }) => (
                <span key={category.id} className="rounded bg-[var(--gold)]/10 px-2 py-1 text-xs text-[var(--gold)]">
                  {category.name} <span className="text-stone-500">{source.toLowerCase()}</span>
                </span>
              ))}
            </div>
          </InfoPanel>

          <InfoPanel title="Entities">
            <div className="space-y-2">
              {note.entities.map(({ entity, confidence, evidence }) => (
                <div key={entity.id} className="rounded border border-white/10 bg-black/25 p-3">
                  <p className="font-bold text-white">{entity.name}</p>
                  <p className="text-xs uppercase tracking-[0.14em] text-stone-500">
                    {label(entity.kind)} / {(confidence * 100).toFixed(0)}%
                  </p>
                  {evidence ? <p className="mt-1 text-xs text-stone-400">{evidence}</p> : null}
                </div>
              ))}
              {note.entities.length === 0 ? <p className="text-sm text-stone-400">No entities inferred yet.</p> : null}
            </div>
          </InfoPanel>

          <InfoPanel title="Attachments">
            <div className="space-y-2">
              {note.attachments.map((attachment) => (
                <div key={attachment.id} className="rounded border border-white/10 bg-black/25 p-3">
                  <p className="font-bold text-white">{attachment.fileName}</p>
                  <p className="text-xs text-stone-400">{attachment.resolvedPath || attachment.sourcePath}</p>
                </div>
              ))}
              {note.attachments.length === 0 ? <p className="text-sm text-stone-400">No attachments found.</p> : null}
            </div>
          </InfoPanel>

          <InfoPanel title="Links">
            <div className="space-y-2">
              {note.links.map((link) => (
                <div key={link.id} className="rounded border border-white/10 bg-black/25 p-3">
                  <p className="break-words text-sm text-white">{link.label || link.url}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-stone-500">{label(link.kind)}</p>
                </div>
              ))}
              {note.links.length === 0 ? <p className="text-sm text-stone-400">No outbound links found.</p> : null}
            </div>
          </InfoPanel>

          <InfoPanel title="Warnings & Imports">
            <div className="space-y-3">
              {note.parseWarnings.map((warning) => (
                <div key={warning.id} className="rounded border border-white/10 bg-black/25 p-3">
                  <p className="font-bold text-white">{warning.code}</p>
                  <p className="text-sm text-stone-400">{warning.message}</p>
                </div>
              ))}
              {note.importEvents.map((event) => (
                <div key={event.id} className="rounded border border-white/10 bg-black/25 p-3">
                  <p className="text-sm font-bold text-white">{label(event.status)}</p>
                  <p className="text-xs text-stone-400">{formatDateTime(event.createdAt)}</p>
                </div>
              ))}
            </div>
          </InfoPanel>
        </aside>
      </div>
    </PageShell>
  );
}

function Field({ label: fieldLabel, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-stone-500">{fieldLabel}</span>
      {children}
    </label>
  );
}

function InfoPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded border border-white/10 bg-white/[0.04] p-5">
      <h2 className="mb-4 text-xl font-black text-white">{title}</h2>
      {children}
    </section>
  );
}

function Meta({ label: metaLabel, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-white/10 py-2 last:border-b-0">
      <p className="text-xs uppercase tracking-[0.16em] text-stone-500">{metaLabel}</p>
      <p className="mt-1 break-words text-sm text-stone-200">{value}</p>
    </div>
  );
}

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

function readParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  if (Array.isArray(value)) return value[0];
  return value;
}
