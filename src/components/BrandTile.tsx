import Link from "next/link";
import { ArrowRight } from "lucide-react";
import BrandMark from "@/components/BrandMark";
import CornerFrame from "@/components/CornerFrame";
import { styleFor } from "@/lib/brandStyles";
import type { Brand } from "@/lib/types";

/**
 * A brand tile: square corners, a hairline edge and corner brackets, and the
 * house's own colourway as the ground, with its mark on top.
 *
 * The colourway used to be a hover reveal that crossfaded up from a cream
 * panel, which meant a touch device, where nothing ever hovers, saw something
 * different from a desktop. It was the touch version people actually liked, so
 * that is the one that stayed: the ground is always the house's, and hover is
 * now only a small lift of the mark rather than the thing that carries the
 * colour.
 *
 * Every tile carries a visible "Shop" line. People shown the homepage did not
 * work out that the tiles were links at all: a mark on a coloured square looks
 * like a logo wall, and the only thing saying otherwise was a hover lift, which
 * on a phone never happens. So the affordance is permanent rather than
 * revealed, and hover only sharpens what is already there.
 *
 * Still a server component, and the mark takes `hovered` so a house whose
 * artwork was drawn for a dark ground gets that cut rather than the paper one.
 */
export default function BrandTile({
  brand,
  className = "",
}: {
  brand: Brand;
  className?: string;
}) {
  const style = styleFor(brand.slug);

  return (
    <Link
      href={`/brands/${brand.slug}`}
      aria-label={`Shop ${brand.name}`}
      className={`group relative block aspect-square overflow-hidden border border-rule transition-transform duration-200 active:scale-[0.97] ${className}`}
      style={style.hover.style}
    >
      {/* Carries the house's ink, so everything inside can use currentColor
          and stay legible on any colourway. */}
      <span className="absolute inset-0" style={style.hover.textStyle}>
        <CornerFrame inset="inset-1.5 sm:inset-2.5" size="h-2 w-2 sm:h-4 sm:w-4" />

        {/* The mark sits a little high in the square to leave the call to
            action a band of its own rather than crowding it. */}
        <span className="absolute inset-0 flex items-center justify-center px-2 pb-5 transition-transform duration-500 ease-out group-hover:scale-[1.04] sm:px-6 sm:pb-7">
          <BrandMark
            brand={brand}
            size="lg"
            decorative
            hovered
            className="!text-current"
          />
        </span>

        {/* Outside the scaling layer: this should stay put while the mark
            lifts. aria-hidden because the link already announces "Shop
            <house>", and a screen reader does not need it twice. */}
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 pb-2.5 text-[8px] font-semibold uppercase tracking-[0.18em] opacity-75 transition-opacity duration-300 group-hover:opacity-100 sm:gap-1.5 sm:pb-4 sm:text-[10px]"
        >
          Shop
          <ArrowRight
            className="h-2 w-2 transition-transform duration-300 group-hover:translate-x-0.5 sm:h-2.5 sm:w-2.5"
            strokeWidth={2.5}
          />
        </span>
      </span>
    </Link>
  );
}
