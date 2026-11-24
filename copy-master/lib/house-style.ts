/**
 * House style: hard rules about the copy that are neither a readability
 * measure, a spam signal, nor a guess about authorship.
 *
 * These are not scored on a 0-100 scale, because they are not a matter of
 * degree. A rule is either kept or broken, and a broken one is always worth
 * fixing, so every violation becomes a problem the caller has to clear.
 *
 * Right now there is one rule: no long dashes.
 */

export type HouseStyleStatus = "pass" | "fail";

export interface HouseStyleCheck {
  id: string;
  label: string;
  status: HouseStyleStatus;
  detail: string;
  /** Where the rule was broken, with enough text either side to find it. */
  occurrences: HouseStyleOccurrence[];
}

export interface HouseStyleOccurrence {
  /** "subject" or "body". */
  where: "subject" | "body";
  /** The offending character. */
  character: string;
  /** The surrounding text, so a caller can locate it without an index. */
  context: string;
}

export interface HouseStyleReport {
  isEmpty: boolean;
  /** False if any rule is broken. */
  passes: boolean;
  checks: HouseStyleCheck[];
  /** Total violations across every rule. */
  violations: number;
}

/*
 * Em dash (U+2014) and en dash (U+2013).
 *
 * The rule is "no em dashes", and the en dash is included deliberately: in a
 * sentence they do the same job, they are trivially confused for one another,
 * and at email sizes they look alike. Banning one and permitting the other
 * would just move the problem.
 *
 * The plain hyphen is NOT here. It is load-bearing in ordinary copy --
 * "after-hours", "Anne-Marie", "follow-up" -- and flagging it would make the
 * rule useless.
 */
const LONG_DASHES = /[–—]/g;

const DASH_NAME: Record<string, string> = {
  "—": "em dash",
  "–": "en dash",
};

/** Characters of surrounding text to quote on each side of a violation. */
const CONTEXT_RADIUS = 32;

/** How many violations to quote before summarising the rest. */
const MAX_QUOTED = 6;

const EMPTY_REPORT: HouseStyleReport = {
  isEmpty: true,
  passes: true,
  checks: [],
  violations: 0,
};

/**
 * Quote the text around an index, collapsing whitespace so a paragraph break
 * does not turn one line of context into three.
 */
function contextAround(text: string, index: number): string {
  const start = Math.max(0, index - CONTEXT_RADIUS);
  const end = Math.min(text.length, index + CONTEXT_RADIUS + 1);

  const slice = text.slice(start, end).replace(/\s+/g, " ").trim();

  return `${start > 0 ? "..." : ""}${slice}${end < text.length ? "..." : ""}`;
}

function findLongDashes(
  text: string,
  where: "subject" | "body",
): HouseStyleOccurrence[] {
  const found: HouseStyleOccurrence[] = [];

  // A fresh regex per call: a shared /g regex carries lastIndex between calls
  // and would skip matches on the second scan.
  const pattern = new RegExp(LONG_DASHES.source, "g");

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    found.push({
      where,
      character: match[0],
      context: contextAround(text, match.index),
    });
  }

  return found;
}

/**
 * Check a draft against the house rules.
 *
 * Deterministic and synchronous, like the other engines, so it can run inside
 * a `useMemo` on every keystroke.
 */
export function checkHouseStyle(
  subject: string,
  body: string,
): HouseStyleReport {
  if (!subject.trim() && !body.trim()) return EMPTY_REPORT;

  const occurrences = [
    ...findLongDashes(subject, "subject"),
    ...findLongDashes(body, "body"),
  ];

  const checks: HouseStyleCheck[] = [];

  if (occurrences.length === 0) {
    checks.push({
      id: "no-long-dashes",
      label: "Long dashes",
      status: "pass",
      detail: "None found.",
      occurrences: [],
    });
  } else {
    const counts = new Map<string, number>();
    for (const item of occurrences) {
      counts.set(item.character, (counts.get(item.character) ?? 0) + 1);
    }

    const named = [...counts.entries()]
      .map(([character, count]) => `${count} ${DASH_NAME[character]}${count === 1 ? "" : "es"}`)
      .join(" and ");

    const inSubject = occurrences.some((item) => item.where === "subject");

    checks.push({
      id: "no-long-dashes",
      label: "Long dashes",
      status: "fail",
      detail:
        `${named}${inSubject ? ", including one in the subject" : ""}. ` +
        "Not allowed in this copy. Replace each one with a comma, a full " +
        'stop, or the word "to" in a number range, and rephrase if the ' +
        "sentence needs it.",
      occurrences: occurrences.slice(0, MAX_QUOTED),
    });
  }

  const violations = occurrences.length;

  return {
    isEmpty: false,
    passes: violations === 0,
    checks,
    violations,
  };
}
