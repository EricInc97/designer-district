import { NextResponse } from "next/server";
import { detectAi } from "@/lib/ai-detection";
import { checkDeliverability, SUBJECT_MAX, SUBJECT_MIN } from "@/lib/deliverability";
import { htmlToPlain, plainToHtml } from "@/lib/email-html";
import { DEFAULT_THRESHOLDS, analyze } from "@/lib/readability";
import { getServiceClient } from "@/lib/supabase/server";

/**
 * Analysis for machines.
 *
 * The dashboard runs the three engines in the browser; this exposes the same
 * pure functions over HTTP so an agent can score a draft, read exactly what is
 * wrong with it, rewrite, and score again.
 *
 * It measures and reports. It never rewrites — that is the caller's job, which
 * is what makes it safe to loop against.
 *
 * Bodies arrive as the outreach flow carries them: JSON with `<br>` breaks and
 * anchor tags. Normalising that to prose happens here, server-side, so no
 * prompt has to get it right.
 */

const MAX_SUBJECT = 500;
const MAX_BODY = 40_000;

/* Targets the caller is working towards, echoed back so the agent does not
   have to be told them twice. */
const TARGETS = {
  reading_grade_at_or_below: 8,
  deliverability_at_or_above: 85,
  ai_score_at_or_below: 55,
  subject_chars: [SUBJECT_MIN, SUBJECT_MAX] as const,
};

function unauthorized(request: Request): boolean {
  const expected = process.env.COPY_MASTER_API_KEY;
  // Unset means open, which is fine locally. Set it in production.
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  return token !== expected;
}

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

/** Finite numbers only; anything else falls back to the caller's default. */
function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function int(value: unknown): number | null {
  const parsed = num(value);
  return parsed === null || parsed < 0 ? null : Math.round(parsed);
}

const STAGES = new Set([
  "email_1",
  "follow_up_1",
  "follow_up_2",
  "follow_up_3",
]);

interface DraftRow {
  run_id: string;
  lead_ref: string;
  company: string | null;
  stage: string;
  subject: string;
  body: string;
  passes: boolean;
  problems: string[];
  grade: number | null;
  reading_ease: number | null;
  deliverability_score: number;
  spam_hit_count: number;
  ai_score: number | null;
  words: number;
  sentences: number;
}

/**
 * Save this scoring as the next iteration of a draft.
 *
 * Iteration 1 is whatever the agent scored first, before it had any numbers
 * to act on — the baseline every later version is compared against. The
 * iteration number is derived from what is already stored rather than sent by
 * the caller, so a confused agent cannot overwrite its own baseline.
 *
 * Saving is best effort. A failure here must never fail the scoring, because
 * the agent is mid-draft and the numbers are the thing it actually needs.
 */
async function saveDraft(
  row: DraftRow,
): Promise<{ saved: boolean; iteration: number | null }> {
  const supabase = getServiceClient();
  if (!supabase) return { saved: false, iteration: null };

  try {
    const { data: previous, error: readError } = await supabase
      .from("outreach_drafts")
      .select("iteration")
      .eq("run_id", row.run_id)
      .eq("lead_ref", row.lead_ref)
      .eq("stage", row.stage)
      .order("iteration", { ascending: false })
      .limit(1);

    if (readError) throw readError;

    const next = (previous?.[0]?.iteration ?? 0) + 1;

    // One retry: two tool calls landing together would both compute the same
    // number, and the unique constraint turns that into an error rather than
    // a lost row.
    for (const iteration of [next, next + 1]) {
      const { error } = await supabase
        .from("outreach_drafts")
        .insert({ ...row, iteration });

      if (!error) return { saved: true, iteration };
      if (error.code !== "23505") throw error;
    }

    return { saved: false, iteration: null };
  } catch (error) {
    console.error("[analyze] draft save failed", error);
    return { saved: false, iteration: null };
  }
}

export async function POST(request: Request) {
  if (unauthorized(request)) {
    return NextResponse.json(
      { ok: false, reason: "unauthorized" },
      { status: 401 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }

  if (typeof payload !== "object" || payload === null) {
    return NextResponse.json(
      { ok: false, reason: "bad-payload" },
      { status: 400 },
    );
  }

  const input = payload as Record<string, unknown>;

  /* Accept either spelling the flow might use. */
  const rawSubject = str(
    input.subject ?? input.subject_line ?? input.follow_up_subject,
    MAX_SUBJECT,
  );
  const rawBody = str(
    input.body ?? input.email_body ?? input.follow_up_body,
    MAX_BODY,
  );

  if (!rawSubject.trim() && !rawBody.trim()) {
    return NextResponse.json(
      {
        ok: false,
        reason: "empty",
        message: "Send at least one of subject or body.",
      },
      { status: 400 },
    );
  }

  /* `<br>` and anchors out, prose in. */
  const subject = htmlToPlain(rawSubject);
  const body = htmlToPlain(rawBody);

  /*
   * Let the caller bring its own sentence-length rule.
   *
   * The engine's default flags at 14 words, but a caller working to its own
   * brief may permit longer sentences — the outreach flow allows a 20-word
   * observation. Without this the tool reports a "problem" the caller's own
   * rules require it to keep, every single time.
   */
  const thresholds = {
    minWordsToFlag:
      int(input.min_words_to_flag) ?? DEFAULT_THRESHOLDS.minWordsToFlag,
    hardGrade: num(input.hard_grade) ?? DEFAULT_THRESHOLDS.hardGrade,
    veryHardGrade:
      num(input.very_hard_grade) ?? DEFAULT_THRESHOLDS.veryHardGrade,
  };

  const readability = analyze(body, thresholds);
  const deliverability = checkDeliverability(subject, body);
  const ai = detectAi(body);

  /* ---------------------------------------------------------------- */
  /* The actionable part                                              */
  /* ---------------------------------------------------------------- */

  const problems: string[] = [];

  const hardSentences = readability.sentences
    .filter((sentence) => sentence.difficulty !== "ok")
    .sort((a, b) => b.grade - a.grade)
    .slice(0, 8)
    .map((sentence) => ({
      text: sentence.text,
      words: sentence.wordCount,
      difficulty: sentence.difficulty,
    }));

  if (!readability.isEmpty && readability.grade > TARGETS.reading_grade_at_or_below) {
    problems.push(
      `Reading grade is ${readability.grade.toFixed(1)}; target is ${TARGETS.reading_grade_at_or_below} or below. Split the long sentences.`,
    );
  }

  for (const sentence of hardSentences) {
    problems.push(
      `${sentence.difficulty === "very-hard" ? "Very hard" : "Hard"} to read (${sentence.words} words): "${sentence.text}"`,
    );
  }

  if (deliverability.hits.length > 0) {
    problems.push(
      `Spam trigger phrases to replace with plain equivalents: ${deliverability.hits
        .map((hit) => `"${hit.phrase}"${hit.inSubject ? " (in subject)" : ""}`)
        .join(", ")}.`,
    );
  }

  for (const check of deliverability.checks) {
    if (check.status === "pass") continue;
    // Advisory checks are style preferences. Listing them here would send a
    // caller off to "fix" something that is already fine.
    if (check.advisory) continue;
    problems.push(`${check.label}: ${check.detail}`);
  }

  if (!ai.tooShort && ai.score > TARGETS.ai_score_at_or_below) {
    const worst = ai.signals.slice(0, 2).map((signal) => signal.label).join(" and ");
    problems.push(
      `Reads ${ai.score}% machine-written; target is ${TARGETS.ai_score_at_or_below} or below. Worst signals: ${worst}. Vary sentence length and cut stock phrasing.`,
    );
  }

  const passes =
    (readability.isEmpty ||
      readability.grade <= TARGETS.reading_grade_at_or_below) &&
    deliverability.score >= TARGETS.deliverability_at_or_above &&
    (ai.tooShort || ai.score <= TARGETS.ai_score_at_or_below);

  /* ---------------------------------------------------------------- */
  /* Keep a copy for review                                           */
  /* ---------------------------------------------------------------- */

  const runId = str(input.run_id, 100).trim();
  const leadRef = str(input.lead_ref, 300).trim();
  const stage = str(input.stage, 40).trim();

  const save =
    runId && leadRef && STAGES.has(stage)
      ? await saveDraft({
          run_id: runId,
          lead_ref: leadRef,
          company: str(input.company, 300).trim() || null,
          stage,
          subject,
          body,
          passes,
          problems,
          grade: readability.isEmpty
            ? null
            : Number(readability.grade.toFixed(2)),
          reading_ease: readability.isEmpty
            ? null
            : Number(readability.fleschReadingEase.toFixed(1)),
          deliverability_score: deliverability.score,
          spam_hit_count: deliverability.hits.length,
          ai_score: ai.tooShort ? null : ai.score,
          words: readability.words,
          sentences: readability.sentenceCount,
        })
      : { saved: false, iteration: null };

  return NextResponse.json({
    ok: true,
    passes,
    problems,
    targets: TARGETS,
    /* iteration 1 means this was the baseline, scored before any fixing. */
    review: save,

    readability: {
      grade: Number(readability.grade.toFixed(2)),
      band: readability.gradeBand.label,
      reading_ease: Number(readability.fleschReadingEase.toFixed(1)),
      words: readability.words,
      sentences: readability.sentenceCount,
      avg_words_per_sentence: Number(
        readability.avgWordsPerSentence.toFixed(1),
      ),
      longest_sentence_words: readability.longestSentence?.wordCount ?? 0,
      hard_sentences: hardSentences,
    },

    deliverability: {
      score: deliverability.score,
      band: deliverability.band.label,
      spam_phrases: deliverability.hits.map((hit) => ({
        phrase: hit.phrase,
        category: hit.category,
        severity: hit.severity,
        in_subject: hit.inSubject,
      })),
      failed_checks: deliverability.checks
        .filter((check) => check.status !== "pass")
        .map((check) => ({
          check: check.label,
          status: check.status,
          detail: check.detail,
          // Reported for information; deliberately absent from `problems`.
          advisory: check.advisory === true,
        })),
      subject_length: deliverability.subjectLength,
    },

    ai_detection: {
      score: ai.tooShort ? null : ai.score,
      band: ai.tooShort ? "not enough text" : ai.band.label,
      too_short: ai.tooShort,
      signals: ai.signals.map((signal) => ({
        signal: signal.label,
        score: Math.round(signal.score),
        detail: signal.detail,
      })),
      note:
        "A style signal, not proof of authorship. Use it to vary rhythm, nothing else.",
    },

    /* What was measured, and the same text in the form the flow carries. */
    normalized: {
      subject,
      body_plain: body,
      body_html: plainToHtml(body),
    },
  });
}
