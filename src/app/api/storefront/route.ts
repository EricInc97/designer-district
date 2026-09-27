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

type ArtRow = {
  image_url: string | null;
  headline: string | null;
  subhead: string | null;
  cta_label: string | null;
  ink: string | null;
  aspect: string | null;
  product_ids: string[] | null;
  brands: Rel<{ slug: string }>;
};

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

  /* Two queries, in parallel.
   *
   * The second is the campaign artwork for the hoardings in the district.
   * It rides along with the catalogue rather than getting an endpoint of its
   * own because the page already refetches this one on a timer, so artwork
   * published in the admin reaches the boards on the same poll that reaches
   * the shelf — no second cache to reason about and no second request
   * from a phone.
   */
  const [{ data, error }, { data: art }] = await Promise.all([
    supabase
    .from("products")
    .select(
      "id, name, price, image_url, sizes, stock_count, brands!inner(slug), categories(name, slug)",
    )
    .eq("is_published", true)
    .not("image_url", "is", null)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: true }),
    supabase
      .from("brand_media")
      .select("image_url, headline, subhead, cta_label, ink, aspect, product_ids, brands!inner(slug)")
      .eq("kind", "board")
      .eq("is_published", true)
      .order("sort_order", { ascending: true }),
  ]);

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

  /* Campaign artwork, by house.
   *
   * A failure here is deliberately not fatal: the boards fall back to the
   * product card they showed before this existed, which is worse-looking but
   * not broken, and a street with no hoardings at all would be far worse than
   * one with plain ones.
   */
  /* An index over what we already fetched, rather than a second round trip.
   *
   * The artwork names the products worn in it, and the panel that opens when
   * somebody taps a hoarding needs their names, prices and photographs. Every
   * one of them is already in `brands` — they are published products with
   * images, which is the same filter — so the join is a lookup, not a query.
   */
  const byId = new Map<string, unknown>();
  for (const list of Object.values(brands)) {
    for (const item of list as { id: string }[]) byId.set(item.id, item);
  }

  const looks: Record<string, unknown[]> = {};
  for (const row of (art ?? []) as ArtRow[]) {
    const slug = one(row.brands)?.slug;
    if (!slug || !row.image_url) continue;
    (looks[slug] ??= []).push({
      image: row.image_url,
      headline: row.headline,
      subhead: row.subhead,
      cta: row.cta_label,
      ink: row.ink,
      // What shape it was composed for, so a board can pick what fits it.
      aspect: row.aspect,
      // The pieces actually worn in it, in layering order. Anything that has
      // since been unpublished or sold out simply drops out of the look.
      products: (row.product_ids ?? []).map((id) => byId.get(id)).filter(Boolean),
    });
  }

  return NextResponse.json(
    { ok: true, configured: true, brands, looks },
    {
      headers: {
        /*
         * Thirty seconds at the edge, nothing in the browser.
         *
         * It was `max-age=60, s-maxage=300, stale-while-revalidate=3600`,
         * which is a sensible shape for a catalogue nobody is watching and
         * the wrong one for a shop floor somebody is editing: replace a
         * photograph and it could be five minutes before the edge even
         * asked, and an hour before a client stopped being handed the
         * stale copy.
         *
         * `max-age=0` sends every client request to the edge; `s-maxage=30`
         * means the database is asked at most twice a minute however many
         * people are looking. The page polls, so thirty seconds is the
         * worst case between saving an image and seeing it on the wall.
         */
        "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=120",
      },
    },
  );
}
