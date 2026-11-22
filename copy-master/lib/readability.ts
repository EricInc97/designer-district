/**
 * Readability engine
 * ------------------
 * Pure, dependency-free text analysis. Everything here is synchronous and
 * deterministic so it can run on every keystroke inside a `useMemo`.
 *
 * Formulas used (all standard, all English-only):
 *
 *   Flesch Reading Ease  = 206.835 - 1.015 * (words / sentences)
 *                                  - 84.6 * (syllables / words)
 *   Flesch-Kincaid Grade = 0.39 * (words / sentences)
 *                                  + 11.8 * (syllables / words) - 15.59
 *   Automated Readability Index (ARI)
 *                        = 4.71 * (letters / words)
 *                                  + 0.5 * (words / sentences) - 21.43
 *
 * The headline "grade level" is Flesch-Kincaid, because that is the number
 * most people mean by "reading grade level". ARI is kept as a cross-check and
 * is also what drives per-sentence highlighting, since it reacts to long words
 * without needing a reliable syllable count for a single short sentence.
 */

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type Difficulty = "ok" | "hard" | "very-hard";

export interface Sentence {
  id: number;
  /** Inclusive start offset in the original text. */
  start: number;
  /** Exclusive end offset in the original text. */
  end: number;
  text: string;
  wordCount: number;
  syllableCount: number;
  letterCount: number;
  /** Per-sentence reading grade (ARI, clamped). */
  grade: number;
  difficulty: Difficulty;
}

export interface Analysis {
  isEmpty: boolean;

  /* counts */
  words: number;
  characters: number;
  charactersNoSpaces: number;
  letters: number;
  syllables: number;
  paragraphs: number;
  sentenceCount: number;
  complexWords: number;

  /* scores */
  grade: number;
  gradeBand: GradeBand;
  ari: number;
  fleschReadingEase: number;
  readingEaseBand: EaseBand;

  /* derived */
  avgWordsPerSentence: number;
  avgSyllablesPerWord: number;
  readingTimeSeconds: number;
  speakingTimeSeconds: number;

  /* sentence level */
  sentences: Sentence[];
  hardCount: number;
  veryHardCount: number;
  longestSentence: Sentence | null;
}

/* -------------------------------------------------------------------------- */
/* Tuning constants                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Average silent reading rate for English prose, in words per minute.
 * 238 wpm is the meta-analytic mean reported by Brysbaert (2019).
 */
export const READING_WPM = 238;

/** Average speaking rate, for "how long if I read this aloud". */
export const SPEAKING_WPM = 150;

/**
 * Sentences shorter than this are never flagged. A punchy seven-word sentence
 * can score a high grade off a single polysyllabic word, and flagging it would
 * only teach you to distrust the highlights.
 */
export const MIN_WORDS_TO_FLAG = 14;

/** Per-sentence grade at which a sentence becomes "hard to read". */
export const HARD_GRADE = 10;

/** Per-sentence grade at which a sentence becomes "very hard to read". */
export const VERY_HARD_GRADE = 14;

/**
 * The three numbers above, bundled so they can be varied per visitor. This is
 * what the `highlight-thresholds` experiment swaps out; see `lib/experiments`.
 */
export interface DifficultyThresholds {
  minWordsToFlag: number;
  hardGrade: number;
  veryHardGrade: number;
}

export const DEFAULT_THRESHOLDS: DifficultyThresholds = {
  minWordsToFlag: MIN_WORDS_TO_FLAG,
  hardGrade: HARD_GRADE,
  veryHardGrade: VERY_HARD_GRADE,
};

/* -------------------------------------------------------------------------- */
/* Syllables                                                                  */
/* -------------------------------------------------------------------------- */

/** Words the heuristic below gets wrong often enough to hard-code. */
const SYLLABLE_EXCEPTIONS: Record<string, number> = {
  area: 3,
  because: 2,
  being: 2,
  business: 2,
  create: 2,
  every: 3,
  everyone: 3,
  everything: 3,
  idea: 3,
  ion: 2,
  maybe: 2,
  people: 2,
  really: 3,
  science: 2,
  someone: 2,
  the: 1,
};

/**
 * Patterns that add a syllable the vowel-group count would miss, because the
 * two vowels are adjacent and so collapse into one `[aeiouy]+` match.
 *
 * Note there is no `-le` rule here: the silent-ending trim below deliberately
 * keeps the `e` in "ta-ble" and "sim-ple", so those already count correctly.
 */
const ADD_SYLLABLE: RegExp[] = [
  /ia/, // med-i-a
  /riet/, // va-ri-et-y
  /dien/, // au-di-ence
  /ism$/, // pri-sm
  /eo/, // vid-e-o
  /ua/, // grad-u-al
  /uo/, // du-o
  /iou/, // cur-i-ous
  /ying$/, // ly-ing
];

/**
 * Patterns where the vowel-group count over-counts, usually because one of
 * the `ADD_SYLLABLE` rules above fired on a cluster that is really one sound.
 */
const SUBTRACT_SYLLABLE: RegExp[] = [
  /cial$/, // so-cial, not so-ci-al
  /tia$/,
  /cius$/,
  /giu/,
  /sia$/,
  /[^aeiou]ely$/, // love-ly
  /ue$/, // tru-e
];

/**
 * Estimate the syllable count of a single English word.
 *
 * Counts vowel groups, then corrects with a small set of pattern rules. On
 * ordinary prose this lands within a few percent of a pronouncing dictionary,
 * which is all the Flesch family of formulas needs.
 */
export function countSyllables(rawWord: string): number {
  const word = rawWord.toLowerCase().replace(/[^a-z]/g, "");
  if (!word) return 0;

  const known = SYLLABLE_EXCEPTIONS[word];
  if (known !== undefined) return known;

  if (word.length <= 3) return 1;

  // Strip silent endings that would otherwise read as their own vowel group.
  const trimmed = word
    .replace(/(?:[^laeiouy]es|[^laeiouy]e)$/, "")
    .replace(/^y/, "");

  const groups = trimmed.match(/[aeiouy]+/g);
  let count = groups ? groups.length : 0;

  for (const pattern of ADD_SYLLABLE) {
    if (pattern.test(word)) count += 1;
  }
  for (const pattern of SUBTRACT_SYLLABLE) {
    if (pattern.test(word)) count -= 1;
  }

  return Math.max(1, count);
}

/* -------------------------------------------------------------------------- */
/* Tokenising                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A "word" is a run of letters and digits plus intra-word punctuation
 * (apostrophes and hyphens), so "don't" and "state-of-the-art" each count once.
 */
const WORD_RE = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

export function words(text: string): string[] {
  return text.match(WORD_RE) ?? [];
}

export function countWords(text: string): number {
  return words(text).length;
}

/** Letters and digits only -- what ARI means by "characters". */
function countLetters(text: string): number {
  const matched = text.match(/[\p{L}\p{N}]/gu);
  return matched ? matched.length : 0;
}

/* -------------------------------------------------------------------------- */
/* Sentence segmentation                                                      */
/* -------------------------------------------------------------------------- */

/** Tokens that end in a period without ending a sentence. */
const ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "mx", "dr", "prof", "rev", "hon", "sr", "jr", "st",
  "vs", "etc", "eg", "ie", "al", "approx", "appt", "apt", "dept", "est",
  "fig", "gov", "inc", "ltd", "llc", "co", "corp", "no", "nos", "vol",
  "pp", "ph", "phd", "md", "ba", "ma", "bsc", "msc", "ed", "eds", "ca",
  "cf", "ibid", "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep",
  "sept", "oct", "nov", "dec", "mon", "tue", "tues", "wed", "thu", "thur",
  "thurs", "fri", "sat", "sun", "am", "pm", "us", "usa", "uk", "eu",
]);

const TERMINATORS = new Set([".", "!", "?", "…"]);

/** Quotes and brackets that belong to the sentence they follow. */
const TRAILING = new Set([
  '"',
  "'",
  "”",
  "’",
  ")",
  "]",
  "}",
  "»",
]);

function isAbbreviation(text: string, periodIndex: number): boolean {
  // Walk back over the word immediately before the period.
  let i = periodIndex - 1;
  while (i >= 0 && /[\p{L}\p{N}.]/u.test(text[i]!)) i -= 1;
  const token = text
    .slice(i + 1, periodIndex)
    .toLowerCase()
    .replace(/\./g, "");
  if (!token) return false;

  // Single initials: "J. K. Rowling", "U. S. Army".
  if (token.length === 1) return true;

  return ABBREVIATIONS.has(token);
}

function isDecimalPoint(text: string, index: number): boolean {
  return /\d/.test(text[index - 1] ?? "") && /\d/.test(text[index + 1] ?? "");
}

/**
 * Split text into sentence ranges.
 *
 * Rules, in order of precedence:
 *   1. A blank line always ends a sentence, punctuation or not. This is what
 *      makes pasted email copy work -- greetings, sign-offs and one-line
 *      headings become their own sentences instead of merging into the body.
 *   2. `.`, `!`, `?` and an ellipsis end a sentence when followed by
 *      whitespace or the end of the text, unless the period is a decimal
 *      point, an initial, or a known abbreviation.
 *   3. A single newline is just whitespace, so hard-wrapped prose stays whole.
 *
 * The returned ranges tile the entire string with no gaps, which is what lets
 * the editor overlay stay in lockstep with the textarea behind it.
 */
export function splitSentences(
  text: string,
): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  let start = 0;

  const push = (end: number) => {
    if (end <= start) return;
    const slice = text.slice(start, end);
    if (slice.trim().length > 0) {
      ranges.push({ start, end });
      start = end;
    }
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;

    // Rule 1: blank line.
    if (char === "\n" && /^\n[ \t]*\r?\n/.test(text.slice(i))) {
      push(i);
      continue;
    }

    // Rule 2: terminal punctuation.
    if (!TERMINATORS.has(char)) continue;
    if (char === "." && isDecimalPoint(text, i)) continue;
    if (char === "." && isAbbreviation(text, i)) continue;

    // Consume repeated terminators ("...", "?!") and trailing quotes.
    let end = i + 1;
    while (end < text.length && TERMINATORS.has(text[end]!)) end += 1;
    while (end < text.length && TRAILING.has(text[end]!)) end += 1;

    const next = text[end];
    // A terminator mid-token ("example.com") is not a boundary.
    if (next !== undefined && !/\s/.test(next)) {
      i = end - 1;
      continue;
    }

    // Keep the spaces that follow with the sentence, so offsets stay gapless.
    while (end < text.length && /[ \t]/.test(text[end]!)) end += 1;

    push(end);
    i = end - 1;
  }

  // Whatever is left over is a final, unpunctuated sentence.
  if (start < text.length && text.slice(start).trim().length > 0) {
    ranges.push({ start, end: text.length });
  }

  return ranges;
}

/* -------------------------------------------------------------------------- */
/* Scores                                                                     */
/* -------------------------------------------------------------------------- */

function clampGrade(grade: number): number {
  if (!Number.isFinite(grade)) return 0;
  return Math.min(22, Math.max(1, grade));
}

export function fleschKincaidGrade(
  wordCount: number,
  sentenceCount: number,
  syllableCount: number,
): number {
  if (!wordCount || !sentenceCount) return 0;
  return (
    0.39 * (wordCount / sentenceCount) +
    11.8 * (syllableCount / wordCount) -
    15.59
  );
}

export function fleschReadingEase(
  wordCount: number,
  sentenceCount: number,
  syllableCount: number,
): number {
  if (!wordCount || !sentenceCount) return 0;
  return (
    206.835 -
    1.015 * (wordCount / sentenceCount) -
    84.6 * (syllableCount / wordCount)
  );
}

export function automatedReadabilityIndex(
  wordCount: number,
  sentenceCount: number,
  letterCount: number,
): number {
  if (!wordCount || !sentenceCount) return 0;
  return (
    4.71 * (letterCount / wordCount) + 0.5 * (wordCount / sentenceCount) - 21.43
  );
}

/* -------------------------------------------------------------------------- */
/* Bands                                                                      */
/* -------------------------------------------------------------------------- */

export interface GradeBand {
  key: "great" | "good" | "ok" | "poor";
  label: string;
  note: string;
}

const GRADE_BANDS: Record<GradeBand["key"], GradeBand> = {
  great: {
    key: "great",
    label: "Great",
    note: "Clear to almost every reader.",
  },
  good: {
    key: "good",
    label: "Good",
    note: "Comfortable for a general audience.",
  },
  ok: {
    key: "ok",
    label: "OK",
    note: "Getting dense. Worth another pass.",
  },
  poor: {
    key: "poor",
    label: "Hard work",
    note: "Most readers will skim or give up.",
  },
};

/** Hemingway's rule of thumb: aim for grade 9 or below. */
export function gradeBand(grade: number): GradeBand {
  if (grade <= 6) return GRADE_BANDS.great;
  if (grade <= 9) return GRADE_BANDS.good;
  if (grade <= 12) return GRADE_BANDS.ok;
  return GRADE_BANDS.poor;
}

export interface EaseBand {
  label: string;
  audience: string;
}

export function readingEaseBand(score: number): EaseBand {
  if (score >= 90) return { label: "Very easy", audience: "11-year-old" };
  if (score >= 80) return { label: "Easy", audience: "12-year-old" };
  if (score >= 70) return { label: "Fairly easy", audience: "13-year-old" };
  if (score >= 60) return { label: "Plain English", audience: "15-year-old" };
  if (score >= 50) return { label: "Fairly hard", audience: "high schooler" };
  if (score >= 30) return { label: "Hard", audience: "college student" };
  return { label: "Very hard", audience: "graduate" };
}

/* -------------------------------------------------------------------------- */
/* Sentence difficulty                                                        */
/* -------------------------------------------------------------------------- */

function difficultyFor(
  wordCount: number,
  grade: number,
  thresholds: DifficultyThresholds,
): Difficulty {
  if (wordCount < thresholds.minWordsToFlag) return "ok";
  if (grade >= thresholds.veryHardGrade) return "very-hard";
  if (grade >= thresholds.hardGrade) return "hard";
  return "ok";
}

/* -------------------------------------------------------------------------- */
/* Main entry point                                                           */
/* -------------------------------------------------------------------------- */

export const EMPTY_ANALYSIS: Analysis = {
  isEmpty: true,
  words: 0,
  characters: 0,
  charactersNoSpaces: 0,
  letters: 0,
  syllables: 0,
  paragraphs: 0,
  sentenceCount: 0,
  complexWords: 0,
  grade: 0,
  gradeBand: GRADE_BANDS.great,
  ari: 0,
  fleschReadingEase: 0,
  readingEaseBand: { label: "--", audience: "--" },
  avgWordsPerSentence: 0,
  avgSyllablesPerWord: 0,
  readingTimeSeconds: 0,
  speakingTimeSeconds: 0,
  sentences: [],
  hardCount: 0,
  veryHardCount: 0,
  longestSentence: null,
};

/**
 * Analyse a block of text. One pass over the sentences, so it stays cheap
 * enough to call on every render of a long article.
 *
 * `thresholds` only affects which sentences get flagged, never the counts or
 * the document-level scores, so two variants stay directly comparable.
 */
export function analyze(
  text: string,
  thresholds: DifficultyThresholds = DEFAULT_THRESHOLDS,
): Analysis {
  if (!text.trim()) return EMPTY_ANALYSIS;

  const ranges = splitSentences(text);
  const sentences: Sentence[] = [];

  let totalWords = 0;
  let totalSyllables = 0;
  let totalLetters = 0;
  let complexWords = 0;
  let hardCount = 0;
  let veryHardCount = 0;
  let longestSentence: Sentence | null = null;

  ranges.forEach((range, index) => {
    const slice = text.slice(range.start, range.end);
    const tokens = words(slice);

    let syllableCount = 0;
    for (const token of tokens) {
      const syllables = countSyllables(token);
      syllableCount += syllables;
      if (syllables >= 3) complexWords += 1;
    }

    const letterCount = countLetters(slice);
    const wordCount = tokens.length;

    // Per-sentence grade: ARI over a single sentence, which reproduces how
    // Hemingway's highlighting behaves -- long sentences built out of long
    // words get flagged, short ones never do.
    const grade = clampGrade(
      automatedReadabilityIndex(wordCount, 1, letterCount),
    );
    const difficulty = difficultyFor(wordCount, grade, thresholds);

    const sentence: Sentence = {
      id: index,
      start: range.start,
      end: range.end,
      text: slice.trim(),
      wordCount,
      syllableCount,
      letterCount,
      grade,
      difficulty,
    };

    if (difficulty === "hard") hardCount += 1;
    if (difficulty === "very-hard") veryHardCount += 1;
    if (!longestSentence || wordCount > longestSentence.wordCount) {
      longestSentence = sentence;
    }

    totalWords += wordCount;
    totalSyllables += syllableCount;
    totalLetters += letterCount;
    sentences.push(sentence);
  });

  const sentenceCount = sentences.length;
  const paragraphs = text
    .split(/\n[ \t]*\r?\n/)
    .filter((block) => block.trim().length > 0).length;

  const rawGrade = fleschKincaidGrade(
    totalWords,
    sentenceCount,
    totalSyllables,
  );
  const grade = clampGrade(rawGrade);
  const rawEase = fleschReadingEase(totalWords, sentenceCount, totalSyllables);

  return {
    isEmpty: false,
    words: totalWords,
    characters: text.length,
    charactersNoSpaces: text.replace(/\s/g, "").length,
    letters: totalLetters,
    syllables: totalSyllables,
    paragraphs,
    sentenceCount,
    complexWords,
    grade,
    gradeBand: gradeBand(grade),
    ari: clampGrade(
      automatedReadabilityIndex(totalWords, sentenceCount, totalLetters),
    ),
    fleschReadingEase: Math.max(0, Math.min(121, rawEase)),
    readingEaseBand: readingEaseBand(rawEase),
    avgWordsPerSentence: sentenceCount ? totalWords / sentenceCount : 0,
    avgSyllablesPerWord: totalWords ? totalSyllables / totalWords : 0,
    readingTimeSeconds: (totalWords / READING_WPM) * 60,
    speakingTimeSeconds: (totalWords / SPEAKING_WPM) * 60,
    sentences,
    hardCount,
    veryHardCount,
    longestSentence,
  };
}

/* -------------------------------------------------------------------------- */
/* Highlight segments                                                         */
/* -------------------------------------------------------------------------- */

export interface HighlightSegment {
  key: string;
  text: string;
  difficulty: Difficulty;
  sentenceId: number | null;
}

/**
 * Flatten the analysis into consecutive text runs for the editor overlay.
 * Every character of `text` lands in exactly one segment, which is what keeps
 * the overlay character-for-character aligned with the textarea above it.
 */
export function buildHighlightSegments(
  text: string,
  sentences: Sentence[],
): HighlightSegment[] {
  const segments: HighlightSegment[] = [];
  let cursor = 0;

  for (const sentence of sentences) {
    if (sentence.difficulty === "ok") continue;
    if (sentence.start < cursor) continue;

    if (sentence.start > cursor) {
      segments.push({
        key: `plain-${cursor}`,
        text: text.slice(cursor, sentence.start),
        difficulty: "ok",
        sentenceId: null,
      });
    }

    // Mark the sentence but not the whitespace around it, so the highlight
    // stops at the full stop instead of bleeding into the next line.
    const raw = text.slice(sentence.start, sentence.end);
    const leading = raw.length - raw.trimStart().length;
    const trailing = raw.length - raw.trimEnd().length;

    if (leading > 0) {
      segments.push({
        key: `lead-${sentence.id}`,
        text: raw.slice(0, leading),
        difficulty: "ok",
        sentenceId: null,
      });
    }

    segments.push({
      key: `mark-${sentence.id}`,
      text: raw.slice(leading, raw.length - trailing),
      difficulty: sentence.difficulty,
      sentenceId: sentence.id,
    });

    if (trailing > 0) {
      segments.push({
        key: `trail-${sentence.id}`,
        text: raw.slice(raw.length - trailing),
        difficulty: "ok",
        sentenceId: null,
      });
    }

    cursor = sentence.end;
  }

  if (cursor < text.length) {
    segments.push({
      key: `plain-${cursor}`,
      text: text.slice(cursor),
      difficulty: "ok",
      sentenceId: null,
    });
  }

  return segments;
}
