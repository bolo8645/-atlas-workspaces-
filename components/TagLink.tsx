import Link from "next/link";
import type { ReactNode } from "react";

export function TagLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex rounded border border-white/[0.12] bg-white/[0.07] px-3 py-1.5 text-sm text-stone-200 transition hover:border-[var(--signal)]/60 hover:text-white">
      {children}
    </Link>
  );
}
