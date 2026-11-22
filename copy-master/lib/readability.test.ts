import assert from "node:assert/strict";
import test from "node:test";
import {
  analyze,
  buildHighlightSegments,
  countSyllables,
  splitSentences,
  READING_WPM,
} from "./readability.ts";

test("counts syllables", () => {
  assert.equal(countSyllables("cat"), 1);
  assert.equal(countSyllables("table"), 2);
  assert.equal(countSyllables("simple"), 2);
  assert.equal(countSyllables("nation"), 2);
  assert.equal(countSyllables("lovely"), 2);
  assert.equal(countSyllables("people"), 2);
  assert.equal(countSyllables("implementation"), 5);
  assert.equal(countSyllables("readability"), 5);
  assert.equal(countSyllables(""), 0);
});

test("does not split on abbreviations, initials, decimals or domains", () => {
  assert.equal(splitSentences("Dr. Smith went home. He was tired.").length, 2);
  assert.equal(splitSentences("It costs 3.50 today. That is cheap.").length, 2);
  assert.equal(splitSentences("J. K. Rowling wrote it. We read it.").length, 2);
  assert.equal(splitSentences("Go to example.com now. Then stop.").length, 2);
});

test("treats blank lines as sentence breaks but keeps hard-wrapped prose whole", () => {
  assert.equal(
    splitSentences("Hi Sarah,\n\nThanks for the note.\n\nBest,\nEric").length,
    3,
  );
  assert.equal(
    splitSentences("This sentence is\nhard wrapped across lines. Next one.")
      .length,
    2,
  );
});

test("sentence ranges tile the whole string with no gaps", () => {
  const text = "One sentence here. Another one!  And a third?\n\nNew para.";
  const ranges = splitSentences(text);

  assert.equal(ranges[0]!.start, 0);
  for (let i = 1; i < ranges.length; i += 1) {
    assert.equal(ranges[i]!.start, ranges[i - 1]!.end);
  }
});

test("scores plain prose as easy and flags nothing", () => {
  const result = analyze("The cat sat on the mat. The dog ran fast. We all had fun.");

  assert.equal(result.words, 14);
  assert.equal(result.sentenceCount, 3);
  assert.ok(result.grade < 4, `expected an easy grade, got ${result.grade}`);
  assert.equal(result.hardCount + result.veryHardCount, 0);
});

test("flags a long, dense sentence as very hard", () => {
  const result = analyze(
    "The implementation of the aforementioned organizational transformation initiative necessitates comprehensive stakeholder consultation across multiple interdependent operational divisions throughout the entire fiscal period.",
  );

  assert.equal(result.veryHardCount, 1);
  assert.ok(result.grade > 14, `expected a high grade, got ${result.grade}`);
});

test("never flags short sentences", () => {
  const result = analyze("Stop. Now. Go. Quit procrastinating immediately.");
  assert.equal(result.hardCount + result.veryHardCount, 0);
});

test("treats blank input as empty", () => {
  assert.equal(analyze("   ").isEmpty, true);
  assert.equal(analyze("").grade, 0);
});

test("reading time follows the words-per-minute constant", () => {
  const text = `${Array.from({ length: READING_WPM }, () => "word").join(" ")}.`;
  assert.equal(Math.round(analyze(text).readingTimeSeconds), 60);
});

test("highlight segments rebuild the original text exactly", () => {
  const dense =
    "The implementation of the aforementioned organizational transformation initiative necessitates comprehensive stakeholder consultation across multiple interdependent operational divisions throughout the entire fiscal period.";
  const text = `Short one. ${dense} Another short one. ${dense}\n\nTrailing text`;

  const segments = buildHighlightSegments(text, analyze(text).sentences);

  assert.equal(segments.map((segment) => segment.text).join(""), text);
  assert.equal(
    segments.filter((segment) => segment.difficulty !== "ok").length,
    2,
  );
  // Marks must not include the whitespace around a sentence, or the highlight
  // bleeds into the next line.
  for (const segment of segments) {
    if (segment.difficulty === "ok") continue;
    assert.equal(segment.text, segment.text.trim());
  }
});

test("survives pathological input", () => {
  const cases = [
    "",
    ".",
    "...",
    "!?!?",
    "\n\n\n",
    "a".repeat(5000),
    "1.2.3.4",
    "....Hi.",
    "   ",
  ];

  for (const input of cases) {
    const result = analyze(input);
    const segments = buildHighlightSegments(input, result.sentences);
    assert.equal(
      segments.map((segment) => segment.text).join(""),
      input,
      `segments did not rebuild ${JSON.stringify(input)}`,
    );
  }
});
