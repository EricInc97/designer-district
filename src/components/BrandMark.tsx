import type { CSSProperties } from "react";
import { styleFor, isRealAsset } from "@/lib/brandStyles";
import type { Brand } from "@/lib/types";

/**
 * A brand's resting mark. See lib/brandStyles.ts for the per-house typography
 * and for how to swap in a licensed logo file.
 *
 * A brand whose logo_url points at an SVG gets the full lockup: the emblem
 * above, the wordmark below. The emblem is painted through a CSS mask rather
 * than dropped in as an <img>, so it takes `currentColor` and flips with the
 * tile the way live text does. Any other asset type is shown as-is.
 */
export default function BrandMark({
  brand,
  className = "",
  size = "md",
  decorative = false,
}: {
  brand: Pick<Brand, "name" | "slug" | "logo_url">;
  className?: string;
  size?: "sm" | "md" | "lg";
  /** Set when a real heading already names the brand, so it isn't read twice. */
  decorative?: boolean;
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

  // The emblem tracks the wordmark: roughly 2.5x its height at every size.
  const emblemClass = {
    sm: "h-7",
    md: "h-12",
    lg: "h-[clamp(1.5rem,9vw,7rem)]",
  }[size];

  const style = styleFor(brand.slug);
  const label = style.label ?? brand.name.toUpperCase();

  const wordmarkClass = `inline-block select-none leading-none ${sizeClass} ${style.markClass}`;

  const logo = brand.logo_url;

  if (isRealAsset(logo)) {
    if (!logo!.toLowerCase().endsWith(".svg")) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo!}
          alt={decorative ? "" : brand.name}
          loading="lazy"
          className={`max-h-full w-auto max-w-full object-contain ${className}`}
        />
      );
    }

    const maskStyle: CSSProperties = {
      WebkitMaskImage: `url("${logo}")`,
      maskImage: `url("${logo}")`,
      WebkitMaskRepeat: "no-repeat",
      maskRepeat: "no-repeat",
      WebkitMaskPosition: "center",
      maskPosition: "center",
      WebkitMaskSize: "contain",
      maskSize: "contain",
      backgroundColor: "currentColor",
    };

    return (
      <span
        aria-hidden={decorative || undefined}
        className={`inline-flex max-w-full flex-col items-center justify-center gap-[0.3em] text-ink ${className}`}
      >
        <span
          aria-hidden
          className={`block aspect-square shrink-0 ${emblemClass}`}
          style={maskStyle}
        />
        <span className={wordmarkClass} style={style.markStyle}>
          {label}
        </span>
      </span>
    );
  }

  return (
    <span
      aria-hidden={decorative || undefined}
      className={`text-ink ${wordmarkClass} ${className}`}
      style={style.markStyle}
    >
      {label}
    </span>
  );
}
