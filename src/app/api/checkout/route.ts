import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type IncomingLine = { productId: string; size: string | null; quantity: number };

/**
 * Places an order. The client sends identifiers and quantities only -
 * place_order() re-reads every price and stock level from the database, so a
 * tampered cart payload cannot change what anyone is charged.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to check out." }, { status: 401 });
  }

  let lines: IncomingLine[];
  try {
    lines = (await request.json()).lines;
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (!Array.isArray(lines) || lines.length === 0) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }

  const items = lines.slice(0, 50).map((l) => ({
    product_id: String(l.productId),
    size: l.size ?? null,
    quantity: Math.min(20, Math.max(1, Number(l.quantity) || 1)),
  }));

  const { data, error } = await supabase.rpc("place_order", {
    p_items: items,
    p_use_credit: true,
  });

  if (error) {
    // Postgres RAISE messages here are shopper-safe ("only 2 left of …").
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  return NextResponse.json({
    orderId: data.order_id,
    orderNumber: data.order_number,
    subtotal: Number(data.subtotal),
    creditApplied: Number(data.credit_applied),
    total: Number(data.total),
  });
}
