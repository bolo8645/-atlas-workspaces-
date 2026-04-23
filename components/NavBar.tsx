import Link from "next/link";
import { navItems } from "@/lib/navigation";
import { SearchBox } from "@/components/SearchBox";

export function NavBar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/[0.82] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="group inline-flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded border border-[var(--ember)]/70 bg-[var(--ember)]/15 text-sm font-black text-[var(--gold)]">
              NC
            </span>
            <span>
              <span className="block text-sm font-black uppercase tracking-[0.24em] text-white">Notes Codex</span>
              <span className="block text-xs uppercase tracking-[0.22em] text-stone-400">Export Database</span>
            </span>
          </Link>
        </div>
        <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-300">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="rounded px-3 py-2 transition hover:bg-white/10 hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>
        <SearchBox />
      </div>
    </header>
  );
}
