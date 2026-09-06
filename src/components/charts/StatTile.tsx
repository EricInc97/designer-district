/**
 * Stat tile, label, value, optional caption. The right form for a single
 * headline number; a one-bar bar chart would say the same thing with more ink.
 * Value uses proportional figures (tabular-nums is for columns, not display).
 */
export default function StatTile({
  label,
  value,
  caption,
  tone = "neutral",
}: {
  label: string;
  value: string;
  caption?: string;
  tone?: "neutral" | "warn";
}) {
  return (
    <div className="rounded-xl border border-rule bg-paper-raised px-5 py-5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-ink-faint">
        {label}
      </p>
      <p
        className={`mt-2 text-3xl font-semibold ${
          tone === "warn" ? "text-danger" : "text-ink"
        }`}
      >
        {value}
      </p>
      {caption && <p className="mt-1 text-xs text-ink-faint">{caption}</p>}
    </div>
  );
}
