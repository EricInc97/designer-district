import assert from "node:assert/strict";
import test from "node:test";
import { checkHouseStyle } from "./house-style.ts";

const EM = "—";
const EN = "–";

const check = (report: ReturnType<typeof checkHouseStyle>) =>
  report.checks.find((item) => item.id === "no-long-dashes")!;

test("clean copy passes", () => {
  const report = checkHouseStyle(
    "Your booking page after 5pm",
    "Hi Brock,\n\nYour booking page only takes appointments during office hours. An evening enquiry waits until morning.\n\nWorth a look?",
  );

  assert.equal(report.passes, true);
  assert.equal(report.violations, 0);
  assert.equal(check(report).status, "pass");
});

test("catches an em dash in the body", () => {
  const report = checkHouseStyle(
    "A perfectly ordinary subject line",
    `Your booking page closes at five ${EM} and the enquiries keep arriving.`,
  );

  assert.equal(report.passes, false);
  assert.equal(report.violations, 1);

  const result = check(report);
  assert.equal(result.status, "fail");
  assert.match(result.detail, /1 em dash\b/);
  assert.equal(result.occurrences[0].where, "body");
  assert.equal(result.occurrences[0].character, EM);
});

test("catches an en dash too, and names it correctly", () => {
  const report = checkHouseStyle("", `Open 9 ${EN} 5, which is the problem.`);

  assert.equal(report.passes, false);
  assert.match(check(report).detail, /1 en dash\b/);
});

test("counts each kind separately and pluralises", () => {
  const report = checkHouseStyle(
    "",
    `One ${EM} two ${EM} three ${EN} four ${EM}.`,
  );

  assert.equal(report.violations, 4);
  const detail = check(report).detail;
  assert.match(detail, /3 em dashes/);
  assert.match(detail, /1 en dash\b/);
});

test("says when the subject is the offender", () => {
  const report = checkHouseStyle(
    `Your booking page ${EM} after hours`,
    "A reasonable body of text that says something useful to the reader.",
  );

  const result = check(report);
  assert.match(result.detail, /including one in the subject/);
  assert.equal(result.occurrences[0].where, "subject");
});

/*
 * The hyphen is load-bearing in ordinary copy. If this check fired on it the
 * rule would be unusable, so it is pinned by a test.
 */
test("never fires on a plain hyphen", () => {
  const report = checkHouseStyle(
    "Your after-hours booking page",
    "Hi Anne-Marie,\n\nThe follow-up on your out-of-hours enquiries is worth a look. Twenty-five of them came in last month.",
  );

  assert.equal(report.passes, true);
  assert.equal(report.violations, 0);
});

test("quotes enough context to find the dash", () => {
  const report = checkHouseStyle(
    "",
    `Here is a sentence that runs on for a while before the offending mark ${EM} and then carries on afterwards for a while longer.`,
  );

  const { context } = check(report).occurrences[0];
  assert.ok(context.includes(EM), "context does not contain the dash");
  assert.ok(context.includes("offending mark"), "no text before the dash");
  assert.ok(context.includes("and then carries"), "no text after the dash");
  assert.ok(context.startsWith("..."), "should mark the elision");
});

test("collapses whitespace in the quoted context", () => {
  const report = checkHouseStyle("", `First line.\n\n   Second ${EM} line.`);
  const { context } = check(report).occurrences[0];
  assert.ok(!/\n/.test(context), "context still contains a newline");
  assert.ok(!/ {2}/.test(context), "context still contains a double space");
});

test("caps how many it quotes but still counts them all", () => {
  const report = checkHouseStyle("", `x ${EM} `.repeat(20));

  assert.equal(report.violations, 20);
  assert.equal(check(report).occurrences.length, 6);
});

test("scanning is repeatable (no shared regex state)", () => {
  const text = `One ${EM} two ${EN} three.`;
  const first = checkHouseStyle("", text);

  for (let i = 0; i < 5; i += 1) {
    const again = checkHouseStyle("", text);
    assert.equal(again.violations, first.violations);
    assert.equal(again.checks.length, first.checks.length);
  }
});

test("empty input is empty, not a failure", () => {
  const report = checkHouseStyle("", "");
  assert.equal(report.isEmpty, true);
  assert.equal(report.passes, true);
  assert.equal(report.checks.length, 0);
});

test("survives pathological input", () => {
  for (const input of ["", "   ", EM.repeat(500), `${EN}${EM}${EN}`, "🙂", "a".repeat(5000)]) {
    const report = checkHouseStyle(input, input);
    assert.equal(typeof report.passes, "boolean");
    assert.ok(Number.isFinite(report.violations));
  }
});
