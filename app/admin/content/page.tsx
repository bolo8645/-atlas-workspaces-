import Link from "next/link";
import { NoteNavigationAssignmentControl } from "@/components/NoteNavigationAssignmentControl";
import { NavigationNodeSelect } from "@/components/NavigationNodeSelect";
import { PageShell } from "@/components/PageShell";
import { getContentManagerNotes } from "@/lib/content-queries";
import { getNavigationNodeOptions } from "@/lib/navigation-queries";
import { bulkUpdateNoteNavigationAssignmentAction } from "@/lib/notes/actions";
import { displayNoteTitle, formatDate } from "@/lib/notes/display";

const BULK_FORM_ID = "bulk-note-assignment";

export default async function AdminContentPage() {
  const [notes, navigationNodes] = await Promise.all([getContentManagerNotes(), getNavigationNodeOptions()]);
  const assignedCount = notes.filter((note) => note.navigationNodeId).length;
  const navigationPathById = new Map(navigationNodes.map((node) => [node.id, node.fullPath]));

  return (
    <PageShell eyebrow="Admin" title="Content Manager" intro="Assign imported notes to one navigation node without changing preserved source content.">
      <section className="rounded border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-white">Bulk Assignment</h2>
            <p className="mt-2 text-sm text-stone-400">
              {notes.length} notes total. {assignedCount} assigned, {notes.length - assignedCount} unassigned.
            </p>
          </div>
          <form id={BULK_FORM_ID} action={bulkUpdateNoteNavigationAssignmentAction} className="grid gap-3 md:grid-cols-[18rem_auto]">
            <NavigationNodeSelect options={navigationNodes} emptyLabel="Remove assignment" allowCreate />
            <button className="h-10 rounded bg-[var(--ember)] px-4 text-sm font-bold text-white transition hover:bg-[#b73525]">Assign Selected</button>
          </form>
        </div>
      </section>

      <section className="mt-6 rounded border border-white/10 bg-white/[0.04]">
        <div className="grid grid-cols-[2.5rem_1fr] gap-3 border-b border-white/10 bg-black/30 p-3 text-xs uppercase tracking-[0.14em] text-stone-500 lg:grid-cols-[2.5rem_minmax(18rem,1fr)_16rem_24rem]">
          <span>Select</span>
          <span>Note</span>
          <span className="hidden lg:block">Current Node</span>
          <span className="hidden lg:block">Quick Edit</span>
        </div>

        <div className="divide-y divide-white/10">
          {notes.map((note) => {
            const assignmentLabel = note.navigationNodeId ? navigationPathById.get(note.navigationNodeId) ?? note.navigationNode?.title ?? "Unknown node" : "Unassigned";

            return (
              <article key={note.id} className="grid grid-cols-[2.5rem_1fr] gap-3 p-3 lg:grid-cols-[2.5rem_minmax(18rem,1fr)_16rem_24rem] lg:items-center">
                <div className="pt-1 lg:pt-0">
                  <input form={BULK_FORM_ID} name="noteIds" value={note.id} type="checkbox" className="h-4 w-4" aria-label={`Select ${displayNoteTitle(note)}`} />
                </div>

                <div className="min-w-0">
                  <Link href={`/notes/${note.id}`} className="font-black text-white transition hover:text-[var(--signal)]">
                    {displayNoteTitle(note)}
                  </Link>
                  <p className="mt-1 truncate text-xs text-stone-500">{note.sourcePath}</p>
                  <p className="mt-1 text-xs text-stone-500">
                    Updated {formatDate(note.updatedAt)} / {note._count.attachments} attachments / {note._count.parseWarnings} warnings
                  </p>
                </div>

                <div className="text-sm text-stone-300 lg:block">
                  {note.navigationNode ? (
                    <div>
                      <p className="font-bold text-white">{note.navigationNode.title}</p>
                      <p className="text-xs text-stone-500">{assignmentLabel}</p>
                    </div>
                  ) : (
                    <span className="text-stone-500">Unassigned</span>
                  )}
                </div>

                <NoteNavigationAssignmentControl noteId={note.id} options={navigationNodes} defaultValue={note.navigationNodeId ?? ""} defaultLabel={assignmentLabel} />
              </article>
            );
          })}
        </div>

        {notes.length === 0 ? <p className="p-6 text-stone-400">No notes have been imported yet.</p> : null}
      </section>
    </PageShell>
  );
}
