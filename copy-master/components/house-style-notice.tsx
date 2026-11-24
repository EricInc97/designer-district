"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { HouseStyleReport } from "@/lib/house-style";

/**
 * A broken house rule, shown above the metric tabs.
 *
 * It sits outside the tabs on purpose. The three scores are measurements you
 * go and look at; this is a rule you have broken, and it should not be hiding
 * behind a tab you happen not to be on.
 */
export function HouseStyleNotice({ report }: { report: HouseStyleReport }) {
  const reduceMotion = useReducedMotion();

  const broken = report.checks.filter((check) => check.status !== "pass");

  return (
    <AnimatePresence initial={false}>
      {broken.length > 0 && (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="overflow-hidden"
        >
          <div className="border-b border-edge bg-band-poor/[0.07] px-3.5 py-3">
            {broken.map((check) => (
              <div key={check.id}>
                <p className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-band-poor">
                  <BanIcon />
                  {check.label}
                  <span className="nums rounded-full bg-band-poor/15 px-1.5 py-0.5 text-[0.625rem]">
                    {report.violations}
                  </span>
                </p>

                <p className="mt-1.5 text-[0.75rem] leading-relaxed text-ink-soft">
                  {check.detail}
                </p>

                {check.occurrences.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1">
                    {check.occurrences.map((item, index) => (
                      <li
                        key={index}
                        className="rounded-md bg-surface px-2 py-1.5 font-serif text-[0.75rem] leading-snug text-ink-soft ring-1 ring-edge"
                      >
                        <span className="mr-1.5 text-[0.625rem] tracking-[0.08em] text-ink-faint uppercase">
                          {item.where}
                        </span>
                        {item.context}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function BanIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m5.6 5.6 12.8 12.8" />
    </svg>
  );
}
