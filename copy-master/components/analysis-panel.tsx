"use client";

import { motion, useReducedMotion } from "framer-motion";
import { AiDetectionPane } from "@/components/ai-detection-pane";
import { DeliverabilityPane } from "@/components/deliverability-pane";
import { HouseStyleNotice } from "@/components/house-style-notice";
import { ReadabilityPane } from "@/components/readability-pane";
import type { AiDetectionReport } from "@/lib/ai-detection";
import type { DeliverabilityReport } from "@/lib/deliverability";
import type { HouseStyleReport } from "@/lib/house-style";
import type { Analysis, Sentence } from "@/lib/readability";

export type AnalysisTab = "readability" | "deliverability" | "ai";

export const ANALYSIS_TABS: Array<{ id: AnalysisTab; label: string }> = [
  { id: "readability", label: "Readability" },
  { id: "deliverability", label: "Deliverability" },
  { id: "ai", label: "AI" },
];

interface AnalysisPanelProps {
  tab: AnalysisTab;
  onTabChange: (tab: AnalysisTab) => void;
  analysis: Analysis;
  deliverability: DeliverabilityReport;
  aiDetection: AiDetectionReport;
  houseStyle: HouseStyleReport;
  activeSentenceId: number | null;
  onSelectSentence: (sentence: Sentence) => void;
  onHoverSentence: (id: number | null) => void;
}

/**
 * The right-hand panel: a tab bar pinned to the top, one metric below it.
 *
 * The bar is sticky rather than scrolling away with the content, because the
 * counts on the tabs are part of the readout — you should be able to see that
 * there are four spam flags without first switching to that tab.
 */
export function AnalysisPanel({
  tab,
  onTabChange,
  analysis,
  deliverability,
  aiDetection,
  houseStyle,
  activeSentenceId,
  onSelectSentence,
  onHoverSentence,
}: AnalysisPanelProps) {
  const reduceMotion = useReducedMotion();

  /** A badge is a count of things to act on, so the AI tab shows none. */
  const counts: Record<AnalysisTab, number> = {
    readability: analysis.hardCount + analysis.veryHardCount,
    deliverability: deliverability.hits.length,
    ai: 0,
  };

  const tone: Record<AnalysisTab, string> = {
    readability: "var(--band-poor)",
    deliverability:
      deliverability.band.key === "spam" || deliverability.band.key === "risky"
        ? "var(--band-poor)"
        : "var(--band-ok)",
    ai: "var(--band-ok)",
  };

  return (
    <div className="flex min-h-full flex-col">
      <div
        role="tablist"
        aria-label="Analysis"
        className="sticky top-0 z-10 flex shrink-0 gap-1 border-b border-edge bg-canvas/85 px-2 py-2 backdrop-blur-sm"
      >
        {ANALYSIS_TABS.map(({ id, label }) => {
          const isActive = tab === id;
          const count = counts[id];

          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(id)}
              className={`relative min-w-0 rounded-lg px-2 py-1.5 text-[0.75rem] font-medium ${
                id === "ai" ? "shrink-0" : "flex-1"
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="analysis-tab"
                  className="absolute inset-0 rounded-lg bg-surface shadow-[var(--shadow-panel)] ring-1 ring-edge"
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 420, damping: 36 }
                  }
                />
              )}
              <span
                className={`relative flex items-center justify-center gap-1 ${
                  isActive ? "text-ink" : "text-ink-faint"
                }`}
              >
                <span className="truncate">{label}</span>
                {count > 0 && (
                  <span
                    className="nums shrink-0 rounded-full px-1.5 py-0.5 text-[0.625rem] font-semibold"
                    style={{
                      color: tone[id],
                      backgroundColor: `color-mix(in srgb, ${tone[id]} 14%, transparent)`,
                    }}
                  >
                    {count}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* A broken rule stays visible whichever tab you are on. */}
      <HouseStyleNotice report={houseStyle} />

      {/*
        Keyed on the tab so the incoming panel animates in, with no exit
        animation and no absolute positioning. Both of those would take the
        content out of flow, and this container is what gives the surrounding
        <aside> its scroll height.
      */}
      <motion.div
        key={tab}
        initial={reduceMotion ? false : { opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="flex-1"
      >
        {tab === "readability" ? (
          <ReadabilityPane
            analysis={analysis}
            activeSentenceId={activeSentenceId}
            onSelectSentence={onSelectSentence}
            onHoverSentence={onHoverSentence}
          />
        ) : tab === "deliverability" ? (
          <DeliverabilityPane report={deliverability} />
        ) : (
          <AiDetectionPane report={aiDetection} />
        )}
      </motion.div>
    </div>
  );
}
