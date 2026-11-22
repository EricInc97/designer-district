"use client";

import { motion, useReducedMotion } from "framer-motion";
import { SUBJECT_MAX, SUBJECT_MIN } from "@/lib/deliverability";

interface SubjectFieldProps {
  value: string;
  onChange: (next: string) => void;
}

/**
 * The subject line, sitting above the body in the same column and sharing its
 * horizontal padding so the two line up. It is scored as part of
 * deliverability, where it carries more weight than the body does.
 */
export function SubjectField({ value, onChange }: SubjectFieldProps) {
  const reduceMotion = useReducedMotion();
  const length = value.trim().length;

  const tone =
    length === 0
      ? "var(--ink-faint)"
      : length < SUBJECT_MIN || length > SUBJECT_MAX
        ? "var(--band-ok)"
        : "var(--band-good)";

  return (
    <div className="shrink-0 border-b border-edge bg-paper">
      <div className="editor-pad-x mx-auto flex w-full max-w-[72ch] items-center gap-3 py-3">
        <label
          htmlFor="subject"
          className="shrink-0 text-[0.625rem] font-semibold tracking-[0.1em] text-ink-faint uppercase"
        >
          Subject
        </label>

        <input
          id="subject"
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="What lands in the inbox first"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent font-serif text-[1.0625rem] text-ink outline-none placeholder:text-ink-faint"
        />

        <motion.span
          // A quiet nudge when the count crosses into or out of range.
          key={tone}
          initial={reduceMotion ? false : { scale: 0.85, opacity: 0.4 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="nums shrink-0 text-[0.6875rem] font-medium"
          style={{ color: tone }}
          title={`${SUBJECT_MIN}-${SUBJECT_MAX} characters reads well on a phone`}
        >
          {length}
        </motion.span>
      </div>
    </div>
  );
}
