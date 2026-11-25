"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { AnalysisPanel, type AnalysisTab } from "@/components/analysis-panel";
import { ReadOnlyCopy } from "@/components/read-only-copy";
import { detectAi } from "@/lib/ai-detection";
import { checkDeliverability } from "@/lib/deliverability";
import { checkHouseStyle } from "@/lib/house-style";
import { analyze, buildHighlightSegments } from "@/lib/readability";

/**
 * One stored draft, reviewed exactly as a draft in the editor is.
 *
 * The scores are not read back from the database: the stored copy is run
 * through the same four engines the dashboard uses, so this page can show the
 * whole breakdown -- every hard sentence, every trigger phrase, every signal
 * -- rather than the handful of numbers that were worth storing.
 *
 * That also means an engine improvement shows up here on old drafts, which is
 * the point: this is a review of the copy, not a receipt of what some earlier
 * version of the scorer thought of it.
 */

export interface DraftVersion {
  iteration: number;
  subject: string;
  body: string;
  created_at: string;
  passes: boolean;
  problems: string[];
}

interface DraftReviewProps {
  company: string;
  leadRef: string;
  stage: string;
  stageLabel: string;
  runId: string;
  versions: DraftVersion[];
  /** The sentence-length rule the agent was working to, so marks match. */
  minWordsToFlag: number;
  /** Only the first email in a sequence carries a subject. */
  subjectExpected: boolean;
}

export function DraftReview({
  company,
  leadRef,
  stage,
  stageLabel,
  runId,
  versions,
  minWordsToFlag,
  subjectExpected,
}: DraftReviewProps) {
  const reduceMotion = useReducedMotion();

  /* The last iteration is what actually went out, so it opens on that. */
  const [selected, setSelected] = useState(versions.length - 1);
  const [activeSentenceId, setActiveSentenceId] = useState<number | null>(null);
  const [tab, setTab] = useState<AnalysisTab>("readability");

  const version = versions[selected] ?? versions[versions.length - 1];

  const { analysis, segments, deliverability, aiDetection, houseStyle } =
    useMemo(() => {
      const next = analyze(version.body, {
        minWordsToFlag,
        hardGrade: 10,
        veryHardGrade: 14,
      });

      return {
        analysis: next,
        segments: buildHighlightSegments(version.body, next.sentences),
        deliverability: checkDeliverability(version.subject, version.body, {
          expectSubject: subjectExpected,
        }),
        aiDetection: detectAi(version.body),
        houseStyle: checkHouseStyle(version.subject, version.body),
      };
    }, [version.body, version.subject, minWordsToFlag, subjectExpected]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* ---------------------------------------------------------------- */}
      {/* Header                                                           */}
      {/* ---------------------------------------------------------------- */}
      <header className="z-20 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-edge bg-surface/80 px-3 py-2.5 backdrop-blur-sm sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/review"
            aria-label="Back to all drafts"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-edge text-ink-soft transition-colors hover:border-edge-strong hover:text-ink"
          >
            <BackIcon />
          </Link>
          <span className="min-w-0">
            <span className="block truncate text-[0.9375rem] leading-tight font-semibold tracking-tight">
              {company || leadRef}
            </span>
            <span className="nums block truncate text-[0.6875rem] leading-tight text-ink-faint">
              {stageLabel} &middot; run {runId} &middot;{" "}
              {/*
                The server and the browser are in different time zones, so
                this text legitimately differs between them. Suppressing the
                check is the sanctioned fix for a timestamp: the browser's
                value wins after hydration, which is the one worth showing.
              */}
              <span suppressHydrationWarning>
                {new Date(version.created_at).toLocaleString()}
              </span>
            </span>
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className="rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold"
            style={{
              color: version.passes ? "var(--band-great)" : "var(--band-ok)",
              backgroundColor: `color-mix(in srgb, ${
                version.passes ? "var(--band-great)" : "var(--band-ok)"
              } 14%, transparent)`,
            }}
          >
            {version.passes ? "Passed" : "Still flagged"}
          </span>
        </div>
      </header>

      {/* ---------------------------------------------------------------- */}
      {/* Version switch: only when there is more than one                 */}
      {/* ---------------------------------------------------------------- */}
      {versions.length > 1 && (
        <div className="z-10 flex shrink-0 items-center gap-2 overflow-x-auto border-b border-edge bg-surface px-3 py-2 sm:px-4">
          <span className="shrink-0 text-[0.625rem] font-semibold tracking-[0.1em] text-ink-faint uppercase">
            Pass
          </span>
          {versions.map((item, index) => {
            const isActive = index === selected;
            const isFirst = index === 0;
            const isLast = index === versions.length - 1;

            return (
              <button
                key={item.iteration}
                type="button"
                onClick={() => {
                  setSelected(index);
                  setActiveSentenceId(null);
                }}
                aria-current={isActive}
                className="relative shrink-0 rounded-lg px-2.5 py-1 text-[0.75rem] font-medium"
              >
                {isActive && (
                  <motion.span
                    layoutId="version-tab"
                    className="absolute inset-0 rounded-lg bg-canvas ring-1 ring-edge"
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 420, damping: 36 }
                    }
                  />
                )}
                <span
                  className={`nums relative ${
                    isActive ? "text-ink" : "text-ink-faint"
                  }`}
                >
                  {item.iteration}
                  {isFirst && (
                    <span className="ml-1 text-[0.625rem]">first</span>
                  )}
                  {isLast && !isFirst && (
                    <span className="ml-1 text-[0.625rem]">final</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Split screen, same shape as the editor                           */}
      {/* ---------------------------------------------------------------- */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <section
          aria-label="Draft"
          className="min-h-0 min-w-0 flex-1 overflow-hidden"
        >
          <ReadOnlyCopy
            subject={version.subject}
            subjectExpected={subjectExpected}
            segments={segments}
            activeSentenceId={activeSentenceId}
            onSelectSentence={setActiveSentenceId}
          />
        </section>

        <aside
          aria-label="Analysis"
          className="scroll-slim w-full shrink-0 overflow-y-auto border-edge bg-canvas lg:w-[25rem] lg:border-l xl:w-[27rem]"
        >
          <AnalysisPanel
            tab={tab}
            onTabChange={setTab}
            analysis={analysis}
            deliverability={deliverability}
            aiDetection={aiDetection}
            houseStyle={houseStyle}
            activeSentenceId={activeSentenceId}
            onSelectSentence={(sentence) => setActiveSentenceId(sentence.id)}
            onHoverSentence={setActiveSentenceId}
          />

          {/*
            What the agent was told at the time. The analyses above are live;
            this is the historical record, and the two can disagree if the
            scorer has changed since.
          */}
          {version.problems.length > 0 && (
            <section className="border-t border-edge px-3.5 py-3.5">
              <h2 className="text-[0.625rem] font-semibold tracking-[0.1em] text-ink-faint uppercase">
                Reported to the agent on pass {version.iteration}
              </h2>
              <ul className="mt-2 flex flex-col gap-1.5">
                {version.problems.map((problem, index) => (
                  <li
                    key={index}
                    className="flex gap-2 text-[0.75rem] leading-relaxed text-ink-soft"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-band-poor"
                    />
                    <span>{problem}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="border-t border-edge px-3.5 py-3 text-[0.6875rem] leading-relaxed text-ink-faint">
            Scored live from the stored copy, with the {minWordsToFlag}-word
            sentence rule this {stage.startsWith("email") ? "email" : "follow-up"}{" "}
            was written to.
          </p>
        </aside>
      </main>
    </div>
  );
}

function BackIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}
