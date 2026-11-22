"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { HighlightSegment, Sentence } from "@/lib/readability";

export interface EditorHandle {
  focus: () => void;
  /** Select a sentence and scroll it into the middle of the viewport. */
  revealSentence: (sentence: Sentence) => void;
}

interface EditorPaneProps {
  value: string;
  onChange: (next: string) => void;
  segments: HighlightSegment[];
  /** The text `segments` describes. See `useAnalysis`. */
  analyzedText: string;
  showHighlights: boolean;
  activeSentenceId: number | null;
  onActiveSentenceChange: (id: number | null) => void;
  handleRef?: RefObject<EditorHandle | null>;
}

const MARK_CLASS: Record<string, string> = {
  hard: "mark mark-hard",
  "very-hard": "mark mark-very-hard",
};

export function EditorPane({
  value,
  onChange,
  segments,
  analyzedText,
  showHighlights,
  activeSentenceId,
  onActiveSentenceChange,
  handleRef,
}: EditorPaneProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const reduceMotion = useReducedMotion();

  /**
   * The textarea never scrolls on its own: it is grown to fit its content and
   * the wrapper around it does the scrolling. That removes the two classic
   * failure modes of this technique -- having to mirror `scrollTop` every
   * frame, and the overlay being a scrollbar's width wider than the textarea.
   */
  const [minHeight, setMinHeight] = useState(0);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const measure = () => setMinHeight(scroller.clientHeight);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  const resize = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(textarea.scrollHeight, minHeight)}px`;
  }, [minHeight]);

  useLayoutEffect(resize, [resize, value]);

  const revealSentence = useCallback(
    (sentence: Sentence) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      // `sentence.end` carries the whitespace that follows the full stop, so
      // trim the range before selecting it.
      const raw = analyzedText.slice(sentence.start, sentence.end);
      const lead = raw.length - raw.trimStart().length;
      const start = sentence.start + lead;
      const end = start + raw.trim().length;

      textarea.focus();
      textarea.setSelectionRange(start, end);

      const mark = overlayRef.current?.querySelector(
        `[data-sentence="${sentence.id}"]`,
      );
      mark?.scrollIntoView({
        block: "center",
        behavior: reduceMotion ? "auto" : "smooth",
      });
    },
    [analyzedText, reduceMotion],
  );

  useImperativeHandle(
    handleRef,
    () => ({
      focus: () => textareaRef.current?.focus(),
      revealSentence,
    }),
    [revealSentence],
  );

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex h-full min-h-0 flex-col bg-paper"
    >
      <div
        ref={scrollerRef}
        className="scroll-slim relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
      >
        <div className="relative mx-auto w-full max-w-[72ch]">
          {/* Highlight layer. Sits behind the real text, holds no caret, and is
              hidden from assistive tech because the textarea already has the
              same words. */}
          <div
            ref={overlayRef}
            aria-hidden="true"
            className="editor-type editor-pad pointer-events-none absolute inset-0 overflow-hidden text-transparent select-none"
          >
            {showHighlights
              ? segments.map((segment) =>
                  segment.difficulty === "ok" ? (
                    <span key={segment.key}>{segment.text}</span>
                  ) : (
                    <span
                      key={segment.key}
                      data-sentence={segment.sentenceId}
                      className={`${MARK_CLASS[segment.difficulty]}${
                        segment.sentenceId === activeSentenceId
                          ? " mark-active"
                          : ""
                      }`}
                    >
                      {segment.text}
                    </span>
                  ),
                )
              : analyzedText}
          </div>

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onBlur={() => onActiveSentenceChange(null)}
            spellCheck
            autoComplete="off"
            autoCorrect="off"
            placeholder={PLACEHOLDER}
            aria-label="Your copy"
            className="editor-type editor-pad relative block w-full resize-none bg-transparent text-ink caret-accent outline-none placeholder:text-ink-faint"
            style={{ minHeight: minHeight || undefined }}
          />
        </div>
      </div>
    </motion.div>
  );
}

const PLACEHOLDER = `Paste your email copy or an article here.

Everything on the right updates as you type, and any sentence that is hard work to read gets highlighted in place.`;
