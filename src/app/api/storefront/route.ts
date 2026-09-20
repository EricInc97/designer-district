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

export const revalidate = 300;

type Row = {
  id: string;
  name: string;
  price: number | string;
  image_url: string | null;
  sizes: string[] | null;
  stock_count: number | null;
  brands: { slug: string } | { slug: string }[] | null;
};

export async function GET() {
  if (!supabaseConfigured) {
    return NextResponse.json({ brands: {} }, { status: 200 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, price, image_url, sizes, stock_count, brands!inner(slug)")
    .eq("is_published", true)
    .not("image_url", "is", null)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ brands: {}, error: error.message }, { status: 200 });
  }

  const brands: Record<string, unknown[]> = {};
  for (const row of (data ?? []) as Row[]) {
    // PostgREST hands an embedded one-to-one back as an object on some
    // versions and a single-element array on others. Both mean one brand.
    const rel = Array.isArray(row.brands) ? row.brands[0] : row.brands;
    const slug = rel?.slug;
    if (!slug) continue;
    (brands[slug] ??= []).push({
      id: row.id,
      name: row.name,
      price: Number(row.price),
      image: row.image_url,
      sizes: row.sizes ?? [],
      stock: row.stock_count ?? 0,
    });
  }

  return NextResponse.json(
    { brands },
    {
      headers: {
        // Long enough that a visitor scrolling in and out of fifteen shops
        // fetches it once, short enough that a new drop shows up the same day.
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
      },
    },
  );
}
