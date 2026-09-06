"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center px-5 py-20">
      <p className="eyebrow">Something broke</p>
      <h1 className="display mt-3 text-4xl sm:text-5xl">
        That didn&apos;t load
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-dim">
        The page hit an error on the way in. Try again. If it keeps happening,
        the database connection is the usual culprit.
      </p>

      {error.digest && (
        <p className="mt-3 font-mono text-xs text-ink-faint">
          Reference: {error.digest}
        </p>
      )}

      <button
        type="button"
        onClick={reset}
        className="mt-10 self-start rounded-full bg-ink px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-paper hover:opacity-90 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
