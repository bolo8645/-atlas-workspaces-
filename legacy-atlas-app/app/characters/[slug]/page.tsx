import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { TagLink } from "@/components/TagLink";
import { getCharacter } from "@/lib/queries";

export default async function CharacterDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const character = await getCharacter(slug);
  if (!character) notFound();

  const related = [
    ...character.relationshipsFrom.map((relationship) => ({ character: relationship.to, relation: relationship.relation })),
    ...character.relationshipsTo.map((relationship) => ({ character: relationship.from, relation: relationship.relation }))
  ];

  return (
    <PageShell eyebrow={character.name} title={character.alias} intro={character.description}>
      <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          {character.portraitUrl ? <img src={character.portraitUrl} alt="" className="aspect-[4/5] w-full rounded border border-white/10 object-cover" /> : null}
          <div className="mt-5 rounded border border-white/10 bg-white/[0.06] p-5">
            <p className="text-sm uppercase tracking-[0.18em] text-stone-400">First Appearance</p>
            <p className="mt-2 text-xl font-black text-white">{character.firstAppearance}</p>
            <p className="mt-4 text-sm uppercase tracking-[0.18em] text-stone-400">Alignment</p>
            <p className="mt-2 text-xl font-black text-white">{character.alignment}</p>
          </div>
        </div>
        <div className="space-y-8">
          <section className="rounded border border-white/10 bg-white/[0.06] p-6">
            <h2 className="text-2xl font-black text-white">Biography</h2>
            <p className="mt-4 leading-8 text-stone-300">{character.biography}</p>
          </section>
          <section>
            <h2 className="text-2xl font-black text-white">Powers</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {character.powers.map(({ power, mastery, notes }) => (
                <div key={power.id} className="rounded border border-white/10 bg-white/[0.06] p-4">
                  <TagLink href={`/power-systems/${power.slug}`}>{power.name}</TagLink>
                  <p className="mt-3 text-sm text-[var(--gold)]">{mastery}</p>
                  {notes ? <p className="mt-2 text-sm leading-6 text-stone-300">{notes}</p> : null}
                </div>
              ))}
            </div>
          </section>
          <section>
            <h2 className="text-2xl font-black text-white">Affiliations</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {character.affiliations.map(({ faction, role, status }) => (
                <TagLink key={faction.id} href={`/factions/${faction.slug}`}>
                  {faction.name}: {role} / {status}
                </TagLink>
              ))}
              {character.homeCity ? <TagLink href={`/cities/${character.homeCity.slug}`}>Home: {character.homeCity.name}</TagLink> : null}
            </div>
          </section>
          <section>
            <h2 className="text-2xl font-black text-white">Story Arcs</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {character.storyArcs.map(({ storyArc, role }) => (
                <TagLink key={storyArc.id} href={`/story-arcs/${storyArc.slug}`}>
                  {storyArc.title}: {role}
                </TagLink>
              ))}
            </div>
          </section>
          <section>
            <h2 className="text-2xl font-black text-white">Related Characters</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {related.map(({ character: item, relation }) => (
                <TagLink key={`${item.id}-${relation}`} href={`/characters/${item.slug}`}>
                  {item.alias}: {relation}
                </TagLink>
              ))}
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
