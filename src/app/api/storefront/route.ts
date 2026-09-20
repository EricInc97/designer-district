import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";

/**
 * The catalogue, flat, for the WebGL page at /index.html.
 *
 * That page is a single static file with no build step and no Supabase
 * client, so it cannot run the same queries the storefront does. It gets this
 * instead: every published product, grouped by brand slug, carrying only what
 * a shelf needs — a picture, a name, a price, sizes, and the id to link back
 * to the real product page.
 *
 * Deliberately not the full `Product` row. The interiors render up to a dozen
 * of these at a time as textures and a list of all of them as HTML, on a
 * phone, over whatever connection the visitor has; description and gallery
 * would triple the payload for something nothing on that page reads.
 */

/*
 * Dynamic, with the caching done by the header rather than by the segment.
 *
 * `revalidate = 300` cached the route's response whatever it was — including
 * a failed one. A database blip at the wrong moment was served to everybody
 * for the next five minutes, and since a failure here renders as fifteen
 * empty shops rather than as an error, nobody would have known why.
 *
 * The success path still sets `s-maxage=300`, so a healthy deployment caches
 * exactly as it did before. The failure path sets `no-store` and is never
 * held onto by anything.
 */
export const dynamic = "force-dynamic";

type Rel<T> = T | T[] | null;
const one = <T,>(r: Rel<T>): T | null => (Array.isArray(r) ? r[0] ?? null : r);

type Row = {
  id: string;
  name: string;
  price: number | string;
  image_url: string | null;
  sizes: string[] | null;
  stock_count: number | null;
  brands: Rel<{ slug: string }>;
  categories: Rel<{ name: string; slug: string }>;
};

export async function GET() {
  // Not an error: the project has not been pointed at a database yet. The
  // page can say so rather than pretending the shops are empty.
  if (!supabaseConfigured) {
    return NextResponse.json(
      { ok: true, configured: false, brands: {} },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, price, image_url, sizes, stock_count, brands!inner(slug), categories(name, slug)",
    )
    .eq("is_published", true)
    .not("image_url", "is", null)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: true });

  // 503, not 200. This used to answer "here are your products: none" to a
  // failed query, which is a different sentence from "the catalogue is
  // down" and the page had no way to tell them apart.
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const brands: Record<string, unknown[]> = {};
  for (const row of (data ?? []) as Row[]) {
    // PostgREST hands an embedded one-to-one back as an object on some
    // versions and a single-element array on others. Both mean one row.
    const slug = one(row.brands)?.slug;
    if (!slug) continue;
    const cat = one(row.categories);
    (brands[slug] ??= []).push({
      id: row.id,
      name: row.name,
      price: Number(row.price),
      image: row.image_url,
      sizes: row.sizes ?? [],
      stock: row.stock_count ?? 0,
      // Every published product has one today, but the column is nullable,
      // so anything without falls into a bucket rather than disappearing
      // from a filtered shop floor.
      cat: cat?.slug ?? "other",
      catName: cat?.name ?? "Other",
    });
  }

  return NextResponse.json(
    { ok: true, configured: true, brands },
    {
      headers: {
        // Long enough that a visitor scrolling in and out of fifteen shops
        // fetches it once, short enough that a new drop shows up the same day.
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
      },
    },
  );
}
