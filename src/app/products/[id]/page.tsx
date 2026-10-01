import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Truck, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import SetupNotice from "@/components/SetupNotice";
import ProductGallery from "@/components/ProductGallery";
import ProductBuyPanel from "@/components/ProductBuyPanel";
import ProductViewTracker from "@/components/ProductViewTracker";
import LiveViewers from "@/components/LiveViewers";
import ProductCard from "@/components/ProductCard";
import RecommendationRail from "@/components/RecommendationRail";
import ProductCampaign from "@/components/ProductCampaign";
import { money } from "@/lib/format";
import type { BrandMedia, ProductWithBrand } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!supabaseConfigured || !UUID.test(id)) return { title: "Product" };

  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("name, description, brands(name)")
    .eq("id", id)
    .single();

  if (!data) return { title: "Product not found" };
  // PostgREST types the embed as an array; the FK makes it at most one row.
  const brand = (data.brands as unknown as { name: string } | null)?.name;
  return {
    title: brand ? `${data.name} · ${brand}` : data.name,
    description: data.description ?? undefined,
  };
}

const promises = [
  { icon: Truck, label: "Tracked shipping, dispatched within 48 hours" },
  { icon: RotateCcw, label: "30-day returns for store credit" },
];

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  if (!supabaseConfigured) return <SetupNotice />;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("*, brands(id, name, slug, logo_url)")
    .eq("id", id)
    .single<ProductWithBrand>();

  if (!product || !product.is_published) notFound();

  const brand = product.brands;

  /*
   * Same house, different pieces, the most reliable cross-sell there is —
   * and, alongside it, the campaign artwork.
   *
   * Two separate reads rather than one `or`, because they ask genuinely
   * different questions and only the first is about this garment.
   *
   * `inPicture` is every board this product is actually in, whoever's board
   * it is. That last part matters: a good few of these are collaborations —
   * "Chrome Hearts x Purple Brand", "Supreme x Ksubi" — so the picture that
   * shows a Purple Brand jean being worn is filed under Chrome Hearts. A
   * query scoped to the product's own house would miss exactly the shots
   * worth showing.
   */
  const [{ data: siblings }, { data: inPicture }, { data: houseBoards }] =
    await Promise.all([
      supabase
        .from("products")
        .select("*, brands(id, name, slug, logo_url)")
        .eq("brand_id", product.brand_id)
        .eq("is_published", true)
        .neq("id", product.id)
        .limit(4),
      supabase
        .from("brand_media")
        .select("*")
        .eq("kind", "board")
        .eq("is_published", true)
        .contains("product_ids", [product.id]),
      supabase
        .from("brand_media")
        .select("*")
        .eq("kind", "board")
        .eq("is_published", true)
        .eq("brand_id", product.brand_id)
        .order("sort_order", { ascending: true }),
    ]);

  const more = (siblings ?? []) as ProductWithBrand[];

  /*
   * Which picture, and what it is allowed to claim.
   *
   * Of the shots this garment is in, the one dressing the most products wins:
   * those are the full outfits rather than the single-garment detail shots,
   * so they are both the better photograph and the better thing to shop.
   * Failing that the house's own first board, captioned as the house's
   * campaign and nothing more.
   */
  const worn = ((inPicture ?? []) as BrandMedia[])
    .slice()
    .sort(
      (a, b) =>
        (b.product_ids?.length ?? 0) - (a.product_ids?.length ?? 0) ||
        a.sort_order - b.sort_order,
    )[0] ?? null;
  const campaign = worn ?? ((houseBoards ?? []) as BrandMedia[])[0] ?? null;

  // The other garments in that photograph. Only ever offered for a picture
  // this product is genuinely in, so "the rest of the look" is the rest of a
  // look the shopper is actually looking at.
  const lookIds = worn
    ? (worn.product_ids ?? []).filter((pid) => pid !== product.id)
    : [];
  const { data: lookRows } = lookIds.length
    ? await supabase
        .from("products")
        .select("*, brands(id, name, slug, logo_url)")
        .in("id", lookIds)
        .eq("is_published", true)
    : { data: [] };
  const companions = (lookRows ?? []) as ProductWithBrand[];

  // Whether the board's own copy is about this house: either it is this
  // house's board, or it is a collaboration whose title names this house.
  const ownCopy =
    campaign != null &&
    (campaign.brand_id === product.brand_id ||
      (brand?.name != null &&
        (campaign.headline ?? "")
          .toLowerCase()
          .includes(brand.name.toLowerCase())));
  const gallery = [product.image_url, ...(product.gallery ?? [])].filter(
    (src): src is string => Boolean(src),
  );

  const onSale =
    product.compare_at_price != null &&
    Number(product.compare_at_price) > Number(product.price);

  return (
    <>
      <ProductViewTracker productId={product.id} />

      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-8 sm:py-12">
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-ink-faint">
            <li>
              <Link href="/" className="hover:text-ink transition-colors">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            {brand && (
              <>
                <li>
                  <Link
                    href={`/brands/${brand.slug}`}
                    className="hover:text-ink transition-colors"
                  >
                    {brand.name}
                  </Link>
                </li>
                <li aria-hidden>/</li>
              </>
            )}
            <li className="text-ink-dim">{product.name}</li>
          </ol>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          {/* ---------------- GALLERY ---------------- */}
          <ProductGallery images={gallery} alt={product.name} slug={product.slug} />

          {/* ---------------- DETAILS ---------------- */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            {brand && (
              <Link
                href={`/brands/${brand.slug}`}
                className="eyebrow hover:text-ink transition-colors"
              >
                {brand.name}
              </Link>
            )}

            <h1 className="display mt-3 text-3xl sm:text-4xl leading-tight">
              {product.name}
            </h1>

            <div className="mt-5 flex items-baseline gap-3">
              <p className="text-2xl tabular-nums">{money(product.price)}</p>
              {onSale && (
                <p className="text-sm text-ink-faint line-through tabular-nums">
                  {money(product.compare_at_price)}
                </p>
              )}
            </div>

            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs uppercase tracking-[0.18em]">
              {product.stock_count === 0 ? (
                <span className="text-ink-faint">Sold out</span>
              ) : product.stock_count <= 3 ? (
                <span className="text-danger">
                  Only {product.stock_count} left
                </span>
              ) : (
                <span className="text-success">In stock</span>
              )}
              {/* The item number, so a shopper can quote it back on a ticket. */}
              {product.sku && (
                <span className="font-mono normal-case tracking-normal text-ink-faint">
                  {product.sku}
                </span>
              )}
            </p>

            <LiveViewers productId={product.id} />

            {product.description && (
              <p className="mt-7 text-sm leading-relaxed text-ink-dim">
                {product.description}
              </p>
            )}

            <div className="mt-9">
              <ProductBuyPanel
                product={{
                  id: product.id,
                  name: product.name,
                  price: Number(product.price),
                  image_url: product.image_url,
                  stock_count: product.stock_count,
                  sizes: product.sizes ?? [],
                }}
                brandName={brand?.name ?? null}
              />
            </div>

            <ul className="mt-9 space-y-3 border-t border-rule pt-7">
              {promises.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3 text-xs text-ink-faint">
                  <Icon size={15} strokeWidth={1.5} className="shrink-0" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>

          {/* ---------------- CAMPAIGN ---------------- */}
        {campaign && (
          <ProductCampaign
            media={campaign}
            worn={Boolean(worn)}
            ownCopy={ownCopy}
            companions={companions}
            brandName={brand?.name ?? null}
            brandSlug={brand?.slug ?? null}
          />
        )}

        {/* ---------------- MORE FROM BRAND ---------------- */}
        {more.length > 0 && (
          <section className="mt-24 border-t border-rule pt-12">
            <h2 className="eyebrow">More from {brand?.name}</h2>
            <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
              {more.map((sibling) => (
                <ProductCard
                  key={sibling.id}
                  product={sibling}
                  brandName={brand?.name}
                  showBrand={false}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      <RecommendationRail
        title="Goes with this"
        limit={4}
        anchor={product.id}
      />
    </>
  );
}
