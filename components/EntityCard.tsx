import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EntityCard({
  href,
  title,
  eyebrow,
  description,
  imageUrl,
  children,
  className
}: {
  href: string;
  title: string;
  eyebrow?: string;
  description: string;
  imageUrl?: string | null;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded border border-white/10 bg-white/[0.06] transition duration-300 hover:-translate-y-1 hover:border-[var(--signal)]/60 hover:bg-white/10",
        className
      )}
    >
      {imageUrl ? (
        <div className="h-44 overflow-hidden bg-[#171717]">
          <img src={imageUrl} alt="" className="h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-105 group-hover:opacity-100" />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col p-5">
        {eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--gold)]">{eyebrow}</p> : null}
        <h2 className="mt-2 text-2xl font-black text-white">{title}</h2>
        <p className="mt-3 flex-1 text-sm leading-6 text-stone-300">{description}</p>
        {children ? <div className="mt-5">{children}</div> : null}
      </div>
    </Link>
  );
}
