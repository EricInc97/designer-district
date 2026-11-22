/**
 * A/B experiments.
 *
 * Assignment is a pure function of the visitor id, so it needs no network
 * round trip, no flicker, and no coordination: the client works out its own
 * variant on first paint and the server records what it was told. The same
 * visitor always lands in the same bucket because the hash is deterministic.
 */

// Relative, with the extension, so this module also runs under `node --test`
// without a bundler to resolve the `@/` alias.
import {
  DEFAULT_THRESHOLDS,
  type DifficultyThresholds,
} from "./readability.ts";

/* -------------------------------------------------------------------------- */
/* Registry                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * How aggressively sentences get flagged.
 *
 * The question this is meant to settle: does a stricter highlighter make
 * people actually simplify their copy, or does it flag so much that they
 * stop trusting it and change nothing? Compare `avg_grade_delta` per variant
 * in the `variant_outcomes` view -- more negative is better.
 */
export const HIGHLIGHT_THRESHOLDS = "highlight-thresholds";

export const EXPERIMENTS = {
  [HIGHLIGHT_THRESHOLDS]: {
    variants: {
      /** Hemingway's own behaviour. */
      control: DEFAULT_THRESHOLDS,
      /**
       * Flags earlier and on shorter sentences.
       *
       * The grade bars matter more than they look. Ordinary business copy
       * clusters at either end — short sentences score 1-3, dense ones 12+ —
       * so a bar anywhere in the teens catches the same sentences control
       * already catches and the test measures nothing. 7 and 11 are low
       * enough to pull in the long-but-plain run-on sentence, which is the
       * category control deliberately lets through.
       */
      strict: {
        minWordsToFlag: 11,
        hardGrade: 7,
        veryHardGrade: 11,
      },
    } satisfies Record<string, DifficultyThresholds>,
  },
} as const;

export type ExperimentName = keyof typeof EXPERIMENTS;

export type VariantOf<E extends ExperimentName> =
  keyof (typeof EXPERIMENTS)[E]["variants"] & string;

export type Assignments = {
  [E in ExperimentName]: VariantOf<E>;
};

/* -------------------------------------------------------------------------- */
/* Assignment                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * FNV-1a, 32-bit. Small, dependency-free, and stable across runtimes, which
 * matters because the same string has to bucket identically everywhere.
 */
function hash(input: string): number {
  let value = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    value ^= input.charCodeAt(i);
    // The classic FNV prime multiply, kept in 32-bit range.
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value >>> 0;
}

/** Pick a variant for one experiment. Even split across the declared variants. */
export function assignVariant<E extends ExperimentName>(
  experiment: E,
  visitorId: string,
): VariantOf<E> {
  const variants = Object.keys(
    EXPERIMENTS[experiment].variants,
  ) as VariantOf<E>[];

  // Salt with the experiment name so a visitor is not correlated across
  // experiments: being in "control" here says nothing about the next test.
  const bucket = hash(`${experiment}:${visitorId}`) % variants.length;
  return variants[bucket]!;
}

export function assignAll(visitorId: string): Assignments {
  const names = Object.keys(EXPERIMENTS) as ExperimentName[];
  const result = {} as Assignments;
  for (const name of names) {
    result[name] = assignVariant(name, visitorId);
  }
  return result;
}

/** The thresholds this visitor's variant implies. */
export function thresholdsFor(
  variant: VariantOf<typeof HIGHLIGHT_THRESHOLDS>,
): DifficultyThresholds {
  return EXPERIMENTS[HIGHLIGHT_THRESHOLDS].variants[variant];
}
