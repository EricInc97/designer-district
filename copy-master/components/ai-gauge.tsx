"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useAnimatedNumber } from "@/hooks/use-animated-number";

/*
 * A 180-degree gauge: human on the left, machine on the right.
 *
 * Drawn as two arcs on one path geometry — a muted track underneath and a
 * gradient-stroked arc on top revealed by `strokeDashoffset` — plus a needle
 * that springs to the angle. One shared `ARC_LENGTH` keeps the two in step.
 */

const WIDTH = 260;
const HEIGHT = 142;
const CX = WIDTH / 2;
const CY = 124;
const RADIUS = 100;
const STROKE = 14;

/** Half a circle, which is how much of the dash array the value maps onto. */
const ARC_LENGTH = Math.PI * RADIUS;

/** Semicircular arc path from 180deg (left) to 0deg (right). */
const ARC = `M ${CX - RADIUS} ${CY} A ${RADIUS} ${RADIUS} 0 0 1 ${CX + RADIUS} ${CY}`;

interface AiGaugeProps {
  /** 0-100, where 100 is maximally machine-like. */
  score: number;
  color: string;
  /** Withhold the reading: not enough text to say anything. */
  muted: boolean;
}

export function AiGauge({ score, color, muted }: AiGaugeProps) {
  const reduceMotion = useReducedMotion();
  const animated = useAnimatedNumber(muted ? 0 : score);

  const value = muted ? 0 : score;
  const offset = ARC_LENGTH * (1 - value / 100);
  // -90deg at a score of 0, +90deg at 100.
  const angle = -90 + (value / 100) * 180;

  return (
    <div className="relative mx-auto" style={{ width: WIDTH, height: HEIGHT }}>
      <svg
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={
          muted
            ? "Not enough text for an AI reading"
            : `Reads ${score} percent machine-written`
        }
      >
        <defs>
          <linearGradient id="ai-gauge-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--band-great)" />
            <stop offset="45%" stopColor="var(--band-good)" />
            <stop offset="72%" stopColor="var(--band-ok)" />
            <stop offset="100%" stopColor="var(--band-poor)" />
          </linearGradient>
        </defs>

        {/* Track */}
        <path
          d={ARC}
          fill="none"
          stroke="var(--border)"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />

        {/* Value */}
        <motion.path
          d={ARC}
          fill="none"
          stroke={muted ? "var(--border)" : "url(#ai-gauge-gradient)"}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={ARC_LENGTH}
          initial={{ strokeDashoffset: ARC_LENGTH }}
          animate={{ strokeDashoffset: offset }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 140, damping: 26 }
          }
        />

        {/* Needle */}
        <motion.g
          initial={{ rotate: -90 }}
          animate={{ rotate: angle }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 120, damping: 18 }
          }
          style={{ originX: `${CX}px`, originY: `${CY}px` }}
        >
          <line
            x1={CX}
            y1={CY}
            x2={CX}
            y2={CY - RADIUS + STROKE + 6}
            stroke={muted ? "var(--ink-faint)" : "var(--ink)"}
            strokeWidth="3"
            strokeLinecap="round"
          />
        </motion.g>

        <circle
          cx={CX}
          cy={CY}
          r="7"
          fill="var(--surface)"
          stroke={muted ? "var(--ink-faint)" : "var(--ink)"}
          strokeWidth="3"
        />
      </svg>

      {/* Readout, sitting inside the arc */}
      <div className="pointer-events-none absolute inset-x-0 bottom-5 flex flex-col items-center">
        <span
          className="nums text-3xl leading-none font-semibold tracking-tight"
          style={{ color: muted ? "var(--ink-faint)" : color }}
        >
          {muted ? "--" : `${Math.round(animated)}%`}
        </span>
      </div>

      <span className="absolute bottom-0 left-1 text-[0.625rem] tracking-[0.08em] text-ink-faint uppercase">
        Human
      </span>
      <span className="absolute right-1 bottom-0 text-[0.625rem] tracking-[0.08em] text-ink-faint uppercase">
        Machine
      </span>
    </div>
  );
}
