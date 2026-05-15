import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { resolveReviewItemAction } from "@/lib/notes/actions";
import { displayNoteTitle, formatDateTime } from "@/lib/notes/display";
import { getReviewItems } from "@/lib/notes/queries";

export default async function ReviewPage() {
  const items = await getReviewItems();

  return (
    <PageShell eyebrow="Review Queue" title="Duplicates, parse warnings, errors, and missing metadata" intro="Importer ambiguity stays visible so repeated imports stay controlled instead of quietly creating duplicate chaos.">
      <div className="space-y-4">
        {items.map((item) => (
          <section key={item.id} className="rounded border border-white/10 bg-white/[0.04] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded border border-white/10 px-2 py-1 text-xs uppercase tracking-[0.14em] text-stone-400">{label(item.type)}</span>
                  <span className="text-xs text-stone-500">{formatDateTime(item.createdAt)}</span>
                </div>
                <h2 className="mt-3 text-xl font-black text-white">{item.title}</h2>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-stone-300">{item.detail}</p>
                {item.sourcePath ? <p className="mt-2 text-xs text-stone-500">{item.sourcePath}</p> : null}
                <div className="mt-4 flex flex-wrap gap-3">
                  {item.note ? (
                    <Link href={`/notes/${item.note.id}`} className="text-sm font-bold text-[var(--signal)] hover:text-white">
                      Open {displayNoteTitle(item.note)}
                    </Link>
                  ) : null}
                  {item.candidateNote ? (
                    <Link href={`/notes/${item.candidateNote.id}`} className="text-sm font-bold text-[var(--gold)] hover:text-white">
                      Candidate {displayNoteTitle(item.candidateNote)}
                    </Link>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <form action={resolveReviewItemAction}>
                  <input type="hidden" name="reviewItemId" value={item.id} />
                  <input type="hidden" name="status" value="RESOLVED" />
                  <button className="h-10 rounded bg-[var(--ember)] px-4 text-sm font-bold text-white transition hover:bg-[#b73525]">Resolve</button>
                </form>
                <form action={resolveReviewItemAction}>
                  <input type="hidden" name="reviewItemId" value={item.id} />
                  <input type="hidden" name="status" value="DISMISSED" />
                  <button className="h-10 rounded border border-white/10 px-4 text-sm font-bold text-stone-300 transition hover:bg-white/10">Dismiss</button>
                </form>
              </div>
            </div>
          </section>
        ))}
      </div>
      {items.length === 0 ? <p className="text-stone-400">The review queue is clear.</p> : null}
    </PageShell>
  );
}

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}
