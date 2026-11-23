# Copy Master

A split-screen writing dashboard. Write a subject line and body on the left,
watch three analyses update on the right — **Readability**, **Deliverability**
and **AI detection** — and see hard-to-read sentences highlighted in place as
you type. One button hands the whole thing to Claude to fix.

No accounts and no login. The analysis itself runs entirely in the browser and
the page is static; the only server-side piece is an optional capture endpoint
that records anonymous metrics for A/B testing.

## Running it

```bash
npm install
cp .env.example .env.local   # optional, for capture
npm run dev                  # http://localhost:3000
npm test                     # engine + experiment tests
npm run build
```

With `.env.local` absent the app runs exactly as it did before Supabase
existed: capture gets a 503, switches itself off, and nothing in the UI
changes.

## What it measures

| Readout | How |
| --- | --- |
| Reading grade | Flesch–Kincaid Grade Level |
| Reading ease | Flesch Reading Ease, 0–100 |
| Reading time | Words ÷ 238 wpm (Brysbaert 2019, silent reading) |
| Read aloud | Words ÷ 150 wpm |
| Sentence highlighting | Automated Readability Index, per sentence |
| Deliverability | Weighted spam-trigger dictionary + structural checks, 0–100 |
| AI detection | Weighted style heuristic (burstiness, stock vocabulary, contractions), 0–100 |

Sentence highlighting follows Hemingway's behaviour rather than its exact
formula: a sentence is flagged **hard** at grade 10 and **very hard** at grade
14, and sentences under 14 words are never flagged — a short sentence can score
a high grade off one long word, and flagging those just teaches you to ignore
the highlights.

All three thresholds are constants at the top of `lib/readability.ts`
(`MIN_WORDS_TO_FLAG`, `HARD_GRADE`, `VERY_HARD_GRADE`), as is `READING_WPM`.

## Deliverability

`lib/deliverability.ts` reads the subject line and body the way a spam filter
roughly would, and scores them out of 100.

Two kinds of signal:

1. **Trigger phrases** — a dictionary of 170 entries across nine categories, each with a category
   and a severity. Severity 1 entries are deliberately ordinary words ("free",
   "offer", "discount"): filters do weigh them, but they cost little alone.
   The point is to catch a pile-up, not to ban the word "offer". Severity 3 is
   the classic landmines — "act now", "100% free", "no credit check".
2. **Structural tells** — SHOUTING, exclamation marks, `$$$`, a subject too
   long for a phone, dense linking, a body too short to look like a real
   message.

Scoring starts at 100 and subtracts. Repeats of one phrase cost less each time
and stop counting at 2.2× the first hit, so a single word cannot sink the
score on its own. **Anything in the subject is weighted 1.6×** — it is the
most heavily scored part of a message and the only part read before deciding.

Matching is one regex pass for the whole dictionary, built once. Phrases are
tried longest-first, so "limited time offer" wins over "limited time" at the
same position, and the word boundaries are unicode lookarounds rather than
`\b`, which behaves wrongly next to the `%` in "100% free".

Ordinary acronyms (`API`, `PDF`, `CEO`, `NDA`…) are excluded from the shouting
check. Without that, normal B2B copy gets told off for capitalisation, which
is exactly the false positive that makes people stop trusting a linter.

### What it is not

A content check only. Real filters also weigh domain reputation, SPF and DKIM
alignment, list hygiene and engagement history, none of which are visible from
the copy. Good copy still lands in spam on a bad domain, and a clean score
here is not a promise of delivery. The panel says so too.

## Layout

```
app/
  layout.tsx           Fonts, metadata, pre-paint theme script
  page.tsx             Server Component shell
  globals.css          Design tokens, editor typography, highlight styles
components/
  dashboard.tsx            State, header, split layout, mobile tabs
  subject-field.tsx        Subject line, scored as part of deliverability
  editor-pane.tsx          Textarea + highlight overlay
  analysis-panel.tsx       Tab bar; picks one of the three panes below
  readability-pane.tsx     Readability tab
  deliverability-pane.tsx  Deliverability tab: score, tags, checklist
  ai-detection-pane.tsx    AI tab: gauge, signals, the caveat
  grade-meter.tsx          Headline grade and banded scale
  score-ring.tsx           Animated deliverability ring
  ai-gauge.tsx             Animated 180-degree gauge with needle
  hard-sentences.tsx       Flagged sentence list, click to jump
  fix-summary.tsx          What Claude changed, with Undo
  stat-tile.tsx
  theme-toggle.tsx
hooks/
  use-analysis.ts       Deferred, memoised readability
  use-deliverability.ts Deferred, memoised spam check
  use-ai-detection.ts   Deferred, memoised style heuristic
  use-fix.ts            Calls /api/fix, holds the undo buffer
  use-animated-number.ts
  use-stored-string.ts  localStorage as an external store
  use-theme.ts
hooks/
  use-capture.ts       Batches events and snapshots
  use-experiments.ts   Variant assignment for this visitor
lib/
  readability.ts       The engine: syllables, segmentation, scores
  readability.test.ts
  deliverability.ts    Spam dictionary, structural checks, scoring
  deliverability.test.ts
  ai-detection.ts      Style heuristic + provider stub
  ai-detection.test.ts
  experiments.ts       Experiment registry and assignment
  experiments.test.ts
  format.ts            Presentation helpers
  sample-text.ts
  supabase/server.ts   Service role client, server-only
  telemetry/client.ts  Browser-side batching and flush
  telemetry/types.ts   Wire format
app/api/events/
  route.ts             The only place the Supabase service role key is used
app/api/fix/
  route.ts             The only place the Anthropic key is used
```

## Performance

All three analysers run through `useDeferredValue`, so React paints the
keystroke first and recomputes them together at lower priority. Each is a
single pass: readability walks the sentences once, deliverability runs one
combined regex for its whole dictionary, AI detection runs two. The work is
memoised on the deferred text, so an unrelated re-render costs nothing.

## How the highlighting works

A `<textarea>` cannot style its own content, so the editor is two layers that
share every metric that affects where a glyph lands:

1. An overlay holding the same text, with the difficult sentences wrapped in
   `<span>`s. Its text is transparent, so only the colour washes show.
2. The real `<textarea>` on top, with a transparent background.

`analyze()` returns each sentence's start and end offsets into the original
string, and `buildHighlightSegments()` flattens those into consecutive runs that
tile the entire text with no gaps — which is what keeps the two layers aligned
character for character. There is a test asserting that the segments rebuild the
input exactly.

The textarea never scrolls on its own: it is grown to fit its content and the
wrapper does the scrolling. That avoids mirroring `scrollTop` every frame, and
avoids the overlay ending up a scrollbar's width wider than the textarea.

`.editor-type` and `.editor-pad` in `globals.css` are the single source of truth
for those shared metrics. **If you change the editor's font, size, spacing or
padding, change it there** — applying it to only one layer makes the highlights
drift.

## Performance

Analysis runs through `useDeferredValue`, so React paints the keystroke first
and computes the analysis at a lower priority. Long articles keep typing at full
speed. The work itself is memoised on the deferred text.

## AI detection

`lib/ai-detection.ts` scores how *machine-written* the body reads, from six
weighted style signals:

| Signal | Weight | What it looks at |
| --- | --- | --- |
| Sentence variety | 3 | Coefficient of variation of sentence length — "burstiness" |
| Stock connectives | 2.5 | "furthermore", "moreover", "it is worth noting" |
| Stock vocabulary | 2.5 | "delve", "robust", "seamless", "leverage", "tapestry" |
| Contractions | 1.5 | People contract constantly in email; formal prose does not |
| Sentence length | 1 | The steady 18–24 word band |
| Word repetition | 1 | Type-token ratio |

**Below 60 words or 4 sentences it refuses to give a number** rather than
guessing from noise. That felt more honest than a confident reading of two
sentences.

### Read this before trusting it

**This cannot tell you who wrote something, and nothing built from these
signals can.** It measures surface properties that *correlate* with model
output. Careful human writing — technical documentation, legal prose, anything
edited to be uniform — scores high. Sloppy model output scores low.

So it is built and labelled as a style signal: "how robotic does this read",
which is a fair question to ask about your own draft. The caveat is in the
panel itself, at full size, not in small print. It must never be used to
accuse anyone of anything.

`AiDetectionProvider` at the bottom of the file is a drop-in interface if you
ever want to put a real detection service behind the same pane.

## Fix with Claude

The button sends the subject, body, and **what the local analysers already
found** — the flagged sentences, the trigger phrases, both scores — to
`/api/fix`. Handing over the specific problems is what keeps the revision
targeted instead of a generic polish, and it costs almost nothing to include.

- **Model:** `claude-opus-5-5` at `medium` effort. Override with
  `ANTHROPIC_MODEL`. `low` effort runs in ~8s instead of ~15s, but in testing
  `medium` made better editorial calls — it caught a contradiction between a
  "Friday" deadline in the subject and "today only" in the body, and asked
  rather than guessing.
- **Structured output** via `zodOutputFormat`, so the response is always
  `{subject, body, changes[]}`. Note that forced `tool_choice` returns a 400
  on this model — structured outputs are the supported route.
- **Server-side fallbacks** are on (`fallbacks: "default"`), so a safety
  decline re-runs on a fallback model inside the same call instead of
  returning nothing.
- **Rate limited** to 12 requests a minute per IP, in process. This endpoint
  costs real money per call, so it does not go out unguarded.
- The prompt tells Claude to treat the email as content to edit, not as
  instructions to follow.

Every revision is **undoable** — the summary card floats over the editor so
applying one never shifts the text you were reading, and Undo is the primary
action.

Without `ANTHROPIC_API_KEY` the route returns 503, the button hides itself,
and nothing else changes.

## Using it from n8n

`POST /api/analyze` exposes the three engines to a machine caller. It measures
and reports; it never rewrites. That is what makes it safe for an agent to
loop against.

```bash
curl -X POST https://copy-master-drab.vercel.app/api/analyze \
  -H "authorization: Bearer $COPY_MASTER_API_KEY" \
  -H "content-type: application/json" \
  -d '{"subject":"...","body":"Hi Sarah,<br><br>..."}'
```

Returns `passes`, a flat `problems` list the caller can act on, the three
score blocks, and `normalized` with the text in both plain and `<br>` form.
Auth is a bearer token from `COPY_MASTER_API_KEY`; unset means open.

### The `<br>` round trip

The outreach flow carries bodies as JSON with `<br>` breaks and `<a href>`
links. `lib/email-html.ts` normalises that before anything is measured:
`<br><br>` becomes a blank line, a single `<br>` becomes one newline, anchor
text is kept without its markup.

The blank line is the part that matters — `lib/readability.ts` treats it as a
sentence boundary, so losing it would merge the greeting into the first
paragraph and skew every score. Handled server-side, so no prompt has to
remember it, and the endpoint accepts either form.

### Wired into "Email Outreach"

All four agents (`AI Agent`, `Follow Up Agent`, `Follow Up 2 Agent`,
`Follow Up 3 Agent`) have a `Copy Master` HTTP tool and `maxIterations: 6`,
so each can draft, score, fix and re-score before answering. The agents' own
prompts are untouched; the tool instructions live in each agent's
`systemMessage`.

Agents send plain text and keep emitting `\n\n` in their JSON — the existing
Parse nodes still convert that to `<br><br>` downstream, so nothing changed
about what travels onward.

The system message tells each agent that the flow's own rules win: if a fix
would break a word limit or the required structure, it keeps the rule and
leaves the problem unfixed. A linter should not be able to overrule the brief.

### Saved for review

Each tool call also carries `run_id`, `lead_ref`, `company` and `stage`, so
every scoring is stored in `outreach_drafts` and `/review` shows the before
and after.

**Iteration 1 is the agent's untouched first draft.** The iteration number is
derived from what is already stored rather than sent by the caller, so a
confused agent cannot overwrite its own baseline, and the agents are told not
to polish before that first scoring — a pre-cleaned baseline makes the record
worthless.

Saving is best effort and never fails the scoring. The agent is mid-draft when
it calls, and the numbers are what it actually needs.

Unlike `analysis_snapshots`, this table **does** store the copy. These are
your own campaign emails and reading them back is the point.

```sql
select * from draft_improvements order by ended_at desc;
```

## Capture and A/B testing

Supabase project: **Copy-master** (`npghxfkepowspnupsbcj`).

### How a request flows

The browser batches events and snapshots and posts them to `/api/events`
every few seconds, plus once more via `sendBeacon` when the tab is hidden or
closed — a writer closing the tab is exactly the moment worth recording.

That route handler is the only place the Supabase service role key is used.
It is read from `SUPABASE_SERVICE_ROLE_KEY`, which has no `NEXT_PUBLIC_`
prefix and so is never inlined into a client bundle, and
`lib/supabase/server.ts` starts with `import "server-only"` so that importing
it from a Client Component fails the build instead of leaking the key.

**The service role key bypasses Row Level Security completely.** RLS is
enabled on all four tables with *no* policies, which denies the anon and
authenticated roles everything; the service role is the only way in. The
Supabase linter reports this as `rls_enabled_no_policy` at INFO level — here
that is the intended design, not a gap.

Everything arriving at the route is treated as untrusted: ids, timestamps,
numbers and names are all re-validated and clamped before they reach Postgres.

### Tables

| Table | What it holds |
| --- | --- |
| `visitors` | One row per browser. An anonymous UUID minted client side. |
| `experiment_assignments` | Which variant a visitor got. Unique on `(visitor_id, experiment)`, so assignment is sticky. |
| `events` | Interaction stream: sample loaded, cleared, highlights toggled, sentence opened. |
| `analysis_snapshots` | Derived readability *and* deliverability metrics for a document over time. |

The deliverability columns (`subject_length`, `deliverability_score`,
`spam_hit_count`, `spam_severe_count`) are nullable. Rows captured before they
existed hold NULL, which is more honest than a backfilled zero that would drag
every average down.

Two views do the reporting:

- `doc_outcomes` — one row per document: where its readability started, where
  it ended, how many revisions it took.
- `variant_outcomes` — the A/B readout. Compare `avg_grade_delta` across
  variants; more negative means the copy improved more.

```sql
select * from variant_outcomes;
```

### The running experiment

`highlight-thresholds` asks whether a stricter highlighter actually makes
people simplify their copy, or whether it flags so much that they stop
trusting it:

| Variant | Min words | Hard | Very hard |
| --- | --- | --- | --- |
| `control` | 14 | 10 | 14 |
| `strict` | 11 | 7 | 11 |

Assignment is a pure hash of the visitor id (`lib/experiments.ts`), so there
is no request to wait on and no flash of the wrong variant — the id and the
saved draft arrive in the same commit, so the thresholds are right the first
time any text is on screen.

Thresholds only change which sentences get flagged, never the counts or the
document-level scores, so the two arms stay directly comparable. There is a
test asserting both of those properties, and another asserting the variants
actually *disagree* on realistic copy — two variants that flag identically
would make the experiment inert, collecting data that could never show a
difference. That test exists because the first tuning of `strict` did exactly
that.

To add an experiment, add it to `EXPERIMENTS`; assignment, persistence and
reporting all pick it up without further changes.

### What is not recorded

No account, no email, no IP, and **not the copy itself**. Snapshots store a
SHA-256 of the content, which is enough to tell "same document, edited" from
"new document" without revealing what was written.

Storing the raw text is possible but deliberately awkward: it needs
`CAPTURE_TEXT_SAMPLES=true` on the server *and*
`NEXT_PUBLIC_CAPTURE_TEXT_SAMPLES=true` in the browser. Either one off means
nothing is sent and nothing is stored. Turn it on only if you need the text,
and remember that column then holds whatever a user pasted.

`NEXT_PUBLIC_CAPTURE_ENABLED=false` turns the whole thing off.

## Notes

- The draft is kept in `localStorage`, read through `useSyncExternalStore` so
  the server render and hydration agree without a restore-in-an-effect.
- Dark mode follows the OS by default; the toggle stores an override and a small
  inline script applies it before first paint.
- The formulas are English-only. They count syllables and sentence lengths, so
  they will produce numbers for other languages, just not meaningful ones.
