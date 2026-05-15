import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { TagLink } from "@/components/TagLink";
import { getFaction } from "@/lib/queries";

export default async function FactionDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const faction = await getFaction(slug);
  if (!faction) notFound();

  return (
    <PageShell eyebrow={faction.ideology} title={faction.name} intro={faction.description}>
      {faction.emblemUrl ? <img src={faction.emblemUrl} alt="" className="mb-8 h-72 w-full rounded border border-white/10 object-cover" /> : null}
      <div className="grid gap-8 lg:grid-cols-3">
        <section className="rounded border border-white/10 bg-white/[0.06] p-6">
          <h2 className="text-2xl font-black text-white">Members</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {faction.members.map(({ character, role, status }) => (
              <TagLink key={character.id} href={`/characters/${character.slug}`}>{character.alias}: {role} / {status}</TagLink>
            ))}
          </div>
        </section>
        <section className="rounded border border-white/10 bg-white/[0.06] p-6">
          <h2 className="text-2xl font-black text-white">Locations</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {faction.locations.map(({ city, role }) => <TagLink key={city.id} href={`/cities/${city.slug}`}>{city.name}: {role}</TagLink>)}
          </div>
        </section>
        <section className="rounded border border-white/10 bg-white/[0.06] p-6">
          <h2 className="text-2xl font-black text-white">Story Arcs</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {faction.arcs.map(({ storyArc, role }) => <TagLink key={storyArc.id} href={`/story-arcs/${storyArc.slug}`}>{storyArc.title}: {role}</TagLink>)}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
