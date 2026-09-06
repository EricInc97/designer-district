import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Behaviour ingest for the recommendation algorithm. Fire-and-forget: this
 * always returns 204 so a tracking failure can never surface to the shopper.
 */
export async function POST(request: Request) {
  try {
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
      });
    }
  } catch {
    /* swallow, see above */
  }

  return new NextResponse(null, { status: 204 });
}
