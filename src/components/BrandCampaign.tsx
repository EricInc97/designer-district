import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import { styleFor } from "@/lib/brandStyles";
import type { Brand, BrandMedia } from "@/lib/types";

/**
 * The full-bleed shot at the top of a brand page.
 *
 * Falls back to the house colourway with its mark centred when there is no
 * campaign image, which is the state every brand starts in. The fallback has to
 * look deliberate rather than empty, because for a while it is what most houses
 * will show: same ground as the tile on the homepage, so arriving here feels
 * like walking through the tile rather than landing somewhere unrelated.
 */
export default function BrandCampaign({
  brand,
  media,
}: {
  brand: Brand;
  media: BrandMedia | null;
}) {
  const style = styleFor(brand.slug);

  if (!media) {
    return (
      <section
        className="relative flex min-h-[38vh] items-center justify-center overflow-hidden sm:min-h-[46vh]"
        style={style.hover.style}
      >
        <span
          className="flex items-center justify-center px-6"
          style={style.hover.textStyle}
        >
          <BrandMark
            brand={brand}
            size="lg"
            decorative
            hovered
            className="!text-current"
          />
        </span>
      </section>
    );
  }

  // Type sits on a photograph, so it carries its own scrim rather than trusting
  // the image to be dark where the words land.
  const onDark = media.ink !== "dark";

  return (
    <section className="relative min-h-[52vh] overflow-hidden sm:min-h-[68vh]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={media.image_url}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        fetchPriority="high"
      />

      <div
        aria-hidden
        className={`absolute inset-0 ${
          onDark
            ? "bg-gradient-to-t from-black/70 via-black/25 to-black/10"
            : "bg-gradient-to-t from-white/80 via-white/30 to-white/10"
        }`}
      />

      <div className="relative mx-auto flex min-h-[52vh] max-w-7xl flex-col justify-end px-5 pb-10 sm:min-h-[68vh] sm:px-8 sm:pb-16">
        <div className={onDark ? "text-white" : "text-ink"}>
          {media.headline && (
            <h2 className="display max-w-3xl text-3xl leading-tight sm:text-5xl">
              {media.headline}
            </h2>
          )}
          {media.subhead && (
            <p className="mt-4 max-w-xl text-sm leading-relaxed opacity-90 sm:text-base">
              {media.subhead}
            </p>
          )}
          {media.cta_label && media.cta_href && (
            <Link
              href={media.cta_href}
              className={`mt-7 inline-block rounded-full px-7 py-3 text-xs font-semibold uppercase tracking-[0.2em] transition-opacity hover:opacity-90 ${
                onDark ? "bg-white text-ink" : "bg-ink text-paper"
              }`}
            >
              {media.cta_label}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
