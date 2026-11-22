"use client";

import { useDeferredValue, useMemo } from "react";
import {
  DEFAULT_THRESHOLDS,
  analyze,
  buildHighlightSegments,
  type Analysis,
  type DifficultyThresholds,
  type HighlightSegment,
} from "@/lib/readability";

export interface UseAnalysisResult {
  analysis: Analysis;
  segments: HighlightSegment[];
  /**
   * The exact text `segments` was built from. The overlay must render THIS
   * string rather than the live textarea value, otherwise a deferred update
   * would leave the marks describing text that is no longer on screen.
   */
  analyzedText: string;
  /** True while the analysis is a render or two behind the keystrokes. */
  isStale: boolean;
}

/**
 * Analyse `text` without blocking typing.
 *
 * `useDeferredValue` lets React paint the keystroke first and compute the
 * analysis at a lower priority, so a 10,000-word article still types at full
 * speed. The work itself is memoised, so an unrelated re-render is free.
 */
export function useAnalysis(
  text: string,
  thresholds: DifficultyThresholds = DEFAULT_THRESHOLDS,
): UseAnalysisResult {
  const deferred = useDeferredValue(text);

  const analysis = useMemo(
    () => analyze(deferred, thresholds),
    [deferred, thresholds],
  );

  const segments = useMemo(
    () => buildHighlightSegments(deferred, analysis.sentences),
    [deferred, analysis.sentences],
  );

  return {
    analysis,
    segments,
    analyzedText: deferred,
    isStale: deferred !== text,
  };
}
