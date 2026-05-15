import { EntityCard } from "@/components/EntityCard";
import { PageShell } from "@/components/PageShell";
import { getFactions } from "@/lib/queries";

export default async function FactionsPage() {
  const factions = await getFactions();

  return (
    <PageShell eyebrow="Factions" title="Every alliance has a weather system" intro="Faction records connect members, operating locations, ideology, and the story arcs where their pressure becomes history.">
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {factions.map((faction) => (
          <EntityCard key={faction.id} href={`/factions/${faction.slug}`} title={faction.name} eyebrow={faction.ideology} description={faction.description} imageUrl={faction.emblemUrl}>
            <p className="text-sm text-stone-400">{faction.members.length} members / {faction.locations.length} locations</p>
          </EntityCard>
        ))}
      </div>
    </PageShell>
  );
}
