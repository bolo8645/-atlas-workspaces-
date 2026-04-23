import { PageShell } from "@/components/PageShell";
import { runImportAction } from "@/lib/notes/actions";
import { formatDateTime } from "@/lib/notes/display";
import { getImportHistory } from "@/lib/notes/queries";

export default async function ImportsPage() {
  const runs = await getImportHistory();

  return (
    <PageShell eyebrow="Import History" title="Every import run is logged" intro="Repeated imports are expected. Each run records discovered files, upserts, skips, warnings, errors, duplicate reviews, and duration.">
      <form action={runImportAction} className="mb-6 rounded border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black text-white">Run importer</h2>
            <p className="mt-1 text-sm text-stone-400">Uses `IMPORT_NOTES_DIR` and keeps going when an individual file fails.</p>
          </div>
          <button className="h-11 rounded bg-[var(--ember)] px-5 text-sm font-bold text-white transition hover:bg-[#b73525]">Run Import Now</button>
        </div>
      </form>

      <div className="overflow-hidden rounded border border-white/10 bg-white/[0.04]">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-white/10 bg-black/30 text-xs uppercase tracking-[0.14em] text-stone-500">
            <tr>
              <th className="p-3">Started</th>
              <th className="p-3">Status</th>
              <th className="p-3">Files</th>
              <th className="p-3">Imported</th>
              <th className="p-3">Updated</th>
              <th className="p-3">Skipped</th>
              <th className="p-3">Errors</th>
              <th className="p-3">Warnings</th>
              <th className="p-3">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {runs.map((run) => (
              <tr key={run.id} className="align-top">
                <td className="p-3 text-white">{formatDateTime(run.startedAt)}</td>
                <td className="p-3 text-stone-300">{run.status}</td>
                <td className="p-3 text-stone-300">{run.filesDiscovered}</td>
                <td className="p-3 text-stone-300">{run.importedCount}</td>
                <td className="p-3 text-stone-300">{run.updatedCount}</td>
                <td className="p-3 text-stone-300">{run.skippedCount}</td>
                <td className="p-3 text-stone-300">{run.erroredCount}</td>
                <td className="p-3 text-stone-300">{run.warningCount}</td>
                <td className="p-3 text-stone-300">{run.durationMs ? `${run.durationMs}ms` : "Open"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {runs.length === 0 ? <p className="p-6 text-stone-400">No import runs yet.</p> : null}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {runs
          .filter((run) => run._count.errors > 0 || run._count.parseWarnings > 0 || run._count.reviewItems > 0)
          .map((run) => (
            <section key={run.id} className="rounded border border-white/10 bg-white/[0.04] p-5">
              <h2 className="font-black text-white">{formatDateTime(run.startedAt)}</h2>
              <p className="mt-1 text-sm text-stone-400">{run.summary || run.status}</p>
              <p className="mt-3 text-sm text-stone-300">
                {run._count.errors} errors / {run._count.parseWarnings} warnings / {run._count.reviewItems} review items
              </p>
              <div className="mt-4 space-y-2">
                {run.errors.map((error) => (
                  <div key={error.id} className="rounded border border-white/10 bg-black/25 p-3">
                    <p className="text-sm font-bold text-white">{error.sourcePath}</p>
                    <p className="mt-1 text-sm text-stone-400">{error.message}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
      </div>
    </PageShell>
  );
}
