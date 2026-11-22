"use client";

import { motion, useReducedMotion } from "framer-motion";
import { AiGauge } from "@/components/ai-gauge";
import {
  MIN_WORDS_FOR_SCORE,
  type AiDetectionReport,
  type Signal,
} from "@/lib/ai-detection";

const BAND_COLOR: Record<AiDetectionReport["band"]["key"], string> = {
  human: "var(--band-great)",
  mixed: "var(--band-good)",
  likely: "var(--band-ok)",
  machine: "var(--band-poor)",
};

interface AiDetectionPaneProps {
  report: AiDetectionReport;
}

export function AiDetectionPane({ report }: AiDetectionPaneProps) {
  const reduceMotion = useReducedMotion();
  const muted = report.isEmpty || report.tooShort;
  const color = BAND_COLOR[report.band.key];

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      {/* ---------------------------------------------------------------- */}
      {/* Gauge                                                            */}
      {/* ---------------------------------------------------------------- */}
      <section
        aria-label="AI detection score"
        className="rounded-2xl border border-edge bg-surface p-5 shadow-[var(--shadow-panel)]"
      >
        <h2 className="text-[0.6875rem] font-semibold tracking-[0.1em] text-ink-faint uppercase">
          How machine-written it reads
        </h2>

        <div className="mt-2">
          <AiGauge score={report.score} color={color} muted={muted} />
        </div>

        <motion.p
          key={muted ? "muted" : report.band.key}
          initial={reduceMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="mt-2 text-center text-base font-semibold"
          style={{ color: muted ? "var(--ink-faint)" : color }}
        >
          {report.isEmpty
            ? "Nothing to read yet"
            : report.tooShort
              ? "Not enough text"
              : report.band.label}
        </motion.p>

        <p className="mt-1 text-center text-[0.8125rem] leading-relaxed text-ink-soft">
          {report.isEmpty
            ? "Paste some copy to see how it reads."
            : report.tooShort
              ? `Needs about ${MIN_WORDS_FOR_SCORE} words and four sentences before the signals mean anything.`
              : report.band.note}
        </p>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Signals                                                          */}
      {/* ---------------------------------------------------------------- */}
      <section
        aria-label="Detection signals"
        className="rounded-2xl border border-edge bg-surface p-5 shadow-[var(--shadow-panel)]"
      >
        <h2 className="text-[0.6875rem] font-semibold tracking-[0.1em] text-ink-faint uppercase">
          Signals
        </h2>

        {muted ? (
          <p className="mt-3 text-[0.8125rem] text-ink-faint">
            The breakdown appears once there is enough text.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {report.signals.map((signal) => (
              <SignalRow key={signal.id} signal={signal} />
            ))}
          </ul>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* The caveat. Not small print.                                     */}
      {/* ---------------------------------------------------------------- */}
      <section className="rounded-2xl border border-edge bg-canvas p-4">
        <p className="text-[0.75rem] leading-relaxed text-ink-soft">
          <span className="font-semibold text-ink">
            This cannot tell you who wrote something.
          </span>{" "}
          It measures style: how even the sentence lengths are, how much stock
          vocabulary is in play, whether anyone used a contraction. Careful
          human writing scores high. Sloppy model output scores low. Treat it
          as a prompt to vary your rhythm, never as evidence about a person.
        </p>
      </section>
    </div>
  );
}

function SignalRow({ signal }: { signal: Signal }) {
  const reduceMotion = useReducedMotion();

  // Green at the human end, red at the machine end.
  const color =
    signal.score < 35
      ? "var(--band-great)"
      : signal.score < 60
        ? "var(--band-ok)"
        : "var(--band-poor)";

  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.8125rem] font-medium text-ink">
          {signal.label}
        </span>
        <span className="nums text-[0.6875rem] font-semibold" style={{ color }}>
          {Math.round(signal.score)}
        </span>
      </div>

      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-canvas">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${signal.score}%` }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 180, damping: 26 }
          }
        />
      </div>

      <p className="mt-1 text-[0.75rem] leading-relaxed text-ink-soft">
        {signal.detail}
      </p>
    </li>
  );
}
