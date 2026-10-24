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

  /* A brand page sells one house.
   *
   * Several of these photographs are collaborations, and that is good for
   * the picture and wrong for the page it hangs on. Supreme's page was
   * headlined "Supreme x Ksubi" and listed Ksubi jeans for sale under it,
   * which is a rival's advertisement on Supreme's shopfront. The other
   * label is still in the photograph, worn, because that is how the outfit
   * was styled — it is simply not named and not sold here.
   *
   * So two things are trimmed to the house:
   *
   *   the goods   only this house's pieces are offered. The rest of the
   *               look is still shoppable from the product pages, where
   *               the whole outfit is the point.
   *
   *   the line    a headline naming another house on this site is dropped
   *               for the house's own name. Detected from the garments in
   *               the picture rather than from a list of brand names, so
   *               it stays true if the roster changes: if a board dresses
   *               someone in Ksubi and says "Ksubi", that is the other
   *               house talking.
   *
   * "Supreme x Ducati" survives this, and should: Ducati is a motorcycle
   * company the garment is licensed from, not a shop in the district.
   */
  const bands: CampaignBand[] = boards.map((m) => {
    const inShot = (m.product_ids ?? [])
      .map((id) => byId.get(id))
      .filter((p): p is ProductWithBrand => Boolean(p));

    const otherHouses = [
      ...new Set(
        inShot
          .filter((p) => p.brand_id !== brand.id && p.brands?.name)
          .map((p) => p.brands!.name),
      ),
    ];
    const rawHead = m.headline ?? "";
    const namesARival = otherHouses.some((n) =>
      rawHead.toLowerCase().includes(n.toLowerCase()),
    );
    const mine =
      !namesARival &&
      (m.brand_id === brand.id ||
        rawHead.toLowerCase().includes(brand.name.toLowerCase()));

    const head = (mine && rawHead) || brand.name;
    const sub = (mine && m.subhead) || null;
    // The mark above already says the house, so a headline that is only the
    // house name says it twice; the short line is promoted to carry it.
    const echoes = head.trim().toLowerCase() === brand.name.trim().toLowerCase();

    return {
      media: m,
      items: inShot.filter((p) => p.brand_id === brand.id),
      headline: echoes && sub ? sub : head,
      subhead: echoes && sub ? null : sub,
    };
  });

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
  /* Which sets still want a band of their own.
   *
   * A set of one is not a set: a half whose partner is out of stock or
   * unpublished would otherwise get a collection band to itself.
   *
   * And a set already being worn in a campaign picture on this page does
   * not need a second, lesser introduction. Supreme is the case that
   * forced this: its three Ducati sets each got a band, and the hero
   * already shows all three of them on three people, so the page carried
   * four Ducati blocks — one photograph and three flat-lays of the same
   * tracksuit in different colours. A photograph of the thing worn beats a
   * cut-out of it every time, so where the campaign covers a set in full,
   * the band stands down.
   */
  const wornInCampaign = new Set(bands.flatMap((b) => b.media.product_ids ?? []));
  const setBands = [...setMap.values()].filter(
    (x) => x.items.length > 1 && !x.items.every((p) => wornInCampaign.has(p.id)),
  );

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
   * Validated against every set the house sells, not against `setBands`,
   * which is a narrower thing: the sets still wanting a collection band of
   * their own. A set worn in full in a campaign picture is deliberately not
   * in that list, and those are exactly the sets a campaign's "shop the
   * look" links to — so validating against it sent Casablanca's Green Terry
   * Set to an unfiltered page showing the whole house. The suppression is
   * about whether to draw a band, never about whether the set exists.
   *
   * Still validated rather than trusted, so an unknown or stale key falls
   * back to the whole house instead of showing an empty shop, and a set
   * whose partner has gone out of stock is no longer a set.
   */
  const named = set ? (setMap.get(set) ?? null) : null;
  const chosenSet = named && named.items.length > 1 ? named : null;

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

  /* The page is a sequence of chapters, then the rest of the shop.
   *
   * Each campaign photograph is followed by the garments that are in it,
   * and only then does the ordinary grid begin — so a shopper meets a
   * picture and immediately meets the clothes it is selling, instead of
   * meeting every picture the house has and finding the clothes much later.
   *
   * That ordering is also what keeps the page free of duplicates, and it is
   * the better way round. The earlier fix dropped the garments from under
   * the picture because they appeared again in the grid; this drops them
   * from the grid instead, because under the picture is where they mean
   * something. Casablanca had six of nineteen products twice over and
   * Supreme the same; neither does now.
   *
   * With a category or a set open the page is a filtered shop rather than a
   * story, so the chapters keep their photographs, give up their garment
   * panels, and nothing is stripped from the grid.
   */
  const filtering = Boolean(active || chosenSet);

  /* Which collection a photograph is actually promoting.
   *
   * Only when the shot holds exactly one set and holds all of it: a picture
   * of three Ducati colourways promotes three sets, and a picture of half a
   * set promotes nothing anyone could honestly be sent to. In those cases
   * "Shop the look" falls back to the garments underneath, which is the
   * thing the picture is pointing at anyway.
   */
  const promotedSet = (b: CampaignBand) => {
    const keys = [...new Set(b.items.map((x) => x.set_key).filter(Boolean))];
    if (keys.length !== 1) return undefined;
    const whole = setMap.get(keys[0] as string);
    if (!whole || !whole.items.every((x) => b.items.some((y) => y.id === x.id)))
      return undefined;
    return `/brands/${brand.slug}?set=${encodeURIComponent(keys[0] as string)}`;
  };

  const chapters: CampaignBand[] = bands.map((b) => ({
    ...b,
    shopHref: promotedSet(b),
    items: filtering ? [] : b.items,
  }));

  const inChapters = new Set(chapters.flatMap((c) => c.items.map((x) => x.id)));
  const rest = groups
    .map((g) => ({ ...g, items: g.items.filter((x) => !inChapters.has(x.id)) }))
    .filter((g) => g.items.length > 0);

  const chipClass = (on: boolean) =>
    `inline-block rounded-full border px-4 py-2 text-[11px] uppercase tracking-[0.16em] transition-colors ${
      on
        ? "border-ink bg-ink text-paper"
        : "border-rule-strong text-ink-dim hover:border-ink hover:text-ink"
    }`;

  return (
    <>
      {/* ---------------- THE CAMPAIGN ----------------
          Every picture the house has, each held on screen while the clothes
          in it come up over it, in order. This replaced a carousel and then
          a set of bands scattered between the product groups; both had the
          same fault, which is that a photograph and the garments it is
          advertising ended up in different parts of the page.

          BrandCampaign stays as the fallback it always was: the house
          colourway with its mark centred, for a house with nothing shot. */}
      {chapters.length > 0 ? (
        chapters.map((band, i) => (
          <BrandCampaignBand
            key={band.media.id}
            band={band}
            brand={brand}
            priority={i === 0}
          />
        ))
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
      <div id="products" className="scroll-mt-20 py-12">
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
            {rest.map((group, i) => (
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

                {/* A set collection between the groups, so the grid is
                    broken up by what the house sells as a whole outfit. The
                    campaign pictures are no longer dropped in here — they
                    are the chapters above, each with its own garments under
                    it. Suppressed while a set is open, where the page is
                    already about one of them. */}
                {!chosenSet && setBands[i] && i < rest.length - 1 && (
                  <BrandSetBand band={setBands[i]} brand={brand} />
                )}

                {lookbook[i] && i < rest.length - 1 && (
                  <BrandLookbook media={lookbook[i]} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Whatever did not fit between the groups. A house can easily have
          more sets than it has gaps — Casablanca sells five and has four
          product groups — and silently dropping a collection would be
          worse than a long page. */}
      {!chosenSet &&
        setBands.slice(Math.max(rest.length - 1, 0)).map((band) => (
          <BrandSetBand key={band.key} band={band} brand={brand} />
        ))}

      <RecommendationRail title="You may also like" limit={4} tone="quiet" />
    </>
  );
}
