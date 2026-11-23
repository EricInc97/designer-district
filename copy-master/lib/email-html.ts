/**
 * HTML <-> plain text for email bodies.
 *
 * The outreach flow carries bodies as JSON with `<br>` for line breaks, and
 * the copy itself contains anchor tags. The analysers want prose: `<br>` as
 * real newlines, and link text without the surrounding markup, because
 * `<a href="https://example.com/book">` is not words anybody reads.
 *
 * Both directions live here rather than in a prompt, so they are deterministic
 * and testable instead of something a model has to remember.
 */

/** Matches `<br>`, `<br/>`, `<br />`, `<BR>` and friends. */
const BR = /<br\s*\/?>/gi;

/**
 * `<a ...>text</a>` keeping only `text`.
 *
 * `[\s\S]` rather than the `s` (dotAll) flag, which needs an ES2018 target
 * and this project compiles to ES2017.
 */
const ANCHOR = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;

/** Any other tag. */
const TAG = /<\/?[a-z][^>]*>/gi;

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

/**
 * Turn an email body into the plain prose the analysers expect.
 *
 * `<br><br>` becomes a blank line and a single `<br>` becomes one newline,
 * which is what keeps paragraph counts and sentence segmentation honest —
 * the readability engine treats a blank line as a sentence boundary.
 */
export function htmlToPlain(input: string): string {
  if (!input) return "";

  return (
    input
      // Literal "\n" that survived a JSON round trip.
      .replace(/\\r\\n|\\n/g, "\n")
      .replace(BR, "\n")
      .replace(ANCHOR, "$1")
      .replace(TAG, "")
      .replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? entity)
      .replace(/\r\n/g, "\n")
      // Three or more blank lines collapse to one paragraph break.
      .replace(/\n{3,}/g, "\n\n")
      // Trailing spaces before a break would show up as word gaps.
      .replace(/[ \t]+\n/g, "\n")
      .trim()
  );
}

/**
 * Put it back the way the flow carries it: a blank line becomes `<br><br>`,
 * a single newline becomes `<br>`. Anchors that were already in the text are
 * untouched, because `htmlToPlain` is only used for measuring — the body that
 * travels onward is the agent's own.
 */
export function plainToHtml(input: string): string {
  if (!input) return "";

  return input
    .replace(/\r\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .replace(/\n/g, "<br>");
}

/**
 * True when the input already carries `<br>` breaks or anchors.
 *
 * Deliberately not reusing the module-level `BR`: `.test()` on a `/g` regex
 * advances `lastIndex`, so consecutive calls would alternate true and false.
 */
export function looksLikeHtml(input: string): boolean {
  return /<br\s*\/?>/i.test(input) || /<a\b[^>]*>/i.test(input);
}
