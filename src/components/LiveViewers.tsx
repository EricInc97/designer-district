"use client";

import { useEffect, useState } from "react";

/**
 * "4 people are looking at this right now."
 *
 * Polls rather than holding a socket: the number only has to be roughly true,
 * and a request every half minute is far cheaper than a realtime channel per
 * product page.
 *
 * Stays hidden below two viewers. "1 person is looking at this" is the shopper
 * themselves, and saying so is both useless and faintly embarrassing.
 */
export default function LiveViewers({ productId }: { productId: string }) {
  const [viewers, setViewers] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const read = () =>
      fetch(`/api/live?product=${productId}`)
        .then((r) => r.json())
        .then((json) => {
          if (!cancelled) setViewers(Number(json.viewers) || 0);
        })
        .catch(() => {
          /* a missing live count is not worth surfacing */
        });

    // The view that brought them here needs a moment to land before the count
    // can include it.
    const first = setTimeout(read, 1500);
    const timer = setInterval(read, 30000);

    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [productId]);

  if (viewers < 2) return null;

  return (
    <p className="mt-3 flex items-center gap-2 text-xs text-ink-dim">
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full bg-danger animate-pulse"
      />
      {viewers} people are looking at this right now
    </p>
  );
}
