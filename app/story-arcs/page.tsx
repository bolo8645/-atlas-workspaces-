import { EntityCard } from "@/components/EntityCard";
import { PageShell } from "@/components/PageShell";
import { getStoryArcs } from "@/lib/queries";

export default async function StoryArcsPage() {
  const arcs = await getStoryArcs();

  return (
    <PageShell eyebrow="Story Arcs" title="Canon in sequence" intro="Story arcs connect characters, factions, and dated timeline events so reading order and universe history stay aligned.">
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {arcs.map((arc) => (
          <EntityCard key={arc.id} href={`/story-arcs/${arc.slug}`} title={arc.title} eyebrow={arc.issueRange} description={arc.summary} imageUrl={arc.coverUrl}>
            <p className="text-sm text-stone-400">{arc.characters.length} characters / {arc.events.length} events</p>
          </EntityCard>
        ))}
      </div>
    </PageShell>
  );
}
