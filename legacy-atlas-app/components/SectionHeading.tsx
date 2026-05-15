export function SectionHeading({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return (
    <div className="mb-8">
      <p className="text-sm font-bold uppercase tracking-[0.24em] text-[var(--signal)]">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-black text-white md:text-4xl">{title}</h2>
      {intro ? <p className="mt-3 max-w-3xl leading-7 text-stone-300">{intro}</p> : null}
    </div>
  );
}
