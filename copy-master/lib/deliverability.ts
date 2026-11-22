/**
 * Deliverability
 * --------------
 * Looks at a subject line and body the way a spam filter roughly would, and
 * says what would make it less likely to land in a junk folder.
 *
 * Two kinds of signal:
 *
 *   1. Trigger phrases -- the dictionary below. Weighted, because "viagra" and
 *      "free" are not the same problem.
 *   2. Structural tells -- SHOUTING, "!!!", "$$$", a subject that is too long
 *      to read on a phone, a body too short to look like a real message.
 *
 * Real filters score hundreds of features including domain reputation, SPF and
 * DKIM alignment, engagement history and link reputation, none of which are
 * visible from the copy alone. This is a content check, not a verdict: good
 * copy can still land in spam on a bad domain, and a clean score here is not a
 * promise of delivery.
 */

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type SpamCategory =
  | "urgency"
  | "money"
  | "guarantee"
  | "free"
  | "overpromise"
  | "health"
  | "finance"
  | "deceptive"
  | "cliche";

/** 1 = weak signal, common in honest copy. 3 = classic filter landmine. */
export type SpamSeverity = 1 | 2 | 3;

export interface SpamTerm {
  phrase: string;
  category: SpamCategory;
  severity: SpamSeverity;
}

export interface SpamHit {
  /** The dictionary entry, lower-case. */
  phrase: string;
  category: SpamCategory;
  severity: SpamSeverity;
  count: number;
  inSubject: boolean;
  inBody: boolean;
  penalty: number;
}

export type CheckStatus = "pass" | "warn" | "fail";

export interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  penalty: number;
}

export interface DeliverabilityBand {
  key: "inbox" | "good" | "risky" | "spam";
  label: string;
  note: string;
}

export interface DeliverabilityReport {
  isEmpty: boolean;
  /** 0-100. Higher is better. */
  score: number;
  band: DeliverabilityBand;
  hits: SpamHit[];
  checks: Check[];
  /** Total trigger phrase occurrences across subject and body. */
  totalHits: number;
  subjectLength: number;
  shoutedWords: number;
  exclamations: number;
  linkCount: number;
  bodyWords: number;
}

/* -------------------------------------------------------------------------- */
/* Tuning                                                                     */
/* -------------------------------------------------------------------------- */

/** First-occurrence cost of a trigger phrase, by severity. */
const SEVERITY_PENALTY: Record<SpamSeverity, number> = {
  1: 3,
  2: 8,
  3: 14,
};

/** Each repeat costs this fraction of the first hit... */
const REPEAT_FACTOR = 0.4;
/** ...up to this multiple of it, so one word cannot sink the whole score. */
const REPEAT_CAP = 2.2;

/**
 * Anything in the subject is weighted harder. It is the most heavily scored
 * part of a message and the only part a recipient sees before deciding.
 */
const SUBJECT_MULTIPLIER = 1.6;

/** Subject length that reads well in a phone inbox. */
export const SUBJECT_MIN = 28;
export const SUBJECT_MAX = 60;

/* -------------------------------------------------------------------------- */
/* Dictionary                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Phrases are lower-case and single-spaced. Matching is case-insensitive,
 * tolerant of line breaks inside a phrase, and bounded so "free" does not fire
 * inside "freedom".
 *
 * Severity 1 entries are deliberately common words. They are included because
 * filters do weigh them, but they cost little on their own -- the point is to
 * notice a pile-up, not to tell someone the word "offer" is forbidden.
 */
export const SPAM_TERMS: SpamTerm[] = [
  /* Urgency ---------------------------------------------------------------- */
  { phrase: "act now", category: "urgency", severity: 3 },
  { phrase: "act immediately", category: "urgency", severity: 3 },
  { phrase: "apply now", category: "urgency", severity: 2 },
  { phrase: "buy now", category: "urgency", severity: 2 },
  { phrase: "call now", category: "urgency", severity: 2 },
  { phrase: "click here", category: "urgency", severity: 2 },
  { phrase: "click below", category: "urgency", severity: 2 },
  { phrase: "do it today", category: "urgency", severity: 2 },
  { phrase: "don't delete", category: "urgency", severity: 3 },
  { phrase: "expires today", category: "urgency", severity: 3 },
  { phrase: "expires soon", category: "urgency", severity: 2 },
  { phrase: "final call", category: "urgency", severity: 2 },
  { phrase: "for a limited time", category: "urgency", severity: 2 },
  { phrase: "get it now", category: "urgency", severity: 2 },
  { phrase: "hurry", category: "urgency", severity: 2 },
  { phrase: "immediate access", category: "urgency", severity: 2 },
  { phrase: "instant access", category: "urgency", severity: 2 },
  { phrase: "last chance", category: "urgency", severity: 3 },
  { phrase: "limited time", category: "urgency", severity: 2 },
  { phrase: "limited time offer", category: "urgency", severity: 3 },
  { phrase: "offer expires", category: "urgency", severity: 3 },
  { phrase: "once in a lifetime", category: "urgency", severity: 3 },
  { phrase: "only a few left", category: "urgency", severity: 2 },
  { phrase: "order now", category: "urgency", severity: 2 },
  { phrase: "take action now", category: "urgency", severity: 3 },
  { phrase: "this won't last", category: "urgency", severity: 2 },
  { phrase: "time is running out", category: "urgency", severity: 3 },
  { phrase: "today only", category: "urgency", severity: 2 },
  { phrase: "urgent", category: "urgency", severity: 2 },
  { phrase: "while supplies last", category: "urgency", severity: 2 },

  /* Money ------------------------------------------------------------------ */
  { phrase: "additional income", category: "money", severity: 3 },
  { phrase: "be your own boss", category: "money", severity: 3 },
  { phrase: "big bucks", category: "money", severity: 3 },
  { phrase: "cash bonus", category: "money", severity: 3 },
  { phrase: "cash out", category: "money", severity: 2 },
  { phrase: "double your income", category: "money", severity: 3 },
  { phrase: "earn extra cash", category: "money", severity: 3 },
  { phrase: "earn money", category: "money", severity: 3 },
  { phrase: "extra income", category: "money", severity: 3 },
  { phrase: "financial freedom", category: "money", severity: 3 },
  { phrase: "get paid", category: "money", severity: 2 },
  { phrase: "income from home", category: "money", severity: 3 },
  { phrase: "make money", category: "money", severity: 3 },
  { phrase: "make money fast", category: "money", severity: 3 },
  { phrase: "money making", category: "money", severity: 3 },
  { phrase: "passive income", category: "money", severity: 2 },
  { phrase: "potential earnings", category: "money", severity: 3 },
  { phrase: "serious cash", category: "money", severity: 3 },
  { phrase: "work from home", category: "money", severity: 2 },

  /* Guarantees ------------------------------------------------------------- */
  { phrase: "100% guaranteed", category: "guarantee", severity: 3 },
  { phrase: "absolutely free", category: "guarantee", severity: 3 },
  { phrase: "guarantee", category: "guarantee", severity: 2 },
  { phrase: "guaranteed", category: "guarantee", severity: 2 },
  { phrase: "guaranteed results", category: "guarantee", severity: 3 },
  { phrase: "money back guarantee", category: "guarantee", severity: 3 },
  { phrase: "no catch", category: "guarantee", severity: 3 },
  { phrase: "no obligation", category: "guarantee", severity: 2 },
  { phrase: "no questions asked", category: "guarantee", severity: 2 },
  { phrase: "no risk", category: "guarantee", severity: 3 },
  { phrase: "risk free", category: "guarantee", severity: 3 },
  { phrase: "risk-free", category: "guarantee", severity: 3 },
  { phrase: "satisfaction guaranteed", category: "guarantee", severity: 3 },
  { phrase: "unconditional guarantee", category: "guarantee", severity: 3 },

  /* Free -------------------------------------------------------------------- */
  { phrase: "100% free", category: "free", severity: 3 },
  { phrase: "free", category: "free", severity: 1 },
  { phrase: "free access", category: "free", severity: 2 },
  { phrase: "free consultation", category: "free", severity: 2 },
  { phrase: "free gift", category: "free", severity: 3 },
  { phrase: "free hosting", category: "free", severity: 2 },
  { phrase: "free info", category: "free", severity: 2 },
  { phrase: "free installation", category: "free", severity: 2 },
  { phrase: "free membership", category: "free", severity: 2 },
  { phrase: "free money", category: "free", severity: 3 },
  { phrase: "free offer", category: "free", severity: 3 },
  { phrase: "free preview", category: "free", severity: 2 },
  { phrase: "free quote", category: "free", severity: 2 },
  { phrase: "free sample", category: "free", severity: 2 },
  { phrase: "free trial", category: "free", severity: 1 },
  { phrase: "gift certificate", category: "free", severity: 2 },
  { phrase: "giveaway", category: "free", severity: 2 },
  { phrase: "no cost", category: "free", severity: 2 },
  { phrase: "no fees", category: "free", severity: 2 },

  /* Overpromise ------------------------------------------------------------ */
  { phrase: "amazing", category: "overpromise", severity: 1 },
  { phrase: "amazing offer", category: "overpromise", severity: 3 },
  { phrase: "be amazed", category: "overpromise", severity: 2 },
  { phrase: "incredible deal", category: "overpromise", severity: 3 },
  { phrase: "jaw dropping", category: "overpromise", severity: 2 },
  { phrase: "life changing", category: "overpromise", severity: 2 },
  { phrase: "mind blowing", category: "overpromise", severity: 2 },
  { phrase: "miracle", category: "overpromise", severity: 3 },
  { phrase: "outstanding value", category: "overpromise", severity: 2 },
  { phrase: "problem solved", category: "overpromise", severity: 2 },
  { phrase: "revolutionary", category: "overpromise", severity: 2 },
  { phrase: "unbelievable", category: "overpromise", severity: 2 },
  { phrase: "unlimited", category: "overpromise", severity: 1 },
  { phrase: "you won't believe", category: "overpromise", severity: 3 },

  /* Health ----------------------------------------------------------------- */
  { phrase: "anti aging", category: "health", severity: 2 },
  { phrase: "cialis", category: "health", severity: 3 },
  { phrase: "fast weight loss", category: "health", severity: 3 },
  { phrase: "lose weight", category: "health", severity: 3 },
  { phrase: "lose weight fast", category: "health", severity: 3 },
  { phrase: "no prescription", category: "health", severity: 3 },
  { phrase: "online pharmacy", category: "health", severity: 3 },
  { phrase: "removes wrinkles", category: "health", severity: 3 },
  { phrase: "stop snoring", category: "health", severity: 2 },
  { phrase: "valium", category: "health", severity: 3 },
  { phrase: "viagra", category: "health", severity: 3 },
  { phrase: "weight loss", category: "health", severity: 2 },
  { phrase: "xanax", category: "health", severity: 3 },

  /* Finance ---------------------------------------------------------------- */
  { phrase: "accept credit cards", category: "finance", severity: 2 },
  { phrase: "bad credit", category: "finance", severity: 3 },
  { phrase: "bankruptcy", category: "finance", severity: 2 },
  { phrase: "cash advance", category: "finance", severity: 3 },
  { phrase: "consolidate debt", category: "finance", severity: 3 },
  { phrase: "credit bureaus", category: "finance", severity: 3 },
  { phrase: "credit card offers", category: "finance", severity: 3 },
  { phrase: "debt free", category: "finance", severity: 3 },
  { phrase: "eliminate debt", category: "finance", severity: 3 },
  { phrase: "get out of debt", category: "finance", severity: 3 },
  { phrase: "lower interest rate", category: "finance", severity: 3 },
  { phrase: "lower monthly payment", category: "finance", severity: 3 },
  { phrase: "mortgage rates", category: "finance", severity: 2 },
  { phrase: "no credit check", category: "finance", severity: 3 },
  { phrase: "pre approved", category: "finance", severity: 3 },
  { phrase: "pre-approved", category: "finance", severity: 3 },
  { phrase: "refinance", category: "finance", severity: 2 },
  { phrase: "stop foreclosure", category: "finance", severity: 3 },

  /* Deceptive -------------------------------------------------------------- */
  { phrase: "as seen on", category: "deceptive", severity: 2 },
  { phrase: "claim your prize", category: "deceptive", severity: 3 },
  { phrase: "congratulations", category: "deceptive", severity: 2 },
  { phrase: "dear friend", category: "deceptive", severity: 3 },
  { phrase: "dear madam", category: "deceptive", severity: 3 },
  { phrase: "dear sir", category: "deceptive", severity: 3 },
  { phrase: "increase sales", category: "deceptive", severity: 2 },
  { phrase: "increase traffic", category: "deceptive", severity: 2 },
  { phrase: "internet marketing", category: "deceptive", severity: 2 },
  { phrase: "lottery", category: "deceptive", severity: 3 },
  { phrase: "multi level marketing", category: "deceptive", severity: 3 },
  { phrase: "not spam", category: "deceptive", severity: 3 },
  { phrase: "opt in", category: "deceptive", severity: 2 },
  { phrase: "opt-in", category: "deceptive", severity: 2 },
  { phrase: "prize", category: "deceptive", severity: 2 },
  { phrase: "this is not spam", category: "deceptive", severity: 3 },
  { phrase: "we hate spam", category: "deceptive", severity: 3 },
  { phrase: "winner", category: "deceptive", severity: 3 },
  { phrase: "you are a winner", category: "deceptive", severity: 3 },
  { phrase: "you have been selected", category: "deceptive", severity: 3 },
  { phrase: "you've been selected", category: "deceptive", severity: 3 },

  /* Marketing cliche ------------------------------------------------------- */
  { phrase: "all new", category: "cliche", severity: 1 },
  { phrase: "best price", category: "cliche", severity: 2 },
  { phrase: "bonus", category: "cliche", severity: 1 },
  { phrase: "buy direct", category: "cliche", severity: 2 },
  { phrase: "cheap", category: "cliche", severity: 2 },
  { phrase: "clearance", category: "cliche", severity: 2 },
  { phrase: "compare rates", category: "cliche", severity: 2 },
  { phrase: "deal", category: "cliche", severity: 1 },
  { phrase: "discount", category: "cliche", severity: 1 },
  { phrase: "exclusive deal", category: "cliche", severity: 2 },
  { phrase: "exclusive offer", category: "cliche", severity: 2 },
  { phrase: "great offer", category: "cliche", severity: 2 },
  { phrase: "lowest price", category: "cliche", severity: 2 },
  { phrase: "new customers only", category: "cliche", severity: 2 },
  { phrase: "no hidden costs", category: "cliche", severity: 2 },
  { phrase: "offer", category: "cliche", severity: 1 },
  { phrase: "order today", category: "cliche", severity: 2 },
  { phrase: "save big", category: "cliche", severity: 2 },
  { phrase: "save up to", category: "cliche", severity: 2 },
  { phrase: "special offer", category: "cliche", severity: 2 },
  { phrase: "special promotion", category: "cliche", severity: 2 },
  { phrase: "supplies are limited", category: "cliche", severity: 2 },
];

/** What to do about each category, shown on the warning tags. */
export const CATEGORY_ADVICE: Record<SpamCategory, string> = {
  urgency:
    "Manufactured urgency is a strong filter signal. Give the real deadline instead.",
  money:
    "Income claims are heavily weighted. Say what the thing costs or saves, concretely.",
  guarantee:
    "Absolute promises read as sales patter. Describe the actual terms.",
  free: "Fine in moderation. A pile-up of these in one message is the problem.",
  overpromise:
    "Superlatives add no information and cost reputation. Cut or replace with a number.",
  health:
    "Health and pharma vocabulary is among the most aggressively filtered.",
  finance:
    "Credit and debt phrasing is treated as high risk by most providers.",
  deceptive:
    "This reads like a template blast. Protesting that it is not spam makes it worse.",
  cliche:
    "Generic promotional wording. Weak on its own, but it accumulates.",
};

export const CATEGORY_LABEL: Record<SpamCategory, string> = {
  urgency: "Urgency",
  money: "Income claim",
  guarantee: "Guarantee",
  free: "Free",
  overpromise: "Overpromise",
  health: "Health",
  finance: "Credit",
  deceptive: "Deceptive",
  cliche: "Cliche",
};

/* -------------------------------------------------------------------------- */
/* Matching                                                                   */
/* -------------------------------------------------------------------------- */

const TERMS_BY_PHRASE = new Map(SPAM_TERMS.map((term) => [term.phrase, term]));

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * One alternation for the whole dictionary, built once.
 *
 * Longest phrases first, so "limited time offer" wins over "limited time" at
 * the same position. The lookarounds are unicode-aware rather than `\b`,
 * because `\b` behaves wrongly next to the `%` in "100% free".
 */
const PATTERN = new RegExp(
  "(?<![\\p{L}\\p{N}])(?:" +
    [...SPAM_TERMS]
      .sort((a, b) => b.phrase.length - a.phrase.length)
      .map((term) => escapeRegExp(term.phrase).replace(/ /g, "\\s+"))
      .join("|") +
    ")(?![\\p{L}\\p{N}])",
  "giu",
);

interface RawMatch {
  phrase: string;
  count: number;
}

function scan(text: string): Map<string, RawMatch> {
  const found = new Map<string, RawMatch>();
  if (!text) return found;

  // A fresh lastIndex per scan: the pattern is module-level and /g is stateful.
  PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = PATTERN.exec(text)) !== null) {
    const phrase = match[0].toLowerCase().replace(/\s+/g, " ");
    const term = TERMS_BY_PHRASE.get(phrase);
    if (!term) continue;

    const existing = found.get(term.phrase);
    if (existing) existing.count += 1;
    else found.set(term.phrase, { phrase: term.phrase, count: 1 });
  }

  return found;
}

/* -------------------------------------------------------------------------- */
/* Structural signals                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Acronyms that are simply how the thing is spelled, not shouting.
 *
 * Without this, ordinary B2B copy that mentions an API, a PDF or the CEO gets
 * told off for capitalisation, which is exactly the kind of false positive
 * that makes people stop reading a linter.
 */
const COMMON_ACRONYMS = new Set([
  "AI", "API", "ASAP", "B2B", "B2C", "CEO", "CFO", "CRM", "CSS", "CTA", "CTO",
  "EOD", "ETA", "EU", "FAQ", "FYI", "GDPR", "HR", "HTML", "HTTP", "HTTPS",
  "INC", "ISO", "IT", "KPI", "LLC", "LTD", "ML", "NDA", "OOO", "PDF", "PR",
  "PTO", "QA", "ROI", "RSVP", "SDK", "SEO", "SLA", "SQL", "SSO", "TBD", "UI",
  "UK", "URL", "USA", "UX", "VAT", "VP",
]);

/**
 * Words in all caps, at least three letters, which reads as shouting.
 * Recognised acronyms are not counted.
 */
export function countShoutedWords(text: string): number {
  const matches = text.match(/\b[\p{Lu}]{3,}\b/gu);
  if (!matches) return 0;
  return matches.filter((word) => !COMMON_ACRONYMS.has(word)).length;
}

function countExclamations(text: string): number {
  return (text.match(/!/g) ?? []).length;
}

function countLinks(text: string): number {
  return (text.match(/https?:\/\/\S+|\bwww\.\S+/gi) ?? []).length;
}

function hasMoneySymbolRun(text: string): boolean {
  return /[$£€]{2,}/.test(text);
}

function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}]+/gu) ?? []).length;
}

/* -------------------------------------------------------------------------- */
/* Bands                                                                      */
/* -------------------------------------------------------------------------- */

const BANDS: Record<DeliverabilityBand["key"], DeliverabilityBand> = {
  inbox: {
    key: "inbox",
    label: "Inbox",
    note: "Nothing here should trip a content filter.",
  },
  good: {
    key: "good",
    label: "Good",
    note: "A few soft signals. Worth a trim, not a rewrite.",
  },
  risky: {
    key: "risky",
    label: "At risk",
    note: "Enough triggers to land in promotions or junk.",
  },
  spam: {
    key: "spam",
    label: "Likely filtered",
    note: "This reads like a bulk blast. Expect it to be caught.",
  },
};

export function deliverabilityBand(score: number): DeliverabilityBand {
  if (score >= 85) return BANDS.inbox;
  if (score >= 70) return BANDS.good;
  if (score >= 45) return BANDS.risky;
  return BANDS.spam;
}

/* -------------------------------------------------------------------------- */
/* Main entry point                                                           */
/* -------------------------------------------------------------------------- */

const EMPTY_REPORT: DeliverabilityReport = {
  isEmpty: true,
  score: 100,
  band: BANDS.inbox,
  hits: [],
  checks: [],
  totalHits: 0,
  subjectLength: 0,
  shoutedWords: 0,
  exclamations: 0,
  linkCount: 0,
  bodyWords: 0,
};

/**
 * Score a subject line and body together.
 *
 * Deterministic and synchronous, like the readability engine, so it can run
 * inside a `useMemo` on every keystroke.
 */
export function checkDeliverability(
  subject: string,
  body: string,
): DeliverabilityReport {
  if (!subject.trim() && !body.trim()) return EMPTY_REPORT;

  const subjectHits = scan(subject);
  const bodyHits = scan(body);

  /* ---------------------------------------------------------------- */
  /* Trigger phrases                                                  */
  /* ---------------------------------------------------------------- */

  const phrases = new Set([...subjectHits.keys(), ...bodyHits.keys()]);
  const hits: SpamHit[] = [];

  for (const phrase of phrases) {
    const term = TERMS_BY_PHRASE.get(phrase);
    if (!term) continue;

    const inSubject = subjectHits.get(phrase)?.count ?? 0;
    const inBody = bodyHits.get(phrase)?.count ?? 0;
    const count = inSubject + inBody;

    const base = SEVERITY_PENALTY[term.severity];
    // Repeats cost less than the first, and stop counting after a point.
    const repeatMultiplier = Math.min(
      REPEAT_CAP,
      1 + (count - 1) * REPEAT_FACTOR,
    );
    const weight = inSubject > 0 ? SUBJECT_MULTIPLIER : 1;

    hits.push({
      phrase: term.phrase,
      category: term.category,
      severity: term.severity,
      count,
      inSubject: inSubject > 0,
      inBody: inBody > 0,
      penalty: base * repeatMultiplier * weight,
    });
  }

  hits.sort(
    (a, b) => b.penalty - a.penalty || a.phrase.localeCompare(b.phrase),
  );

  /* ---------------------------------------------------------------- */
  /* Structural checks                                                */
  /* ---------------------------------------------------------------- */

  const subjectLength = subject.trim().length;
  const bodyWords = countWords(body);
  const shoutedSubject = countShoutedWords(subject);
  const shoutedBody = countShoutedWords(body);
  const exclamations = countExclamations(subject) + countExclamations(body);
  const subjectExclamations = countExclamations(subject);
  const linkCount = countLinks(body);

  const checks: Check[] = [];
  const add = (check: Check) => checks.push(check);

  /* Subject present */
  if (subjectLength === 0) {
    add({
      id: "subject-present",
      label: "Subject line",
      status: "fail",
      detail: "Missing. A message with no subject is filtered aggressively.",
      penalty: 12,
    });
  } else if (subjectLength < SUBJECT_MIN) {
    add({
      id: "subject-present",
      label: "Subject line",
      status: "warn",
      detail: `${subjectLength} characters. Under ${SUBJECT_MIN} reads as terse or automated.`,
      penalty: 4,
    });
  } else if (subjectLength > SUBJECT_MAX) {
    add({
      id: "subject-present",
      label: "Subject line",
      status: "warn",
      detail: `${subjectLength} characters. Over ${SUBJECT_MAX} gets cut off on a phone.`,
      penalty: 5,
    });
  } else {
    add({
      id: "subject-present",
      label: "Subject line",
      status: "pass",
      detail: `${subjectLength} characters, a good length for a phone inbox.`,
      penalty: 0,
    });
  }

  /* Trigger phrases */
  const severeHits = hits.filter((hit) => hit.severity === 3).length;
  add({
    id: "spam-words",
    label: "Trigger phrases",
    status: hits.length === 0 ? "pass" : severeHits > 0 ? "fail" : "warn",
    detail:
      hits.length === 0
        ? "No spam trigger phrases found."
        : `${hits.length} distinct ${hits.length === 1 ? "phrase" : "phrases"}${
            severeHits > 0 ? `, ${severeHits} high risk` : ""
          }.`,
    penalty: 0, // Counted per hit above, not here.
  });

  /* Shouting */
  const shouted = shoutedSubject + shoutedBody;
  if (shoutedSubject > 0) {
    add({
      id: "caps",
      label: "Capitalisation",
      status: "fail",
      detail: `${shoutedSubject} all-caps ${shoutedSubject === 1 ? "word" : "words"} in the subject. This is one of the oldest filter signals.`,
      penalty: 10,
    });
  } else if (shoutedBody > 2) {
    add({
      id: "caps",
      label: "Capitalisation",
      status: "warn",
      detail: `${shoutedBody} all-caps words in the body.`,
      penalty: 5,
    });
  } else {
    add({
      id: "caps",
      label: "Capitalisation",
      status: "pass",
      detail: "No shouting.",
      penalty: 0,
    });
  }

  /* Punctuation */
  if (subjectExclamations > 0 || exclamations > 5) {
    add({
      id: "punctuation",
      label: "Punctuation",
      status: subjectExclamations > 1 || exclamations > 8 ? "fail" : "warn",
      detail:
        subjectExclamations > 0
          ? "Exclamation marks in the subject line are weighted heavily."
          : `${exclamations} exclamation marks in the body.`,
      penalty: subjectExclamations > 1 || exclamations > 8 ? 9 : 5,
    });
  } else {
    add({
      id: "punctuation",
      label: "Punctuation",
      status: "pass",
      detail: "Restrained punctuation.",
      penalty: 0,
    });
  }

  /* Money symbols */
  if (hasMoneySymbolRun(subject) || hasMoneySymbolRun(body)) {
    add({
      id: "symbols",
      label: "Symbols",
      status: "fail",
      detail: "Repeated currency symbols read as spam almost everywhere.",
      penalty: 8,
    });
  } else {
    add({
      id: "symbols",
      label: "Symbols",
      status: "pass",
      detail: "No symbol runs.",
      penalty: 0,
    });
  }

  /* Links */
  if (linkCount > 6) {
    add({
      id: "links",
      label: "Links",
      status: "fail",
      detail: `${linkCount} links. Dense linking looks like a blast.`,
      penalty: 8,
    });
  } else if (linkCount > 3) {
    add({
      id: "links",
      label: "Links",
      status: "warn",
      detail: `${linkCount} links. Three or fewer is safer.`,
      penalty: 4,
    });
  } else {
    add({
      id: "links",
      label: "Links",
      status: "pass",
      detail: linkCount === 0 ? "No links." : `${linkCount} links.`,
      penalty: 0,
    });
  }

  /* Body substance */
  if (bodyWords > 0 && bodyWords < 20) {
    add({
      id: "body-length",
      label: "Body length",
      status: "warn",
      detail: `${bodyWords} words. Very short messages look like image-only blasts.`,
      penalty: 5,
    });
  } else if (bodyWords === 0) {
    add({
      id: "body-length",
      label: "Body length",
      status: "fail",
      detail: "No body text.",
      penalty: 10,
    });
  } else {
    add({
      id: "body-length",
      label: "Body length",
      status: "pass",
      detail: `${bodyWords} words.`,
      penalty: 0,
    });
  }

  /* ---------------------------------------------------------------- */
  /* Score                                                            */
  /* ---------------------------------------------------------------- */

  const hitPenalty = hits.reduce((total, hit) => total + hit.penalty, 0);
  const checkPenalty = checks.reduce((total, check) => total + check.penalty, 0);
  const score = Math.max(0, Math.min(100, Math.round(100 - hitPenalty - checkPenalty)));

  return {
    isEmpty: false,
    score,
    band: deliverabilityBand(score),
    hits,
    checks,
    totalHits: hits.reduce((total, hit) => total + hit.count, 0),
    subjectLength,
    shoutedWords: shouted,
    exclamations,
    linkCount,
    bodyWords,
  };
}
