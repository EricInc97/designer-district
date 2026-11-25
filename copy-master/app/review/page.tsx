import { Suspense } from "react";
import Link from "next/link";
import { getServiceClient } from "@/lib/supabase/server";

/**
 * Review: every draft the outreach agents wrote, before and after.
 *
 * Reads `draft_improvements`, which pairs each draft's first scoring — the
 * baseline, written before the agent had any numbers — with its last.
 *
 * The data fetch sits inside `<Suspense>` because `cacheComponents` is on:
 * uncached work has to be behind a boundary so the shell can still prerender.
 */

export const metadata = {
  title: "Review — Copy Master",
};

const STAGE_LABEL: Record<string, string> = {
  email_1: "Email 1",
  follow_up_1: "Follow up 1",
  follow_up_2: "Follow up 2",
  follow_up_3: "Follow up 3",
};

interface Row {
  run_id: string;
  lead_ref: string;
  company: string | null;
  stage: string;
  iterations: number;
  ended_at: string;
  original_subject: string;
  original_body: string;
  original_grade: number | null;
  original_deliverability: number | null;
  original_ai: number | null;
  original_problems: string[] | null;
  final_subject: string;
  final_body: string;
  final_grade: number | null;
  final_deliverability: number | null;
  final_ai: number | null;
  final_passes: boolean;
  /** Any row of this draft; the detail page finds the rest from it. */
  final_id: number;
}

export default function ReviewPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[72rem] px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-edge pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Review</h1>
          <p className="mt-1 text-[0.8125rem] text-ink-soft">
            What the outreach agents wrote, and what the scores made them
            change.
          </p>
        </div>
        <Link
          href="/"
          className="rounded-lg border border-edge px-3 py-1.5 text-[0.8125rem] font-medium text-ink-soft transition-colors hover:border-edge-strong hover:text-ink"
        >
          Back to the editor
        </Link>
      </header>

      <Suspense
        fallback={
          <p className="py-12 text-center text-[0.875rem] text-ink-faint">
            Loading drafts…
          </p>
        }
      >
        <Drafts />
      </Suspense>
    </main>
  );
}

async function Drafts() {
  const supabase = getServiceClient();

  if (!supabase) {
    return (
      <Notice
        title="Not connected"
        body="Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to store and review drafts."
      />
    );
  }

  const { data, error } = await supabase
    .from("draft_improvements")
    .select("*")
    .order("ended_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <Notice
        title="Could not read drafts"
        body="The query failed. Check the server logs for the reason."
      />
    );
  }

  const rows = (data ?? []) as Row[];

  if (rows.length === 0) {
    return (
      <Notice
        title="Nothing yet"
        body="Drafts appear here once the n8n Email Outreach flow runs and its agents score their copy."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5 py-6">
      {rows.map((row) => (
        <DraftCard
          key={`${row.run_id}-${row.lead_ref}-${row.stage}`}
          row={row}
        />
      ))}
    </div>
  );
}

function DraftCard({ row }: { row: Row }) {
  const unchanged = row.iterations === 1;

  return (
    <article className="rounded-2xl border border-edge bg-surface shadow-[var(--shadow-panel)]">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-edge px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="truncate text-[0.9375rem] font-semibold">
            <Link
              href={`/review/${row.final_id}`}
              className="transition-colors hover:text-accent"
            >
              {row.company || row.lead_ref}
            </Link>
          </h2>
          <p className="nums mt-0.5 text-[0.6875rem] text-ink-faint">
            {STAGE_LABEL[row.stage] ?? row.stage} &middot; {row.iterations}{" "}
            {row.iterations === 1 ? "pass" : "passes"} &middot;{" "}
            {new Date(row.ended_at).toLocaleString()}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Delta label="Grade" from={row.original_grade} to={row.final_grade} lowerIsBetter />
          <Delta
            label="Inbox"
            from={row.original_deliverability}
            to={row.final_deliverability}
          />
          <Delta label="AI" from={row.original_ai} to={row.final_ai} lowerIsBetter />
          <span
            className="rounded-full px-2 py-1 text-[0.625rem] font-semibold"
            style={{
              color: row.final_passes
                ? "var(--band-great)"
                : "var(--band-ok)",
              backgroundColor: `color-mix(in srgb, ${
                row.final_passes ? "var(--band-great)" : "var(--band-ok)"
              } 14%, transparent)`,
            }}
          >
            {row.final_passes ? "Passed" : "Still flagged"}
          </span>

          <Link
            href={`/review/${row.final_id}`}
            className="flex items-center gap-1 rounded-full border border-edge px-2.5 py-1 text-[0.625rem] font-semibold text-ink-soft transition-colors hover:border-edge-strong hover:text-ink"
          >
            Full review
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </div>

      {/* One column when there is only one version: a two-column grid with a
          single child leaves an empty panel where "After" would be. */}
      <div
        className={`grid gap-px bg-edge ${unchanged ? "" : "md:grid-cols-2"}`}
      >
        <Version
          heading={unchanged ? "Only version" : "Original"}
          subject={row.original_subject}
          body={row.original_body}
          muted={!unchanged}
        />
        {!unchanged && (
          <Version
            heading="After"
            subject={row.final_subject}
            body={row.final_body}
          />
        )}
      </div>

      {row.original_problems && row.original_problems.length > 0 && (
        <details className="border-t border-edge px-5 py-3">
          <summary className="cursor-pointer text-[0.75rem] font-medium text-ink-soft">
            What the first draft was flagged for (
            {row.original_problems.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {row.original_problems.map((problem, index) => (
              <li
                key={index}
                className="flex gap-2 text-[0.75rem] leading-relaxed text-ink-soft"
              >
                <span
                  aria-hidden="true"
                  className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-band-poor"
                />
                <span>{problem}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

function Version({
  heading,
  subject,
  body,
  muted,
}: {
  heading: string;
  subject: string;
  body: string;
  muted?: boolean;
}) {
  return (
    <div className="bg-surface px-5 py-4">
      <h3 className="text-[0.625rem] font-semibold tracking-[0.1em] text-ink-faint uppercase">
        {heading}
      </h3>
      <p
        className={`mt-2 font-serif text-[0.875rem] font-semibold ${
          muted ? "text-ink-soft" : "text-ink"
        }`}
      >
        {subject || <span className="text-ink-faint">(no subject)</span>}
      </p>
      <p
        className={`mt-2 font-serif text-[0.8125rem] leading-relaxed whitespace-pre-wrap ${
          muted ? "text-ink-soft" : "text-ink"
        }`}
      >
        {body}
      </p>
    </div>
  );
}

function Delta({
  label,
  from,
  to,
  lowerIsBetter,
}: {
  label: string;
  from: number | null;
  to: number | null;
  lowerIsBetter?: boolean;
}) {
  if (from === null || to === null) return null;

  const moved = Number((to - from).toFixed(1));
  const better = lowerIsBetter ? moved < 0 : moved > 0;
  const color =
    moved === 0
      ? "var(--ink-faint)"
      : better
        ? "var(--band-great)"
        : "var(--band-poor)";

  return (
    <span className="nums flex items-baseline gap-1 rounded-full border border-edge px-2 py-1 text-[0.625rem]">
      <span className="text-ink-faint">{label}</span>
      <span className="text-ink-soft">{from}</span>
      <span className="text-ink-faint">&rarr;</span>
      <span className="font-semibold" style={{ color }}>
        {to}
      </span>
    </span>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-8 rounded-2xl border border-edge bg-surface p-8 text-center">
      <p className="text-[0.9375rem] font-semibold">{title}</p>
      <p className="mx-auto mt-1.5 max-w-prose text-[0.8125rem] leading-relaxed text-ink-soft">
        {body}
      </p>
    </div>
  );
}
