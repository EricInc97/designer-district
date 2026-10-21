"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Lifts a block into place as you scroll to it.
 *
 * Deliberately not a parallax. A parallax moves the picture at a different
 * rate from the page, which means the picture has to be bigger than its
 * frame, which means cropping it — and every campaign photograph here is a
 * person head to shoes, where the crop costs the head and the shoes. The
 * whole layout is built around not doing that. A fade and a short rise reads
 * as movement, works at 9:16 and at 21:9 without a single number changing,
 * and cannot clip anything.
 *
 * Three things keep it honest.
 *
 * It never hides anything that is already on screen. On mount it measures:
 * a block below the fold is armed and observed, a block already in view is
 * left alone and never animates. So the first screenful paints exactly as
 * the server sent it, with no flicker and no hide-then-show, and the effect
 * only ever applies to something you actually scrolled to.
 *
 * If the measurement never runs — no JavaScript, a hydration error, an old
 * browser — nothing is ever armed and every block simply stays visible.
 * Content that disappears when a script fails is a worse bug than no
 * animation at all.
 *
 * And `prefers-reduced-motion` opts out entirely rather than shortening the
 * transition, because the point of that setting is no movement.
 */
export default function Reveal({
  children,
  className = "",
  /** Seconds of delay, for staggering a caption behind its picture. */
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Already on screen when the page loaded: leave it exactly as rendered.
    const box = el.getBoundingClientRect();
    if (box.top < window.innerHeight) return;

    setArmed(true);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          setShown(true);
          io.disconnect();
        }
      },
      // A little before the edge, so it has finished arriving by the time
      // it is properly in view rather than animating under the reader.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const hidden = armed && !shown;

  return (
    <div
      ref={ref}
      style={hidden || !armed ? undefined : { transitionDelay: `${delay}s` }}
      className={`${className} ${
        armed
          ? `transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none ${
              hidden ? "translate-y-6 opacity-0" : "translate-y-0 opacity-100"
            }`
          : ""
      }`}
    >
      {children}
    </div>
  );
}
