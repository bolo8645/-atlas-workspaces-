import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { getTagsPage } from "@/lib/notes/queries";

export default async function TagsPage() {
  const tags = await getTagsPage();

  return (
    <PageShell eyebrow="Tags" title="Tag index" intro="Imported and manual tags become first-class query dimensions instead of hidden text fragments.">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {tags.map((tag) => (
          <Link key={tag.id} href={`/notes?tag=${tag.slug}`} className="rounded border border-white/10 bg-white/[0.04] p-5 transition hover:border-[var(--signal)]/60">
            <h2 className="text-xl font-black text-white">#{tag.name}</h2>
            <p className="mt-2 text-sm text-stone-400">{tag._count.notes} notes</p>
            {tag.description ? <p className="mt-3 text-sm leading-6 text-stone-300">{tag.description}</p> : null}
          </Link>
        ))}
      </div>
      {tags.length === 0 ? <p className="text-stone-400">No tags imported yet.</p> : null}
    </PageShell>
  );
}
