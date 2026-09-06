"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { trackSearch } from "@/lib/track";
import { money } from "@/lib/format";

type Hit = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  brands: { name: string } | null;
};

export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Results are stored with the query they belong to, so "which hits are
  // current" is derived rather than reset in an effect body.
  const [results, setResults] = useState<{ q: string; hits: Hit[] }>({
    q: "",
    hits: [],
  });

  const term = query.trim();
  const hits = results.q === term ? results.hits : [];
  const loading = term.length >= 2 && results.q !== term;

  // Typeahead: 200ms to look responsive, then a slower 800ms beat before we
  // log the query, so "s", "sh", "sha" don't each become a search event.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;

    const supabase = createClient();
    let cancelled = false;

    const lookup = setTimeout(async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, price, image_url, brands(name)")
        .eq("is_published", true)
        .or(`name.ilike.%${q}%,description.ilike.%${q}%`)
        .limit(6);

      if (cancelled) return;
      const found = (data as unknown as Hit[]) ?? [];
      setResults({ q, hits: found });

      // Log only once the results for this exact query are known.
      setTimeout(() => {
        if (!cancelled) trackSearch(q, found.length);
      }, 600);
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(lookup);
    };
  }, [query]);

  // Close the dropdown on outside click / Escape.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    trackSearch(q, hits.length);
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <div ref={boxRef} className="relative">
      <form onSubmit={submit} role="search">
        <label htmlFor="site-search" className="sr-only">
          Search products
        </label>
        <div className="flex items-center gap-2.5 rounded-full border border-rule bg-paper-raised px-4 h-10 focus-within:border-ink-faint transition-colors">
          <Search size={16} className="shrink-0 text-ink-faint" aria-hidden />
          <input
            id="site-search"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search brands, hoodies, tees…"
            autoComplete="off"
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="shrink-0 text-ink-faint hover:text-ink"
              aria-label="Clear search"
            >
              <X size={15} aria-hidden />
            </button>
          )}
        </div>
      </form>

      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-2xl border border-rule bg-paper-raised shadow-2xl shadow-black/10 animate-fade-in">
          {loading && hits.length === 0 && (
            <p className="px-4 py-5 text-sm text-ink-faint">Searching…</p>
          )}

          {!loading && hits.length === 0 && (
            <p className="px-4 py-5 text-sm text-ink-faint">
              No matches for “{query.trim()}”.
            </p>
          )}

          {hits.map((hit) => (
            <Link
              key={hit.id}
              href={`/products/${hit.id}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-paper-sunken transition-colors border-b border-rule last:border-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={hit.image_url ?? "/ph/product"}
                alt=""
                className="h-11 w-11 shrink-0 rounded-md object-cover bg-paper-sunken"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">{hit.name}</span>
                <span className="block text-xs text-ink-faint">
                  {hit.brands?.name}
                </span>
              </span>
              <span className="shrink-0 text-sm tabular-nums text-ink-dim">
                {money(hit.price)}
              </span>
            </Link>
          ))}

          {hits.length > 0 && (
            <button
              type="button"
              onClick={submit}
              className="w-full px-4 py-3 text-left text-xs uppercase tracking-widest text-ink-dim hover:text-ink hover:bg-paper-sunken transition-colors"
            >
              See all results for “{query.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}
