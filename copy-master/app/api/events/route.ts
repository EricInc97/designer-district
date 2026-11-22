import { NextResponse } from "next/server";
import { captureTextSamples, getServiceClient } from "@/lib/supabase/server";
import {
  LIMITS,
  type AssignmentPayload,
  type CapturePayload,
  type EventPayload,
  type SnapshotPayload,
} from "@/lib/telemetry/types";

/**
 * Capture ingest.
 *
 * The only place the service role key is used. Everything arriving here is
 * untrusted: the endpoint is reachable by anyone who can load the page, so
 * each field is re-validated and clamped before it reaches Postgres rather
 * than relying on the client having behaved.
 */

/*
 * No `runtime` or `dynamic` segment config here: `cacheComponents` rejects
 * both. A POST handler is dynamic anyway, so there was nothing to declare.
 */

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_RE = /^[0-9a-f]{64}$/i;
const NAME_RE = /^[a-z0-9_.:-]+$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

/** Finite numbers only: NaN and Infinity would be rejected by Postgres anyway. */
function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function int(value: unknown): number | null {
  const parsed = num(value);
  if (parsed === null || parsed < 0) return null;
  return Math.round(parsed);
}

/** ISO timestamp, rejected if it is implausible or far in the future. */
function timestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  // A client clock can be wrong; allow an hour of skew, no more.
  if (parsed > Date.now() + 3_600_000) return null;
  if (parsed < Date.parse("2020-01-01")) return null;
  return new Date(parsed).toISOString();
}

function array<T>(value: unknown, limit: number): T[] {
  return Array.isArray(value) ? (value.slice(0, limit) as T[]) : [];
}

/* -------------------------------------------------------------------------- */
/* Handler                                                                    */
/* -------------------------------------------------------------------------- */

export async function POST(request: Request) {
  const supabase = getServiceClient();

  // Not configured. Tell the client to stop trying rather than failing loudly;
  // capture is optional and its absence is not an error.
  if (!supabase) {
    return NextResponse.json(
      { ok: false, reason: "capture-not-configured" },
      { status: 503 },
    );
  }

  // Read as text, because sendBeacon sets its own content type.
  let body: unknown;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }

  if (!isRecord(body) || !isRecord(body.visitor)) {
    return NextResponse.json(
      { ok: false, reason: "bad-payload" },
      { status: 400 },
    );
  }

  const payload = body as unknown as CapturePayload;

  const visitorId = str(payload.visitor.id, 36);
  if (!visitorId || !UUID_RE.test(visitorId)) {
    return NextResponse.json(
      { ok: false, reason: "bad-visitor-id" },
      { status: 400 },
    );
  }

  const written = { assignments: 0, events: 0, snapshots: 0 };

  try {
    /* ---------------------------------------------------------------- */
    /* Visitor                                                          */
    /* ---------------------------------------------------------------- */

    const { error: visitorError } = await supabase.from("visitors").upsert(
      {
        id: visitorId,
        last_seen_at: new Date().toISOString(),
        // Truncated, and only the UA string the browser volunteers.
        user_agent: request.headers.get("user-agent")?.slice(0, 400) ?? null,
        locale: str(payload.visitor.locale, 32),
        time_zone: str(payload.visitor.timeZone, 64),
      },
      { onConflict: "id" },
    );

    if (visitorError) throw visitorError;

    /* ---------------------------------------------------------------- */
    /* Assignments                                                      */
    /* ---------------------------------------------------------------- */

    const assignments = array<AssignmentPayload>(
      payload.assignments,
      LIMITS.assignments,
    )
      .map((item) => {
        if (!isRecord(item)) return null;
        const experiment = str(item.experiment, 64);
        const variant = str(item.variant, 64);
        if (!experiment || !variant) return null;
        if (!NAME_RE.test(experiment) || !NAME_RE.test(variant)) return null;
        return { visitor_id: visitorId, experiment, variant };
      })
      .filter((row) => row !== null);

    if (assignments.length > 0) {
      // ignoreDuplicates keeps assignment sticky: the first variant a visitor
      // saw is the one that stands, even if the client sends a different one.
      const { error } = await supabase
        .from("experiment_assignments")
        .upsert(assignments, {
          onConflict: "visitor_id,experiment",
          ignoreDuplicates: true,
        });
      if (error) throw error;
      written.assignments = assignments.length;
    }

    /* ---------------------------------------------------------------- */
    /* Events                                                           */
    /* ---------------------------------------------------------------- */

    const events = array<EventPayload>(payload.events, LIMITS.events)
      .map((item) => {
        if (!isRecord(item)) return null;

        const sessionId = str(item.sessionId, 36);
        const name = str(item.name, LIMITS.eventNameLength);
        const occurredAt = timestamp(item.occurredAt);
        if (!sessionId || !UUID_RE.test(sessionId)) return null;
        if (!name || !NAME_RE.test(name) || !occurredAt) return null;

        // Props are free-form, so cap the serialised size rather than the
        // shape. An oversized blob is dropped, not the whole event.
        let props: Record<string, unknown> = {};
        if (isRecord(item.props)) {
          const encoded = JSON.stringify(item.props);
          if (encoded.length <= LIMITS.propsBytes) props = item.props;
        }

        return {
          visitor_id: visitorId,
          session_id: sessionId,
          name,
          props,
          occurred_at: occurredAt,
        };
      })
      .filter((row) => row !== null);

    if (events.length > 0) {
      const { error } = await supabase.from("events").insert(events);
      if (error) throw error;
      written.events = events.length;
    }

    /* ---------------------------------------------------------------- */
    /* Snapshots                                                        */
    /* ---------------------------------------------------------------- */

    const allowSamples = captureTextSamples();

    const snapshots = array<SnapshotPayload>(payload.snapshots, LIMITS.snapshots)
      .map((item) => {
        if (!isRecord(item)) return null;

        const sessionId = str(item.sessionId, 36);
        const docId = str(item.docId, 36);
        const capturedAt = timestamp(item.capturedAt);
        const textHash = str(item.textHash, 64);

        if (!sessionId || !UUID_RE.test(sessionId)) return null;
        if (!docId || !UUID_RE.test(docId)) return null;
        if (!capturedAt || !textHash || !SHA256_RE.test(textHash)) return null;

        const counts = {
          words: int(item.words),
          characters: int(item.characters),
          sentences: int(item.sentences),
          paragraphs: int(item.paragraphs),
          syllables: int(item.syllables),
          complex_words: int(item.complexWords),
          longest_sentence_words: int(item.longestSentenceWords),
          hard_count: int(item.hardCount),
          very_hard_count: int(item.veryHardCount),
        };
        if (Object.values(counts).some((value) => value === null)) return null;

        const scores = {
          grade: num(item.grade),
          ari: num(item.ari),
          reading_ease: num(item.readingEase),
          avg_words_per_sentence: num(item.avgWordsPerSentence),
          reading_time_seconds: num(item.readingTimeSeconds),
        };
        if (Object.values(scores).some((value) => value === null)) return null;

        /*
         * Deliverability is optional: an older client, or a draft with
         * nothing in it yet, simply omits these. NULL says "not measured",
         * which is the honest value — a zero would drag every average down.
         */
        const deliverabilityScore = num(item.deliverabilityScore);

        const deliverability = {
          subject_length: int(item.subjectLength),
          deliverability_score:
            deliverabilityScore === null
              ? null
              : Math.min(100, Math.max(0, deliverabilityScore)),
          spam_hit_count: int(item.spamHitCount),
          spam_severe_count: int(item.spamSevereCount),
        };

        return {
          visitor_id: visitorId,
          session_id: sessionId,
          doc_id: docId,
          captured_at: capturedAt,
          ...counts,
          ...scores,
          ...deliverability,
          text_hash: textHash.toLowerCase(),
          // Dropped unless BOTH ends agree, and truncated even then.
          text_sample: allowSamples
            ? (str(item.textSample, LIMITS.textSampleLength) ?? null)
            : null,
        };
      })
      .filter((row) => row !== null);

    if (snapshots.length > 0) {
      const { error } = await supabase
        .from("analysis_snapshots")
        .insert(snapshots);
      if (error) throw error;
      written.snapshots = snapshots.length;
    }
  } catch (error) {
    // Log server side; tell the client nothing about the database.
    console.error("[capture] write failed", error);
    return NextResponse.json(
      { ok: false, reason: "write-failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, written });
}
