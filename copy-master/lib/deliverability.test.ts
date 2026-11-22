import assert from "node:assert/strict";
import test from "node:test";
import {
  SPAM_TERMS,
  CATEGORY_ADVICE,
  CATEGORY_LABEL,
  checkDeliverability,
  countShoutedWords,
  deliverabilityBand,
} from "./deliverability.ts";

const find = (report: ReturnType<typeof checkDeliverability>, phrase: string) =>
  report.hits.find((hit) => hit.phrase === phrase);

const check = (report: ReturnType<typeof checkDeliverability>, id: string) =>
  report.checks.find((item) => item.id === id);

/* -------------------------------------------------------------------------- */
/* Dictionary hygiene                                                         */
/* -------------------------------------------------------------------------- */

test("dictionary entries are lower-case, single-spaced and unique", () => {
  const seen = new Set<string>();

  for (const term of SPAM_TERMS) {
    assert.equal(
      term.phrase,
      term.phrase.toLowerCase(),
      `${term.phrase} is not lower-case`,
    );
    assert.equal(
      term.phrase,
      term.phrase.replace(/\s+/g, " ").trim(),
      `${term.phrase} has irregular spacing`,
    );
    assert.ok(!seen.has(term.phrase), `${term.phrase} is duplicated`);
    seen.add(term.phrase);
  }

  assert.ok(SPAM_TERMS.length > 150, "dictionary is suspiciously small");
});

test("every category has advice and a label", () => {
  for (const term of SPAM_TERMS) {
    assert.ok(CATEGORY_ADVICE[term.category], `no advice for ${term.category}`);
    assert.ok(CATEGORY_LABEL[term.category], `no label for ${term.category}`);
  }
});

/* -------------------------------------------------------------------------- */
/* Matching                                                                   */
/* -------------------------------------------------------------------------- */

test("finds trigger phrases regardless of case", () => {
  const report = checkDeliverability("", "ACT NOW before it is too late.");
  assert.ok(find(report, "act now"), "did not match upper-case");
});

test("prefers the longest matching phrase", () => {
  const report = checkDeliverability("", "This is a limited time offer today.");

  assert.ok(find(report, "limited time offer"), "missed the long phrase");
  assert.equal(
    find(report, "limited time"),
    undefined,
    "also matched the shorter phrase inside it",
  );
});

test("respects word boundaries", () => {
  // "free" must not fire inside "freedom" or "freelance".
  const report = checkDeliverability(
    "",
    "Freedom and freelance work are unrelated to this.",
  );
  assert.equal(find(report, "free"), undefined);
});

test("matches phrases containing punctuation and digits", () => {
  const report = checkDeliverability("", "It is 100% free, with no catch.");
  assert.ok(find(report, "100% free"), "missed 100% free");
  assert.ok(find(report, "no catch"), "missed no catch");
});

test("matches a phrase split across a line break", () => {
  const report = checkDeliverability("", "This is a limited\ntime offer.");
  assert.ok(find(report, "limited time offer"));
});

test("counts repeats but does not let one phrase dominate", () => {
  const once = checkDeliverability("", `Act now. ${"Filler words here. ".repeat(10)}`);
  const many = checkDeliverability(
    "",
    `${"Act now. ".repeat(12)}${"Filler words here. ".repeat(10)}`,
  );

  const onceHit = find(once, "act now")!;
  const manyHit = find(many, "act now")!;

  assert.equal(onceHit.count, 1);
  assert.equal(manyHit.count, 12);
  // The repeat cap is what stops a single word zeroing the score.
  assert.ok(
    manyHit.penalty <= onceHit.penalty * 2.2 + 0.001,
    `repeat penalty ${manyHit.penalty} exceeded the cap`,
  );
});

test("weights the subject line more heavily than the body", () => {
  const inBody = checkDeliverability(
    "A perfectly ordinary subject line here",
    "Act now, the details are below.",
  );
  const inSubject = checkDeliverability(
    "Act now, the details are below",
    "A perfectly ordinary body sentence goes here instead.",
  );

  assert.ok(
    find(inSubject, "act now")!.penalty > find(inBody, "act now")!.penalty,
    "subject hit was not weighted higher",
  );
  assert.ok(inSubject.score < inBody.score);
});

test("scanning is repeatable (global regex state is reset)", () => {
  const text = "Act now for a free gift and a money back guarantee.";
  const first = checkDeliverability("", text);

  for (let i = 0; i < 5; i += 1) {
    const again = checkDeliverability("", text);
    assert.equal(again.hits.length, first.hits.length);
    assert.equal(again.score, first.score);
  }
});

/* -------------------------------------------------------------------------- */
/* Structural checks                                                          */
/* -------------------------------------------------------------------------- */

test("counts shouting but not ordinary acronyms", () => {
  assert.equal(countShoutedWords("This is URGENT and FREE"), 2);
  assert.equal(countShoutedWords("Nothing shouted here"), 0);

  // Technical and business copy is full of legitimate capitals. Flagging
  // these would make the whole check untrustworthy.
  assert.equal(countShoutedWords("Our API returns a PDF and the CEO signed the NDA"), 0);
  assert.equal(countShoutedWords("CI is short enough to ignore anyway"), 0);
  assert.equal(countShoutedWords("The API is DOWN and BROKEN"), 2);
});

test("a subject full of acronyms is not treated as shouting", () => {
  const report = checkDeliverability(
    "Your API keys rotate on Friday",
    "We are rotating the API keys for every CRM integration on Friday morning. Nothing should break, but check your SDK version first.",
  );
  assert.equal(check(report, "caps")!.status, "pass");
});

test("flags all-caps and exclamation marks in the subject", () => {
  const report = checkDeliverability(
    "URGENT: open this now!",
    "A reasonable body of text that says something useful to the reader.",
  );

  assert.equal(check(report, "caps")!.status, "fail");
  assert.notEqual(check(report, "punctuation")!.status, "pass");
});

test("flags a missing subject", () => {
  const report = checkDeliverability(
    "",
    "A reasonable body of text that says something useful to the reader.",
  );
  assert.equal(check(report, "subject-present")!.status, "fail");
});

test("flags a subject that is too long for a phone", () => {
  const report = checkDeliverability(
    "This subject line goes on and on well past the point where any phone would cut it off",
    "A reasonable body of text that says something useful to the reader.",
  );
  assert.equal(check(report, "subject-present")!.status, "warn");
});

test("flags repeated currency symbols and dense linking", () => {
  const symbols = checkDeliverability("Quarterly update from the team", "Save $$$ today on everything.");
  assert.equal(check(symbols, "symbols")!.status, "fail");

  const links = checkDeliverability(
    "Quarterly update from the team",
    Array.from({ length: 8 }, (_, i) => `https://example.com/${i}`).join(" ") +
      " plus some words to pad the body out a little further.",
  );
  assert.equal(check(links, "links")!.status, "fail");
});

/* -------------------------------------------------------------------------- */
/* Scoring                                                                    */
/* -------------------------------------------------------------------------- */

test("clean professional copy scores well", () => {
  const report = checkDeliverability(
    "Your invoice for November is ready",
    "Hi Sarah,\n\nYour November invoice is attached. The total is 420 pounds and it is due on the 30th.\n\nLet me know if anything looks wrong and I will sort it out.\n\nThanks,\nEric",
  );

  assert.ok(
    report.score >= 85,
    `expected a clean score, got ${report.score} (${report.hits.map((h) => h.phrase).join(", ")})`,
  );
  assert.equal(report.band.key, "inbox");
});

test("textbook spam scores badly", () => {
  const report = checkDeliverability(
    "CONGRATULATIONS!!! You have been selected",
    "ACT NOW! This 100% free, risk-free offer is guaranteed to help you make money fast. No credit check, no obligation. Claim your prize today only, while supplies last!!! Visit $$$ now.",
  );

  assert.ok(report.score <= 20, `expected a low score, got ${report.score}`);
  assert.equal(report.band.key, "spam");
});

test("score stays inside 0 to 100", () => {
  const worst = checkDeliverability(
    "FREE VIAGRA!!! ACT NOW!!! $$$",
    `${"100% free guaranteed risk-free money back guarantee act now winner lottery viagra xanax no credit check ".repeat(20)}`,
  );
  assert.ok(worst.score >= 0 && worst.score <= 100, `score was ${worst.score}`);

  const best = checkDeliverability(
    "Notes from today's planning session",
    "We agreed the timeline, assigned the three remaining tasks, and set the next review for Thursday morning in the usual room.",
  );
  assert.ok(best.score >= 0 && best.score <= 100);
});

test("bands line up with the score", () => {
  assert.equal(deliverabilityBand(100).key, "inbox");
  assert.equal(deliverabilityBand(85).key, "inbox");
  assert.equal(deliverabilityBand(84).key, "good");
  assert.equal(deliverabilityBand(70).key, "good");
  assert.equal(deliverabilityBand(69).key, "risky");
  assert.equal(deliverabilityBand(45).key, "risky");
  assert.equal(deliverabilityBand(44).key, "spam");
  assert.equal(deliverabilityBand(0).key, "spam");
});

test("empty input is empty, not a perfect score", () => {
  const report = checkDeliverability("", "");
  assert.equal(report.isEmpty, true);
  assert.equal(report.hits.length, 0);
  assert.equal(report.checks.length, 0);
});

test("survives pathological input", () => {
  for (const input of ["", "   ", "!!!!!!", "$$$$$$", "a".repeat(5000), "ACT NOW ".repeat(500), "🙂🙂🙂"]) {
    const report = checkDeliverability(input, input);
    assert.ok(Number.isFinite(report.score));
    assert.ok(report.score >= 0 && report.score <= 100);
  }
});
