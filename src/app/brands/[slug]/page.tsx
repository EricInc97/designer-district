import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import SetupNotice from "@/components/SetupNotice";
import ProductCard from "@/components/ProductCard";
import BrandCampaign from "@/components/BrandCampaign";
import BrandCampaignBand, { type CampaignBand } from "@/components/BrandCampaignBand";
import BrandSetBand, { type SetBand } from "@/components/BrandSetBand";
import BrandLookbook from "@/components/BrandLookbook";
import RecommendationRail from "@/components/RecommendationRail";
import type { Brand, BrandMedia, ProductWithBrand } from "@/lib/types";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string; set?: string }>;
};

type Row = ProductWithBrand & {
  categories: { id: string; name: string; slug: string; sort_order: number } | null;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!supabaseConfigured) return { title: "Brand" };

  const supabase = await createClient();
  const { data } = await supabase
    .from("brands")
    .select("name, description")
    .eq("slug", slug)
    .single();

  if (!data) return { title: "Brand not found" };
  return { title: data.name, description: data.description ?? undefined };
}

export default async function BrandPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { category = "", set = "" } = await searchParams;
  if (!supabaseConfigured) return <SetupNotice />;

  const supabase = await createClient();

  const { data: brand } = await supabase
    .from("brands")
    .select("*")
    .eq("slug", slug)
    .single<Brand>();

  if (!brand) notFound();

  const [{ data: products }, { data: mediaRows }] = await Promise.all([
    supabase
      .from("products")
      .select("*, brands(id, name, slug, logo_url), categories(id, name, slug, sort_order)")
      .eq("brand_id", brand.id)
      .eq("is_published", true)
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("brand_media")
      .select("*")
      .eq("brand_id", brand.id)
      .eq("is_published", true)
      .order("sort_order", { ascending: true }),
  ]);

  const all = (products ?? []) as unknown as Row[];

  // One hero at the top, the rest dropped between product groups in order.
  const media = (mediaRows ?? []) as BrandMedia[];
  const hero = media.find((m) => m.kind === "hero") ?? null;
  const lookbook = media.filter((m) => m.kind === "lookbook");

  /* ── the campaign carousel ────────────────────────────────────────────
   *
   * Two reads, because a house's campaign is not only the boards filed
   * under it. Several of these are collaborations — "Chrome Hearts x
   * Purple Brand", "Supreme x Ksubi" — and the picture of a Purple Brand
   * jean being worn is filed under Chrome Hearts. Counting those in takes
   * Purple Brand from two slides to seven and Ksubi from one to four, and
   * they are its campaign by any reading a shopper would use.
   *
   * `overlaps` rather than a second round trip per board: one query for
   * every board touching any of this house's garments.
   */
  const ownIds = all.map((p) => p.id);
  const [{ data: ownBoards }, { data: featuring }] = await Promise.all([
    supabase
      .from("brand_media")
      .select("*")
      .eq("kind", "board")
      .eq("is_published", true)
      .eq("brand_id", brand.id)
      .order("sort_order", { ascending: true }),
    ownIds.length
      ? supabase
          .from("brand_media")
          .select("*")
          .eq("kind", "board")
          .eq("is_published", true)
          .neq("brand_id", brand.id)
          .overlaps("product_ids", ownIds)
      : Promise.resolve({ data: [] }),
  ]);

  const boards = [
    ...((ownBoards ?? []) as BrandMedia[]),
    ...((featuring ?? []) as BrandMedia[]),
  ];

  /* The garments in those pictures, in one read rather than one per slide.
   * Published only: a board can outlive a product, and a slide offering
   * something that has been taken down is worse than a slide offering
   * nothing. */
  const slideIds = [...new Set(boards.flatMap((b) => b.product_ids ?? []))];
  const { data: slideProducts } = slideIds.length
    ? await supabase
        .from("products")
        .select("*, brands(id, name, slug, logo_url)")
        .in("id", slideIds)
        .eq("is_published", true)
    : { data: [] };
  const byId = new Map(
    ((slideProducts ?? []) as ProductWithBrand[]).map((p) => [p.id, p]),
  );

  const bands: CampaignBand[] = boards.map((m) => ({
    media: m,
    items: (m.product_ids ?? [])
      .map((id) => byId.get(id))
      .filter((p): p is ProductWithBrand => Boolean(p)),
    // The board's own copy travels only when it is about this house: its
    // own board, or a collaboration whose title names it.
    ownCopy:
      m.brand_id === brand.id ||
      (m.headline ?? "").toLowerCase().includes(brand.name.toLowerCase()),
  }));

  /* The co-ordinated sets this house sells, each one merchandised as a
   * collection of its own.
   *
   * Built from the products already fetched rather than from another query:
   * a set is just the pieces that share a set_key, and they are all in `all`
   * by definition. Ordered by the first piece so the page is stable between
   * loads.
   */
  const setMap = new Map<string, SetBand>();
  for (const product of all) {
    if (!product.set_key) continue;
    const existing = setMap.get(product.set_key);
    if (existing) existing.items.push(product);
    else
      setMap.set(product.set_key, {
        key: product.set_key,
        name: product.set_name ?? "The set",
        items: [product],
      });
  }
  // A set of one is not a set: a half whose partner is out of stock or
  // unpublished would otherwise get a collection band of its own.
  const setBands = [...setMap.values()].filter((x) => x.items.length > 1);

  // Only offer the categories this house actually stocks, in catalog order.
  const categories: { name: string; slug: string; sort_order: number }[] = [];
  for (const product of all) {
    const c = product.categories;
    if (!c) continue;
    if (!categories.some((x) => x.slug === c.slug)) {
      categories.push({ name: c.name, slug: c.slug, sort_order: c.sort_order });
    }
  }
  // Catalog order, not alphabetical: shirts first, accessories last.
  categories.sort((a, b) => a.sort_order - b.sort_order);

  const active = categories.some((c) => c.slug === category) ? category : "";

  /* ?set= narrows the page to one collection.
   *
   * Validated against the sets actually on the page rather than trusted, so
   * an unknown or stale key falls back to the whole house instead of showing
   * an empty shop.
   */
  const chosenSet = setBands.find((x) => x.key === set) ?? null;

  const shown = chosenSet
    ? chosenSet.items
    : active
      ? all.filter((p) => p.categories?.slug === active)
      : all;

  // With no filter the whole house is laid out category by category; with one
  // selected it collapses to a single grid.
  const groups = chosenSet
    ? [{ name: chosenSet.name, items: chosenSet.items }]
    : active
      ? [{ name: categories.find((c) => c.slug === active)!.name, items: shown }]
      : categories.map((c) => ({
          name: c.name,
          items: all.filter((p) => p.categories?.slug === c.slug),
        }));

  const uncategorised = all.filter((p) => !p.categories);
  if (!active && !chosenSet && uncategorised.length > 0) {
    groups.push({ name: "Other", items: uncategorised });
  }

  const chipClass = (on: boolean) =>
    `inline-block rounded-full border px-4 py-2 text-[11px] uppercase tracking-[0.16em] transition-colors ${
      on
        ? "border-ink bg-ink text-paper"
        : "border-rule-strong text-ink-dim hover:border-ink hover:text-ink"
    }`;

  return (
    <>
      {/* ---------------- CAMPAIGN ----------------
          The first picture leads the page; the rest are dropped between the
          product groups further down, so the page reads banner, products,
          banner, products as you scroll.

          This replaced a carousel, and losing it is the point. A slideshow
          showed one picture and hid the others behind a gesture most people
          never make — a house with eleven boards was really a house with one
          board and ten nobody would see. Stacked, they are all just there.

          BrandCampaign stays as the fallback it always was: the house
          colourway with its mark centred, for a house with nothing shot. */}
      {bands.length > 0 ? (
        <BrandCampaignBand band={bands[0]} brand={brand} priority />
      ) : (
        <BrandCampaign brand={brand} media={hero} />
      )}

      {/* ---------------- BRAND HEADER ---------------- */}
      <header className="border-b border-rule">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 py-8 sm:py-10">
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-ink-faint">
              <li>
                <Link href="/" className="hover:text-ink transition-colors">
                  Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li>
                <Link href="/brands" className="hover:text-ink transition-colors">
                  Brands
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="text-ink-dim">{brand.name}</li>
            </ol>
          </nav>

          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="sr-only">{brand.name}</h1>
              {/* The mark already led the campaign above, so here it is a
                  wordmark at reading size rather than a second lockup. */}
              <p className="eyebrow">The Collection</p>
              <p className="display mt-1.5 text-2xl sm:text-3xl">{brand.name}</p>
              {brand.description && (
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-dim">
                  {brand.description}
                </p>
              )}
            </div>

            <p className="shrink-0 text-xs uppercase tracking-[0.18em] text-ink-faint">
              {all.length} {all.length === 1 ? "piece" : "pieces"}
            </p>
          </div>
        </div>
      </header>

      {/* ---------------- CATEGORY FILTER ---------------- */}
      {categories.length > 0 && (
        <nav
          aria-label={`${brand.name} categories`}
          className="border-b border-rule bg-paper"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-8 py-4">
            <ul className="flex flex-wrap gap-2">
              <li>
                <Link
                  href={`/brands/${brand.slug}`}
                  aria-current={!active && !chosenSet ? "true" : undefined}
                  className={chipClass(!active && !chosenSet)}
                >
                  All
                </Link>
              </li>
              {/* The open set gets a chip of its own so there is something
                  showing it is on, and All beside it is the way out. */}
              {chosenSet && (
                <li>
                  <span aria-current="true" className={chipClass(true)}>
                    {chosenSet.name}
                  </span>
                </li>
              )}
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/brands/${brand.slug}?category=${c.slug}`}
                    aria-current={active === c.slug ? "true" : undefined}
                    className={chipClass(active === c.slug && !chosenSet)}
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      )}

      {/* ---------------- PRODUCTS ---------------- */}
      <div className="py-12">
        {all.length === 0 ? (
          <div className="mx-auto max-w-7xl px-5 py-20 text-center sm:px-8">
            <p className="text-sm text-ink-dim">
              Nothing live from {brand.name} right now.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block rounded-full border border-rule-strong px-6 py-3 text-xs uppercase tracking-[0.2em] hover:bg-ink hover:text-paper transition-colors"
            >
              See other brands
            </Link>
          </div>
        ) : (
          <div className="space-y-16">
            {groups.map((group, i) => (
              <div key={group.name} className="space-y-16">
                <section className="mx-auto max-w-7xl px-5 sm:px-8">
                  <div className="border-b border-rule pb-4">
                    <h2 className="display text-2xl">{group.name}</h2>
                  </div>

                  {/* Everything at once, deliberately. A horizontal rail
                      showed four and hid the rest, which made a house look
                      thinner than it is; depth is the thing a brand page is
                      supposed to convey. */}
                  <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
                    {group.items.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        brandName={brand.name}
                        showBrand={false}
                      />
                    ))}
                  </div>
                </section>

                {/* A campaign picture after every group but the last, so
                    the page breathes instead of running as one long grid,
                    and so every board the house has is actually reachable by
                    scrolling. `bands[0]` led the page, hence the offset.

                    Any house with more boards than gaps keeps the remainder
                    for the end rather than dropping them. */}
                {bands[i + 1] && i < groups.length - 1 && (
                  <BrandCampaignBand band={bands[i + 1]} brand={brand} />
                )}

                {/* A set collection after the campaign picture, so the page
                    alternates between what the house is advertising and what
                    it sells as a whole outfit. Suppressed while a set is
                    open, where the page is already about one of them. */}
                {!chosenSet && setBands[i] && i < groups.length - 1 && (
                  <BrandSetBand band={setBands[i]} brand={brand} />
                )}

                {lookbook[i] && i < groups.length - 1 && (
                  <BrandLookbook media={lookbook[i]} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Whatever did not fit between the groups. A house can easily have
          more pictures and sets than it has gaps — Casablanca sells five
          sets and has four product groups — and silently dropping a
          collection would be worse than a long page. */}
      {!chosenSet &&
        bands.slice(Math.max(groups.length, 1)).map((band) => (
          <BrandCampaignBand key={band.media.id} band={band} brand={brand} />
        ))}

      {!chosenSet &&
        setBands.slice(Math.max(groups.length - 1, 0)).map((band) => (
          <BrandSetBand key={band.key} band={band} brand={brand} />
        ))}

      <RecommendationRail title="You may also like" limit={4} tone="quiet" />
    </>
  );
}
