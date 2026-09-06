import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import OrderItemActions from "@/components/OrderItemActions";
import { money, dateShort, titleCase } from "@/lib/format";
import type { OrderWithItems } from "@/lib/types";

export const metadata: Metadata = { title: "Orders" };

type Props = { searchParams: Promise<{ placed?: string }> };

export default async function OrdersPage({ searchParams }: Props) {
  const { placed } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("user_id", user!.id)
    .order("placed_at", { ascending: false });

  const orders = (data ?? []) as OrderWithItems[];

  return (
    <div className="space-y-8">
      {placed && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-rule bg-paper-raised px-5 py-4"
        >
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" aria-hidden />
          <div>
            <p className="text-sm">Order {placed} placed.</p>
            <p className="mt-0.5 text-xs text-ink-faint">
              A confirmation is on its way. Track it here any time.
            </p>
          </div>
        </div>
      )}

      <div>
        <h2 className="display text-xl">Previous purchases</h2>
        <p className="mt-1.5 text-sm text-ink-faint">
          Start a return, request store credit, or raise a complaint on any item.
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-rule bg-paper-raised px-6 py-16 text-center">
          <p className="text-sm text-ink-dim">No orders yet.</p>
          <Link
            href="/brands"
            className="mt-6 inline-block rounded-full border border-rule-strong px-6 py-3 text-xs uppercase tracking-[0.2em] hover:bg-ink hover:text-paper transition-colors"
          >
            Start shopping
          </Link>
        </div>
      ) : (
        <ul className="space-y-5">
          {orders.map((order) => (
            <li
              key={order.id}
              className="overflow-hidden rounded-xl border border-rule bg-paper-raised"
            >
              <header className="flex flex-wrap items-center justify-between gap-4 border-b border-rule px-5 py-4">
                <div>
                  <p className="font-mono text-sm">{order.order_number}</p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {dateShort(order.placed_at)} ·{" "}
                    {order.order_items.length}{" "}
                    {order.order_items.length === 1 ? "item" : "items"}
                  </p>
                </div>

                <div className="flex items-center gap-5">
                  <span className="rounded-full border border-rule-strong px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-ink-dim">
                    {titleCase(order.status)}
                  </span>
                  <div className="text-right">
                    <p className="text-sm tabular-nums">{money(order.total)}</p>
                    {order.credit_applied > 0 && (
                      <p className="text-[11px] text-ink-faint tabular-nums">
                        {money(order.credit_applied)} credit applied
                      </p>
                    )}
                  </div>
                </div>
              </header>

              <ul className="divide-y divide-rule">
                {order.order_items.map((item) => (
                  <li key={item.id} className="flex gap-4 px-5 py-5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image_url ?? "/ph/product"}
                      alt=""
                      className="h-28 w-24 shrink-0 rounded-md object-cover bg-paper-sunken"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-ink-faint">
                        {item.brand_name}
                      </p>
                      {item.product_id ? (
                        <Link
                          href={`/products/${item.product_id}`}
                          className="mt-0.5 block text-sm hover:underline underline-offset-4"
                        >
                          {item.product_name}
                        </Link>
                      ) : (
                        <p className="mt-0.5 text-sm">{item.product_name}</p>
                      )}
                      <p className="mt-1 text-xs text-ink-faint">
                        {item.size && `Size ${item.size} · `}Qty {item.quantity} ·{" "}
                        {money(item.unit_price)}
                      </p>

                      <OrderItemActions
                        orderId={order.id}
                        orderItemId={item.id}
                        orderNumber={order.order_number}
                        productName={item.product_name}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
