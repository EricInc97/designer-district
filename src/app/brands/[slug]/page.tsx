import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import SetupNotice from "@/components/SetupNotice";
import ProductCard from "@/components/ProductCard";
import ProductRail from "@/components/ProductRail";
import BrandCampaign from "@/components/BrandCampaign";
import BrandLookbook from "@/components/BrandLookbook";
import RecommendationRail from "@/components/RecommendationRail";
import type { Brand, BrandMedia, ProductWithBrand } from "@/lib/types";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string }>;
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
  const { category = "" } = await searchParams;
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
  const shown = active
    ? all.filter((p) => p.categories?.slug === active)
    : all;

  // With no filter the whole house is laid out category by category; with one
  // selected it collapses to a single grid.
  const groups = active
    ? [{ name: categories.find((c) => c.slug === active)!.name, items: shown }]
    : categories.map((c) => ({
        name: c.name,
        items: all.filter((p) => p.categories?.slug === c.slug),
      }));

  const uncategorised = all.filter((p) => !p.categories);
  if (!active && uncategorised.length > 0) {
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
      {/* ---------------- CAMPAIGN ---------------- */}
      <BrandCampaign brand={brand} media={hero} />

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
                  aria-current={!active ? "true" : undefined}
                  className={chipClass(!active)}
                >
                  All
                </Link>
              </li>
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/brands/${brand.slug}?category=${c.slug}`}
                    aria-current={active === c.slug ? "true" : undefined}
                    className={chipClass(active === c.slug)}
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

                  <div className="mt-8">
                    <ProductRail label={group.name}>
                      {group.items.map((product) => (
                        <div
                          key={product.id}
                          /* Two on a phone, three on a tablet, four on a
                             desktop: the same density the grid had, so the
                             page reads the same and only the gesture changes. */
                          className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[23%]"
                        >
                          <ProductCard
                            product={product}
                            brandName={brand.name}
                            showBrand={false}
                          />
                        </div>
                      ))}
                    </ProductRail>
                  </div>
                </section>

                {/* A band after every group but the last, so the page breathes
                    instead of running as one long grid. */}
                {lookbook[i] && i < groups.length - 1 && (
                  <BrandLookbook media={lookbook[i]} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <RecommendationRail title="You may also like" limit={4} tone="quiet" />
    </>
  );
}
