import { PageShell } from "@/components/PageShell";
import { getNews } from "@/lib/queries";

export default async function NewsPage() {
  const posts = await getNews();

  return (
    <PageShell eyebrow="News / Updates" title="Archive transmissions" intro="Public updates for new arcs, reading order changes, continuity notes, and database releases.">
      <div className="grid gap-5 md:grid-cols-2">
        {posts.map((post) => (
          <article key={post.id} className="rounded border border-white/10 bg-white/[0.06] p-6">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--signal)]">
              {post.publishedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
            <h2 className="mt-3 text-3xl font-black text-white">{post.title}</h2>
            <p className="mt-3 text-lg leading-7 text-stone-300">{post.excerpt}</p>
            <p className="mt-5 leading-8 text-stone-300">{post.body}</p>
          </article>
        ))}
      </div>
    </PageShell>
  );
}
