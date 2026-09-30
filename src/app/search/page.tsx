import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import SetupNotice from "@/components/SetupNotice";
import ProductCard from "@/components/ProductCard";
import RecommendationRail from "@/components/RecommendationRail";
import SearchTracker from "@/components/SearchTracker";
import BrandTile from "@/components/BrandTile";
import type { Brand, Category, ProductWithBrand } from "@/lib/types";

export const metadata: Metadata = { title: "Search" };

type Props = {
  searchParams: Promise<{
    q?: string;
    brand?: string;
    category?: string;
    sort?: string;
    featured?: string;
    sale?: string;
    arrivals?: string;
  }>;
};

export default async function SearchPage({ searchParams }: Props) {
  if (!supabaseConfigured) return <SetupNotice />;

  const {
    q = "",
    brand = "",
    category = "",
    sort = "",
    featured = "",
    sale = "",
    arrivals = "",
  } = await searchParams;

  const term = q.trim();
  const onlyFeatured = featured === "1";
  const onlySale = sale === "1";
  const onlyArrivals = arrivals === "1";
  const supabase = await createClient();

  // Products appear once the shopper has actually asked for something: a
  // search, a house, a category, or one of the curated views. Landing here
  // with nothing chosen still shows the brands rather than the whole catalog.
  const idle =
    !term && !brand && !category && !onlyFeatured && !onlySale && !onlyArrivals;

  const [{ data: brandRows }, { data: categoryRows }] = await Promise.all([
    // A facet that can only ever return nothing is not a facet. See
    // app/page.tsx for why this is a view and not a filter on `brands`.
    supabase.from("shoppable_brands").select("*").order("sort_order"),
    supabase.from("categories").select("*").order("sort_order"),
  ]);

  const brands = (brandRows ?? []) as Brand[];
  const categories = (categoryRows ?? []) as Category[];

  // A brand or category that matches nothing is a filter that cannot be
  // satisfied, not an absent one. Silently dropping it used to hand back the
  // whole catalog, which is how a stale link (?category=t-shirts, say, from
  // before tees folded into Shirts) turned into "here is everything".
  const unknownFilter =
    (Boolean(brand) && !brands.some((b) => b.slug === brand)) ||
    (Boolean(category) && !categories.some((c) => c.slug === category));

  let results: ProductWithBrand[] = [];

  if (!idle && !unknownFilter) {
    let query = supabase
      .from("products")
      .select("*, brands(id, name, slug, logo_url)")
      .eq("is_published", true);

    if (term) {
      query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
    }
    const brandMatch = brands.find((b) => b.slug === brand);
    if (brandMatch) query = query.eq("brand_id", brandMatch.id);

    const categoryMatch = categories.find((c) => c.slug === category);
    if (categoryMatch) query = query.eq("category_id", categoryMatch.id);
    if (onlyFeatured) query = query.eq("is_featured", true);
    // PostgREST cannot compare two columns, so narrow to rows that have a
    // compare-at price and settle the actual discount below.
    if (onlySale) query = query.not("compare_at_price", "is", null);

    query =
      sort === "price-asc"
        ? query.order("price", { ascending: true })
        : sort === "price-desc"
          ? query.order("price", { ascending: false })
          : query.order("created_at", { ascending: false });

    // New Arrivals is the recent end of the catalog, not all of it by date.
    const { data } = await query.limit(onlyArrivals ? 24 : 48);
    results = (data ?? []) as ProductWithBrand[];

    if (onlySale) {
      results = results.filter(
        (p) => p.compare_at_price != null && Number(p.compare_at_price) > Number(p.price),
      );
    }
  }

  const sorts = [
    { key: "", label: "Newest" },
    { key: "price-asc", label: "Price ↑" },
    { key: "price-desc", label: "Price ↓" },
  ];

  const linkFor = (patch: Record<string, string>) => {
    const next = new URLSearchParams({
      ...(term ? { q: term } : {}),
      ...(brand ? { brand } : {}),
      ...(category ? { category } : {}),
      ...(sort ? { sort } : {}),
      ...(onlyFeatured ? { featured: "1" } : {}),
      ...(onlySale ? { sale: "1" } : {}),
      ...(onlyArrivals ? { arrivals: "1" } : {}),
      ...patch,
    });
    for (const [k, v] of [...next.entries()]) if (!v) next.delete(k);
    const s = next.toString();
    return s ? `/search?${s}` : "/search";
  };

  // What the shopper actually asked for, said back to them.
  const activeCategory = categories.find((c) => c.slug === category);
  const heading = term
    ? `“${term}”`
    : onlyArrivals
      ? "New Arrivals"
      : onlyFeatured
      ? "Featured"
      : onlySale
        ? "Sale"
        : activeCategory
          ? activeCategory.name
          : brand
            ? (brands.find((b) => b.slug === brand)?.name ?? "Filtered")
            : "What are you after?";

  return (
    <>
      {term && <SearchTracker query={term} resultCount={results.length} />}

      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-12">
        <p className="eyebrow">{idle ? "Search" : "The Collection"}</p>
        <h1 className="display mt-2 text-3xl sm:text-4xl">{heading}</h1>
        <p className="mt-3 text-sm text-ink-faint">
          {idle
            ? "Search by name, or pick a district on the left."
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
                      brand
                        ? "text-ink-faint hover:text-ink"
                        : "text-ink underline underline-offset-4"
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
              <p className="eyebrow">Category</p>
              <ul className="mt-3 space-y-1.5">
                <li>
                  <Link
                    href={linkFor({ category: "" })}
                    className={`text-sm transition-colors ${
                      category
                        ? "text-ink-faint hover:text-ink"
                        : "text-ink underline underline-offset-4"
                    }`}
                  >
                    All categories
                  </Link>
                </li>
                {categories.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={linkFor({ category: c.slug })}
                      className={`text-sm transition-colors ${
                        category === c.slug
                          ? "text-ink underline underline-offset-4"
                          : "text-ink-faint hover:text-ink"
                      }`}
                    >
                      {c.name}
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
                  Browse districts
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
