"use client";

import { useMemo, useRef, useState } from "react";

type Point = { day: string; revenue: number };

const W = 720;
const H = 240;
const PAD = { top: 18, right: 18, bottom: 28, left: 52 };

const compact = (n: number) =>
  n >= 1000
    ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`
    : `$${Math.round(n)}`;

const full = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const dayLabel = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

/** Round a max up to a clean axis ceiling (1 / 2 / 5 × 10^n). */
function niceCeiling(max: number) {
  if (max <= 0) return 100;
  const mag = 10 ** Math.floor(Math.log10(max));
  const norm = max / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

/**
 * Revenue over time. One series, so there is no legend, the heading names
 * what is plotted. 2px line, 10% wash beneath it, rule solid gridlines,
 * and a crosshair + tooltip because an SVG chart on a page should be readable
 * point by point, not just in silhouette.
 */
export default function RevenueChart({ series }: { series: Point[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const { points, path, area, ceiling, ticks } = useMemo(() => {
    const data = series.length > 0 ? series : [{ day: "", revenue: 0 }];
    const ceiling = niceCeiling(Math.max(...data.map((d) => d.revenue), 1));

    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;

    const x = (i: number) =>
      PAD.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
    const y = (v: number) => PAD.top + innerH - (v / ceiling) * innerH;

    const points = data.map((d, i) => ({ ...d, x: x(i), y: y(d.revenue) }));
    const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
    const area =
      `${path} L${points[points.length - 1].x},${PAD.top + innerH} ` +
      `L${points[0].x},${PAD.top + innerH} Z`;

    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
      value: ceiling * f,
      y: PAD.top + innerH - f * innerH,
    }));

    return { points, path, area, ceiling, ticks };
  }, [series]);

  const active = hover != null ? points[hover] : null;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Screen px -> viewBox units, then nearest point by x.
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    let nearest = 0;
    let best = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x - vx);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    setHover(nearest);
  }

  const total = series.reduce((s, d) => s + d.revenue, 0);
  const last = points[points.length - 1];

  return (
    <figure className="relative rounded-xl border border-rule bg-paper-raised p-5">
      <figcaption className="flex items-baseline justify-between gap-4">
        <div>
          <h3 className="text-[11px] uppercase tracking-[0.18em] text-ink-faint">
            Revenue per day
          </h3>
          <p className="mt-1.5 text-2xl font-semibold">{full.format(total)}</p>
        </div>
        <p className="text-xs text-ink-faint">{series.length} days</p>
      </figcaption>

      <div className="relative mt-4">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Daily revenue, ${full.format(total)} total over ${series.length} days`}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {/* Gridlines: rule, solid, one step off the surface. */}
          {ticks.map((t) => (
            <g key={t.value}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={t.y}
                y2={t.y}
                stroke="var(--rule)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 10}
                y={t.y + 4}
                textAnchor="end"
                className="fill-[var(--ink-faint)] text-[11px]"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {compact(t.value)}
              </text>
            </g>
          ))}

          {/* 10% wash under the line, never a saturated block. */}
          <path d={area} fill="var(--ink)" opacity={0.08} />
          <path
            d={path}
            fill="none"
            stroke="var(--ink)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* End marker: r >= 4 with a 2px surface ring. */}
          {last && (
            <circle
              cx={last.x}
              cy={last.y}
              r={4}
              fill="var(--ink)"
              stroke="var(--paper-raised)"
              strokeWidth={2}
            />
          )}

          {active && (
            <>
              <line
                x1={active.x}
                x2={active.x}
                y1={PAD.top}
                y2={H - PAD.bottom}
                stroke="var(--rule-strong)"
                strokeWidth={1}
              />
              <circle
                cx={active.x}
                cy={active.y}
                r={5}
                fill="var(--ink)"
                stroke="var(--paper-raised)"
                strokeWidth={2}
              />
            </>
          )}

          {/* First and last day only, the axis carries the rest. */}
          {points.length > 1 && (
            <>
              <text
                x={PAD.left}
                y={H - 8}
                className="fill-[var(--ink-faint)] text-[11px]"
              >
                {dayLabel(points[0].day)}
              </text>
              <text
                x={W - PAD.right}
                y={H - 8}
                textAnchor="end"
                className="fill-[var(--ink-faint)] text-[11px]"
              >
                {dayLabel(points[points.length - 1].day)}
              </text>
            </>
          )}
        </svg>

        {active && (
          <div
            role="status"
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-rule-strong bg-paper px-3 py-2 text-xs shadow-xl"
            style={{
              left: `${(active.x / W) * 100}%`,
              top: `${(active.y / H) * 100}%`,
              marginTop: -10,
            }}
          >
            <p className="text-ink-faint">{dayLabel(active.day)}</p>
            <p className="mt-0.5 font-semibold">{full.format(active.revenue)}</p>
          </div>
        )}
      </div>

      <p className="sr-only">
        Peak day: {full.format(Math.max(...series.map((d) => d.revenue), 0))}. Axis
        ceiling {compact(ceiling)}.
      </p>
    </figure>
  );
}
