import Link from "next/link";
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
      className={`group relative block aspect-square overflow-hidden border border-rule ${className}`}
      style={style.hover.style}
    >
      <span
        className="absolute inset-0 flex items-center justify-center px-2 transition-transform duration-500 ease-out group-hover:scale-[1.04] sm:px-6"
        style={style.hover.textStyle}
      >
        <CornerFrame inset="inset-1.5 sm:inset-2.5" size="h-2 w-2 sm:h-4 sm:w-4" />
        <BrandMark
          brand={brand}
          size="lg"
          decorative
          hovered
          className="!text-current"
        />
      </span>
    </Link>
  );
}
