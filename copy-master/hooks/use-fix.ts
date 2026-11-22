"use client";

import { useCallback, useRef, useState } from "react";
import type { AiDetectionReport } from "@/lib/ai-detection";
import type { DeliverabilityReport } from "@/lib/deliverability";
import type { Analysis } from "@/lib/readability";

export interface FixResult {
  changes: string[];
  /** What was on screen before, so the edit can be taken back. */
  previous: { subject: string; body: string };
  model: string;
}

export type FixStatus = "idle" | "working" | "error" | "unavailable";

export interface UseFixResult {
  status: FixStatus;
  error: string | null;
  result: FixResult | null;
  fix: () => void;
  undo: () => void;
  dismiss: () => void;
}

interface UseFixOptions {
  subject: string;
  body: string;
  analysis: Analysis;
  deliverability: DeliverabilityReport;
  aiDetection: AiDetectionReport;
  apply: (next: { subject: string; body: string }) => void;
  onFixed?: (info: { changes: number; model: string }) => void;
}

const MESSAGES: Record<string, string> = {
  "not-configured": "No API key set. Add ANTHROPIC_API_KEY to .env.local.",
  "bad-key": "That API key was rejected.",
  "rate-limited": "Slow down a moment, then try again.",
  "upstream-rate-limited": "Claude is rate limiting. Try again shortly.",
  refused: "Claude declined to revise this one.",
  unparseable: "Claude's reply did not come back in the expected shape.",
  empty: "Write something first.",
};

/**
 * Drives the "Fix with Claude" button.
 *
 * The local analysers have already worked out exactly what is wrong, so that
 * detail is sent along with the copy: the flagged sentences, the trigger
 * phrases, the two scores. It keeps the revision aimed at real problems rather
 * than a generic polish, and it costs almost nothing to include.
 */
export function useFix({
  subject,
  body,
  analysis,
  deliverability,
  aiDetection,
  apply,
  onFixed,
}: UseFixOptions): UseFixResult {
  const [status, setStatus] = useState<FixStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FixResult | null>(null);

  /** Guards against a second request while one is in flight. */
  const inFlight = useRef(false);

  const fix = useCallback(() => {
    if (inFlight.current) return;
    if (!subject.trim() && !body.trim()) return;

    inFlight.current = true;
    setStatus("working");
    setError(null);

    const previous = { subject, body };

    const payload = {
      subject,
      body,
      grade: analysis.isEmpty ? undefined : analysis.grade,
      deliverabilityScore: deliverability.isEmpty
        ? undefined
        : deliverability.score,
      hardSentences: analysis.sentences
        .filter((sentence) => sentence.difficulty !== "ok")
        .slice(0, 10)
        .map((sentence) => sentence.text),
      spamPhrases: deliverability.hits.map((hit) => hit.phrase),
      aiScore: aiDetection.tooShort ? undefined : aiDetection.score,
    };

    void (async () => {
      try {
        const response = await fetch("/api/fix", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = (await response.json().catch(() => null)) as
          | Record<string, unknown>
          | null;

        if (!response.ok || !data?.ok) {
          const reason = typeof data?.reason === "string" ? data.reason : "";
          if (reason === "not-configured") {
            setStatus("unavailable");
            setError(MESSAGES[reason]!);
            return;
          }
          setStatus("error");
          setError(MESSAGES[reason] ?? "That did not work. Try again.");
          return;
        }

        const nextSubject =
          typeof data.subject === "string" ? data.subject : previous.subject;
        const nextBody =
          typeof data.body === "string" ? data.body : previous.body;
        const changes = Array.isArray(data.changes)
          ? data.changes.filter((item): item is string => typeof item === "string")
          : [];
        const model = typeof data.model === "string" ? data.model : "claude";

        apply({ subject: nextSubject, body: nextBody });
        setResult({ changes, previous, model });
        setStatus("idle");
        onFixed?.({ changes: changes.length, model });
      } catch {
        setStatus("error");
        setError("Could not reach the server.");
      } finally {
        inFlight.current = false;
      }
    })();
  }, [subject, body, analysis, deliverability, aiDetection, apply, onFixed]);

  const undo = useCallback(() => {
    if (!result) return;
    apply(result.previous);
    setResult(null);
  }, [apply, result]);

  const dismiss = useCallback(() => {
    setResult(null);
    setError(null);
    if (status === "error") setStatus("idle");
  }, [status]);

  return { status, error, result, fix, undo, dismiss };
}
