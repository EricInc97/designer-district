/**
 * Personalisation consent.
 *
 * The cookie is what the tracker reads on every event, because it has to be
 * answerable synchronously in the browser with no round trip. For a signed-in
 * shopper the profile column is the record of truth and the cookie is a mirror
 * of it, refreshed on sign-in; the two only disagree for as long as it takes a
 * decision to be written.
 *
 * Three states, deliberately. "Not asked" has to be distinguishable from "said
 * no", or the banner reappears forever for someone who already declined.
 */
export const CONSENT_COOKIE = "dd_personalisation";

export type ConsentState = "granted" | "denied" | "unasked";

export function parseConsent(value: string | undefined | null): ConsentState {
  return value === "granted" || value === "denied" ? value : "unasked";
}

/** Client-side read. Returns "unasked" on the server, where there is no cookie. */
export function readConsent(): ConsentState {
  if (typeof document === "undefined") return "unasked";
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`),
  );
  return parseConsent(match ? decodeURIComponent(match[1]) : null);
}

export function writeConsent(state: Exclude<ConsentState, "unasked">) {
  if (typeof document === "undefined") return;
  // A year: long enough not to nag, short enough that the question gets asked
  // again eventually rather than a decision standing forever.
  document.cookie = `${CONSENT_COOKIE}=${state}; path=/; max-age=31536000; samesite=lax`;
}
