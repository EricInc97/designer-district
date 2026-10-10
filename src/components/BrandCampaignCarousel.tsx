"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import ProductImage from "@/components/ProductImage";
import { money } from "@/lib/format";
import type { BrandMedia, ProductWithBrand } from "@/lib/types";

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
 * Every slide carries the garments that are in it, because a campaign picture
 * whose clothes cannot be reached is a poster, not a shop.
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
 * which is the entire reason for showing a full-length outfit shot. Letterboxed
 * on the house's own dark ground, every slide is the same height and nothing
 * is cut.
 */
export default function BrandCampaignCarousel({
  slides,
  brandName,
}: {
  slides: CampaignSlide[];
  brandName: string;
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
      aria-label={`${brandName} campaign`}
      className="relative w-full bg-ink text-white"
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
            <div className="flex h-[40vh] items-center justify-center sm:h-[52vh]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={media.image_url}
                alt={`${brandName} campaign photograph`}
                loading={i === 0 ? "eager" : "lazy"}
                className="max-h-full max-w-full object-contain"
              />
            </div>

            <div className="mx-auto max-w-7xl px-5 pb-10 pt-6 sm:px-8 sm:pb-12">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">
                {/* The headline only travels when it is about this house. A
                    collaboration title names it; the district's own crown
                    advert does not, and "Fifteen districts, one address" over
                    a Purple Brand page is a line about somewhere else. */}
                {ownCopy && media.subhead ? media.subhead : "The campaign"}
              </p>
              <h2 className="display mt-2 text-2xl leading-tight sm:text-4xl">
                {(ownCopy && media.headline) || brandName}
              </h2>

              {items.length > 0 && (
                <>
                  <h3 className="mt-7 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
                    Featured in this shot
                  </h3>
                  <ul className="mt-4 flex gap-4 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {items.map((p) => (
                      <li key={p.id} className="w-36 shrink-0 sm:w-40">
                        <Link href={`/products/${p.id}`} className="group block">
                          <div className="overflow-hidden rounded-md bg-white/10">
                            <ProductImage
                              src={p.image_url}
                              slug={p.slug}
                              alt={p.name}
                              className="aspect-[4/5] w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                            />
                          </div>
                          <p className="mt-2 truncate text-xs text-white/85 group-hover:text-white">
                            {p.name}
                          </p>
                          <p className="text-xs tabular-nums text-white/60">
                            {money(p.price)}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Arrows are a desktop affordance: below lg the track is swipeable and
          the dots do the same job without covering the picture. */}
      {many && (
        <>
          <button
            type="button"
            onClick={() => goTo(active - 1)}
            disabled={active === 0}
            aria-label="Previous campaign image"
            className="absolute left-4 top-[20vh] hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition-opacity hover:bg-black/70 disabled:pointer-events-none disabled:opacity-0 sm:top-[26vh] lg:grid"
          >
            <span aria-hidden>&#8592;</span>
          </button>
          <button
            type="button"
            onClick={() => goTo(active + 1)}
            disabled={active === slides.length - 1}
            aria-label="Next campaign image"
            className="absolute right-4 top-[20vh] hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition-opacity hover:bg-black/70 disabled:pointer-events-none disabled:opacity-0 sm:top-[26vh] lg:grid"
          >
            <span aria-hidden>&#8594;</span>
          </button>

          <div className="flex items-center justify-center gap-2 pb-7">
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
                    i === active ? "h-2 w-5 bg-white" : "h-2 w-2 bg-white/35"
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
