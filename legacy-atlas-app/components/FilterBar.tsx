import Link from "next/link";

type Option = {
  slug: string;
  name: string;
};

export function FilterBar({
  query,
  city,
  faction,
  power,
  cities,
  factions,
  powers
}: {
  query?: string;
  city?: string;
  faction?: string;
  power?: string;
  cities: Option[];
  factions: Option[];
  powers: Option[];
}) {
  return (
    <form action="/characters" className="grid gap-3 rounded border border-white/10 bg-white/[0.06] p-4 md:grid-cols-4">
      <input name="q" defaultValue={query} placeholder="Name, alias, description" className="h-11 rounded border border-white/[0.12] bg-black/30 px-3 text-sm outline-none focus:border-[var(--signal)]" />
      <select name="city" defaultValue={city ?? ""} className="h-11 rounded border border-white/[0.12] bg-black/30 px-3 text-sm outline-none focus:border-[var(--signal)]">
        <option value="">All cities</option>
        {cities.map((item) => (
          <option key={item.slug} value={item.slug}>
            {item.name}
          </option>
        ))}
      </select>
      <select name="faction" defaultValue={faction ?? ""} className="h-11 rounded border border-white/[0.12] bg-black/30 px-3 text-sm outline-none focus:border-[var(--signal)]">
        <option value="">All factions</option>
        {factions.map((item) => (
          <option key={item.slug} value={item.slug}>
            {item.name}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <select name="power" defaultValue={power ?? ""} className="h-11 min-w-0 flex-1 rounded border border-white/[0.12] bg-black/30 px-3 text-sm outline-none focus:border-[var(--signal)]">
          <option value="">All powers</option>
          {powers.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
        <button className="h-11 rounded bg-[var(--ember)] px-4 text-sm font-bold text-white transition hover:bg-[#b73525]">Filter</button>
      </div>
      {(query || city || faction || power) && (
        <Link href="/characters" className="text-sm text-stone-400 transition hover:text-white md:col-span-4">
          Clear filters
        </Link>
      )}
    </form>
  );
}
