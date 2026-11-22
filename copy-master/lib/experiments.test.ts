import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  EXPERIMENTS,
  HIGHLIGHT_THRESHOLDS,
  assignAll,
  assignVariant,
  thresholdsFor,
} from "./experiments.ts";
import { analyze } from "./readability.ts";
import { SAMPLE_TEXT } from "./sample-text.ts";

const VARIANTS = Object.keys(
  EXPERIMENTS[HIGHLIGHT_THRESHOLDS].variants,
) as Array<"control" | "strict">;

test("assignment is stable for a given visitor", () => {
  const visitor = randomUUID();
  const first = assignVariant(HIGHLIGHT_THRESHOLDS, visitor);

  for (let i = 0; i < 100; i += 1) {
    assert.equal(assignVariant(HIGHLIGHT_THRESHOLDS, visitor), first);
  }
});

test("assignment splits evenly", () => {
  const counts: Record<string, number> = {};
  const total = 20_000;

  for (let i = 0; i < total; i += 1) {
    const variant = assignVariant(HIGHLIGHT_THRESHOLDS, randomUUID());
    counts[variant] = (counts[variant] ?? 0) + 1;
  }

  const expected = total / VARIANTS.length;
  for (const variant of VARIANTS) {
    const share = counts[variant] ?? 0;
    // Within 5% of an even split. A biased hash would blow well past this.
    assert.ok(
      Math.abs(share - expected) < expected * 0.05,
      `${variant} got ${share}, expected about ${expected}`,
    );
  }
});

test("every experiment gets a valid variant", () => {
  const assignments = assignAll(randomUUID());
  const variants = Object.keys(EXPERIMENTS[HIGHLIGHT_THRESHOLDS].variants);
  assert.ok(variants.includes(assignments[HIGHLIGHT_THRESHOLDS]));
});

/*
 * The one that actually matters. Two variants that flag the same sentences
 * make the experiment inert: it would run, collect data, and show no
 * difference no matter how good or bad the idea was. This caught exactly that
 * when `strict` was first tuned a couple of grades too high.
 */
test("variants disagree on realistic copy", () => {
  const control = analyze(SAMPLE_TEXT, thresholdsFor("control"));
  const strict = analyze(SAMPLE_TEXT, thresholdsFor("strict"));

  const controlFlagged = control.hardCount + control.veryHardCount;
  const strictFlagged = strict.hardCount + strict.veryHardCount;

  assert.ok(
    strictFlagged > controlFlagged,
    `strict flagged ${strictFlagged}, control flagged ${controlFlagged} -- the variants are indistinguishable`,
  );
});

test("thresholds change only flagging, never the scores", () => {
  const control = analyze(SAMPLE_TEXT, thresholdsFor("control"));
  const strict = analyze(SAMPLE_TEXT, thresholdsFor("strict"));

  // Variants have to stay comparable, so the document-level numbers the
  // experiment is judged on must not move with the thresholds.
  assert.equal(strict.words, control.words);
  assert.equal(strict.sentenceCount, control.sentenceCount);
  assert.equal(strict.grade, control.grade);
  assert.equal(strict.fleschReadingEase, control.fleschReadingEase);
});

test("short sentences stay unflagged in every variant", () => {
  for (const variant of VARIANTS) {
    const result = analyze("Nothing broke. No forms. No calls.", thresholdsFor(variant));
    assert.equal(
      result.hardCount + result.veryHardCount,
      0,
      `${variant} flagged a short sentence`,
    );
  }
});
