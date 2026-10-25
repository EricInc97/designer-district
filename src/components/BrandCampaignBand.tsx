import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import Reveal from "@/components/Reveal";
import GlReveal from "@/components/GlReveal";
import ProductImage from "@/components/ProductImage";
import { money } from "@/lib/format";
import type { Brand, BrandMedia, ProductWithBrand } from "@/lib/types";

export type CampaignBand = {
  media: BrandMedia;
  /**
   * The garments from this photograph that belong to the house whose page
   * this is. A collaboration dresses the models in two labels, and the other
   * one is styling here, not stock to be sold off a rival's page.
   */
  items: ProductWithBrand[];
  /** The line over the picture, already resolved against the house. */
  headline: string;
  /** The short line under it, or nothing. */
  subhead: string | null;
  /**
   * Where "Shop the look" goes when the picture is selling something the
   * shop already has a name for.
   *
   * A photograph of a co-ordinated set should lead to that set, so this
   * carries the set's own view. Without one the link falls back to the
   * garments directly beneath the picture, which is what it is pointing at
   * anyway. What it must never be is one product chosen out of a group,
   * which is what an earlier version did whenever a shot held a single
   * piece: the shopper pressed "shop the look" and landed on one item with
   * no way of knowing why that one.
   */
  shopHref?: string;
};

/** The shape it was generated at, as a CSS ratio, and whether it is upright. */
function shapeOf(aspect: string | null) {
  const [w, h] = (aspect ?? "").split(":").map(Number);
  const ok = Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0;
  const ratio = ok ? w / h : 2 / 3;
  return { css: ok ? `${w} / ${h}` : "2 / 3", ratio, upright: ratio < 1 };
}

/**
 * One chapter of a house's campaign: the photograph, held, and then the
 * clothes in it.
 *
 * The page reads as a sequence. The artwork takes the screen; scrolling
 * brings the garments from that picture up over it while the picture stays
 * put; then the next picture takes the screen and does the same; and after
 * the last one comes the rest of the shop. Every photograph is answered by
 * the things it is selling, in the order a shopper meets them, instead of a
 * wall of pictures followed much later by a wall of products.
 *
 * The holding is one `position: sticky` on the picture and an opaque panel
 * after it in the same section. No scroll listener, no observer, no
 * JavaScript at all: the browser pins the picture for exactly as long as the
 * section is on screen and the panel slides over it. That matters most on a
 * phone, where a scroll-driven effect fights the compositor and this does
 * not.
 *
 * Three things about the sizing, each of which was a bug first.
 *
 * It pins below the header, not at the top, because the header is itself
 * `sticky top-0` and opaque, so a picture pinned at 0 loses its top 64px
 * underneath it.
 *
 * The stage is `min(the screen, the picture's own height at full width)`
 * rather than the screen. Full height for an upright board, which is eleven
 * of the eighteen, and natural height for a wide one — because making a 21:9
 * board fill a phone screen means cropping four fifths of its width, and
 * these photographs are people head to shoes. Nothing is ever cropped: the
 * box is cut to the picture's aspect and the picture fills the box.
 *
 * And the caption always sits on the photograph, so it has to fit the
 * shortest one: a 21:9 board on a 375 phone is 161px tall. Below `sm` a wide
 * board therefore drops its subheading and tightens its type, leaving about
 * 79px. Measured, not guessed — an earlier version laid the full caption
 * over it and the mark ended up on the white above the picture.
 */
export default function BrandCampaignBand({
  band: { media, items, headline, subhead, shopHref },
  brand,
  priority = false,
}: {
  band: CampaignBand;
  brand: Pick<Brand, "name" | "slug" | "logo_url" | "description">;
  /** The first chapter on the page is the hero, so it loads eagerly. */
  priority?: boolean;
}) {
  const shape = shapeOf(media.aspect);
  const lookId = `look-${media.id}`;
  const wide = !shape.upright;

  /* The picture's box is sized by width, and the stage simply hugs it.
   *
   * Width, not height, because the one unit that must not appear here is
   * `vw`. Sizing the stage as `min(100svh - 4rem, 100vw / ratio)` made the
   * box 736px inside a 721px stage on a desktop with a scrollbar — 100vw
   * counts the scrollbar and the content box does not — so fifteen pixels
   * of every wide photograph were quietly clipped. `100%` is the stage's
   * own content width and knows about the scrollbar.
   *
   * So: as wide as it can be, but never wider than the height below the
   * header allows, and the aspect does the rest. The box is then exactly
   * the photograph, which is what lets the canvas laid over it line up with
   * the pixels underneath, and nothing is ever cropped. */
  const boxW = `min(100%, calc((100svh - 4rem) * ${shape.ratio}))`;

  // Its own garments when it has them, or wherever the house keeps them.
  const shopTo = shopHref ?? (items.length > 0 ? `#${lookId}` : undefined);

  return (
    // `isolate` keeps the two z-indexes below private to this chapter, so
    // the panel rising over its own photograph is never compared against
    // the next chapter's stage.
    <section
      className="relative isolate w-full bg-paper"
      aria-label={`${brand.name} campaign`}
    >
      {/* ── the photograph, held while the clothes come up over it ── */}
      <div className="sticky top-16 z-0 flex w-full justify-center overflow-hidden bg-paper">
        <div className="relative" style={{ width: boxW, aspectRatio: shape.css }}>
          <GlReveal
            src={media.image_url}
            alt={`${brand.name} campaign photograph`}
            loading={priority ? "eager" : "lazy"}
            /* The hero defers rather than opting out. It is still the LCP
               element, so the largest paint is a plain decoded image on the
               critical path and the canvas takes over a moment after load.
               Refusing it outright was the wrong call for a plain reason:
               nine of the fifteen houses have exactly one campaign picture,
               and it is the hero, so on most of the site the effect existed
               nowhere at all. */
            defer={priority}
            className="block h-full w-full object-cover"
            wrapClassName="block h-full w-full"
          />

          {/* Drawn in from the left, matching the lookbook band this page
              already uses, rather than up from the bottom. A second, gentler
              wash up from the floor as well: the left gradient alone leaves
              the lower-right of a wide picture bright, and the words sit
              across it. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/80 via-black/35 to-transparent"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent"
          />

          <div
            className={`absolute inset-x-0 bottom-0 text-white ${
              wide ? "p-4 sm:p-7" : "p-5 sm:p-7"
            }`}
          >
            <div className="mx-auto max-w-7xl">
              <BrandMark
                brand={brand}
                size="sm"
                decorative
                hovered
                className="!text-white [filter:drop-shadow(0_1px_3px_rgba(0,0,0,0.85))]"
              />
              {/* Nothing where the line would only repeat the mark above
                  it. A collaboration board on one partner's page has the
                  rival's name stripped out of its headline and falls back
                  to the house's own, which on Purple Brand printed PURPLE
                  BRAND in letterspaced caps and PURPLE BRAND again in
                  display type directly underneath. The mark has already
                  said it. */}
              {headline && headline.trim().toLowerCase() !== brand.name.trim().toLowerCase() && (
                <h2
                  className={`display max-w-xl leading-tight [text-shadow:0_1px_3px_rgba(0,0,0,0.85)] ${
                    wide ? "mt-1 text-xl sm:mt-2.5 sm:text-3xl" : "mt-2.5 text-2xl sm:text-3xl"
                  }`}
                >
                  {headline}
                </h2>
              )}
              {subhead && (
                <p
                  className={`mt-1.5 max-w-md text-sm leading-relaxed text-white/85 [text-shadow:0_1px_3px_rgba(0,0,0,0.85)] ${
                    wide ? "hidden sm:block" : ""
                  }`}
                >
                  {subhead}
                </p>
              )}
              {/* A rule-underlined link rather than a pill, which is how the
                  lookbook band does it and reads as editorial rather than as
                  a form control. */}
              {shopTo && (
                <a
                  href={shopTo}
                  className={`inline-block border-b border-white pb-1 text-xs font-semibold uppercase tracking-[0.2em] text-white transition-opacity hover:opacity-70 ${
                    wide ? "mt-3 sm:mt-6" : "mt-6"
                  }`}
                >
                  Shop the look
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── and the clothes in it, rising over the photograph ──
          Opaque and above the stage, so scrolling draws it up across the
          picture. The rounded lip and the shadow above it are the whole of
          the signal that there is something underneath; without them the
          panel reads as the next block rather than as a thing moving over
          the last one. */}
      {items.length > 0 && (
        /* The floor is what makes the chapter read as two screens rather
           than one. A sticky picture is only held for as long as its
           section is taller than it, so a shot with two garments in it gave
           a panel about 350px tall and the photograph was released almost
           as soon as it caught — measured at 375x812, where it pinned for
           less than half a screen. At 68svh every chapter is a screen of
           photograph and then a screen of clothes, whether the shot holds
           two pieces or five. */
        <div className="relative z-10 min-h-[68svh] rounded-t-[1.75rem] bg-paper shadow-[0_-16px_44px_-12px_rgba(0,0,0,0.3)]">
          <Reveal className="mx-auto max-w-7xl px-5 pb-14 pt-9 sm:px-8 sm:pt-11">
            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                <h3
                  id={lookId}
                  className="scroll-mt-24 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint"
                >
                  Worn in this picture
                </h3>
                {brand.slug && (
                  <Link
                    href={`/brands/${brand.slug}#products`}
                    className="text-[11px] uppercase tracking-[0.18em] text-ink-faint transition-colors hover:text-ink"
                  >
                    All {brand.name}
                  </Link>
                )}
              </div>
              {/* A grid rather than a rail. The rail hid everything past the
                  third item behind a sideways drag, and a shot can carry
                  five. */}
              <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                {items.map((p) => (
                  <Link key={p.id} href={`/products/${p.id}`} className="group block">
                    <div className="overflow-hidden rounded-md bg-paper-sunken">
                      <ProductImage
                        src={p.image_url}
                        slug={p.slug}
                        alt={p.name}
                        className="aspect-[4/5] w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                      />
                    </div>
                    <p className="mt-2 truncate text-sm text-ink group-hover:underline">
                      {p.name}
                    </p>
                    <p className="text-xs tabular-nums text-ink-faint">{money(p.price)}</p>
                  </Link>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      )}
    </section>
  );
}
