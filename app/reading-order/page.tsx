import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { getStoryArcs } from "@/lib/queries";

export default async function ReadingOrderPage() {
  const arcs = await getStoryArcs();

  return (
    <PageShell eyebrow="Reading Order" title="Start where the thunder first answers" intro="The recommended path prioritizes story reveal order while keeping faction and timeline context close at hand.">
      <div className="space-y-5">
        {arcs.map((arc, index) => (
          <article key={arc.id} className="grid gap-5 rounded border border-white/10 bg-white/[0.06] p-5 md:grid-cols-[6rem_1fr]">
            <div className="grid h-24 w-24 place-items-center rounded border border-[var(--ember)]/50 bg-[var(--ember)]/10 text-4xl font-black text-[var(--gold)]">
              {index + 1}
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--signal)]">{arc.issueRange}</p>
              <Link href={`/story-arcs/${arc.slug}`} className="mt-2 inline-block text-3xl font-black text-white hover:text-[var(--gold)]">
                {arc.title}
              </Link>
              <p className="mt-3 max-w-3xl leading-7 text-stone-300">{arc.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-sm text-stone-400">
                <span>{arc.characters.length} key characters</span>
                <span>/</span>
                <span>{arc.factions.length} factions</span>
                <span>/</span>
                <span>{arc.events.length} timeline events</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </PageShell>
  );
}
