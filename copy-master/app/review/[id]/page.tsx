import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DraftReview, type DraftVersion } from "@/components/draft-review";
import { getServiceClient } from "@/lib/supabase/server";

/**
 * One draft, in full.
 *
 * The id in the URL is any row of the draft; the page then loads every
 * iteration sharing its run, lead and stage, so you can step through the
 * passes the agent made.
 *
 * As on the list, the fetch sits inside `<Suspense>` because `cacheComponents`
 * is on and this data cannot be prerendered.
 */

export const metadata = {
  title: "Draft review — Copy Master",
};

const STAGE_LABEL: Record<string, string> = {
  email_1: "Email 1",
  follow_up_1: "Follow up 1",
  follow_up_2: "Follow up 2",
  follow_up_3: "Follow up 3",
};

/**
 * The sentence-length rule each stage was written to.
 *
 * The outreach flow passes `min_words_to_flag: 21` on every Copy Master call,
 * because its own brief permits a 20-word observation. Reviewing with the
 * engine's stricter default would mark sentences the agent was required to
 * keep, so the review uses the same number the agent was scored against.
 */
const MIN_WORDS_TO_FLAG = 21;

/*
 * `params` is awaited inside the boundary, not here.
 *
 * With `cacheComponents` on, reading it in the page body is runtime data
 * outside `<Suspense>`, which stops the shell prerendering and blocks the
 * page load. Passing the promise down keeps the shell static.
 */
export default function DraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <p className="py-12 text-center text-[0.875rem] text-ink-faint">
          Loading draft…
        </p>
      }
    >
      <Draft params={params} />
    </Suspense>
  );
}

interface Row {
  run_id: string;
  lead_ref: string;
  company: string | null;
  stage: string;
  iteration: number;
  subject: string;
  body: string;
  created_at: string;
  passes: boolean;
  problems: string[] | null;
}

async function Draft({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;

  // A bad id should 404 rather than reach the database.
  if (!/^\d+$/.test(rawId)) notFound();
  const id = Number(rawId);

  const supabase = getServiceClient();

  if (!supabase) {
    return (
      <Notice
        title="Not connected"
        body="Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to review stored drafts."
      />
    );
  }

  /* The row named in the URL, for the run/lead/stage it belongs to. */
  const { data: anchor, error: anchorError } = await supabase
    .from("outreach_drafts")
    .select("run_id, lead_ref, stage")
    .eq("id", id)
    .maybeSingle();

  if (anchorError) {
    return (
      <Notice
        title="Could not read this draft"
        body="The query failed. Check the server logs for the reason."
      />
    );
  }

  if (!anchor) notFound();

  /* Every pass the agent made on it, oldest first. */
  const { data, error } = await supabase
    .from("outreach_drafts")
    .select(
      "run_id, lead_ref, company, stage, iteration, subject, body, created_at, passes, problems",
    )
    .eq("run_id", anchor.run_id)
    .eq("lead_ref", anchor.lead_ref)
    .eq("stage", anchor.stage)
    .order("iteration", { ascending: true });

  if (error || !data || data.length === 0) {
    return (
      <Notice
        title="Could not read this draft"
        body="The versions could not be loaded. Check the server logs for the reason."
      />
    );
  }

  const rows = data as Row[];
  const latest = rows[rows.length - 1];

  const versions: DraftVersion[] = rows.map((row) => ({
    iteration: row.iteration,
    subject: row.subject,
    body: row.body,
    created_at: row.created_at,
    passes: row.passes,
    problems: row.problems ?? [],
  }));

  return (
    <DraftReview
      company={latest.company ?? ""}
      leadRef={latest.lead_ref}
      stage={latest.stage}
      stageLabel={STAGE_LABEL[latest.stage] ?? latest.stage}
      runId={latest.run_id}
      versions={versions}
      minWordsToFlag={MIN_WORDS_TO_FLAG}
      /* Only the first email in a sequence carries a subject line. */
      subjectExpected={latest.stage === "email_1"}
    />
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[72rem] px-4 py-8 sm:px-6">
      <div className="mt-8 rounded-2xl border border-edge bg-surface p-8 text-center">
        <p className="text-[0.9375rem] font-semibold">{title}</p>
        <p className="mx-auto mt-1.5 max-w-prose text-[0.8125rem] leading-relaxed text-ink-soft">
          {body}
        </p>
        <Link
          href="/review"
          className="mt-4 inline-block rounded-lg border border-edge px-3 py-1.5 text-[0.8125rem] font-medium text-ink-soft transition-colors hover:border-edge-strong hover:text-ink"
        >
          Back to all drafts
        </Link>
      </div>
    </main>
  );
}
