import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-[70vh] place-items-center px-4">
      <section className="max-w-xl rounded border border-white/10 bg-white/[0.06] p-8 text-center">
        <p className="text-sm font-black uppercase tracking-[0.28em] text-[var(--signal)]">Archive Gap</p>
        <h1 className="mt-4 text-4xl font-black text-white">That record is missing from the Accord index.</h1>
        <p className="mt-4 leading-7 text-stone-300">The sky keeps some secrets. The public atlas still has plenty worth chasing.</p>
        <Link href="/universe" className="mt-6 inline-flex rounded bg-[var(--ember)] px-5 py-3 font-bold text-white transition hover:bg-[#b73525]">
          Return to Universe
        </Link>
      </section>
    </main>
  );
}
