import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { TagLink } from "@/components/TagLink";
import { getCity } from "@/lib/queries";
import { formatAscuDate } from "@/lib/utils";

export default async function CityDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const city = await getCity(slug);
  if (!city) notFound();

  return (
    <PageShell eyebrow={city.region} title={city.name} intro={city.description}>
      {city.imageUrl ? <img src={city.imageUrl} alt="" className="mb-8 h-80 w-full rounded border border-white/10 object-cover" /> : null}
      <div className="grid gap-8 lg:grid-cols-3">
        <section className="rounded border border-white/10 bg-white/[0.06] p-6">
          <h2 className="text-2xl font-black text-white">Characters</h2>
          <div className="mt-4 flex flex-wrap gap-3">{city.characters.map((character) => <TagLink key={character.id} href={`/characters/${character.slug}`}>{character.alias}</TagLink>)}</div>
        </section>
        <section className="rounded border border-white/10 bg-white/[0.06] p-6">
          <h2 className="text-2xl font-black text-white">Faction Presence</h2>
          <div className="mt-4 space-y-3">{city.factions.map(({ faction, role }) => <TagLink key={faction.id} href={`/factions/${faction.slug}`}>{faction.name}: {role}</TagLink>)}</div>
        </section>
        <section className="rounded border border-white/10 bg-white/[0.06] p-6">
          <h2 className="text-2xl font-black text-white">Timeline Events</h2>
          <div className="mt-4 space-y-3">{city.events.map((event) => <p key={event.id} className="text-sm leading-6 text-stone-300"><span className="text-[var(--gold)]">{formatAscuDate(event.year, event.month)}</span> {event.title}</p>)}</div>
        </section>
      </div>
    </PageShell>
  );
}
