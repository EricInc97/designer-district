import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import ProductCard from "@/components/ProductCard";
import type { Brand, BrandMedia, ProductWithBrand } from "@/lib/types";

/**
 * The campaign artwork, as the hero of a product page.
 *
 * Forty-four of these were generated for the hoardings in the 3D street and
 * then only ever shown there. They are the only images in the catalog with a
 * person in them — every product photograph is a flat-lay or a cut-out — so
 * they answer the one question a flat-lay cannot, which is what the thing
 * looks like worn. That earns the full width of the page.
 *
 * It only ever renders a picture this garment is genuinely in. The campaign
 * generator recorded what it dressed the models in, so that is a fact rather
 * than a hunch, and the page can say "seen in the campaign" and mean it.
 *
 * An earlier version fell back to the house's other artwork when a garment
 * had no picture of its own, captioned carefully so as not to claim too much.
 * That was wrong. An advertisement on a product page is a claim about that
 * product, and a photograph of a different garment from the same house is not
 * a weaker version of the claim, it is a false one — nobody reads the caption
 * hedging it, they read the picture. A page with no hero is honest; a page
 * with somebody else's hero is not.
 *
 * The picture is the hero and the caption sits on it: the house's mark, the
 * campaign line, and the way to shop it. The garments themselves go
 * underneath, at a size worth clicking.
 */
export default function ProductCampaign({
  media,
  ownCopy,
  companions,
  brand,
}: {
  media: BrandMedia;
  /** Whether this board's own copy is about this product's house. */
  ownCopy: boolean;
  companions: ProductWithBrand[];
  brand: Pick<Brand, "name" | "slug" | "logo_url"> | null;
}) {
  /*
   * How the picture is fitted.
   *
   * A cinema banner takes the full width at its own aspect: never cropped,
   * because a fixed height crops whichever way the mismatch falls and on a
   * wide screen it falls vertically — at 1280 a 21:9 board wants 542px, and
   * a 42vh box would give it 384 and take thirty per cent off the top and
   * bottom, which on a full-length group shot is the heads and the shoes.
   *
   * The tall boards were cut for the tower screens and would be absurd at
   * full width, so those are centred and capped by height instead.
   */
  const cinematic = media.aspect === "21:9" || media.aspect === "16:9";
  const [aw, ah] = (media.aspect ?? "").split(":");
  const banner = aw && ah ? `${aw} / ${ah}` : "21 / 9";

  const brandName = brand?.name ?? null;
  const headline = (ownCopy && media.headline) || brandName || "The campaign";
  const subhead = ownCopy ? media.subhead : null;
  const href = media.cta_href || (brand?.slug ? `/brands/${brand.slug}` : null);
  const alt = `${brandName ?? "House"} campaign photograph featuring this piece`;

  /* The caption, laid on the photograph.
   *
   * The scrim is the caption's own, covering only the band the words sit in,
   * so the garment above it stays as photographed. Three stacked shadows on
   * the type as well: a scrim alone cannot be trusted when the bottom third
   * of a picture might be pale travertine in full sun. */
  const caption = (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/55 to-transparent"
      />
      <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-8">
        <div className="mx-auto max-w-7xl">
          {brand && (
            <BrandMark
              brand={brand}
              size="sm"
              decorative
              hovered
              className="!text-white [filter:drop-shadow(0_1px_3px_rgba(0,0,0,0.85))]"
            />
          )}
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/75 [text-shadow:0_1px_3px_rgba(0,0,0,0.85)] sm:text-[11px]">
            Seen in the campaign
          </p>
          <h2 className="display mt-1.5 max-w-2xl text-xl leading-tight [text-shadow:0_1px_3px_rgba(0,0,0,0.85)] sm:text-4xl">
            {headline}
          </h2>
          {subhead && (
            <p className="mt-2 max-w-md text-xs leading-relaxed text-white/85 [text-shadow:0_1px_3px_rgba(0,0,0,0.85)] sm:text-sm">
              {subhead}
            </p>
          )}
          {/* Straight down to the garments in this picture when there are
              any, because that is what "shop the look" promises. With none
              to show, it is the house instead, and it says so rather than
              promising a look and delivering a brand page. */}
          {companions.length > 0 ? (
            <a
              href="#shop-the-look"
              className="mt-5 inline-block rounded-full bg-white px-6 py-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink transition-opacity hover:opacity-85 sm:px-7 sm:py-3 sm:text-[11px]"
            >
              Shop the look
            </a>
          ) : (
            href && (
              <Link
                href={href}
                className="mt-5 inline-block rounded-full bg-white px-6 py-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink transition-opacity hover:opacity-85 sm:px-7 sm:py-3 sm:text-[11px]"
              >
                {brandName ? `Shop ${brandName}` : "Shop the house"}
              </Link>
            )
          )}
        </div>
      </div>
    </>
  );

  return (
    /* A full-width sibling of the page's constrained blocks rather than
       something breaking out of one. Breaking out means w-screen and a
       negative translate, and 100vw counts the scrollbar while the content box
       does not, so on a desktop it overhangs half a scrollbar at each edge and
       the whole page scrolls sideways 8px. */
    <section className="w-full border-y border-rule bg-paper">
      {cinematic ? (
        <div className="relative w-full" style={{ aspectRatio: banner }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={media.image_url} alt={alt} className="h-full w-full object-cover" />
          {caption}
        </div>
      ) : (
        /* Centred and capped: a 2:3 board at full width would be three
           screens tall. The wrapper shrink-wraps to the rendered image so the
           caption lands on the photograph rather than on the paper beside
           it. */
        <div className="flex justify-center">
          {/* inline-BLOCK, and the cap in vh on the image itself. As an
              inline-flex the image becomes a flex item and gets stretched on
              the cross axis, which makes the wrapper wider than the picture
              and spreads the caption across the empty paper beside it. With
              only a max-width and a max-height the image keeps its aspect,
              so the wrapper shrink-wraps the photograph exactly. */}
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={media.image_url}
              alt={alt}
              className="block max-h-[52vh] w-auto max-w-full sm:max-h-[64vh]"
            />
            {caption}
          </div>
        </div>
      )}

      {/* The other garments in the same photograph, so the rest of the look is
          the rest of a look the shopper is looking at. */}
      {companions.length > 0 && (
        <div
          id="shop-the-look"
          className="mx-auto max-w-7xl scroll-mt-24 px-5 py-10 sm:px-8 sm:py-12"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <h3 className="eyebrow">Shop the look</h3>
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-faint">
              {companions.length} more in this picture
            </p>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
            {companions.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
