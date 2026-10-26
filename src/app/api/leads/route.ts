import { NextResponse } from "next/server";
import { recordLead, type Lead } from "@/lib/crm";

/**
 * Where the site hands an email address to the CRM.
 *
 * A thin, deliberately boring endpoint. It exists because the Airtable
 * token is a write credential for the whole base and so cannot go anywhere
 * near the browser: the client posts here, this runs on the server, and the
 * token never leaves it.
 *
 * It always answers 200 with a body saying what happened, including when
 * the write failed. That is on purpose. The only caller is a signup, and a
 * non-2xx here would tempt a client into treating a CRM problem as a signup
 * problem — the account exists either way, and the person creating it
 * should not be told otherwise because a marketing table was unreachable.
 * The body carries the reason so a failure is still visible in the network
 * tab and in logs; what it never carries is anything about the credential.
 */

const SOURCES = ["Signup", "Newsletter", "Checkout", "Support"] as const;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad json" });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email : "";
  const source = SOURCES.includes(b.source as (typeof SOURCES)[number])
    ? (b.source as Lead["source"])
    : "Signup";

  if (!email) return NextResponse.json({ ok: false, reason: "no email" });

  /* Only the fields the CRM has a column for, and each one read by name
   * rather than spread from the body. A spread here would let a caller set
   * Status, or any field added to the table later, from the browser. */
  const result = await recordLead({
    email,
    name: typeof b.name === "string" ? b.name : null,
    source,
    marketingOptIn: b.marketingOptIn === true,
    landingPage: typeof b.landingPage === "string" ? b.landingPage : null,
  });

  return NextResponse.json(result);
}
