import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import CornerFrame from "@/components/CornerFrame";
import { styleFor } from "@/lib/brandStyles";
import type { Brand } from "@/lib/types";

/**
 * A brand tile: square corners, a hairline edge and corner brackets. At rest
 * it is the monochrome wordmark on paper; on hover it crossfades to that
 * house's own colourway, brackets and all.
 *
 * Two stacked layers rather than a JS hover state, so it stays a server
 * component and the transition never depends on hydration. The layer classes
 * are also what let touch devices show the colourway outright, since they
 * never fire a hover (see globals.css).
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
      className={`group relative block aspect-[16/9] overflow-hidden border border-rule bg-paper-raised transition-colors hover:border-transparent ${className}`}
    >
      {/* The brand's own colourway. */}
      <span
        aria-hidden
        className="brand-hover-layer pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100"
        style={style.hover.style}
      />

      {/* Resting state. */}
      <span className="brand-rest-layer absolute inset-0 flex items-center justify-center px-8 text-ink transition-opacity duration-300 group-hover:opacity-0">
        <CornerFrame />
        <BrandMark brand={brand} size="lg" decorative />
      </span>

      {/* Hover state, inheriting the colourway's ink. */}
      <span
        aria-hidden
        className="brand-hover-layer absolute inset-0 flex items-center justify-center px-8 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={style.hover.textStyle}
      >
        <CornerFrame />
        <BrandMark brand={brand} size="lg" decorative className="!text-current" />
      </span>
    </Link>
  );
}
