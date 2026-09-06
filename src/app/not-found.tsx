import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center px-5 py-20">
      <p className="eyebrow">404</p>
      <h1 className="display mt-3 text-5xl sm:text-6xl">Not in stock</h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-dim">
        That page, brand or product isn&apos;t here. It may have sold out and been
        taken down.
      </p>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/"
          className="rounded-full bg-ink px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-paper hover:opacity-90 transition-colors"
        >
          Back home
        </Link>
        <Link
          href="/brands"
          className="rounded-full border border-rule-strong px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] hover:border-ink transition-colors"
        >
          Browse brands
        </Link>
      </div>
    </div>
  );
}
