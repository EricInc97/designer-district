import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import SetupNotice from "@/components/SetupNotice";
import ProductCard from "@/components/ProductCard";
import RecommendationRail from "@/components/RecommendationRail";
import SearchTracker from "@/components/SearchTracker";
import BrandTile from "@/components/BrandTile";
import type { Brand, ProductWithBrand } from "@/lib/types";

export const metadata: Metadata = { title: "Search" };

type Props = {
  searchParams: Promise<{ q?: string; brand?: string; sort?: string }>;
};

export default async function SearchPage({ searchParams }: Props) {
  if (!supabaseConfigured) return <SetupNotice />;

  const { q = "", brand = "", sort = "" } = await searchParams;
  const term = q.trim();
  const supabase = await createClient();

  // Nothing asked for, nothing shown, the catalog is entered through a brand
  // or an explicit search, never dumped wholesale.
  const idle = !term && !brand;

  let query = supabase
    .from("products")
    .select("*, brands(id, name, slug, logo_url)")
    .eq("is_published", true);

  if (term) {
    query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
  }
  if (brand) {
    const { data: b } = await supabase
      .from("brands")
      .select("id")
      .eq("slug", brand)
      .single();
    if (b) query = query.eq("brand_id", b.id);
  }

  query =
    sort === "price-asc"
      ? query.order("price", { ascending: true })
      : sort === "price-desc"
        ? query.order("price", { ascending: false })
        : query.order("created_at", { ascending: false });

  const [{ data: products }, { data: brandRows }] = await Promise.all([
    idle ? Promise.resolve({ data: [] }) : query.limit(48),
    supabase.from("brands").select("*").eq("is_active", true).order("sort_order"),
  ]);

  const results = (products ?? []) as ProductWithBrand[];
  const brands = (brandRows ?? []) as Brand[];

  const sorts = [
    { key: "", label: "Newest" },
    { key: "price-asc", label: "Price ↑" },
    { key: "price-desc", label: "Price ↓" },
  ];

  const linkFor = (patch: Record<string, string>) => {
    const next = new URLSearchParams({
      ...(term ? { q: term } : {}),
      ...(brand ? { brand } : {}),
      ...(sort ? { sort } : {}),
      ...patch,
    });
    for (const [k, v] of [...next.entries()]) if (!v) next.delete(k);
    const s = next.toString();
    return s ? `/search?${s}` : "/search";
  };

  return (
    <>
      {term && <SearchTracker query={term} resultCount={results.length} />}

      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-12">
        <p className="eyebrow">{idle ? "Search" : "Search results"}</p>
        <h1 className="display mt-2 text-3xl sm:text-4xl">
          {term ? `“${term}”` : idle ? "What are you after?" : "Filtered"}
        </h1>
        <p className="mt-3 text-sm text-ink-faint">
          {idle
            ? "Search by name, or pick a house on the left."
            : `${results.length} ${results.length === 1 ? "result" : "results"}`}
        </p>

        <div className="mt-10 grid gap-10 lg:grid-cols-[200px_1fr]">
          {/* ---------------- FILTERS ---------------- */}
          <aside className="lg:sticky lg:top-24 lg:self-start space-y-8">
            <div>
              <p className="eyebrow">Brand</p>
              <ul className="mt-3 space-y-1.5">
                <li>
                  <Link
                    href={linkFor({ brand: "" })}
                    className={`text-sm transition-colors ${
                      brand ? "text-ink-faint hover:text-ink" : "text-ink underline underline-offset-4"
                    }`}
                  >
                    All brands
                  </Link>
                </li>
                {brands.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={linkFor({ brand: b.slug })}
                      className={`text-sm transition-colors ${
                        brand === b.slug
                          ? "text-ink underline underline-offset-4"
                          : "text-ink-faint hover:text-ink"
                      }`}
                    >
                      {b.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="eyebrow">Sort</p>
              <ul className="mt-3 space-y-1.5">
                {sorts.map((s) => (
                  <li key={s.label}>
                    <Link
                      href={linkFor({ sort: s.key })}
                      className={`text-sm transition-colors ${
                        sort === s.key
                          ? "text-ink underline underline-offset-4"
                          : "text-ink-faint hover:text-ink"
                      }`}
                    >
                      {s.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* No products anywhere until a house or a query is chosen, the
                rail only earns its place once they are actually browsing. */}
            {!idle && (
              <div className="border-t border-rule pt-6">
                <RecommendationRail title="Picked for you" limit={4} layout="sidebar" />
              </div>
            )}
          </aside>

          {/* ---------------- RESULTS ---------------- */}
          <div>
            {idle ? (
              <ul className="grid grid-cols-3 gap-2 sm:gap-4">
                {brands.map((b) => (
                  <li key={b.id}>
                    <BrandTile brand={b} />
                  </li>
                ))}
              </ul>
            ) : results.length === 0 ? (
              <div className="rounded-xl border border-rule bg-paper-raised px-6 py-16 text-center">
                <p className="text-sm text-ink-dim">
                  {term ? `Nothing matched “${term}”.` : "Nothing in that filter."}
                </p>
                <Link
                  href="/"
                  className="mt-6 inline-block rounded-full border border-rule-strong px-6 py-3 text-xs uppercase tracking-[0.2em] hover:bg-ink hover:text-paper transition-colors"
                >
                  Browse brands
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3">
                {results.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
