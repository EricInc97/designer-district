import StatTile from "@/components/charts/StatTile";
import BarList from "@/components/charts/BarList";
import { money, relative } from "@/lib/format";
import { PRICE_BANDS, SEGMENTS, segmentLabel, segmentWhy } from "@/lib/segments";
import type { BuyerProfileRow } from "@/lib/types";

/**
 * The audience board: who is out there, and on what evidence.
 *
 * Every number here is derived from consented behaviour only, so the headline
 * worth reading first is how many people actually said yes. A segment mix
 * drawn from a tenth of the customer base is a different thing from one drawn
 * from all of it, and the tiles say which it is.
 */
export default function AudienceBoard({
  rows,
  totalCustomers,
  consented,
}: {
  rows: BuyerProfileRow[];
  totalCustomers: number;
  consented: number;
}) {
  const mix = Object.keys(SEGMENTS)
    .map((key) => ({
      label: segmentLabel(key),
      value: rows.filter((r) => r.segment === key).length,
      sub: segmentWhy(key),
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const markets = Object.entries(
    rows.reduce<Record<string, number>>((acc, r) => {
      const key = [r.primary_city, r.primary_country].filter(Boolean).join(", ");
      if (key) acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([label, value]) => ({ label, value, sub: `${value} shoppers` }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const profiled = rows.length;
  const optInRate = totalCustomers > 0 ? consented / totalCustomers : 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="display text-xl">Audience</h2>
        <p className="mt-1.5 text-sm text-ink-faint">
          Buyer profiles built from viewing behaviour, keyed to the account
          rather than the browser. Only customers who accepted personalisation
          appear here.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Profiled" value={String(profiled)} caption="With enough signal to place" />
        <StatTile
          label="Opted in"
          value={`${Math.round(optInRate * 100)}%`}
          caption={`${consented} of ${totalCustomers} customers`}
          tone={consented === 0 ? "warn" : "neutral"}
        />
        <StatTile
          label="Segments in play"
          value={String(mix.length)}
          caption="Distinct buyer types"
        />
        <StatTile
          label="Markets"
          value={String(markets.length)}
          caption="Cities seen, from request geo"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarList
          title="Segment mix"
          data={mix}
          emptyLabel="Nobody profiled yet. Profiles appear once a customer opts in and views a few products."
        />
        <BarList
          title="Where they shop from"
          data={markets}
          emptyLabel="No location signal yet."
        />
      </div>

      {/* ---------------- PER CUSTOMER ---------------- */}
      <div className="overflow-hidden rounded-xl border border-rule">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-paper-raised text-[11px] uppercase tracking-[0.16em] text-ink-faint">
              <tr>
                <th className="px-5 py-3 font-normal">Customer</th>
                <th className="px-5 py-3 font-normal">Segment</th>
                <th className="px-5 py-3 font-normal">Favours</th>
                <th className="px-5 py-3 font-normal">Price band</th>
                <th className="px-5 py-3 font-normal">Market</th>
                <th className="px-5 py-3 font-normal tabular-nums">Views</th>
                <th className="px-5 py-3 font-normal">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule bg-paper-raised">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center text-sm text-ink-faint">
                    No profiles yet.
                  </td>
                </tr>
              )}

              {rows.map((r) => (
                <tr key={r.user_id}>
                  <td className="px-5 py-3">
                    <p className="truncate">{r.profiles?.full_name || "—"}</p>
                    <p className="text-xs text-ink-faint">{r.profiles?.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span title={segmentWhy(r.segment)}>{segmentLabel(r.segment)}</span>
                    {/* Confidence is evidence, not certainty about the rule. */}
                    <p className="text-xs text-ink-faint tabular-nums">
                      {Math.round(Number(r.segment_confidence) * 100)}% confidence
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <p>{r.brands?.name ?? "—"}</p>
                    <p className="text-xs text-ink-faint">
                      {r.categories?.name ?? "no category lean"}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <p>{PRICE_BANDS[r.price_band] ?? r.price_band}</p>
                    {Number(r.avg_viewed_price) > 0 && (
                      <p className="text-xs text-ink-faint tabular-nums">
                        avg {money(r.avg_viewed_price)}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {[r.primary_city, r.primary_region, r.primary_country]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </td>
                  <td className="px-5 py-3 tabular-nums">{r.views_90d}</td>
                  <td className="px-5 py-3 text-ink-faint">
                    {r.last_seen_at ? relative(r.last_seen_at) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-ink-faint">
        Location is resolved from the request at the edge and stored as
        country, region and city only. The IP address itself is never read or
        kept. Withdrawing consent deletes the profile and detaches the
        behaviour behind it, so it cannot be rebuilt.
      </p>
    </div>
  );
}
