import { EntityCard } from "@/components/EntityCard";
import { PageShell } from "@/components/PageShell";
import { getPowerSystems } from "@/lib/queries";

export default async function PowerSystemsPage() {
  const powers = await getPowerSystems();

  return (
    <PageShell eyebrow="Power Systems" title="Rules for the impossible" intro="Power records define origin, limitations, and the characters who bend or break each system.">
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {powers.map((power) => (
          <EntityCard key={power.id} href={`/power-systems/${power.slug}`} title={power.name} eyebrow={power.source} description={power.description}>
            <p className="text-sm text-stone-400">{power.characters.length} known users</p>
          </EntityCard>
        ))}
      </div>
    </PageShell>
  );
}
