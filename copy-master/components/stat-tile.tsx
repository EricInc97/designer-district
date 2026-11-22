"use client";

interface StatTileProps {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  /** Lower-emphasis variant used for the secondary metrics grid. */
  quiet?: boolean;
}

export function StatTile({ label, value, unit, hint, quiet }: StatTileProps) {
  return (
    <div
      className={
        quiet
          ? "flex items-baseline justify-between gap-3 py-2"
          : "rounded-xl border border-edge bg-surface px-3.5 py-3 shadow-[var(--shadow-panel)]"
      }
    >
      <span
        className={
          quiet
            ? "text-[0.8125rem] text-ink-soft"
            : "block text-[0.625rem] font-semibold tracking-[0.1em] text-ink-faint uppercase"
        }
      >
        {label}
      </span>

      <span className={quiet ? "flex items-baseline gap-1.5" : "mt-1 flex items-baseline gap-1"}>
        <span
          className={
            quiet
              ? "nums text-[0.9375rem] font-semibold text-ink"
              : "nums text-2xl leading-none font-semibold tracking-tight text-ink"
          }
        >
          {value}
        </span>
        {unit && (
          <span className="text-[0.6875rem] font-medium text-ink-faint">
            {unit}
          </span>
        )}
      </span>

      {hint && !quiet && (
        <span className="mt-1 block text-[0.6875rem] text-ink-faint">{hint}</span>
      )}
    </div>
  );
}
