import assert from "node:assert/strict";
import test from "node:test";
import {
  MIN_WORDS_FOR_SCORE,
  aiBand,
  detectAi,
  LOCAL_PROVIDER,
} from "./ai-detection.ts";

/** Uniform, connective-heavy, contraction-free: the generated-prose shape. */
const UNIFORM = `Furthermore, the comprehensive onboarding process is designed to leverage a robust and seamless framework. Additionally, our pivotal approach underscores a holistic commitment to a transformative customer journey. Moreover, the multifaceted nature of the landscape requires a nuanced and meticulous strategy. Consequently, we foster an environment that empowers teams to navigate an ever-evolving paradigm. Ultimately, this testament to innovation will streamline operations and unlock unparalleled value for every stakeholder involved.`;

/** Varied rhythm, plain words, contractions: the human-email shape. */
const HUMAN = `Hi Sarah,

Your trial ends Friday. I wanted to flag it before it caught you out.

We moved your data over last night and nothing broke. Your team can keep working exactly as they did before, and the three integrations you flagged in March are already live.

There's a 20 minute window on Sunday morning when things will be down. I'll email you when it starts.

If you'd rather stay on the old plan, just reply. No forms. No calls.

Thanks for sticking with us.

Eric`;

/* -------------------------------------------------------------------------- */

test("separates uniform generated-style prose from varied human email", () => {
  const uniform = detectAi(UNIFORM);
  const human = detectAi(HUMAN);

  assert.equal(uniform.tooShort, false);
  assert.equal(human.tooShort, false);

  assert.ok(
    uniform.score > human.score + 25,
    `expected a clear gap, got uniform=${uniform.score} human=${human.score}`,
  );
  assert.ok(uniform.score > 60, `uniform scored only ${uniform.score}`);
  assert.ok(human.score < 45, `human scored ${human.score}`);
});

test("withholds a score when there is not enough text", () => {
  const short = detectAi("This is short. Too short to judge. Really.");
  assert.equal(short.tooShort, true);
  assert.equal(short.score, 0);
  assert.equal(short.isEmpty, false);

  const empty = detectAi("   ");
  assert.equal(empty.isEmpty, true);
  assert.equal(empty.tooShort, true);
});

test("the short-text cutoff matches the published constant", () => {
  const tail = " Another one here. And a third one. And a fourth.";
  const tailWords = tail.trim().split(/\s+/).length;

  // Enough sentences to clear the sentence floor, deliberately one word short
  // of the word floor.
  const body = Array.from(
    { length: MIN_WORDS_FOR_SCORE - tailWords - 1 },
    () => "word",
  ).join(" ");
  const text = `${body}.${tail}`;

  const wordCount = text.match(/[\p{L}\p{N}]+/gu)!.length;
  assert.equal(wordCount, MIN_WORDS_FOR_SCORE - 1, "test precondition");
  assert.equal(detectAi(text).tooShort, true);

  // One more word and it scores.
  assert.equal(detectAi(`word ${text}`).tooShort, false);
});

test("finds stock connectives and vocabulary", () => {
  const report = detectAi(UNIFORM);
  assert.ok(report.transitionHits.includes("furthermore"));
  assert.ok(report.transitionHits.includes("moreover"));
  assert.ok(report.tellHits.includes("leverage"));
  assert.ok(report.tellHits.includes("robust"));
});

test("respects word boundaries on the vocabulary lists", () => {
  // "thus" must not fire inside "enthusiasm"; "realm" not inside "realms"
  // is fine to match, but "delve" must not fire inside "delved"... it should,
  // so just guard the clear false positive.
  const report = detectAi(
    `Our enthusiasm is genuine and the team is thrilled about the work. We shipped the thing on Tuesday and it went out without any trouble at all. Nobody complained. The numbers went up a little. We will keep an eye on it over the next few weeks and see what happens next.`,
  );
  assert.ok(
    !report.transitionHits.includes("thus"),
    "matched 'thus' inside 'enthusiasm'",
  );
});

test("counts contractions", () => {
  const withContractions = detectAi(HUMAN);
  assert.ok(
    withContractions.contractionCount >= 3,
    `found only ${withContractions.contractionCount}`,
  );

  const without = detectAi(UNIFORM);
  assert.equal(without.contractionCount, 0);
});

test("burstiness is higher for varied sentence lengths", () => {
  assert.ok(
    detectAi(HUMAN).burstiness > detectAi(UNIFORM).burstiness,
    "uniform text was measured as more varied than human text",
  );
});

test("signals are weighted, ordered and well-formed", () => {
  const report = detectAi(UNIFORM);

  assert.ok(report.signals.length >= 5);
  for (const item of report.signals) {
    assert.ok(item.score >= 0 && item.score <= 100, `${item.id} = ${item.score}`);
    assert.ok(item.weight > 0);
    assert.ok(item.detail.length > 0);
  }

  // Sorted by contribution, most significant first.
  const contributions = report.signals.map((s) => s.score * s.weight);
  const sorted = [...contributions].sort((a, b) => b - a);
  assert.deepEqual(contributions, sorted);
});

test("score stays inside 0 to 100", () => {
  for (const text of [UNIFORM, HUMAN, UNIFORM.repeat(5), HUMAN.repeat(3)]) {
    const report = detectAi(text);
    assert.ok(report.score >= 0 && report.score <= 100, `score ${report.score}`);
  }
});

test("bands line up with the score", () => {
  assert.equal(aiBand(0).key, "human");
  assert.equal(aiBand(29).key, "human");
  assert.equal(aiBand(30).key, "mixed");
  assert.equal(aiBand(54).key, "mixed");
  assert.equal(aiBand(55).key, "likely");
  assert.equal(aiBand(77).key, "likely");
  assert.equal(aiBand(78).key, "machine");
  assert.equal(aiBand(100).key, "machine");
});

test("scanning is repeatable (global regex state is reset)", () => {
  const first = detectAi(UNIFORM);
  for (let i = 0; i < 5; i += 1) {
    const again = detectAi(UNIFORM);
    assert.equal(again.score, first.score);
    assert.equal(again.transitionHits.length, first.transitionHits.length);
  }
});

test("survives pathological input", () => {
  for (const text of ["", "   ", "\n\n\n", ".".repeat(500), "word ".repeat(5000), "🙂 ".repeat(200)]) {
    const report = detectAi(text);
    assert.ok(Number.isFinite(report.score));
    assert.ok(report.score >= 0 && report.score <= 100);
  }
});

test("the provider stub returns the same shape", async () => {
  const direct = detectAi(UNIFORM);
  const viaProvider = await LOCAL_PROVIDER.analyze(UNIFORM);
  assert.equal(viaProvider.score, direct.score);
  assert.equal(LOCAL_PROVIDER.name, "local-heuristic");
});
