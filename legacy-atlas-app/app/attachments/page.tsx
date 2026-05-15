import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { displayNoteTitle } from "@/lib/notes/display";
import { getAttachmentsPage } from "@/lib/notes/queries";

export default async function AttachmentsPage() {
  const attachments = await getAttachmentsPage();

  return (
    <PageShell eyebrow="Attachments" title="Attachment browser" intro="Local asset references are tracked as database records while files remain in the export folder for the MVP.">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {attachments.map((attachment) => (
          <Link key={attachment.id} href={`/notes/${attachment.noteId}`} className="rounded border border-white/10 bg-white/[0.04] p-5 transition hover:border-[var(--signal)]/60">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-stone-500">{attachment.kind}</p>
                <h2 className="mt-2 break-words text-xl font-black text-white">{attachment.fileName}</h2>
              </div>
              <span className="rounded bg-white/10 px-2 py-1 text-xs text-stone-300">{attachment.mimeType || "file"}</span>
            </div>
            <p className="mt-3 break-words text-sm text-stone-400">{attachment.resolvedPath || attachment.sourcePath}</p>
            <p className="mt-3 text-sm text-[var(--signal)]">{displayNoteTitle(attachment.note)}</p>
          </Link>
        ))}
      </div>
      {attachments.length === 0 ? <p className="text-stone-400">No attachments found yet.</p> : null}
    </PageShell>
  );
}
