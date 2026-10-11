import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import ProductImage from "@/components/ProductImage";
import { money } from "@/lib/format";
import type { Brand, BrandMedia, ProductWithBrand } from "@/lib/types";

export type CampaignBand = {
  media: BrandMedia;
  /** The garments actually in this photograph, in stock and published. */
  items: ProductWithBrand[];
  /** Whether this board's own copy is about the house whose page this is. */
  ownCopy: boolean;
};

/** The shape it was generated at, as a CSS ratio, and whether it is upright. */
function shapeOf(aspect: string | null) {
  const [w, h] = (aspect ?? "").split(":").map(Number);
  const ok = Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0;
  const ratio = ok ? w / h : 2 / 3;
  return { css: ok ? `${w} / ${h}` : "2 / 3", upright: ratio < 1 };
}

/**
 * What the caption says, given that the mark above it already says the house.
 *
 * Several boards are headlined with nothing but the brand name, which is
 * exactly what the mark is. On a house with no logo file the mark falls back
 * to the wordmark, so the caption read CASABLANCA, then Casablanca, then the
 * line that actually said something. When the headline only repeats the mark
 * the subheading is promoted to carry it.
 */
function line(media: BrandMedia, ownCopy: boolean, brand: Pick<Brand, "name">) {
  const head = (ownCopy && media.headline) || brand.name;
  // The board's own line and nothing else. It used to fall back to the
  // house description, which is a paragraph of prose — "Hollywood-born
  // sterling silver, leather and gothic cross motifs" — where every board
  // already carries something short enough to read at a glance: "Flame and
  // star.", "Paris, exaggerated." Better one short line or none than a
  // sentence nobody finishes.
  const sub = (ownCopy && media.subhead) || null;
  const echoesMark = head.trim().toLowerCase() === brand.name.trim().toLowerCase();
  return echoesMark && sub ? { head: sub, sub: null } : { head, sub };
}

/**
 * One campaign picture and the garments in it, as a band in the page.
 *
 * This replaced a carousel, and losing the carousel is the point rather than
 * a side effect. A slideshow shows one picture and hides the rest behind a
 * gesture nobody makes: a house with eleven boards was really a house with
 * one board and ten that almost nobody would ever see. Stacked down the page
 * they are all simply there, found by scrolling, which is the one interaction
 * everybody already performs. It also drops the autoplay timer, the scroll
 * tracking, the resize observer and the client bundle entirely — this renders
 * on the server now.
 *
 * Two layout rules carried over, both of them learned the hard way.
 *
 * The picture runs edge to edge and takes its height from its own aspect, so
 * nothing is cropped and there are no gutters. Upright boards are bounded by
 * height above phone size, because full bleed at 1280 would make a 2:3 board
 * 1897px tall; landscape boards stay full bleed everywhere, because capping
 * them would pull them off the edges for nothing.
 *
 * And the caption sits on the photograph only where the photograph is taller
 * than the caption. At 375 across a 21:9 board is 161px tall and the caption
 * is about 169, so laid over it the words spilled off the top and the mark
 * landed on the white above the picture. Landscape boards therefore carry the
 * caption underneath on a phone and over the picture from `lg`, where the
 * same board is 542px tall. One element, repositioned.
 */
export default function BrandCampaignBand({
  band: { media, items, ownCopy },
  brand,
  priority = false,
}: {
  band: CampaignBand;
  brand: Pick<Brand, "name" | "slug" | "logo_url" | "description">;
  /** The first band on the page is the hero, so it loads eagerly. */
  priority?: boolean;
}) {
  const shape = shapeOf(media.aspect);
  const copy = line(media, ownCopy, brand);
  const over = shape.upright;
  const lookId = `look-${media.id}`;

  return (
    <section className="w-full bg-paper" aria-label={`${brand.name} campaign`}>
      <div
        className={
          shape.upright
            ? "w-full sm:flex sm:h-[62vh] sm:items-center sm:justify-center"
            : "w-full"
        }
      >
        <div className={shape.upright ? "relative w-full sm:h-full sm:w-fit" : "relative w-full"}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={media.image_url}
            alt={`${brand.name} campaign photograph`}
            loading={priority ? "eager" : "lazy"}
            style={{ aspectRatio: shape.css }}
            className={
              shape.upright
                ? "block w-full object-cover sm:h-full sm:w-auto"
                : "block w-full object-cover"
            }
          />

{/* Drawn in from the left, matching the lookbook band this page
              already uses, rather than up from the bottom. A second, gentler
              wash up from the floor as well: the left gradient alone leaves
              the lower-right of a wide picture bright, and the words sit
              across it.

              Only where the caption actually is, so a picture captioned
              underneath is not darkened for nothing. */}
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-0 bg-gradient-to-r from-black/80 via-black/35 to-transparent ${
              over ? "" : "hidden lg:block"
            }`}
          />
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent ${
              over ? "" : "hidden lg:block"
            }`}
          />

          <div
            className={
              over
                ? "absolute inset-x-0 bottom-0 p-5 text-white sm:p-7"
                : "px-5 pb-2 pt-6 text-ink sm:px-8 lg:absolute lg:inset-x-0 lg:bottom-0 lg:p-7 lg:text-white"
            }
          >
            <div className="mx-auto max-w-7xl">
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
              <h2
                className={`display mt-2.5 max-w-xl text-2xl leading-tight sm:text-3xl ${
                  over
                    ? "[text-shadow:0_1px_3px_rgba(0,0,0,0.85)]"
                    : "lg:[text-shadow:0_1px_3px_rgba(0,0,0,0.85)]"
                }`}
              >
                {copy.head}
              </h2>
              {copy.sub && (
                <p
                  className={`mt-1.5 max-w-md text-sm leading-relaxed ${
                    over
                      ? "text-white/85 [text-shadow:0_1px_3px_rgba(0,0,0,0.85)]"
                      : "text-ink-dim lg:text-white/85 lg:[text-shadow:0_1px_3px_rgba(0,0,0,0.85)]"
                  }`}
                >
                  {copy.sub}
                </p>
              )}
{/* A rule-underlined link rather than a pill, which is how the
                  lookbook band does it and reads as editorial rather than as
                  a form control. */}
              {items.length > 0 && (
                <a
                  href={`#${lookId}`}
                  className={`mt-6 inline-block border-b pb-1 text-xs font-semibold uppercase tracking-[0.2em] transition-opacity hover:opacity-70 ${
                    over
                      ? "border-white text-white"
                      : "border-ink text-ink lg:border-white lg:text-white"
                  }`}
                >
                  Shop the look
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {items.length > 0 && (
        <div className="mx-auto max-w-7xl px-5 pb-10 pt-7 sm:px-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <h3
              id={lookId}
              className="scroll-mt-24 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint"
            >
              Featured in this shot
            </h3>
            {brand.slug && (
              <Link
                href={`/brands/${brand.slug}`}
                className="text-[11px] uppercase tracking-[0.18em] text-ink-faint transition-colors hover:text-ink"
              >
                View all
              </Link>
            )}
          </div>
          {/* A grid rather than a rail. The rail hid everything past the
              third item behind a sideways drag, and a shot can carry five. */}
          <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
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
                <p className="mt-2 truncate text-xs text-ink group-hover:underline">
                  {p.name}
                </p>
                <p className="text-xs tabular-nums text-ink-faint">{money(p.price)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
