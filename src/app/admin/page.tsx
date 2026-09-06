import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import StatTile from "@/components/charts/StatTile";
import RevenueChart from "@/components/charts/RevenueChart";
import BarList from "@/components/charts/BarList";
import { money } from "@/lib/format";
import type { Analytics } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminOverviewPage() {
  const staff = await requireStaff();
  const supabase = await createClient();

  // Analytics is a master-admin-by-default scope; admins without it still get
  // a useful landing screen rather than an error.
  if (!staff.can("analytics.view")) {
    const { count: openTickets } = await supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .in("status", ["open", "pending_customer"]);

    return (
      <div className="space-y-8">
        <div>
          <h2 className="display text-xl">Your work</h2>
          <p className="mt-1.5 text-sm text-ink-faint">
            Analytics is restricted to accounts with the{" "}
            <code className="font-mono">analytics.view</code> scope.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {staff.can("tickets.view") && (
            <Link href="/admin/tickets" className="block">
              <StatTile
                label="Open tickets"
                value={String(openTickets ?? 0)}
                caption="Go to the support queue"
              />
            </Link>
          )}
          {staff.can("products.manage") && (
            <Link href="/admin/products" className="block">
              <StatTile label="Catalog" value="Manage" caption="Add, edit and publish" />
            </Link>
          )}
        </div>

        <section className="rounded-xl border border-rule bg-paper-raised p-5">
          <h3 className="text-[11px] uppercase tracking-[0.18em] text-ink-faint">
            Your scopes
          </h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {staff.scopes.map((scope) => (
              <li
                key={scope}
                className="rounded-full border border-rule-strong px-3 py-1 font-mono text-[11px] text-ink-dim"
              >
                {scope}
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  const { data, error } = await supabase.rpc("admin_analytics", { p_days: 30 });
  const a = data as Analytics | null;

  if (error || !a) {
    return (
      <p className="rounded-xl border border-rule bg-paper-raised px-5 py-8 text-sm text-danger">
        Could not load analytics: {error?.message ?? "no data returned"}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="display text-xl">Last 30 days</h2>
        <p className="mt-1.5 text-sm text-ink-faint">
          Store performance, support load and what people are searching for.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Revenue" value={money(a.revenue)} caption="Net of cancellations" />
        <StatTile label="Orders" value={String(a.order_count)} />
        <StatTile label="Average order" value={money(a.avg_order)} />
        <StatTile label="New customers" value={String(a.new_customers)} />
        <StatTile
          label="Open tickets"
          value={String(a.open_tickets)}
          caption="Awaiting a reply"
          tone={a.open_tickets > 0 ? "warn" : "neutral"}
        />
        <StatTile label="Credit issued" value={money(a.credit_issued)} caption="Refunds" />
        <StatTile
          label="Low stock"
          value={String(a.low_stock)}
          caption="3 or fewer left"
          tone={a.low_stock > 0 ? "warn" : "neutral"}
        />
      </div>

      <RevenueChart series={a.revenue_series ?? []} />

      <div className="grid gap-4 lg:grid-cols-3">
        <BarList
          title="Top brands by revenue"
          data={(a.top_brands ?? []).map((b) => ({
            label: b.brand_name,
            value: Number(b.revenue),
            sub: money(b.revenue),
          }))}
          format={(n) => money(n)}
          emptyLabel="No sales in this window."
        />

        <BarList
          title="Top products by units"
          data={(a.top_products ?? []).map((p) => ({
            label: p.product_name,
            value: Number(p.units),
            sub: `${p.units} units · ${money(p.revenue)}`,
          }))}
          emptyLabel="No sales in this window."
        />

        <BarList
          title="Top searches"
          data={(a.top_searches ?? []).map((s) => ({
            label: s.term,
            value: Number(s.n),
            sub: `${s.n} searches`,
          }))}
          emptyLabel="No searches logged yet."
        />
      </div>
    </div>
  );
}
