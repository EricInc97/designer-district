"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useAnimatedNumber } from "@/hooks/use-animated-number";
import { formatDecimal, ordinal } from "@/lib/format";
import type { GradeBand } from "@/lib/readability";

/** Where each band ends on the scale, and how much track it gets. */
const BANDS = [
  { key: "great", span: 6, color: "var(--band-great)" },
  { key: "good", span: 3, color: "var(--band-good)" },
  { key: "ok", span: 3, color: "var(--band-ok)" },
  { key: "poor", span: 6, color: "var(--band-poor)" },
] as const;

const SCALE_MIN = 1;
const SCALE_MAX = 18;

const BAND_COLOR: Record<GradeBand["key"], string> = {
  great: "var(--band-great)",
  good: "var(--band-good)",
  ok: "var(--band-ok)",
  poor: "var(--band-poor)",
};

interface GradeMeterProps {
  grade: number;
  band: GradeBand;
  isEmpty: boolean;
}

export function GradeMeter({ grade, band, isEmpty }: GradeMeterProps) {
  const reduceMotion = useReducedMotion();
  const animatedGrade = useAnimatedNumber(isEmpty ? 0 : grade);

  const position = Math.min(
    100,
    Math.max(
      0,
      ((animatedGrade - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100,
    ),
  );

  const color = isEmpty ? "var(--ink-faint)" : BAND_COLOR[band.key];

  return (
    <section
      aria-label="Reading grade level"
      className="rounded-2xl border border-edge bg-surface p-5 shadow-[var(--shadow-panel)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[0.6875rem] font-semibold tracking-[0.1em] text-ink-faint uppercase">
            Reading grade
          </h2>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span
              className="nums text-5xl leading-none font-semibold tracking-tight tabular-nums"
              style={{ color }}
            >
              {isEmpty ? "--" : formatDecimal(animatedGrade)}
            </span>
            {!isEmpty && (
              <span className="text-sm text-ink-soft">
                {ordinal(grade)} grade
              </span>
            )}
          </div>
        </div>

        <motion.span
          key={isEmpty ? "empty" : band.key}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{
            color: isEmpty ? "var(--ink-faint)" : color,
            backgroundColor: isEmpty
              ? "transparent"
              : `color-mix(in srgb, ${color} 14%, transparent)`,
            boxShadow: isEmpty ? "none" : `inset 0 0 0 1px ${color}33`,
          }}
        >
          {isEmpty ? "No text yet" : band.label}
        </motion.span>
      </div>

      {/* Scale */}
      <div className="mt-5">
        <div className="relative">
          <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
            {BANDS.map((b) => (
              <div
                key={b.key}
                style={{
                  flexGrow: b.span,
                  backgroundColor: b.color,
                  opacity: isEmpty ? 0.18 : band.key === b.key ? 1 : 0.26,
                }}
                className="transition-opacity duration-300"
              />
            ))}
          </div>

          {!isEmpty && (
            <motion.div
              className="absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface"
              style={{ backgroundColor: "var(--ink)" }}
              animate={{ left: `${position}%` }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 210, damping: 26 }
              }
            />
          )}
        </div>

        <div className="mt-2 flex justify-between text-[0.6875rem] text-ink-faint">
          <span>Easy</span>
          <span className="nums">grade 9 target</span>
          <span>Dense</span>
        </div>
      </div>

      <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-soft">
        {isEmpty
          ? "Start typing and the grade appears here."
          : band.note}
      </p>
    </section>
  );
}
