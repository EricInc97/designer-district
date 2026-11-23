import assert from "node:assert/strict";
import test from "node:test";
import { htmlToPlain, looksLikeHtml, plainToHtml } from "./email-html.ts";

test("turns br breaks into real line breaks", () => {
  assert.equal(htmlToPlain("Hi Sarah,<br><br>Body here."), "Hi Sarah,\n\nBody here.");
  assert.equal(htmlToPlain("One<br>Two"), "One\nTwo");
  // Every spelling the flow might emit.
  assert.equal(htmlToPlain("A<br/>B<br />C<BR>D"), "A\nB\nC\nD");
});

test("keeps anchor text and drops the markup", () => {
  assert.equal(
    htmlToPlain('On your <a href="https://example.com/book">booking page</a>, there is a gap.'),
    "On your booking page, there is a gap.",
  );
});

test("decodes the entities that show up in email copy", () => {
  assert.equal(htmlToPlain("Tom&#39;s spa &amp; clinic"), "Tom's spa & clinic");
  assert.equal(htmlToPlain("a&nbsp;b"), "a b");
});

test("handles literal backslash-n that survived a JSON round trip", () => {
  assert.equal(htmlToPlain("Hi,\\n\\nBody."), "Hi,\n\nBody.");
});

test("collapses runaway blank lines to one paragraph break", () => {
  assert.equal(htmlToPlain("A<br><br><br><br>B"), "A\n\nB");
});

test("round trips plain to html and back", () => {
  const plain = "Hi Sarah,\n\nOne line.\nAnother line.\n\nEric";
  const html = plainToHtml(plain);

  assert.equal(html, "Hi Sarah,<br><br>One line.<br>Another line.<br><br>Eric");
  assert.equal(htmlToPlain(html), plain);
});

test("paragraph breaks survive, which is what the readability engine keys on", () => {
  // A blank line is a sentence boundary in lib/readability, so losing it
  // would silently merge the greeting into the first paragraph.
  const plain = htmlToPlain("Hi Sarah,<br><br>Your trial ends Friday.");
  assert.ok(plain.includes("\n\n"), "paragraph break was lost");
});

test("trailing spaces before a break do not become word gaps", () => {
  assert.equal(htmlToPlain("A   <br>B"), "A\nB");
});

test("detects html, repeatably", () => {
  // The /g regex trap: .test() on a global regex advances lastIndex, so a
  // naive implementation alternates true/false on identical input.
  for (let i = 0; i < 5; i += 1) {
    assert.equal(looksLikeHtml("a<br>b"), true, `call ${i}`);
  }
  assert.equal(looksLikeHtml('<a href="x">y</a>'), true);
  assert.equal(looksLikeHtml("just plain text"), false);
});

test("survives empty and pathological input", () => {
  assert.equal(htmlToPlain(""), "");
  assert.equal(plainToHtml(""), "");
  assert.equal(htmlToPlain("<br><br><br>"), "");
  assert.equal(typeof htmlToPlain("<<>><a href=".repeat(50)), "string");
});
