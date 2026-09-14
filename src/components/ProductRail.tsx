"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * A horizontally scrolling row of products.
 *
 * Touch gets the native swipe and nothing else: a phone already knows how to
 * do this, and overlaying arrows on a small screen costs two cards' worth of
 * width to duplicate a gesture people have. Arrows appear only where there is
 * a pointer, and only when the row actually overflows.
 *
 * The scroller is focusable with a label, so it is reachable and scrollable
 * from the keyboard rather than being a mouse-only region.
 */
export default function ProductRail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // A pixel of slack: sub-pixel layout means scrollLeft rarely lands exactly
    // on the end, and an arrow that never disables looks broken.
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Two frames, not one. Deferring at all keeps the state write out of the
    // effect body, which is the cascading-render pattern the lint rule catches;
    // deferring twice guarantees it lands after a paint, and a single frame was
    // still racing layout, measuring content and container equal and leaving an
    // overflowing row looking like it had nothing to scroll.
    let inner = 0;
    const raf = requestAnimationFrame(() => {
      inner = requestAnimationFrame(measure);
    });
    // And once more after layout has definitely settled. Two frames still lost
    // the race in practice: something measured content and container equal and
    // the row came up looking unscrollable with both arrows dead. measure()
    // only reads live DOM, so an extra late call is free and idempotent, and
    // it is the difference between the arrows being right on arrival and only
    // appearing once someone scrolls.
    const settled = setTimeout(measure, 250);
    const observer = new ResizeObserver(measure);

    // Watching the scroller alone is not enough. Its width is set by the page
    // and never changes, so the only callback was the one at observe time,
    // which fired before the cards had laid out: content and container
    // measured equal, the row looked unscrollable and the arrows never
    // appeared. Watching a card as well gives a callback once layout settles.
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(inner);
      clearTimeout(settled);
      observer.disconnect();
    };
  }, [measure]);

  const page = (direction: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    // Just under a full width, so the card at the edge stays in view and the
    // eye keeps its place.
    el.scrollBy({
      left: direction * el.clientWidth * 0.85,
      behavior: "smooth",
    });
  };

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={measure}
        tabIndex={0}
        role="region"
        aria-label={`${label}, scrollable`}
        /* The cards are direct children on purpose: their widths are
           percentages, and a wrapping flex track would size itself to its
           content, leaving those percentages to resolve against the wrong
           box.

           scroll-pl has to match px. Mandatory snapping aligns a card to the
           snapport, and without scroll-padding the snapport is the padding
           box, so the row settled at scrollLeft 32 instead of 0 and the left
           arrow was live from the start with nothing to go back to. */
        className="scroll-thin -mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-pl-5 scroll-smooth px-5 pb-2 sm:-mx-8 sm:scroll-pl-8 sm:px-8"
      >
        {children}
      </div>

      {/* Always rendered, never gated on the measurement. A row with nothing to
          scroll sits at both ends at once, and the disabled styling already
          takes the buttons out; that way a late measurement costs nothing
          rather than losing the arrows entirely. */}
      <button
        type="button"
        onClick={() => page(-1)}
        disabled={atStart}
        aria-label={`Scroll ${label} left`}
        className="absolute -left-4 top-[38%] hidden h-10 w-10 place-items-center rounded-full border border-rule-strong bg-paper text-ink shadow-lg transition-opacity hover:bg-paper-raised disabled:pointer-events-none disabled:opacity-0 lg:grid"
      >
        <ChevronLeft size={18} aria-hidden />
      </button>

      <button
        type="button"
        onClick={() => page(1)}
        disabled={atEnd}
        aria-label={`Scroll ${label} right`}
        className="absolute -right-4 top-[38%] hidden h-10 w-10 place-items-center rounded-full border border-rule-strong bg-paper text-ink shadow-lg transition-opacity hover:bg-paper-raised disabled:pointer-events-none disabled:opacity-0 lg:grid"
      >
        <ChevronRight size={18} aria-hidden />
      </button>
    </div>
  );
}
