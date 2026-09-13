import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * How many people are looking at this product right now.
 *
 * Counts distinct sessions with a view in the last few minutes, so one person
 * refreshing cannot inflate it. Never cached: a stale "live" number is worse
 * than none at all.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const productId = url.searchParams.get("product");
  if (!productId) return NextResponse.json({ viewers: 0 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("live_viewers", {
    p_product_id: productId,
    p_minutes: 10,
  });

  return NextResponse.json(
    { viewers: error ? 0 : Number(data) || 0 },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
