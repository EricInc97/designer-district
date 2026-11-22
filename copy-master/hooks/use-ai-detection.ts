"use client";

import { useDeferredValue, useMemo } from "react";
import { detectAi, type AiDetectionReport } from "@/lib/ai-detection";

/**
 * The AI-style reading for the current body text.
 *
 * Deferred and memoised like the other two engines, so all three recompute on
 * the same low-priority pass after a keystroke has painted. The work is a
 * handful of regex scans and one pass over the sentence lengths.
 */
export function useAiDetection(text: string): AiDetectionReport {
  const deferred = useDeferredValue(text);
  return useMemo(() => detectAi(deferred), [deferred]);
}
