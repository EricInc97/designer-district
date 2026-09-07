import { styleFor, isRealAsset } from "@/lib/brandStyles";
import type { Brand } from "@/lib/types";

/**
 * A brand's mark: the house's own logo file where there is one, otherwise the
 * wordmark set in a face matching that house's register.
 *
 * A tile shows the mark twice, once per crossfade layer, and the two layers sit
 * on very different grounds. `hovered` picks the artwork drawn for the
 * colourway rather than for paper, which matters for a logo built for a dark
 * ground: see `hover.logoUrl` in lib/brandStyles.ts.
 */
export default function BrandMark({
  brand,
  className = "",
  size = "md",
  decorative = false,
  hovered = false,
}: {
  brand: Pick<Brand, "name" | "slug" | "logo_url">;
  className?: string;
  size?: "sm" | "md" | "lg";
  /** Set when a real heading already names the brand, so it isn't read twice. */
  decorative?: boolean;
  /** Set on the layer that sits on the house colourway. */
  hovered?: boolean;
}) {
  const sizeClass = {
    sm: "text-lg sm:text-xl",
    md: "text-2xl sm:text-3xl",
    // Fluid: the tiles sit three-across at every width, so on a phone each one
    // is ~100px and a fixed text-4xl would overflow. Clamped so it still caps
    // out once the grid stops growing at max-w-7xl. The vw factor is set by the
    // longest wordmark in the roster (CASABLANCA), which has to clear the tile
    // padding on a 375px phone without wrapping.
    lg: "text-[clamp(0.6rem,2.8vw,3rem)]",
  }[size];

  // A logo is held off the tile edge rather than filling it, so the corner
  // brackets keep their air. The percentages resolve against the crossfade
  // layer, which is inset-0 on the tile; the smaller sizes sit in auto-height
  // rows instead, so those are capped in absolute terms.
  const logoClass = {
    sm: "max-h-12 max-w-[62%]",
    md: "max-h-20 max-w-[70%]",
    lg: "max-h-[62%] max-w-[76%]",
  }[size];

  const style = styleFor(brand.slug);
  const logo = (hovered && style.hover.logoUrl) || brand.logo_url;

  if (isRealAsset(logo)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo!}
        alt={decorative ? "" : brand.name}
        loading="lazy"
        className={`w-auto object-contain ${logoClass} ${className}`}
      />
    );
  }

  // An array is an explicit multi-line lockup, so each line is held together;
  // a plain label is still free to wrap when the tile is too narrow for it.
  const label = style.label ?? brand.name.toUpperCase();
  const stacked = Array.isArray(label);
  const lines = stacked ? label : [label];

  return (
    <span
      aria-hidden={decorative || undefined}
      className={`text-ink text-center ${sizeClass} ${style.markClass} inline-block select-none leading-[0.95] ${className}`}
      style={style.markStyle}
    >
      {lines.map((line, i) => (
        <span key={line} className={stacked ? "block whitespace-nowrap" : "block"}>
          {line}
          {i === 0 && style.registered && (
            <span className="align-super text-[0.32em] tracking-normal">®</span>
          )}
        </span>
      ))}
    </span>
  );
}
