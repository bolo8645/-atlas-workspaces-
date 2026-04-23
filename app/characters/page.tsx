import { EntityCard } from "@/components/EntityCard";
import { FilterBar } from "@/components/FilterBar";
import { PageShell } from "@/components/PageShell";
import { getCharacters, getFilterOptions } from "@/lib/queries";

type CharacterSearchParams = Promise<{
  q?: string;
  city?: string;
  faction?: string;
  power?: string;
}>;

export default async function CharactersPage({ searchParams }: { searchParams: CharacterSearchParams }) {
  const params = await searchParams;
  const [characters, filters] = await Promise.all([
    getCharacters({ query: params.q, city: params.city, faction: params.faction, power: params.power }),
    getFilterOptions()
  ]);

  return (
    <PageShell eyebrow="Character Database" title="Every altered life leaves a trail" intro="Search by name, alias, faction, city, or power origin. Character records link into powers, alliances, story arcs, and related characters.">
      <FilterBar query={params.q} city={params.city} faction={params.faction} power={params.power} cities={filters.cities} factions={filters.factions} powers={filters.powers} />
      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {characters.map((character) => (
          <EntityCard key={character.id} href={`/characters/${character.slug}`} title={character.alias} eyebrow={character.name} description={character.description} imageUrl={character.portraitUrl}>
            <div className="flex flex-wrap gap-2">
              {character.powers.map(({ power }) => (
                <span key={power.id} className="rounded bg-black/35 px-2 py-1 text-xs text-stone-300">
                  {power.name}
                </span>
              ))}
            </div>
          </EntityCard>
        ))}
      </div>
      {characters.length === 0 ? <p className="mt-8 rounded border border-white/10 bg-white/[0.06] p-5 text-stone-300">No character records match that search.</p> : null}
    </PageShell>
  );
}
