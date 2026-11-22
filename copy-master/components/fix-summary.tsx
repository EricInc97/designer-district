"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { FixResult } from "@/hooks/use-fix";

interface FixSummaryProps {
  result: FixResult | null;
  error: string | null;
  onUndo: () => void;
  onDismiss: () => void;
}

/**
 * What Claude changed, and the way back.
 *
 * Floats over the editor rather than sitting in the layout, so applying a
 * revision never shifts the text the writer is reading. Undo is the primary
 * action: a rewrite replaces everything, and that needs to feel reversible.
 */
export function FixSummary({
  result,
  error,
  onUndo,
  onDismiss,
}: FixSummaryProps) {
  const reduceMotion = useReducedMotion();
  const open = Boolean(result || error);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: 12, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="pointer-events-auto absolute right-4 bottom-4 left-4 z-30 max-h-[60%] overflow-y-auto rounded-2xl border border-edge bg-surface p-4 shadow-[0_8px_40px_-12px_rgb(0_0_0/0.3)] sm:left-auto sm:w-[26rem]"
          role="status"
        >
          {error ? (
            <>
              <p className="text-[0.8125rem] font-semibold text-band-poor">
                Could not revise
              </p>
              <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-soft">
                {error}
              </p>
              <div className="mt-3 flex justify-end">
                <SmallButton onClick={onDismiss}>Close</SmallButton>
              </div>
            </>
          ) : result ? (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[0.8125rem] font-semibold text-ink">
                  Claude revised your copy
                </p>
                <span className="nums shrink-0 text-[0.625rem] text-ink-faint">
                  {result.model}
                </span>
              </div>

              <ul className="mt-2.5 flex flex-col gap-1.5">
                {result.changes.map((change, index) => (
                  <motion.li
                    key={change}
                    initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.2 }}
                    className="flex gap-2 text-[0.75rem] leading-relaxed text-ink-soft"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-accent"
                    />
                    <span>{change}</span>
                  </motion.li>
                ))}
              </ul>

              <div className="mt-3.5 flex items-center justify-end gap-2 border-t border-edge pt-3">
                <SmallButton onClick={onUndo}>Undo</SmallButton>
                <SmallButton onClick={onDismiss} primary>
                  Keep
                </SmallButton>
              </div>
            </>
          ) : null}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SmallButton({
  children,
  onClick,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-7 rounded-lg border px-2.5 text-[0.75rem] font-medium transition-colors ${
        primary
          ? "border-accent bg-accent text-surface hover:opacity-90"
          : "border-edge text-ink-soft hover:border-edge-strong hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
