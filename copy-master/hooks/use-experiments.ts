"use client";

import { useMemo } from "react";
import { useStoredString } from "@/hooks/use-stored-string";
import { newId } from "@/lib/telemetry/client";
import {
  HIGHLIGHT_THRESHOLDS,
  assignAll,
  thresholdsFor,
  type Assignments,
  type VariantOf,
} from "@/lib/experiments";
import {
  DEFAULT_THRESHOLDS,
  type DifficultyThresholds,
} from "@/lib/readability";

export const VISITOR_STORAGE_KEY = "copy-master:visitor";

export interface UseExperimentsResult {
  /** Empty string until the browser has hydrated. */
  visitorId: string;
  assignments: Assignments | null;
  /** Which highlighting rules this visitor gets. */
  thresholds: DifficultyThresholds;
  highlightVariant: VariantOf<typeof HIGHLIGHT_THRESHOLDS> | null;
}

/**
 * Work out this visitor's variants.
 *
 * Assignment is derived from the visitor id by a pure hash, so there is no
 * request to wait on and no flash of the wrong variant: the id and the saved
 * draft arrive from the same store in the same commit, which means the
 * thresholds are already right the first time any text is on screen.
 */
export function useExperiments(): UseExperimentsResult {
  const [visitorId] = useStoredString(VISITOR_STORAGE_KEY, "", newId);

  const assignments = useMemo(
    () => (visitorId ? assignAll(visitorId) : null),
    [visitorId],
  );

  const highlightVariant = assignments?.[HIGHLIGHT_THRESHOLDS] ?? null;

  const thresholds = useMemo(
    () => (highlightVariant ? thresholdsFor(highlightVariant) : DEFAULT_THRESHOLDS),
    [highlightVariant],
  );

  return { visitorId, assignments, thresholds, highlightVariant };
}
