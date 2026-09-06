import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SESSION_COOKIE } from "@/lib/constants";

/** Scored recommendations for the current visitor. See recommend_products(). */
export async function GET(request: Request) {
  const supabase = await createClient();
  const jar = await cookies();
  const url = new URL(request.url);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const sessionId = url.searchParams.get("sid") ?? jar.get(SESSION_COOKIE)?.value ?? null;
  const limit = Math.min(Number(url.searchParams.get("limit")) || 8, 24);

  const { data, error } = await supabase.rpc("recommend_products", {
    p_session_id: sessionId,
    p_user_id: user?.id ?? null,
    p_limit: limit,
  });

  if (error) {
    return NextResponse.json({ items: [], error: error.message }, { status: 200 });
  }

  return NextResponse.json(
    { items: data ?? [] },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
