"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AnalysisPanel,
  type AnalysisTab,
} from "@/components/analysis-panel";
import { EditorPane, type EditorHandle } from "@/components/editor-pane";
import { FixSummary } from "@/components/fix-summary";
import { SubjectField } from "@/components/subject-field";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAiDetection } from "@/hooks/use-ai-detection";
import { useAnalysis } from "@/hooks/use-analysis";
import { useCapture } from "@/hooks/use-capture";
import { useDeliverability } from "@/hooks/use-deliverability";
import { useExperiments } from "@/hooks/use-experiments";
import { useFix } from "@/hooks/use-fix";
import { useHouseStyle } from "@/hooks/use-house-style";
import { useStoredString } from "@/hooks/use-stored-string";
import { formatCount, formatDecimal, formatDuration } from "@/lib/format";
import type { Sentence } from "@/lib/readability";

const DRAFT_STORAGE_KEY = "copy-master:draft";
const SUBJECT_STORAGE_KEY = "copy-master:subject";

type MobileView = "write" | "analyse";

/** Maps a deliverability band onto the shared band colours. */
const DELIVERABILITY_TONE = {
  inbox: "great",
  good: "good",
  risky: "ok",
  spam: "poor",
} as const;

export function Dashboard() {
  const reduceMotion = useReducedMotion();

  /** Draft and subject are kept in localStorage, so a reload loses nothing. */
  const [text, setText] = useStoredString(DRAFT_STORAGE_KEY);
  const [subject, setSubject] = useStoredString(SUBJECT_STORAGE_KEY);
  const [showHighlights, setShowHighlights] = useState(true);
  const [activeSentenceId, setActiveSentenceId] = useState<number | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>("write");
  const [analysisTab, setAnalysisTab] = useState<AnalysisTab>("readability");

  const editorRef = useRef<EditorHandle | null>(null);

  /* Variant first: the highlighting thresholds it chooses feed the analysis. */
  const { visitorId, assignments, thresholds } = useExperiments();
  const { analysis, segments, analyzedText } = useAnalysis(text, thresholds);
  /* Deliverability reads the subject too, where triggers count for more. */
  const deliverability = useDeliverability(subject, text);
  /* All of these share the same deferred pass, so they stay in step. */
  const aiDetection = useAiDetection(text);
  /* Hard rules, scored separately because they are pass/fail. */
  const houseStyle = useHouseStyle(subject, text);
  const { track, startNewDocument } = useCapture({
    visitorId,
    assignments,
    analysis,
    deliverability,
    subject,
    text,
  });

  const fixer = useFix({
    subject,
    body: text,
    analysis,
    deliverability,
    aiDetection,
    apply: ({ subject: nextSubject, body: nextBody }) => {
      setSubject(nextSubject);
      setText(nextBody);
      setActiveSentenceId(null);
    },
    onFixed: ({ changes, model }) =>
      track("claude_fix_applied", {
        changes,
        model,
        gradeBefore: Math.round(analysis.grade),
        deliverabilityBefore: deliverability.score,
      }),
  });

  /*
   * Emptying the editor by hand starts a new document, which is what the
   * Clear button used to do. Without it the next draft's revisions would be
   * grouped with the previous one's in the capture data.
   */
  const handleTextChange = (next: string) => {
    if (next.trim().length === 0 && text.trim().length > 0) {
      startNewDocument();
    }
    setText(next);
  };

  const handleSelectSentence = (sentence: Sentence) => {
    setActiveSentenceId(sentence.id);
    setMobileView("write");
    track("sentence_opened", {
      difficulty: sentence.difficulty,
      words: sentence.wordCount,
      grade: Math.round(sentence.grade),
    });
    // Let the editor become visible on small screens before selecting inside it.
    requestAnimationFrame(() => editorRef.current?.revealSentence(sentence));
  };

  const readingTime = formatDuration(analysis.readingTimeSeconds);

  /** Everything worth the writer's attention, across every check. */
  const totalFlags =
    analysis.hardCount +
    analysis.veryHardCount +
    deliverability.hits.length +
    houseStyle.violations;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* ---------------------------------------------------------------- */}
      {/* Header                                                           */}
      {/* ---------------------------------------------------------------- */}
      <header className="z-20 flex shrink-0 items-center justify-between gap-3 border-b border-edge bg-surface/80 px-3 py-2.5 backdrop-blur-sm sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.5rem] bg-ink text-[0.8125rem] font-bold text-surface"
          >
            C
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[0.9375rem] leading-tight font-semibold tracking-tight">
              Copy Master
            </span>
            <span className="block truncate text-[0.6875rem] leading-tight text-ink-faint">
              Readability &amp; deliverability
            </span>
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {fixer.status !== "unavailable" && (
            <button
              type="button"
              onClick={fixer.fix}
              disabled={
                fixer.status === "working" ||
                (text.trim().length === 0 && subject.trim().length === 0)
              }
              className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[0.8125rem] font-semibold text-surface transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {fixer.status === "working" ? (
                <>
                  <Spinner />
                  <span>Fixing</span>
                </>
              ) : (
                <>
                  <SparkleIcon />
                  <span>
                    Fix<span className="hidden sm:inline"> with Claude</span>
                  </span>
                </>
              )}
            </button>
          )}

          <HeaderButton
            onClick={() => {
              setShowHighlights((value) => !value);
              track("highlights_toggled", { on: !showHighlights });
            }}
            aria-pressed={showHighlights}
            active={showHighlights}
            title="Toggle sentence highlighting in the editor"
          >
            <HighlightIcon />
            <span className="hidden sm:inline">Highlights</span>
          </HeaderButton>

          <Link
            href="/review"
            title="Drafts the outreach agents wrote, before and after"
            className="flex h-8 items-center rounded-lg border border-edge px-2.5 text-[0.8125rem] font-medium text-ink-soft transition-colors hover:border-edge-strong hover:text-ink"
          >
            Review
          </Link>

          <ThemeToggle />
        </div>
      </header>

      {/* ---------------------------------------------------------------- */}
      {/* Mobile view switch                                               */}
      {/* ---------------------------------------------------------------- */}
      <div className="z-10 flex shrink-0 gap-1 border-b border-edge bg-surface px-3 py-2 lg:hidden">
        {(["write", "analyse"] as const).map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => {
              setMobileView(view);
              track("view_changed", { view });
            }}
            aria-current={mobileView === view}
            className="relative flex-1 rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium capitalize"
          >
            {mobileView === view && (
              <motion.span
                layoutId="mobile-tab"
                className="absolute inset-0 rounded-lg bg-canvas ring-1 ring-edge"
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 420, damping: 36 }
                }
              />
            )}
            <span
              className={`relative ${
                mobileView === view ? "text-ink" : "text-ink-faint"
              }`}
            >
              {view === "write" ? "Write" : "Analyse"}
              {view === "analyse" && totalFlags > 0 && (
                <span className="nums ml-1.5 rounded-full bg-band-poor/15 px-1.5 py-0.5 text-[0.625rem] font-semibold text-band-poor">
                  {totalFlags}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Split screen                                                     */}
      {/* ---------------------------------------------------------------- */}
      <main className="flex min-h-0 flex-1 overflow-hidden">
        <section
          aria-label="Editor"
          className={`relative min-w-0 flex-1 flex-col bg-paper ${
            mobileView === "analyse" ? "hidden lg:flex" : "flex"
          }`}
        >
          <SubjectField value={subject} onChange={setSubject} />
          <div className="min-h-0 flex-1">
            <EditorPane
              handleRef={editorRef}
              value={text}
              onChange={handleTextChange}
              segments={segments}
              analyzedText={analyzedText}
              showHighlights={showHighlights}
              activeSentenceId={activeSentenceId}
              onActiveSentenceChange={setActiveSentenceId}
            />
          </div>

          <FixSummary
            result={fixer.result}
            error={fixer.error}
            onUndo={fixer.undo}
            onDismiss={fixer.dismiss}
          />
        </section>

        <aside
          aria-label="Analysis"
          className={`scroll-slim w-full shrink-0 overflow-y-auto border-edge bg-canvas lg:block lg:w-[25rem] lg:border-l xl:w-[27rem] ${
            mobileView === "write" ? "hidden" : "block"
          }`}
        >
          <AnalysisPanel
            tab={analysisTab}
            onTabChange={(next) => {
              setAnalysisTab(next);
              track("analysis_tab_changed", { tab: next });
            }}
            analysis={analysis}
            deliverability={deliverability}
            aiDetection={aiDetection}
            houseStyle={houseStyle}
            activeSentenceId={activeSentenceId}
            onSelectSentence={handleSelectSentence}
            onHoverSentence={setActiveSentenceId}
          />
        </aside>
      </main>

      {/* ---------------------------------------------------------------- */}
      {/* Mobile summary strip: keeps the numbers in sight while writing    */}
      {/* ---------------------------------------------------------------- */}
      <AnimatePresence>
        {mobileView === "write" && !(analysis.isEmpty && deliverability.isEmpty) && (
          <motion.div
            initial={reduceMotion ? false : { y: 40 }}
            animate={{ y: 0 }}
            exit={reduceMotion ? undefined : { y: 40 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="z-20 flex shrink-0 items-center justify-between gap-3 border-t border-edge bg-surface px-4 py-2 lg:hidden"
          >
            <MiniStat
              label="Grade"
              value={analysis.isEmpty ? "--" : formatDecimal(analysis.grade)}
              tone={analysis.isEmpty ? undefined : analysis.gradeBand.key}
            />
            <MiniStat
              label="Inbox"
              value={
                deliverability.isEmpty ? "--" : String(deliverability.score)
              }
              tone={
                deliverability.isEmpty
                  ? undefined
                  : DELIVERABILITY_TONE[deliverability.band.key]
              }
            />
            <MiniStat label="Words" value={formatCount(analysis.words)} />
            <MiniStat
              label="Read"
              value={`${readingTime.value} ${readingTime.unit}`}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Small pieces                                                               */
/* -------------------------------------------------------------------------- */

function HeaderButton({
  children,
  active,
  ...props
}: React.ComponentPropsWithoutRef<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[0.8125rem] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-accent bg-accent-soft text-accent"
          : "border-edge text-ink-soft hover:border-edge-strong hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "great" | "good" | "ok" | "poor";
}) {
  const color = tone ? `var(--band-${tone})` : undefined;
  return (
    <span className="flex min-w-0 flex-col">
      <span className="text-[0.625rem] tracking-[0.08em] text-ink-faint uppercase">
        {label}
      </span>
      <span
        className="nums truncate text-[0.8125rem] font-semibold"
        style={{ color }}
      >
        {value}
      </span>
    </span>
  );
}

function Spinner() {
  return (
    <motion.span
      aria-hidden="true"
      animate={{ rotate: 360 }}
      transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
      className="block h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent"
    />
  );
}

function SparkleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2.5 13.8 8 19.5 9.8 13.8 11.6 12 17.2 10.2 11.6 4.5 9.8 10.2 8Z" />
      <path d="M18.5 14.5 19.4 17.1 22 18 19.4 18.9 18.5 21.5 17.6 18.9 15 18 17.6 17.1Z" />
    </svg>
  );
}

function HighlightIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 20h16" />
      <path d="m9 15 7.5-7.5a2.1 2.1 0 0 1 3 3L12 18H8v-4Z" />
    </svg>
  );
}
