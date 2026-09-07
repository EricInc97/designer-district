import { styleFor, isRealAsset } from "@/lib/brandStyles";
import { BrandEmblem, hasEmblem } from "@/components/brandEmblems";
import type { Brand } from "@/lib/types";

/**
 * A brand's resting mark, in one of three forms, in priority order:
 *
 *  1. a licensed file, once `logo_url` points at one;
 *  2. a full lockup from brandEmblems, for the houses whose mark is a
 *     composition rather than a wordmark. It carries its own type, so the
 *     wordmark is not repeated underneath;
 *  3. the wordmark, set in a face matching that house's register.
 *
 * See lib/brandStyles.ts for the per-house typography.
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

  // A lockup carries its own type, so it is sized against the tile rather than
  // against the wordmark it replaces.
  const lockupClass = {
    sm: "h-12",
    md: "h-24",
    lg: "h-[clamp(2.6rem,15vw,12rem)]",
  }[size];

  const style = styleFor(brand.slug);
  // An array is an explicit multi-line lockup, so each line is held together;
  // a plain label is still free to wrap when the tile is too narrow for it.
  const label = style.label ?? brand.name.toUpperCase();
  const stacked = Array.isArray(label);
  const lines = stacked ? label : [label];

  const logo = brand.logo_url;

  if (isRealAsset(logo)) {
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

  if (hasEmblem(brand.slug)) {
    return (
      <span
        aria-hidden={decorative || undefined}
        className={`inline-flex max-w-full items-center justify-center text-ink ${className}`}
      >
        <BrandEmblem
          slug={brand.slug}
          className={`${lockupClass} w-auto max-w-full`}
        />
      </span>
    );
  }

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
