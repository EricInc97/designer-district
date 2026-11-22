"use client";

import { useDeferredValue, useMemo } from "react";
import {
  checkDeliverability,
  type DeliverabilityReport,
} from "@/lib/deliverability";

/**
 * Deliverability for the current subject and body.
 *
 * Deferred for the same reason as the readability analysis: the dictionary
 * scan is one regex pass over the whole document, which is cheap but not free,
 * and it must never be the thing between a keystroke and the caret moving.
 */
export function useDeliverability(
  subject: string,
  body: string,
): DeliverabilityReport {
  const deferredSubject = useDeferredValue(subject);
  const deferredBody = useDeferredValue(body);

  return useMemo(
    () => checkDeliverability(deferredSubject, deferredBody),
    [deferredSubject, deferredBody],
  );
}
