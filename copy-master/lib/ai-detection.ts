/**
 * AI detection (heuristic)
 * ------------------------
 * Scores how *machine-written* a piece of text reads, from stylistic signals
 * only. No model, no network — the same single-pass, deterministic shape as
 * the other two engines so it can run on every keystroke.
 *
 * READ THIS BEFORE TRUSTING THE NUMBER
 *
 * This cannot prove who or what wrote something, and nothing built from these
 * signals can. It measures a handful of surface properties that *correlate*
 * with model output: even sentence lengths, a thin band of vocabulary,
 * connective tissue like "furthermore", and a particular register. Careful
 * human writing — technical documentation, legal prose, anything edited to be
 * uniform — scores high. Sloppy model output scores low.
 *
 * So it is built and labelled as a *style* signal: "how robotic does this
 * read", which is a useful question to ask about your own draft. It is not
 * evidence, and it must never be used to accuse anyone of anything.
 *
 * `API_STUB` at the bottom is where a real detection service would go if you
 * ever want one.
 */

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface Signal {
  id: string;
  label: string;
  /** 0-100, where 100 means "this signal looks maximally machine-like". */
  score: number;
  /** How much this signal counts toward the headline number. */
  weight: number;
  detail: string;
}

export interface AiBand {
  key: "human" | "mixed" | "likely" | "machine";
  label: string;
  note: string;
}

export interface AiDetectionReport {
  isEmpty: boolean;
  /** Too little text to say anything. The score is withheld, not guessed. */
  tooShort: boolean;
  /** 0-100. 0 = reads human, 100 = reads machine-generated. */
  score: number;
  band: AiBand;
  signals: Signal[];
  /** Raw measurements, surfaced for the detail rows. */
  sentenceCount: number;
  burstiness: number;
  meanSentenceWords: number;
  transitionHits: string[];
  tellHits: string[];
  contractionCount: number;
  typeTokenRatio: number;
}

/** Below this there is not enough signal for the numbers to mean anything. */
export const MIN_WORDS_FOR_SCORE = 60;
export const MIN_SENTENCES_FOR_SCORE = 4;

/* -------------------------------------------------------------------------- */
/* Vocabulary                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Formal connectives. Models reach for these far more often than people do in
 * email, and they cluster at sentence openings.
 */
const TRANSITIONS = [
  "additionally",
  "consequently",
  "furthermore",
  "moreover",
  "nevertheless",
  "nonetheless",
  "notably",
  "subsequently",
  "therefore",
  "thus",
  "whereas",
  "in addition",
  "in conclusion",
  "in essence",
  "in summary",
  "that said",
  "as such",
  "to that end",
  "by contrast",
  "on the other hand",
  "it is worth noting",
  "it's worth noting",
  "it is important to note",
  "it's important to note",
  "importantly",
  "ultimately",
  "overall",
];

/**
 * Register tells. Vocabulary that is unremarkable once and conspicuous three
 * times in a short email.
 */
const TELLS = [
  "delve",
  "tapestry",
  "landscape",
  "realm",
  "underscore",
  "underscores",
  "pivotal",
  "crucial",
  "robust",
  "leverage",
  "leveraging",
  "seamless",
  "seamlessly",
  "testament",
  "navigate",
  "navigating",
  "foster",
  "fostering",
  "comprehensive",
  "holistic",
  "multifaceted",
  "nuanced",
  "myriad",
  "plethora",
  "paradigm",
  "synergy",
  "streamline",
  "streamlined",
  "elevate",
  "empower",
  "unlock",
  "harness",
  "cutting-edge",
  "state-of-the-art",
  "game-changer",
  "transformative",
  "unparalleled",
  "meticulous",
  "meticulously",
  "intricate",
  "vibrant",
  "bustling",
  "embark",
  "journey",
  "ever-evolving",
  "rapidly evolving",
  "in today's",
];

const CONTRACTION_RE =
  /\b\w+['’](?:t|s|re|ve|ll|d|m)\b/gi;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPhrasePattern(phrases: string[]): RegExp {
  return new RegExp(
    "(?<![\\p{L}\\p{N}])(?:" +
      [...phrases]
        .sort((a, b) => b.length - a.length)
        .map((phrase) => escapeRegExp(phrase).replace(/ /g, "\\s+"))
        .join("|") +
      ")(?![\\p{L}\\p{N}])",
    "giu",
  );
}

const TRANSITION_RE = buildPhrasePattern(TRANSITIONS);
const TELL_RE = buildPhrasePattern(TELLS);

function matchPhrases(text: string, pattern: RegExp): string[] {
  pattern.lastIndex = 0;
  const found: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    found.push(match[0].toLowerCase().replace(/\s+/g, " "));
  }
  return found;
}

/** Map a measurement onto 0-100 by where it sits between two bounds. */
function scale(value: number, atZero: number, atHundred: number): number {
  if (atZero === atHundred) return 0;
  const ratio = (value - atZero) / (atHundred - atZero);
  return Math.max(0, Math.min(100, ratio * 100));
}

function splitSentencesSimple(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+|\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function wordsOf(text: string): string[] {
  return text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? [];
}

/* -------------------------------------------------------------------------- */
/* Bands                                                                      */
/* -------------------------------------------------------------------------- */

const BANDS: Record<AiBand["key"], AiBand> = {
  human: {
    key: "human",
    label: "Reads human",
    note: "Varied rhythm and natural word choice.",
  },
  mixed: {
    key: "mixed",
    label: "Mixed",
    note: "Some even patches, but it still has a pulse.",
  },
  likely: {
    key: "likely",
    label: "Reads generated",
    note: "Uniform sentences and stock connectives.",
  },
  machine: {
    key: "machine",
    label: "Very uniform",
    note: "Flat rhythm and heavy stock vocabulary throughout.",
  },
};

export function aiBand(score: number): AiBand {
  if (score < 30) return BANDS.human;
  if (score < 55) return BANDS.mixed;
  if (score < 78) return BANDS.likely;
  return BANDS.machine;
}

/* -------------------------------------------------------------------------- */
/* Main entry point                                                           */
/* -------------------------------------------------------------------------- */

const EMPTY: AiDetectionReport = {
  isEmpty: true,
  tooShort: true,
  score: 0,
  band: BANDS.human,
  signals: [],
  sentenceCount: 0,
  burstiness: 0,
  meanSentenceWords: 0,
  transitionHits: [],
  tellHits: [],
  contractionCount: 0,
  typeTokenRatio: 0,
};

export function detectAi(text: string): AiDetectionReport {
  if (!text.trim()) return EMPTY;

  const sentences = splitSentencesSimple(text);
  const words = wordsOf(text);
  const lengths = sentences.map((sentence) => wordsOf(sentence).length);

  const transitionHits = matchPhrases(text, TRANSITION_RE);
  const tellHits = matchPhrases(text, TELL_RE);
  const contractionCount = (text.match(CONTRACTION_RE) ?? []).length;

  const lower = words.map((word) => word.toLowerCase());
  const typeTokenRatio = words.length
    ? new Set(lower).size / words.length
    : 0;

  const mean = lengths.length
    ? lengths.reduce((total, n) => total + n, 0) / lengths.length
    : 0;
  const variance = lengths.length
    ? lengths.reduce((total, n) => total + (n - mean) ** 2, 0) / lengths.length
    : 0;
  /** Coefficient of variation: sentence-length variety, scale-independent. */
  const burstiness = mean > 0 ? Math.sqrt(variance) / mean : 0;

  if (
    words.length < MIN_WORDS_FOR_SCORE ||
    sentences.length < MIN_SENTENCES_FOR_SCORE
  ) {
    return {
      ...EMPTY,
      isEmpty: false,
      tooShort: true,
      sentenceCount: sentences.length,
      burstiness,
      meanSentenceWords: mean,
      transitionHits,
      tellHits,
      contractionCount,
      typeTokenRatio,
    };
  }

  const per100 = (count: number) => (count / words.length) * 100;

  /* ---------------------------------------------------------------- */
  /* Signals                                                          */
  /* ---------------------------------------------------------------- */

  const signals: Signal[] = [
    {
      id: "burstiness",
      label: "Sentence variety",
      // Human prose typically lands around 0.5-0.8; model output clusters
      // tighter. Inverted: low variation is the machine-like direction.
      score: scale(burstiness, 0.75, 0.15),
      weight: 3,
      detail:
        burstiness < 0.3
          ? "Sentences are nearly all the same length."
          : burstiness < 0.5
            ? "Some variation, but the rhythm is even."
            : "Good mix of long and short sentences.",
    },
    {
      id: "length",
      label: "Sentence length",
      // A steady 18-24 words is the classic generated-prose band.
      score: scale(Math.abs(mean - 21), 12, 0),
      weight: 1,
      detail: `Averaging ${mean.toFixed(1)} words a sentence.`,
    },
    {
      id: "transitions",
      label: "Stock connectives",
      score: scale(per100(transitionHits.length), 0, 2.5),
      weight: 2.5,
      detail:
        transitionHits.length === 0
          ? "None found."
          : `${transitionHits.length} found: ${[...new Set(transitionHits)].slice(0, 4).join(", ")}.`,
    },
    {
      id: "tells",
      label: "Stock vocabulary",
      score: scale(per100(tellHits.length), 0, 3),
      weight: 2.5,
      detail:
        tellHits.length === 0
          ? "None found."
          : `${tellHits.length} found: ${[...new Set(tellHits)].slice(0, 4).join(", ")}.`,
    },
    {
      id: "contractions",
      label: "Contractions",
      // People contract constantly in email; formal generated prose does not.
      score: scale(per100(contractionCount), 2.2, 0),
      weight: 1.5,
      detail:
        contractionCount === 0
          ? "None. Formal registers read as machine-written."
          : `${contractionCount} used, which reads conversational.`,
    },
    {
      id: "vocabulary",
      label: "Word repetition",
      // A very high type-token ratio in short text is normal; a low one
      // suggests a narrow band of recycled vocabulary.
      score: scale(typeTokenRatio, 0.72, 0.38),
      weight: 1,
      detail: `${Math.round(typeTokenRatio * 100)}% of words are distinct.`,
    },
  ];

  const totalWeight = signals.reduce((total, signal) => total + signal.weight, 0);
  const weighted = signals.reduce(
    (total, signal) => total + signal.score * signal.weight,
    0,
  );
  const score = Math.round(weighted / totalWeight);

  return {
    isEmpty: false,
    tooShort: false,
    score,
    band: aiBand(score),
    signals: signals.sort((a, b) => b.score * b.weight - a.score * a.weight),
    sentenceCount: sentences.length,
    burstiness,
    meanSentenceWords: mean,
    transitionHits,
    tellHits,
    contractionCount,
    typeTokenRatio,
  };
}

/* -------------------------------------------------------------------------- */
/* External service stub                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Drop-in shape for a real detection API, if you ever wire one up.
 *
 * Deliberately returns the same `AiDetectionReport`, so the pane does not care
 * which produced it: implement this, call it from a route handler (keeping the
 * vendor key server-side, like `/api/fix` does), and have the hook prefer the
 * remote result when it arrives while showing the local one immediately.
 */
export interface AiDetectionProvider {
  name: string;
  analyze(text: string, signal?: AbortSignal): Promise<AiDetectionReport>;
}

export const LOCAL_PROVIDER: AiDetectionProvider = {
  name: "local-heuristic",
  analyze: async (text: string) => detectAi(text),
};
