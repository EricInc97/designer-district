"use client";

import { useDeferredValue, useMemo } from "react";
import { checkHouseStyle, type HouseStyleReport } from "@/lib/house-style";

/**
 * House rules for the current subject and body.
 *
 * Deferred along with the other three engines so all four readouts describe
 * the same text rather than drifting a keystroke apart.
 */
export function useHouseStyle(
  subject: string,
  body: string,
): HouseStyleReport {
  const deferredSubject = useDeferredValue(subject);
  const deferredBody = useDeferredValue(body);

  return useMemo(
    () => checkHouseStyle(deferredSubject, deferredBody),
    [deferredSubject, deferredBody],
  );
}
