"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

/** How long a slide holds before the next one comes up. */
const DWELL_MS = 6000;

/**
 * The house's campaign artwork at the top of its page, one picture at a time.
 *
 * Forty-four of these were made for the hoardings in the 3D street. The brand
 * pages were reading `kind: "hero"` and `kind: "lookbook"` instead, which only
 * one house in fifteen has any of, so fourteen of them opened on a flat colour
 * swatch while their campaign sat unused.
 *
 * The picture is the slide. The caption sits on it — mark, line, and the way
 * to shop it — and the garments in the shot sit underneath, because a campaign
 * picture whose clothes cannot be reached is a poster, not a shop.
 *
 * Two things the layout has to get right at once.
 *
 * Every slide must be the same height or the page jumps as the track moves,
 * and these were cut for different screens: 21:9 for the crown, 2:3 and 9:16
 * for the towers. So the picture sits in a fixed-height band and is contained
 * in it, never cropped — cover-cropping a full-length outfit shot into a wide
 * band takes off the head and the shoes, which is the entire reason for
 * showing one.
 *
 * But a caption pinned to a contained picture has to sit on the picture, not
 * on the empty band beside it. Hence the inline-flex wrapper: it shrink-wraps
 * to the rendered image, so the scrim and the words land on the photograph at
 * every aspect, with no letterboxed dead space under them.
 */
/**
 * What the caption says, given that the mark above it already says the
 * house.
 *
 * Three of the boards are headlined with nothing but the brand name, which
 * is exactly what the mark is. On Casablanca, which has no logo file, the
 * mark falls back to the wordmark — so the overlay read CASABLANCA, then
 * Casablanca, then the line that actually said something. The same word
 * twice and the real copy demoted below both.
 *
 * So when the headline only repeats the mark, the subheading is promoted to
 * be the headline: the mark names the house, the line says what the picture
 * is. Fixed here rather than by rewriting three rows, because the next
 * board headlined with a house name would bring it straight back.
 */
function line(
  media: BrandMedia,
  ownCopy: boolean,
  brand: Pick<Brand, "name" | "description">,
) {
  const head = (ownCopy && media.headline) || brand.name;
  const sub = (ownCopy && media.subhead) || brand.description || null;
  const echoesMark = head.trim().toLowerCase() === brand.name.trim().toLowerCase();
  return echoesMark && sub ? { head: sub, sub: null } : { head, sub };
}

export default function BrandCampaignCarousel({
  slides,
  brand,
}: {
  slides: CampaignSlide[];
  brand: Pick<Brand, "name" | "slug" | "logo_url" | "description">;
}) {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const track = useRef<HTMLUListElement>(null);
  const many = slides.length > 1;

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

  const goTo = useCallback(
    (i: number) => {
      const el = track.current;
      const next = Math.min(Math.max(i, 0), slides.length - 1);
      setActive(next);
      if (!el) return;
      // A smooth scroll needs animation frames, so anyone who has asked for
      // less motion gets the jump instead.
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollTo({ left: next * el.clientWidth, behavior: still ? "auto" : "smooth" });
    },
    [slides.length],
  );

  /** A deliberate move: go there, and stop advancing on our own. */
  const takeOver = (i: number) => {
    setPlaying(false);
    goTo(i);
  };

  /*
   * Advancing on its own.
   *
   * Four things switch it off, and all four earn their place.
   *
   * `prefers-reduced-motion` is the one that is not negotiable: content that
   * moves by itself is exactly what that setting is for.
   *
   * A pointer over it or keyboard focus inside it means somebody is reading,
   * or on their way to clicking something. A carousel that moves out from
   * under a cursor heading for a product is its most irritating failure.
   *
   * A hidden tab, because timers keep running in one and the thing would
   * otherwise be found several slides along having apparently never moved.
   *
   * And any use of the arrows or dots stops it for good: once somebody is
   * steering, taking the wheel back is wrong.
   *
   * The pause control is not decoration. Anything that moves on its own for
   * more than five seconds needs a visible way to stop it, and a carousel
   * with no stop button is the usual way that is failed.
   */
  useEffect(() => {
    if (!many || !playing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = () =>
      setActive((i) => {
        const next = i + 1 >= slides.length ? 0 : i + 1;
        const el = track.current;
        if (el) el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
        return next;
      });
    const start = () => {
      if (timer === null) timer = setInterval(tick, DWELL_MS);
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [many, playing, slides.length]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label={`${brand.name} campaign`}
      className="relative w-full border-b border-rule bg-paper"
      onMouseEnter={() => setPlaying(false)}
      onFocusCapture={() => setPlaying(false)}
      onKeyDown={(e) => {
        if (!many) return;
        if (e.key === "ArrowRight") { e.preventDefault(); takeOver(active + 1); }
        if (e.key === "ArrowLeft") { e.preventDefault(); takeOver(active - 1); }
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
            {/* Fixed band so every slide is the same height whatever shape the
                artwork was cut to. Heights in vh so the picture is never
                taller than the screen it is on, and a smaller share of a
                phone, where what is below has to stay reachable. */}
            <div className="flex h-[40vh] items-center justify-center sm:h-[48vh] lg:h-[56vh]">
              {/* inline-BLOCK, and the cap in vh on the image rather than
                  `max-h-full` on either.
                  Both details are load-bearing. As an inline-flex the image
                  became a flex item and got stretched on the cross axis, so a
                  2:3 board reported a 375x374 box inside a 375x373 band and
                  the caption spread across the letterbox instead of sitting
                  on the photograph. And `max-h-full` resolves against a
                  shrink-to-fit parent, which has no definite height, so it
                  resolves to nothing. A viewport cap is definite, and an
                  image with only max-width and max-height set keeps its
                  aspect, so the wrapper shrink-wraps the picture exactly. */}
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={media.image_url}
                  alt={`${brand.name} campaign photograph`}
                  loading={i === 0 ? "eager" : "lazy"}
                  className="block max-h-[40vh] w-auto max-w-full sm:max-h-[48vh] lg:max-h-[56vh]"
                />

                {/* The scrim belongs to the caption, not to the picture: it
                    covers only the band the words sit in, so the garment
                    above it stays as photographed. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/55 to-transparent"
                />

                <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7">
                  <BrandMark
                    brand={brand}
                    size="sm"
                    decorative
                    hovered
                    className="!text-white [filter:drop-shadow(0_1px_3px_rgba(0,0,0,0.85))]"
                  />
                  {/* The headline only travels when it is about this house. A
                      collaboration title names it; the crown advert does not,
                      and "Fifteen districts, one address" over a Purple Brand
                      page is a line about somewhere else. */}
                  <h2 className="display mt-2.5 text-xl leading-tight [text-shadow:0_1px_3px_rgba(0,0,0,0.85)] sm:text-3xl">
                    {line(media, ownCopy, brand).head}
                  </h2>
                  {/* A subheading on every slide, not only the ones whose
                      board happens to carry copy. Most of these were written
                      as signage for one hoarding and plenty have no second
                      line at all, which left a mark, a headline and a button
                      floating with nothing between them. The house's own
                      description is the fallback, and it is the right one —
                      it is the sentence the house is already described by
                      everywhere else on the site. */}
                  {line(media, ownCopy, brand).sub ? (
                    <p className="mt-1.5 max-w-md text-xs leading-relaxed text-white/85 [text-shadow:0_1px_3px_rgba(0,0,0,0.85)] sm:text-sm">
                      {line(media, ownCopy, brand).sub}
                    </p>
                  ) : null}
                  {/* Straight to the garments in this picture, which are the
                      next thing down the page. A plain anchor rather than a
                      link to the first item: "shop the look" means the look,
                      and picking one of six to stand for it is a guess. */}
                  {items.length > 0 && (
                    <a
                      href={`#look-${media.id}`}
                      className="mt-4 inline-block rounded-full bg-white px-6 py-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink transition-opacity hover:opacity-85 sm:text-[11px]"
                    >
                      Shop the look
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="mx-auto max-w-7xl px-5 pb-8 pt-7 sm:px-8">
              {items.length > 0 && (
                <>
                  <h3
                    id={`look-${media.id}`}
                    className="scroll-mt-24 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint"
                  >
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
          </li>
        ))}
      </ul>

      {many && (
        <>
          {/* Arrows are a desktop affordance: below lg the track is swipeable
              and the dots do the same job without covering the picture. The
              offsets track the middle of the band above. */}
          <button
            type="button"
            onClick={() => takeOver(active - 1)}
            disabled={active === 0}
            aria-label="Previous campaign image"
            className="absolute left-4 top-[20vh] hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-rule-strong bg-paper/85 text-ink backdrop-blur transition-colors hover:bg-ink hover:text-paper disabled:pointer-events-none disabled:opacity-0 sm:top-[24vh] lg:top-[28vh] lg:grid"
          >
            <span aria-hidden>&#8592;</span>
          </button>
          <button
            type="button"
            onClick={() => takeOver(active + 1)}
            disabled={active === slides.length - 1}
            aria-label="Next campaign image"
            className="absolute right-4 top-[20vh] hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-rule-strong bg-paper/85 text-ink backdrop-blur transition-colors hover:bg-ink hover:text-paper disabled:pointer-events-none disabled:opacity-0 sm:top-[24vh] lg:top-[28vh] lg:grid"
          >
            <span aria-hidden>&#8594;</span>
          </button>

          <div className="flex flex-wrap items-center justify-center gap-1 px-5 pb-6 sm:gap-2">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={
                playing ? "Pause the campaign slideshow" : "Play the campaign slideshow"
              }
              className="mr-1 grid h-6 w-6 place-items-center text-ink-faint transition-colors hover:text-ink"
            >
              <span aria-hidden className="text-[11px] leading-none">
                {playing ? "⏸" : "▶"}
              </span>
            </button>
            {slides.map((s, i) => (
              <button
                key={s.media.id}
                type="button"
                onClick={() => takeOver(i)}
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
