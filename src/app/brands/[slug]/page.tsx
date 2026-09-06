import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import SetupNotice from "@/components/SetupNotice";
import ProductCard from "@/components/ProductCard";
import BrandMark from "@/components/BrandMark";
import RecommendationRail from "@/components/RecommendationRail";
import type { Brand, ProductWithBrand } from "@/lib/types";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string }>;
};

type Row = ProductWithBrand & {
  categories: { id: string; name: string; slug: string } | null;
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

  const { data: products } = await supabase
    .from("products")
    .select("*, brands(id, name, slug, logo_url), categories(id, name, slug)")
    .eq("brand_id", brand.id)
    .eq("is_published", true)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });

  const all = (products ?? []) as unknown as Row[];

  // Only offer the categories this house actually stocks, in catalog order.
  const categories: { name: string; slug: string }[] = [];
  for (const product of all) {
    const c = product.categories;
    if (!c) continue;
    if (!categories.some((x) => x.slug === c.slug)) {
      categories.push({ name: c.name, slug: c.slug });
    }
  }
  categories.sort((a, b) => a.name.localeCompare(b.name));

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
      {/* ---------------- BRAND HEADER ---------------- */}
      <header className="border-b border-rule">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 py-10 sm:py-14">
          <nav aria-label="Breadcrumb" className="mb-8">
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

          <div className="flex flex-col gap-8 sm:flex-row sm:items-center">
            <div className="flex w-full max-w-xs shrink-0 items-center justify-center rounded-xl border border-rule bg-paper-raised px-6 py-10">
              <BrandMark brand={brand} size="lg" decorative />
            </div>

            <div className="min-w-0">
              <h1 className="sr-only">{brand.name}</h1>
              {brand.description && (
                <p className="max-w-xl text-sm leading-relaxed text-ink-dim">
                  {brand.description}
                </p>
              )}
            </div>
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
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-12">
        {all.length === 0 ? (
          <div className="py-20 text-center">
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
            {groups.map((group) => (
              <section key={group.name}>
                <div className="border-b border-rule pb-4">
                  <h2 className="display text-2xl">{group.name}</h2>
                </div>

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
            ))}
          </div>
        )}
      </div>

      <RecommendationRail title="You may also like" limit={4} />
    </>
  );
}
