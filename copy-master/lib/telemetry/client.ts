"use client";

import {
  LIMITS,
  type AssignmentPayload,
  type CapturePayload,
  type EventPayload,
  type SnapshotPayload,
} from "@/lib/telemetry/types";
import type { Analysis } from "@/lib/readability";
import type { DeliverabilityReport } from "@/lib/deliverability";

/**
 * Browser side of capture.
 *
 * Design rules, in order of importance:
 *   1. Never get in the way. Every failure path is silent and the editor
 *      carries on exactly as if capture did not exist.
 *   2. Batch. One request every few seconds, not one per keystroke.
 *   3. Do not lose the last batch. A writer closing the tab is precisely the
 *      moment worth recording, so unload flushes through `sendBeacon`.
 */

const ENDPOINT = "/api/events";
const FLUSH_DELAY_MS = 3_000;

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Vanishingly rare fallback; the server only needs a well-formed UUID.
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (char) => {
    const digit = Number(char);
    return (
      digit ^
      (Math.random() * 16 >> (digit / 4))
    ).toString(16);
  });
}

/** SHA-256 as lower-case hex. Needs a secure context (localhost counts). */
export async function hashText(text: string): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  try {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(text),
    );
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

class CaptureClient {
  private visitorId: string | null = null;
  /**
   * One id per page load, minted on the first `configure` call.
   *
   * It lives here rather than in React state on purpose: `cacheComponents`
   * prerenders Client Components on the server, and generating a UUID during
   * that render is rejected as an unstable value. `configure` only ever runs
   * from an effect, which is firmly on the client.
   */
  private sessionId: string | null = null;
  private assignments: AssignmentPayload[] = [];
  private assignmentsSent = false;

  private events: EventPayload[] = [];
  private snapshots: SnapshotPayload[] = [];

  private timer: ReturnType<typeof setTimeout> | null = null;
  private bound = false;
  private disabled = false;

  /** Last hash written, so an unchanged document is not recorded twice. */
  private lastHash: string | null = null;

  configure(visitorId: string, assignments: AssignmentPayload[]): void {
    this.sessionId ??= newId();
    if (this.visitorId !== visitorId) {
      this.visitorId = visitorId;
      this.assignmentsSent = false;
    }
    this.assignments = assignments;
    this.bindUnload();
  }

  disable(): void {
    this.disabled = true;
    this.events = [];
    this.snapshots = [];
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  event(name: string, props: Record<string, unknown> = {}): void {
    if (this.disabled || !this.visitorId || !this.sessionId) return;
    if (this.events.length >= LIMITS.events) return;

    this.events.push({
      sessionId: this.sessionId,
      name,
      props,
      occurredAt: new Date().toISOString(),
    });
    this.schedule();
  }

  /**
   * Record the state of a document. Returns early when the content has not
   * changed since the last snapshot, so idle time does not fill the table.
   */
  async snapshot(
    docId: string,
    analysis: Analysis,
    deliverability: DeliverabilityReport,
    subject: string,
    text: string,
    includeSample: boolean,
  ): Promise<void> {
    if (this.disabled || !this.visitorId || !this.sessionId) return;
    if (analysis.isEmpty) return;

    // Hash subject and body together, so editing only the subject still
    // registers as a new revision.
    const textHash = await hashText(`${subject}\u0000${text}`);
    // No secure context means no hash, and the server requires one.
    if (!textHash || textHash === this.lastHash) return;
    this.lastHash = textHash;

    if (this.snapshots.length >= LIMITS.snapshots) this.snapshots.shift();

    this.snapshots.push({
      sessionId: this.sessionId,
      docId,
      capturedAt: new Date().toISOString(),

      words: analysis.words,
      characters: analysis.characters,
      sentences: analysis.sentenceCount,
      paragraphs: analysis.paragraphs,
      syllables: analysis.syllables,
      complexWords: analysis.complexWords,

      grade: round(analysis.grade),
      ari: round(analysis.ari),
      readingEase: round(analysis.fleschReadingEase),
      avgWordsPerSentence: round(analysis.avgWordsPerSentence),
      longestSentenceWords: analysis.longestSentence?.wordCount ?? 0,

      hardCount: analysis.hardCount,
      veryHardCount: analysis.veryHardCount,
      readingTimeSeconds: round(analysis.readingTimeSeconds),

      subjectLength: subject.trim().length,
      deliverabilityScore: deliverability.isEmpty
        ? undefined
        : deliverability.score,
      spamHitCount: deliverability.hits.length,
      spamSevereCount: deliverability.hits.filter((hit) => hit.severity === 3)
        .length,

      textHash,
      ...(includeSample
        ? { textSample: text.slice(0, LIMITS.textSampleLength) }
        : {}),
    });

    this.schedule();
  }

  /** A new draft: let the next snapshot through even if the text repeats. */
  resetDocument(): void {
    this.lastHash = null;
  }

  private schedule(): void {
    if (this.disabled || this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, FLUSH_DELAY_MS);
  }

  private takePayload(): CapturePayload | null {
    if (!this.visitorId) return null;

    const sendAssignments = !this.assignmentsSent && this.assignments.length > 0;
    if (!sendAssignments && !this.events.length && !this.snapshots.length) {
      return null;
    }

    const payload: CapturePayload = {
      visitor: {
        id: this.visitorId,
        locale: navigator.language,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      ...(sendAssignments ? { assignments: this.assignments } : {}),
      ...(this.events.length ? { events: this.events } : {}),
      ...(this.snapshots.length ? { snapshots: this.snapshots } : {}),
    };

    this.events = [];
    this.snapshots = [];
    return payload;
  }

  async flush(useBeacon = false): Promise<void> {
    if (this.disabled) return;

    const payload = this.takePayload();
    if (!payload) return;

    const body = JSON.stringify(payload);

    // The tab is going away: sendBeacon is the only transport the browser
    // promises to finish. It is fire and forget, so assume it worked.
    if (useBeacon && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "text/plain" }));
      this.assignmentsSent = true;
      return;
    }

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      });

      // 503 means capture is not configured on this deployment. Stop asking.
      if (response.status === 503) {
        this.disable();
        return;
      }

      if (response.ok) this.assignmentsSent = true;
    } catch {
      // Offline, blocked by an extension, navigating away. Drop it silently;
      // losing analytics is never worth surfacing to someone who is writing.
    }
  }

  private bindUnload(): void {
    if (this.bound || typeof window === "undefined") return;
    this.bound = true;

    // `visibilitychange` to hidden is the reliable one. `pagehide` covers
    // the back/forward cache path that never fires it.
    const onHide = () => {
      if (document.visibilityState === "hidden") void this.flush(true);
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", () => void this.flush(true));
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export const capture = new CaptureClient();
