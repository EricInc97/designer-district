"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useAnimatedNumber } from "@/hooks/use-animated-number";

const SIZE = 92;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface ScoreRingProps {
  /** 0-100. */
  score: number;
  color: string;
  isEmpty: boolean;
}

/**
 * The deliverability score as a ring that fills.
 *
 * The arc is animated through `strokeDashoffset` and the figure counts up
 * alongside it, so a change reads as movement rather than a number swapping
 * out from under you.
 */
export function ScoreRing({ score, color, isEmpty }: ScoreRingProps) {
  const reduceMotion = useReducedMotion();
  const animated = useAnimatedNumber(isEmpty ? 0 : score);
  const offset = CIRCUMFERENCE * (1 - (isEmpty ? 0 : score) / 100);

  return (
    <div
      className="relative shrink-0"
      style={{ width: SIZE, height: SIZE }}
      role="img"
      aria-label={
        isEmpty ? "No deliverability score yet" : `Deliverability ${score} of 100`
      }
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--border)"
          strokeWidth={STROKE}
        />
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={isEmpty ? "var(--border)" : color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          // Start from empty and fill, rather than snapping on first paint.
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: offset }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 160, damping: 28 }
          }
          // 12 o'clock start.
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>

      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="nums text-2xl leading-none font-semibold tracking-tight"
          style={{ color: isEmpty ? "var(--ink-faint)" : color }}
        >
          {isEmpty ? "--" : Math.round(animated)}
        </span>
        <span className="mt-0.5 text-[0.5625rem] tracking-[0.08em] text-ink-faint uppercase">
          / 100
        </span>
      </span>
    </div>
  );
}
