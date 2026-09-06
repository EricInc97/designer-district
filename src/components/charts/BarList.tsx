"use client";

import { useState } from "react";

export type BarDatum = { label: string; value: number; sub?: string };

/**
 * Horizontal bars for magnitude across nominal categories. Every bar is the
 * same colour on purpose, shading by size would double-encode length as hue
 * and spend the only free channel on information the bar already shows.
 * Value rides the tip; hover reveals the exact figure and any secondary stat.
 */
export default function BarList({
  title,
  data,
  format = (n) => n.toLocaleString(),
  emptyLabel = "No data yet.",
}: {
  title: string;
  data: BarDatum[];
  format?: (n: number) => string;
  emptyLabel?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <figure className="rounded-xl border border-rule bg-paper-raised p-5">
      <figcaption className="text-[11px] uppercase tracking-[0.18em] text-ink-faint">
        {title}
      </figcaption>

      {data.length === 0 ? (
        <p className="mt-5 text-sm text-ink-faint">{emptyLabel}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {data.map((d, i) => (
            <li
              key={d.label + i}
              className="relative"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm text-ink">{d.label}</span>
                <span
                  className="shrink-0 text-sm text-ink-dim"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {format(d.value)}
                </span>
              </div>

              {/* Track is one step off the surface; the mark is capped at 10px
                  so the row keeps its air. */}
              <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-l-[1px] bg-paper-sunken">
                <div
                  className="h-full rounded-r-[4px] bg-ink transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.max(2, (d.value / max) * 100)}%` }}
                />
              </div>

              {hover === i && d.sub && (
                <div
                  role="status"
                  className="pointer-events-none absolute right-0 top-0 -translate-y-full rounded-lg border border-rule-strong bg-paper px-3 py-2 text-xs shadow-xl"
                >
                  <p className="text-ink-faint">{d.label}</p>
                  <p className="mt-0.5 font-semibold">{d.sub}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
