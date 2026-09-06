"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { X, Sparkles } from "lucide-react";
import { money } from "@/lib/format";
import { trackView } from "@/lib/track";
import type { Recommendation } from "@/lib/types";

const DISMISS_KEY = "dd-recs-dismissed";

/**
 * The nudge. Appears once the shopper has generated real signal, the
 * algorithm returns a positive score only when their views or searches
 * actually match something, and never on the cart, admin or account screens.
 */
export default function RecommendationPopup() {
  const pathname = usePathname();
  const [items, setItems] = useState<Recommendation[]>([]);
  const [visible, setVisible] = useState(false);

  const suppressed =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/login");

  useEffect(() => {
    if (suppressed) return;
    if (sessionStorage.getItem(DISMISS_KEY)) return;

    let cancelled = false;

    // Give the visitor room to browse before interrupting them.
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/recommendations?limit=3");
        const json = await res.json();
        const scored: Recommendation[] = (json.items ?? []).filter(
          (i: Recommendation) => Number(i.score) > 0,
        );

        // A score of 0 means we'd just be showing random stock. Stay quiet.
        if (!cancelled && scored.length >= 2) {
          setItems(scored.slice(0, 3));
          setVisible(true);
        }
      } catch {
        /* silent */
      }
    }, 9000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [suppressed, pathname]);

  function dismiss() {
    setVisible(false);
    sessionStorage.setItem(DISMISS_KEY, "1");
  }

  if (!visible || suppressed) return null;

  return (
    <aside
      aria-label="Recommended for you"
      className="fixed bottom-4 left-4 right-4 z-30 sm:right-auto sm:w-80 rounded-2xl border border-rule bg-paper-raised/95 backdrop-blur-xl shadow-2xl shadow-black/15 animate-rise"
    >
      <header className="flex items-center justify-between gap-2 border-b border-rule px-4 py-3">
        <p className="flex items-center gap-2 eyebrow !text-ink">
          <Sparkles size={13} aria-hidden />
          Picked for you
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="grid h-7 w-7 place-items-center rounded-full text-ink-faint hover:text-ink hover:bg-paper-sunken transition-colors"
          aria-label="Dismiss recommendations"
        >
          <X size={15} aria-hidden />
        </button>
      </header>

      <ul className="p-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/products/${item.id}`}
              onClick={() => {
                trackView(item.id, "recommendation");
                setVisible(false);
              }}
              className="flex items-center gap-3 rounded-lg p-2 hover:bg-paper-sunken transition-colors"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.image_url ?? `/ph/${item.slug ?? "product"}`}
                alt=""
                className="h-14 w-12 shrink-0 rounded-md object-cover bg-paper-sunken"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                  {item.brand_name}
                </span>
                <span className="mt-0.5 block truncate text-sm">{item.name}</span>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-ink-dim">
                {money(item.price)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
