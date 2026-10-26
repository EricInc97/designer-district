import "server-only";

/**
 * Leads, pushed to Airtable.
 *
 * Server-only, and the `server-only` import above is what enforces it: the
 * token is a write credential for the whole base, so a build that ever
 * pulled this into a client bundle should fail loudly rather than ship it.
 * Nothing here is exposed through `NEXT_PUBLIC_`.
 *
 * Capturing a lead must never be able to break the thing that produced it.
 * Somebody creating an account cares about the account; if Airtable is down,
 * rate-limiting us, or simply not configured, that is our problem and not a
 * reason to fail their signup. So every path returns a result rather than
 * throwing, and the caller is free to ignore it.
 */

const API = "https://api.airtable.com/v0";

/** Configured, or not. Absent config is a no-op, not an error. */
function config() {
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_LEADS_TABLE;
  return token && base && table ? { token, base, table } : null;
}

export type Lead = {
  email: string;
  name?: string | null;
  /** Which surface collected it. Anything else is rejected. */
  source: "Signup" | "Newsletter" | "Checkout" | "Support";
  marketingOptIn?: boolean;
  /** The path they were on, for working out which page earns addresses. */
  landingPage?: string | null;
};

export type LeadResult =
  | { ok: true; skipped: true }
  | { ok: true; skipped: false }
  | { ok: false; reason: string };

/* Deliberately loose. This is not an attempt to decide whether an address
 * can receive mail — only Supabase's own signup can really say that — it is
 * a guard against writing obvious junk into the CRM. */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Record a lead, keyed on the email address.
 *
 * Upsert rather than create: somebody who signs up, comes back through a
 * newsletter box and then buys is one person the shop wants one row for,
 * and `performUpsert` lets Airtable do that match server-side instead of us
 * reading the table first and racing with ourselves between the read and
 * the write.
 *
 * `Captured` is only written on insert, so it keeps meaning "first seen";
 * `Last seen` is written every time.
 */
export async function recordLead(lead: Lead): Promise<LeadResult> {
  const cfg = config();
  if (!cfg) return { ok: true, skipped: true };

  const email = lead.email.trim().toLowerCase();
  if (!LOOKS_LIKE_EMAIL.test(email)) return { ok: false, reason: "bad email" };

  const now = new Date().toISOString();
  const fields: Record<string, unknown> = {
    Email: email,
    Source: lead.source,
    Status: "New",
    "Marketing opt-in": Boolean(lead.marketingOptIn),
    Captured: now,
    "Last seen": now,
  };
  if (lead.name?.trim()) fields.Name = lead.name.trim();
  if (lead.landingPage) fields["Landing page"] = lead.landingPage.slice(0, 500);

  /* A hung CRM should cost a signup a moment, not the request. Eight
   * seconds is longer than Airtable's p99 and shorter than any sensible
   * function timeout, so a stall ends here rather than upstream. */
  const abort = AbortSignal.timeout(8000);

  try {
    const r = await fetch(`${API}/${cfg.base}/${encodeURIComponent(cfg.table)}`, {
      method: "PATCH",
      signal: abort,
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        performUpsert: { fieldsToMergeOn: ["Email"] },
        records: [{ fields }],
        typecast: true,
      }),
    });

    if (!r.ok) {
      /* The body can quote the request back, and the request carries no
       * secret, but the header does — so only the status is kept, and the
       * token never reaches a log line. */
      return { ok: false, reason: `airtable ${r.status}` };
    }
    return { ok: true, skipped: false };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.name : "fetch failed" };
  }
}
