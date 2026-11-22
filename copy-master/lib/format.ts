/** Small presentation helpers. No analysis logic lives here. */

const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

export function formatCount(value: number): string {
  return NUMBER_FORMAT.format(Math.round(value));
}

/** One decimal place, but never a trailing ".0" on a whole number. */
export function formatDecimal(value: number, places = 1): string {
  const rounded = Number(value.toFixed(places));
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(places);
}

export interface Duration {
  /** The big part, e.g. "48" or "2:10". */
  value: string;
  /** The small part, e.g. "sec" or "min". */
  unit: string;
  /** A full sentence-ready version, e.g. "2 min 10 sec". */
  long: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Format a span of seconds for a stat tile.
 *
 *   42      -> { value: "42",   unit: "sec", long: "42 sec" }
 *   130     -> { value: "2:10", unit: "min", long: "2 min 10 sec" }
 *   4_000   -> { value: "1:06", unit: "hr",  long: "1 hr 6 min" }
 */
export function formatDuration(totalSeconds: number): Duration {
  const seconds = Math.max(0, Math.round(totalSeconds));

  if (seconds < 60) {
    return { value: String(seconds), unit: "sec", long: `${seconds} sec` };
  }

  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return {
      value: `${minutes}:${pad(rest)}`,
      unit: "min",
      long: rest ? `${minutes} min ${rest} sec` : `${minutes} min`,
    };
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return {
    value: `${hours}:${pad(minutes)}`,
    unit: "hr",
    long: minutes ? `${hours} hr ${minutes} min` : `${hours} hr`,
  };
}

/**
 * Grades are clamped at the top of the scale, where the formulas stop saying
 * anything useful. Show that as "16+" rather than an arbitrary big number.
 */
export function formatGrade(grade: number, ceiling = 16): string {
  return grade >= ceiling ? `${ceiling}+` : String(Math.round(grade));
}

/** "8" -> "8th", "3" -> "3rd". Used for the grade readout. */
export function ordinal(value: number): string {
  const n = Math.round(value);
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function pluralize(count: number, singular: string, plural?: string) {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

/** Cheap truncation for sentence previews in the right-hand panel. */
export function truncate(text: string, max = 110): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}
