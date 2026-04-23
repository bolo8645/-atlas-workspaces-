"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type SearchItem = {
  href: string;
  label: string;
  eyebrow: string;
};

export function SearchBox({ items = [] }: { items?: SearchItem[] }) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (value.length < 2) return [];
    return items
      .filter((item) => `${item.label} ${item.eyebrow}`.toLowerCase().includes(value))
      .slice(0, 8);
  }, [items, query]);

  return (
    <form action="/notes" className="relative w-full lg:w-72">
      <label className="sr-only" htmlFor="site-search">
        Search notes
      </label>
      <input
        id="site-search"
        name="q"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search notes"
        className="h-10 w-full rounded border border-white/[0.15] bg-white/[0.08] px-3 text-sm text-white outline-none transition placeholder:text-stone-500 focus:border-[var(--signal)] focus:bg-white/[0.12]"
      />
      {results.length > 0 && (
        <div className="absolute right-0 top-12 z-50 w-full overflow-hidden rounded border border-white/[0.15] bg-[#111] shadow-2xl">
          {results.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setQuery("")}
              className="block border-b border-white/[0.08] px-3 py-3 transition last:border-b-0 hover:bg-white/10"
            >
              <span className="block text-xs uppercase tracking-[0.18em] text-[var(--signal)]">{item.eyebrow}</span>
              <span className="block font-semibold text-white">{item.label}</span>
            </Link>
          ))}
        </div>
      )}
    </form>
  );
}
