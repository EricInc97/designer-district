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
 * Three boards are headlined with nothing but the brand name, which is
 * exactly what the mark is. On Casablanca, which has no logo file, the mark
 * falls back to the wordmark — so the overlay read CASABLANCA, then
 * Casablanca, then the line that actually said something.
 *
 * So when the headline only repeats the mark, the subheading is promoted to
 * be the headline. Fixed here rather than by rewriting three rows, because
 * the next board headlined with a house name would bring it straight back.
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

/**
 * The house's campaign artwork at the top of its page, one picture at a time.
 *
 * Full bleed, and the height comes from the picture rather than the other way
 * round.
 *
 * It used to be the other way round: every slide sat in one fixed band and was
 * contained inside it, so that all slides were the same height and nothing
 * was ever cropped. That produced exactly what a phone should not show. A
 * 2:3 board became a narrow column with white down both sides, and a 21:9
 * board became a 161px strip inside a 325px band — more white than
 * photograph. Worse, the caption is about 169px tall, so on that strip it
 * was taller than the image it was supposedly laid over and spilled off the
 * top, putting the mark on the white above the picture and across the
 * headline.
 *
 * Now each picture runs edge to edge at its own aspect, and the track takes
 * its height from whichever slide is showing. Nothing is cropped, there are
 * no gutters, and an upright board fills a phone the way a campaign should.
 *
 * Where the caption goes follows from that, and has to: a caption cannot be
 * laid over a picture shorter than itself. Upright boards carry it on the
 * photograph at every size. Landscape boards carry it underneath on a phone
 * and on the photograph from `lg`, where the same board is 400px tall or
 * more and there is room. It is one element either way, repositioned — not
 * two copies, which would put the words in the document twice.
 */
export default function BrandCampaignCarousel({
  slides,
  brand,
}: {
  slides: CampaignSlide[];
  brand: Pick<Brand, "name" | "slug" | "logo_url" | "description">;
}) {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [trackH, setTrackH] = useState<number | undefined>(undefined);
  const track = useRef<HTMLUListElement>(null);
  const cells = useRef<(HTMLLIElement | null)[]>([]);
  const many = slides.length > 1;

  /*
   * The track is as tall as the slide being shown.
   *
   * Slides are no longer a uniform height — that was the whole point — so
   * something has to hold the box, or the track grows to the tallest and the
   * short ones get the white space back underneath instead of around.
   *
   * Measured rather than calculated from the aspect, because a slide is the
   * picture plus whatever caption sits under it, and on a phone that varies
   * with how far the headline wraps. The observer catches the wrap changing
   * on rotate or resize.
   */
  useEffect(() => {
    const cell = cells.current[active];
    if (!cell) return;
    const measure = () => setTrackH(cell.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(cell);
    return () => ro.disconnect();
  }, [active, slides.length]);

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
   * Advancing on its own. Four things switch it off, and all four earn it.
   *
   * `prefers-reduced-motion`, because content that moves by itself is exactly
   * what that setting is for. A pointer over it or focus inside it, because a
   * carousel that slides out from under a cursor on its way to a product is
   * its most irritating failure. A hidden tab, because the timer keeps
   * running in one. And any use of the arrows or dots, for good: once
   * somebody is steering, taking the wheel back is wrong.
   *
   * The pause button is not decoration either — anything that moves on its
   * own for more than five seconds needs a visible way to stop it.
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
        style={trackH ? { height: trackH } : undefined}
        className="flex snap-x snap-mandatory items-start overflow-x-auto overflow-y-hidden transition-[height] duration-500 ease-out [-ms-overflow-style:none] [scrollbar-width:none] motion-reduce:transition-none lg:overflow-hidden [&::-webkit-scrollbar]:hidden"
      >
        {slides.map(({ media, items, ownCopy }, i) => {
          const shape = shapeOf(media.aspect);
          const copy = line(media, ownCopy, brand);
          // Upright pictures are always tall enough to carry the words. Wide
          // ones only are once there is some width to work with.
          const over = shape.upright ? "over" : "under";
          return (
            <li
              key={media.id}
              ref={(el) => { cells.current[i] = el; }}
              className="w-full shrink-0 snap-center"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${slides.length}`}
              aria-hidden={i !== active}
            >
              {/* Edge to edge, height from the picture's own aspect, so the
                  box is the picture and object-cover never actually crops.
                  
                  Upright boards get a ceiling from sm up, and they need one:
                  full bleed is right on a phone, where a 2:3 board is 375 by
                  563 and fills the screen, but the same rule on a 1280
                  desktop makes it 1265 by 1897 — a picture nearly two
                  thousand pixels tall that the carousel then has to be as
                  tall as. Above a phone it is capped by height and centred
                  instead, and the wrapper shrink-wraps it so the caption
                  still lands on the photograph rather than on the paper
                  beside it.
                  
                  Landscape boards stay full bleed at every width, because
                  capping them by height would pull them in from the edges
                  for no reason: at 1280 a 21:9 board is 1265 by 542, which
                  is already a hero. */}
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
                  loading={i === 0 ? "eager" : "lazy"}
                  style={{ aspectRatio: shape.css }}
                  className={
                    shape.upright
                      ? "block w-full object-cover sm:h-full sm:w-auto"
                      : "block w-full object-cover"
                  }
                />

                {/* The scrim belongs to the caption and only appears where the
                    caption does, so a picture with the words underneath is
                    not darkened for nothing. */}
                <div
                  aria-hidden
                  className={`pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/55 to-transparent ${
                    over === "over" ? "" : "hidden lg:block"
                  }`}
                />

                <div
                  className={
                    over === "over"
                      ? "absolute inset-x-0 bottom-0 p-5 text-white sm:p-7"
                      : "px-5 pb-2 pt-6 text-ink sm:px-8 lg:absolute lg:inset-x-0 lg:bottom-0 lg:p-7 lg:text-white"
                  }
                >
                  <div className="mx-auto max-w-7xl">
                    <BrandMark
                      brand={brand}
                      size="sm"
                      decorative
                      hovered={over === "over"}
                      className={
                        over === "over"
                          ? "!text-white [filter:drop-shadow(0_1px_3px_rgba(0,0,0,0.85))]"
                          : "!text-ink lg:!text-white lg:[filter:drop-shadow(0_1px_3px_rgba(0,0,0,0.85))]"
                      }
                    />
                    <h2
                      className={`display mt-2.5 max-w-xl text-2xl leading-tight sm:text-3xl ${
                        over === "over"
                          ? "[text-shadow:0_1px_3px_rgba(0,0,0,0.85)]"
                          : "lg:[text-shadow:0_1px_3px_rgba(0,0,0,0.85)]"
                      }`}
                    >
                      {copy.head}
                    </h2>
                    {copy.sub && (
                      <p
                        className={`mt-1.5 max-w-md text-sm leading-relaxed ${
                          over === "over"
                            ? "text-white/85 [text-shadow:0_1px_3px_rgba(0,0,0,0.85)]"
                            : "text-ink-dim lg:text-white/85 lg:[text-shadow:0_1px_3px_rgba(0,0,0,0.85)]"
                        }`}
                      >
                        {copy.sub}
                      </p>
                    )}
                    {items.length > 0 && (
                      <a
                        href={`#look-${media.id}`}
                        className={`mt-5 inline-block rounded-full px-7 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] transition-opacity hover:opacity-85 ${
                          over === "over"
                            ? "bg-white text-ink"
                            : "bg-ink text-paper lg:bg-white lg:text-ink"
                        }`}
                      >
                        Shop the look
                      </a>
                    )}
                  </div>
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
                        <li key={p.id} className="w-32 shrink-0 sm:w-36">
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
          );
        })}
      </ul>

      {many && (
        <>
          {/* Arrows are a desktop affordance: below lg the track is swipeable
              and the dots do the same job without covering the picture. */}
          <button
            type="button"
            onClick={() => takeOver(active - 1)}
            disabled={active === 0}
            aria-label="Previous campaign image"
            className="absolute left-4 top-[22vh] hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-rule-strong bg-paper/85 text-ink backdrop-blur transition-colors hover:bg-ink hover:text-paper disabled:pointer-events-none disabled:opacity-0 lg:grid"
          >
            <span aria-hidden>&#8592;</span>
          </button>
          <button
            type="button"
            onClick={() => takeOver(active + 1)}
            disabled={active === slides.length - 1}
            aria-label="Next campaign image"
            className="absolute right-4 top-[22vh] hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-rule-strong bg-paper/85 text-ink backdrop-blur transition-colors hover:bg-ink hover:text-paper disabled:pointer-events-none disabled:opacity-0 lg:grid"
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
