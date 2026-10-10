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
 * The mark sits above the words and the words sit on paper, under the
 * picture rather than over it. Type laid over a photograph needs a scrim to
 * stay legible, a scrim darkens the half of the picture it covers, and these
 * were composed with the garment in that half. Underneath, the copy is always
 * readable and nothing has to be hidden to make it so.
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
   * A cinema banner can be cropped to a band; it was composed for one. The
   * tall boards were cut for the tower screens and are full-length outfit
   * shots, head to shoes — crop one and it loses the head and the shoes,
   * which is the entire reason for showing it. So the shape of the artwork
   * picks the fit, rather than the layout dictating a crop.
   */
  const cinematic = media.aspect === "21:9" || media.aspect === "16:9";
  const [aw, ah] = (media.aspect ?? "").split(":");
  const banner = aw && ah ? `${aw} / ${ah}` : "21 / 9";

  const brandName = brand?.name ?? null;
  const headline = (ownCopy && media.headline) || brandName || "The campaign";
  const subhead = ownCopy ? media.subhead : null;
  const href = media.cta_href || (brand?.slug ? `/brands/${brand.slug}` : null);
  const cta = media.cta_label || (brandName ? `Shop ${brandName}` : "Shop the house");
  const alt = `${brandName ?? "House"} campaign photograph featuring this piece`;

  return (
    /* A full-width sibling of the page's constrained blocks rather than
       something breaking out of one. Breaking out means w-screen and a
       negative translate, and 100vw counts the scrollbar while the content box
       does not, so on a desktop it overhangs half a scrollbar at each edge and
       the whole page scrolls sideways 8px. */
    <section className="w-full border-y border-rule bg-paper">
      {/* The banner takes its height from its own aspect rather than from a
          vh figure. A fixed height crops whichever way the mismatch falls,
          and on a wide screen it falls vertically: at 1280 a 21:9 board wants
          549px and a 42vh box gives it 384, so it loses thirty per cent off
          the top and bottom — which on a full-length group shot is the heads
          and the shoes. Letting the shape set the height means it is never
          cropped at any width. */}
      {cinematic ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={media.image_url}
          alt={alt}
          style={{ aspectRatio: banner }}
          className="w-full object-cover"
        />
      ) : (
        <div className="flex justify-center px-5 pt-8 sm:px-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={media.image_url}
            alt={alt}
            className="max-h-[46vh] w-auto max-w-full object-contain sm:max-h-[56vh]"
          />
        </div>
      )}

      <div className="mx-auto max-w-7xl px-5 py-9 sm:px-8 sm:py-12">
        {/* The house's mark, then what the campaign says, then the way
            through. Decorative: the page's own h1 already names the product
            and the breadcrumb already names the house, so the mark does not
            need reading out a third time. */}
        {brand && <BrandMark brand={brand} size="sm" decorative className="!text-ink" />}

        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-faint">
          Seen in the campaign
        </p>
        <h2 className="display mt-2 max-w-2xl text-2xl leading-tight sm:text-4xl">
          {headline}
        </h2>
        {subhead && (
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-dim sm:text-base">
            {subhead}
          </p>
        )}
        {href && (
          <Link
            href={href}
            className="mt-7 inline-block rounded-full bg-ink px-7 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-paper transition-opacity hover:opacity-85"
          >
            {cta}
          </Link>
        )}

        {/* The other garments in the same photograph, so the rest of the look
            is the rest of a look the shopper is looking at. */}
        {companions.length > 0 && (
          <>
            <div className="mt-12 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-t border-rule pt-8">
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
          </>
        )}
      </div>
    </section>
  );
}
