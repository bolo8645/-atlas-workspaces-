import { EntityCard } from "@/components/EntityCard";
import { PageShell } from "@/components/PageShell";
import { getCities } from "@/lib/queries";

export default async function CitiesPage() {
  const cities = await getCities();

  return (
    <PageShell eyebrow="Cities" title="Where the sky remade civilization" intro="Cities anchor character origins, faction territory, and timeline events across the ASCU database.">
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {cities.map((city) => (
          <EntityCard key={city.id} href={`/cities/${city.slug}`} title={city.name} eyebrow={city.region} description={city.description} imageUrl={city.imageUrl}>
            <p className="text-sm text-stone-400">{city.characters.length} characters / {city.factions.length} factions</p>
          </EntityCard>
        ))}
      </div>
    </PageShell>
  );
}
