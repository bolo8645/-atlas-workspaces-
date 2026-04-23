import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { getTimeline } from "@/lib/queries";
import { formatAscuDate } from "@/lib/utils";

export default async function TimelinePage() {
  const events = await getTimeline();

  return (
    <PageShell eyebrow="Timeline" title="The order history admits to" intro="Timeline events connect story arcs and cities, giving the public site a browsable continuity backbone.">
      <div className="relative space-y-5 before:absolute before:left-4 before:top-0 before:h-full before:w-px before:bg-white/15 md:before:left-6">
        {events.map((event) => (
          <article key={event.id} className="relative ml-10 rounded border border-white/10 bg-white/[0.06] p-5 md:ml-16">
            <span className="absolute -left-[2.45rem] top-6 h-4 w-4 rounded-full border border-[var(--gold)] bg-[#070707] md:-left-[3.05rem]" />
            <p className="text-sm font-bold text-[var(--gold)]">{formatAscuDate(event.year, event.month)} / {event.scale}</p>
            <h2 className="mt-2 text-2xl font-black text-white">{event.title}</h2>
            <p className="mt-3 leading-7 text-stone-300">{event.description}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {event.storyArc ? <Link className="rounded border border-white/[0.12] px-3 py-1.5 text-sm hover:border-[var(--signal)]/60" href={`/story-arcs/${event.storyArc.slug}`}>{event.storyArc.title}</Link> : null}
              {event.city ? <Link className="rounded border border-white/[0.12] px-3 py-1.5 text-sm hover:border-[var(--signal)]/60" href={`/cities/${event.city.slug}`}>{event.city.name}</Link> : null}
            </div>
          </article>
        ))}
      </div>
    </PageShell>
  );
}
