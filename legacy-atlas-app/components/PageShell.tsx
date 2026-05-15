import type { ReactNode } from "react";

export function PageShell({
  eyebrow,
  title,
  children,
  intro
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen">
      <section className="noise border-b border-white/10 bg-[#0d0d0d]">
        <div className="mx-auto max-w-7xl px-4 py-16 md:py-24">
          <p className="text-sm font-bold uppercase tracking-[0.28em] text-[var(--signal)]">{eyebrow}</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight text-white md:text-6xl">{title}</h1>
          {intro ? <p className="mt-5 max-w-3xl text-lg leading-8 text-stone-300">{intro}</p> : null}
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-4 py-12">{children}</div>
    </main>
  );
}
