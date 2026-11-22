/**
 * The wire format between the browser and `/api/events`.
 *
 * Shared by both sides so the shapes cannot drift, but note that the server
 * re-validates everything it receives: this file is a contract, not a
 * guarantee. Nothing here carries identity — no account, no email, no IP —
 * only an anonymous id the browser made up for itself.
 */

export interface VisitorPayload {
  /** UUID generated in the browser and kept in localStorage. */
  id: string;
  locale?: string;
  timeZone?: string;
}

export interface AssignmentPayload {
  experiment: string;
  variant: string;
}

export interface EventPayload {
  sessionId: string;
  name: string;
  props?: Record<string, unknown>;
  /** ISO 8601, from the client clock. */
  occurredAt: string;
}

export interface SnapshotPayload {
  sessionId: string;
  /** Stable across edits of the same draft, so revisions can be ordered. */
  docId: string;
  capturedAt: string;

  words: number;
  characters: number;
  sentences: number;
  paragraphs: number;
  syllables: number;
  complexWords: number;

  grade: number;
  ari: number;
  readingEase: number;
  avgWordsPerSentence: number;
  longestSentenceWords: number;

  hardCount: number;
  veryHardCount: number;
  readingTimeSeconds: number;

  /* Deliverability. Optional, so an older client stays compatible. */
  subjectLength?: number;
  deliverabilityScore?: number;
  spamHitCount?: number;
  spamSevereCount?: number;

  /** SHA-256 of the content. Identifies a revision without revealing it. */
  textHash: string;
  /** Only ever sent when text sampling is switched on at both ends. */
  textSample?: string;
}

export interface CapturePayload {
  visitor: VisitorPayload;
  assignments?: AssignmentPayload[];
  events?: EventPayload[];
  snapshots?: SnapshotPayload[];
}

/** Batch limits, enforced server side and respected by the client. */
export const LIMITS = {
  events: 50,
  snapshots: 20,
  assignments: 10,
  eventNameLength: 64,
  propsBytes: 4_000,
  textSampleLength: 20_000,
} as const;
