"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { money } from "@/lib/format";
import { trackView } from "@/lib/track";
import type { Recommendation } from "@/lib/types";

type Props = {
  title?: string;
  limit?: number;
  /** "rail" = horizontal strip under content, "sidebar" = stacked column. */
  layout?: "rail" | "sidebar";
  /**
   * How much room the shelf is allowed to take.
   *
   * "feature" is a real part of the page, for a product page where what goes
   * with the thing in front of you is the point. "quiet" is an aside: small
   * rows on their own ground, so a brand page's suggestions cannot be mistaken
   * for that brand's catalog. They often are not even the same house.
   */
  tone?: "feature" | "quiet";
  /** The product being viewed, if any. Switches the shelf to outfit building. */
  anchor?: string;
};

export default function RecommendationRail({
  title = "Picked for you",
  limit = 8,
  layout = "rail",
  tone = "feature",
  anchor,
}: Props) {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({ limit: String(limit) });
    if (anchor) qs.set("anchor", anchor);
    fetch(`/api/recommendations?${qs}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) {
          setItems(json.items ?? []);
          setLoaded(true);
        }
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [limit, anchor]);

  // Nothing to say is better than a shelf of noise.
  if (!loaded || items.length === 0) return null;

  const sidebar = layout === "sidebar";
  const quiet = !sidebar && tone === "quiet";
  // Sidebar and quiet share the small-row treatment; only the feature shelf
  // gets cards the size of the catalog's.
  const row = sidebar || quiet;

  const body = (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="eyebrow">{title}</h2>
        {!sidebar && (
          <p className="text-xs text-ink-faint">Based on what you&apos;ve browsed</p>
        )}
      </div>

      <ul
        className={
          sidebar
            ? "mt-4 space-y-3"
            : quiet
              ? "mt-5 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4"
              : "mt-6 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4"
        }
      >
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/products/${item.id}`}
              onClick={() => trackView(item.id, "recommendation")}
              className={
                row
                  ? "group -mx-2 flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-paper-sunken"
                  : "group block"
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.image_url ?? `/ph/${item.slug ?? "product"}`}
                alt={item.name}
                loading="lazy"
                className={
                  row
                    ? "h-16 w-14 shrink-0 rounded-md bg-paper-sunken object-cover"
                    : "aspect-[4/5] w-full rounded-lg bg-paper-sunken object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                }
              />
              <span className={row ? "min-w-0 flex-1" : "mt-3 block"}>
                <span className="block text-[11px] uppercase tracking-[0.18em] text-ink-faint">
                  {item.brand_name}
                </span>
                <span className="mt-0.5 block truncate text-sm">{item.name}</span>
                <span className="mt-0.5 block text-sm tabular-nums text-ink-dim">
                  {money(item.price)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );

  if (sidebar) return <section aria-label={title}>{body}</section>;

  // The quiet shelf sits on its own ground behind a rule, which is what stops
  // it reading as one more row of the catalog above it.
  if (quiet) {
    return (
      <section aria-label={title} className="border-t border-rule bg-paper-raised">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">{body}</div>
      </section>
    );
  }

  return (
    <section aria-label={title} className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
      {body}
    </section>
  );
}
