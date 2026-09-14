import Link from "next/link";
import type { BrandMedia } from "@/lib/types";

/**
 * An editorial band between product groups: a full-bleed shot with the
 * collection title laid over it and a way through to the products.
 *
 * Runs edge to edge because it is a full-width sibling of the product grids,
 * which constrain themselves. It used to break out of a shared container with
 * `left-1/2 w-screen -translate-x-1/2`, and that was wrong: 100vw counts the
 * scrollbar and the content box does not, so on a desktop it overhung by half
 * a scrollbar at each edge and the whole page scrolled sideways 8px.
 */
export default function BrandLookbook({ media }: { media: BrandMedia }) {
  const onDark = media.ink !== "dark";

  return (
    <section className="relative w-full overflow-hidden">
      <div className="relative min-h-[50vh] sm:min-h-[62vh]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={media.image_url}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />

        <div
          aria-hidden
          className={`absolute inset-0 ${
            onDark
              ? "bg-gradient-to-r from-black/65 via-black/20 to-transparent"
              : "bg-gradient-to-r from-white/80 via-white/30 to-transparent"
          }`}
        />

        <div className="relative mx-auto flex min-h-[50vh] max-w-7xl flex-col justify-center px-5 sm:min-h-[62vh] sm:px-8">
          <div className={onDark ? "text-white" : "text-ink"}>
            {media.subhead && (
              <p className="text-[11px] uppercase tracking-[0.22em] opacity-80">
                {media.subhead}
              </p>
            )}
            {media.headline && (
              <h2 className="display mt-3 max-w-2xl text-2xl leading-tight sm:text-4xl">
                {media.headline}
              </h2>
            )}
            {media.cta_label && media.cta_href && (
              <Link
                href={media.cta_href}
                className={`mt-6 inline-block border-b pb-1 text-xs font-semibold uppercase tracking-[0.2em] transition-opacity hover:opacity-70 ${
                  onDark ? "border-white text-white" : "border-ink text-ink"
                }`}
              >
                {media.cta_label}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
