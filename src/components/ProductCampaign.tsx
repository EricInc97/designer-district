import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import ProductCard from "@/components/ProductCard";
import Reveal from "@/components/Reveal";
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
  brand: Pick<Brand, "name" | "slug" | "logo_url" | "description"> | null;
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
  const rawHead = (ownCopy && media.headline) || brandName || "The campaign";
  // The board's own line and nothing else. It used to fall back to the
  // house description, which is a paragraph where every board already
  // carries something short enough to read at a glance.
  const rawSub = (ownCopy ? media.subhead : null) || null;
  /* The mark above already says the house, so a headline that is only the
     house name says it twice — and on a house with no logo file, where the
     mark falls back to the wordmark, it is the same word twice in type. When
     that happens the subheading is promoted and carries the line. */
  const echoesMark =
    brandName != null && rawHead.trim().toLowerCase() === brandName.trim().toLowerCase();
  const headline = echoesMark && rawSub ? rawSub : rawHead;
  const subhead = echoesMark && rawSub ? null : rawSub;
  const href = media.cta_href || (brand?.slug ? `/brands/${brand.slug}` : null);
  const alt = `${brandName ?? "House"} campaign photograph featuring this piece`;

  /* Where the caption can go, and why it is not always on the picture.
   *
   * An upright board is tall enough to carry words at any width. A landscape
   * one is not: at 375 across, a 21:9 board is 161px tall and this caption is
   * about 169, so laid over it the words were taller than the photograph and
   * spilled off the top — the mark ended up on the white above the picture
   * and across the headline. Measured, not guessed.
   *
   * So a landscape board carries its caption underneath on a phone and on the
   * photograph from `lg`, where the same board is four hundred pixels tall
   * and there is room. One element, repositioned by breakpoint, rather than
   * two copies, which would put the words in the document twice.
   *
   * The scrim only appears where the caption is over the picture, so a board
   * captioned underneath is not darkened for nothing. Three stacked shadows
   * on the type as well: a scrim cannot be trusted on its own when the bottom
   * third of a picture might be pale travertine in full sun.
   */
  const over = !cinematic;
  const caption = (
    <>
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/55 to-transparent ${
          over ? "" : "hidden lg:block"
        }`}
      />
      <div
        className={
          over
            ? "absolute inset-x-0 bottom-0 p-5 text-white sm:p-8"
            : "px-5 py-7 text-ink sm:px-8 lg:absolute lg:inset-x-0 lg:bottom-0 lg:p-8 lg:text-white"
        }
      >
        <div className="mx-auto max-w-7xl">
          {brand && (
            <BrandMark
              brand={brand}
              size="sm"
              decorative
              hovered={over}
              className={
                over
                  ? "!text-white [filter:drop-shadow(0_1px_3px_rgba(0,0,0,0.85))]"
                  : "!text-ink lg:!text-white lg:[filter:drop-shadow(0_1px_3px_rgba(0,0,0,0.85))]"
              }
            />
          )}
          <p
            className={`mt-3 text-[10px] font-semibold uppercase tracking-[0.22em] sm:text-[11px] ${
              over
                ? "text-white/75 [text-shadow:0_1px_3px_rgba(0,0,0,0.85)]"
                : "text-ink-faint lg:text-white/75 lg:[text-shadow:0_1px_3px_rgba(0,0,0,0.85)]"
            }`}
          >
            Seen in the campaign
          </p>
          <h2
            className={`display mt-1.5 max-w-2xl text-2xl leading-tight sm:text-4xl ${
              over
                ? "[text-shadow:0_1px_3px_rgba(0,0,0,0.85)]"
                : "lg:[text-shadow:0_1px_3px_rgba(0,0,0,0.85)]"
            }`}
          >
            {headline}
          </h2>
          {subhead && (
            <p
              className={`mt-2 max-w-md text-sm leading-relaxed ${
                over
                  ? "text-white/85 [text-shadow:0_1px_3px_rgba(0,0,0,0.85)]"
                  : "text-ink-dim lg:text-white/85 lg:[text-shadow:0_1px_3px_rgba(0,0,0,0.85)]"
              }`}
            >
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
              className={`mt-5 inline-block rounded-full px-6 py-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] transition-opacity hover:opacity-85 sm:px-7 sm:py-3 sm:text-[11px] ${
                over ? "bg-white text-ink" : "bg-ink text-paper lg:bg-white lg:text-ink"
              }`}
            >
              Shop the look
            </a>
          ) : (
            href && (
              <Link
                href={href}
                className={`mt-5 inline-block rounded-full px-6 py-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] transition-opacity hover:opacity-85 sm:px-7 sm:py-3 sm:text-[11px] ${
                  over ? "bg-white text-ink" : "bg-ink text-paper lg:bg-white lg:text-ink"
                }`}
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
      <Reveal>
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
        /* Edge to edge on a phone, capped by height from sm up.
           An upright board contained in a centred column left white down
           both sides and a picture barely half the width of the screen,
           which is not what a campaign looks like on a phone. At full bleed
           a 2:3 board is 375 by 562 and fills it. On a desktop the same rule
           would make it 1920 tall, so there the height is capped and the
           picture centres instead. */
        <div className="flex justify-center">
          <div className="relative w-full sm:w-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={media.image_url}
              alt={alt}
              style={{ aspectRatio: banner }}
              className="block w-full object-cover sm:h-[64vh] sm:w-auto sm:max-w-full"
            />
            {caption}
          </div>
        </div>
      )}

      </Reveal>

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
