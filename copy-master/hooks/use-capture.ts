"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useStoredString } from "@/hooks/use-stored-string";
import { capture, newId } from "@/lib/telemetry/client";
import type { Assignments } from "@/lib/experiments";
import type { Analysis } from "@/lib/readability";
import type { DeliverabilityReport } from "@/lib/deliverability";

export const DOC_STORAGE_KEY = "copy-master:doc";

/** How long typing has to stop before a document is worth recording. */
const SNAPSHOT_DELAY_MS = 4_000;

/** Build-time switches, inlined by Next. Absent means on. */
const ENABLED = process.env.NEXT_PUBLIC_CAPTURE_ENABLED !== "false";
const SEND_TEXT_SAMPLES =
  process.env.NEXT_PUBLIC_CAPTURE_TEXT_SAMPLES === "true";

interface UseCaptureOptions {
  visitorId: string;
  assignments: Assignments | null;
  analysis: Analysis;
  deliverability: DeliverabilityReport;
  subject?: string;
  text: string;
}

export interface UseCaptureResult {
  track: (name: string, props?: Record<string, unknown>) => void;
  /** Call when the editor starts on something new, so revisions stay grouped. */
  startNewDocument: () => void;
}

export function useCapture({
  visitorId,
  assignments,
  analysis,
  deliverability,
  subject = "",
  text,
}: UseCaptureOptions): UseCaptureResult {
  // The session id lives inside the capture client, minted when `configure`
  // runs in an effect: `cacheComponents` prerenders this component on the
  // server, and a UUID generated during that render is rejected as unstable.
  const [docId, setDocId] = useStoredString(DOC_STORAGE_KEY, "", newId);

  const assignmentList = useMemo(
    () =>
      assignments
        ? Object.entries(assignments).map(([experiment, variant]) => ({
            experiment,
            variant,
          }))
        : [],
    [assignments],
  );

  useEffect(() => {
    if (!ENABLED || !visitorId || assignmentList.length === 0) return;
    capture.configure(visitorId, assignmentList);
  }, [visitorId, assignmentList]);

  /*
   * Snapshot once typing settles. The timeout is cleared on every change, so
   * a continuous writer produces one row when they pause rather than one per
   * keystroke, and the client drops anything whose hash has not moved.
   */
  useEffect(() => {
    if (!ENABLED || !visitorId || !docId || analysis.isEmpty) return;

    const timer = setTimeout(() => {
      void capture.snapshot(
        docId,
        analysis,
        deliverability,
        subject,
        text,
        SEND_TEXT_SAMPLES,
      );
    }, SNAPSHOT_DELAY_MS);

    return () => clearTimeout(timer);
  }, [analysis, deliverability, subject, text, visitorId, docId]);

  const track = useCallback(
    (name: string, props: Record<string, unknown> = {}) => {
      if (!ENABLED) return;
      capture.event(name, props);
    },
    [],
  );

  const startNewDocument = useCallback(() => {
    if (!ENABLED) return;
    capture.resetDocument();
    setDocId(newId());
  }, [setDocId]);

  return { track, startNewDocument };
}
