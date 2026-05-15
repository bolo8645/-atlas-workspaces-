import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { TagLink } from "@/components/TagLink";
import { getPowerSystem } from "@/lib/queries";

export default async function PowerSystemDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const power = await getPowerSystem(slug);
  if (!power) notFound();

  return (
    <PageShell eyebrow={power.source} title={power.name} intro={power.description}>
      <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded border border-white/10 bg-white/[0.06] p-6">
          <h2 className="text-2xl font-black text-white">Limitations</h2>
          <p className="mt-4 leading-8 text-stone-300">{power.limitations}</p>
        </section>
        <section className="rounded border border-white/10 bg-white/[0.06] p-6">
          <h2 className="text-2xl font-black text-white">Known Users</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {power.characters.map(({ character, mastery, notes }) => (
              <div key={character.id} className="rounded border border-white/10 bg-black/25 p-4">
                <TagLink href={`/characters/${character.slug}`}>{character.alias}</TagLink>
                <p className="mt-3 text-sm text-[var(--gold)]">{mastery}</p>
                {notes ? <p className="mt-2 text-sm leading-6 text-stone-300">{notes}</p> : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
