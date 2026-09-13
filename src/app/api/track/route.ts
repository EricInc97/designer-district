import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CONSENT_COOKIE, parseConsent } from "@/lib/consent";

/**
 * Behaviour ingest for the recommendation algorithm. Fire-and-forget: this
 * always returns 204 so a tracking failure can never surface to the shopper.
 */

/**
 * Coarse location, from the headers the platform already attaches.
 *
 * Vercel resolves the client IP at the edge and injects these on every
 * request, on every plan, so there is no package to add and no third-party
 * lookup to pay for or wait on. `@vercel/functions` exposes the same values
 * through `geolocation()`; it is a typed wrapper over exactly these headers,
 * and not worth a dependency for three reads.
 *
 * The IP itself is deliberately never read or stored. A city is all a
 * recommendation can use, and the address is the part that identifies a
 * person.
 */
function geoFrom(request: Request) {
  const h = request.headers;
  const decode = (v: string | null) => {
    if (!v) return null;
    // Vercel percent-encodes city names that are not plain ASCII.
    try {
      return decodeURIComponent(v).slice(0, 80) || null;
    } catch {
      return v.slice(0, 80) || null;
    }
  };

  return {
    country: decode(h.get("x-vercel-ip-country")),
    region: decode(h.get("x-vercel-ip-country-region")),
    city: decode(h.get("x-vercel-ip-city")),
  };
}

export async function POST(request: Request) {
  try {
    // The browser is asked not to send these at all once someone declines.
    // This is the second gate, because a cookie is the client's word for it.
    const cookie = request.headers
      .get("cookie")
      ?.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`));
    if (parseConsent(cookie?.[1]) === "denied") {
      return new NextResponse(null, { status: 204 });
    }

    const body = await request.json();
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const sessionId: string | null = body.sessionId ?? null;
    if (!sessionId && !user) return new NextResponse(null, { status: 204 });

    if (body.type === "search") {
      const query = String(body.query ?? "").trim().slice(0, 120);
      if (query.length < 2) return new NextResponse(null, { status: 204 });

      await supabase.from("search_events").insert({
        user_id: user?.id ?? null,
        session_id: sessionId,
        query,
        result_count: Number(body.resultCount) || 0,
      });
    } else if (body.type === "view") {
      const productId = String(body.productId ?? "");
      if (!productId) return new NextResponse(null, { status: 204 });

      await supabase.from("product_views").insert({
        user_id: user?.id ?? null,
        session_id: sessionId,
        product_id: productId,
        source: String(body.source ?? "direct").slice(0, 32),
        ...geoFrom(request),
      });

      // Rebuilds the buyer profile, but only if it has gone stale. A burst of
      // views costs one rebuild rather than one each, which is what lets this
      // stay current without a scheduled job.
      if (user) await supabase.rpc("touch_buyer_profile");
    }
  } catch {
    /* swallow, see above */
  }

  return new NextResponse(null, { status: 204 });
}
