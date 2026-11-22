"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

const DEFAULT_DURATION_MS = 420;

/** Ease-out cubic: quick off the mark, settles gently. */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Tween a number towards its target so counters slide instead of snapping.
 *
 * Driven by `requestAnimationFrame` rather than a motion-library spring: the
 * stats update on every keystroke, and a frame loop we own is both cheaper and
 * easier to reason about than a subscription whose first emission can land
 * before React has mounted the listener.
 *
 * Honours `prefers-reduced-motion` by passing the value straight through.
 */
export function useAnimatedNumber(
  value: number,
  durationMs = DEFAULT_DURATION_MS,
): number {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(value);
  /** Mirrors `display` so a retarget mid-flight starts from where we are. */
  const currentRef = useRef(value);

  useEffect(() => {
    if (reduceMotion) return;

    const from = currentRef.current;
    const to = value;
    if (from === to) return;

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const next = from + (to - from) * easeOut(progress);

      currentRef.current = progress === 1 ? to : next;
      // Called from the frame loop, not synchronously from the effect body.
      setDisplay(currentRef.current);

      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs, reduceMotion]);

  if (reduceMotion) return value;
  return display;
}
