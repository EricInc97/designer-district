"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ScoreRing } from "@/components/score-ring";
import { pluralize } from "@/lib/format";
import {
  CATEGORY_ADVICE,
  CATEGORY_LABEL,
  type Check,
  type DeliverabilityReport,
  type SpamCategory,
  type SpamHit,
} from "@/lib/deliverability";

const BAND_COLOR: Record<DeliverabilityReport["band"]["key"], string> = {
  inbox: "var(--band-great)",
  good: "var(--band-good)",
  risky: "var(--band-ok)",
  spam: "var(--band-poor)",
};

/** Tag colouring tracks severity, so the eye sorts them without reading. */
const SEVERITY_COLOR: Record<SpamHit["severity"], string> = {
  1: "var(--ink-soft)",
  2: "var(--band-ok)",
  3: "var(--band-poor)",
};

const MAX_TAGS = 18;

interface DeliverabilityPaneProps {
  report: DeliverabilityReport;
}

export function DeliverabilityPane({ report }: DeliverabilityPaneProps) {
  const reduceMotion = useReducedMotion();
  const color = BAND_COLOR[report.band.key];

  const shown = report.hits.slice(0, MAX_TAGS);
  const categories = [...new Set(report.hits.map((hit) => hit.category))];

  const spring = reduceMotion
    ? { duration: 0 }
    : ({ type: "spring", stiffness: 500, damping: 36 } as const);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      {/* ---------------------------------------------------------------- */}
      {/* Score                                                            */}
      {/* ---------------------------------------------------------------- */}
      <section
        aria-label="Deliverability score"
        className="rounded-2xl border border-edge bg-surface p-5 shadow-[var(--shadow-panel)]"
      >
        <div className="flex items-center gap-4">
          <ScoreRing
            score={report.score}
            color={color}
            isEmpty={report.isEmpty}
          />

          <div className="min-w-0 flex-1">
            <h2 className="text-[0.6875rem] font-semibold tracking-[0.1em] text-ink-faint uppercase">
              Deliverability
            </h2>

            <motion.p
              key={report.isEmpty ? "empty" : report.band.key}
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="mt-1 text-base font-semibold"
              style={{ color: report.isEmpty ? "var(--ink-faint)" : color }}
            >
              {report.isEmpty ? "Nothing to check" : report.band.label}
            </motion.p>

            <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-soft">
              {report.isEmpty
                ? "Write a subject line and some copy."
                : report.band.note}
            </p>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Warning tags                                                     */}
      {/* ---------------------------------------------------------------- */}
      <section
        aria-label="Spam trigger phrases"
        className="rounded-2xl border border-edge bg-surface p-5 shadow-[var(--shadow-panel)]"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[0.6875rem] font-semibold tracking-[0.1em] text-ink-faint uppercase">
            Trigger phrases
          </h2>
          {!report.isEmpty && (
            <span className="nums text-[0.6875rem] text-ink-faint">
              {report.hits.length} found
            </span>
          )}
        </div>

        {report.isEmpty ? (
          <p className="mt-3 text-[0.8125rem] text-ink-faint">
            Nothing scanned yet.
          </p>
        ) : report.hits.length === 0 ? (
          <motion.p
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 text-[0.8125rem] leading-relaxed text-ink-soft"
          >
            Clean. No spam trigger phrases in the subject or body.
          </motion.p>
        ) : (
          <>
            <motion.ul layout className="mt-3 flex flex-wrap gap-1.5">
              <AnimatePresence initial={false} mode="popLayout">
                {shown.map((hit) => (
                  <motion.li
                    key={hit.phrase}
                    layout
                    initial={
                      reduceMotion ? false : { opacity: 0, scale: 0.8, y: -4 }
                    }
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={
                      reduceMotion ? undefined : { opacity: 0, scale: 0.8 }
                    }
                    transition={spring}
                  >
                    <TriggerTag hit={hit} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </motion.ul>

            {report.hits.length > shown.length && (
              <p className="nums mt-2.5 text-[0.6875rem] text-ink-faint">
                + {report.hits.length - shown.length} more
              </p>
            )}

            {/* Why each kind of phrase matters. */}
            <ul className="mt-4 flex flex-col gap-2 border-t border-edge pt-3">
              {categories.map((category) => (
                <li key={category} className="flex gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-[0.4rem] h-1.5 w-1.5 shrink-0 rounded-full bg-ink-faint"
                  />
                  <span className="text-[0.75rem] leading-relaxed text-ink-soft">
                    <span className="font-semibold text-ink">
                      {CATEGORY_LABEL[category as SpamCategory]}.
                    </span>{" "}
                    {CATEGORY_ADVICE[category as SpamCategory]}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Checklist                                                        */}
      {/* ---------------------------------------------------------------- */}
      <section
        aria-label="Deliverability checklist"
        className="rounded-2xl border border-edge bg-surface p-5 shadow-[var(--shadow-panel)]"
      >
        <h2 className="text-[0.6875rem] font-semibold tracking-[0.1em] text-ink-faint uppercase">
          Checklist
        </h2>

        {report.isEmpty ? (
          <p className="mt-3 text-[0.8125rem] text-ink-faint">
            The checks run once there is something to read.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-edge">
            {report.checks.map((check) => (
              <ChecklistRow key={check.id} check={check} />
            ))}
          </ul>
        )}
      </section>

      <p className="px-1 pb-2 text-[0.6875rem] leading-relaxed text-ink-faint">
        A content check only. Real filters also weigh domain reputation, SPF and
        DKIM alignment, list hygiene and how people have engaged with your past
        messages, none of which are visible from the copy.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                     */
/* -------------------------------------------------------------------------- */

function TriggerTag({ hit }: { hit: SpamHit }) {
  const color = SEVERITY_COLOR[hit.severity];

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full py-1 pr-2 pl-2.5 text-[0.75rem] font-medium"
      style={{
        color,
        backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 35%, transparent)`,
      }}
      title={`${CATEGORY_LABEL[hit.category]} — ${CATEGORY_ADVICE[hit.category]}`}
    >
      {hit.phrase}
      {hit.count > 1 && (
        <span className="nums rounded-full bg-[color-mix(in_srgb,currentColor_18%,transparent)] px-1.5 text-[0.625rem]">
          {hit.count}
        </span>
      )}
      {hit.inSubject && (
        <span
          className="text-[0.5625rem] tracking-[0.06em] uppercase opacity-70"
          title="Appears in the subject line, where it counts for more"
        >
          subj
        </span>
      )}
    </span>
  );
}

function ChecklistRow({ check }: { check: Check }) {
  return (
    <li className="flex items-start gap-2.5 py-2.5">
      <StatusIcon status={check.status} />
      <span className="min-w-0 flex-1">
        <span className="block text-[0.8125rem] font-medium text-ink">
          {check.label}
        </span>
        <span className="mt-0.5 block text-[0.75rem] leading-relaxed text-ink-soft">
          {check.detail}
        </span>
      </span>
    </li>
  );
}

function StatusIcon({ status }: { status: Check["status"] }) {
  const color =
    status === "pass"
      ? "var(--band-great)"
      : status === "warn"
        ? "var(--band-ok)"
        : "var(--band-poor)";

  return (
    <motion.span
      key={status}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 520, damping: 30 }}
      aria-hidden="true"
      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
      style={{
        color,
        backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
      }}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {status === "pass" ? (
          <path d="M20 6 9 17l-5-5" />
        ) : status === "warn" ? (
          <path d="M12 7v7M12 17.5v.5" />
        ) : (
          <path d="M18 6 6 18M6 6l12 12" />
        )}
      </svg>
    </motion.span>
  );
}

/** Exported for the mobile summary strip. */
export function deliverabilitySummary(report: DeliverabilityReport): string {
  if (report.isEmpty) return "--";
  const count = report.hits.length;
  return `${count} ${pluralize(count, "flag")}`;
}
