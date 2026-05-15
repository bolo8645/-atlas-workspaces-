import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { SectionHeading } from "@/components/SectionHeading";
import { getCities, getFactions, getPowerSystems, getStoryArcs, getUniverseStats } from "@/lib/queries";

export default async function UniversePage() {
  const [stats, cities, factions, powers, arcs] = await Promise.all([getUniverseStats(), getCities(), getFactions(), getPowerSystems(), getStoryArcs()]);

  return (
    <PageShell eyebrow="Universe Overview" title="A living atlas of altered civilization" intro="ASCU is structured around places, factions, power origins, story arcs, and dated events. Every entity links back into the same relational canon.">
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {Object.entries(stats).map(([label, value]) => (
          <div key={label} className="rounded border border-white/10 bg-white/[0.06] p-5">
            <p className="text-3xl font-black text-white">{value}</p>
            <p className="mt-1 text-sm uppercase tracking-[0.15em] text-stone-400">{label}</p>
          </div>
        ))}
      </div>
      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <section>
          <SectionHeading eyebrow="Cities" title="Storm-built homes" />
          <div className="space-y-3">{cities.map((city) => <Link key={city.id} href={`/cities/${city.slug}`} className="block rounded border border-white/10 bg-white/[0.06] p-4 hover:border-[var(--signal)]/60">{city.name}</Link>)}</div>
        </section>
        <section>
          <SectionHeading eyebrow="Factions" title="The people moving history" />
          <div className="space-y-3">{factions.map((faction) => <Link key={faction.id} href={`/factions/${faction.slug}`} className="block rounded border border-white/10 bg-white/[0.06] p-4 hover:border-[var(--signal)]/60">{faction.name}</Link>)}</div>
        </section>
        <section>
          <SectionHeading eyebrow="Power Systems" title="Rules of the impossible" />
          <div className="space-y-3">{powers.map((power) => <Link key={power.id} href={`/power-systems/${power.slug}`} className="block rounded border border-white/10 bg-white/[0.06] p-4 hover:border-[var(--signal)]/60">{power.name}</Link>)}</div>
        </section>
        <section>
          <SectionHeading eyebrow="Story Arcs" title="Canon sequences" />
          <div className="space-y-3">{arcs.map((arc) => <Link key={arc.id} href={`/story-arcs/${arc.slug}`} className="block rounded border border-white/10 bg-white/[0.06] p-4 hover:border-[var(--signal)]/60">{arc.title}</Link>)}</div>
        </section>
      </div>
    </PageShell>
  );
}
