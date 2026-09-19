"use client";

import { useRef, useState } from "react";
import ProductImage from "@/components/ProductImage";

/**
 * The product's photographs: a thumbnail rail beside one large shot on a
 * desktop, a swipeable track on a phone.
 *
 * Both are the same track. The shots are always laid out side by side in one
 * horizontally scrollable element; what changes is who drives it. Below lg the
 * element scrolls, with scroll snapping, so a swipe is the browser's own
 * gesture: real momentum, real rubber-banding at the ends, and no touch
 * handlers to get wrong. From lg up the element is overflow-hidden, which
 * stops it being dragged but does NOT stop it being scrolled from script, so
 * clicking a thumbnail still slides it across.
 *
 * Doing it this way rather than as two separate layouts keeps one copy of each
 * <img> in the document. A `hidden` duplicate still loads its images, and
 * these are the largest ones on the page.
 */
export default function ProductGallery({
  images,
  alt,
  slug,
}: {
  images: string[];
  alt: string;
  slug?: string | null;
}) {
  const [active, setActive] = useState(0);
  const track = useRef<HTMLUListElement>(null);
  const shots = images.length > 0 ? images : ["/ph/product"];

  /**
   * Which slide is under the viewport, read back from the scroll position.
   *
   * Read straight out of the event rather than deferred into a
   * requestAnimationFrame. The rAF version coalesced nicely but latched: it
   * guarded on "a frame is already pending", and a frame is not guaranteed to
   * arrive — a backgrounded or occluded tab stops painting, rAF never fires,
   * the guard never clears and the dots freeze for the rest of the page's
   * life. Caught it doing exactly that. The browser already caps scroll events
   * at one per frame, and this reads two properties off an element whose
   * layout is current, so there was little to win and a stuck carousel to
   * lose.
   */
  const onScroll = () => {
    const el = track.current;
    if (!el || el.clientWidth === 0) return;
    const i = Math.min(
      Math.max(Math.round(el.scrollLeft / el.clientWidth), 0),
      shots.length - 1,
    );
    setActive((prev) => (prev === i ? prev : i));
  };

  const goTo = (i: number) => {
    const el = track.current;
    setActive(i);
    if (!el) return;
    // scrollTo works under overflow-hidden too, which is what the desktop
    // layout uses; a smooth scroll needs animation frames, so anyone who has
    // asked for less motion gets the jump instead.
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({
      left: i * el.clientWidth,
      behavior: still ? "auto" : "smooth",
    });
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row-reverse lg:items-start">
      <div className="min-w-0 flex-1">
        <ul
          ref={track}
          onScroll={onScroll}
          className="flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden rounded-xl bg-paper-sunken [-ms-overflow-style:none] [scrollbar-width:none] lg:overflow-hidden [&::-webkit-scrollbar]:hidden"
        >
          {shots.map((src, i) => (
            <li key={src + i} className="w-full shrink-0 snap-center">
              <ProductImage
                src={src}
                slug={slug}
                alt={i === 0 ? alt : ""}
                className="aspect-[4/5] w-full object-cover"
              />
            </li>
          ))}
        </ul>

        {/* Dots stand in for the thumbnail rail on a phone, where the rail is
            hidden. They are real buttons, so the slide can be reached by tap
            and by keyboard, not only by swiping. */}
        {shots.length > 1 && (
          <div className="mt-3 flex items-center justify-center gap-2 lg:hidden">
            {shots.map((src, i) => (
              <button
                key={src + i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`View image ${i + 1} of ${shots.length}`}
                aria-current={i === active}
                className="grid h-6 w-6 place-items-center"
              >
                <span
                  className={`block rounded-full transition-all duration-300 ${
                    i === active
                      ? "h-2 w-5 bg-ink"
                      : "h-2 w-2 bg-rule-strong"
                  }`}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {shots.length > 1 && (
        <ul className="hidden gap-3 lg:flex lg:flex-col">
          {shots.map((src, i) => (
            <li key={src + i}>
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-label={`View image ${i + 1} of ${shots.length}`}
                aria-current={i === active}
                className={`block h-20 w-16 shrink-0 overflow-hidden rounded-md border transition-colors ${
                  i === active
                    ? "border-ink"
                    : "border-rule hover:border-rule-strong"
                }`}
              >
                <ProductImage
                  src={src}
                  slug={slug}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
