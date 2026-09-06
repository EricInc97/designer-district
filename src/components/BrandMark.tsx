import { styleFor, isRealAsset } from "@/lib/brandStyles";
import type { Brand } from "@/lib/types";

/**
 * A brand's resting wordmark. See lib/brandStyles.ts for the per-house
 * typography and for how to swap in a licensed logo file.
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
    lg: "text-4xl sm:text-5xl",
  }[size];

  if (isRealAsset(brand.logo_url)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={brand.logo_url!}
        alt={decorative ? "" : brand.name}
        loading="lazy"
        className={`max-h-full w-auto max-w-full object-contain ${className}`}
      />
    );
  }

  const style = styleFor(brand.slug);

  return (
    <span
      aria-hidden={decorative || undefined}
      className={`inline-block select-none leading-none text-ink ${sizeClass} ${style.markClass} ${className}`}
      style={style.markStyle}
    >
      {style.label ?? brand.name.toUpperCase()}
    </span>
  );
}
