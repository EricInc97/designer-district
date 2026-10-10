"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import ProductImage from "@/components/ProductImage";
import { money } from "@/lib/format";
import type { Brand, BrandMedia, ProductWithBrand } from "@/lib/types";

export type CampaignSlide = {
  media: BrandMedia;
  /** The garments actually in this photograph, in stock and published. */
  items: ProductWithBrand[];
  /** Whether this board's own copy is about the house whose page this is. */
  ownCopy: boolean;
};

/**
 * The house's campaign artwork at the top of its page, one picture at a time.
 *
 * Forty-four of these were made for the hoardings in the 3D street. The brand
 * pages were reading `kind: "hero"` and `kind: "lookbook"` instead, which only
 * one house in fifteen has any of, so fourteen of them opened on a flat colour
 * swatch while their campaign sat unused.
 *
 * Every slide is the house's mark, the campaign line under it, and the
 * garments that are in the picture. A campaign picture whose clothes cannot
 * be reached is a poster, not a shop.
 *
 * On paper rather than on a dark ground. These photographs carry their own
 * colour — sun, travertine, a Miami skyline — and a black surround competes
 * with every one of them; white reads as a gallery wall and lets the picture
 * be the only saturated thing on the page. It also means the marks can be the
 * cut drawn for paper rather than the one drawn for a colourway.
 *
 * The track is the same mechanism as the product gallery: one horizontally
 * scrollable element with scroll snapping, so below lg a swipe is the
 * browser's own gesture — real momentum, real rubber-banding, no touch
 * handlers to get wrong — and from lg up it is overflow-hidden, which stops it
 * being dragged but does not stop `scrollTo` driving it from the arrows.
 *
 * Pictures are contained rather than cropped. These were cut for particular
 * screens: 21:9 for the crown, 2:3 and 9:16 for the towers. Cover-cropping
 * them all into one band would take the head and the shoes off every tall one,
 * which is the entire reason for showing a full-length outfit shot.
 */
export default function BrandCampaignCarousel({
  slides,
  brand,
}: {
  slides: CampaignSlide[];
  brand: Pick<Brand, "name" | "slug" | "logo_url">;
}) {
  const [active, setActive] = useState(0);
  const track = useRef<HTMLUListElement>(null);

  /**
   * Which slide is under the viewport, read back from the scroll position.
   *
   * Read straight out of the event rather than deferred into a
   * requestAnimationFrame, for the reason written up in ProductGallery: the
   * rAF version guards on "a frame is already pending", and a frame is not
   * guaranteed to arrive. A backgrounded tab stops painting, rAF never fires,
   * the guard never clears and the dots are stuck for the rest of the page's
   * life.
   */
  const onScroll = () => {
    const el = track.current;
    if (!el || el.clientWidth === 0) return;
    const i = Math.min(
      Math.max(Math.round(el.scrollLeft / el.clientWidth), 0),
      slides.length - 1,
    );
    setActive((prev) => (prev === i ? prev : i));
  };

  const goTo = (i: number) => {
    const el = track.current;
    const next = Math.min(Math.max(i, 0), slides.length - 1);
    setActive(next);
    if (!el) return;
    // A smooth scroll needs animation frames, so anyone who has asked for
    // less motion gets the jump instead.
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: next * el.clientWidth, behavior: still ? "auto" : "smooth" });
  };

  const many = slides.length > 1;

  return (
    <section
      aria-roledescription="carousel"
      aria-label={`${brand.name} campaign`}
      className="relative w-full border-b border-rule bg-paper"
      onKeyDown={(e) => {
        if (!many) return;
        if (e.key === "ArrowRight") { e.preventDefault(); goTo(active + 1); }
        if (e.key === "ArrowLeft") { e.preventDefault(); goTo(active - 1); }
      }}
    >
      <ul
        ref={track}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] lg:overflow-hidden [&::-webkit-scrollbar]:hidden"
      >
        {slides.map(({ media, items, ownCopy }, i) => (
          <li
            key={media.id}
            className="w-full shrink-0 snap-center"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}`}
            aria-hidden={i !== active}
          >
            {/* Stacked on a phone, side by side from lg.
                Stacking at every width put the whole slide at 844px against
                a 794px viewport, which pushes the dots off the bottom of the
                screen: the one control saying there is more to see is
                invisible exactly while you are looking at what it pages.
                Side by side, a slide is as tall as its taller half rather
                than the sum of both, and a desktop has the width going
                spare.
                Heights in vh so the picture is never taller than the screen
                it is on, and a smaller share of a phone, where everything
                below has to stay reachable without a long scroll past one
                image. */}
            <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 sm:gap-7 sm:px-8 sm:py-8 md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] md:items-center md:gap-10 md:py-9 lg:gap-12 lg:py-10">
              <div className="flex h-[32vh] items-center justify-center sm:h-[38vh] md:h-[46vh] lg:h-[58vh]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={media.image_url}
                  alt={`${brand.name} campaign photograph`}
                  loading={i === 0 ? "eager" : "lazy"}
                  className="max-h-full max-w-full object-contain"
                />
              </div>

              <div>
                {/* The house's mark, then what the campaign says, then what
                    is in it. The mark is decorative here: the page already
                    has a heading naming the brand. */}
                <BrandMark brand={brand} size="sm" decorative className="!text-ink" />

                {/* The headline only travels when it is about this house. A
                    collaboration title names it; the crown advert does not,
                    and "Fifteen districts, one address" over a Purple Brand
                    page is a line about somewhere else. */}
                <h2 className="display mt-4 text-xl leading-tight sm:text-3xl">
                  {(ownCopy && media.headline) || brand.name}
                </h2>
                {ownCopy && media.subhead && (
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-dim">
                    {media.subhead}
                  </p>
                )}

                {items.length > 0 && (
                  <>
                    <h3 className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
                      Featured in this shot
                    </h3>
                    <ul className="mt-4 flex gap-4 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {items.map((p) => (
                        <li key={p.id} className="w-28 shrink-0 sm:w-32">
                          <Link href={`/products/${p.id}`} className="group block">
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
                            <p className="text-xs tabular-nums text-ink-faint">
                              {money(p.price)}
                            </p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Arrows are a desktop affordance: below lg the track is swipeable and
          the dots do the same job without covering the picture. Pinned to the
          middle of the picture area, which is why the offsets track the same
          heights as the slide. */}
      {many && (
        <>
          <button
            type="button"
            onClick={() => goTo(active - 1)}
            disabled={active === 0}
            aria-label="Previous campaign image"
            className="absolute left-4 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-rule-strong bg-paper/85 text-ink backdrop-blur transition-colors hover:bg-ink hover:text-paper disabled:pointer-events-none disabled:opacity-0 md:top-[calc(2.25rem+23vh)] md:grid lg:top-[calc(2.5rem+29vh)]"
          >
            <span aria-hidden>&#8592;</span>
          </button>
          <button
            type="button"
            onClick={() => goTo(active + 1)}
            disabled={active === slides.length - 1}
            aria-label="Next campaign image"
            className="absolute right-4 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-rule-strong bg-paper/85 text-ink backdrop-blur transition-colors hover:bg-ink hover:text-paper disabled:pointer-events-none disabled:opacity-0 md:top-[calc(2.25rem+23vh)] md:grid lg:top-[calc(2.5rem+29vh)]"
          >
            <span aria-hidden>&#8594;</span>
          </button>

          {/* Wraps: eleven dots do not fit across a 375px phone in one line. */}
          <div className="flex flex-wrap items-center justify-center gap-1 px-5 pb-6 sm:gap-2">
            {slides.map((s, i) => (
              <button
                key={s.media.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Campaign image ${i + 1} of ${slides.length}`}
                aria-current={i === active}
                className="grid h-6 w-6 place-items-center"
              >
                <span
                  className={`block rounded-full transition-all duration-300 ${
                    i === active ? "h-2 w-5 bg-ink" : "h-2 w-2 bg-rule-strong"
                  }`}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
