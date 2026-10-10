import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import type { BrandMedia, ProductWithBrand } from "@/lib/types";

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
 * had no picture of its own, captioned carefully so as not to claim too
 * much. That was wrong. An advertisement on a product page is a claim about
 * that product, and a photograph of a different garment from the same house
 * is not a weaker version of the claim, it is a false one — nobody reads the
 * caption hedging it, they read the picture. A page with no hero is honest;
 * a page with somebody else's hero is not.
 */

export default function ProductCampaign({
  media,
  ownCopy,
  companions,
  brandName,
  brandSlug,
}: {
  media: BrandMedia;
  /** Whether this board's own copy is about this product's house. */
  ownCopy: boolean;
  companions: ProductWithBrand[];
  brandName: string | null;
  brandSlug: string | null;
}) {
  /*
   * Which hero this picture can stand.
   *
   * A cinema banner cover-cropped into a wide band loses nothing; it was
   * composed for one. The tall boards were cut for the tower screens and are
   * full-length outfit shots, head to shoes — crop one into that same band
   * and it loses the head and the shoes, which is the entire reason for
   * showing it. So the shape of the artwork picks the layout, rather than
   * the layout dictating a crop.
   */
  const cinematic = media.aspect === "21:9" || media.aspect === "16:9";

  // Everything here is light type over a photograph; `ink: "dark"` is the
  // rare board bright enough to need it the other way round.
  const onDark = media.ink !== "dark";
  const showLook = companions.length > 0;

  // A hero always has a headline. The board's own line when it is about this
  // house, otherwise the house's name — which is the Foot Locker brand
  // banner in miniature: picture, name, one line, one button.
  const headline = (ownCopy && media.headline) || brandName || "The campaign";
  const subhead = ownCopy ? media.subhead : null;
  const href = media.cta_href || (brandSlug ? `/brands/${brandSlug}` : null);
  const cta = media.cta_label || (brandName ? `Shop ${brandName}` : "Shop the house");
  const eyebrow = "Seen in the campaign";
  const alt = `${brandName ?? "House"} campaign photograph featuring this piece`;

  const words = (
    <>
      <p
        className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${
          onDark ? "text-white/75" : "text-ink-dim"
        }`}
      >
        {eyebrow}
      </p>
      <h2 className="display mt-3 max-w-2xl text-3xl leading-[1.05] sm:text-5xl">
        {headline}
      </h2>
      {subhead && (
        <p className="mt-4 max-w-md text-sm leading-relaxed opacity-85 sm:text-base">
          {subhead}
        </p>
      )}
      {href && (
        <Link
          href={href}
          className={`mt-7 inline-block rounded-full px-7 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] transition-opacity hover:opacity-85 ${
            onDark ? "bg-white text-ink" : "bg-ink text-paper"
          }`}
        >
          {cta}
        </Link>
      )}
    </>
  );

  return (
    <>
      {/* ---------------- HERO ----------------
          A full-width sibling of the page's constrained blocks rather than
          something breaking out of one. Breaking out means `w-screen` and a
          negative translate, and 100vw counts the scrollbar while the content
          box does not, so on a desktop it overhangs half a scrollbar at each
          edge and the whole page scrolls sideways 8px. */}
      {cinematic ? (
        <section className="relative w-full overflow-hidden">
          <div className="relative min-h-[46vh] sm:min-h-[62vh]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={media.image_url}
              alt={alt}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              aria-hidden
              className={`absolute inset-0 ${
                onDark
                  ? "bg-gradient-to-t from-black/80 via-black/35 to-black/5"
                  : "bg-gradient-to-t from-white/85 via-white/40 to-white/10"
              }`}
            />
            <div className="relative mx-auto flex min-h-[46vh] max-w-7xl flex-col justify-end px-5 pb-10 sm:min-h-[62vh] sm:px-8 sm:pb-14">
              <div className={onDark ? "text-white" : "text-ink"}>{words}</div>
            </div>
          </div>
        </section>
      ) : (
        /* The tall boards get a band rather than a crop: the picture keeps
           its own shape and the words take the space beside it. On a phone
           they stack, picture first.

           Bounded by height, not by a ratio box. Given the column width a
           2:3 board came out 825 by 1237 — a screen and a half of nothing but
           photograph, which is not a hero, it is a wall. Capping the height
           and letting the width follow keeps the whole figure visible, head
           to shoes, at the size of a picture rather than a billboard. */
        <section className="w-full bg-ink text-white">
          <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-14">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={media.image_url}
              alt={alt}
              className="mx-auto max-h-[58vh] w-auto max-w-full rounded-lg"
            />
            <div>{words}</div>
          </div>
        </section>
      )}

      {/* ---------------- SHOP THE LOOK ----------------
          The other garments in the same photograph, so the rest of the look
          is the rest of a look the shopper is looking at. */}
      {showLook && (
        <section className="mx-auto max-w-7xl px-5 pt-12 sm:px-8 sm:pt-16">
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
        </section>
      )}
    </>
  );
}
