"use client";

import { useEffect, useRef } from "react";
import type { HighlightSegment, Sentence } from "@/lib/readability";

/**
 * A draft rendered for reading, with the same sentence highlighting the editor
 * shows while you type.
 *
 * The editor does this with a transparent textarea over a coloured overlay,
 * because it has to stay aligned with a caret. Nothing here is editable, so
 * the marks are the visible text and the whole trick disappears -- but the
 * typography classes are shared, so a draft looks the same in both places.
 */

const MARK_CLASS: Record<string, string> = {
  hard: "mark mark-hard",
  "very-hard": "mark mark-very-hard",
};

interface ReadOnlyCopyProps {
  subject: string;
  /** Empty is correct for a threaded follow-up, so it is said rather than hidden. */
  subjectExpected: boolean;
  segments: HighlightSegment[];
  activeSentenceId: number | null;
  onSelectSentence: (id: number | null) => void;
}

export function ReadOnlyCopy({
  subject,
  subjectExpected,
  segments,
  activeSentenceId,
  onSelectSentence,
}: ReadOnlyCopyProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLSpanElement>(null);

  /* Bring the selected sentence into view when it is chosen from the panel. */
  useEffect(() => {
    if (activeSentenceId === null) return;
    activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeSentenceId]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-paper">
      <div className="shrink-0 border-b border-edge px-4 py-3 sm:px-6">
        <p className="text-[0.625rem] font-semibold tracking-[0.1em] text-ink-faint uppercase">
          Subject
        </p>
        <p className="mt-1 font-serif text-[0.9375rem] font-semibold text-ink">
          {subject || (
            <span className="text-ink-faint italic">
              {subjectExpected
                ? "(no subject)"
                : "(none, as a threaded follow-up should be)"}
            </span>
          )}
        </p>
      </div>

      <div
        ref={scrollerRef}
        className="scroll-slim min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
      >
        <div className="mx-auto w-full max-w-[72ch]">
          <div className="editor-type editor-pad whitespace-pre-wrap text-ink">
            {segments.map((segment) =>
              segment.difficulty === "ok" ? (
                <span key={segment.key}>{segment.text}</span>
              ) : (
                <span
                  key={segment.key}
                  ref={
                    segment.sentenceId === activeSentenceId ? activeRef : null
                  }
                  onClick={() =>
                    onSelectSentence(
                      segment.sentenceId === activeSentenceId
                        ? null
                        : segment.sentenceId,
                    )
                  }
                  className={`${MARK_CLASS[segment.difficulty]}${
                    segment.sentenceId === activeSentenceId ? " mark-active" : ""
                  } cursor-pointer`}
                >
                  {segment.text}
                </span>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The sentence a click selected, for callers that want the whole object. */
export function findSentence(
  sentences: Sentence[],
  id: number | null,
): Sentence | null {
  if (id === null) return null;
  return sentences.find((sentence) => sentence.id === id) ?? null;
}
