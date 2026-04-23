import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { getCategoriesPage } from "@/lib/notes/queries";

export default async function CategoriesPage() {
  const categories = await getCategoriesPage();

  return (
    <PageShell eyebrow="Categories" title="Category index" intro="Categories can come from frontmatter, folders, or manual metadata added in the app.">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Link key={category.id} href={`/notes?category=${category.slug}`} className="rounded border border-white/10 bg-white/[0.04] p-5 transition hover:border-[var(--signal)]/60">
            <h2 className="text-xl font-black text-white">{category.name}</h2>
            <p className="mt-2 text-sm text-stone-400">{category._count.notes} notes</p>
            {category.description ? <p className="mt-3 text-sm leading-6 text-stone-300">{category.description}</p> : null}
          </Link>
        ))}
      </div>
      {categories.length === 0 ? <p className="text-stone-400">No categories imported yet.</p> : null}
    </PageShell>
  );
}
