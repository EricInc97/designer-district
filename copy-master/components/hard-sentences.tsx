"use client";

import { formatGrade, pluralize, truncate } from "@/lib/format";
import type { Analysis, Sentence } from "@/lib/readability";

const MAX_LISTED = 12;

interface HardSentencesProps {
  analysis: Analysis;
  activeSentenceId: number | null;
  onSelect: (sentence: Sentence) => void;
  onHover: (id: number | null) => void;
}

export function HardSentences({
  analysis,
  activeSentenceId,
  onSelect,
  onHover,
}: HardSentencesProps) {
  const flagged = analysis.sentences
    .filter((sentence) => sentence.difficulty !== "ok")
    .sort((a, b) => b.grade - a.grade);

  const listed = flagged.slice(0, MAX_LISTED);
  const total = analysis.hardCount + analysis.veryHardCount;

  return (
    <section
      aria-label="Hard to read sentences"
      className="rounded-2xl border border-edge bg-surface p-5 shadow-[var(--shadow-panel)]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[0.6875rem] font-semibold tracking-[0.1em] text-ink-faint uppercase">
          Sentences to look at
        </h2>
        {analysis.sentenceCount > 0 && (
          <span className="nums text-[0.6875rem] text-ink-faint">
            {total} of {analysis.sentenceCount}
          </span>
        )}
      </div>

      {/* Legend doubles as the count readout. */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        <LegendRow
          swatch="mark-hard"
          label="Hard to read"
          count={analysis.hardCount}
        />
        <LegendRow
          swatch="mark-very-hard"
          label="Very hard to read"
          count={analysis.veryHardCount}
        />
      </div>

      {analysis.isEmpty ? (
        <p className="mt-4 text-[0.8125rem] leading-relaxed text-ink-faint">
          Nothing to check yet.
        </p>
      ) : total === 0 ? (
        <p className="mt-4 text-[0.8125rem] leading-relaxed text-ink-soft">
          Every sentence reads clean. Nice work.
        </p>
      ) : (
        <>
          <ul className="mt-4 flex flex-col gap-1.5">
            {listed.map((sentence) => {
              const isActive = sentence.id === activeSentenceId;
              const isVeryHard = sentence.difficulty === "very-hard";

              return (
                <li key={`${sentence.id}-${sentence.start}`}>
                  <button
                    type="button"
                    onClick={() => onSelect(sentence)}
                    onMouseEnter={() => onHover(sentence.id)}
                    onMouseLeave={() => onHover(null)}
                    onFocus={() => onHover(sentence.id)}
                    onBlur={() => onHover(null)}
                    className={`group flex w-full gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors duration-150 ${
                      isActive
                        ? "border-accent bg-accent-soft"
                        : "border-transparent hover:border-edge hover:bg-canvas"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="mt-[0.3rem] h-2 w-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: isVeryHard
                          ? "var(--band-poor)"
                          : "var(--band-ok)",
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-serif text-[0.8125rem] leading-snug text-ink">
                        {truncate(sentence.text)}
                      </span>
                      <span className="nums mt-1 block text-[0.6875rem] text-ink-faint">
                        {sentence.wordCount} words &middot; grade{" "}
                        {formatGrade(sentence.grade)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {flagged.length > listed.length && (
            <p className="nums mt-3 text-[0.6875rem] text-ink-faint">
              + {flagged.length - listed.length} more{" "}
              {pluralize(flagged.length - listed.length, "sentence")} highlighted
              in the editor
            </p>
          )}

          <p className="mt-4 border-t border-edge pt-3 text-[0.6875rem] leading-relaxed text-ink-faint">
            Click one to jump to it and select it in the editor.
          </p>
        </>
      )}
    </section>
  );
}

function LegendRow({
  swatch,
  label,
  count,
}: {
  swatch: string;
  label: string;
  count: number;
}) {
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`mark ${swatch} h-3.5 w-6 rounded`}
      />
      <span className="text-[0.8125rem] text-ink-soft">{label}</span>
      <span className="nums text-[0.8125rem] font-semibold text-ink">
        {count}
      </span>
    </span>
  );
}
